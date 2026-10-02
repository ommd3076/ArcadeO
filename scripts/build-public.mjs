import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { build } from "vite";

const assetPaths = fs
  .readdirSync("dist/client/assets")
  .map((name) => `/assets/${name}`)
  .sort();
const fonts = [
  "/fonts/plus-jakarta-sans-latin-variable.woff2",
  "/fonts/barlow-condensed-latin-600.woff2",
  "/fonts/barlow-condensed-latin-700.woff2",
  "/fonts/dm-mono-latin-400.woff2",
];
const manifest = JSON.parse(fs.readFileSync("dist/client/.vite/manifest.json", "utf8"));
const entryAssets = new Set();
function collectEntry(key) {
  const entry = manifest[key];
  if (!entry || !entry.file || entryAssets.has(`/${entry.file}`)) return;
  entryAssets.add(`/${entry.file}`);
  for (const css of entry.css ?? []) entryAssets.add(`/${css}`);
  for (const dependency of entry.imports ?? []) collectEntry(dependency);
}
const appEntry = manifest["index.html"];
if (!appEntry?.isEntry) throw new Error("Could not find the index.html application entry");
collectEntry("index.html");
const shellPaths = [
  "/index.html",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  ...entryAssets,
  ...fonts,
];
const publicAssets = [...shellPaths, ...assetPaths];
const hash = createHash("sha256");
for (const asset of [...new Set(publicAssets)].sort()) {
  hash
    .update(asset)
    .update("\0")
    .update(fs.readFileSync(path.join("dist/client", asset)));
}
const revision = hash.digest("hex").slice(0, 16);
await build({
  configFile: false,
  define: {
    __SHELL_ASSETS__: JSON.stringify(shellPaths),
    __PUBLIC_ASSETS__: JSON.stringify(publicAssets),
    __SHELL_REVISION__: JSON.stringify(revision),
  },
  build: {
    outDir: path.resolve("dist/client"),
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: "src/service-worker.ts",
      formats: ["iife"],
      name: "ArcadeServiceWorker",
      fileName: () => "sw.js",
    },
  },
});
if (!fs.existsSync("dist/client/sw.js")) throw new Error("Service worker was not built");
console.log("PUBLIC_SHELL_BUILT");
console.log(
  "PUBLIC_CACHE_BYTES",
  JSON.stringify({
    revision,
    precache: shellPaths.reduce(
      (sum, asset) => sum + fs.statSync(path.join("dist/client", asset)).size,
      0,
    ),
    publicAssetCount: publicAssets.length,
  }),
);
