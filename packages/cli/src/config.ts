import path from "node:path";
import { resolveProviderFromEnv, type ProviderSpec } from "@engram/core";
import { ENV, readEnv, loadDotEnv } from "./env.js";

export interface Config {
  /** The resolved provider (anthropic / openai / groq / gemini / openrouter). */
  provider: ProviderSpec | null;
  apiKey: string;
  model: string;
  kbDir: string;
  driveRemote: string;
  drivePath: string;
}

/** Load .env, resolve the active provider, and assemble the runtime config. */
export const loadConfig = (): Config => {
  loadDotEnv();
  const provider = resolveProviderFromEnv(process.env);
  return {
    provider,
    apiKey: provider ? readEnv(provider.keyEnv) ?? "" : "",
    // ENGRAM_MODEL overrides; otherwise fall back to the provider's default.
    model: readEnv(ENV.model) ?? provider?.defaultModel ?? "",
    kbDir: path.resolve(readEnv(ENV.kbDir) ?? "./kb"),
    driveRemote: readEnv(ENV.driveRemote) ?? "",
    drivePath: readEnv(ENV.drivePath) ?? "engram-kb",
  };
};
