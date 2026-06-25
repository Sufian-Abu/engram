import { describe, it, expect, beforeAll, vi } from "vitest";
import type { Conversation } from "../src/types.js";

/**
 * Drives the real background service worker (its onMessage handler) with a
 * mocked chrome, proving the full wiring: captured message -> parseFor ->
 * dedupe -> chrome.storage -> badge. No browser needed.
 */
type Listener = (msg: unknown) => void;

const store: Record<string, unknown> = {};
let badge = "";
let onMessage: Listener;

const chromeMock = {
  runtime: { onMessage: { addListener: (fn: Listener) => (onMessage = fn) } },
  storage: {
    local: {
      get: async (key: string) => ({ [key]: store[key] }),
      set: async (obj: Record<string, unknown>) => void Object.assign(store, obj),
      remove: async (key: string) => void delete store[key],
    },
  },
  action: {
    setBadgeText: async ({ text }: { text: string }) => void (badge = text),
    setBadgeBackgroundColor: async () => {},
  },
};

const claudeCapture = (uuid: string, title: string) => ({
  source: "engram",
  kind: "conversation",
  provider: "claude",
  payload: {
    uuid,
    name: title,
    chat_messages: [
      { sender: "human", text: "hi" },
      { sender: "assistant", text: "hello" },
    ],
  },
});

const stored = (): Conversation[] => (store.conversations as Conversation[]) ?? [];

beforeAll(async () => {
  (globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;
  await import("../src/background.js"); // registers onMessage against the mock
});

describe("background service worker", () => {
  it("captures a claude message into storage and sets the badge", async () => {
    onMessage(claudeCapture("11111111-2222-3333-4444-555555555555", "First chat"));
    await vi.waitFor(() => expect(stored()).toHaveLength(1));
    expect(stored()[0]!.title).toBe("First chat");
    expect(stored()[0]!.provider).toBe("claude");
    expect(badge).toBe("1");
  });

  it("dedupes by id (re-capturing the same conversation updates, not appends)", async () => {
    onMessage(claudeCapture("11111111-2222-3333-4444-555555555555", "First chat (renamed)"));
    await vi.waitFor(() => expect(stored()[0]!.title).toBe("First chat (renamed)"));
    expect(stored()).toHaveLength(1);
  });

  it("adds a second, distinct conversation", async () => {
    onMessage(claudeCapture("99999999-8888-7777-6666-555555555555", "Second chat"));
    await vi.waitFor(() => expect(stored()).toHaveLength(2));
    expect(badge).toBe("2");
  });

  it("ignores non-engram messages", async () => {
    onMessage({ source: "somethingelse", kind: "conversation", payload: {} });
    await new Promise((r) => setTimeout(r, 10));
    expect(stored()).toHaveLength(2); // unchanged
  });
});
