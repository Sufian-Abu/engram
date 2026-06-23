import fs from "node:fs";
import path from "node:path";
import {
  parseAny,
  summarizeConversation,
  entryPath,
  renderEntry,
  type Conversation,
} from "@engram/core";
import { loadConfig } from "./config.js";

/**
 * `engram ingest <path>`
 * Reads one JSON file or a directory of JSON files (provider exports or
 * Engram-normalized), summarizes each conversation, and writes KB Markdown.
 * Skips conversations whose output file already exists (idempotent dedupe).
 */
export async function ingestCommand(args: string[]): Promise<void> {
  const target = args[0];
  if (!target) throw new Error("usage: engram ingest <file-or-dir>");

  const cfg = loadConfig();
  if (!cfg.provider || !cfg.apiKey) {
    throw new Error(
      "No provider API key found. Copy .env.example to .env and set one of:\n" +
        "  GROQ_API_KEY (free)  GEMINI_API_KEY (free)  OPENROUTER_API_KEY (free)\n" +
        "  ANTHROPIC_API_KEY    OPENAI_API_KEY\n" +
        "Optionally set ENGRAM_PROVIDER to force which one is used.",
    );
  }
  process.stdout.write(`Using ${cfg.provider.label} — model ${cfg.model}\n`);

  const files = collectJsonFiles(path.resolve(target));
  if (files.length === 0) throw new Error(`no .json files found at ${target}`);

  const conversations: Conversation[] = [];
  for (const f of files) {
    try {
      const text = fs.readFileSync(f, "utf8");
      // .jsonl (e.g. Claude Code transcripts) = one JSON object per line.
      const raw = f.endsWith(".jsonl")
        ? text
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => JSON.parse(l))
        : JSON.parse(text);
      conversations.push(...parseAny(raw));
    } catch (e: any) {
      process.stderr.write(`  ! skipped ${path.basename(f)}: ${e.message}\n`);
    }
  }

  process.stdout.write(`Parsed ${conversations.length} conversation(s) from ${files.length} file(s).\n`);

  let written = 0;
  let skipped = 0;
  for (const conv of conversations) {
    const label = conv.title ?? conv.id;
    try {
      const entry = await summarizeConversation(conv, {
        apiKey: cfg.apiKey,
        provider: cfg.provider.id,
        model: cfg.model,
      });
      const outPath = entryPath(entry, cfg.kbDir);
      if (fs.existsSync(outPath)) {
        skipped++;
        process.stdout.write(`  = exists, skipped: ${label}\n`);
        continue;
      }
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, renderEntry(entry));
      written++;
      process.stdout.write(`  + ${path.relative(cfg.kbDir, outPath)}\n`);
    } catch (e: any) {
      process.stderr.write(`  ! failed "${label}": ${e.message}\n`);
    }
  }

  process.stdout.write(`\nDone. ${written} written, ${skipped} skipped. KB at ${cfg.kbDir}\n`);
}

function collectJsonFiles(target: string): string[] {
  const stat = fs.statSync(target);
  if (stat.isFile()) return target.endsWith(".json") ? [target] : [];
  const out: string[] = [];
  for (const name of fs.readdirSync(target)) {
    const full = path.join(target, name);
    const s = fs.statSync(full);
    if (s.isDirectory()) out.push(...collectJsonFiles(full));
    else if (name.endsWith(".json")) out.push(full);
  }
  return out;
}
