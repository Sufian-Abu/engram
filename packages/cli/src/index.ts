#!/usr/bin/env node
import { ingestCommand } from "./ingest.js";
import { syncCommand } from "./sync.js";

const HELP = `engram — your AI conversations, remembered.

Usage:
  engram ingest <path>        Parse exported chats (file or dir) -> summarize -> write KB
  engram sync                 Commit + push the KB to Git, then mirror to Google Drive
  engram --help               Show this help

Environment (see .env.example):
  ANTHROPIC_API_KEY   BYOK key for the summarize step (required for ingest)
  ENGRAM_MODEL        Summarizer model (default claude-sonnet-4-6)
  ENGRAM_KB_DIR       KB output dir (default ./kb)
  ENGRAM_DRIVE_REMOTE rclone remote for Drive (optional)
`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "ingest":
      await ingestCommand(rest);
      break;
    case "sync":
      await syncCommand(rest);
      break;
    case undefined:
    case "--help":
    case "-h":
    case "help":
      process.stdout.write(HELP);
      break;
    default:
      process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
      process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`\nError: ${err?.message ?? err}\n`);
  process.exit(1);
});
