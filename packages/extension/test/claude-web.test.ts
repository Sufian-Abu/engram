import { describe, it, expect } from "vitest";
import { parseClaudeWeb, isConversationUrl } from "../src/claude-web.js";
import { upsertById } from "../src/merge.js";
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
    expect(conv.createdAt).toBe("2026-06-20T10:00:00Z");
    expect(conv.updatedAt).toBe("2026-06-20T10:30:00Z");
  });

  it("maps human->user and assistant->assistant", () => {
    const conv = parseClaudeWeb(claudePayload)!;
    expect(conv.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("falls back to structured content blocks when text is empty", () => {
    const conv = parseClaudeWeb(claudePayload)!;
    expect(conv.messages[1]!.content).toBe("Use a sliding window with Redis.");
  });

  it("drops empty/whitespace-only messages", () => {
    const conv = parseClaudeWeb(claudePayload)!;
    expect(conv.messages).toHaveLength(2); // the blank m3 is dropped
  });

  it("returns null for non-conversation payloads", () => {
    expect(parseClaudeWeb({})).toBeNull();
    expect(parseClaudeWeb({ uuid: "x", chat_messages: [] })).toBeNull();
    expect(parseClaudeWeb(null)).toBeNull();
  });
});

describe("isConversationUrl", () => {
  it("matches a single-conversation fetch (has a uuid)", () => {
    expect(
      isConversationUrl("https://claude.ai/api/organizations/org/chat_conversations/11111111-2222-3333-4444-555555555555?tree=True"),
    ).toBe(true);
  });

  it("does not match the conversation-list endpoint (no uuid)", () => {
    expect(isConversationUrl("https://claude.ai/api/organizations/org/chat_conversations")).toBe(false);
  });
});

describe("upsertById", () => {
  const a: Conversation = { id: "a", provider: "claude", messages: [{ role: "user", content: "hi" }] };

  it("appends a new conversation", () => {
    expect(upsertById([], a)).toEqual([a]);
  });

  it("replaces an existing conversation with the same id (latest wins)", () => {
    const updated: Conversation = { ...a, title: "Now titled" };
    const result = upsertById([a], updated);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("Now titled");
  });
});
