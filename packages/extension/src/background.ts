import { parseFor } from "./providers/index.js";
import { upsertById } from "./merge.js";
import { sendToDaemon } from "./daemon.js";
import { syncConversation } from "./self-sync.js";
import { ENGRAM_SOURCE, type CapturedMessage, type Conversation } from "./types.js";

const STORAGE_KEY = "conversations";
const MODE_KEY = "mode";

chrome.runtime.onMessage.addListener((message: Partial<CapturedMessage>) => {
  if (message?.source !== ENGRAM_SOURCE || message.kind !== "conversation" || !message.provider) return;
  const conversation = parseFor(message.provider, message.payload);
  if (conversation) void handleCapture(conversation);
});

/**
 * Store the capture (popup + offline safety), then route it:
 *   1. self-contained — summarize in the browser + push to GitHub (if a key is
 *      set in Options). This is the no-daemon path.
 *   2. local daemon — if no key but `engram serve` is running.
 *   3. stored only — exportable from the popup.
 */
async function handleCapture(conversation: Conversation): Promise<void> {
  const existing = await getStored();
  const next = upsertById(existing, conversation);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  await updateBadge(next.length);

  const outcome = await syncConversation(conversation);
  console.log(`[engram] capture ${conversation.provider} ${conversation.id} -> ${outcome}`);
  if (outcome !== "no-key") {
    await setMode(outcome === "push-failed" ? "summarized" : outcome === "summarize-failed" ? "error" : "synced");
    return;
  }

  // No provider key configured — fall back to the local daemon, else just store.
  const daemon = await sendToDaemon(conversation);
  console.log(`[engram] no extension key; daemon ${daemon.ok ? "accepted" : "unreachable"}`);
  await setMode(daemon.ok ? "daemon" : "stored");
}

async function getStored(): Promise<Conversation[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const list = result[STORAGE_KEY];
  return Array.isArray(list) ? (list as Conversation[]) : [];
}

async function setMode(mode: string): Promise<void> {
  await chrome.storage.local.set({ [MODE_KEY]: mode });
}

async function updateBadge(count: number): Promise<void> {
  await chrome.action.setBadgeText({ text: count ? String(count) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#6b4cff" });
}
