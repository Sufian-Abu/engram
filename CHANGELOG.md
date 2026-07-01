# Changelog

All notable changes to Engram are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims
to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-07-01

First public release. Capture your LLM conversations, summarize them with your
own key, and sync the notes to storage you own.

### Added

- **Core engine (`@engram/core`)** — parse → summarize → organize → render.
  Parsers for the Engram-normalized format, ChatGPT data export, and Claude Code
  transcripts. Each conversation becomes a Markdown note with YAML front-matter,
  summary, key facts, decisions, open questions, and a paste-ready resume prompt.
- **CLI (`@engram/cli`)** — `engram ingest <path>`, `engram sync`, and
  `engram serve` (a local daemon the extension posts captures to).
- **Browser extension (`@engram/extension`)** — Manifest V3. Captures
  **Claude** and **ChatGPT** by intercepting the conversation JSON the page
  already fetches (not DOM scraping), and **Gemini** by reading the DOM
  (best-effort). Captures live as you chat. Two modes: **self-contained**
  (summarize + push to GitHub entirely in the browser) or feed the local daemon.
- **API proxy (`@engram/proxy`)** — point your Anthropic/OpenAI client's
  base URL at it to capture API conversations; your key passes straight through.
- **Multi-provider summarize (BYOK)** — Groq, Google Gemini, OpenRouter
  (all free), Anthropic, OpenAI, and **Ollama** (local, no key). Automatic
  **failover** between configured providers, provider-aware context sizing, and
  a **JSON-mode fallback** for models without tool support.
- **Sync** — commit + push to a private GitHub repo (auto-rebases) and mirror
  to Google Drive via rclone (notes only; excludes `.git`/dotfiles).
- **One-command setup** (`npm run setup`) and a login-item-ready daemon.
- **Docs** — README with architecture diagram and extension guide, `SECURITY.md`,
  MIT `LICENSE`, CI + release GitHub Actions.

### Security

- The local daemon binds to `127.0.0.1`, rejects web-page origins, and rejects
  non-loopback hosts (anti DNS-rebinding) — a visited site can't drive it.
- The API proxy pins each forwarded request to its provider's origin so a
  crafted path can't redirect your key elsewhere.
- BYOK throughout — nothing is sent to any Engram-run service.

[Unreleased]: https://github.com/Sufian-Abu/engram/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Sufian-Abu/engram/releases/tag/v0.1.0
