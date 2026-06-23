# Engram

**Your AI conversations, remembered.**

Engram captures your conversations across Claude, ChatGPT, and Gemini, distills each into a structured, portable Markdown knowledge base, and syncs it to your own **private GitHub repo** and **Google Drive**. When access is revoked, history disappears, or you switch models, your accumulated context is safe — and every entry ends with a paste-ready **resume prompt** to continue the work in *any* model.

> An *engram* is the trace a memory leaves behind. That's what this does for your chats.

## Why

LLMs are stateless — they don't store your knowledge. The real asset is your **conversation history and project context**, which lives locked inside each provider's walled garden. Bans, revoked access, deleted history, and context resets can wipe it out. Engram makes that asset yours: owned, versioned, searchable, and model-agnostic.

## How it works

```
capture (extension / export)  ->  summarize (LLM, your key)  ->  organize  ->  sync
                                                                              ├─ GitHub (private, versioned)
                                                                              └─ Google Drive (rclone mirror)
```

KB layout is date / project / topic, all at once:

```
kb/2026/06/engram/building-engram-knowledge-base-tool-444fbe21.md
   └YYYY └MM └project └slug + source id
```

Each file has YAML front-matter (`date`, `project`, `topics`) for search, a human-readable summary / key facts / decisions / open questions, and a fenced resume prompt.

## Status — Phase 1 (core engine)

Done and runnable today:

- **`@engram/core`** — parse (ChatGPT export + Engram-normalized JSON), summarize (Anthropic, BYOK, forced-JSON via tool-use), organize, render.
- **`@engram/cli`** — `engram ingest` and `engram sync`.

Roadmap: **P2** browser extension (network interception; Claude → ChatGPT → Gemini; ship to Chrome Web Store) · **P3** API wrapper · **P4** desktop apps via local HTTPS proxy.

## Quick start

```bash
npm install
npm run build

cp .env.example .env        # add your ANTHROPIC_API_KEY (BYOK)

# Generate KB entries from exported / sample chats:
npm run ingest -- samples/

# Commit + push to your private repo, then mirror to Drive:
npm run sync
```

### Configuration (`.env`)

| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Your key for the summarize step (required for `ingest`) |
| `ENGRAM_MODEL` | Summarizer model (default `claude-sonnet-4-6`) |
| `ENGRAM_KB_DIR` | KB output dir (default `./kb`) |
| `ENGRAM_DRIVE_REMOTE` | rclone remote for Drive (optional; set up via `rclone config`) |

## License

MIT
