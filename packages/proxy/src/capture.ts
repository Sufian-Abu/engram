import fs from "node:fs";
import path from "node:path";
import { shortHash, isObject, normalizeRole, blocksToText, type Conversation, type Message } from "@engram/core";
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
    id: `api-${route.provider}-${shortHash(firstUser?.content ?? JSON.stringify(messages))}`,
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
    const system = blocksToText(body.system);
    if (system.trim()) out.push({ role: "system", content: system });
  }

  for (const m of body.messages) {
    if (!isObject(m)) continue;
    const content = blocksToText(m.content).trim();
    if (content) out.push({ role: normalizeRole(m.role), content });
  }
  return out;
}

function assistantReply(route: ApiRoute, body: unknown): Message | null {
  if (!isObject(body)) return null;

  let text = "";
  if (route.shape === "anthropic") {
    text = blocksToText(body.content);
  } else {
    const first = Array.isArray(body.choices) ? body.choices[0] : undefined;
    if (isObject(first) && isObject(first.message)) text = blocksToText(first.message.content);
  }
  return text.trim() ? { role: "assistant", content: text } : null;
}

function firstLine(s: string): string {
  return s.split("\n")[0]!.slice(0, 80);
}

function readJson(file: string): Conversation | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Conversation;
  } catch {
    return null;
  }
}
