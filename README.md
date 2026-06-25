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

## Status

| Phase | What | State |
|---|---|---|
| **P1** | Core engine + CLI (parse → summarize → organize → render → sync) | ✅ done |
| **P2** | Browser extension — capture Claude & ChatGPT by network interception | ✅ done (Gemini pending) |
| **P3** | API wrapper / proxy (capture API-made conversations) | ⬜ next |
| **P4** | Desktop apps via local HTTPS proxy | ⬜ |

### Packages

- **`@engram/core`** — parse (Claude Code JSONL, ChatGPT export, Engram-normalized) → summarize (BYOK, forced-JSON via tool-use / function-calling) → organize → render.
- **`@engram/cli`** — `engram ingest <path>` and `engram sync`.
- **`@engram/extension`** — Manifest V3 extension that captures claude.ai & chatgpt.com conversations via `fetch` interception and exports them in Engram's normalized format. `npm run build -w @engram/extension`, then load `packages/extension/dist/` unpacked.

## Providers (BYOK — bring your own key)

Set **one** key in `.env`. Several providers are free:

| Provider | Cost | Default model | Key |
|---|---|---|---|
| Groq | **free** | `llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| Google Gemini | **free tier** | `gemini-2.0-flash` | `GEMINI_API_KEY` |
| OpenRouter | **free models** | `…llama-3.3-70b-instruct:free` | `OPENROUTER_API_KEY` |
| Anthropic | paid | `claude-sonnet-4-6` | `ANTHROPIC_API_KEY` |
| OpenAI (ChatGPT) | paid | `gpt-4o-mini` | `OPENAI_API_KEY` |

Engram auto-picks the first provider whose key is set; force one with `ENGRAM_PROVIDER`.

## Quick start

```bash
npm install
npm run build

cp .env.example .env        # add a provider key (Groq is free)

# Generate KB entries from exported / sample chats:
npm run ingest -- samples/

# Commit + push the KB to your private repo, then mirror to Drive:
npm run sync
```

### Your knowledge base lives in its *own* repo

Keep the KB out of this code repo. Create a **separate private repo** (e.g. `engram-kb`), clone it somewhere, and point Engram at it:

```bash
git clone git@github.com:<you>/engram-kb.git ~/engram-kb
export ENGRAM_KB_DIR=~/engram-kb      # or set it in .env

npm run ingest -- <your-exported-chats>
npm run sync                          # commits + pushes to engram-kb, mirrors to Drive
```

`engram sync` runs Git inside `ENGRAM_KB_DIR`, so the KB versions and pushes independently of the Engram source. (This repo gitignores `*.md` for exactly this reason — your conversations never land here.)

### Configuration (`.env`)

| Var | Purpose |
|---|---|
| `GROQ_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | BYOK key for the summarize step (set one) |
| `ENGRAM_PROVIDER` | Force a provider: `anthropic` \| `openai` \| `groq` \| `gemini` \| `openrouter` |
| `ENGRAM_MODEL` | Override the summarizer model (defaults per provider) |
| `ENGRAM_KB_DIR` | KB output dir (default `./kb`) |
| `ENGRAM_DRIVE_REMOTE` | rclone remote for Drive (optional; set up via `rclone config`) |

## Development

```bash
npm run build     # type-check + compile all packages
npm test          # Vitest suite (pure helpers + provider parsers)
```

## License

MIT
