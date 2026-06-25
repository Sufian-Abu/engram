/**
 * Browser-safe surface of @engram/core — everything the extension needs to
 * summarize and render a conversation, with NO node:fs / node:path imports.
 * Imported as `@engram/core/browser` so bundlers never pull in the filesystem
 * code (organize.ts / parsers).
 */
export {
  summarizeConversation,
  summarizeWithProviders,
  buildSummarizePrompt,
  renderTranscript,
  conversationDate,
  toKbEntry,
  type SummarizeOptions,
  type ProviderCandidate,
} from "./summarize.js";
export { renderEntry } from "./render.js";
export { slug, shortHash, conversationHash } from "./util.js";
export { ALL_PROVIDERS, getProviderById, type ProviderSpec, type ApiFlavor } from "./providers.js";
export { requestKbDraft, type StructuredRequest } from "./llm-client.js";
export { type KbEntryDraft } from "./kb-schema.js";
export type { Conversation, Message, Role, Provider, KBEntry } from "./types.js";
