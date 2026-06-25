import esbuild from "esbuild";
import { copyFile, mkdir, cp } from "node:fs/promises";

const watch = process.argv.includes("--watch");

// Each entry is bundled as a self-contained IIFE: content scripts and injected
// page scripts can't be ES modules, and the service worker doesn't need to be.
const options = {
  entryPoints: [
    "src/background.ts",
    "src/content.ts",
    "src/interceptor.ts",
    "src/popup.ts",
  ],
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome110",
  logLevel: "info",
};

const copyStatic = async () => {
  await mkdir("dist", { recursive: true });
  await copyFile("manifest.json", "dist/manifest.json");
  await copyFile("src/popup.html", "dist/popup.html");
  await cp("icons", "dist/icons", { recursive: true });
};

await copyStatic();

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("watching… (manifest/popup.html copied once; re-run for static changes)");
} else {
  await esbuild.build(options);
}
