import { describe, it, expect } from "vitest";
import { renderEntry } from "../src/render.js";
import type { KBEntry } from "../src/types.js";

const entry = (over: Partial<KBEntry> = {}): KBEntry => ({
  title: "Designing a Rate Limiter",
  date: "2026-06-20",
  project: "engram",
  topics: ["redis", "sliding-window"],
  summary: "We designed a rate limiter.",
  keyFacts: ["Redis is used"],
  decisions: ["Use a Lua script"],
  openQuestions: ["How to handle NAT"],
  resumePrompt: "Continue the rate limiter design.",
  provider: "claude",
  sourceConversationId: "sample-claude-001",
  ...over,
});

describe("renderEntry", () => {
  it("emits YAML front-matter with all provenance fields", () => {
    const md = renderEntry(entry());
    expect(md).toContain("title: Designing a Rate Limiter");
    expect(md).toContain("date: 2026-06-20");
    expect(md).toContain("project: engram");
    expect(md).toContain("provider: claude");
    expect(md).toContain("topics: [redis, sliding-window]");
    expect(md).toContain("source_id: sample-claude-001");
  });

  it("includes a fenced, copy-paste resume prompt", () => {
    const md = renderEntry(entry());
    expect(md).toContain("## Resume prompt");
    expect(md).toContain("```text\nContinue the rate limiter design.\n```");
  });

  it("quotes YAML scalars that contain special characters", () => {
    const md = renderEntry(entry({ title: 'Title: with [brackets]' }));
    expect(md).toContain('title: "Title: with [brackets]"');
  });

  it("omits empty sections", () => {
    const md = renderEntry(entry({ keyFacts: [], decisions: [], openQuestions: [] }));
    expect(md).not.toContain("## Key facts");
    expect(md).not.toContain("## Decisions");
    expect(md).toContain("## Resume prompt"); // always present
  });
});
