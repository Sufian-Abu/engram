import { matchProvider, matchSend } from "./providers/index.js";
import { ENGRAM_SOURCE, type CapturedMessage, type ProviderId } from "./types.js";

/**
 * Runs in the PAGE (MAIN world) so it can see the site's own fetch calls.
 * Two jobs:
 *   1. When the page fetches a conversation, clone the response and post the
 *      raw JSON out (the capture path).
 *   2. When the page *sends a message*, wait for the reply to finish, then
 *      re-fetch the conversation ourselves — so a brand-new chat is captured
 *      live, without the user reloading the tab.
 * Network interception beats DOM scraping: it survives UI redesigns and gets
 * the full transcript.
 */
const originalFetch = window.fetch;

window.fetch = async function patchedFetch(...args): Promise<Response> {
  const response = await originalFetch.apply(this, args);
  try {
    const url = requestUrl(args[0]);
    if (url) {
      const provider = matchProvider(url);
      if (provider) {
        console.debug("[engram] intercepted", provider, "conversation fetch:", url);
        captureFrom(provider, response.clone());
      } else {
        const send = matchSend(url);
        if (send) void recaptureAfterReply(response.clone(), send.provider, send.conversationUrl);
      }
    }
  } catch {
    /* never let capture break the page's request */
  }
  return response;
};

/** Read a conversation response and post it to the content script. */
function captureFrom(provider: ProviderId, response: Response): void {
  response
    .json()
    .then((payload) => postCapture(provider, payload))
    .catch(() => {
      /* non-JSON or already-consumed clone: ignore */
    });
}

/**
 * Drain our private clone of the reply stream to learn when the assistant
 * finished, then re-pull the conversation so the new turn is captured.
 */
async function recaptureAfterReply(
  reply: Response,
  provider: ProviderId,
  conversationUrl: string,
): Promise<void> {
  try {
    const reader = reply.body?.getReader();
    if (reader) for (;;) if ((await reader.read()).done) break;
  } catch {
    /* ignore */
  }
  try {
    await new Promise((r) => setTimeout(r, 800)); // let the server persist the turn
    const conv = await originalFetch(conversationUrl, { credentials: "include" });
    if (conv.ok) {
      console.debug("[engram] re-captured", provider, "after reply:", conversationUrl);
      postCapture(provider, await conv.json());
    }
  } catch {
    /* re-fetch failed (auth/params); the next load will still capture */
  }
}

function requestUrl(input: unknown): string | null {
  if (typeof input === "string") return input;
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.href;
  return null;
}

function postCapture(provider: ProviderId, payload: unknown): void {
  const message: CapturedMessage = {
    source: ENGRAM_SOURCE,
    kind: "conversation",
    provider,
    payload,
  };
  window.postMessage(message, window.location.origin);
}
