import http from "node:http";
import { parseAny } from "@engram/core";
import { loadConfig, type Config } from "./config.js";
import { writeKbEntry } from "./writer.js";
import { syncKb } from "./sync.js";

const DEFAULT_PORT = 8765;
// Wait this long after the last capture before syncing, so a burst of captures
// becomes one commit instead of many.
const SYNC_DEBOUNCE_MS = 8000;

/**
 * `engram serve` — a local daemon the browser extension POSTs captures to, so
 * the whole flow (capture -> summarize -> write -> push) is automatic. The user
 * runs this once; opening a conversation in the browser then lands a KB note
 * and syncs it with no manual steps.
 */
export const serveCommand = async (args: string[]): Promise<void> => {
  const cfg = loadConfig();
  if (!cfg.provider || !cfg.apiKey) throw new Error(MISSING_KEY_MESSAGE);

  const port = Number(flag(args, "--port") ?? process.env.ENGRAM_SERVE_PORT ?? DEFAULT_PORT);
  const scheduleSync = makeDebouncedSync(cfg);

  const server = http.createServer((req, res) => {
    void handle(req, res, cfg, scheduleSync);
  });

  server.listen(port, () => {
    process.stdout.write(
      `engram serve on http://localhost:${port}\n` +
        `  provider: ${cfg.provider!.label} (${cfg.model})\n` +
        `  KB:       ${cfg.kbDir}\n` +
        `  Captures from the browser extension now auto-ingest and sync.\n`,
    );
  });
};

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  cfg: Config,
  scheduleSync: () => void,
): Promise<void> {
  setCors(res);
  if (req.method === "OPTIONS") return void res.writeHead(204).end();

  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { ok: true, kbDir: cfg.kbDir, provider: cfg.provider!.id });
  }

  if (req.method === "POST" && (req.url ?? "").startsWith("/capture")) {
    try {
      const conversations = parseAny(await readJson(req));
      let written = 0;
      let skipped = 0;
      for (const conv of conversations) {
        const outcome = await writeKbEntry(conv, cfg, (l) => process.stdout.write(`  ${l}\n`));
        if (outcome === "written") written++;
        else if (outcome === "skipped") skipped++;
      }
      if (written > 0) scheduleSync();
      return sendJson(res, 200, { written, skipped });
    } catch (e: any) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  res.writeHead(404).end();
}

/** Returns a function that (re)arms a single trailing-edge sync timer. */
function makeDebouncedSync(cfg: Config): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      process.stdout.write("syncing KB…\n");
      try {
        syncKb(cfg);
      } catch (e: any) {
        process.stderr.write(`  ! sync failed: ${e.message}\n`);
      }
    }, SYNC_DEBOUNCE_MS);
  };
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

// The extension's origin is chrome-extension://<id>; allow any so we don't pin
// to a specific unpacked id. The daemon only listens on localhost.
function setCors(res: http.ServerResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "POST, GET, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
}

const MISSING_KEY_MESSAGE =
  "No provider API key found. Copy .env.example to .env and set one of:\n" +
  "  GROQ_API_KEY (free)  GEMINI_API_KEY (free)  OPENROUTER_API_KEY (free)\n" +
  "  ANTHROPIC_API_KEY    OPENAI_API_KEY";
