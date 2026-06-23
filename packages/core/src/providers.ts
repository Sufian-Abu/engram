/**
 * The set of LLM providers Engram can summarize with. Engram is BYOK: the user
 * supplies a key for whichever provider they like.
 *
 * Two API "flavors" cover every provider here:
 *   - "anthropic": the Anthropic Messages API (tool-use to force JSON).
 *   - "openai":    the OpenAI Chat Completions API (function-calling to force
 *                  JSON). Groq, OpenAI, Gemini, and OpenRouter all speak this.
 *
 * Each provider is declared as its own named const below so the registry reads
 * as a list of clearly-labelled entries rather than one opaque blob.
 */
export type ApiFlavor = "anthropic" | "openai";

export interface ProviderSpec {
  /** Stable id used in config (ENGRAM_PROVIDER) and logs. */
  id: string;
  /** Human label. */
  label: string;
  /** Which API shape this provider speaks. */
  flavor: ApiFlavor;
  /** Full chat/messages endpoint URL. */
  baseUrl: string;
  /** Model used when the user doesn't override ENGRAM_MODEL. */
  defaultModel: string;
  /** Env var Engram reads the API key from. */
  keyEnv: string;
  /** True if the provider offers a no-cost API key / free tier. */
  free: boolean;
}

const anthropic: ProviderSpec = {
  id: "anthropic",
  label: "Anthropic (Claude)",
  flavor: "anthropic",
  baseUrl: "https://api.anthropic.com/v1/messages",
  defaultModel: "claude-sonnet-4-6",
  keyEnv: "ANTHROPIC_API_KEY",
  free: false,
};

const openai: ProviderSpec = {
  id: "openai",
  label: "OpenAI (ChatGPT)",
  flavor: "openai",
  baseUrl: "https://api.openai.com/v1/chat/completions",
  defaultModel: "gpt-4o-mini",
  keyEnv: "OPENAI_API_KEY",
  free: false,
};

const groq: ProviderSpec = {
  id: "groq",
  label: "Groq (free, fast Llama/etc.)",
  flavor: "openai",
  baseUrl: "https://api.groq.com/openai/v1/chat/completions",
  defaultModel: "llama-3.3-70b-versatile",
  keyEnv: "GROQ_API_KEY",
  free: true,
};

const gemini: ProviderSpec = {
  id: "gemini",
  label: "Google Gemini (free tier)",
  flavor: "openai",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  defaultModel: "gemini-2.0-flash",
  keyEnv: "GEMINI_API_KEY",
  free: true,
};

const openrouter: ProviderSpec = {
  id: "openrouter",
  label: "OpenRouter (has free models)",
  flavor: "openai",
  baseUrl: "https://openrouter.ai/api/v1/chat/completions",
  defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
  keyEnv: "OPENROUTER_API_KEY",
  free: true,
};

/** All providers, in the order they're tried when auto-detecting from env. */
export const ALL_PROVIDERS: readonly ProviderSpec[] = [anthropic, openai, groq, gemini, openrouter];

const byId = new Map(ALL_PROVIDERS.map((p) => [p.id, p]));

/** Look up a provider by id, throwing a helpful error if it's unknown. */
export const getProviderById = (id: string): ProviderSpec => {
  const provider = byId.get(id);
  if (!provider) {
    const known = ALL_PROVIDERS.map((p) => p.id).join(", ");
    throw new Error(`unknown provider "${id}". Known providers: ${known}`);
  }
  return provider;
};

/**
 * Pick a provider from the environment: an explicit ENGRAM_PROVIDER wins;
 * otherwise the first provider whose key env var has a non-empty value.
 * Returns null if no provider key is present.
 */
export const resolveProviderFromEnv = (
  env: Record<string, string | undefined>,
): ProviderSpec | null => {
  const explicitId = env.ENGRAM_PROVIDER?.trim();
  if (explicitId) return getProviderById(explicitId);
  return ALL_PROVIDERS.find((p) => Boolean(env[p.keyEnv]?.trim())) ?? null;
};
