import type { Settings } from "./settings.js";

/**
 * Minimal GitHub contents-API client: create or update a single file in the
 * user's private KB repo. The token never leaves the browser except to
 * api.github.com over HTTPS.
 */
export interface PushResult {
  ok: boolean;
  status: number;
  error?: string;
}

export async function pushFile(
  settings: Settings,
  repoPath: string,
  content: string,
  message: string,
): Promise<PushResult> {
  const [owner, repo] = settings.githubRepo.trim().split("/");
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeRepoPath(repoPath)}`;

  // Need the current blob sha to update an existing file.
  const existingSha = await getSha(api, settings.githubBranch, settings.githubToken);

  const res = await fetch(api, {
    method: "PUT",
    headers: ghHeaders(settings.githubToken),
    body: JSON.stringify({
      message,
      content: base64Utf8(content),
      branch: settings.githubBranch || "main",
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });

  if (res.ok) return { ok: true, status: res.status };
  const body = await res.text().catch(() => "");
  return { ok: false, status: res.status, error: body.slice(0, 300) };
}

async function getSha(api: string, branch: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`${api}?ref=${encodeURIComponent(branch || "main")}`, {
      headers: ghHeaders(token),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { sha?: string };
    return data.sha ?? null;
  } catch {
    return null;
  }
}

function ghHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "content-type": "application/json",
  };
}

/** Encode each path segment but keep the slashes. */
function encodeRepoPath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}

/** UTF-8 safe base64 (btoa alone mangles non-Latin1). */
function base64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
