import fs from "node:fs";
import path from "node:path";

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
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

export interface Config {
  apiKey: string;
  model: string;
  kbDir: string;
  driveRemote: string;
  drivePath: string;
}

export function loadConfig(): Config {
  loadEnv();
  return {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.ENGRAM_MODEL ?? "claude-sonnet-4-6",
    kbDir: path.resolve(process.env.ENGRAM_KB_DIR ?? "./kb"),
    driveRemote: process.env.ENGRAM_DRIVE_REMOTE ?? "",
    drivePath: process.env.ENGRAM_DRIVE_PATH ?? "engram-kb",
  };
}
