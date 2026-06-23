import type { Conversation, KBEntry } from "./types.js";
import { getProvider, type ProviderSpec, type ApiFlavor } from "./providers.js";

export interface SummarizeOptions {
  apiKey: string;
  /**
   * Provider id (see PROVIDERS): "anthropic" | "openai" | "groq" | "gemini" |
   * "openrouter". Defaults to "anthropic" for backwards compatibility.
   */
  provider?: string;
  /** Model id. Defaults to the provider's default model. */
  model?: string;
  /** Cap transcript characters sent to the model (cost guard). */
  maxChars?: number;
}

/**
 * Run one conversation through the chosen LLM and extract a structured KBEntry.
 * Whatever the provider, we force the model to emit JSON matching our schema
 * (Anthropic tool-use / OpenAI function-calling), so the caller never parses
 * free-form text.
 */
export async function summarizeConversation(
  conv: Conversation,
  opts: SummarizeOptions,
): Promise<KBEntry> {
  const provider = getProvider(opts.provider ?? "anthropic");
  const model = opts.model ?? provider.defaultModel;
  const transcript = renderTranscript(conv, opts.maxChars ?? 60_000);
  const date = (conv.updatedAt ?? conv.createdAt ?? new Date().toISOString()).slice(0, 10);
  const prompt = buildPrompt(conv, transcript, date);

  const input =
    provider.flavor === "anthropic"
      ? await callAnthropic(provider, model, prompt, opts.apiKey)
      : await callOpenAICompatible(provider, model, prompt, opts.apiKey);

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

function buildPrompt(conv: Conversation, transcript: string, date: string): string {
  return `You are Engram, a knowledge-base builder. Distill the following ${conv.provider} conversation into a durable knowledge entry by calling the save_kb_entry tool.

Be faithful to what was actually discussed — do not invent facts. Write the resumePrompt so that pasting it into a fresh chat with ANY model fully re-establishes context: what the project is, what was decided, where things stand, and what to do next.

Conversation title: ${conv.title ?? "(untitled)"}
Date: ${date}

--- TRANSCRIPT ---
${transcript}
--- END TRANSCRIPT ---`;
}

/** Anthropic Messages API: tool-use forces a structured save_kb_entry call. */
async function callAnthropic(
  provider: ProviderSpec,
  model: string,
  prompt: string,
  apiKey: string,
): Promise<Partial<KBEntry>> {
  const res = await fetch(provider.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      tools: [{ name: KB_TOOL.name, description: KB_TOOL.description, input_schema: KB_TOOL.parameters }],
      tool_choice: { type: "tool", name: KB_TOOL.name },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  await ensureOk(res, provider);
  const data = (await res.json()) as any;
  const toolUse = (data.content ?? []).find((b: any) => b.type === "tool_use");
  if (!toolUse?.input) throw new Error("model did not return a structured KB entry");
  return toolUse.input as Partial<KBEntry>;
}

/**
 * OpenAI-compatible Chat Completions API (OpenAI, Groq, Gemini, OpenRouter):
 * forced function-calling. The arguments come back as a JSON *string*.
 */
async function callOpenAICompatible(
  provider: ProviderSpec,
  model: string,
  prompt: string,
  apiKey: string,
): Promise<Partial<KBEntry>> {
  const res = await fetch(provider.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "function", function: KB_TOOL }],
      tool_choice: { type: "function", function: { name: KB_TOOL.name } },
    }),
  });
  await ensureOk(res, provider);
  const data = (await res.json()) as any;
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  const argsText = call?.function?.arguments;
  if (!argsText) throw new Error("model did not return a structured KB entry");
  try {
    return JSON.parse(argsText) as Partial<KBEntry>;
  } catch {
    throw new Error(`model returned invalid JSON arguments: ${String(argsText).slice(0, 300)}`);
  }
}

async function ensureOk(res: Response, provider: ProviderSpec): Promise<void> {
  if (res.ok) return;
  const text = await res.text().catch(() => "");
  throw new Error(`${provider.label} API error ${res.status}: ${text.slice(0, 500)}`);
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

/**
 * Schema shared by both API flavors. Anthropic wants `input_schema`; OpenAI
 * wants `parameters` — same JSON Schema object, just a different key, mapped at
 * the call sites above.
 */
const KB_TOOL = {
  name: "save_kb_entry",
  description: "Save the distilled knowledge from the conversation.",
  parameters: {
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
} as const;
