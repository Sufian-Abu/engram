import fs from "node:fs";
import path from "node:path";
import type { Conversation, Message, Provider, Role } from "@engram/core";
import type { ApiRoute } from "./providers.js";

/**
 * Build a normalized Conversation from one API exchange. Each chat request
 * already carries the full prior history in `messages`, so the request alone
 * gives us the whole conversation; we append the latest assistant reply parsed
 * from the response. Returns null if there's nothing usable.
 */
export function extractConversation(
  route: ApiRoute,
  requestBody: unknown,
  responseBody: unknown,
): Conversation | null {
  const messages = requestMessages(route, requestBody);
  const reply = assistantReply(route, responseBody);
  if (reply) messages.push(reply);
  if (messages.length === 0) return null;

  const firstUser = messages.find((m) => m.role === "user");
  return {
    id: `api-${route.provider}-${hash(firstUser?.content ?? JSON.stringify(messages))}`,
    provider: route.provider,
    title: firstUser ? firstLine(firstUser.content) : undefined,
    messages,
  };
}

/** Persist as Engram-normalized JSON; latest (longest) capture for an id wins. */
export function writeCapture(conv: Conversation, dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${conv.id}.json`);
  const existing = readJson(file);
  // Don't let a shorter follow-up overwrite a fuller capture of the same chat.
  if (existing && existing.messages.length > conv.messages.length) return file;
  fs.writeFileSync(file, JSON.stringify(conv, null, 2));
  return file;
}

function requestMessages(route: ApiRoute, body: unknown): Message[] {
  if (!isObject(body) || !Array.isArray(body.messages)) return [];
  const out: Message[] = [];

  // Anthropic carries the system prompt in a top-level `system` field.
  if (route.shape === "anthropic" && body.system) {
    const system = contentToText(body.system);
    if (system.trim()) out.push({ role: "system", content: system });
  }

  for (const m of body.messages) {
    if (!isObject(m)) continue;
    const content = contentToText(m.content).trim();
    if (content) out.push({ role: normalizeRole(str(m.role)), content });
  }
  return out;
}

function assistantReply(route: ApiRoute, body: unknown): Message | null {
  if (!isObject(body)) return null;

  let text = "";
  if (route.shape === "anthropic") {
    text = contentToText(body.content);
  } else {
    const first = Array.isArray(body.choices) ? body.choices[0] : undefined;
    if (isObject(first) && isObject(first.message)) text = contentToText(first.message.content);
  }
  return text.trim() ? { role: "assistant", content: text } : null;
}

/** A string content, or an array of {type:"text", text} blocks (both APIs). */
function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => (isObject(block) ? str(block.text) : ""))
    .filter(Boolean)
    .join("\n\n");
}

function normalizeRole(role: string): Role {
  if (role === "assistant" || role === "system" || role === "tool") return role;
  return "user";
}

function firstLine(s: string): string {
  return s.split("\n")[0]!.slice(0, 80);
}

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function readJson(file: string): Conversation | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Conversation;
  } catch {
    return null;
  }
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function str(x: unknown): string {
  return typeof x === "string" ? x : "";
}

export type { Provider };
