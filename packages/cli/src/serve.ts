import http from "node:http";
import { parseAny } from "@engram/core";
import { loadConfig, MISSING_KEY_MESSAGE, type Config } from "./config.js";
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
  if (cfg.chain.length === 0) throw new Error(MISSING_KEY_MESSAGE);

  const port = Number(flag(args, "--port") ?? process.env.ENGRAM_SERVE_PORT ?? DEFAULT_PORT);
  const scheduleSync = makeDebouncedSync(cfg);

  const server = http.createServer((req, res) => {
    void handle(req, res, cfg, scheduleSync);
  });

  server.listen(port, "127.0.0.1", () => {
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
  // Only the extension (or a local tool) may drive the daemon — never a web
  // page. Otherwise any site you visit could POST a conversation and make the
  // daemon spend your API key, write KB notes, and push to your repo. A page's
  // fetch always carries an http(s) Origin; we reject those, and reject any
  // non-loopback Host (anti DNS-rebinding). See SECURITY.md.
  if (!isLoopbackHost(req) || isWebOrigin(req)) {
    res.writeHead(403).end();
    return;
  }
  setCors(req, res);
  if (req.method === "OPTIONS") return void res.writeHead(204).end();

  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { ok: true, kbDir: cfg.kbDir, provider: cfg.provider!.id });
  }

  if (req.method === "POST" && (req.url ?? "").startsWith("/capture")) {
    try {
      const conversations = parseAny(await readJson(req));
      let changed = 0;
      let skipped = 0;
      for (const conv of conversations) {
        const outcome = await writeKbEntry(conv, cfg, (l) => process.stdout.write(`  ${l}\n`));
        if (outcome === "written" || outcome === "updated") changed++;
        else if (outcome === "skipped") skipped++;
      }
      if (changed > 0) scheduleSync();
      return sendJson(res, 200, { changed, skipped });
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

// Echo only an extension origin back — never reflect a web page's origin.
// (The extension can read responses anyway via host_permissions; this just
// avoids handing CORS access to anything else.)
function setCors(req: http.IncomingMessage, res: http.ServerResponse): void {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.startsWith("chrome-extension://")) {
    res.setHeader("access-control-allow-origin", origin);
  }
  res.setHeader("access-control-allow-methods", "POST, GET, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
}

/** Reject anything whose Host isn't loopback (defends against DNS rebinding). */
function isLoopbackHost(req: http.IncomingMessage): boolean {
  const host = (req.headers.host ?? "").split(":")[0]!.toLowerCase();
  return host === "" || host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}

/** A browser page's fetch always carries an http(s) Origin; the extension doesn't. */
function isWebOrigin(req: http.IncomingMessage): boolean {
  const origin = req.headers.origin;
  return typeof origin === "string" && /^https?:/i.test(origin);
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
}
