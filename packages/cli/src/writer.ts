import fs from "node:fs";
import path from "node:path";
import {
  summarizeConversation,
  entryPath,
  renderEntry,
  conversationHash,
  findEntryByConversationId,
  readSourceHash,
  type Conversation,
} from "@engram/core";
import type { Config } from "./config.js";

export type WriteOutcome = "written" | "updated" | "skipped" | "failed";

/**
 * Summarize one conversation and write its KB note. Deduped by the stable
 * conversation id, so a given chat maps to exactly one note:
 *   - unchanged since last capture  -> skip (nothing to re-summarize or push)
 *   - changed (e.g. new messages)   -> re-summarize and update in place; if the
 *                                       new title/project moves the file, the
 *                                       old one is removed (never a duplicate)
 *   - new conversation              -> write
 * Shared by `engram ingest` and the `engram serve` daemon.
 */
export async function writeKbEntry(
  conv: Conversation,
  cfg: Config,
  log: (line: string) => void = () => {},
  err: (line: string) => void = () => {},
): Promise<WriteOutcome> {
  const label = conv.title ?? conv.id;
  try {
    const hash = conversationHash(conv);
    const existing = findEntryByConversationId(cfg.kbDir, conv.id);

    if (existing && readSourceHash(existing) === hash) {
      log(`= unchanged: ${label}`);
      return "skipped";
    }

    const entry = await summarizeConversation(conv, {
      apiKey: cfg.apiKey,
      provider: cfg.provider!.id,
      model: cfg.model,
    });
    entry.sourceHash = hash;

    // Keep the existing note's path on update (stable filename, clean one-file
    // git diff); only a brand-new conversation gets a fresh path.
    const outPath = existing ?? entryPath(entry, cfg.kbDir);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, renderEntry(entry));

    const updated = existing !== null;
    log(`${updated ? "~ updated" : "+"} ${path.relative(cfg.kbDir, outPath)}`);
    return updated ? "updated" : "written";
  } catch (e: any) {
    err(`failed "${label}": ${e.message}`);
    return "failed";
  }
}
