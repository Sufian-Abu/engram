import { describe, it, expect } from "vitest";
import { canSummarize, canPush, buildCandidates, DEFAULT_SETTINGS, type Settings } from "../src/settings.js";

const withKeys = (keys: Record<string, string>, over: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  keys,
  ...over,
});

describe("settings gating", () => {
  it("canSummarize needs at least one key", () => {
    expect(canSummarize(DEFAULT_SETTINGS)).toBe(false);
    expect(canSummarize(withKeys({ groq: "gsk_x" }))).toBe(true);
  });

  it("canPush needs a token and an owner/name repo", () => {
    expect(canPush({ ...DEFAULT_SETTINGS, githubToken: "ghp_x" })).toBe(false);
    expect(canPush({ ...DEFAULT_SETTINGS, githubToken: "ghp_x", githubRepo: "me/engram-kb" })).toBe(true);
    expect(canPush({ ...DEFAULT_SETTINGS, githubToken: "ghp_x", githubRepo: "not-a-repo" })).toBe(false);
  });
});

describe("buildCandidates (failover order)", () => {
  it("puts the primary first, then free providers before paid", () => {
    const s = withKeys(
      { openai: "a", groq: "g", gemini: "ge", anthropic: "an" },
      { provider: "gemini" },
    );
    expect(buildCandidates(s).map((c) => c.provider)).toEqual(["gemini", "groq", "anthropic", "openai"]);
  });

  it("only includes providers that have a key", () => {
    const s = withKeys({ groq: "g", openrouter: "or" }, { provider: "groq" });
    expect(buildCandidates(s).map((c) => c.provider)).toEqual(["groq", "openrouter"]);
  });

  it("applies the model override only to the primary", () => {
    const s = withKeys({ groq: "g", gemini: "ge" }, { provider: "groq", model: "custom" });
    const c = buildCandidates(s);
    expect(c[0]).toMatchObject({ provider: "groq", model: "custom" });
    expect(c[1]).toMatchObject({ provider: "gemini", model: undefined });
  });

  it("returns nothing when no keys are set", () => {
    expect(buildCandidates(DEFAULT_SETTINGS)).toEqual([]);
  });

  it("includes Ollama (no key) when it's the primary, with a dummy key", () => {
    const s = withKeys({}, { provider: "ollama" });
    expect(canSummarize(s)).toBe(true); // local provider needs no key
    const c = buildCandidates(s);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ provider: "ollama", apiKey: "ollama" });
  });
});
