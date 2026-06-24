import { context, build } from "esbuild";
import { cp, mkdir } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const pkg = process.argv.includes("--package"); // store build: no sourcemap

const options = {
  entryPoints: { content: "src/content/index.ts" },
  bundle: true,
  format: "iife",
  target: "chrome110",
  outdir: "dist",
  sourcemap: !pkg,
  logLevel: "info",
};

await mkdir("dist", { recursive: true });
await cp("manifest.json", "dist/manifest.json");

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("watching… (manifest.json is copied once; re-run build if it changes)");
} else {
  await build(options);
  console.log(`built -> dist/  (load this folder as an unpacked extension)`);
}
