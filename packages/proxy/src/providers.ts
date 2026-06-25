import type { Provider } from "@engram/core";

/**
 * One proxy serves both APIs by routing on the request path. The upstream base
 * is overridable so you can point it at a compatible endpoint (e.g. Groq's
 * OpenAI-compatible API) for testing without an OpenAI key.
 */
export interface ApiRoute {
  /** Path prefix this route matches (e.g. "/v1/messages"). */
  pathPrefix: string;
  /** Normalized provider id written into the captured conversation. */
  provider: Provider;
  /** Upstream origin (no trailing slash) the request is forwarded to. */
  upstreamBase: string;
  /** API shape, for message/response extraction. */
  shape: "anthropic" | "openai";
}

const env = (name: string, fallback: string): string => {
  const v = process.env[name]?.trim();
  return v ? v.replace(/\/$/, "") : fallback;
};

/** Routing table, evaluated in order; first matching pathPrefix wins. */
export const routes = (): ApiRoute[] => [
  {
    pathPrefix: "/v1/messages",
    provider: "claude",
    upstreamBase: env("ENGRAM_PROXY_ANTHROPIC_URL", "https://api.anthropic.com"),
    shape: "anthropic",
  },
  {
    pathPrefix: "/v1/chat/completions",
    provider: "chatgpt",
    upstreamBase: env("ENGRAM_PROXY_OPENAI_URL", "https://api.openai.com"),
    shape: "openai",
  },
];

export const matchRoute = (path: string): ApiRoute | null =>
  routes().find((r) => path.startsWith(r.pathPrefix)) ?? null;
