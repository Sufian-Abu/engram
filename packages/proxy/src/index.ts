#!/usr/bin/env node
import path from "node:path";
import { createProxyServer } from "./server.js";

/**
 * `engram-proxy` — start a local capture proxy.
 *   engram-proxy [--port 8788] [--out ./.engram/api]
 *
 * Point your API client's base URL at it (your key passes straight through):
 *   Anthropic: ANTHROPIC_BASE_URL=http://localhost:8788
 *   OpenAI:    OPENAI_BASE_URL=http://localhost:8788/v1
 * Then ingest what it captures: engram ingest ./.engram/api
 */
const HELP = `engram-proxy — capture API conversations into Engram's normalized format.

Usage:
  engram-proxy [--port <n>] [--out <dir>]

Options:
  --port   Port to listen on (default 8788, or ENGRAM_PROXY_PORT)
  --out    Capture output dir (default ./.engram/api, or ENGRAM_PROXY_DIR)

Point your client's base URL at the proxy; your API key passes straight through
(never stored). Captured files are ready for: engram ingest <dir>
`;

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(HELP);
  process.exit(0);
}

const port = Number(flag("--port") ?? process.env.ENGRAM_PROXY_PORT ?? 8788);
const captureDir = path.resolve(flag("--out") ?? process.env.ENGRAM_PROXY_DIR ?? "./.engram/api");

const server = createProxyServer({ port, captureDir });
server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `engram-proxy listening on http://localhost:${port}\n` +
      `  capturing to ${captureDir}\n` +
      `  Anthropic: set ANTHROPIC_BASE_URL=http://localhost:${port}\n` +
      `  OpenAI:    set OPENAI_BASE_URL=http://localhost:${port}/v1\n` +
      `  Then: engram ingest ${captureDir}\n`,
  );
});

function flag(name: string): string | undefined {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
}
