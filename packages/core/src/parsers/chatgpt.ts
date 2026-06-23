import type { Conversation, Message, Role } from "../types.js";

/**
 * Parse a single conversation object from ChatGPT's official data export
 * (`conversations.json`). Each conversation is a tree of nodes in `mapping`;
 * we walk from `current_node` up to the root to reconstruct the linear
 * thread that was actually shown.
 */
export function parseChatGPTExport(raw: unknown): Conversation {
  const o = raw as Record<string, any>;
  const mapping = o.mapping as Record<string, any> | undefined;
  if (!mapping) throw new Error("not a ChatGPT export node");

  // Walk from the current leaf to the root, then reverse to chronological order.
  const ordered: any[] = [];
  let cursor: string | undefined = o.current_node;
  const guard = new Set<string>();
  while (cursor && mapping[cursor] && !guard.has(cursor)) {
    guard.add(cursor);
    ordered.push(mapping[cursor]);
    cursor = mapping[cursor].parent;
  }
  ordered.reverse();

  const messages: Message[] = [];
  for (const node of ordered) {
    const msg = node.message;
    if (!msg || !msg.author || !msg.content) continue;
    const role = normalizeRole(msg.author.role);
    if (!role) continue;
    const content = extractContent(msg.content);
    if (!content.trim()) continue;
    messages.push({
      role,
      content,
      timestamp: msg.create_time
        ? new Date(msg.create_time * 1000).toISOString()
        : undefined,
    });
  }

  const createTime = typeof o.create_time === "number" ? o.create_time : undefined;
  const updateTime = typeof o.update_time === "number" ? o.update_time : undefined;

  return {
    id: o.conversation_id || o.id || `chatgpt-${o.title ?? "untitled"}`,
    provider: "chatgpt",
    title: typeof o.title === "string" ? o.title : undefined,
    createdAt: createTime ? new Date(createTime * 1000).toISOString() : undefined,
    updatedAt: updateTime ? new Date(updateTime * 1000).toISOString() : undefined,
    messages,
  };
}

function normalizeRole(role: unknown): Role | null {
  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  if (role === "system") return "system";
  if (role === "tool") return "tool";
  return null;
}

/** ChatGPT content parts come in a few shapes; flatten to plain text. */
function extractContent(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content?.parts)) {
    return content.parts
      .map((p: unknown) => (typeof p === "string" ? p : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}
