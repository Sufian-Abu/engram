import fs from "node:fs";
import path from "node:path";
import { resolveProviderFromEnv, type ProviderSpec } from "@engram/core";

/**
 * Minimal .env loader (no dependency). Loads KEY=VALUE pairs from a .env file
 * in the current working directory into process.env, without overwriting
 * values already set in the real environment.
 */
export function loadEnv(cwd: string = process.cwd()): void {
  const file = path.join(cwd, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    } else {
      // Strip an unquoted inline comment: a '#' at the start or after whitespace.
      const c = val.match(/(^|\s)#/);
      if (c) val = val.slice(0, c.index).trim();
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

export interface Config {
  /** The resolved provider (anthropic / openai / groq / gemini / openrouter). */
  provider: ProviderSpec | null;
  apiKey: string;
  model: string;
  kbDir: string;
  driveRemote: string;
  drivePath: string;
}

export function loadConfig(): Config {
  loadEnv();
  const provider = resolveProviderFromEnv(process.env);
  return {
    provider,
    apiKey: provider ? env(provider.keyEnv) ?? "" : "",
    // ENGRAM_MODEL overrides; otherwise fall back to the provider's default.
    model: env("ENGRAM_MODEL") ?? provider?.defaultModel ?? "",
    kbDir: path.resolve(env("ENGRAM_KB_DIR") ?? "./kb"),
    driveRemote: env("ENGRAM_DRIVE_REMOTE") ?? "",
    drivePath: env("ENGRAM_DRIVE_PATH") ?? "engram-kb",
  };
}

/** Read an env var, treating empty/whitespace-only values as unset (undefined). */
function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}
