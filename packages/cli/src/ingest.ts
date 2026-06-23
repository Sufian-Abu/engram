import fs from "node:fs";
import path from "node:path";
import {
  parseAny,
  summarizeConversation,
  entryPath,
  renderEntry,
  type Conversation,
} from "@engram/core";
import { loadConfig, type Config } from "./config.js";

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
    const outcome = await writeEntry(conv, cfg);
    if (outcome === "written") written++;
    else if (outcome === "skipped") skipped++;
  }

  process.stdout.write(`\nDone. ${written} written, ${skipped} skipped. KB at ${cfg.kbDir}\n`);
};

type WriteOutcome = "written" | "skipped" | "failed";

/** Summarize one conversation and write its KB file, unless it already exists. */
const writeEntry = async (conv: Conversation, cfg: Config): Promise<WriteOutcome> => {
  const label = conv.title ?? conv.id;
  try {
    const entry = await summarizeConversation(conv, {
      apiKey: cfg.apiKey,
      provider: cfg.provider!.id,
      model: cfg.model,
    });
    const outPath = entryPath(entry, cfg.kbDir);
    if (fs.existsSync(outPath)) {
      process.stdout.write(`  = exists, skipped: ${label}\n`);
      return "skipped";
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, renderEntry(entry));
    process.stdout.write(`  + ${path.relative(cfg.kbDir, outPath)}\n`);
    return "written";
  } catch (e: any) {
    process.stderr.write(`  ! failed "${label}": ${e.message}\n`);
    return "failed";
  }
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
