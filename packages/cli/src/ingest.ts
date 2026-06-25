import fs from "node:fs";
import path from "node:path";
import { parseAny, type Conversation } from "@engram/core";
import { loadConfig } from "./config.js";
import { writeKbEntry } from "./writer.js";

/**
 * `engram ingest <path>`
 * Reads one JSON/JSONL file or a directory of them (provider exports or
 * Engram-normalized), summarizes each conversation, and writes KB Markdown.
 * Skips conversations whose output file already exists (idempotent dedupe).
 */
export const ingestCommand = async (args: string[]): Promise<void> => {
  const target = args[0];
  if (!target) throw new Error("usage: engram ingest <file-or-dir>");

  const cfg = loadConfig();
  if (!cfg.provider || !cfg.apiKey) throw new Error(MISSING_KEY_MESSAGE);
  process.stdout.write(`Using ${cfg.provider.label} — model ${cfg.model}\n`);

  const files = collectJsonFiles(path.resolve(target));
  if (files.length === 0) throw new Error(`no .json/.jsonl files found at ${target}`);

  const conversations = files.flatMap(readConversations);
  process.stdout.write(`Parsed ${conversations.length} conversation(s) from ${files.length} file(s).\n`);

  let written = 0;
  let skipped = 0;
  for (const conv of conversations) {
    const outcome = await writeKbEntry(
      conv,
      cfg,
      (l) => process.stdout.write(`  ${l}\n`),
      (l) => process.stderr.write(`  ! ${l}\n`),
    );
    if (outcome === "written") written++;
    else if (outcome === "skipped") skipped++;
  }

  process.stdout.write(`\nDone. ${written} written, ${skipped} skipped. KB at ${cfg.kbDir}\n`);
};

/** Parse one file into conversations, logging and swallowing parse errors. */
const readConversations = (file: string): Conversation[] => {
  try {
    const text = fs.readFileSync(file, "utf8");
    return parseAny(file.endsWith(".jsonl") ? parseJsonl(text) : JSON.parse(text));
  } catch (e: any) {
    process.stderr.write(`  ! skipped ${path.basename(file)}: ${e.message}\n`);
    return [];
  }
};

/** A .jsonl file (e.g. Claude Code transcripts) is one JSON object per line. */
const parseJsonl = (text: string): unknown[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

const collectJsonFiles = (target: string): string[] => {
  const stat = fs.statSync(target);
  if (stat.isFile()) return isIngestable(target) ? [target] : [];
  return fs.readdirSync(target).flatMap((name) => {
    const full = path.join(target, name);
    return fs.statSync(full).isDirectory() ? collectJsonFiles(full) : isIngestable(full) ? [full] : [];
  });
};

const isIngestable = (file: string): boolean => file.endsWith(".json") || file.endsWith(".jsonl");

const MISSING_KEY_MESSAGE =
  "No provider API key found. Copy .env.example to .env and set one of:\n" +
  "  GROQ_API_KEY (free)  GEMINI_API_KEY (free)  OPENROUTER_API_KEY (free)\n" +
  "  ANTHROPIC_API_KEY    OPENAI_API_KEY\n" +
  "Optionally set ENGRAM_PROVIDER to force which one is used.";
