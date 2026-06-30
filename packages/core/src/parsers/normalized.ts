import type { Conversation, Message, Provider, Role } from "../types.js";
import { shortHash } from "../util.js";

const PROVIDERS: Provider[] = ["claude", "claude-code", "chatgpt", "gemini", "unknown"];
const ROLES: Role[] = ["user", "assistant", "system", "tool"];

/**
 * Parse Engram's own normalized conversation format — the shape the browser
 * extension emits and what sample fixtures use.
 * Returns null if the object isn't a recognizable conversation.
 */
export function parseNormalized(raw: unknown): Conversation | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.messages)) return null;

  const provider: Provider = PROVIDERS.includes(o.provider as Provider)
    ? (o.provider as Provider)
    : "unknown";

  const messages: Message[] = o.messages
    .map((m): Message | null => {
      if (typeof m !== "object" || m === null) return null;
      const mm = m as Record<string, unknown>;
      const role: Role = ROLES.includes(mm.role as Role) ? (mm.role as Role) : "user";
      const content = typeof mm.content === "string" ? mm.content : "";
      if (!content.trim()) return null;
      return {
        role,
        content,
        timestamp: typeof mm.timestamp === "string" ? mm.timestamp : undefined,
      };
    })
    .filter((m): m is Message => m !== null);

  if (messages.length === 0) return null;

  return {
    id: typeof o.id === "string" && o.id ? o.id : `conv-${shortHash(JSON.stringify(o.messages))}`,
    provider,
    title: typeof o.title === "string" ? o.title : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : undefined,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined,
    messages,
  };
}
