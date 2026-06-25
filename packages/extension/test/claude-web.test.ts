import { describe, it, expect } from "vitest";
import { parseClaudeWeb, matchClaudeUrl } from "../src/providers/claude.js";
import { upsertById } from "../src/merge.js";
import { matchProvider, parseFor } from "../src/providers/index.js";
import type { Conversation } from "../src/types.js";

// A trimmed but realistic claude.ai chat_conversations/<uuid> response.
const claudePayload = {
  uuid: "11111111-2222-3333-4444-555555555555",
  name: "Designing a rate limiter",
  created_at: "2026-06-20T10:00:00Z",
  updated_at: "2026-06-20T10:30:00Z",
  chat_messages: [
    { uuid: "m1", sender: "human", text: "How do I rate limit an API?", created_at: "2026-06-20T10:00:00Z" },
    {
      uuid: "m2",
      sender: "assistant",
      text: "",
      content: [{ type: "text", text: "Use a sliding window with Redis." }],
      created_at: "2026-06-20T10:01:00Z",
    },
    { uuid: "m3", sender: "human", text: "   ", created_at: "2026-06-20T10:02:00Z" },
  ],
};

describe("parseClaudeWeb", () => {
  it("maps a claude.ai payload to the normalized Conversation shape", () => {
    const conv = parseClaudeWeb(claudePayload)!;
    expect(conv.id).toBe("11111111-2222-3333-4444-555555555555");
    expect(conv.provider).toBe("claude");
    expect(conv.title).toBe("Designing a rate limiter");
    expect(conv.updatedAt).toBe("2026-06-20T10:30:00Z");
  });

  it("maps human->user and assistant->assistant", () => {
    expect(parseClaudeWeb(claudePayload)!.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("falls back to structured content blocks when text is empty", () => {
    expect(parseClaudeWeb(claudePayload)!.messages[1]!.content).toBe("Use a sliding window with Redis.");
  });

  it("drops empty/whitespace-only messages", () => {
    expect(parseClaudeWeb(claudePayload)!.messages).toHaveLength(2);
  });

  it("returns null for non-conversation payloads", () => {
    expect(parseClaudeWeb({})).toBeNull();
    expect(parseClaudeWeb({ uuid: "x", chat_messages: [] })).toBeNull();
    expect(parseClaudeWeb(null)).toBeNull();
  });
});

describe("matchClaudeUrl", () => {
  it("matches a single-conversation fetch (has a uuid)", () => {
    expect(matchClaudeUrl("https://claude.ai/api/organizations/org/chat_conversations/11111111-2222-3333-4444-555555555555?tree=True")).toBe(true);
  });
  it("does not match the conversation-list endpoint (no uuid)", () => {
    expect(matchClaudeUrl("https://claude.ai/api/organizations/org/chat_conversations")).toBe(false);
  });
});

describe("upsertById", () => {
  const a: Conversation = { id: "a", provider: "claude", messages: [{ role: "user", content: "hi" }] };

  it("appends a new conversation", () => {
    expect(upsertById([], a)).toEqual([a]);
  });
  it("replaces an existing conversation with the same id (latest wins)", () => {
    const result = upsertById([a], { ...a, title: "Now titled" });
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("Now titled");
  });
});

describe("provider registry", () => {
  it("routes a claude URL to the claude provider and a chatgpt URL to chatgpt", () => {
    expect(matchProvider("https://claude.ai/api/organizations/o/chat_conversations/11111111-2222-3333-4444-555555555555")).toBe("claude");
    expect(matchProvider("https://chatgpt.com/backend-api/conversation/11111111-2222-3333-4444-555555555555")).toBe("chatgpt");
  });
  it("returns null for unrelated URLs", () => {
    expect(matchProvider("https://claude.ai/api/organizations/o/chat_conversations")).toBeNull();
    expect(matchProvider("https://example.com/whatever")).toBeNull();
  });
  it("parseFor dispatches to the right parser", () => {
    expect(parseFor("claude", claudePayload)?.provider).toBe("claude");
  });
});
