import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const defaultManifestPath = "scripts/direct-store-boundary-manifest.json";
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs"]);
const mutatingMethods = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "copyWithin",
  "fill"
]);

function normalizePath(path) {
  return path.replaceAll("\\", "/");
}

function relativePath(root, path) {
  return normalizePath(relative(root, path));
}

function parseArgs(args) {
  const options = {
    root: process.cwd(),
    manifest: defaultManifestPath,
    files: null
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--root") {
      options.root = resolve(args[++index]);
    } else if (arg === "--manifest") {
      options.manifest = args[++index];
    } else if (arg === "--files") {
      options.files = args.slice(index + 1);
      break;
    } else {
      throw new Error(
        "Usage: node scripts/check-direct-store-boundaries.mjs [--root <path>] [--manifest <path>] [--files <path> ...]"
      );
    }
  }

  options.root = resolve(options.root);
  options.manifest = resolve(options.root, options.manifest);
  return options;
}

function listTrackedFiles(root) {
  const result = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || "git ls-files failed");
  }
  return result.stdout.split(/\r?\n/u).filter(Boolean);
}

function classifyPath(file) {
  const normalized = normalizePath(file);

  if (
    normalized.includes("/node_modules/") ||
    normalized.startsWith("node_modules/") ||
    normalized.startsWith("dist/") ||
    normalized.startsWith("coverage/") ||
    normalized.startsWith(".git/") ||
    normalized.startsWith(".codegraph/")
  ) {
    return "excluded-non-runtime-path";
  }

  if (normalized.startsWith("tests/")) {
    return "test-only";
  }

  if (
    normalized.startsWith("scripts/") &&
    normalized !== "scripts/check-direct-store-boundaries.mjs"
  ) {
    return "script-only";
  }

  if (normalized.startsWith("docs/")) {
    return "docs-only";
  }

  if (normalized.startsWith("contracts/")) {
    return "fixture-only";
  }

  if (normalized === "services/api/src/store.ts") {
    return "runtime-bootstrap";
  }

  if (
    normalized === "services/api/src/json-repository-adapter.ts" ||
    normalized === "services/api/src/postgres-repository-adapter.ts"
  ) {
    return "adapter-only";
  }

  return "active runtime";
}

function hasSourceExtension(file) {
  return [...sourceExtensions].some((extension) => file.endsWith(extension));
}

function chain(node) {
  if (ts.isIdentifier(node)) {
    return node.text;
  }
  if (node.kind === ts.SyntaxKind.ThisKeyword) {
    return "this";
  }
  if (ts.isPropertyAccessExpression(node)) {
    return `${chain(node.expression)}.${node.name.text}`;
  }
  if (ts.isElementAccessExpression(node)) {
    return `${chain(node.expression)}[]`;
  }
  return node.getText();
}

function isDirectStoreExpression(expression) {
  return (
    expression === "runtime.store" ||
    expression.startsWith("runtime.store.") ||
    expression === "context.runtime.store" ||
    expression.startsWith("context.runtime.store.") ||
    expression === "this.runtime.store" ||
    expression.startsWith("this.runtime.store.") ||
    expression === "store" ||
    expression.startsWith("store.")
  );
}

function shouldScanStoreIdentifier(file, expression) {
  if (!expression.startsWith("store")) {
    return true;
  }
  return normalizePath(file).startsWith("services/api/src/");
}

function isNestedInStorePropertyAccess(node) {
  return (
    ts.isPropertyAccessExpression(node.parent) &&
    node.parent.expression === node &&
    isDirectStoreExpression(chain(node.parent))
  );
}

function isPostCallPropertyAccess(node) {
  return ts.isCallExpression(node.expression);
}

function symbolName(node) {
  let current = node;
  while (current) {
    if (
      (ts.isFunctionDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isMethodDeclaration(current)) &&
      current.name
    ) {
      return current.name.getText();
    }

    if (ts.isArrowFunction(current)) {
      if (ts.isVariableDeclaration(current.parent) && current.parent.name) {
        return current.parent.name.getText();
      }
      return "<arrow>";
    }

    if (ts.isSourceFile(current)) {
      return "<module>";
    }

    current = current.parent;
  }

  return "<unknown>";
}

function accessKind(node, expression) {
  const methodName = expression.split(".").at(-1);
  if (mutatingMethods.has(methodName)) {
    return "write";
  }

  const parent = node.parent;
  if (
    ts.isBinaryExpression(parent) &&
    parent.left === node &&
    parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  ) {
    return "write";
  }

  if (
    (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
    parent.operand === node
  ) {
    return "write";
  }

  return "read";
}

function sourcePosition(sourceFile, node) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    line: position.line + 1,
    column: position.character + 1
  };
}

function detectFile(root, absoluteFile) {
  const file = relativePath(root, absoluteFile);
  const runtimeClass = classifyPath(file);
  const source = readFileSync(absoluteFile, "utf8");
  const sourceFile = ts.createSourceFile(absoluteFile, source, ts.ScriptTarget.Latest, true);
  const detected = [];

  function visit(node) {
    if (
      ts.isPropertyAccessExpression(node) &&
      !isNestedInStorePropertyAccess(node) &&
      !isPostCallPropertyAccess(node)
    ) {
      const expression = chain(node);
      if (isDirectStoreExpression(expression) && shouldScanStoreIdentifier(file, expression)) {
        const position = sourcePosition(sourceFile, node);
        detected.push({
          file,
          symbol: symbolName(node),
          expression,
          accessKind: accessKind(node, expression),
          runtimeClass,
          line: position.line,
          column: position.column,
          boundaryStatus:
            runtimeClass === "active runtime" ? "migration target" : "excluded non-runtime path"
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return detected;
}

function detectCallSites(root, files) {
  const absoluteFiles = files
    .map((file) => resolve(root, file))
    .filter((file) => existsSync(file))
    .filter((file) => hasSourceExtension(normalizePath(file)))
    .toSorted((left, right) => normalizePath(left).localeCompare(normalizePath(right)));

  const detected = absoluteFiles.flatMap((file) => detectFile(root, file));
  detected.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.column - right.column ||
      left.expression.localeCompare(right.expression)
  );

  const occurrenceCounts = new Map();
  for (const callSite of detected) {
    const occurrenceKey = fingerprintBase(callSite);
    const occurrence = (occurrenceCounts.get(occurrenceKey) ?? 0) + 1;
    occurrenceCounts.set(occurrenceKey, occurrence);
    callSite.occurrence = occurrence;
  }

  return detected;
}

function fingerprintBase(entry) {
  return [entry.file, entry.symbol, entry.expression, entry.accessKind].join("|");
}

function fingerprint(entry) {
  return [
    entry.file,
    entry.symbol,
    entry.expression,
    entry.accessKind,
    String(entry.occurrence)
  ].join("|");
}

function loadManifest(path) {
  const raw = readFileSync(path, "utf8");
  const manifest = JSON.parse(raw);
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.approvedExceptions)) {
    throw new Error("direct store manifest must use schemaVersion 1 and approvedExceptions[]");
  }
  return manifest.approvedExceptions;
}

function validateManifest(entries) {
  const duplicateIds = [];
  const duplicateFingerprints = [];
  const broadExceptions = [];
  const ids = new Set();
  const fingerprints = new Set();

  for (const entry of entries) {
    if (ids.has(entry.id)) {
      duplicateIds.push(entry);
    }
    ids.add(entry.id);

    const entryFingerprint = fingerprint(entry);
    if (fingerprints.has(entryFingerprint)) {
      duplicateFingerprints.push(entry);
    }
    fingerprints.add(entryFingerprint);

    const hasWildcard =
      [entry.file, entry.symbol, entry.expression].some((value) =>
        String(value ?? "").includes("*")
      ) || String(entry.file ?? "").endsWith("/");
    if (hasWildcard) {
      broadExceptions.push(entry);
    }
  }

  return {
    duplicateIds,
    duplicateFingerprints,
    broadExceptions
  };
}

export function analyze({ root, manifestPath, files }) {
  const targetFiles = files ?? listTrackedFiles(root);
  const approvedExceptions = loadManifest(manifestPath);
  const manifestValidation = validateManifest(approvedExceptions);
  const detected = detectCallSites(root, targetFiles);
  const approvedByFingerprint = new Map(
    approvedExceptions.map((entry) => [fingerprint(entry), entry])
  );
  const detectedByFingerprint = new Map(detected.map((entry) => [fingerprint(entry), entry]));
  const approvedLegacyExceptions = [];
  const unapprovedRuntimeAccesses = [];
  const excludedNonRuntimePaths = [];

  for (const callSite of detected) {
    if (callSite.runtimeClass !== "active runtime") {
      excludedNonRuntimePaths.push(callSite);
      continue;
    }

    if (approvedByFingerprint.has(fingerprint(callSite))) {
      approvedLegacyExceptions.push(callSite);
    } else {
      unapprovedRuntimeAccesses.push(callSite);
    }
  }

  const staleApprovedExceptions = approvedExceptions.filter(
    (entry) =>
      entry.runtimeClass === "active runtime" && !detectedByFingerprint.has(fingerprint(entry))
  );

  return {
    approvedLegacyExceptions,
    unapprovedRuntimeAccesses,
    excludedNonRuntimePaths,
    staleApprovedExceptions,
    duplicateApprovedExceptions: [
      ...manifestValidation.duplicateIds,
      ...manifestValidation.duplicateFingerprints
    ],
    broadApprovedExceptions: manifestValidation.broadExceptions
  };
}

function formatCallSite(callSite) {
  return [
    `file=${callSite.file}`,
    `symbol=${callSite.symbol}`,
    `expression=${callSite.expression}`,
    `accessKind=${callSite.accessKind}`,
    `occurrence=${callSite.occurrence}`,
    `runtimeClass=${callSite.runtimeClass}`,
    `line=${callSite.line ?? "manifest"}`
  ].join(" ");
}

function printSection(label, entries, suggestion) {
  if (entries.length === 0) {
    return;
  }

  console.log(label);
  for (const entry of entries.toSorted((left, right) =>
    fingerprint(left).localeCompare(fingerprint(right))
  )) {
    console.log(
      `- ${label} ${formatCallSite(entry)}${suggestion ? ` suggestion=${suggestion}` : ""}`
    );
  }
}

export function runCli(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const result = analyze({
    root: options.root,
    manifestPath: options.manifest,
    files: options.files
  });

  console.log("Direct store boundary guard summary");
  console.log(`approved-legacy-exception: ${result.approvedLegacyExceptions.length}`);
  console.log(
    `new-unapproved-runtime-direct-store-access: ${result.unapprovedRuntimeAccesses.length}`
  );
  console.log(`stale-approved-exception: ${result.staleApprovedExceptions.length}`);
  console.log(`duplicate-approved-exception: ${result.duplicateApprovedExceptions.length}`);
  console.log(`broad-approved-exception: ${result.broadApprovedExceptions.length}`);
  console.log("unsupported-or-ambiguous-pattern: 0");
  console.log(`excluded-non-runtime-path: ${result.excludedNonRuntimePaths.length}`);
  console.log("evidence limitation: alias/indirect store access not fully statically detected");

  printSection("approved-legacy-exception", result.approvedLegacyExceptions);
  printSection(
    "new-unapproved-runtime-direct-store-access",
    result.unapprovedRuntimeAccesses,
    "route through RepositoryFacade or add a reviewed exact manifest exception"
  );
  printSection("stale-approved-exception", result.staleApprovedExceptions);
  printSection("duplicate-approved-exception", result.duplicateApprovedExceptions);
  printSection("broad-approved-exception", result.broadApprovedExceptions);

  return result.unapprovedRuntimeAccesses.length > 0 ||
    result.staleApprovedExceptions.length > 0 ||
    result.duplicateApprovedExceptions.length > 0 ||
    result.broadApprovedExceptions.length > 0
    ? 1
    : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
