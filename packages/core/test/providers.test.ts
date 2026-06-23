import { describe, it, expect } from "vitest";
import { resolveProviderFromEnv, getProviderById, ALL_PROVIDERS } from "../src/providers.js";

describe("resolveProviderFromEnv", () => {
  it("auto-picks the only provider whose key is set", () => {
    expect(resolveProviderFromEnv({ GROQ_API_KEY: "gsk_x" })?.id).toBe("groq");
  });

  it("prefers the first provider in registry order when several keys are set", () => {
    const env = { ANTHROPIC_API_KEY: "a", GROQ_API_KEY: "g" };
    expect(resolveProviderFromEnv(env)?.id).toBe("anthropic");
  });

  it("lets ENGRAM_PROVIDER override auto-detection", () => {
    const env = { ENGRAM_PROVIDER: "gemini", GROQ_API_KEY: "g" };
    expect(resolveProviderFromEnv(env)?.id).toBe("gemini");
  });

  it("treats whitespace-only keys as unset", () => {
    const env = { ANTHROPIC_API_KEY: "   ", GROQ_API_KEY: "g" };
    expect(resolveProviderFromEnv(env)?.id).toBe("groq");
  });

  it("returns null when no provider key is present", () => {
    expect(resolveProviderFromEnv({})).toBeNull();
  });
});

describe("getProviderById", () => {
  it("returns the matching spec with the right flavor and endpoint", () => {
    const groq = getProviderById("groq");
    expect(groq.flavor).toBe("openai");
    expect(groq.baseUrl).toContain("api.groq.com");
  });

  it("marks Groq/Gemini/OpenRouter as free and Anthropic/OpenAI as paid", () => {
    expect(getProviderById("groq").free).toBe(true);
    expect(getProviderById("gemini").free).toBe(true);
    expect(getProviderById("openrouter").free).toBe(true);
    expect(getProviderById("anthropic").free).toBe(false);
    expect(getProviderById("openai").free).toBe(false);
  });

  it("throws a helpful error for an unknown provider", () => {
    expect(() => getProviderById("nope")).toThrow(/unknown provider/i);
  });

  it("every provider has a unique id and a key env var", () => {
    const ids = ALL_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of ALL_PROVIDERS) expect(p.keyEnv).toMatch(/_API_KEY$/);
  });
});
