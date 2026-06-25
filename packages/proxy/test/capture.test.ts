import { describe, it, expect } from "vitest";
import { extractConversation } from "../src/capture.js";
import type { ApiRoute } from "../src/providers.js";

const anthropicRoute: ApiRoute = {
  pathPrefix: "/v1/messages",
  provider: "claude",
  upstreamBase: "https://api.anthropic.com",
  shape: "anthropic",
};
const openaiRoute: ApiRoute = {
  pathPrefix: "/v1/chat/completions",
  provider: "chatgpt",
  upstreamBase: "https://api.openai.com",
  shape: "openai",
};

describe("extractConversation — Anthropic", () => {
  const request = {
    model: "claude-sonnet-4-6",
    system: "You are helpful.",
    messages: [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
      { role: "user", content: [{ type: "text", text: "Explain rate limiting" }] },
    ],
  };
  const response = { role: "assistant", content: [{ type: "text", text: "Use a sliding window." }] };

  it("pulls the system prompt, full history, and the response reply", () => {
    const conv = extractConversation(anthropicRoute, request, response)!;
    expect(conv.provider).toBe("claude");
    expect(conv.messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user", "assistant"]);
    expect(conv.messages.at(-1)!.content).toBe("Use a sliding window.");
  });

  it("flattens array content blocks to text", () => {
    const conv = extractConversation(anthropicRoute, request, response)!;
    expect(conv.messages[3]!.content).toBe("Explain rate limiting");
  });

  it("derives a stable id from the first user message", () => {
    const a = extractConversation(anthropicRoute, request, response)!;
    const b = extractConversation(anthropicRoute, request, {})!;
    expect(a.id).toBe(b.id); // same conversation, different turn -> same id
    expect(a.id).toMatch(/^api-claude-/);
  });
});

describe("extractConversation — OpenAI", () => {
  const request = {
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "What is 2+2?" }],
  };
  const response = { choices: [{ message: { role: "assistant", content: "4" } }] };

  it("reads choices[0].message.content as the reply", () => {
    const conv = extractConversation(openaiRoute, request, response)!;
    expect(conv.provider).toBe("chatgpt");
    expect(conv.messages.map((m) => m.content)).toEqual(["What is 2+2?", "4"]);
    expect(conv.title).toBe("What is 2+2?");
  });

  it("returns request-only history when the response is a stream (no reply)", () => {
    const conv = extractConversation(openaiRoute, request, null)!;
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0]!.role).toBe("user");
  });
});
