import { orderedForFailover, getProviderById, type ProviderCandidate } from "@engram/core/browser";

/**
 * User settings for self-contained mode, stored in chrome.storage.local. Keys
 * for several providers can be set; summarize tries the primary first, then
 * falls back to other configured providers (free ones first) when one is rate-
 * limited or out of tokens.
 */
export interface Settings {
  /** Primary provider id, tried first. */
  provider: string;
  /** providerId -> API key (BYOK). */
  keys: Record<string, string>;
  /** Optional model override for the primary; blank = provider default. */
  model: string;
  /** GitHub PAT with `repo` (or fine-grained contents:write). */
  githubToken: string;
  /** "owner/name" of the private KB repo. */
  githubRepo: string;
  /** Branch to commit to. */
  githubBranch: string;
}

/** Providers with a key field in Options (Ollama is keyless, shown as a note). */
export const PROVIDER_ORDER = ["groq", "gemini", "openrouter", "anthropic", "openai"] as const;

const isNoKeyProvider = (id: string): boolean => {
  try {
    return Boolean(getProviderById(id).noKeyRequired);
  } catch {
    return false;
  }
};

export const DEFAULT_SETTINGS: Settings = {
  provider: "groq",
  keys: {},
  model: "",
  githubToken: "",
  githubRepo: "",
  githubBranch: "main",
};

const KEY = "settings";

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(KEY);
  const raw = (result[KEY] as (Partial<Settings> & { apiKey?: string }) | undefined) ?? {};
  const settings: Settings = { ...DEFAULT_SETTINGS, ...raw, keys: { ...(raw.keys ?? {}) } };
  // Migrate the old single-key shape ({ provider, apiKey }) to the keys map.
  if (raw.apiKey && !settings.keys[settings.provider]) {
    settings.keys[settings.provider] = raw.apiKey;
  }
  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}

/** True once at least one provider key is set (or a no-key provider is primary). */
export const canSummarize = (s: Settings): boolean =>
  Object.values(s.keys).some((k) => k.trim()) || isNoKeyProvider(s.provider);

/** True once notes can be pushed to GitHub. */
export const canPush = (s: Settings): boolean =>
  Boolean(s.githubToken.trim() && /^[^/]+\/[^/]+$/.test(s.githubRepo.trim()));

/** Failover order: primary first, then other keyed providers (free before paid). */
export function buildCandidates(s: Settings): ProviderCandidate[] {
  return orderedForFailover(s.provider)
    .filter((p) => s.keys[p.id]?.trim() || (p.noKeyRequired && p.id === s.provider))
    .map((p) => ({
      provider: p.id,
      apiKey: s.keys[p.id]?.trim() || (p.noKeyRequired ? "ollama" : ""),
      model: p.id === s.provider ? s.model || undefined : undefined,
    }));
}
