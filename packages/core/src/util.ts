import type { Conversation, Role } from "./types.js";

/**
 * Pure, dependency-free helpers (no node:fs / node:path) so they can run in the
 * browser extension as well as the CLI. Parsers across every surface (core,
 * extension providers, proxy) share these instead of re-implementing them.
 */

const ROLES: Role[] = ["user", "assistant", "system", "tool"];

/** Narrow an unknown to a plain object. */
export const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null;

/** A string value, or "" for anything else. */
export const asString = (x: unknown): string => (typeof x === "string" ? x : "");

/** Coerce an arbitrary role string to a known Role, defaulting to "user". */
export const normalizeRole = (value: unknown): Role =>
  ROLES.includes(value as Role) ? (value as Role) : "user";

/**
 * Flatten message content to text. Handles the two shapes providers use: a
 * plain string, or an array of blocks (`{ type, text }` objects or bare
 * strings, e.g. Claude content blocks / ChatGPT `parts`).
 */
export const blocksToText = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => (typeof block === "string" ? block : isObject(block) ? asString(block.text) : ""))
    .filter(Boolean)
    .join("\n\n");
};

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

/** URL/filename-safe slug; `fallback` is used when the input slugs to empty. */
export const slug = (s: string, fallback = "untitled"): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || fallback;
