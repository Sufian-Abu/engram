import type { Conversation } from "./types.js";

/**
 * The local `engram serve` daemon. When it's running, captures are POSTed to it
 * and auto-ingested + synced — no manual export. When it's not, the POST simply
 * fails and we fall back to chrome.storage (the popup's Export JSON still works),
 * so nothing is ever lost.
 */
const DAEMON_URL = "http://localhost:8765/capture";

export interface DaemonResult {
  ok: boolean;
  changed?: number;
  skipped?: number;
}

export async function sendToDaemon(conversation: Conversation): Promise<DaemonResult> {
  try {
    const res = await fetch(DAEMON_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(conversation),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { changed?: number; skipped?: number };
    return { ok: true, changed: data.changed, skipped: data.skipped };
  } catch {
    // Daemon not running — caller keeps the capture in chrome.storage.
    return { ok: false };
  }
}
