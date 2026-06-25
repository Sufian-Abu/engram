import { describe, it, expect } from "vitest";
import { parseChatGptWeb, matchChatGptUrl } from "../src/providers/chatgpt.js";

// Realistic backend-api/conversation/<uuid> mapping tree:
// root(system) -> u1(user) -> a1a(assistant, original) | a1b(assistant, regenerated)
// The latest child (a1b) is what the user sees, so linearization should pick it.
const chatgptPayload = {
  title: "Designing a rate limiter",
  create_time: 1_750_000_000,
  update_time: 1_750_000_600,
  conversation_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  mapping: {
    root: { id: "root", message: { author: { role: "system" }, content: { parts: [""] } }, parent: null, children: ["u1"] },
    u1: {
      id: "u1",
      message: { author: { role: "user" }, content: { content_type: "text", parts: ["How do I rate limit an API?"] }, create_time: 1_750_000_100 },
      parent: "root",
      children: ["a1a", "a1b"],
    },
    a1a: {
      id: "a1a",
      message: { author: { role: "assistant" }, content: { parts: ["First draft answer."] }, create_time: 1_750_000_200 },
      parent: "u1",
      children: [],
    },
    a1b: {
      id: "a1b",
      message: { author: { role: "assistant" }, content: { parts: ["Use a sliding window with Redis."] }, create_time: 1_750_000_300 },
      parent: "u1",
      children: [],
    },
  },
};

describe("parseChatGptWeb", () => {
  it("maps the mapping tree to a normalized Conversation", () => {
    const conv = parseChatGptWeb(chatgptPayload)!;
    expect(conv.id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(conv.provider).toBe("chatgpt");
    expect(conv.title).toBe("Designing a rate limiter");
  });

  it("drops the root system primer and keeps user/assistant turns", () => {
    const conv = parseChatGptWeb(chatgptPayload)!;
    expect(conv.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("follows the latest child branch (the regenerated answer)", () => {
    const conv = parseChatGptWeb(chatgptPayload)!;
    expect(conv.messages[1]!.content).toBe("Use a sliding window with Redis.");
  });

  it("converts epoch create_time to ISO", () => {
    const conv = parseChatGptWeb(chatgptPayload)!;
    expect(conv.createdAt).toBe(new Date(1_750_000_000 * 1000).toISOString());
  });

  it("returns null without a mapping", () => {
    expect(parseChatGptWeb({ conversation_id: "x" })).toBeNull();
    expect(parseChatGptWeb(null)).toBeNull();
  });
});

describe("matchChatGptUrl", () => {
  it("matches the single-conversation detail GET", () => {
    expect(matchChatGptUrl("https://chatgpt.com/backend-api/conversation/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toBe(true);
  });
  it("does not match the streaming POST endpoint (no uuid)", () => {
    expect(matchChatGptUrl("https://chatgpt.com/backend-api/conversation")).toBe(false);
  });
});
