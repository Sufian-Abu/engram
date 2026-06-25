import type { Conversation, ProviderId } from "../types.js";

/**
 * A web provider knows how to recognize its own conversation-fetch URL and
 * parse that response into Engram's normalized Conversation. Adding a provider
 * is just implementing this and registering it in providers/index.ts.
 */
export interface WebProvider {
  id: ProviderId;
  /** True if this URL is a single-conversation fetch worth capturing. */
  matchUrl(url: string): boolean;
  /** Parse the raw API response, or null if it isn't a usable conversation. */
  parse(payload: unknown): Conversation | null;
}
