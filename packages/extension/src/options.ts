import {
  getSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  PROVIDER_ORDER,
  type Settings,
} from "./settings.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const primary = $<HTMLSelectElement>("primary");
const model = $<HTMLInputElement>("model");
const githubToken = $<HTMLInputElement>("githubToken");
const githubRepo = $<HTMLInputElement>("githubRepo");
const githubBranch = $<HTMLInputElement>("githubBranch");
const status = $<HTMLElement>("status");
const keyInput = (id: string) => $<HTMLInputElement>(`key-${id}`);

void load();
$<HTMLButtonElement>("save").addEventListener("click", save);

async function load(): Promise<void> {
  const s = await getSettings();
  primary.value = s.provider;
  model.value = s.model;
  githubToken.value = s.githubToken;
  githubRepo.value = s.githubRepo;
  githubBranch.value = s.githubBranch || "main";
  for (const id of PROVIDER_ORDER) keyInput(id).value = s.keys[id] ?? "";
}

async function save(): Promise<void> {
  const keys: Record<string, string> = {};
  for (const id of PROVIDER_ORDER) {
    const v = keyInput(id).value.trim();
    if (v) keys[id] = v;
  }
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    provider: primary.value,
    keys,
    model: model.value.trim(),
    githubToken: githubToken.value.trim(),
    githubRepo: githubRepo.value.trim(),
    githubBranch: githubBranch.value.trim() || "main",
  };
  await saveSettings(settings);
  status.textContent = "Saved ✓";
  status.className = "ok";
  setTimeout(() => (status.textContent = ""), 2000);
}
