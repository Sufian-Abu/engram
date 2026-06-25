import type { KBEntry } from "./types.js";

/**
 * Render a KBEntry to Markdown with YAML front-matter. Front-matter makes the
 * file searchable/queryable (Obsidian, grep, scripts); the body is human- and
 * model-readable. The resume prompt is fenced so it's trivial to copy.
 */
export const renderEntry = (entry: KBEntry): string => {
  const fm = [
    "---",
    `title: ${yaml(entry.title)}`,
    `date: ${entry.date}`,
    `project: ${yaml(entry.project)}`,
    `provider: ${entry.provider}`,
    `topics: [${entry.topics.map(yaml).join(", ")}]`,
    `source_id: ${yaml(entry.sourceConversationId)}`,
    ...(entry.sourceHash ? [`source_hash: ${entry.sourceHash}`] : []),
    "---",
  ].join("\n");

  const sections: string[] = [`# ${entry.title}`, "", entry.summary, ""];

  if (entry.keyFacts.length) {
    sections.push("## Key facts", "", ...entry.keyFacts.map((f) => `- ${f}`), "");
  }
  if (entry.decisions.length) {
    sections.push("## Decisions", "", ...entry.decisions.map((d) => `- ${d}`), "");
  }
  if (entry.openQuestions.length) {
    sections.push("## Open questions / next steps", "", ...entry.openQuestions.map((q) => `- ${q}`), "");
  }

  sections.push(
    "## Resume prompt",
    "",
    "_Paste this into any model to pick up where you left off:_",
    "",
    "```text",
    entry.resumePrompt,
    "```",
    "",
  );

  return `${fm}\n\n${sections.join("\n")}`;
};

/** Minimal YAML scalar quoting — wrap in quotes if it could be misparsed. */
const yaml = (s: string): string =>
  /^[A-Za-z0-9 _.-]+$/.test(s) ? s : `"${s.replace(/"/g, '\\"')}"`;
