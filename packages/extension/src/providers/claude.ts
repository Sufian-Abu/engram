import { isObject, asString, blocksToText } from "@engram/core/browser";
import type { Conversation, Message, Role } from "../types.js";
import type { WebProvider } from "./types.js";

/**
 * claude.ai. Conversations load from `chat_conversations/<uuid>`:
 *   { uuid, name, created_at, updated_at, chat_messages: [
 *       { uuid, sender: "human"|"assistant", text,
 *         content: [{ type: "text", text }], created_at } ] }
 */
export function parseClaudeWeb(raw: unknown): Conversation | null {
  if (!isObject(raw)) return null;
  const id = asString(raw.uuid);
  const rawMessages = raw.chat_messages;
  if (!id || !Array.isArray(rawMessages)) return null;

  const messages = rawMessages.map(toMessage).filter((m): m is Message => m !== null);
  if (messages.length === 0) return null;

  return {
    id,
    provider: "claude",
    title: asString(raw.name) || undefined,
    createdAt: asString(raw.created_at) || undefined,
    updatedAt: asString(raw.updated_at) || undefined,
    messages,
  };
}

/** A single-conversation fetch (has a trailing uuid); the list endpoint doesn't. */
export function matchClaudeUrl(url: string): boolean {
  return /\/chat_conversations\/[0-9a-f-]{36}/i.test(url) && !/\/completion\b/i.test(url);
}

/** The streaming "send message" endpoint: .../chat_conversations/<uuid>/completion */
export function matchClaudeSendUrl(url: string): boolean {
  return /\/chat_conversations\/[0-9a-f-]{36}\/completion/i.test(url);
}

/** Derive the conversation GET URL from a send URL, to re-pull after the reply. */
export function claudeConversationUrlFromSend(url: string): string | null {
  const m = url.match(/^(.*\/chat_conversations\/[0-9a-f-]{36})\/completion/i);
  return m ? `${m[1]}?tree=True&rendering_mode=messages&render_all_tools=true` : null;
}

function toMessage(raw: unknown): Message | null {
  if (!isObject(raw)) return null;
  const role: Role = raw.sender === "assistant" ? "assistant" : "user";
  // Claude messages carry a flat `text` and/or structured content blocks.
  const content = (asString(raw.text) || blocksToText(raw.content)).trim();
  if (!content) return null;
  return { role, content, timestamp: asString(raw.created_at) || undefined };
}

export const claudeProvider: WebProvider = {
  id: "claude",
  matchUrl: matchClaudeUrl,
  parse: parseClaudeWeb,
  matchSendUrl: matchClaudeSendUrl,
  conversationUrlFromSend: claudeConversationUrlFromSend,
};
