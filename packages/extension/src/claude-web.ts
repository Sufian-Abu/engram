import type { Conversation, Message, Role } from "./types.js";

/**
 * Parse a claude.ai `chat_conversations/<uuid>` API response into Engram's
 * normalized Conversation. The response looks like:
 *   { uuid, name, created_at, updated_at, chat_messages: [
 *       { uuid, sender: "human"|"assistant", text, created_at,
 *         content: [{ type: "text", text }] }, ... ] }
 * Everything is read defensively — the schema is the provider's, not ours.
 */
export function parseClaudeWeb(raw: unknown): Conversation | null {
  if (!isObject(raw)) return null;
  const id = str(raw.uuid);
  const rawMessages = raw.chat_messages;
  if (!id || !Array.isArray(rawMessages)) return null;

  const messages: Message[] = rawMessages
    .map(toMessage)
    .filter((m): m is Message => m !== null);
  if (messages.length === 0) return null;

  return {
    id,
    provider: "claude",
    title: str(raw.name) || undefined,
    createdAt: str(raw.created_at) || undefined,
    updatedAt: str(raw.updated_at) || undefined,
    messages,
  };
}

/** True if the URL is a single-conversation fetch we want to capture. */
export function isConversationUrl(url: string): boolean {
  // .../chat_conversations/<uuid>  — the list endpoint has no trailing uuid.
  return /\/chat_conversations\/[0-9a-f-]{36}/i.test(url);
}

function toMessage(raw: unknown): Message | null {
  if (!isObject(raw)) return null;
  const role: Role = raw.sender === "assistant" ? "assistant" : "user";
  const content = messageText(raw).trim();
  if (!content) return null;
  return { role, content, timestamp: str(raw.created_at) || undefined };
}

/** Prefer the flat `text`; otherwise join the structured content blocks. */
function messageText(raw: Record<string, unknown>): string {
  const flat = str(raw.text);
  if (flat) return flat;
  if (!Array.isArray(raw.content)) return "";
  return raw.content
    .map((block) => (isObject(block) ? str(block.text) : ""))
    .filter(Boolean)
    .join("\n\n");
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function str(x: unknown): string {
  return typeof x === "string" ? x : "";
}
