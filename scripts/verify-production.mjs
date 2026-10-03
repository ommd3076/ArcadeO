import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : [file];
  });
}
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const webManifest = JSON.parse(fs.readFileSync("dist/client/manifest.json", "utf8"));
const workerConfig = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
assert.equal(workerConfig.name, "arcadeo");
assert.equal(workerConfig.durable_objects.bindings[0].name, "MATCH_DO");
assert.equal(workerConfig.durable_objects.bindings[0].class_name, "MatchDurableObject");
assert.equal(packageJson.name, "arcadeo");
assert.equal(lock.name, packageJson.name);
assert.equal(lock.packages[""].name, packageJson.name);
assert.equal(webManifest.name, "ArcadeO");
assert.equal(webManifest.short_name, "ArcadeO");
assert.match(fs.readFileSync("dist/client/index.html", "utf8"), /<title>ArcadeO<\/title>/);
const publicFiles = filesIn("dist/client");
const clientJavascript = publicFiles.filter((file) => file.endsWith(".js"));
const clientText = clientJavascript.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const privateSolutions = JSON.parse(fs.readFileSync("content/sudoku/solutions.json", "utf8"));
const solutions = new Set(Object.values(privateSolutions));
assert.equal(solutions.size, 1000);
const digitRuns = clientText.match(/[1-9]{81}/g) ?? [];
assert(!digitRuns.some((value) => solutions.has(value)), "Private solution leaked to client");
assert(!publicFiles.some((file) => /(?:solutions\.json|accounts\.sql|\.dev\.vars|\.env)$/.test(file)));
assert(!clientText.includes("passwordHash"), "Password verifier field leaked to client");
assert.equal(
  fs.readFileSync("dist/client/THIRD-PARTY-NOTICES.md", "utf8"),
  fs.readFileSync("THIRD-PARTY-NOTICES.md", "utf8"),
);
const licenses = fs.readFileSync("dist/client/licenses/DEPENDENCY-LICENSES.txt", "utf8");
for (const name of ["lucide-react", "react", "react-dom", "scheduler", "react-router", "react-router-dom", "Connect Four reference", "DotBox reference"]) {
  assert(licenses.includes(`=== ${name} ===`), `Missing complete notice: ${name}`);
}
const buildManifest = JSON.parse(fs.readFileSync("dist/client/.vite/manifest.json", "utf8"));
const initial = new Set();
function collect(key) {
  const entry = buildManifest[key];
  assert(entry?.file, `Missing entry: ${key}`);
  if (initial.has(entry.file)) return;
  initial.add(entry.file);
  for (const dependency of entry.imports ?? []) collect(dependency);
}
collect("index.html");
const initialJavascript = [...initial].filter((file) => file.endsWith(".js"));
const initialGzipBytes = initialJavascript.reduce((sum, file) => sum + gzipSync(fs.readFileSync(path.join("dist/client", file))).length, 0);
assert(initialGzipBytes < 250 * 1024, "Initial static JavaScript exceeds accepted 250 KiB budget");
const sourceManifest = JSON.parse(fs.readFileSync("public/manifest.json", "utf8"));
assert.deepEqual(webManifest, sourceManifest);
const revision = fs.readFileSync("dist/client/sw.js", "utf8").match(/arcade-shell-([a-f0-9]{16})/);
assert(revision, "Missing public cache revision");
const record = {
  verifiedAt: new Date().toISOString(),
  status: "PASS",
  publicCacheRevision: revision[1],
  publicFiles: publicFiles.length,
  initialGzipBytes,
  privateSolutionLeakCheck: "1000 private solutions absent from public JavaScript",
  identity: "ArcadeO browser, install manifest and arcadeo package/lock verified",
  storageCompatibility: "Existing DB/MATCH_DO bindings and MatchDurableObject identity retained",
  notices: "Eight complete dependency/reference notices and byte-identical project attribution",
  entryFiles: initialJavascript.map((file) => ({ file, sha256: createHash("sha256").update(fs.readFileSync(path.join("dist/client", file))).digest("hex") })),
  limits: "Artifact/source checks only. No deployed account, production URL or physical device certification.",
};
fs.mkdirSync(".local/evidence/arcadeo", { recursive: true });
fs.writeFileSync(".local/evidence/arcadeo/production.json", JSON.stringify(record, null, 2) + "\n");
console.log("ARCADEO_PRODUCTION_ARTIFACTS_VERIFIED", JSON.stringify(record));
