import { getSettings, saveSettings, DEFAULT_SETTINGS, type Settings } from "./settings.js";

const KEY_HINTS: Record<string, string> = {
  groq: 'Free key at <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>',
  gemini: 'Free key at <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a>',
  openrouter: 'Key at <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a> (use a :free model)',
  anthropic: 'Key at <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>',
  openai: 'Key at <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>',
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const fields = {
  provider: $<HTMLSelectElement>("provider"),
  apiKey: $<HTMLInputElement>("apiKey"),
  model: $<HTMLInputElement>("model"),
  githubToken: $<HTMLInputElement>("githubToken"),
  githubRepo: $<HTMLInputElement>("githubRepo"),
  githubBranch: $<HTMLInputElement>("githubBranch"),
};
const keyHint = $<HTMLElement>("keyHint");
const status = $<HTMLElement>("status");

void load();
fields.provider.addEventListener("change", updateKeyHint);
$<HTMLButtonElement>("save").addEventListener("click", save);

async function load(): Promise<void> {
  const s = await getSettings();
  fields.provider.value = s.provider;
  fields.apiKey.value = s.apiKey;
  fields.model.value = s.model;
  fields.githubToken.value = s.githubToken;
  fields.githubRepo.value = s.githubRepo;
  fields.githubBranch.value = s.githubBranch || "main";
  updateKeyHint();
}

function updateKeyHint(): void {
  keyHint.innerHTML = KEY_HINTS[fields.provider.value] ?? "";
}

async function save(): Promise<void> {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    provider: fields.provider.value,
    apiKey: fields.apiKey.value.trim(),
    model: fields.model.value.trim(),
    githubToken: fields.githubToken.value.trim(),
    githubRepo: fields.githubRepo.value.trim(),
    githubBranch: fields.githubBranch.value.trim() || "main",
  };
  await saveSettings(settings);
  status.textContent = "Saved ✓";
  status.className = "ok";
  setTimeout(() => (status.textContent = ""), 2000);
}
