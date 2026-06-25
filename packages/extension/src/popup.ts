import type { Conversation } from "./types.js";

const STORAGE_KEY = "conversations";

const els = {
  count: document.getElementById("count") as HTMLElement,
  list: document.getElementById("list") as HTMLUListElement,
  exportBtn: document.getElementById("export") as HTMLButtonElement,
  clearBtn: document.getElementById("clear") as HTMLButtonElement,
};

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

  els.list.innerHTML = "";
  if (conversations.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Open a conversation on claude.ai to capture it.";
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
