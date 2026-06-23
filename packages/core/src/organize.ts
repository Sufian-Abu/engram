import path from "node:path";
import type { KBEntry } from "./types.js";

/**
 * Compute the on-disk location for a KB entry:
 *   <kbDir>/<YYYY>/<MM>/<project>/<slug-title>.md
 *
 * Date-wise + project-wise + topic-wise organization, all at once: the path
 * gives you date and project; topics live in front-matter for search.
 */
export const entryPath = (entry: KBEntry, kbDir: string): string => {
  const [year, month] = entry.date.split("-");
  // Short stable hash of the FULL source id — a prefix slice collides when
  // ids share a provider prefix (e.g. every "claude-code-..." id).
  const file = `${slug(entry.title)}-${shortHash(entry.sourceConversationId)}.md`;
  // `||` (not `??`) so an empty segment from a malformed date also falls back.
  return path.join(kbDir, year || "unknown", month || "00", entry.project, file);
};

/** 8-hex-char FNV-1a hash, stable across runs for idempotent filenames. */
const shortHash = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
};

export const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
