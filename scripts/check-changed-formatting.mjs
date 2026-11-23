import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";

const SUPPORTED_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml"
]);

const IGNORED_SEGMENTS = new Set(["coverage", "dist", "node_modules"]);
const ZERO_SHA = /^0+$/;

export function parseArgs(argv) {
  let baseSha = process.env.PR4_BASE_SHA?.trim() ?? "";
  let headSha = "HEAD";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base-sha" && i + 1 < argv.length) {
      baseSha = argv[i + 1].trim();
      i += 1;
    } else if (arg === "--head-sha" && i + 1 < argv.length) {
      headSha = argv[i + 1].trim();
      i += 1;
    }
  }
  return { baseSha, headSha };
}

export function isPrettierCandidate(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  if (
    !normalized ||
    normalized === "package-lock.json" ||
    normalized.endsWith("/package-lock.json")
  ) {
    return false;
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => IGNORED_SEGMENTS.has(segment))) {
    return false;
  }
  return SUPPORTED_EXTENSIONS.has(extname(normalized).toLowerCase());
}

export function listChangedPrettierFiles(baseSha, headSha, cwd = process.cwd()) {
  const stdout = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", baseSha, headSha],
    { cwd, encoding: "utf8" }
  );
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((filePath) => isPrettierCandidate(filePath) && existsSync(resolve(cwd, filePath)));
}

function main() {
  const { baseSha, headSha } = parseArgs(process.argv.slice(2));
  if (!baseSha || ZERO_SHA.test(baseSha)) {
    console.log("No non-zero base SHA provided; skipping changed-file Prettier check.");
    return;
  }

  const changedFiles = listChangedPrettierFiles(baseSha, headSha);
  if (changedFiles.length === 0) {
    console.log(`No Prettier-eligible changed files between ${baseSha} and ${headSha}.`);
    return;
  }

  const prettierBin = resolve(process.cwd(), "node_modules", "prettier", "bin", "prettier.cjs");
  if (!existsSync(prettierBin)) {
    throw new Error(`Prettier CLI not found at ${prettierBin}`);
  }

  console.log(`Checking Prettier formatting on ${changedFiles.length} changed file(s)...`);
  execFileSync(process.execPath, [prettierBin, "--check", "--", ...changedFiles], {
    cwd: process.cwd(),
    stdio: "inherit"
  });
}

if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("check-changed-formatting.mjs")
) {
  main();
}
