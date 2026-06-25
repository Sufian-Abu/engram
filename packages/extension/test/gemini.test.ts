import { describe, it, expect } from "vitest";
import { parseGeminiWeb } from "../src/providers/gemini.js";
import { parseFor, matchProvider } from "../src/providers/index.js";

// Gemini's content script builds a normalized Conversation; parse just validates.
const normalized = {
  id: "gemini-abc123",
  provider: "gemini",
  title: "Trip planning",
  messages: [
    { role: "user", content: "Plan a 3-day Tokyo trip" },
    { role: "assistant", content: "Day 1: Asakusa and Akihabara..." },
  ],
};

describe("parseGeminiWeb", () => {
  it("accepts a well-formed normalized conversation", () => {
    const conv = parseGeminiWeb(normalized)!;
    expect(conv.provider).toBe("gemini");
    expect(conv.id).toBe("gemini-abc123");
    expect(conv.messages).toHaveLength(2);
  });

  it("rejects junk / empty payloads", () => {
    expect(parseGeminiWeb(null)).toBeNull();
    expect(parseGeminiWeb({ id: "x", messages: [] })).toBeNull();
    expect(parseGeminiWeb({ messages: [{ role: "user", content: "hi" }] })).toBeNull();
  });

  it("is reachable via the registry and never matches a URL (DOM-captured)", () => {
    expect(parseFor("gemini", normalized)?.provider).toBe("gemini");
    expect(matchProvider("https://gemini.google.com/app/abc123")).toBeNull();
  });
});
