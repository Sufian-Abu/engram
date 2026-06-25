import path from "node:path";
import { resolveProviderFromEnv, ALL_PROVIDERS, type ProviderSpec, type ProviderCandidate } from "@engram/core";
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
  const configured = ALL_PROVIDERS.filter((p) => env[p.keyEnv]?.trim());
  const ordered = [...configured].sort((a, b) => {
    if (a.id === primaryId) return -1;
    if (b.id === primaryId) return 1;
    return Number(b.free) - Number(a.free); // free before paid
  });
  return ordered.map((p) => ({
    provider: p.id,
    apiKey: env[p.keyEnv]!.trim(),
    // Only the primary honors an ENGRAM_MODEL override; fallbacks use defaults.
    model: p.id === primaryId ? primaryModel || undefined : undefined,
  }));
};
