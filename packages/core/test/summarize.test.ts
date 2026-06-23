import { describe, it, expect } from "vitest";
import { toKbEntry, renderTranscript, conversationDate } from "../src/summarize.js";
import type { Conversation } from "../src/types.js";

const conv = (over: Partial<Conversation> = {}): Conversation => ({
  id: "conv-1",
  provider: "claude",
  title: "Original title",
  messages: [
    { role: "user", content: "hello" },
    { role: "assistant", content: "hi there" },
  ],
  ...over,
});

describe("toKbEntry", () => {
  it("carries provider + source id from the conversation, not the draft", () => {
    const entry = toKbEntry({ title: "T" }, conv({ id: "abc", provider: "chatgpt" }), "2026-06-20");
    expect(entry.sourceConversationId).toBe("abc");
    expect(entry.provider).toBe("chatgpt");
    expect(entry.date).toBe("2026-06-20");
  });

  it("slugifies the project", () => {
    const entry = toKbEntry({ project: "My Cool Project!" }, conv(), "2026-06-20");
    expect(entry.project).toBe("my-cool-project");
  });

  it("defaults an empty project to 'general'", () => {
    expect(toKbEntry({}, conv(), "2026-06-20").project).toBe("general");
  });

  it("caps topics at 8 and stringifies them", () => {
    const topics = Array.from({ length: 12 }, (_, i) => `t${i}`);
    expect(toKbEntry({ topics }, conv(), "2026-06-20").topics).toHaveLength(8);
  });

  it("falls back to the conversation title when the draft omits one", () => {
    expect(toKbEntry({}, conv({ title: "Conv Title" }), "2026-06-20").title).toBe("Conv Title");
  });

  it("falls back to 'Untitled conversation' when neither has a title", () => {
    expect(toKbEntry({}, conv({ title: undefined }), "2026-06-20").title).toBe("Untitled conversation");
  });
});

describe("renderTranscript", () => {
  it("renders ROLE: content lines for a short conversation unchanged", () => {
    expect(renderTranscript(conv(), 10_000)).toBe("USER: hello\n\nASSISTANT: hi there");
  });

  it("truncates the middle when over the char budget, keeping both ends", () => {
    const big = conv({
      messages: [
        { role: "user", content: "A".repeat(500) },
        { role: "assistant", content: "B".repeat(500) },
      ],
    });
    const out = renderTranscript(big, 200);
    expect(out).toContain("[transcript truncated]");
    expect(out.startsWith("USER: AAA")).toBe(true);
    expect(out.endsWith("BBB")).toBe(true);
  });
});

describe("conversationDate", () => {
  it("prefers updatedAt and trims to YYYY-MM-DD", () => {
    expect(conversationDate(conv({ updatedAt: "2026-06-20T10:00:00Z", createdAt: "2026-01-01" }))).toBe(
      "2026-06-20",
    );
  });

  it("falls back to createdAt when updatedAt is missing", () => {
    expect(conversationDate(conv({ updatedAt: undefined, createdAt: "2026-01-01T00:00:00Z" }))).toBe(
      "2026-01-01",
    );
  });
});
