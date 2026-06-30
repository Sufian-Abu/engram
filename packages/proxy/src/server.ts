import http from "node:http";
import { matchRoute, type ApiRoute } from "./providers.js";
import { extractConversation, writeCapture } from "./capture.js";

export interface ProxyOptions {
  port: number;
  /** Directory where captured normalized conversations are written. */
  captureDir: string;
  /** Optional log sink (defaults to stdout). */
  log?: (line: string) => void;
}

// Headers we must not forward verbatim: fetch sets host/length itself, and it
// decodes the body so upstream content-encoding/length no longer apply.
const DROP_REQUEST_HEADERS = new Set(["host", "content-length", "connection"]);
const DROP_RESPONSE_HEADERS = new Set(["content-encoding", "content-length", "transfer-encoding", "connection"]);

export function createProxyServer(opts: ProxyOptions): http.Server {
  const log = opts.log ?? ((l: string) => process.stdout.write(l + "\n"));

  return http.createServer(async (req, res) => {
    const path = req.url ?? "/";
    const route = matchRoute(path);
    const body = await readBody(req);

    if (!route) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end(`engram-proxy: no route for ${path}\n`);
      return;
    }

    // Resolve the target safely and confirm it stays on the route's upstream
    // origin. We forward the user's API key, so a crafted path (e.g. "//evil"
    // or "/../@host") must never redirect it to another host.
    const target = resolveUpstream(route.upstreamBase, path);
    if (!target) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end(`engram-proxy: refusing to forward off-origin path ${path}\n`);
      return;
    }

    let upstream: Response;
    try {
      upstream = await fetch(target, {
        method: req.method,
        headers: forwardableHeaders(req.headers),
        body: body.length ? body : undefined,
      });
    } catch (e) {
      res.writeHead(502, { "content-type": "text/plain" });
      res.end(`engram-proxy upstream error: ${(e as Error).message}\n`);
      return;
    }

    const responseHeaders = copyResponseHeaders(upstream.headers);
    const isJson = (upstream.headers.get("content-type") ?? "").includes("application/json");

    if (isJson) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, responseHeaders);
      res.end(buf);
      capture(route, body, buf, opts.captureDir, log);
    } else {
      // Streaming (e.g. SSE): pipe through untouched, capture request history.
      res.writeHead(upstream.status, responseHeaders);
      if (upstream.body) {
        for await (const chunk of upstream.body as AsyncIterable<Uint8Array>) res.write(chunk);
      }
      res.end();
      capture(route, body, null, opts.captureDir, log);
    }
  });
}

function capture(
  route: ApiRoute,
  requestBody: Buffer,
  responseBody: Buffer | null,
  dir: string,
  log: (l: string) => void,
): void {
  try {
    const request = requestBody.length ? JSON.parse(requestBody.toString("utf8")) : {};
    const response = responseBody ? JSON.parse(responseBody.toString("utf8")) : {};
    const conv = extractConversation(route, request, response);
    if (!conv) return;
    writeCapture(conv, dir);
    log(`captured ${conv.provider} conversation ${conv.id} (${conv.messages.length} messages)`);
  } catch {
    /* malformed JSON or partial stream: skip this capture */
  }
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Join base + path, returning the URL only if it stays on the base's origin. */
function resolveUpstream(upstreamBase: string, path: string): string | null {
  try {
    const base = new URL(upstreamBase);
    const url = new URL(path.replace(/^\/+/, "/"), base);
    return url.origin === base.origin ? url.toString() : null;
  } catch {
    return null;
  }
}

function forwardableHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (DROP_REQUEST_HEADERS.has(key) || value === undefined) continue;
    out[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
}

function copyResponseHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (!DROP_RESPONSE_HEADERS.has(key)) out[key] = value;
  });
  return out;
}
