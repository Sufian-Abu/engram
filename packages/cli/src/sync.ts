import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { loadConfig } from "./config.js";

/**
 * `engram sync`
 * 1. git add/commit/push the KB dir (private repo = your durable, versioned backup)
 * 2. mirror the KB dir to Google Drive via rclone (if configured)
 *
 * Both steps are best-effort and logged; a Drive failure won't undo the Git push.
 */
export async function syncCommand(_args: string[]): Promise<void> {
  const cfg = loadConfig();
  if (!fs.existsSync(cfg.kbDir)) throw new Error(`KB dir not found: ${cfg.kbDir}`);

  const stamp = new Date().toISOString();

  // --- Git ---
  try {
    git(["add", "."], cfg.kbDir);
    const status = git(["status", "--porcelain"], cfg.kbDir).trim();
    if (status) {
      git(["commit", "-m", `engram: sync ${stamp}`], cfg.kbDir);
      process.stdout.write("Committed KB changes.\n");
      try {
        git(["push"], cfg.kbDir);
        process.stdout.write("Pushed to remote.\n");
      } catch (e: any) {
        process.stderr.write(`  ! git push failed (set a remote?): ${firstLine(e)}\n`);
      }
    } else {
      process.stdout.write("No KB changes to commit.\n");
    }
  } catch (e: any) {
    process.stderr.write(`  ! git step skipped: ${firstLine(e)}\n`);
  }

  // --- Drive (rclone) ---
  if (cfg.driveRemote) {
    try {
      execFileSync(
        "rclone",
        ["sync", cfg.kbDir, `${cfg.driveRemote}:${cfg.drivePath}`, "--fast-list"],
        { stdio: "inherit" },
      );
      process.stdout.write(`Mirrored to ${cfg.driveRemote}:${cfg.drivePath}\n`);
    } catch (e: any) {
      process.stderr.write(`  ! rclone sync failed: ${firstLine(e)}\n`);
    }
  } else {
    process.stdout.write("Drive remote not configured (ENGRAM_DRIVE_REMOTE) — skipping Drive mirror.\n");
  }
}

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function firstLine(e: any): string {
  return String(e?.message ?? e).split("\n")[0] ?? "";
}
