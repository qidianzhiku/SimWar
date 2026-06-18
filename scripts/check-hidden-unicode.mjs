import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const dangerousCodePoints = new Map([
  [0x202a, "LEFT-TO-RIGHT EMBEDDING"],
  [0x202b, "RIGHT-TO-LEFT EMBEDDING"],
  [0x202c, "POP DIRECTIONAL FORMATTING"],
  [0x202d, "LEFT-TO-RIGHT OVERRIDE"],
  [0x202e, "RIGHT-TO-LEFT OVERRIDE"],
  [0x2066, "LEFT-TO-RIGHT ISOLATE"],
  [0x2067, "RIGHT-TO-LEFT ISOLATE"],
  [0x2068, "FIRST STRONG ISOLATE"],
  [0x2069, "POP DIRECTIONAL ISOLATE"],
  [0x200b, "ZERO WIDTH SPACE"],
  [0x200c, "ZERO WIDTH NON-JOINER"],
  [0x200d, "ZERO WIDTH JOINER"],
  [0x2060, "WORD JOINER"],
  [0xfeff, "ZERO WIDTH NO-BREAK SPACE"]
]);

const scannedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".yaml",
  ".yml",
  ".sql",
  ".md"
]);

const generatedPathFragments = [
  "/node_modules/",
  "/dist/",
  "/coverage/",
  "/.git/",
  "/.playwright-mcp/"
];

export function isScannablePath(filePath) {
  const normalized = filePath.replaceAll("\\", "/");

  if (generatedPathFragments.some((fragment) => normalized.includes(fragment))) {
    return false;
  }

  if (basename(normalized) === ".env.example") {
    return true;
  }

  return scannedExtensions.has(extname(normalized));
}

function hasUtf8Bom(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

function formatCodePoint(codePoint) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function scanBuffer(filePath, buffer) {
  const findings = [];
  const startsWithBom = hasUtf8Bom(buffer);

  if (startsWithBom) {
    findings.push({
      file: filePath,
      line: 1,
      column: 1,
      index: 0,
      codePoint: "UTF-8-BOM",
      description: "UTF-8 byte order mark"
    });
  }

  const text = buffer.toString("utf8");
  let line = 1;
  let column = 0;

  for (let index = 0; index < text.length; ) {
    const codePoint = text.codePointAt(index);
    const char = String.fromCodePoint(codePoint);

    if (startsWithBom && index === 0 && codePoint === 0xfeff) {
      index += char.length;
      continue;
    }

    if (char === "\n") {
      line += 1;
      column = 0;
      index += char.length;
      continue;
    }

    if (char === "\r") {
      index += char.length;
      continue;
    }

    column += 1;

    const description = dangerousCodePoints.get(codePoint);
    if (description) {
      findings.push({
        file: filePath,
        line,
        column,
        index,
        codePoint: formatCodePoint(codePoint),
        description
      });
    }

    index += char.length;
  }

  return findings;
}

export function scanFiles(files) {
  return files
    .filter((file) => isScannablePath(file))
    .toSorted()
    .flatMap((file) => scanBuffer(file, readFileSync(file)))
    .toSorted((left, right) => {
      if (left.file !== right.file) {
        return left.file.localeCompare(right.file);
      }

      if (left.line !== right.line) {
        return left.line - right.line;
      }

      if (left.column !== right.column) {
        return left.column - right.column;
      }

      return left.codePoint.localeCompare(right.codePoint);
    });
}

function listTrackedFiles() {
  const result = spawnSync("git", ["ls-files"], { encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error(result.stderr || "git ls-files failed");
  }

  return result.stdout.split(/\r?\n/u).filter(Boolean);
}

function formatFinding(finding) {
  return `${finding.file}: line ${finding.line}, column ${finding.column}, index ${finding.index}, ${finding.codePoint} ${finding.description}`;
}

export function runCli(args = process.argv.slice(2)) {
  let files;

  if (args[0] === "--files") {
    files = args.slice(1);
  } else if (args.length === 0) {
    files = listTrackedFiles();
  } else {
    console.error("Usage: node scripts/check-hidden-unicode.mjs [--files <path> ...]");
    return 2;
  }

  const findings = scanFiles(files);

  if (findings.length > 0) {
    console.log("Hidden Unicode control characters detected:");
    for (const finding of findings) {
      console.log(`- ${formatFinding(finding)}`);
    }
    return 1;
  }

  console.log("No hidden Unicode control characters found.");
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli();
}
