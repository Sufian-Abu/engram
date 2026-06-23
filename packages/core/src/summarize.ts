import type { Conversation, KBEntry } from "./types.js";

export interface SummarizeOptions {
  apiKey: string;
  /** Anthropic model id. Defaults to a cost-effective summarizer. */
  model?: string;
  /** Cap transcript characters sent to the model (cost guard). */
  maxChars?: number;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * Run one conversation through the LLM and extract a structured KBEntry.
 * Uses Anthropic tool-use to force valid JSON matching our schema, so the
 * caller never has to parse free-form text.
 */
export async function summarizeConversation(
  conv: Conversation,
  opts: SummarizeOptions,
): Promise<KBEntry> {
  const transcript = renderTranscript(conv, opts.maxChars ?? 60_000);
  const date = (conv.updatedAt ?? conv.createdAt ?? new Date().toISOString()).slice(0, 10);

  const body = {
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: 2048,
    tools: [KB_TOOL],
    tool_choice: { type: "tool", name: "save_kb_entry" },
    messages: [
      {
        role: "user",
        content: `You are Engram, a knowledge-base builder. Distill the following ${conv.provider} conversation into a durable knowledge entry.

Be faithful to what was actually discussed — do not invent facts. Write the resumePrompt so that pasting it into a fresh chat with ANY model fully re-establishes context: what the project is, what was decided, where things stand, and what to do next.

Conversation title: ${conv.title ?? "(untitled)"}
Date: ${date}

--- TRANSCRIPT ---
${transcript}
--- END TRANSCRIPT ---`,
      },
    ],
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as any;
  const toolUse = (data.content ?? []).find((b: any) => b.type === "tool_use");
  if (!toolUse?.input) throw new Error("model did not return a structured KB entry");

  const input = toolUse.input as Partial<KBEntry>;
  return {
    title: input.title || conv.title || "Untitled conversation",
    date,
    project: slug(input.project || "general"),
    topics: (input.topics ?? []).map((t) => String(t)).slice(0, 8),
    summary: input.summary || "",
    keyFacts: (input.keyFacts ?? []).map(String),
    decisions: (input.decisions ?? []).map(String),
    openQuestions: (input.openQuestions ?? []).map(String),
    resumePrompt: input.resumePrompt || "",
    provider: conv.provider,
    sourceConversationId: conv.id,
  };
}

function renderTranscript(conv: Conversation, maxChars: number): string {
  const lines = conv.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`);
  let out = lines.join("\n\n");
  if (out.length > maxChars) {
    // Keep the head and tail — openings set context, endings hold conclusions.
    const half = Math.floor(maxChars / 2);
    out = out.slice(0, half) + "\n\n...[transcript truncated]...\n\n" + out.slice(-half);
  }
  return out;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "general";
}

const KB_TOOL = {
  name: "save_kb_entry",
  description: "Save the distilled knowledge from the conversation.",
  input_schema: {
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
  },
};
