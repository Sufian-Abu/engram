import path from "node:path";
import { resolveProviderFromEnv, orderedForFailover, type ProviderSpec, type ProviderCandidate } from "@engram/core";
import { ENV, readEnv, loadDotEnv } from "./env.js";

export interface Config {
  /** The primary provider (anthropic / openai / groq / gemini / openrouter). */
  provider: ProviderSpec | null;
  apiKey: string;
  model: string;
  /** Summarize failover order: primary first, then other configured providers. */
  chain: ProviderCandidate[];
  kbDir: string;
  driveRemote: string;
  drivePath: string;
}

/** Shown when no provider is configured (CLI ingest + serve). */
export const MISSING_KEY_MESSAGE =
  "No provider configured. Copy .env.example to .env and set one of:\n" +
  "  GROQ_API_KEY (free)  GEMINI_API_KEY (free)  OPENROUTER_API_KEY (free)\n" +
  "  ANTHROPIC_API_KEY    OPENAI_API_KEY\n" +
  "  …or run Ollama locally and set ENGRAM_PROVIDER=ollama (no key).";

/** Load .env, resolve the active provider + failover chain, assemble config. */
export const loadConfig = (): Config => {
  loadDotEnv();
  const provider = resolveProviderFromEnv(process.env);
  const model = readEnv(ENV.model) ?? provider?.defaultModel ?? "";
  return {
    provider,
    apiKey: provider ? readEnv(provider.keyEnv) ?? "" : "",
    model,
    chain: buildProviderChain(process.env, provider?.id, model),
    kbDir: path.resolve(readEnv(ENV.kbDir) ?? "./kb"),
    driveRemote: readEnv(ENV.driveRemote) ?? "",
    drivePath: readEnv(ENV.drivePath) ?? "engram-kb",
  };
};

/**
 * Order the providers that have a key set: primary first, then the rest with
 * free providers ahead of paid ones — so a rate-limited free key hands off to
 * another free key before spending on a paid one.
 */
export const buildProviderChain = (
  env: Record<string, string | undefined>,
  primaryId: string | undefined,
  primaryModel: string,
): ProviderCandidate[] => {
  // Providers with a key, plus a no-key provider (Ollama) when it's the primary.
  return orderedForFailover(primaryId)
    .filter((p) => env[p.keyEnv]?.trim() || (p.noKeyRequired && p.id === primaryId))
    .map((p) => ({
    provider: p.id,
    apiKey: env[p.keyEnv]?.trim() || (p.noKeyRequired ? "ollama" : ""),
    // Only the primary honors an ENGRAM_MODEL override; fallbacks use defaults.
    model: p.id === primaryId ? primaryModel || undefined : undefined,
  }));
};
