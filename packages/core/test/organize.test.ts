import { describe, it, expect } from "vitest";
import { entryPath, slug } from "../src/organize.js";
import type { KBEntry } from "../src/types.js";

const entry = (over: Partial<KBEntry> = {}): KBEntry => ({
  title: "Designing a Rate Limiter",
  date: "2026-06-20",
  project: "engram",
  topics: [],
  summary: "",
  keyFacts: [],
  decisions: [],
  openQuestions: [],
  resumePrompt: "",
  provider: "claude",
  sourceConversationId: "sample-claude-001",
  ...over,
});

describe("entryPath", () => {
  it("lays out kb/YYYY/MM/project/slug-hash.md", () => {
    const p = entryPath(entry(), "/kb");
    expect(p).toBe("/kb/2026/06/engram/designing-a-rate-limiter-9311e40e.md");
  });

  it("derives the filename hash from the FULL source id (provenance guard)", () => {
    // The bug we fixed: a prefix slice collided across ids sharing a prefix.
    const a = entryPath(entry({ sourceConversationId: "claude-code-aaaa" }), "/kb");
    const b = entryPath(entry({ sourceConversationId: "claude-code-bbbb" }), "/kb");
    expect(a).not.toBe(b);
  });

  it("is stable across calls (idempotent filenames)", () => {
    expect(entryPath(entry(), "/kb")).toBe(entryPath(entry(), "/kb"));
  });

  it("falls back to unknown/00 when the date is malformed", () => {
    expect(entryPath(entry({ date: "" }), "/kb")).toContain("/kb/unknown/00/engram/");
  });
});

describe("slug", () => {
  it("lowercases, collapses non-alphanumerics, and trims dashes", () => {
    expect(slug("  Hello, World!!  ")).toBe("hello-world");
  });

  it("returns 'untitled' for an empty result", () => {
    expect(slug("!!!")).toBe("untitled");
  });

  it("caps length at 60 chars", () => {
    expect(slug("a".repeat(100)).length).toBe(60);
  });
});
