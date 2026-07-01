import { describe, it, expect } from "vitest";
import { parseAny } from "../src/parsers/index.js";

describe("parseAny — format dispatch", () => {
  it("parses a single Engram-normalized conversation", () => {
    const out = parseAny({ id: "c1", provider: "claude", messages: [{ role: "user", content: "hi" }] });
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("c1");
  });

  it("parses an array of normalized conversations", () => {
    const out = parseAny([
      { id: "a", provider: "claude", messages: [{ role: "user", content: "x" }] },
      { id: "b", provider: "chatgpt", messages: [{ role: "user", content: "y" }] },
    ]);
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("routes a ChatGPT data-export node to the ChatGPT parser", () => {
    const out = parseAny([
      {
        title: "Export chat",
        conversation_id: "exp-1",
        current_node: "n2",
        mapping: {
          n1: { message: { author: { role: "user" }, content: { parts: ["hi"] } }, parent: null },
          n2: { message: { author: { role: "assistant" }, content: { parts: ["hello"] } }, parent: "n1" },
        },
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.provider).toBe("chatgpt");
    expect(out[0]!.messages.map((m) => m.content)).toEqual(["hi", "hello"]);
  });

  it("routes a Claude Code transcript to the claude-code parser", () => {
    const out = parseAny([
      { sessionId: "s1", type: "user", message: { role: "user", content: "hello" } },
      { sessionId: "s1", type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "hi" }] } },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.provider).toBe("claude-code");
    expect(out[0]!.id).toBe("claude-code-s1");
  });

  it("returns [] for unrecognizable input", () => {
    expect(parseAny({ foo: "bar" })).toEqual([]);
    expect(parseAny(42)).toEqual([]);
    expect(parseAny([])).toEqual([]);
  });
});
