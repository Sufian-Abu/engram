import type { Conversation, KBEntry } from "./types.js";
import { getProviderById } from "./providers.js";
import { requestKbDraft } from "./llm-client.js";
import { KB_TOOL_NAME, type KbEntryDraft } from "./kb-schema.js";
import { slug } from "./util.js";

const DEFAULT_PROVIDER_ID = "anthropic";
// ~8k input tokens — fits Groq's free-tier 12k tokens/minute budget (plus the
// 2k output reservation) so most chats summarize in one call. Bigger chats get
// truncated and retried smaller.
const DEFAULT_MAX_TRANSCRIPT_CHARS = 32_000;
const MAX_TOPICS = 8;

export interface SummarizeOptions {
  apiKey: string;
  /**
   * Provider id: "anthropic" | "openai" | "groq" | "gemini" | "openrouter".
   * Defaults to "anthropic" for backwards compatibility.
   */
  provider?: string;
  /** Model id. Defaults to the provider's default model. */
  model?: string;
  /** Cap transcript characters sent to the model (cost guard). */
  maxChars?: number;
}

/**
 * Run one conversation through the chosen LLM and extract a structured KBEntry.
 * Orchestrates pure helpers (transcript → prompt → draft → entry) so each step
 * can be tested in isolation.
 */
export const summarizeConversation = async (
  conv: Conversation,
  opts: SummarizeOptions,
): Promise<KBEntry> => {
  const provider = getProviderById(opts.provider ?? DEFAULT_PROVIDER_ID);
  const model = opts.model ?? provider.defaultModel;
  const date = conversationDate(conv);

  // Long chats can exceed a provider's per-request / per-minute token budget
  // (e.g. Groq's free tier). On a "too large" error, halve the transcript and
  // retry — a truncated summary beats none. The starting size is provider-aware
  // so big-context providers (Gemini/Claude) summarize far more of the chat.
  let maxChars = opts.maxChars ?? provider.maxInputChars ?? DEFAULT_MAX_TRANSCRIPT_CHARS;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_SHRINK_ATTEMPTS; attempt++) {
    const transcript = renderTranscript(conv, maxChars);
    try {
      const draft = await requestKbDraft({
        provider,
        model,
        apiKey: opts.apiKey,
        prompt: buildSummarizePrompt(conv, transcript, date),
      });
      return toKbEntry(draft, conv, date);
    } catch (e) {
      lastError = e;
      if (isTooLargeError(e) && maxChars > MIN_TRANSCRIPT_CHARS) {
        maxChars = Math.floor(maxChars / 2);
        continue;
      }
      throw e;
    }
  }
  throw lastError;
};

export interface ProviderCandidate {
  provider: string;
  apiKey: string;
  model?: string;
}

/**
 * Summarize trying each provider in order, falling through to the next on any
 * failure (rate limit, quota, bad key…). Lets a free provider that's out of
 * tokens hand off to another free provider that still has budget. Returns the
 * first success; throws the last error if all candidates fail.
 */
export const summarizeWithProviders = async (
  conv: Conversation,
  candidates: ProviderCandidate[],
  opts?: {
    maxChars?: number;
    /** Called when one provider fails and another will be tried. */
    onFallback?: (failed: string, error: string, next: string) => void;
  },
): Promise<KBEntry> => {
  if (candidates.length === 0) throw new Error("no provider key configured");
  let lastError: unknown;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    try {
      return await summarizeConversation(conv, {
        apiKey: c.apiKey,
        provider: c.provider,
        model: c.model,
        maxChars: opts?.maxChars,
      });
    } catch (e) {
      lastError = e;
      const next = candidates[i + 1];
      if (next) opts?.onFallback?.(c.provider, String((e as any)?.message ?? e), next.provider);
    }
  }
  throw lastError;
};

const MAX_SHRINK_ATTEMPTS = 5;
const MIN_TRANSCRIPT_CHARS = 4000;

/** A request-too-large / token-limit error worth retrying with less transcript. */
const isTooLargeError = (e: unknown): boolean =>
  /too large|reduce your message|request too large|413|rate_limit_exceeded|context length|maximum context/i.test(
    String((e as any)?.message ?? e),
  );

/** Pick the conversation's date (YYYY-MM-DD), preferring when it was updated. */
export const conversationDate = (conv: Conversation): string =>
  (conv.updatedAt ?? conv.createdAt ?? new Date().toISOString()).slice(0, 10);

/** Build the single user prompt that instructs the model to distill the chat. */
export const buildSummarizePrompt = (
  conv: Conversation,
  transcript: string,
  date: string,
): string =>
  `You are Engram, a knowledge-base builder. Distill the following ${conv.provider} conversation into a durable knowledge entry by calling the ${KB_TOOL_NAME} tool.

Be faithful to what was actually discussed — do not invent facts. Write the resumePrompt so that pasting it into a fresh chat with ANY model fully re-establishes context: what the project is, what was decided, where things stand, and what to do next.

Conversation title: ${conv.title ?? "(untitled)"}
Date: ${date}

--- TRANSCRIPT ---
${transcript}
--- END TRANSCRIPT ---`;

/**
 * Flatten a conversation to plain text, truncating the middle if it's too long
 * (openings set context, endings hold conclusions — keep both ends).
 */
export const renderTranscript = (conv: Conversation, maxChars: number): string => {
  const full = conv.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
  if (full.length <= maxChars) return full;
  const half = Math.floor(maxChars / 2);
  return `${full.slice(0, half)}\n\n...[transcript truncated]...\n\n${full.slice(-half)}`;
};

/** Normalize a model's raw draft into a complete, well-formed KBEntry. */
export const toKbEntry = (draft: KbEntryDraft, conv: Conversation, date: string): KBEntry => ({
  title: draft.title || conv.title || "Untitled conversation",
  date,
  project: slug(draft.project || "general", "general"),
  topics: (draft.topics ?? []).map(String).slice(0, MAX_TOPICS),
  summary: draft.summary || "",
  keyFacts: (draft.keyFacts ?? []).map(String),
  decisions: (draft.decisions ?? []).map(String),
  openQuestions: (draft.openQuestions ?? []).map(String),
  resumePrompt: draft.resumePrompt || "",
  provider: conv.provider,
  sourceConversationId: conv.id,
});
