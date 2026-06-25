import fs from "node:fs";
import path from "node:path";
import {
  summarizeConversation,
  entryPath,
  renderEntry,
  type Conversation,
} from "@engram/core";
import type { Config } from "./config.js";

export type WriteOutcome = "written" | "skipped" | "failed";

/**
 * Summarize one conversation and write its KB note, unless an identical entry
 * already exists (idempotent dedupe). Shared by `engram ingest` and the
 * `engram serve` daemon. The optional log/err sinks let each caller format
 * its own output.
 */
export async function writeKbEntry(
  conv: Conversation,
  cfg: Config,
  log: (line: string) => void = () => {},
  err: (line: string) => void = () => {},
): Promise<WriteOutcome> {
  const label = conv.title ?? conv.id;
  try {
    const entry = await summarizeConversation(conv, {
      apiKey: cfg.apiKey,
      provider: cfg.provider!.id,
      model: cfg.model,
    });
    const outPath = entryPath(entry, cfg.kbDir);
    if (fs.existsSync(outPath)) {
      log(`= exists, skipped: ${label}`);
      return "skipped";
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, renderEntry(entry));
    log(`+ ${path.relative(cfg.kbDir, outPath)}`);
    return "written";
  } catch (e: any) {
    err(`failed "${label}": ${e.message}`);
    return "failed";
  }
}
