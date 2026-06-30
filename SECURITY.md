# Security

Engram is **BYOK** (bring your own key) and local-first. It's worth understanding where your secrets live and how to minimize blast radius.

## Where credentials are stored

- **CLI / daemon** — your provider API key (and optional rclone/Drive config) live in `.env` in your local checkout. `.env` is gitignored and never committed or sent anywhere except to the provider you chose.
- **Browser extension** — keys you enter in the Options page are stored in `chrome.storage.local` (unencrypted, like all extension storage). They're sent only to the provider's API and, if you configure it, to `api.github.com`. They are never sent to the author or any third party.

## Use a fine-grained, repo-scoped GitHub token

If you let the extension push to GitHub, **do not use a classic `repo`-scoped Personal Access Token** — that grants write access to *all* your repositories. Instead create a **fine-grained token** limited to just your KB repo:

1. https://github.com/settings/tokens?type=beta → **Generate new token**
2. **Repository access** → *Only select repositories* → pick your `engram-kb` repo
3. **Permissions** → *Repository permissions* → **Contents: Read and write** (nothing else)
4. Set a short expiry and rotate it periodically

That token can only read/write the one private repo, so a leak can't touch anything else.

## What Engram sends, and to whom

- Conversation transcripts → **only** the LLM provider you configured (for the summarize step), using your key.
- KB notes → **only** your own GitHub repo and/or Google Drive.
- Nothing goes to the project author or any analytics/telemetry. There is none.

## The local daemon

`engram serve` listens on `127.0.0.1` only and accepts requests **only** from the browser extension or local tools — never from a web page. It rejects any request carrying a browser (`http(s)://`) `Origin`, and rejects any non-loopback `Host` (so DNS-rebinding can't reach it). This prevents a site you visit from driving the daemon to spend your API key, write notes, or push to your repo. The API proxy similarly pins each forwarded request to its provider's origin, so a crafted path can't redirect your key to another host.

## Unofficial provider endpoints

Web capture works by reading the conversation JSON that claude.ai / chatgpt.com already fetch (and, for Gemini, by reading the page DOM). These are **unofficial, undocumented interfaces** that can change at any time and break capture. Engram never automates sending messages or any account action — it only reads conversations you open.

## Reporting a vulnerability

Please open a private security advisory on the GitHub repo (Security → *Report a vulnerability*) rather than a public issue.
