import { ENGRAM_SOURCE, type CapturedMessage } from "./types.js";

/**
 * Runs in the ISOLATED content-script world. Two jobs:
 *   1. Inject interceptor.js into the PAGE so it can wrap the page's fetch.
 *   2. Relay the captures the interceptor postMessages back to the service
 *      worker (content scripts can talk to chrome.runtime; page scripts can't).
 */
console.debug("[engram] content script active on", location.host);
injectInterceptor();

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data as Partial<CapturedMessage> | undefined;
  if (!data || data.source !== ENGRAM_SOURCE || data.kind !== "conversation") return;
  // After the extension reloads/updates, this stale content script's context is
  // dead and *any* chrome.runtime access throws synchronously ("Extension
  // context invalidated") — even reading chrome.runtime.id. So the whole call
  // sits inside try/catch; the page's freshly-injected script takes over.
  try {
    chrome.runtime.sendMessage(data).catch(() => {
      /* service worker asleep: the next capture retries */
    });
  } catch {
    /* stale tab after an extension reload — reload the page to re-capture */
  }
});

function injectInterceptor(): void {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("interceptor.js");
  // Run before the page's own scripts so we wrap fetch in time.
  script.onload = () => script.remove();
  (document.head ?? document.documentElement).prepend(script);
}
