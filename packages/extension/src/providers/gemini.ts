import type { Conversation } from "../types.js";
import type { WebProvider } from "./types.js";

/**
 * Gemini (gemini.google.com) is captured by reading the DOM, not the network:
 * its conversation data rides obfuscated `batchexecute` RPC rather than a clean
 * JSON endpoint. The Gemini content script builds a normalized Conversation and
 * sends it through as the payload, so `parse` here just validates it.
 */
export function parseGeminiWeb(payload: unknown): Conversation | null {
  if (typeof payload !== "object" || payload === null) return null;
  const c = payload as Partial<Conversation>;
  if (!c.id || !Array.isArray(c.messages) || c.messages.length === 0) return null;
  return {
    id: c.id,
    provider: "gemini",
    title: typeof c.title === "string" ? c.title : undefined,
    messages: c.messages,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export const geminiProvider: WebProvider = {
  id: "gemini",
  matchUrl: () => false, // captured via the DOM, not a network fetch
  parse: parseGeminiWeb,
};
