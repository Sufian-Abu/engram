import type { Conversation, Message, Provider, Role } from "../types.js";

const PROVIDERS: Provider[] = ["claude", "claude-code", "chatgpt", "gemini", "unknown"];
const ROLES: Role[] = ["user", "assistant", "system", "tool"];

/**
 * Parse Engram's own normalized conversation format. This is the format the
 * browser extension (Phase 2) will emit, and what sample fixtures use.
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
    id: typeof o.id === "string" && o.id ? o.id : `conv-${hash(JSON.stringify(o.messages))}`,
    provider,
    title: typeof o.title === "string" ? o.title : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : undefined,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined,
    messages,
  };
}

/** Tiny stable string hash (FNV-1a) for synthesizing ids when absent. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
