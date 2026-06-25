import type { Conversation } from "./types.js";

/**
 * Upsert a conversation by id (latest capture wins). Pure and chrome-free so it
 * can be unit-tested; the service worker uses it to dedupe stored captures.
 */
export function upsertById(list: Conversation[], conv: Conversation): Conversation[] {
  const index = list.findIndex((c) => c.id === conv.id);
  if (index === -1) return [...list, conv];
  const copy = list.slice();
  copy[index] = conv;
  return copy;
}
