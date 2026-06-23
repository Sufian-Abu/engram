import type { Conversation } from "../types.js";
import { parseChatGPTExport } from "./chatgpt.js";
import { parseNormalized } from "./normalized.js";
import { parseClaudeCodeTranscript, isClaudeCodeTranscript } from "./claudecode.js";

/**
 * Detect the export format from raw parsed JSON and normalize it into
 * Engram's Conversation[] shape.
 *
 * Supported today:
 *  - Claude Code CLI transcript (array of JSONL events with sessionId)
 *  - ChatGPT data export (`conversations.json`: array of mapping trees)
 *  - Engram normalized format (single conversation or array)
 *
 * Add new providers by writing a parser here; the rest of the pipeline is
 * provider-agnostic.
 */
export const parseAny = (raw: unknown): Conversation[] => {
  // Claude Code transcript: array of events, some with sessionId + user/assistant type.
  if (isClaudeCodeTranscript(raw)) {
    const conv = parseClaudeCodeTranscript(raw as any[]);
    return conv.messages.length > 0 ? [conv] : [];
  }

  // ChatGPT export: array of objects each containing a `mapping` tree.
  if (Array.isArray(raw) && raw.length > 0 && isChatGPTNode(raw[0])) {
    return raw.flatMap((c) => {
      try {
        return [parseChatGPTExport(c)];
      } catch {
        return [];
      }
    });
  }

  // Engram normalized format (array or single).
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map(parseNormalized).filter((c): c is Conversation => c !== null);
};

const isChatGPTNode = (x: unknown): boolean =>
  typeof x === "object" && x !== null && "mapping" in (x as Record<string, unknown>);

export { parseChatGPTExport, parseNormalized, parseClaudeCodeTranscript, isClaudeCodeTranscript };
