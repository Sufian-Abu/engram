/**
 * Engram's normalized conversation shape — kept local so the extension bundles
 * without pulling in @engram/core's Node code. This MUST stay in sync with
 * `Conversation`/`Message` in @engram/core/src/types.ts; it is exactly what
 * `engram ingest` consumes via the normalized parser.
 */
export type Role = "user" | "assistant" | "system" | "tool";

export type ProviderId = "claude" | "chatgpt" | "gemini";

export interface Message {
  role: Role;
  content: string;
  timestamp?: string;
}

export interface Conversation {
  id: string;
  provider: ProviderId;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  messages: Message[];
}

/** Message posted from the page interceptor to the content script. */
export interface CapturedMessage {
  source: "engram";
  kind: "conversation";
  /** The provider whose API the payload came from. */
  provider: ProviderId;
  /** The raw, unparsed provider response (parsed in the service worker). */
  payload: unknown;
}

export const ENGRAM_SOURCE = "engram" as const;
