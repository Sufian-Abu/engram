import { isObject, asString, normalizeRole } from "@engram/core/browser";
import type { Conversation, Message } from "../types.js";
import type { WebProvider } from "./types.js";

/**
 * Gemini (gemini.google.com) is captured by reading the DOM, not the network:
 * its conversation data rides obfuscated `batchexecute` RPC rather than a clean
 * JSON endpoint. The Gemini content script builds a normalized Conversation and
 * sends it through as the payload, so `parse` here just validates it.
 */
export function parseGeminiWeb(payload: unknown): Conversation | null {
  if (!isObject(payload) || !asString(payload.id) || !Array.isArray(payload.messages)) return null;

  // Validate each turn (the DOM scraper is trusted-ish, but fail safe on junk).
  const messages: Message[] = payload.messages
    .map((m): Message | null => {
      if (!isObject(m)) return null;
      const content = asString(m.content).trim();
      return content ? { role: normalizeRole(m.role), content } : null;
    })
    .filter((m): m is Message => m !== null);
  if (messages.length === 0) return null;

  return {
    id: asString(payload.id),
    provider: "gemini",
    title: asString(payload.title) || undefined,
    messages,
  };
}

export const geminiProvider: WebProvider = {
  id: "gemini",
  matchUrl: () => false, // captured via the DOM, not a network fetch
  parse: parseGeminiWeb,
};
