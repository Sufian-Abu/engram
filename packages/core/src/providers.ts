/**
 * Provider registry for the summarize step. Engram is BYOK: the user supplies a
 * key for whichever provider they like, and Engram distills conversations with
 * it. Two API "flavors" cover every provider here:
 *
 *   - "anthropic": the Anthropic Messages API (tool-use to force JSON).
 *   - "openai":    the OpenAI Chat Completions API (function-calling to force
 *                  JSON). Groq, OpenAI, Gemini, and OpenRouter all speak this.
 *
 * Several of these have a genuinely free API key (Groq, Gemini, OpenRouter's
 * ":free" models), so a user can run Engram end-to-end at zero cost.
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

export const PROVIDERS: Record<string, ProviderSpec> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    flavor: "anthropic",
    baseUrl: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-sonnet-4-6",
    keyEnv: "ANTHROPIC_API_KEY",
    free: false,
  },
  openai: {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    flavor: "openai",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    keyEnv: "OPENAI_API_KEY",
    free: false,
  },
  groq: {
    id: "groq",
    label: "Groq (free, fast Llama/etc.)",
    flavor: "openai",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.3-70b-versatile",
    keyEnv: "GROQ_API_KEY",
    free: true,
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini (free tier)",
    flavor: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-2.0-flash",
    keyEnv: "GEMINI_API_KEY",
    free: true,
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter (has free models)",
    flavor: "openai",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    keyEnv: "OPENROUTER_API_KEY",
    free: true,
  },
};

export function getProvider(id: string): ProviderSpec {
  const p = PROVIDERS[id];
  if (!p) {
    throw new Error(
      `unknown provider "${id}". Known: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }
  return p;
}

/**
 * Pick a provider from the environment: an explicit ENGRAM_PROVIDER wins;
 * otherwise the first provider (in registry order) whose key env var is set.
 * Returns null if no provider key is present.
 */
export function resolveProviderFromEnv(
  env: Record<string, string | undefined>,
): ProviderSpec | null {
  const explicit = env.ENGRAM_PROVIDER?.trim();
  if (explicit) return getProvider(explicit);
  for (const p of Object.values(PROVIDERS)) {
    if (env[p.keyEnv]?.trim()) return p;
  }
  return null;
}
