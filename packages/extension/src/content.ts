import { ENGRAM_SOURCE, type CapturedMessage } from "./types.js";

/**
 * Runs in the ISOLATED content-script world. Two jobs:
 *   1. Inject interceptor.js into the PAGE so it can wrap the page's fetch.
 *   2. Relay the captures the interceptor postMessages back to the service
 *      worker (content scripts can talk to chrome.runtime; page scripts can't).
 */
injectInterceptor();

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data as Partial<CapturedMessage> | undefined;
  if (!data || data.source !== ENGRAM_SOURCE || data.kind !== "conversation") return;
  // After the extension reloads/updates, this old content script lingers with a
  // dead chrome.runtime; sendMessage then throws *synchronously* ("Extension
  // context invalidated"), so a .catch() alone isn't enough. Guard + try/catch.
  if (!chrome.runtime?.id) return;
  try {
    chrome.runtime.sendMessage(data).catch(() => {
      /* service worker asleep: the next capture retries */
    });
  } catch {
    /* context invalidated mid-call — the reloaded page's script takes over */
  }
});

function injectInterceptor(): void {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("interceptor.js");
  // Run before the page's own scripts so we wrap fetch in time.
  script.onload = () => script.remove();
  (document.head ?? document.documentElement).prepend(script);
}
