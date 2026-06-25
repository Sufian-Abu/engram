import { ENGRAM_SOURCE, type CapturedMessage, type Conversation, type Message, type Role } from "./types.js";

/**
 * Best-effort DOM capture for gemini.google.com (its data rides obfuscated
 * batchexecute RPC, so network interception isn't practical). Watches the
 * conversation, and a couple of seconds after it settles, reads the turns and
 * sends a normalized Conversation to the service worker. Selectors target
 * Gemini's Angular element tags with text-class fallbacks; if Google reworks
 * the DOM these may need updating.
 */
const SETTLE_MS = 2500;
let timer: ReturnType<typeof setTimeout> | undefined;

console.debug("[engram] gemini DOM capture active (experimental)");

const observer = new MutationObserver(() => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(scrape, SETTLE_MS);
});
observer.observe(document.documentElement, { childList: true, subtree: true });

function scrape(): void {
  const conversation = readConversation();
  if (conversation) send(conversation);
}

function readConversation(): Conversation | null {
  const id = conversationId();
  if (!id) return null; // only capture a saved chat (URL has /app/<id>)
  const messages = readTurns();
  if (messages.length === 0) return null;
  return { id, provider: "gemini", title: messages[0]!.content.slice(0, 80), messages };
}

/** Gemini chat URLs look like gemini.google.com/app/<id>. */
function conversationId(): string | null {
  const m = location.pathname.match(/\/app\/([a-z0-9_-]{6,})/i);
  return m ? `gemini-${m[1]}` : null;
}

function readTurns(): Message[] {
  const nodes = document.querySelectorAll("user-query, model-response");
  const messages: Message[] = [];
  for (const node of Array.from(nodes)) {
    const role: Role = node.tagName.toLowerCase() === "user-query" ? "user" : "assistant";
    const text = turnText(node, role);
    if (text) messages.push({ role, content: text });
  }
  return messages;
}

function turnText(node: Element, role: Role): string {
  const inner =
    role === "user"
      ? node.querySelector(".query-text, [class*='query-text']")
      : node.querySelector("message-content, .markdown, [class*='markdown']");
  return ((inner ?? node).textContent ?? "").replace(/\s+\n/g, "\n").trim();
}

function send(conversation: Conversation): void {
  const message: CapturedMessage = {
    source: ENGRAM_SOURCE,
    kind: "conversation",
    provider: "gemini",
    payload: conversation,
  };
  try {
    if (!chrome.runtime?.id) return;
    chrome.runtime.sendMessage(message).catch(() => {});
  } catch {
    /* extension reloaded — stale tab; reload to resume */
  }
}
