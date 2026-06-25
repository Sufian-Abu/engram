import { parseClaudeWeb } from "./claude-web.js";
import { upsertById } from "./merge.js";
import { ENGRAM_SOURCE, type CapturedMessage, type Conversation } from "./types.js";

const STORAGE_KEY = "conversations";

chrome.runtime.onMessage.addListener((message: Partial<CapturedMessage>) => {
  if (message?.source !== ENGRAM_SOURCE || message.kind !== "conversation") return;
  const conversation = parseClaudeWeb(message.payload);
  if (conversation) void storeConversation(conversation);
});

/** Upsert a conversation by id (latest capture wins) and refresh the badge. */
async function storeConversation(conversation: Conversation): Promise<void> {
  const existing = await getStored();
  const next = upsertById(existing, conversation);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  await updateBadge(next.length);
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
