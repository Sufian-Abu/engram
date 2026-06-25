// One-command onboarding: `npm run setup`.
// Creates .env, a local KB git repo, builds the extension, and tells the user
// the one thing left to do (paste a free key). No external deps.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

const KEY_VARS = ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"];

console.log("Engram setup\n");

// 1. .env
if (!fs.existsSync(envPath)) {
  fs.copyFileSync(examplePath, envPath);
  console.log("✓ created .env");
} else {
  console.log("✓ .env already exists");
}

// 2. KB repo — default to ~/engram-kb unless the user already pointed elsewhere.
const env = readEnv();
let kbDir = env.ENGRAM_KB_DIR;
if (!kbDir || kbDir === "./kb") {
  kbDir = path.join(os.homedir(), "engram-kb");
  setEnvVar("ENGRAM_KB_DIR", kbDir);
}
fs.mkdirSync(kbDir, { recursive: true });
if (!fs.existsSync(path.join(kbDir, ".git"))) {
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: kbDir });
  if (!fs.existsSync(path.join(kbDir, "README.md"))) {
    fs.writeFileSync(path.join(kbDir, "README.md"), "# My Engram knowledge base\n\nAuto-generated notes from my AI conversations.\n");
  }
  console.log(`✓ initialized KB repo at ${kbDir}`);
} else {
  console.log(`✓ KB repo at ${kbDir}`);
}

// 3. build the extension so dist/ is ready to load
try {
  execFileSync("npm", ["run", "build", "-w", "@engram/extension"], { cwd: root, stdio: "ignore" });
  console.log(`✓ built extension → ${path.join("packages", "extension", "dist")}`);
} catch {
  console.log("! extension build skipped (run `npm install` first)");
}

// 4. what's left
const hasKey = KEY_VARS.some((k) => readEnv()[k]);
console.log("\nNext:");
if (!hasKey) {
  console.log("  1. Get a FREE key at https://console.groq.com/keys");
  console.log("     and paste it into .env:   GROQ_API_KEY=gsk_...");
  console.log("  2. npm start                 # start the auto-capture daemon");
} else {
  console.log("  1. npm start                 # start the auto-capture daemon");
}
console.log("  → Load the extension: chrome://extensions → Developer mode → Load unpacked");
console.log(`     → select ${path.join(root, "packages", "extension", "dist")}`);
console.log("\n  (Optional) back up to GitHub: create a private repo, then");
console.log(`     git -C ${kbDir} remote add origin <url> && git -C ${kbDir} push -u origin main`);

// --- tiny .env helpers (no deps) ---
function readEnv() {
  const map = {};
  if (!fs.existsSync(envPath)) return map;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    let v = t.slice(eq + 1);
    const c = v.match(/(^|\s)#/);
    if (c) v = v.slice(0, c.index);
    const val = v.trim();
    if (val) map[t.slice(0, eq).trim()] = val;
  }
  return map;
}

function setEnvVar(key, value) {
  const lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").split("\n") : [];
  let found = false;
  const next = lines.map((l) => {
    if (l.trim().startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return l;
  });
  if (!found) next.push(`${key}=${value}`);
  fs.writeFileSync(envPath, next.join("\n"));
}
