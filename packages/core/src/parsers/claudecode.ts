import type { Conversation, Message, Role } from "../types.js";

/**
 * Parse a Claude Code CLI session transcript. The transcript is JSONL: one
 * JSON event per line. We keep only the human/assistant turns, extracting the
 * plain-text blocks and dropping internal noise (thinking, tool_use,
 * tool_result) and injected <system-reminder> blocks.
 *
 * Pass the already-parsed array of line objects (see ingest's .jsonl handling).
 */
export function parseClaudeCodeTranscript(events: any[]): Conversation {
  let sessionId: string | undefined;
  let title: string | undefined;
  let firstTs: string | undefined;
  let lastTs: string | undefined;

  const messages: Message[] = [];
  for (const e of events) {
    if (e?.sessionId && !sessionId) sessionId = e.sessionId;
    // Claude Code emits an AI-generated title event; keep the latest.
    if (e?.type === "ai-title" && typeof e.aiTitle === "string") title = e.aiTitle;

    if (e?.type !== "user" && e?.type !== "assistant") continue;
    const msg = e.message;
    if (!msg) continue;

    const role: Role = msg.role === "assistant" ? "assistant" : "user";
    const text = clean(extractText(msg.content));
    if (!text) continue;

    const ts = typeof e.timestamp === "string" ? e.timestamp : undefined;
    if (ts) {
      if (!firstTs) firstTs = ts;
      lastTs = ts;
    }
    messages.push({ role, content: text, timestamp: ts });
  }

  return {
    id: sessionId ? `claude-code-${sessionId}` : `claude-code-${hash(JSON.stringify(events).slice(0, 2000))}`,
    provider: "claude-code",
    title,
    createdAt: firstTs,
    updatedAt: lastTs,
    messages,
  };
}

/** True if a parsed JSONL array looks like a Claude Code transcript. */
export function isClaudeCodeTranscript(arr: unknown): boolean {
  if (!Array.isArray(arr)) return false;
  return arr.some(
    (e) =>
      typeof e === "object" &&
      e !== null &&
      "sessionId" in (e as any) &&
      ((e as any).type === "user" || (e as any).type === "assistant"),
  );
}

/** Pull plain text out of a message.content (string or block array). */
function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b: any) => b && b.type === "text" && typeof b.text === "string")
    .map((b: any) => b.text)
    .join("\n");
}

/** Strip harness-injected <system-reminder> blocks; collapse blank runs. */
function clean(s: string): string {
  return s
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
