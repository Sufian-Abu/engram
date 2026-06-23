/** Supported chat providers. More can be added as parsers are written. */
export type Provider = "claude" | "claude-code" | "chatgpt" | "gemini" | "unknown";

export type Role = "user" | "assistant" | "system" | "tool";

export interface Message {
  role: Role;
  content: string;
  /** ISO 8601 timestamp, if known. */
  timestamp?: string;
}

/**
 * A provider-agnostic conversation. Every parser normalizes a provider's
 * native export format into this shape so the rest of the pipeline is
 * provider-independent.
 */
export interface Conversation {
  /** Stable id used for dedupe; ideally the provider's own conversation id. */
  id: string;
  provider: Provider;
  title?: string;
  /** ISO 8601. */
  createdAt?: string;
  /** ISO 8601. */
  updatedAt?: string;
  messages: Message[];
}

/**
 * The structured knowledge extracted from a conversation. This is the unit
 * that gets rendered to Markdown and synced. The `resumePrompt` is the
 * differentiator: a paste-ready block that re-seeds *any* model with this
 * conversation's context so a revoked account never strands you.
 */
export interface KBEntry {
  title: string;
  /** YYYY-MM-DD, derived from the conversation date. */
  date: string;
  /** Single project bucket this belongs to, slug-friendly. */
  project: string;
  /** Topic tags for cross-cutting search. */
  topics: string[];
  /** 2-4 sentence overview. */
  summary: string;
  /** Durable facts/knowledge worth keeping. */
  keyFacts: string[];
  /** Decisions made and their rationale. */
  decisions: string[];
  /** Unresolved threads to pick up later. */
  openQuestions: string[];
  /** Paste-ready prompt to resume this work in any model. */
  resumePrompt: string;
  /** Provenance. */
  provider: Provider;
  sourceConversationId: string;
}
