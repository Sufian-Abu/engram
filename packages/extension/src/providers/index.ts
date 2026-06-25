import type { Conversation, ProviderId } from "../types.js";
import type { WebProvider } from "./types.js";
import { claudeProvider } from "./claude.js";
import { chatgptProvider } from "./chatgpt.js";
import { geminiProvider } from "./gemini.js";

/**
 * Registered web providers. Claude and ChatGPT expose clean JSON conversation
 * endpoints we intercept. Gemini transports its data over obfuscated
 * `batchexecute` RPC, so it's captured from the DOM instead (see
 * gemini-capture.ts) — its parser just validates the already-normalized payload.
 */
export const PROVIDERS: WebProvider[] = [claudeProvider, chatgptProvider, geminiProvider];

const byId = new Map(PROVIDERS.map((p) => [p.id, p]));

/** The id of the first provider that recognizes this URL, if any. */
export function matchProvider(url: string): ProviderId | null {
  return PROVIDERS.find((p) => p.matchUrl(url))?.id ?? null;
}

/** If this URL is a "send message" request, the provider + conversation URL to
 *  re-fetch once the reply finishes (for live capture of new chats). */
export function matchSend(url: string): { provider: ProviderId; conversationUrl: string } | null {
  for (const p of PROVIDERS) {
    if (p.matchSendUrl?.(url)) {
      const conversationUrl = p.conversationUrlFromSend?.(url);
      if (conversationUrl) return { provider: p.id, conversationUrl };
    }
  }
  return null;
}

/** Parse a captured payload with the named provider's parser. */
export function parseFor(provider: ProviderId, payload: unknown): Conversation | null {
  return byId.get(provider)?.parse(payload) ?? null;
}

export type { WebProvider };
