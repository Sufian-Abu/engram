#!/usr/bin/env node
import { ingestCommand } from "./ingest.js";
import { syncCommand } from "./sync.js";

const HELP = `engram — your AI conversations, remembered.

Usage:
  engram ingest <path>        Parse exported chats (file or dir) -> summarize -> write KB
  engram sync                 Commit + push the KB to Git, then mirror to Google Drive
  engram --help               Show this help

Provider keys (BYOK — set ONE in .env; several are free):
  GROQ_API_KEY                Groq (free, fast)            OPENAI_API_KEY    OpenAI / ChatGPT
  GEMINI_API_KEY              Google Gemini (free tier)    ANTHROPIC_API_KEY Claude
  OPENROUTER_API_KEY          OpenRouter (free models)

Other environment (see .env.example):
  ENGRAM_PROVIDER             Force a provider: anthropic | openai | groq | gemini | openrouter
  ENGRAM_MODEL                Override the summarizer model (defaults per provider)
  ENGRAM_KB_DIR               KB output dir (default ./kb)
  ENGRAM_DRIVE_REMOTE         rclone remote for Google Drive mirror (optional)
`;

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  ingest: ingestCommand,
  sync: syncCommand,
};

const main = async (): Promise<void> => {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === undefined || cmd === "--help" || cmd === "-h" || cmd === "help") {
    process.stdout.write(HELP);
    return;
  }

  const command = COMMANDS[cmd];
  if (!command) {
    process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
    process.exit(1);
  }
  await command(rest);
};

main().catch((err) => {
  process.stderr.write(`\nError: ${err?.message ?? err}\n`);
  process.exit(1);
});
