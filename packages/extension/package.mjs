// Build + zip dist/ into an upload-ready Chrome Web Store package.
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const zipName = `engram-extension-v${version}.zip`;

execFileSync("node", ["build.mjs"], { stdio: "inherit" });

rmSync(zipName, { force: true });
// Zip the *contents* of dist/ (manifest.json must be at the archive root).
execFileSync("zip", ["-qr", `../${zipName}`, "."], { cwd: "dist", stdio: "inherit" });

console.log(`\nPackaged ${zipName} — upload at https://chrome.google.com/webstore/devconsole`);
