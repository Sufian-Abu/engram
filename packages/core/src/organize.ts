import fs from "node:fs";
import path from "node:path";
import type { KBEntry } from "./types.js";
import { shortHash, slug } from "./util.js";

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

/**
 * Find an existing note for this conversation, regardless of its title/project
 * (the filename's `-<hash>.md` suffix is derived from the stable source id).
 * Returns the path, or null if none. This is what prevents duplicate notes when
 * a re-summary picks a slightly different title.
 */
export const findEntryByConversationId = (kbDir: string, sourceConversationId: string): string | null => {
  const suffix = `-${shortHash(sourceConversationId)}.md`;
  const stack = [kbDir];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.name.endsWith(suffix)) return full;
    }
  }
  return null;
};

/** Read the `source_hash` from a rendered note's front-matter, if present. */
export const readSourceHash = (file: string): string | null => {
  try {
    const m = fs.readFileSync(file, "utf8").match(/^source_hash:\s*(.+)$/m);
    return m ? m[1]!.trim() : null;
  } catch {
    return null;
  }
};
