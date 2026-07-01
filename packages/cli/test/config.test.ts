import { describe, it, expect } from "vitest";
import { buildProviderChain } from "../src/config.js";

describe("buildProviderChain — failover order from env", () => {
  it("puts the primary first, then free before paid, keyed providers only", () => {
    const env = { GROQ_API_KEY: "g", GEMINI_API_KEY: "ge", OPENAI_API_KEY: "o", ANTHROPIC_API_KEY: "a" };
    const chain = buildProviderChain(env, "gemini", "gemini-2.0-flash");
    expect(chain.map((c) => c.provider)).toEqual(["gemini", "groq", "anthropic", "openai"]);
    expect(chain[0]).toMatchObject({ provider: "gemini", apiKey: "ge", model: "gemini-2.0-flash" });
  });

  it("applies the model override only to the primary", () => {
    const chain = buildProviderChain({ GROQ_API_KEY: "g", GEMINI_API_KEY: "x" }, "groq", "llama-custom");
    expect(chain.find((c) => c.provider === "groq")?.model).toBe("llama-custom");
    expect(chain.find((c) => c.provider === "gemini")?.model).toBeUndefined();
  });

  it("includes Ollama (no key) when it's the primary, with a dummy key", () => {
    const chain = buildProviderChain({}, "ollama", "");
    expect(chain).toHaveLength(1);
    expect(chain[0]).toMatchObject({ provider: "ollama", apiKey: "ollama" });
  });

  it("ignores whitespace-only keys and returns [] when nothing is configured", () => {
    expect(buildProviderChain({ GROQ_API_KEY: "   " }, undefined, "")).toEqual([]);
    expect(buildProviderChain({}, undefined, "")).toEqual([]);
  });
});
