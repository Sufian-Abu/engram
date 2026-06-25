import type { Conversation, ProviderId } from "../types.js";
import type { WebProvider } from "./types.js";
import { claudeProvider } from "./claude.js";
import { chatgptProvider } from "./chatgpt.js";

/**
 * Registered web providers. Claude and ChatGPT expose clean JSON conversation
 * endpoints we can intercept. Gemini is intentionally absent: gemini.google.com
 * transports conversation data over obfuscated `batchexecute` RPC (nested,
 * index-addressed arrays), which would need fragile reverse-engineering — a
 * separate effort, not the same fetch-and-parse pattern.
 */
export const PROVIDERS: WebProvider[] = [claudeProvider, chatgptProvider];

const byId = new Map(PROVIDERS.map((p) => [p.id, p]));

/** The id of the first provider that recognizes this URL, if any. */
export function matchProvider(url: string): ProviderId | null {
  return PROVIDERS.find((p) => p.matchUrl(url))?.id ?? null;
}

/** Parse a captured payload with the named provider's parser. */
export function parseFor(provider: ProviderId, payload: unknown): Conversation | null {
  return byId.get(provider)?.parse(payload) ?? null;
}

export type { WebProvider };
