import { describe, it, expect } from "vitest";
import { canSummarize, canPush, DEFAULT_SETTINGS } from "../src/settings.js";

describe("settings gating", () => {
  it("canSummarize needs an api key", () => {
    expect(canSummarize(DEFAULT_SETTINGS)).toBe(false);
    expect(canSummarize({ ...DEFAULT_SETTINGS, apiKey: "gsk_x" })).toBe(true);
  });

  it("canPush needs a token and an owner/name repo", () => {
    expect(canPush({ ...DEFAULT_SETTINGS, githubToken: "ghp_x" })).toBe(false);
    expect(canPush({ ...DEFAULT_SETTINGS, githubToken: "ghp_x", githubRepo: "me/engram-kb" })).toBe(true);
    expect(canPush({ ...DEFAULT_SETTINGS, githubToken: "ghp_x", githubRepo: "not-a-repo" })).toBe(false);
  });
});
