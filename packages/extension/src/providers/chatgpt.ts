import { isObject, asString, normalizeRole, blocksToText } from "@engram/core/browser";
import type { Conversation, Message } from "../types.js";
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

  const id = asString(raw.conversation_id) || asString(raw.id);
  if (!id) return null;

  const messages = linearize(mapping)
    .map(toMessage)
    .filter((m): m is Message => m !== null);
  if (messages.length === 0) return null;

  return {
    id,
    provider: "chatgpt",
    title: asString(raw.title) || undefined,
    createdAt: epochToIso(raw.create_time),
    updatedAt: epochToIso(raw.update_time),
    messages,
  };
}

export function matchChatGptUrl(url: string): boolean {
  // Single-conversation detail GET; the streaming POST has no trailing uuid.
  return /\/backend-api\/conversation\/[0-9a-f-]{36}(?:[/?]|$)/i.test(url);
}

/**
 * Walk root -> latest child, collecting each node's message in order. Note: the
 * file-export parser in @engram/core (parsers/chatgpt.ts) walks current_node ->
 * parent instead; the two can differ on a branched/regenerated chat. If you
 * change linearization here, reconcile it there too.
 */
function linearize(mapping: Record<string, unknown>): Record<string, unknown>[] {
  const nodes = mapping as Record<string, { message?: unknown; parent?: unknown; children?: unknown }>;
  const root = Object.values(nodes).find((n) => !n.parent || !(asString(n.parent) in nodes));

  const out: Record<string, unknown>[] = [];
  let current = root;
  const seen = new Set<unknown>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (isObject(current.message)) out.push(current.message);
    const children = Array.isArray(current.children) ? current.children : [];
    const lastChildId = children[children.length - 1];
    current = lastChildId !== undefined ? nodes[asString(lastChildId)] : undefined;
  }
  return out;
}

function toMessage(message: Record<string, unknown>): Message | null {
  const author = isObject(message.author) ? message.author : {};
  const role = normalizeRole(author.role);
  if (role === "system") return null; // root system primer is noise
  // ChatGPT content is `{ parts: [...] }` — parts are strings (or text blocks).
  const content = (isObject(message.content) ? blocksToText(message.content.parts) : "").trim();
  if (!content) return null;
  return { role, content, timestamp: epochToIso(message.create_time) };
}

function epochToIso(value: unknown): string | undefined {
  return typeof value === "number" && value > 0 ? new Date(value * 1000).toISOString() : undefined;
}

export const chatgptProvider: WebProvider = {
  id: "chatgpt",
  matchUrl: matchChatGptUrl,
  parse: parseChatGptWeb,
};
