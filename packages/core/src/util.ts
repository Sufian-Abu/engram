import type { Conversation } from "./types.js";

/**
 * Pure, dependency-free helpers (no node:fs / node:path) so they can run in the
 * browser extension as well as the CLI.
 */

/** 8-hex-char FNV-1a hash, stable across runs. */
export const shortHash = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
};

/**
 * Content fingerprint of a conversation. Two captures of the same chat hash
 * equal only if the messages are unchanged — so a re-capture can tell an actual
 * update from a no-op.
 */
export const conversationHash = (conv: Conversation): string =>
  shortHash(conv.messages.map((m) => `${m.role}:${m.content}`).join("\n"));

/** URL/filename-safe slug. */
export const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
