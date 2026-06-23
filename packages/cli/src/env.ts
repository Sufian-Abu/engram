import fs from "node:fs";
import path from "node:path";

/**
 * Every environment variable Engram reads, named in one place so the rest of
 * the CLI never hard-codes a magic string. Provider *key* vars (GROQ_API_KEY,
 * etc.) live with their provider in @engram/core; these are Engram's own knobs.
 */
export const ENV = {
  provider: "ENGRAM_PROVIDER",
  model: "ENGRAM_MODEL",
  kbDir: "ENGRAM_KB_DIR",
  driveRemote: "ENGRAM_DRIVE_REMOTE",
  drivePath: "ENGRAM_DRIVE_PATH",
} as const;

/**
 * Read an env var, treating empty/whitespace-only values as unset (undefined).
 * This is what lets `KEY=` in a .env fall through to a default.
 */
export const readEnv = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

/**
 * Load KEY=VALUE pairs from a .env file into process.env without overwriting
 * values already set in the real environment. No dependency, and it strips
 * inline comments so `KEY=value # note` doesn't capture the note as the value.
 */
export const loadDotEnv = (cwd: string = process.cwd()): void => {
  const file = path.join(cwd, ".env");
  if (!fs.existsSync(file)) return;

  for (const rawLine of fs.readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    const value = parseValue(line.slice(eq + 1).trim());
    if (!(key in process.env)) process.env[key] = value;
  }
};

/** Unquote a quoted value, or strip an unquoted inline comment. */
const parseValue = (raw: string): string => {
  const isQuoted =
    (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"));
  if (isQuoted) return raw.slice(1, -1);

  // An unquoted '#' at the start or after whitespace begins an inline comment.
  const comment = raw.match(/(^|\s)#/);
  return comment ? raw.slice(0, comment.index).trim() : raw;
};
