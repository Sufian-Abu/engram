import { parseFor } from "./providers/index.js";
import { upsertById } from "./merge.js";
import { sendToDaemon } from "./daemon.js";
import { ENGRAM_SOURCE, type CapturedMessage, type Conversation } from "./types.js";

const STORAGE_KEY = "conversations";

chrome.runtime.onMessage.addListener((message: Partial<CapturedMessage>) => {
  if (message?.source !== ENGRAM_SOURCE || message.kind !== "conversation" || !message.provider) return;
  const conversation = parseFor(message.provider, message.payload);
  if (conversation) void storeConversation(conversation);
});

/**
 * Always store in chrome.storage (popup visibility + offline fallback), and
 * forward to the local daemon for automatic ingest + sync. If the daemon isn't
 * running the capture is still safe in storage.
 */
async function storeConversation(conversation: Conversation): Promise<void> {
  const existing = await getStored();
  const next = upsertById(existing, conversation);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  await updateBadge(next.length);

  const result = await sendToDaemon(conversation);
  await chrome.storage.local.set({ daemonConnected: result.ok });
}

async function getStored(): Promise<Conversation[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const list = result[STORAGE_KEY];
  return Array.isArray(list) ? (list as Conversation[]) : [];
}

async function updateBadge(count: number): Promise<void> {
  await chrome.action.setBadgeText({ text: count ? String(count) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#6b4cff" });
}
