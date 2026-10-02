import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { build } from "vite";

const assetPaths = fs.readdirSync("dist/client/assets").map((name) => `/assets/${name}`);
const fonts = [400, 500, 600].map((weight) => `/fonts/dm-sans-latin-${weight}.woff2`);
const manifest = JSON.parse(fs.readFileSync("dist/client/.vite/manifest.json", "utf8"));
const entryAssets = new Set();
function collectEntry(key) {
  const entry = manifest[key];
  if (entryAssets.has(`/${entry.file}`)) return;
  entryAssets.add(`/${entry.file}`);
  for (const css of entry.css ?? []) entryAssets.add(`/${css}`);
  for (const dependency of entry.imports ?? []) collectEntry(dependency);
}
for (const [key, entry] of Object.entries(manifest)) if (entry.isEntry) collectEntry(key);
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
for (const asset of shellPaths)
  hash.update(asset).update(fs.readFileSync(path.join("dist/client", asset)));
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
    precache: shellPaths.reduce(
      (sum, asset) => sum + fs.statSync(path.join("dist/client", asset)).size,
      0,
    ),
    publicAssetCount: publicAssets.length,
  }),
);
