import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { loadConfig, type Config } from "./config.js";
import { ENV } from "./env.js";

/**
 * `engram sync`
 *   1. git add/commit/push the KB dir — a private repo is your durable,
 *      versioned backup.
 *   2. mirror the KB dir to Google Drive via rclone (if configured).
 *
 * Both steps are best-effort and independently logged; a Drive failure never
 * undoes the Git push, and vice-versa.
 */
export const syncCommand = async (_args: string[]): Promise<void> => {
  const cfg = loadConfig();
  if (!fs.existsSync(cfg.kbDir)) throw new Error(`KB dir not found: ${cfg.kbDir}`);

  syncToGit(cfg);
  syncToDrive(cfg);
};

/** Stage, commit, and push KB changes to the configured Git remote. */
const syncToGit = (cfg: Config): void => {
  if (!isGitRepo(cfg.kbDir)) {
    process.stdout.write("Not a git repo — run `git init` and add a private remote to enable Git sync.\n");
    return;
  }

  try {
    git(["add", "."], cfg.kbDir);
    if (!hasStagedChanges(cfg.kbDir)) {
      process.stdout.write("No KB changes to commit.\n");
      return;
    }
    git(["commit", "-m", `engram: sync ${timestamp()}`], cfg.kbDir);
    process.stdout.write("Committed KB changes.\n");
  } catch (e) {
    process.stderr.write(`  ! git commit step skipped: ${firstLine(e)}\n`);
    return;
  }

  if (!hasRemote(cfg.kbDir)) {
    process.stdout.write("Committed locally. No git remote set — add one to push:\n");
    process.stdout.write("    git remote add origin git@github.com:<you>/engram.git && git push -u origin main\n");
    return;
  }
  try {
    git(["push"], cfg.kbDir);
    process.stdout.write("Pushed to remote.\n");
  } catch (e) {
    process.stderr.write(`  ! git push failed: ${firstLine(e)}\n`);
  }
};

/** Mirror the KB dir to Google Drive via rclone, if a remote is configured. */
const syncToDrive = (cfg: Config): void => {
  if (!cfg.driveRemote) {
    process.stdout.write(`Drive remote not set (${ENV.driveRemote}) — skipping Drive mirror.\n`);
    return;
  }
  if (!isInstalled("rclone")) {
    process.stderr.write("  ! rclone not found on PATH — install it and run `rclone config` to enable Drive sync.\n");
    return;
  }
  const destination = `${cfg.driveRemote}:${cfg.drivePath}`;
  try {
    execFileSync("rclone", ["sync", cfg.kbDir, destination, "--fast-list"], { stdio: "inherit" });
    process.stdout.write(`Mirrored to ${destination}\n`);
  } catch (e) {
    process.stderr.write(`  ! rclone sync failed: ${firstLine(e)}\n`);
  }
};

const git = (args: string[], cwd: string): string =>
  execFileSync("git", args, { cwd, encoding: "utf8" });

const isGitRepo = (cwd: string): boolean => {
  try {
    return git(["rev-parse", "--is-inside-work-tree"], cwd).trim() === "true";
  } catch {
    return false;
  }
};

/** True if anything is staged for commit (exit 1 from `diff --cached --quiet`). */
const hasStagedChanges = (cwd: string): boolean => {
  try {
    git(["diff", "--cached", "--quiet"], cwd);
    return false;
  } catch {
    return true;
  }
};

const hasRemote = (cwd: string): boolean => {
  try {
    return git(["remote"], cwd).trim() !== "";
  } catch {
    return false;
  }
};

const isInstalled = (cmd: string): boolean => {
  try {
    execFileSync("command", ["-v", cmd], { stdio: "ignore", shell: "/bin/sh" });
    return true;
  } catch {
    return false;
  }
};

const timestamp = (): string => new Date().toISOString();

const firstLine = (e: unknown): string =>
  String((e as any)?.message ?? e).split("\n")[0] ?? "";
