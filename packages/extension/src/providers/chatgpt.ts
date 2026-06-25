import type { Conversation, Message, Role } from "../types.js";
import type { WebProvider } from "./types.js";

/**
 * chatgpt.com. Conversations load from `backend-api/conversation/<uuid>`:
 *   { title, create_time, update_time, conversation_id,
 *     mapping: { <nodeId>: { message: { author:{role}, content:{parts},
 *       create_time }, parent, children: [<id>] } } }
 * The mapping is a tree; we linearize by following the latest child at each
 * step (what the user actually sees after regenerations).
 */
export function parseChatGptWeb(raw: unknown): Conversation | null {
  if (!isObject(raw)) return null;
  const mapping = raw.mapping;
  if (!isObject(mapping)) return null;

  const id = str(raw.conversation_id) || str(raw.id);
  if (!id) return null;

  const messages = linearize(mapping)
    .map(toMessage)
    .filter((m): m is Message => m !== null);
  if (messages.length === 0) return null;

  return {
    id,
    provider: "chatgpt",
    title: str(raw.title) || undefined,
    createdAt: epochToIso(raw.create_time),
    updatedAt: epochToIso(raw.update_time),
    messages,
  };
}

export function matchChatGptUrl(url: string): boolean {
  // Single-conversation detail GET; the streaming POST has no trailing uuid.
  return /\/backend-api\/conversation\/[0-9a-f-]{36}(?:[/?]|$)/i.test(url);
}

/** Walk root -> latest child, collecting each node's message in order. */
function linearize(mapping: Record<string, unknown>): Record<string, unknown>[] {
  const nodes = mapping as Record<string, { message?: unknown; parent?: unknown; children?: unknown }>;
  const root = Object.values(nodes).find((n) => !n.parent || !(str(n.parent) in nodes));

  const out: Record<string, unknown>[] = [];
  let current = root;
  const seen = new Set<unknown>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (isObject(current.message)) out.push(current.message);
    const children = Array.isArray(current.children) ? current.children : [];
    const lastChildId = children[children.length - 1];
    current = lastChildId !== undefined ? nodes[str(lastChildId)] : undefined;
  }
  return out;
}

function toMessage(message: Record<string, unknown>): Message | null {
  const author = isObject(message.author) ? message.author : {};
  const role = normalizeRole(str(author.role));
  if (role === "system") return null; // root system primer is noise
  const content = partsToText(message.content).trim();
  if (!content) return null;
  return { role, content, timestamp: epochToIso(message.create_time) };
}

function partsToText(content: unknown): string {
  if (!isObject(content) || !Array.isArray(content.parts)) return "";
  return content.parts.filter((p): p is string => typeof p === "string" && p.length > 0).join("\n\n");
}

function normalizeRole(role: string): Role {
  if (role === "assistant" || role === "system" || role === "tool") return role;
  return "user";
}

function epochToIso(value: unknown): string | undefined {
  return typeof value === "number" && value > 0 ? new Date(value * 1000).toISOString() : undefined;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function str(x: unknown): string {
  return typeof x === "string" ? x : "";
}

export const chatgptProvider: WebProvider = {
  id: "chatgpt",
  matchUrl: matchChatGptUrl,
  parse: parseChatGptWeb,
};
