import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  entryPath,
  slug,
  conversationHash,
  findEntryByConversationId,
  readSourceHash,
} from "../src/organize.js";
import { renderEntry } from "../src/render.js";
import type { Conversation, KBEntry } from "../src/types.js";

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

describe("conversationHash", () => {
  const conv = (msgs: Array<[string, string]>): Conversation => ({
    id: "c1",
    provider: "claude",
    messages: msgs.map(([role, content]) => ({ role: role as any, content })),
  });

  it("is identical for identical messages", () => {
    expect(conversationHash(conv([["user", "hi"]]))).toBe(conversationHash(conv([["user", "hi"]])));
  });

  it("changes when a message is added (so updates are detected)", () => {
    const before = conversationHash(conv([["user", "hi"]]));
    const after = conversationHash(conv([["user", "hi"], ["assistant", "hello"]]));
    expect(after).not.toBe(before);
  });
});

describe("findEntryByConversationId / readSourceHash (dedupe)", () => {
  let kbDir: string;

  beforeAll(() => {
    kbDir = fs.mkdtempSync(path.join(os.tmpdir(), "engram-kb-"));
    const e = entry({ title: "A Renamed Title", sourceHash: "deadbeef" });
    const p = entryPath(e, kbDir);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, renderEntry(e));
  });

  it("finds the note by conversation id even if the title later differs", () => {
    // Same sourceConversationId -> same -<hash>.md suffix, regardless of title.
    const found = findEntryByConversationId(kbDir, "sample-claude-001");
    expect(found).not.toBeNull();
    expect(found!.endsWith("-9311e40e.md")).toBe(true);
  });

  it("returns null for an unknown conversation", () => {
    expect(findEntryByConversationId(kbDir, "nope")).toBeNull();
  });

  it("reads source_hash back from the note's front-matter", () => {
    const found = findEntryByConversationId(kbDir, "sample-claude-001")!;
    expect(readSourceHash(found)).toBe("deadbeef");
  });
});
