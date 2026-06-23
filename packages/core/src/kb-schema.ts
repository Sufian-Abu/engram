/**
 * The structured-output contract for the summarize step, in one place.
 *
 * Both API flavors force the model to emit JSON matching this JSON Schema
 * (Anthropic tool-use uses `input_schema`, OpenAI function-calling uses
 * `parameters`), so the caller never parses free-form text. Keeping the schema
 * standalone makes it reusable and trivial to unit-test.
 */

/** The raw, unvalidated object the model returns for a KB entry. */
export interface KbEntryDraft {
  title?: string;
  project?: string;
  topics?: string[];
  summary?: string;
  keyFacts?: string[];
  decisions?: string[];
  openQuestions?: string[];
  resumePrompt?: string;
}

export const KB_TOOL_NAME = "save_kb_entry";

export const KB_TOOL_DESCRIPTION = "Save the distilled knowledge from the conversation.";

export const KB_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Concise, specific title for this entry." },
    project: {
      type: "string",
      description: "Single project/initiative bucket this belongs to (e.g. 'engram', 'tax-2025'). Lowercase, short.",
    },
    topics: {
      type: "array",
      items: { type: "string" },
      description: "3-8 topic tags for cross-cutting search.",
    },
    summary: { type: "string", description: "2-4 sentence overview of what the conversation accomplished." },
    keyFacts: {
      type: "array",
      items: { type: "string" },
      description: "Durable facts, data, or knowledge worth keeping.",
    },
    decisions: {
      type: "array",
      items: { type: "string" },
      description: "Decisions made, each with brief rationale.",
    },
    openQuestions: {
      type: "array",
      items: { type: "string" },
      description: "Unresolved threads or next steps to pick up later.",
    },
    resumePrompt: {
      type: "string",
      description:
        "A paste-ready prompt that re-seeds any model with full context to continue this work: project, decisions, current state, and next actions.",
    },
  },
  required: ["title", "project", "topics", "summary", "resumePrompt"],
} as const;
