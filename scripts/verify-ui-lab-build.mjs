import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const labRoot = resolve(repositoryRoot, "packages/ui/dist/lab");
const indexPath = resolve(labRoot, "index.html");

if (!existsSync(indexPath)) {
  throw new Error(`UI lab build is missing: ${indexPath}`);
}

const indexSource = readFileSync(indexPath, "utf8");
const assetRefs = [...indexSource.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(
  ([, reference]) => reference
);

if (assetRefs.length === 0) {
  throw new Error("UI lab build does not reference any local assets");
}

for (const reference of assetRefs) {
  if (!reference.startsWith("./assets/")) {
    throw new Error(`UI lab build contains a non-local asset reference: ${reference}`);
  }

  const assetPath = resolve(labRoot, reference);
  const relativeAssetPath = relative(labRoot, assetPath);
  if (isAbsolute(relativeAssetPath) || relativeAssetPath.startsWith("..")) {
    throw new Error(`UI lab asset escapes the bounded output: ${reference}`);
  }
  if (!existsSync(assetPath)) {
    throw new Error(`UI lab asset is missing: ${assetPath}`);
  }
}

if (/https?:\/\//i.test(indexSource)) {
  throw new Error("UI lab HTML contains an external URL");
}

console.log(`UI lab build verified: ${assetRefs.length} local assets`);
