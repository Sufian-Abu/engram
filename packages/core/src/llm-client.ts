import type { ProviderSpec } from "./providers.js";
import { KB_TOOL_NAME, KB_TOOL_DESCRIPTION, KB_JSON_SCHEMA, type KbEntryDraft } from "./kb-schema.js";

export interface StructuredRequest {
  provider: ProviderSpec;
  model: string;
  apiKey: string;
  /** The single user prompt sent to the model. */
  prompt: string;
  /** Upper bound on response tokens. */
  maxTokens?: number;
}

/** Marker so requestKbDraft knows a model ignored the tool and JSON mode should run. */
const NO_TOOL_CALL = "engram:no-tool-call";

/**
 * Ask a provider to distill the prompt into a KbEntryDraft. First tries forced
 * tool-calling (the reliable path). If the model doesn't support tools — common
 * for local Ollama models and some OpenRouter ones — it falls back to plain
 * JSON mode: ask for a JSON object and parse it loosely from the reply.
 */
export const requestKbDraft = async (req: StructuredRequest): Promise<KbEntryDraft> => {
  try {
    return req.provider.flavor === "anthropic" ? await requestViaAnthropic(req) : await requestViaOpenAI(req);
  } catch (e) {
    if (shouldFallbackToJson(e)) return requestViaJsonMode(req);
    throw e;
  }
};

/** Tool-calling failed in a way JSON mode can rescue (unsupported, or ignored). */
const shouldFallbackToJson = (e: unknown): boolean => {
  const m = String((e as any)?.message ?? e).toLowerCase();
  return (
    m.includes(NO_TOOL_CALL) ||
    m.includes("tool use") ||
    m.includes("tool_use") ||
    m.includes("function call") ||
    m.includes("tool call") ||
    m.includes("tool_choice") ||
    m.includes("does not support") ||
    m.includes("not supported") ||
    m.includes("no endpoints found that support tool")
  );
};

/** Anthropic Messages API: tool-use forces a structured save_kb_entry call. */
const requestViaAnthropic = async (req: StructuredRequest): Promise<KbEntryDraft> => {
  const response = await fetch(req.provider.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": req.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: req.model,
      max_tokens: req.maxTokens ?? 2048,
      tools: [{ name: KB_TOOL_NAME, description: KB_TOOL_DESCRIPTION, input_schema: KB_JSON_SCHEMA }],
      tool_choice: { type: "tool", name: KB_TOOL_NAME },
      messages: [{ role: "user", content: req.prompt }],
    }),
  });
  await throwIfNotOk(response, req.provider);

  const data = (await response.json()) as any;
  const toolUse = (data.content ?? []).find((block: any) => block.type === "tool_use");
  if (!toolUse?.input) throw new Error(NO_TOOL_CALL);
  return toolUse.input as KbEntryDraft;
};

/**
 * OpenAI-compatible Chat Completions API (OpenAI, Groq, Gemini, OpenRouter):
 * forced function-calling. The arguments come back as a JSON *string*.
 */
const requestViaOpenAI = async (req: StructuredRequest): Promise<KbEntryDraft> => {
  const response = await fetch(req.provider.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      max_tokens: req.maxTokens ?? 2048,
      messages: [{ role: "user", content: req.prompt }],
      tools: [{ type: "function", function: { name: KB_TOOL_NAME, description: KB_TOOL_DESCRIPTION, parameters: KB_JSON_SCHEMA } }],
      tool_choice: { type: "function", function: { name: KB_TOOL_NAME } },
    }),
  });
  await throwIfNotOk(response, req.provider);

  const data = (await response.json()) as any;
  const argsJson = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argsJson) throw new Error(NO_TOOL_CALL);
  try {
    return JSON.parse(argsJson) as KbEntryDraft;
  } catch {
    throw new Error(`model returned invalid JSON arguments: ${String(argsJson).slice(0, 300)}`);
  }
};

const JSON_INSTRUCTION = `Respond with ONLY a single JSON object — no markdown, no commentary — with exactly these fields:
{"title": string, "project": string (lowercase, short), "topics": string[], "summary": string, "keyFacts": string[], "decisions": string[], "openQuestions": string[], "resumePrompt": string}`;

/**
 * Fallback for models without tool support: ask for a JSON object in plain text
 * and parse it loosely. Works on essentially any chat model.
 */
const requestViaJsonMode = async (req: StructuredRequest): Promise<KbEntryDraft> => {
  const text = await requestPlainText(req, `${req.prompt}\n\n${JSON_INSTRUCTION}`);
  const json = extractJson(text);
  if (!json) throw new Error("model did not return parseable JSON");
  return json as KbEntryDraft;
};

/** A plain completion (no tools), returning the assistant's text, either flavor. */
const requestPlainText = async (req: StructuredRequest, prompt: string): Promise<string> => {
  if (req.provider.flavor === "anthropic") {
    const response = await fetch(req.provider.baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": req.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: req.model, max_tokens: req.maxTokens ?? 2048, messages: [{ role: "user", content: prompt }] }),
    });
    await throwIfNotOk(response, req.provider);
    const data = (await response.json()) as any;
    return (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  }
  const response = await fetch(req.provider.baseUrl, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${req.apiKey}` },
    body: JSON.stringify({ model: req.model, max_tokens: req.maxTokens ?? 2048, messages: [{ role: "user", content: prompt }] }),
  });
  await throwIfNotOk(response, req.provider);
  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content ?? "";
};

/** Pull a JSON object out of model text — tolerant of code fences and stray prose. */
export const extractJson = (text: string): unknown | null => {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* not bare JSON — try to slice the object out */
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      /* unrecoverable */
    }
  }
  return null;
};

const throwIfNotOk = async (response: Response, provider: ProviderSpec): Promise<void> => {
  if (response.ok) return;
  const body = await response.text().catch(() => "");
  throw new Error(`${provider.label} API error ${response.status}: ${body.slice(0, 500)}`);
};
