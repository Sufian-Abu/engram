import type { Conversation } from "./types.js";

const STORAGE_KEY = "conversations";

const els = {
  count: document.getElementById("count") as HTMLElement,
  status: document.getElementById("status") as HTMLElement,
  settings: document.getElementById("settings") as HTMLAnchorElement,
  list: document.getElementById("list") as HTMLUListElement,
  exportBtn: document.getElementById("export") as HTMLButtonElement,
  clearBtn: document.getElementById("clear") as HTMLButtonElement,
};

els.settings.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

void render();

els.exportBtn.addEventListener("click", exportJson);
els.clearBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(STORAGE_KEY);
  await render();
});

async function getStored(): Promise<Conversation[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const list = result[STORAGE_KEY];
  return Array.isArray(list) ? (list as Conversation[]) : [];
}

async function render(): Promise<void> {
  const conversations = await getStored();
  els.count.textContent = String(conversations.length);
  els.exportBtn.disabled = conversations.length === 0;
  els.clearBtn.disabled = conversations.length === 0;
  await renderStatus();

  els.list.innerHTML = "";
  if (conversations.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Open a conversation on claude.ai, chatgpt.com, or gemini to capture it.";
    els.list.append(empty);
    return;
  }
  for (const conv of conversations) {
    const li = document.createElement("li");
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = conv.title || "(untitled)";
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${conv.messages.length} messages`;
    li.append(title, meta);
    els.list.append(li);
  }
}

/** Reflect how captures are being handled (set by the service worker). */
async function renderStatus(): Promise<void> {
  const { mode } = (await chrome.storage.local.get("mode")) as { mode?: string };
  const fallback: [string, string] = ["off", "○ Captured — add a key in Settings to summarize automatically"];
  const states: Record<string, [string, string]> = {
    synced: ["on", "● Summarizing &amp; pushing to GitHub automatically"],
    summarized: ["on", "● Summarizing — add a GitHub token in Settings to push"],
    daemon: ["on", "● Auto-syncing via the local daemon"],
    stored: fallback,
    error: ["off", "○ Summarize failed — check your key in Settings"],
  };
  const [cls, text] = states[mode ?? "stored"] ?? fallback;
  let html = `<span class="${cls}">${text}</span>`;
  if (mode === "error" || mode === "summarized") {
    const { lastError } = (await chrome.storage.local.get("lastError")) as { lastError?: string };
    if (lastError) html += `<div class="err">${escapeHtml(lastError)}</div>`;
  }
  els.status.innerHTML = html;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

/** Download all captures as a JSON array — exactly what `engram ingest` reads. */
async function exportJson(): Promise<void> {
  const conversations = await getStored();
  const blob = new Blob([JSON.stringify(conversations, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "engram-claude-conversations.json";
  a.click();
  URL.revokeObjectURL(url);
}
