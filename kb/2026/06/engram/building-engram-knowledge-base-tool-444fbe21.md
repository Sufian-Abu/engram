---
title: "Building Engram — a tool to capture & own your LLM conversations"
date: 2026-06-23
project: engram
provider: claude
topics: [knowledge-base, browser-extension, llm-portability, backup, open-source, monorepo]
source_id: 444fbe21-session
---

# Building Engram — a tool to capture & own your LLM conversations

Defined and began building **Engram**, an open-source tool that captures your conversations across Claude, ChatGPT, and Gemini, summarizes them into a structured, portable Markdown knowledge base, and syncs that KB to both a private GitHub repo and Google Drive — so revoked access, bans, or lost history never strand your accumulated context. Each entry ends with a paste-ready "resume prompt" to continue the work in any model.

## Key facts

- The core problem was reframed: models are stateless and don't "store" your knowledge — the real asset is your **conversation transcripts + project setup**, which live in walled gardens and are hard to own, search, or port. Engram solves data portability, not "model memory."
- Capture splits cleanly by surface: **web** (browser extension), **API** (wrapper/proxy base-URL), **desktop apps** (local HTTPS proxy — hardest, deferred).
- Robust web capture uses **network interception** (hook fetch/XHR for the provider's conversation JSON), not DOM scraping, which breaks on every UI redesign.
- A published extension must be **self-contained** (no required local daemon) and use **BYOK** (user's own API key) so the author carries no token cost or liability, and data syncs straight to the user's own GitHub/Drive — which is also the privacy selling point.
- Name availability: npm `engram` is taken by a dead package (use scoped name / `engram-kb`), engram.dev is registered, **engram.app appears available**.

## Decisions

- **Name:** Engram (neuroscience term for a memory trace).
- **Stack:** TypeScript monorepo (npm workspaces) — one language across core engine + extension.
- **Sync targets:** GitHub private repo (primary, versioned) + Google Drive mirror via rclone.
- **Trigger:** per-conversation capture + daily rollup, not hourly polling.
- **Phasing:** P1 = core engine (parse → summarize → organize → render → Git+Drive sync) runnable on exported chats; P2 = browser extension (Claude first, then ChatGPT+Gemini) shipped to Chrome Web Store; P3 = API wrapper; P4 = desktop via local proxy.
- **KB layout:** `kb/YYYY/MM/<project>/<slug>.md` with YAML front-matter (date/project/topics) + a fenced resume prompt.

## Open questions / next steps

- Run `npm install` and `npm run build` to verify the Phase-1 engine type-checks and compiles.
- Add the user's `ANTHROPIC_API_KEY` to `.env`, then `engram ingest samples/` to generate real KB entries via the live summarizer.
- Create the private GitHub repo and configure rclone for Drive, then `engram sync`.
- Begin Phase 2: browser-extension network interception for claude.ai.
- Unresolved: handling provider ToS / Chrome Web Store review for conversation-export extensions.

## Resume prompt

_Paste this into any model to pick up where you left off:_

```text
I'm building "Engram", an open-source TypeScript tool that captures my LLM conversations (Claude, ChatGPT, Gemini), summarizes each into a structured Markdown knowledge base, and syncs to a private GitHub repo + Google Drive. The goal: never lose my accumulated AI context when access is revoked or history disappears. Each KB entry ends with a paste-ready "resume prompt".

Architecture: a TS monorepo. Phase 1 (the core engine) is built: @engram/core does parse (ChatGPT export + Engram-normalized JSON) -> summarize (Anthropic, BYOK, tool-use forced JSON into a KBEntry with title/project/topics/summary/keyFacts/decisions/openQuestions/resumePrompt) -> organize (kb/YYYY/MM/project/slug.md) -> render (Markdown + YAML front-matter). @engram/cli exposes `engram ingest <path>` and `engram sync` (git push + rclone Drive mirror). Capture uses network interception, not DOM scraping. The published browser extension must be self-contained and BYOK.

Phases: P1 core engine (done), P2 browser extension starting with claude.ai network interception then ChatGPT+Gemini, shipped to Chrome Web Store, P3 API wrapper, P4 desktop apps via local HTTPS proxy.

Next step I'm working on: [FILL IN]. Help me continue from here.
```
