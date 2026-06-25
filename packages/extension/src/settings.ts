/**
 * User settings for self-contained mode, stored in chrome.storage.local. With a
 * provider key set, the extension summarizes in the browser; with a GitHub
 * token + repo, it pushes notes itself — no local daemon needed.
 */
export interface Settings {
  /** Provider id: "groq" | "gemini" | "openrouter" | "anthropic" | "openai". */
  provider: string;
  /** API key for that provider (BYOK). */
  apiKey: string;
  /** Optional model override; blank = the provider's default. */
  model: string;
  /** GitHub personal-access token with `repo` (or fine-grained contents:write). */
  githubToken: string;
  /** "owner/name" of the private KB repo. */
  githubRepo: string;
  /** Branch to commit to. */
  githubBranch: string;
}

export const DEFAULT_SETTINGS: Settings = {
  provider: "groq",
  apiKey: "",
  model: "",
  githubToken: "",
  githubRepo: "",
  githubBranch: "main",
};

const KEY = "settings";

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(result[KEY] as Partial<Settings> | undefined) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}

/** True once there's enough to summarize in the browser. */
export const canSummarize = (s: Settings): boolean => Boolean(s.apiKey.trim());

/** True once notes can be pushed to GitHub. */
export const canPush = (s: Settings): boolean =>
  Boolean(s.githubToken.trim() && /^[^/]+\/[^/]+$/.test(s.githubRepo.trim()));
