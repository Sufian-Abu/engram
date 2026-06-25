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
  /**
   * True if this URL is a "send message" request. After its reply finishes we
   * re-fetch the conversation, so a brand-new chat is captured live without a
   * manual reload.
   */
  matchSendUrl?(url: string): boolean;
  /** Given a send URL, the conversation-fetch URL to re-pull after the reply. */
  conversationUrlFromSend?(url: string): string | null;
}
