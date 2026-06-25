import { isConversationUrl } from "./claude-web.js";
import { ENGRAM_SOURCE, type CapturedMessage } from "./types.js";

/**
 * Runs in the PAGE (MAIN world) so it can see claude.ai's own fetch calls.
 * We wrap fetch, let the real call proceed untouched, and on a single-
 * conversation response we clone it (never consuming the page's body) and
 * postMessage the raw JSON out to the content script. Network interception
 * beats DOM scraping: it survives UI redesigns and gets the full transcript.
 */
const originalFetch = window.fetch;

window.fetch = async function patchedFetch(...args): Promise<Response> {
  const response = await originalFetch.apply(this, args);
  try {
    const url = requestUrl(args[0]);
    if (url && isConversationUrl(url)) {
      // Clone first — reading the body of the original would starve the page.
      response
        .clone()
        .json()
        .then((payload) => postCapture(payload))
        .catch(() => {
          /* non-JSON or already-consumed clone: ignore */
        });
    }
  } catch {
    /* never let capture break the page's request */
  }
  return response;
};

function requestUrl(input: unknown): string | null {
  if (typeof input === "string") return input;
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.href;
  return null;
}

function postCapture(payload: unknown): void {
  const message: CapturedMessage = {
    source: ENGRAM_SOURCE,
    kind: "conversation",
    provider: "claude",
    payload,
  };
  window.postMessage(message, window.location.origin);
}
