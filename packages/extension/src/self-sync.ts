import {
  summarizeConversation,
  renderEntry,
  conversationHash,
  slug,
  shortHash,
  type Conversation,
  type KBEntry,
} from "@engram/core/browser";
import { getSettings, canSummarize, canPush } from "./settings.js";
import { pushFile } from "./github.js";

export type SyncOutcome =
  | "written"
  | "updated"
  | "unchanged"
  | "no-key"
  | "summarize-failed"
  | "push-failed";

interface SyncedRecord {
  hash: string;
  path: string;
}

const SYNCED_KEY = "synced";

/**
 * Self-contained pipeline for one capture: summarize in the browser, render to
 * Markdown, and push to GitHub. Deduped by conversation id + content hash so an
 * unchanged chat does nothing and an updated one rewrites the same repo path.
 */
export async function syncConversation(conv: Conversation): Promise<SyncOutcome> {
  const settings = await getSettings();
  if (!canSummarize(settings)) return "no-key";

  const hash = conversationHash(conv);
  const synced = await getSynced();
  const prev = synced[conv.id];
  if (prev && prev.hash === hash) return "unchanged";

  let entry: KBEntry;
  try {
    entry = await summarizeConversation(conv, {
      apiKey: settings.apiKey,
      provider: settings.provider,
      model: settings.model || undefined,
    });
  } catch {
    return "summarize-failed";
  }
  entry.sourceHash = hash;

  // Keep the first path for a conversation so updates overwrite, never duplicate.
  const repoPath = prev?.path ?? entryRepoPath(entry);
  const markdown = renderEntry(entry);

  // Always keep the rendered note locally so it's exportable even without GitHub.
  await storeNote(repoPath, markdown);

  if (canPush(settings)) {
    const verb = prev ? "update" : "add";
    const result = await pushFile(settings, repoPath, markdown, `engram: ${verb} ${entry.title}`);
    if (!result.ok) return "push-failed";
  }

  synced[conv.id] = { hash, path: repoPath };
  await setSynced(synced);
  return prev ? "updated" : "written";
}

const NOTES_KEY = "notes";

async function storeNote(repoPath: string, markdown: string): Promise<void> {
  const result = await chrome.storage.local.get(NOTES_KEY);
  const notes = (result[NOTES_KEY] as Record<string, string> | undefined) ?? {};
  notes[repoPath] = markdown;
  await chrome.storage.local.set({ [NOTES_KEY]: notes });
}

/** kb/YYYY/MM/<project>/<slug>-<hash>.md — mirrors core's entryPath (no node:path). */
function entryRepoPath(entry: KBEntry): string {
  const [year, month] = entry.date.split("-");
  const file = `${slug(entry.title)}-${shortHash(entry.sourceConversationId)}.md`;
  return ["kb", year || "unknown", month || "00", entry.project, file].join("/");
}

async function getSynced(): Promise<Record<string, SyncedRecord>> {
  const result = await chrome.storage.local.get(SYNCED_KEY);
  return (result[SYNCED_KEY] as Record<string, SyncedRecord> | undefined) ?? {};
}

async function setSynced(map: Record<string, SyncedRecord>): Promise<void> {
  await chrome.storage.local.set({ [SYNCED_KEY]: map });
}
