#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir, platform as hostPlatform, tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  win32 as win32Path
} from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(SCRIPT_ROOT, "..");
const SCHEMA_VERSION = "GraphCompanionRegistryV1";
const OUTPUT_SCHEMA_VERSION = "GraphCompanionReceiptV1";
const GRAPHIFY_COMMAND = "graphify";
const CODEGRAPH_COMMAND = process.platform === "win32" ? "node" : "codegraph";
const CODEGRAPH_DISPLAY_COMMAND = process.platform === "win32" ? "codegraph.cmd" : "codegraph";
const CODEGRAPH_ENTRYPOINT =
  process.platform === "win32"
    ? join(
        homedir(),
        "AppData",
        "Local",
        "codegraph",
        "current",
        "lib",
        "dist",
        "bin",
        "codegraph.js"
      )
    : null;
const VALID_MODES = new Set(["entry", "refresh", "impact", "plan", "postmerge"]);

const CLASSIFICATION_RULES = [
  ["WORKFLOW", (file) => file.startsWith(".github/workflows/")],
  [
    "CONTRACT",
    (file) => file.startsWith("contracts/") || file.startsWith("packages/shared-contracts/")
  ],
  ["MIGRATION", (file) => file.startsWith("db/migrations/") || file.endsWith(".sql")],
  [
    "TEST",
    (file) => file.startsWith("tests/") || file.endsWith(".spec.ts") || file.endsWith(".test.ts")
  ],
  ["PLUGIN", (file) => file.startsWith("plugins/")],
  ["SCRIPT", (file) => file.startsWith("scripts/")],
  ["DATABASE", (file) => file.startsWith("db/")],
  [
    "PACKAGE",
    (file) =>
      ["package.json", "package-lock.json", "npm-shrinkwrap.json"].includes(file) ||
      /(^|\/)(tsconfig|vite|eslint|playwright|vitest|knip|Makefile)/u.test(file)
  ],
  ["PRODUCT", (file) => file.startsWith("apps/")],
  ["RUNTIME", (file) => file.startsWith("services/") || file.startsWith("packages/")],
  ["PLANNING", (file) => file.startsWith("docs/planning/")],
  ["DOCS", (file) => file.startsWith("docs/") || file.endsWith(".md")]
];

const SAFETY_FLOORS = [
  {
    pattern: /tenant|rbac|permission|auth/u,
    tests: [
      ["tests/unit/tenant-baseline-provisioning.test.ts", "T1"],
      ["tests/integration/tenant-baseline-provisioning-endpoint.test.ts", "T3"],
      ["tests/integration/p1-auth-rbac.test.ts", "T3"]
    ],
    reason: "tenant and authorization safety floor"
  },
  {
    pattern: /parameter-set|parameterset/u,
    tests: [
      ["tests/unit/parameter-set-command-service.test.ts", "T1"],
      ["tests/integration/formal-parameter-set-lifecycle-endpoint.test.ts", "T3"]
    ],
    reason: "ParameterSet authority safety floor"
  },
  {
    pattern: /scenario-package|scenariopackage/u,
    tests: [
      ["tests/unit/scenario-package-command-service.test.ts", "T1"],
      ["tests/integration/formal-scenario-package-lifecycle-endpoint.test.ts", "T3"]
    ],
    reason: "ScenarioPackage authority safety floor"
  },
  {
    pattern: /truth|settlement|score|rank|decision|round|canonical|state_true/u,
    tests: [
      ["tests/unit/settlement-idempotency.test.ts", "T1"],
      ["tests/integration/settlement-write-replay-hash-characterization.test.ts", "T3"]
    ],
    reason: "Truth and Settlement safety floor"
  },
  {
    pattern: /replay/u,
    tests: [
      ["tests/integration/m1-run-manifest-replay-evidence.test.ts", "T3"],
      ["tests/integration/settlement-write-replay-hash-characterization.test.ts", "T3"]
    ],
    reason: "Replay safety floor"
  },
  {
    pattern: /plugin/u,
    tests: [["tests/simulation/r7a-eldercare-plugin-conformance.test.ts", "T3"]],
    reason: "Plugin boundary safety floor"
  },
  {
    pattern: /(?:^|\/)services\/simulation-core\//u,
    tests: [
      ["npm test", "T4"],
      ["tests/integration/r7a-eldercare-golden-m1-compatibility.test.ts", "T3"],
      ["tests/integration/r7b-golden-m1-replay-compatibility.test.ts", "T3"],
      ["tests/simulation/r7a-eldercare-plugin-conformance.test.ts", "T3"],
      ["tests/unit/settlement-idempotency.test.ts", "T1"],
      ["tests/integration/settlement-write-replay-hash-characterization.test.ts", "T3"]
    ],
    reason: "simulation-core truth and replay safety floor"
  },
  {
    pattern: /^apps\/(?:teacher|student|admin)\//u,
    tests: [
      ["npm run build", "T4"],
      ["npm run test:e2e:ui", "T4"]
    ],
    reason: "frontend and browser safety floor"
  },
  {
    pattern: /student-learning|evidence-provenance|security|projection/u,
    tests: [
      ["tests/unit/student-learning-report-projection.test.ts", "T1"],
      ["tests/integration/student-learning-report-endpoint.test.ts", "T3"],
      ["tests/unit/runtime-security-config.test.ts", "T1"],
      ["tests/unit/r3-security-baseline.test.ts", "T1"],
      ["tests/integration/runtime-credentials-security.test.ts", "T3"]
    ],
    reason: "projection and security safety floor"
  }
];

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object" && !Buffer.isBuffer(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  if (Buffer.isBuffer(value)) return value.toString("base64");
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  return createHash("sha256")
    .update(typeof value === "string" || Buffer.isBuffer(value) ? value : canonicalJson(value))
    .digest("hex");
}

function normalizePath(file) {
  return file.replaceAll("\\", "/").replace(/^\.\//u, "");
}

export function classifyPath(file) {
  const normalized = normalizePath(file);
  for (const [classification, predicate] of CLASSIFICATION_RULES) {
    if (predicate(normalized)) return classification;
  }
  return "UNKNOWN";
}

export function resolveGraphHome({
  env = process.env,
  platform = hostPlatform,
  homeDir = homedir()
} = {}) {
  const pathApi = platform === "win32" ? win32Path : { join, resolve };
  if (env.SIMWAR_GRAPH_HOME?.trim()) return pathApi.resolve(env.SIMWAR_GRAPH_HOME);
  if (platform === "win32")
    return pathApi.join(
      env.LOCALAPPDATA || pathApi.join(homeDir, "AppData", "Local"),
      "SimWar",
      "graph-companion"
    );
  return pathApi.join(
    env.XDG_DATA_HOME || pathApi.join(homeDir, ".local", "share"),
    "SimWar",
    "graph-companion"
  );
}

export function buildSourceManifest({ files }) {
  const sorted = [...files].sort((left, right) =>
    normalizePath(left.path).localeCompare(normalizePath(right.path))
  );
  const entries = sorted
    .map((entry) => ({
      path: normalizePath(entry.path),
      classification: classifyPath(entry.path),
      content: entry.content
    }))
    .filter(
      (entry) =>
        !isDocsOrExcluded(entry.path) &&
        entry.classification !== "DOCS" &&
        entry.classification !== "PLANNING"
    )
    .map(({ path, classification, content }) => {
      const contentSha = sha256(content);
      return { path, blob_sha: contentSha, content_sha256: contentSha, classification };
    });
  const planningFiles = sorted
    .filter((entry) => classifyPath(entry.path) === "PLANNING")
    .map((entry) => normalizePath(entry.path));
  const manifest = {
    schema_version: OUTPUT_SCHEMA_VERSION,
    entries,
    planning_files: planningFiles,
    code_digest: sha256(entries),
    manifest_digest: sha256({ entries, planning_files: planningFiles })
  };
  return manifest;
}

function runCommand(command, args, cwd, { allowFailure = true, timeout = 1_200_000 } = {}) {
  try {
    const allowedCommands = new Set(["git", "node", GRAPHIFY_COMMAND, CODEGRAPH_COMMAND]);
    if (!allowedCommands.has(command)) throw new Error(`Unsupported command: ${command}`);
    if (
      !Array.isArray(args) ||
      args.some(
        (value) =>
          typeof value !== "string" ||
          [...value].some((character) => {
            const code = character.charCodeAt(0);
            return code < 32 || code === 127;
          }) ||
          /[;&|<>`]/u.test(value)
      )
    ) {
      throw new Error("Unsafe command argument");
    }
    const result = spawnSync(command, args, {
      cwd,
      encoding: "utf8",
      shell: false,
      timeout,
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024
    });
    const stdout = result.stdout || "";
    const stderr = result.stderr || "";
    if (result.error && !allowFailure) throw result.error;
    if (result.status !== 0 && !allowFailure) {
      const error = new Error(`${command} ${args.join(" ")} exited ${result.status}: ${stderr}`);
      error.stdout = stdout;
      error.stderr = stderr;
      throw error;
    }
    return {
      ok: result.status === 0,
      status: result.status,
      stdout,
      stderr,
      error: result.error?.message || null
    };
  } catch (error) {
    if (!allowFailure) throw error;
    return {
      ok: false,
      status: null,
      stdout: "",
      stderr: String(error?.message || error),
      error: String(error?.message || error)
    };
  }
}

function git(repoRoot, args, { allowFailure = false } = {}) {
  const result = runCommand("git", args, repoRoot, { allowFailure });
  if (!result.ok && !allowFailure) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function runCodeGraphCommand(args, cwd, options = {}) {
  const invocation = CODEGRAPH_ENTRYPOINT ? [CODEGRAPH_ENTRYPOINT, ...args] : args;
  return runCommand(CODEGRAPH_COMMAND, invocation, cwd, options);
}

function getRemote(repoRoot) {
  return (
    git(repoRoot, ["config", "--get", "remote.origin.url"], { allowFailure: true }) || "unknown"
  );
}

function parseRepository(remote, repoRoot = null) {
  const match = remote.match(/(?:github\.com[:/])([^/]+)\/([^/]+?)(?:\.git)?$/iu);
  const safeRemote = remote.replace(/(\/\/)[^/@\s]+@/u, "$1<redacted>@");
  const localIdentity =
    remote === "unknown"
      ? git(repoRoot || process.cwd(), ["rev-parse", "--git-common-dir"], {
          allowFailure: true
        }) || remote
      : remote;
  return {
    owner: match?.[1] || "local",
    name: match?.[2] || `repo-${sha256(localIdentity).slice(0, 12)}`,
    remote: safeRemote
  };
}

function readGitFiles(repoRoot) {
  const raw = git(repoRoot, ["ls-files", "-z"]);
  return raw
    .split("\0")
    .filter(Boolean)
    .map((path) => ({ path, content: readFileSync(join(repoRoot, path)) }));
}

export function readRepositoryManifest(repoRoot) {
  return buildSourceManifest({ files: readGitFiles(repoRoot) });
}

function readRepositoryManifestAtSha(repoRoot, sha) {
  const raw = git(repoRoot, ["ls-tree", "-r", "--name-only", "-z", sha], {
    allowFailure: true
  });
  if (!raw) return null;
  const files = [];
  for (const path of raw.split("\0").filter(Boolean)) {
    const content = runCommand("git", ["show", `${sha}:${path}`], repoRoot, {
      allowFailure: true,
      timeout: 120_000
    });
    if (!content.ok) return null;
    files.push({ path, content: Buffer.from(content.stdout, "utf8") });
  }
  return buildSourceManifest({ files });
}

function readTextManifest(manifestPath) {
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return null;
  }
}

function repositoryKey(repository) {
  return `${repository.owner}-${repository.name}`.replace(/[^A-Za-z0-9_.-]/gu, "-");
}

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

function atomicWrite(path, value) {
  ensureDirectory(dirname(path));
  const stagingDir = mkdtempSync(join(dirname(path), ".simwar-graph-companion-tmp-"));
  const tempPath = join(stagingDir, basename(path));
  try {
    writeFileSync(tempPath, typeof value === "string" ? value : `${canonicalJson(value)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600
    });
    renameSync(tempPath, path);
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }
}

function registryPath(graphHome, repository) {
  return join(graphHome, repositoryKey(repository), "registry.json");
}

function loadRegistry(graphHome, repository) {
  const path = registryPath(graphHome, repository);
  return readTextManifest(path);
}

function graphBasePath(graphHome, repository) {
  return join(graphHome, repositoryKey(repository));
}

function sourceGraphPath(graphHome, repository, sha) {
  return join(graphBasePath(graphHome, repository), "graphs", sha.slice(0, 12));
}

function changedFileEntries(repoRoot, baseSha, targetSha) {
  if (!baseSha || !targetSha || baseSha === targetSha) return [];
  const result = runCommand(
    "git",
    ["diff", "--name-status", `${baseSha}..${targetSha}`],
    repoRoot,
    {
      allowFailure: true
    }
  );
  if (!result.ok) {
    throw new Error(result.stderr || result.error || "Unable to compute changed files");
  }
  const entries = [];
  for (const line of result.stdout.split(/\r?\n/u).filter(Boolean)) {
    const [status, firstPath, secondPath] = line.split("\t");
    if (!status || !firstPath) continue;
    const kind = status[0];
    if (kind === "R" && secondPath) {
      entries.push({ status: "D", path: normalizePath(firstPath) });
      entries.push({ status: "A", path: normalizePath(secondPath) });
    } else {
      entries.push({ status: kind, path: normalizePath(firstPath) });
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function isDocsOrExcluded(file) {
  const normalized = normalizePath(file);
  return normalized.startsWith("docs/") || normalized.startsWith(".github/ISSUE_TEMPLATE/");
}

function isProductDelta(file) {
  const classification = classifyPath(file);
  return !isDocsOrExcluded(file) && classification !== "DOCS" && classification !== "PLANNING";
}

export function classifyFreshness({
  currentRepoSha,
  graphSourceSha,
  currentCodeManifestDigest,
  graphCodeManifestDigest,
  changedFiles: files = [],
  graphFound,
  sourceAvailable
}) {
  if (!sourceAvailable || !currentRepoSha)
    return {
      state: "BLOCKED_GRAPH_TOOLING",
      reason: "current source SHA unavailable",
      limits: ["CURRENT_REALITY_UNRESOLVED"]
    };
  if (!graphFound)
    return {
      state: "GRAPH_NOT_FOUND",
      reason: "no source-bound graph registry",
      limits: ["GRAPH_REBUILD_REQUIRED"]
    };
  if (!graphSourceSha)
    return {
      state: "STALE_REBUILD_REQUIRED",
      reason: "graph has no source binding",
      limits: ["UNBOUND_GRAPH_FORBIDDEN"]
    };
  if (graphSourceSha === currentRepoSha) {
    if (currentCodeManifestDigest && currentCodeManifestDigest === graphCodeManifestDigest) {
      return {
        state: "CURRENT_EXACT_SHA",
        reason: "source SHA and code manifest match",
        limits: []
      };
    }
    return {
      state: "STALE_REBUILD_REQUIRED",
      reason: "source SHA matches but manifest is invalid",
      limits: ["SOURCE_MANIFEST_MISMATCH"]
    };
  }
  const docsOnly = files.length > 0 && files.every((file) => isDocsOrExcluded(file));
  if (
    docsOnly &&
    currentCodeManifestDigest &&
    currentCodeManifestDigest === graphCodeManifestDigest
  ) {
    return {
      state: "CURRENT_CODE_EQUIVALENT",
      reason: "only excluded/docs files changed and code manifests match",
      limits: ["GRAPH_SOURCE_SHA_HISTORICAL"]
    };
  }
  if (files.some(isProductDelta) || currentCodeManifestDigest !== graphCodeManifestDigest) {
    return {
      state: "STALE_PRODUCT_DELTA",
      reason: "source-code or contract/test/runtime files changed",
      limits: ["GRAPH_REFRESH_REQUIRED"]
    };
  }
  return {
    state: "STALE_REBUILD_REQUIRED",
    reason: "graph freshness cannot be proven",
    limits: ["INCREMENTAL_SAFETY_UNPROVEN"]
  };
}

function stripAnsi(text) {
  const ansiSgr = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");
  return text.replace(ansiSgr, "");
}

function parseInteger(label, text) {
  const match = stripAnsi(text).match(new RegExp(`^\\s*${label}:\\s*([0-9,]+)`, "imu"));
  return match ? Number(match[1].replaceAll(",", "")) : null;
}

export function discoverTools({ cwd = DEFAULT_REPO_ROOT } = {}) {
  const graphifyVersion = runCommand(GRAPHIFY_COMMAND, ["--version"], cwd);
  const graphifyHelp = runCommand(GRAPHIFY_COMMAND, ["--help"], cwd);
  const codegraphVersion = runCodeGraphCommand(["--version"], cwd);
  const codegraphHelp = runCodeGraphCommand(["--help"], cwd);
  const graphifyOk = graphifyVersion.ok;
  const codegraphOk = codegraphVersion.ok;
  return {
    schema_version: OUTPUT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    tools: [
      {
        tool: "Graphify",
        version: stripAnsi(graphifyVersion.stdout).trim() || "UNKNOWN",
        status: graphifyOk ? "AVAILABLE" : "UNAVAILABLE",
        capabilities: ["extract", "update", "path", "affected", "query"].filter((name) =>
          graphifyHelp.stdout.includes(name)
        ),
        command: `${GRAPHIFY_COMMAND} --version`,
        result: graphifyOk ? "PASS" : "UNAVAILABLE",
        limitation: graphifyOk ? null : graphifyVersion.stderr || graphifyVersion.error
      },
      {
        tool: "CodeGraph",
        version: stripAnsi(codegraphVersion.stdout).trim() || "UNKNOWN",
        status: codegraphOk ? "AVAILABLE" : "UNAVAILABLE",
        capabilities: ["init", "index", "sync", "status", "affected", "explore"].filter((name) =>
          codegraphHelp.stdout.includes(name)
        ),
        command: `${CODEGRAPH_DISPLAY_COMMAND} --version`,
        result: codegraphOk ? "PASS" : "UNAVAILABLE",
        limitation: codegraphOk ? null : codegraphVersion.stderr || codegraphVersion.error
      }
    ],
    graphify_available: graphifyOk,
    codegraph_available: codegraphOk,
    github_workflow: "LOCAL_CODEX_ORCHESTRATION_ONLY_V1"
  };
}

function extractGraphShape(graph) {
  if (!graph || typeof graph !== "object") return { nodes: [], edges: [] };
  const nested = graph.graph && typeof graph.graph === "object" ? graph.graph : graph;
  const nodes = Array.isArray(nested.nodes)
    ? nested.nodes
    : Array.isArray(nested.vertices)
      ? nested.vertices
      : [];
  const edges = Array.isArray(nested.edges)
    ? nested.edges
    : Array.isArray(nested.links)
      ? nested.links
      : [];
  return { nodes, edges };
}

function nodeFile(node) {
  if (!node || typeof node !== "object") return null;
  for (const field of ["file", "path", "source", "source_file", "file_path", "label"]) {
    if (
      typeof node[field] === "string" &&
      /(?:^|[/\\])[A-Za-z0-9_.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|yaml|yml|sql)$/u.test(node[field])
    ) {
      return normalizePath(node[field]);
    }
  }
  return null;
}

function edgeEndpoint(edge, side) {
  for (const field of side === "from"
    ? ["from", "source", "from_id", "source_id"]
    : ["to", "target", "to_id", "target_id"]) {
    if (typeof edge?.[field] === "string") return edge[field];
  }
  return null;
}

function edgeRelation(edge) {
  return String(edge?.relation || edge?.type || edge?.kind || "related");
}

function graphFileForEndpoint(endpoint, nodesById) {
  if (!endpoint) return null;
  if (nodesById.has(endpoint)) return nodeFile(nodesById.get(endpoint));
  return /(?:^|[/\\])[A-Za-z0-9_.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|yaml|yml|sql)$/u.test(endpoint)
    ? normalizePath(endpoint)
    : null;
}

function readGraph(graphPath) {
  if (!graphPath || !existsSync(graphPath)) return null;
  try {
    return JSON.parse(readFileSync(graphPath, "utf8"));
  } catch {
    return null;
  }
}

export function buildArchitectureDelta({
  baseSha = null,
  targetSha,
  changedFiles: files = [],
  changedFileEntries: entries = null,
  graph = null,
  priorGraph = null
}) {
  const { nodes, edges } = extractGraphShape(graph);
  const { nodes: priorNodes } = extractGraphShape(priorGraph);
  const filesWithNodes = new Set(nodes.map(nodeFile).filter(Boolean));
  const priorFilesWithNodes = new Set(priorNodes.map(nodeFile).filter(Boolean));
  const changed = [...new Set(files.map(normalizePath))].sort();
  const entryByPath = new Map(
    (Array.isArray(entries) ? entries : changed.map((path) => ({ status: "M", path }))).map(
      (entry) => [normalizePath(entry.path), entry]
    )
  );
  const unmapped = changed.filter((file) =>
    entryByPath.get(file)?.status === "D"
      ? !priorFilesWithNodes.has(file)
      : !filesWithNodes.has(file)
  );
  const changedNodes = nodes
    .filter((node) => changed.includes(nodeFile(node)))
    .map((node) => node.id || node.name || nodeFile(node))
    .filter(Boolean);
  const removedNodes = priorNodes
    .filter(
      (node) => changed.includes(nodeFile(node)) && entryByPath.get(nodeFile(node))?.status === "D"
    )
    .map((node) => node.id || node.name || nodeFile(node))
    .filter(Boolean);
  const highFanIn = [];
  const highFanOut = [];
  const incomingCounts = new Map();
  const outgoingCounts = new Map();
  for (const edge of edges) {
    const from = edgeEndpoint(edge, "from");
    const to = edgeEndpoint(edge, "to");
    if (from) outgoingCounts.set(from, (outgoingCounts.get(from) || 0) + 1);
    if (to) incomingCounts.set(to, (incomingCounts.get(to) || 0) + 1);
  }
  for (const node of nodes) {
    const id = node.id || node.name;
    if (!id) continue;
    const incoming = incomingCounts.get(id) || 0;
    const outgoing = outgoingCounts.get(id) || 0;
    if (changed.includes(nodeFile(node)) && incoming >= 10) highFanIn.push(id);
    if (changed.includes(nodeFile(node)) && outgoing >= 10) highFanOut.push(id);
  }
  const includes = (pattern) => changed.filter((file) => pattern.test(file));
  const delta = {
    schema_version: OUTPUT_SCHEMA_VERSION,
    base_sha: baseSha,
    target_sha: targetSha,
    modified_files: changed.filter((file) => entryByPath.get(file)?.status === "M"),
    added_files: changed.filter((file) => entryByPath.get(file)?.status === "A"),
    removed_files: changed.filter((file) => entryByPath.get(file)?.status === "D"),
    added_nodes: [],
    removed_nodes: removedNodes,
    changed_nodes: changedNodes,
    added_edges: [],
    removed_edges: [],
    changed_routes: includes(/route|server|bff/u),
    changed_contracts: includes(/contract|openapi|schema|shared-contracts/u),
    changed_writers: includes(/command|writer|append|create|persist|repository/u),
    changed_repository_paths: includes(/repository|adapter|store/u),
    changed_authority_boundaries: includes(
      /authority|tenant|rbac|permission|parameter-set|scenario-package/u
    ),
    changed_teacher_surface: includes(/teacher/u),
    changed_student_surface: includes(/student/u),
    changed_admin_surface: includes(/admin/u),
    changed_scenario: includes(/scenario/u),
    changed_parameter_set: includes(/parameter-set|parameterset/u),
    changed_plugin: includes(/plugin/u),
    truth_touchpoints: includes(/truth|decision|round|score|rank/u),
    settlement_touchpoints: includes(/settlement/u),
    replay_touchpoints: includes(/replay/u),
    tenant_touchpoints: includes(/tenant|rbac|permission/u),
    high_fan_in_changed: highFanIn.sort(),
    high_fan_out_changed: highFanOut.sort(),
    unmapped_changed_files: unmapped,
    confidence:
      graph && nodes.length > 0 && unmapped.length === 0
        ? "HIGH"
        : graph && nodes.length > 0
          ? "PARTIAL"
          : "LOW"
  };
  return delta;
}

function addRecommendation(
  recommendations,
  testFile,
  tier,
  reason,
  impactedNode,
  dependencyPath,
  confidence,
  mandatory,
  graphSource
) {
  const key = `${testFile}|${reason}`;
  if (recommendations.some((entry) => `${entry.test_file}|${entry.reason}` === key)) return;
  recommendations.push({
    test_file: testFile,
    tier,
    depth: Math.min(2, Math.max(0, Array.isArray(dependencyPath) ? dependencyPath.length - 1 : 0)),
    reason,
    impacted_node: impactedNode,
    dependency_path: dependencyPath,
    confidence,
    mandatory,
    graph_source: graphSource
  });
}

function isConcreteTestFile(file) {
  return (
    typeof file === "string" &&
    /^tests\//u.test(file) &&
    /(?:\.test|\.spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/u.test(file)
  );
}

export function buildTestImpact({
  changedFiles: files = [],
  graph = null,
  codeGraphAffected = [],
  codeGraphStatus = "UNAVAILABLE",
  codeGraphAffectedStatus = "NOT_RUN"
}) {
  const changed = [...new Set(files.map(normalizePath))].sort();
  const recommendations = [];
  const graphSource = graph ? "GRAPHIFY_ADJACENCY" : "SOURCE_PATH_FALLBACK";
  const docsOnly = changed.length > 0 && changed.every((file) => isDocsOrExcluded(file));
  if (changed.length === 0 || docsOnly) {
    addRecommendation(
      recommendations,
      "git diff --check",
      "T0",
      "static diff integrity",
      "changed-files",
      "git",
      "HIGH",
      true,
      "git"
    );
    addRecommendation(
      recommendations,
      "npm run check:hidden-unicode",
      "T0",
      "hidden Unicode integrity",
      "changed-files",
      "script",
      "HIGH",
      true,
      "script"
    );
    addRecommendation(
      recommendations,
      "npm run format:check",
      "T0",
      "format-scoped validation",
      "changed-files",
      "prettier",
      "HIGH",
      true,
      "script"
    );
  }
  const { nodes, edges } = extractGraphShape(graph);
  const nodesById = new Map(
    nodes.filter((node) => node && typeof node.id === "string").map((node) => [node.id, node])
  );
  const adjacency = new Map();
  for (const edge of edges) {
    const from = graphFileForEndpoint(edgeEndpoint(edge, "from"), nodesById);
    const to = graphFileForEndpoint(edgeEndpoint(edge, "to"), nodesById);
    if (!from || !to) continue;
    for (const [left, right] of [
      [from, to],
      [to, from]
    ]) {
      if (!adjacency.has(left)) adjacency.set(left, []);
      adjacency.get(left).push({ file: right, relation: edgeRelation(edge) });
    }
  }
  const queue = changed.map((file) => ({ file, depth: 0, path: [file] }));
  const visited = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth > 2) continue;
    const visitKey = `${current.file}|${current.depth}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);
    if (isConcreteTestFile(current.file)) {
      addRecommendation(
        recommendations,
        current.file,
        current.depth === 0 ? "T1" : "T2",
        "graph-mapped dependency",
        changed.join(","),
        current.path,
        current.depth === 0 ? "HIGH" : "MEDIUM",
        false,
        graphSource
      );
    }
    if (current.depth < 2) {
      for (const next of adjacency.get(current.file) || [])
        queue.push({
          file: next.file,
          depth: current.depth + 1,
          path: [...current.path, `${next.relation}:${next.file}`]
        });
    }
  }
  for (const file of codeGraphAffected.filter((value) => typeof value === "string")) {
    if (isConcreteTestFile(file))
      addRecommendation(
        recommendations,
        normalizePath(file),
        "T2",
        "CodeGraph affected test",
        changed.join(","),
        ["CodeGraph", normalizePath(file)],
        "HIGH",
        false,
        "CODEGRAPH"
      );
  }
  if (codeGraphAffectedStatus === "DEGRADED") {
    addRecommendation(
      recommendations,
      "npm test",
      "T4",
      "CodeGraph affected query failed; conservative full-suite fallback",
      changed.join(","),
      ["CodeGraph", "affected"],
      "HIGH",
      true,
      "CONSERVATIVE_FALLBACK"
    );
  }
  const matchingFloors = SAFETY_FLOORS.filter((floor) =>
    changed.some((file) => isProductDelta(file) && floor.pattern.test(file))
  );
  for (const floor of matchingFloors) {
    for (const [testFile, tier] of floor.tests) {
      addRecommendation(
        recommendations,
        testFile,
        tier,
        floor.reason,
        changed.join(","),
        ["safety-floor", testFile],
        "HIGH",
        true,
        "MANDATORY_SAFETY_FLOOR"
      );
    }
  }
  if (!docsOnly && changed.length > 0 && recommendations.every((entry) => entry.tier === "T0")) {
    addRecommendation(
      recommendations,
      "npm test",
      "T4",
      "conservative full-suite fallback for unmapped source change",
      changed.join(","),
      ["missing-edge", "full-suite"],
      "LOW",
      true,
      "CONSERVATIVE_FALLBACK"
    );
  }
  recommendations.sort(
    (left, right) =>
      left.test_file.localeCompare(right.test_file) || left.tier.localeCompare(right.tier)
  );
  return {
    schema_version: OUTPUT_SCHEMA_VERSION,
    source_sha: null,
    target_sha: null,
    max_depth: 2,
    changed_files: changed,
    recommendations,
    false_negative_controls: [
      "max traversal depth = 2",
      "missing edge expands mandatory safety floors",
      "Graph is evidence and never suppresses repository safety tests"
    ],
    codegraph_status: codeGraphStatus,
    graph_source: graphSource,
    complete: codeGraphAffectedStatus !== "DEGRADED"
  };
}

export function buildRiskDelta({ changedFiles: files = [], graph = null, testImpact = null }) {
  const changed = [...new Set(files.map(normalizePath))].sort();
  const runtimeChanged = changed.filter(isProductDelta);
  const findings = [];
  const add = (id, level, status, detail) => findings.push({ id, level, status, detail });
  const has = (pattern) => runtimeChanged.some((file) => pattern.test(file));
  add(
    "authority-boundary",
    has(/authority|tenant|rbac|parameter-set|scenario-package/u) ? "P1" : "INFO",
    "CHECKED",
    "authority and tenant path classification"
  );
  add(
    "writer-change",
    has(/command|writer|append|create|persist|repository|adapter/u) ? "P1" : "INFO",
    "CHECKED",
    "writer and persistence path classification"
  );
  add(
    "truth-settlement-replay",
    has(/truth|settlement|replay|score|rank/u) ? "P0" : "INFO",
    "CHECKED",
    "Truth/Settlement/Replay touchpoint classification"
  );
  add(
    "direct-store-bypass",
    has(/store|repository|adapter/u) ? "P1" : "INFO",
    "CHECKED",
    "direct-store boundary requires mandatory guard"
  );
  add(
    "runtime-without-test",
    testImpact?.recommendations?.length ? "INFO" : "P1",
    testImpact?.recommendations?.length ? "COVERED" : "OPEN",
    "changed runtime has test-impact recommendations"
  );
  add(
    "unmapped-code",
    graph && testImpact?.graph_source === "GRAPHIFY_ADJACENCY" ? "INFO" : "P1",
    graph ? "CHECKED" : "OPEN",
    "Graph/source mapping confidence"
  );
  add(
    "high-fan-in",
    has(/services|packages|contracts/u) ? "P1" : "INFO",
    "CHECKED",
    "high fan-in module review required for shared paths"
  );
  return {
    schema_version: OUTPUT_SCHEMA_VERSION,
    changed_files: changed,
    findings,
    complete: true,
    unknowns: graph ? [] : ["GRAPH_UNAVAILABLE_OR_EMPTY"]
  };
}

function extractScalarLines(text, keys) {
  const result = {};
  for (const key of keys) {
    const match = text.match(new RegExp(`^\\s*${key}:\\s*["']?([^\\n"']+?)["']?\\s*$`, "imu"));
    if (match) result[key] = match[1].trim();
  }
  return result;
}

export function classifyPlanningDocuments(documents, currentSha) {
  const normalized = documents.map((document) => {
    const boundShas = Array.isArray(document.bound_shas)
      ? document.bound_shas
      : Object.values(document.scalars || {}).filter((value) => /^[0-9a-f]{40}$/u.test(value));
    const currentBinding =
      document.scalars?.current_master_at_readback || document.scalars?.source_sha;
    return {
      ...document,
      bound_shas: boundShas,
      current_binding_sha: currentBinding || null,
      binding_status: !document.exists
        ? "MISSING"
        : currentBinding === currentSha
          ? "CURRENT"
          : "DRIFT"
    };
  });
  return {
    documents: normalized,
    missing: normalized.some((document) => document.binding_status === "MISSING"),
    drift: normalized.some((document) => document.binding_status === "DRIFT")
  };
}

function classifyCommit(message) {
  const lower = message.toLowerCase();
  if (/docs?:|governance|closure|reconcile|receipt/u.test(lower)) return "governance";
  if (/graph|infra|repair|refactor|security|test:/u.test(lower)) return "infrastructure";
  if (/feat:|product|journey|course|teacher|student|scenario|eldercare/u.test(lower))
    return "product";
  return "other";
}

export function readPlanningReality({ repoRoot, currentSha }) {
  const planningPaths = [
    "docs/planning/current-cycle.yaml",
    "docs/planning/l1-plus-portfolio-register.yaml"
  ];
  const documents = planningPaths.map((path) => {
    const absolute = join(repoRoot, path);
    const text = existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
    const scalars = extractScalarLines(text, [
      "source_sha",
      "current_master_at_readback",
      "governance_closure_merge_sha",
      "mainline_candidate",
      "primary_outcome",
      "automatic_next_start"
    ]);
    return { path, exists: Boolean(text), scalars };
  });
  const classified = classifyPlanningDocuments(documents, currentSha);
  const classifiedDocuments = classified.documents;
  const referencedShas = classifiedDocuments.flatMap((document) =>
    Object.values(document.scalars).filter((value) => /^[0-9a-f]{40}$/u.test(value))
  );
  const drift = classified.drift;
  const missing = classified.missing;
  const recent = git(repoRoot, ["log", "-n", "20", "--format=%H%x09%s"], { allowFailure: true })
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      const [sha, ...message] = line.split("\t");
      return {
        sha,
        message: message.join("\t"),
        classification: classifyCommit(message.join("\t"))
      };
    });
  const productCount = recent.filter((entry) => entry.classification === "product").length;
  const infraCount = recent.filter((entry) =>
    ["infrastructure", "governance"].includes(entry.classification)
  ).length;
  const goal =
    documents
      .map((document) => document.scalars.primary_outcome || document.scalars.mainline_candidate)
      .find(Boolean) || "UNKNOWN";
  const productValueDrift =
    productCount === 0 &&
    infraCount >= 3 &&
    /course|scenario|golden|human/u.test(goal.toLowerCase())
      ? "WARNING_GENERIC_INFRASTRUCTURE_DRIFT"
      : "ON_TRACK";
  return {
    schema_version: OUTPUT_SCHEMA_VERSION,
    current_master_sha: currentSha,
    status: missing ? "PLANNING_REALITY_MISSING" : drift ? "PLANNING_REALITY_DRIFT" : "CURRENT",
    referenced_shas: [...new Set(referencedShas)],
    documents: classifiedDocuments,
    recent_merges: recent,
    current_stated_product_goal: goal,
    product_value_drift: productValueDrift,
    known_limits: ["planning docs are evidence, not source truth", "automatic_next_start=false"],
    automatic_next_start: false
  };
}

export function evaluatePlanningGate({
  freshness,
  freshnessLimits = [],
  architectureDeltaComplete,
  testImpactComplete,
  riskDeltaComplete,
  planningReality,
  codeGraphStatus,
  riskFindings = []
}) {
  const limits = [...new Set(freshnessLimits)];
  const riskLevels = new Set(riskFindings.map((finding) => finding?.level));
  if (riskLevels.has("P0")) limits.push("P0_RISK_REVIEW_REQUIRED");
  else if (riskLevels.has("P1")) limits.push("P1_RISK_REVIEW_REQUIRED");
  if (codeGraphStatus === "DEGRADED_CODEGRAPH")
    limits.push("CODEGRAPH_DEGRADED_GRAPHIFY_ADJACENCY_FALLBACK");
  if (codeGraphStatus === "DEGRADED_GRAPHIFY") limits.push("GRAPHIFY_HEALTH_UNPROVEN");
  if (planningReality === "PLANNING_REALITY_DRIFT") limits.push("PLANNING_REALITY_DRIFT");
  if (
    freshness === "STALE_PRODUCT_DELTA" ||
    freshness === "STALE_REBUILD_REQUIRED" ||
    freshness === "GRAPH_NOT_FOUND"
  ) {
    return {
      schema_version: OUTPUT_SCHEMA_VERSION,
      status: freshness === "GRAPH_NOT_FOUND" ? "BLOCKED_GRAPH_TOOLING" : "BLOCKED_STALE_GRAPH",
      limits: ["GRAPH_REFRESH_REQUIRED"],
      automatic_next_start: false
    };
  }
  if (freshness === "BLOCKED_GRAPH_TOOLING")
    return {
      schema_version: OUTPUT_SCHEMA_VERSION,
      status: "BLOCKED_GRAPH_TOOLING",
      limits: ["CURRENT_REALITY_UNRESOLVED"],
      automatic_next_start: false
    };
  if (planningReality === "PLANNING_REALITY_MISSING")
    return {
      schema_version: OUTPUT_SCHEMA_VERSION,
      status: "BLOCKED_CURRENT_REALITY",
      limits: ["PLANNING_INPUT_MISSING"],
      automatic_next_start: false
    };
  if (riskLevels.has("P0"))
    return {
      schema_version: OUTPUT_SCHEMA_VERSION,
      status: "BLOCKED_HIGH_RISK_DELTA",
      limits: [...new Set(limits)],
      automatic_next_start: false
    };
  if (!architectureDeltaComplete || !testImpactComplete || !riskDeltaComplete)
    return {
      schema_version: OUTPUT_SCHEMA_VERSION,
      status: "BLOCKED_UNMAPPED_PRODUCT_DELTA",
      limits: ["REQUIRED_RECEIPT_INCOMPLETE"],
      automatic_next_start: false
    };
  if (limits.length > 0 || freshness === "CURRENT_CODE_EQUIVALENT")
    return {
      schema_version: OUTPUT_SCHEMA_VERSION,
      status: "PLAN_ALLOWED_WITH_LIMITS",
      limits,
      automatic_next_start: false
    };
  return {
    schema_version: OUTPUT_SCHEMA_VERSION,
    status: "PLAN_ALLOWED",
    limits: [],
    automatic_next_start: false
  };
}

function parseGraphifyCounts(graph) {
  const { nodes, edges } = extractGraphShape(graph);
  return { node_count: nodes.length, edge_count: edges.length };
}

function runGraphifyRefresh({ repoRoot, repository, graphHome, currentSha, manifest, tools }) {
  const baseTarget = sourceGraphPath(graphHome, repository, currentSha);
  const baseGraphifyDir = join(baseTarget, "graphify");
  const baseGraphPath = join(baseGraphifyDir, "graph.json");
  const baseSourceManifestPath = join(baseTarget, "source-manifest.json");
  let graphifyDir = baseGraphifyDir;
  let graphPath = baseGraphPath;
  let sourceManifestPath = baseSourceManifestPath;
  const selectRepairTarget = () => {
    const repairBase = `${baseTarget}-${manifest.code_digest.slice(0, 12)}`;
    let candidate = repairBase;
    let index = 1;
    while (existsSync(join(candidate, "graphify", "graph.json")) || existsSync(candidate)) {
      candidate = `${repairBase}-${index}`;
      index += 1;
    }
    return candidate;
  };
  const useRepairTarget = () => {
    const repairTarget = selectRepairTarget();
    graphifyDir = join(repairTarget, "graphify");
    graphPath = join(graphifyDir, "graph.json");
    sourceManifestPath = join(repairTarget, "source-manifest.json");
    ensureDirectory(graphifyDir);
  };
  const targetExisted = existsSync(baseTarget);
  if (targetExisted && (!existsSync(baseGraphPath) || !existsSync(baseSourceManifestPath))) {
    useRepairTarget();
  }
  ensureDirectory(graphifyDir);
  if (existsSync(graphPath) && existsSync(sourceManifestPath)) {
    const storedManifest = readTextManifest(sourceManifestPath);
    if (
      storedManifest?.manifest_digest !== manifest.manifest_digest ||
      storedManifest?.code_digest !== manifest.code_digest
    ) {
      useRepairTarget();
    }
    if (existsSync(graphPath) && existsSync(sourceManifestPath)) {
      const graph = readGraph(graphPath);
      if (graph) {
        const counts = parseGraphifyCounts(graph);
        return {
          status: "HEALTHY",
          version: tools?.graphify_version || "UNKNOWN",
          path: graphPath,
          logical_digest: sha256(graph),
          ...counts,
          warnings: [],
          reused: true
        };
      }
    }
  }
  if (existsSync(graphPath) || existsSync(sourceManifestPath)) {
    useRepairTarget();
  }
  if (!tools?.graphify_available)
    return {
      status: "UNAVAILABLE",
      version: "UNKNOWN",
      path: graphPath,
      logical_digest: "DIGEST_UNAVAILABLE",
      node_count: 0,
      edge_count: 0,
      warnings: ["Graphify CLI unavailable"],
      reused: false
    };
  const staging = mkdtempSync(join(tmpdir(), "simwar-graph-companion-graphify-"));
  try {
    const result = runCommand(
      GRAPHIFY_COMMAND,
      ["extract", repoRoot, "--code-only", "--no-cluster", "--out", staging],
      repoRoot,
      { timeout: 1_800_000 }
    );
    const generated = join(staging, "graphify-out", "graph.json");
    if (!result.ok || !existsSync(generated)) {
      return {
        status: "UNAVAILABLE",
        version: "UNKNOWN",
        path: graphPath,
        logical_digest: "DIGEST_UNAVAILABLE",
        node_count: 0,
        edge_count: 0,
        warnings: [result.stderr || result.error || "Graphify extraction produced no graph"],
        reused: false
      };
    }
    copyFileSync(generated, graphPath);
    const graph = readGraph(graphPath);
    const counts = parseGraphifyCounts(graph);
    atomicWrite(sourceManifestPath, manifest);
    atomicWrite(join(graphifyDir, "refresh-receipt.json"), {
      schema_version: OUTPUT_SCHEMA_VERSION,
      source_sha: currentSha,
      command: `${GRAPHIFY_COMMAND} extract --code-only --no-cluster`,
      status: "PASS",
      generated_at: new Date().toISOString(),
      automatic_next_start: false
    });
    return {
      status: "HEALTHY",
      version: tools?.graphify_version || "UNKNOWN",
      path: graphPath,
      logical_digest: graph ? sha256(graph) : "DIGEST_UNAVAILABLE",
      ...counts,
      warnings: [],
      reused: false
    };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

export function parseCodeGraphStatus(text, repoRoot) {
  const clean = stripAnsi(text).replaceAll(repoRoot, "<repo>").trim();
  const healthy = /Index is up to date/iu.test(clean);
  return {
    status: healthy ? "HEALTHY" : "DEGRADED_CODEGRAPH",
    path: join(repoRoot, ".codegraph"),
    logical_digest: clean ? sha256(clean) : "DIGEST_UNAVAILABLE",
    indexed_files: parseInteger("Files", clean),
    node_count: parseInteger("Nodes", clean),
    edge_count: parseInteger("Edges", clean),
    pending_changes: healthy ? 0 : null,
    warnings: healthy ? [] : ["CodeGraph status is not up to date"],
    status_text: clean
  };
}

export function codeGraphWorkspacePath(graphHome, repository) {
  return join(graphBasePath(graphHome, repository), "codegraph-worktree");
}

function ensureCodeGraphWorkspace({ repoRoot, graphHome, repository, currentSha }) {
  const workspace = codeGraphWorkspacePath(graphHome, repository);
  if (!existsSync(join(workspace, ".git"))) {
    ensureDirectory(dirname(workspace));
    const added = runCommand(
      "git",
      ["worktree", "add", "--detach", workspace, currentSha],
      repoRoot,
      { allowFailure: true, timeout: 120_000 }
    );
    if (!added.ok)
      return {
        path: null,
        warning: added.stderr || added.error || "CodeGraph worktree creation failed"
      };
  }
  const checkedOut = git(workspace, ["rev-parse", "HEAD"], { allowFailure: true });
  if (checkedOut !== currentSha) {
    const checkout = runCommand("git", ["checkout", "--detach", currentSha], workspace, {
      allowFailure: true,
      timeout: 120_000
    });
    if (!checkout.ok)
      return {
        path: null,
        warning: checkout.stderr || checkout.error || "CodeGraph worktree checkout failed"
      };
  }
  return { path: workspace, warning: null };
}

function runCodeGraphIndex({ repoRoot, tools, graphHome, repository, currentSha }) {
  if (!tools?.codegraph_available)
    return {
      status: "DEGRADED_CODEGRAPH",
      version: "UNKNOWN",
      path: null,
      workspace_root: null,
      logical_digest: "DIGEST_UNAVAILABLE",
      indexed_files: 0,
      node_count: 0,
      edge_count: 0,
      pending_changes: null,
      warnings: ["CodeGraph CLI unavailable"]
    };
  const workspaceResult = ensureCodeGraphWorkspace({ repoRoot, graphHome, repository, currentSha });
  const indexRoot = workspaceResult.path;
  if (!indexRoot)
    return {
      status: "DEGRADED_CODEGRAPH",
      version: tools?.tools?.find((tool) => tool.tool === "CodeGraph")?.version || "UNKNOWN",
      path: null,
      workspace_root: null,
      logical_digest: "DIGEST_UNAVAILABLE",
      indexed_files: 0,
      node_count: 0,
      edge_count: 0,
      pending_changes: null,
      warnings: [workspaceResult.warning]
    };
  const initialized = existsSync(join(indexRoot, ".codegraph"));
  const command = initialized ? ["sync", indexRoot] : ["init", indexRoot];
  const result = runCodeGraphCommand(command, indexRoot, { timeout: 1_800_000 });
  const status = runCodeGraphCommand(["status", indexRoot], indexRoot, {
    timeout: 120_000
  });
  if (!status.ok)
    return {
      status: "DEGRADED_CODEGRAPH",
      version: tools?.tools?.find((tool) => tool.tool === "CodeGraph")?.version || "UNKNOWN",
      path: join(indexRoot, ".codegraph"),
      workspace_root: indexRoot,
      logical_digest: "DIGEST_UNAVAILABLE",
      indexed_files: 0,
      node_count: 0,
      edge_count: 0,
      pending_changes: null,
      warnings: [status.stderr || status.error || result.stderr || "CodeGraph status unavailable"]
    };
  if (!result.ok)
    return {
      status: "DEGRADED_CODEGRAPH",
      path: join(indexRoot, ".codegraph"),
      workspace_root: indexRoot,
      logical_digest: "DIGEST_UNAVAILABLE",
      indexed_files: 0,
      node_count: 0,
      edge_count: 0,
      pending_changes: null,
      version: tools?.tools?.find((tool) => tool.tool === "CodeGraph")?.version || "UNKNOWN",
      warnings: [result.stderr || result.error || "CodeGraph index operation failed"]
    };
  return {
    ...parseCodeGraphStatus(status.stdout, indexRoot),
    workspace_root: indexRoot,
    command: `${CODEGRAPH_DISPLAY_COMMAND} ${command[0]}`,
    command_ok: true,
    version: tools?.tools?.find((tool) => tool.tool === "CodeGraph")?.version || "UNKNOWN"
  };
}

export function parseCodeGraphAffected(output) {
  const pathFromEntry = (entry) =>
    typeof entry === "string"
      ? entry
      : entry && typeof entry === "object"
        ? entry.file || entry.path
        : null;
  let parsed;
  try {
    parsed = JSON.parse(output);
    if (Array.isArray(parsed)) {
      const paths = parsed.map(pathFromEntry).filter(Boolean);
      return parsed.length > 0 && paths.length === 0 ? null : paths;
    }
    if (Array.isArray(parsed.tests)) {
      const paths = parsed.tests.map(pathFromEntry).filter(Boolean);
      return parsed.tests.length > 0 && paths.length === 0 ? null : paths;
    }
    if (Array.isArray(parsed.affectedTests)) {
      const paths = parsed.affectedTests.map(pathFromEntry).filter(Boolean);
      return parsed.affectedTests.length > 0 && paths.length === 0 ? null : paths;
    }
  } catch {
    const lines = output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("tests/"));
    return lines.length > 0 ? lines : null;
  }
  return null;
}

function codeGraphAffected(repoRoot, files, status) {
  if (status !== "HEALTHY" || files.length === 0)
    return { files: [], status: "NOT_RUN", warnings: [] };
  const result = runCodeGraphCommand(
    ["affected", "--path", repoRoot, "--depth", "2", "--json", ...files],
    repoRoot,
    { timeout: 120_000 }
  );
  if (!result.ok)
    return {
      files: [],
      status: "DEGRADED",
      warnings: [result.stderr || result.error || "CodeGraph affected query failed"]
    };
  const parsed = parseCodeGraphAffected(result.stdout);
  if (parsed === null)
    return {
      files: [],
      status: "DEGRADED",
      warnings: ["CodeGraph affected query returned an unrecognized JSON shape"]
    };
  return { files: parsed, status: "HEALTHY", warnings: [] };
}

function graphifyVersion(tools) {
  return tools?.tools?.find((tool) => tool.tool === "Graphify")?.version || "UNKNOWN";
}

function updateRegistry({
  repoRoot,
  graphHome,
  repository,
  existingRegistry,
  currentSha,
  manifest,
  graphify,
  codegraph,
  freshness,
  changed,
  graphSourceSha,
  graphSourceManifest,
  architectureDelta,
  planningGateStatus,
  architectureDeltaComplete,
  testImpactComplete,
  riskDeltaComplete
}) {
  const currentTreeSha =
    git(repoRoot, ["rev-parse", `${currentSha}^{tree}`], { allowFailure: true }) || null;
  const graphSourceTreeSha = graphSourceSha
    ? git(repoRoot, ["rev-parse", `${graphSourceSha}^{tree}`], { allowFailure: true }) || null
    : null;
  const now = new Date().toISOString();
  const snapshot = {
    current_repo_sha: currentSha,
    graph_source_sha: graphSourceSha,
    current_source_manifest_digest: manifest.manifest_digest,
    current_code_manifest_digest: manifest.code_digest,
    freshness,
    updated_at: now
  };
  const history = Array.isArray(existingRegistry?.history) ? existingRegistry.history : [];
  const historyKey = (entry) =>
    `${entry.current_repo_sha || ""}:${entry.graph_source_sha || ""}:${entry.current_code_manifest_digest || ""}`;
  const nextHistory =
    historyKey(history.at(-1) || {}) === historyKey(snapshot) ? history : [...history, snapshot];
  const freshEnough = ["CURRENT_EXACT_SHA", "CURRENT_CODE_EQUIVALENT"].includes(freshness.state);
  const planningAllowed = ["PLAN_ALLOWED", "PLAN_ALLOWED_WITH_LIMITS"].includes(planningGateStatus);
  const registry = {
    schema_version: SCHEMA_VERSION,
    repository,
    current_repo_sha: currentSha,
    graph_source_sha: graphSourceSha,
    graph_source_tree_sha: graphSourceTreeSha,
    current_repo_tree_sha: currentTreeSha,
    graph_source_manifest_digest: graphSourceManifest?.manifest_digest || null,
    current_source_manifest_digest: manifest.manifest_digest,
    graph_source_code_manifest_digest: graphSourceManifest?.code_digest || null,
    current_code_manifest_digest: manifest.code_digest,
    freshness,
    created_at: existingRegistry?.created_at || now,
    updated_at: now,
    history: nextHistory,
    graphify,
    codegraph,
    source_scope: {
      included: manifest.entries.map((entry) => entry.path),
      excluded: [
        "docs/** except planning reality files",
        ".github/ISSUE_TEMPLATE/**",
        ".git/**",
        "node_modules/**",
        ".codegraph/**"
      ]
    },
    last_delta: { base_sha: graphSourceSha, target_sha: currentSha, changed_files: changed },
    architecture_delta: architectureDelta,
    health: { graphify: graphify.status, codegraph: codegraph.status, source_manifest: "VALID" },
    known_limits: [
      "Graph is evidence, not runtime truth",
      "CodeGraph SQLite/WAL is represented by logical status digest",
      "Graphify parser coverage may be incomplete",
      "automatic_next_start=false"
    ],
    valid_for: {
      architecture_analysis:
        freshEnough && graphify.status === "HEALTHY" && architectureDeltaComplete,
      test_impact:
        freshEnough &&
        (graphify.status === "HEALTHY" || codegraph.status === "HEALTHY") &&
        testImpactComplete,
      planning:
        freshEnough &&
        planningAllowed &&
        architectureDeltaComplete &&
        testImpactComplete &&
        riskDeltaComplete
    },
    automatic_next_start: false
  };
  atomicWrite(registryPath(graphHome, repository), registry);
  return registry;
}

function readSourceManifestForGraph(graphPath) {
  return graphPath
    ? readTextManifest(join(dirname(dirname(graphPath)), "source-manifest.json"))
    : null;
}

function writeReceipt(evidenceRoot, file, value) {
  const path = join(evidenceRoot, "graph-companion", file);
  atomicWrite(
    path,
    value && typeof value === "object" && !Array.isArray(value)
      ? { ...value, automatic_next_start: false }
      : value
  );
  return path;
}

function writeEvidenceDigestManifest(evidenceRoot) {
  const directory = join(evidenceRoot, "graph-companion");
  const files = readdirSync(directory)
    .filter((file) => file.endsWith(".json") || file.endsWith(".md"))
    .sort();
  const lines = files.map(
    (file) => `${sha256(readFileSync(join(directory, file)))}  graph-companion/${file}`
  );
  atomicWrite(join(evidenceRoot, "99-digests.sha256"), `${lines.join("\n")}\n`);
}

function summaryMarkdown({
  registry,
  toolHealth,
  freshness,
  architectureDelta,
  testImpact,
  riskDelta,
  planningReality,
  planningGate,
  evidenceRoot
}) {
  return [
    "# SimWar Graph Companion V1",
    "",
    `- Current master SHA: ${registry.current_repo_sha || "UNKNOWN"}`,
    `- Graph source SHA: ${registry.graph_source_sha || "NONE"}`,
    `- Freshness: ${freshness.state}`,
    `- Graphify: ${registry.graphify.status} (${registry.graphify.node_count} nodes / ${registry.graphify.edge_count} edges)`,
    `- CodeGraph: ${registry.codegraph.status} (${registry.codegraph.indexed_files ?? "UNKNOWN"} files / ${registry.codegraph.node_count ?? "UNKNOWN"} nodes / ${registry.codegraph.edge_count ?? "UNKNOWN"} edges)`,
    `- Architecture delta: ${architectureDelta.confidence}`,
    `- Test Impact: ${testImpact.complete ? "PASS" : "FAIL"} (${testImpact.recommendations.length} recommendations)`,
    `- Risk Delta: ${riskDelta.complete ? "PASS" : "FAIL"}`,
    `- Planning Reality: ${planningReality.status}`,
    `- Planning Gate: ${planningGate.status}`,
    `- Product Value Drift: ${planningReality.product_value_drift}`,
    `- Tool health: ${toolHealth.github_workflow}`,
    `- Evidence root: ${evidenceRoot}`,
    "- Graph authority: evidence only; current Git source remains truth.",
    "- automatic_next_start: false",
    ""
  ].join("\n");
}

function resolveCurrentSha(repoRoot, requestedSha) {
  if (requestedSha)
    return git(repoRoot, ["rev-parse", `${requestedSha}^{commit}`], { allowFailure: true }) || null;
  return git(repoRoot, ["rev-parse", "HEAD"], { allowFailure: true }) || null;
}

function ensureEvidenceRoot(path) {
  return ensureDirectory(
    path ||
      join(
        tmpdir(),
        `E-SIMWAR-GRAPH-COMPANION-V1-${new Date().toISOString().replace(/[-:.]/gu, "")}`
      )
  );
}

export function assertExternalGraphHome(graphHome, repoRoot) {
  const home = resolve(graphHome);
  const root = resolve(repoRoot);
  const relativePath = relative(root, home);
  const insideSource =
    relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
  if (insideSource) throw new Error("Graph home must be outside the source worktree");
  return home;
}

export function runCompanion({
  mode = "entry",
  repoRoot = DEFAULT_REPO_ROOT,
  evidenceRoot,
  graphHome,
  baseSha = null,
  targetSha = null,
  currentSha = null
} = {}) {
  if (!VALID_MODES.has(mode)) throw new Error(`Unsupported Graph Companion mode: ${mode}`);
  if (mode === "impact" && (!baseSha || !targetSha))
    throw new Error("impact mode requires both --base and --target SHAs");
  const root = resolve(repoRoot);
  const dirty = git(root, ["status", "--porcelain", "--untracked-files=all"], {
    allowFailure: true
  });
  if (dirty) throw new Error("Graph Companion requires a clean worktree");
  if (mode === "postmerge") {
    const symbolicHead = git(root, ["symbolic-ref", "--quiet", "--short", "HEAD"], {
      allowFailure: true
    });
    if (dirty || symbolicHead)
      throw new Error("postmerge mode requires a clean detached repository");
  }
  const repositoryHead = resolveCurrentSha(root, null);
  if (mode === "postmerge" && repositoryHead) {
    const parents = git(root, ["rev-list", "--parents", "-n", "1", repositoryHead], {
      allowFailure: true
    }).split(/\s+/u);
    if (parents.length < 3) throw new Error("postmerge mode requires a two-parent merge commit");
  }
  if (!repositoryHead) {
    const blockedEvidence = ensureEvidenceRoot(evidenceRoot);
    const blockedHome = assertExternalGraphHome(resolve(graphHome || resolveGraphHome()), root);
    const blockedRepository = parseRepository(getRemote(root), root);
    const blockedTools = discoverTools({ cwd: root });
    const blockedFreshness = {
      schema_version: OUTPUT_SCHEMA_VERSION,
      state: "BLOCKED_GRAPH_TOOLING",
      reason: "current repository SHA could not be resolved",
      limits: ["CURRENT_REALITY_UNRESOLVED"]
    };
    const blockedGate = evaluatePlanningGate({
      freshness: blockedFreshness.state,
      freshnessLimits: blockedFreshness.limits,
      architectureDeltaComplete: false,
      testImpactComplete: false,
      riskDeltaComplete: false,
      planningReality: "PLANNING_REALITY_MISSING",
      codeGraphStatus: "DEGRADED_CODEGRAPH"
    });
    const blockedGraphify = {
      status: "GRAPH_NOT_FOUND",
      version: graphifyVersion(blockedTools),
      path: null,
      logical_digest: "DIGEST_UNAVAILABLE",
      node_count: 0,
      edge_count: 0,
      warnings: ["current repository SHA unavailable"]
    };
    const blockedCodegraph = {
      status: "DEGRADED_CODEGRAPH",
      version: blockedTools.tools?.find((tool) => tool.tool === "CodeGraph")?.version || "UNKNOWN",
      path: join(root, ".codegraph"),
      logical_digest: "DIGEST_UNAVAILABLE",
      indexed_files: 0,
      node_count: 0,
      edge_count: 0,
      pending_changes: null,
      warnings: ["current repository SHA unavailable"]
    };
    const blockedRegistry = {
      schema_version: SCHEMA_VERSION,
      repository: blockedRepository,
      current_repo_sha: null,
      graph_source_sha: null,
      graph_home: blockedHome,
      graphify: blockedGraphify,
      codegraph: blockedCodegraph,
      freshness: blockedFreshness,
      automatic_next_start: false
    };
    writeReceipt(blockedEvidence, "graph-state.json", blockedRegistry);
    writeReceipt(blockedEvidence, "tool-health.json", blockedTools);
    writeReceipt(blockedEvidence, "source-manifest.json", {
      schema_version: OUTPUT_SCHEMA_VERSION,
      entries: [],
      manifest_digest: null,
      code_digest: null,
      planning_files: [],
      automatic_next_start: false
    });
    writeReceipt(blockedEvidence, "freshness.json", {
      before: blockedFreshness,
      after: blockedFreshness,
      current_repo_sha: null,
      graph_source_sha: null
    });
    writeReceipt(blockedEvidence, "refresh-receipt.json", {
      schema_version: OUTPUT_SCHEMA_VERSION,
      status: "BLOCKED_GRAPH_TOOLING",
      reason: blockedFreshness.reason
    });
    writeReceipt(blockedEvidence, "architecture-delta.json", {
      schema_version: OUTPUT_SCHEMA_VERSION,
      confidence: "LOW",
      modified_files: [],
      unmapped_changed_files: [],
      automatic_next_start: false
    });
    writeReceipt(blockedEvidence, "test-impact.json", {
      schema_version: OUTPUT_SCHEMA_VERSION,
      max_depth: 2,
      recommendations: [],
      complete: false,
      graph_source: "SOURCE_PATH_FALLBACK"
    });
    writeReceipt(blockedEvidence, "risk-delta.json", {
      schema_version: OUTPUT_SCHEMA_VERSION,
      findings: [],
      complete: false
    });
    writeReceipt(blockedEvidence, "planning-reality.json", {
      schema_version: OUTPUT_SCHEMA_VERSION,
      status: "PLANNING_REALITY_MISSING",
      documents: []
    });
    writeReceipt(blockedEvidence, "planning-gate.json", blockedGate);
    atomicWrite(
      join(blockedEvidence, "graph-companion", "summary.md"),
      [
        "# SimWar Graph Companion V1",
        "",
        "- Freshness: BLOCKED_GRAPH_TOOLING",
        "- Planning Gate: BLOCKED_GRAPH_TOOLING",
        "- automatic_next_start: false",
        ""
      ].join("\n")
    );
    writeEvidenceDigestManifest(blockedEvidence);
    return {
      registry: blockedRegistry,
      tools: blockedTools,
      freshness: blockedFreshness,
      refreshReceipt: { status: "BLOCKED_GRAPH_TOOLING" },
      architectureDelta: null,
      testImpact: { complete: false },
      riskDelta: { complete: false },
      planningReality: { status: "PLANNING_REALITY_MISSING" },
      planningGate: blockedGate,
      evidenceRoot: blockedEvidence
    };
  }
  const validatedBase = baseSha ? resolveCurrentSha(root, baseSha) : null;
  const validatedTarget = targetSha ? resolveCurrentSha(root, targetSha) : null;
  const current =
    mode === "impact" ? repositoryHead : resolveCurrentSha(root, currentSha || targetSha);
  if (!current) throw new Error("Unable to resolve current source SHA");
  if (mode !== "impact" && current !== repositoryHead)
    throw new Error("requested SHA must match the checked-out repository HEAD");
  if (baseSha && !validatedBase) throw new Error(`Unable to resolve base SHA: ${baseSha}`);
  if (targetSha && !validatedTarget) throw new Error(`Unable to resolve target SHA: ${targetSha}`);
  const analysisTarget = mode === "impact" ? validatedTarget || current : current;
  const evidence = ensureEvidenceRoot(evidenceRoot);
  const home = assertExternalGraphHome(resolve(graphHome || resolveGraphHome()), root);
  const repository = parseRepository(getRemote(root), root);
  const existingRegistry = loadRegistry(home, repository);
  const currentManifest = readRepositoryManifest(root);
  const analysisManifest =
    mode === "impact" && analysisTarget !== repositoryHead
      ? readRepositoryManifestAtSha(root, analysisTarget) || currentManifest
      : currentManifest;
  const tools = discoverTools({ cwd: root });
  const existingGraphSource = existingRegistry?.graph_source_sha || null;
  const graphPath = existingRegistry?.graphify?.path || null;
  const graphManifest = readSourceManifestForGraph(graphPath);
  const existingGraph = readGraph(graphPath);
  const sourceForDiff = validatedBase || existingGraphSource;
  const priorGraph = sourceForDiff
    ? readGraph(join(sourceGraphPath(home, repository, sourceForDiff), "graphify", "graph.json"))
    : existingGraph;
  const changeEntries = changedFileEntries(root, validatedBase || sourceForDiff, analysisTarget);
  const changed = changeEntries.map((entry) => entry.path);
  const freshnessBefore = classifyFreshness({
    currentRepoSha: current,
    graphSourceSha: existingGraphSource,
    currentCodeManifestDigest: currentManifest.code_digest,
    graphCodeManifestDigest:
      graphManifest?.code_digest || existingRegistry?.graph_source_code_manifest_digest || null,
    changedFiles: changed,
    graphFound: Boolean(existingGraph),
    sourceAvailable: true
  });
  let graphify = existingRegistry?.graphify || {
    status: "GRAPH_NOT_FOUND",
    version: graphifyVersion(tools),
    path: null,
    logical_digest: "DIGEST_UNAVAILABLE",
    node_count: 0,
    edge_count: 0,
    warnings: []
  };
  let graphSourceSha = existingGraphSource;
  let graphSourceManifest = graphManifest;
  let refreshReceipt = {
    schema_version: OUTPUT_SCHEMA_VERSION,
    status: "NOT_REQUIRED",
    reason: freshnessBefore.state,
    source_sha: graphSourceSha,
    generated_at: new Date().toISOString()
  };
  const shouldRefresh =
    ["entry", "refresh", "postmerge"].includes(mode) &&
    ["GRAPH_NOT_FOUND", "STALE_PRODUCT_DELTA", "STALE_REBUILD_REQUIRED"].includes(
      freshnessBefore.state
    );
  if (shouldRefresh) {
    graphify = runGraphifyRefresh({
      repoRoot: root,
      repository,
      graphHome: home,
      currentSha: current,
      manifest: currentManifest,
      tools: {
        graphify_available: tools.graphify_available,
        graphify_version: graphifyVersion(tools)
      }
    });
    refreshReceipt = {
      schema_version: OUTPUT_SCHEMA_VERSION,
      status: graphify.status === "HEALTHY" ? "PASS" : "BLOCKED_GRAPHIFY",
      source_sha: current,
      mode,
      reused: graphify.reused || false,
      warnings: graphify.warnings,
      generated_at: new Date().toISOString()
    };
    if (graphify.status === "HEALTHY") {
      graphSourceSha = current;
      graphSourceManifest = currentManifest;
    }
  }
  const codegraph =
    mode === "plan"
      ? existingRegistry?.codegraph || {
          status: "DEGRADED_CODEGRAPH",
          path: join(root, ".codegraph"),
          logical_digest: "DIGEST_UNAVAILABLE",
          indexed_files: 0,
          node_count: 0,
          edge_count: 0,
          pending_changes: null,
          version: "UNKNOWN",
          warnings: ["plan mode does not run CodeGraph indexing"]
        }
      : runCodeGraphIndex({
          repoRoot: root,
          tools,
          graphHome: home,
          repository,
          currentSha: current
        });
  const graph = readGraph(graphify.path);
  const finalFreshness = classifyFreshness({
    currentRepoSha: current,
    graphSourceSha,
    currentCodeManifestDigest: currentManifest.code_digest,
    graphCodeManifestDigest: graphSourceManifest?.code_digest || null,
    changedFiles: changed,
    graphFound: Boolean(graph),
    sourceAvailable: true
  });
  const delta = buildArchitectureDelta({
    baseSha: validatedBase || sourceForDiff,
    targetSha: analysisTarget,
    changedFiles: changed,
    changedFileEntries: changeEntries,
    graph,
    priorGraph
  });
  const codeGraphAffectedResult = codeGraphAffected(
    codegraph.workspace_root || root,
    changed,
    codegraph.status
  );
  const impact = buildTestImpact({
    changedFiles: changed,
    graph,
    codeGraphAffected: codeGraphAffectedResult.files,
    codeGraphStatus: codegraph.status,
    codeGraphAffectedStatus: codeGraphAffectedResult.status
  });
  impact.source_sha = validatedBase || sourceForDiff;
  impact.target_sha = analysisTarget;
  impact.target_manifest_digest = analysisManifest.manifest_digest;
  impact.target_code_manifest_digest = analysisManifest.code_digest;
  impact.codegraph_affected_status = codeGraphAffectedResult.status;
  impact.codegraph_affected_warnings = codeGraphAffectedResult.warnings;
  impact.graph_source_sha = graphSourceSha;
  impact.historical_target_uses_current_graph =
    mode === "impact" && analysisTarget !== repositoryHead;
  const risk = buildRiskDelta({ changedFiles: changed, graph, testImpact: impact });
  const planningReality = readPlanningReality({ repoRoot: root, currentSha: current });
  const freshnessLimits = [...finalFreshness.limits];
  if (mode === "impact" && analysisTarget !== repositoryHead)
    freshnessLimits.push("HISTORICAL_IMPACT_USES_CURRENT_GRAPH_EVIDENCE");
  const planningHealth =
    codegraph.status !== "HEALTHY"
      ? codegraph.status
      : graphify.status !== "HEALTHY"
        ? "DEGRADED_GRAPHIFY"
        : "HEALTHY";
  const architectureDeltaComplete = Boolean(
    delta &&
    Array.isArray(delta.unmapped_changed_files) &&
    delta.unmapped_changed_files.filter(isProductDelta).length === 0
  );
  const planningGate = evaluatePlanningGate({
    freshness: finalFreshness.state,
    freshnessLimits,
    architectureDeltaComplete,
    testImpactComplete: impact.complete,
    riskDeltaComplete: risk.complete,
    planningReality: planningReality.status,
    codeGraphStatus: planningHealth,
    riskFindings: risk.findings
  });
  const registry =
    mode === "plan"
      ? existingRegistry || {
          schema_version: SCHEMA_VERSION,
          repository,
          current_repo_sha: current,
          graph_source_sha: graphSourceSha,
          graphify,
          codegraph,
          freshness: finalFreshness,
          automatic_next_start: false
        }
      : updateRegistry({
          repoRoot: root,
          graphHome: home,
          repository,
          existingRegistry,
          currentSha: current,
          manifest: currentManifest,
          graphify,
          codegraph,
          freshness: finalFreshness,
          changed,
          graphSourceSha,
          graphSourceManifest,
          architectureDelta: delta,
          planningGateStatus: planningGate.status,
          architectureDeltaComplete,
          testImpactComplete: impact.complete,
          riskDeltaComplete: risk.complete
        });
  const graphState = {
    schema_version: OUTPUT_SCHEMA_VERSION,
    repository,
    registry_path: registryPath(home, repository),
    graph_home: home,
    current_repo_sha: current,
    graph_source_sha: graphSourceSha,
    graphify,
    codegraph,
    freshness: finalFreshness,
    automatic_next_start: false
  };
  writeReceipt(evidence, "graph-state.json", graphState);
  writeReceipt(evidence, "tool-health.json", tools);
  writeReceipt(evidence, "source-manifest.json", currentManifest);
  writeReceipt(evidence, "freshness.json", {
    schema_version: OUTPUT_SCHEMA_VERSION,
    before: freshnessBefore,
    after: finalFreshness,
    current_repo_sha: current,
    graph_source_sha: graphSourceSha,
    changed_files: changed,
    limits: freshnessLimits,
    planning_gate: planningGate.status,
    automatic_next_start: false
  });
  writeReceipt(evidence, "refresh-receipt.json", refreshReceipt);
  writeReceipt(evidence, "architecture-delta.json", delta);
  writeReceipt(evidence, "test-impact.json", impact);
  if (mode === "impact" && analysisTarget !== repositoryHead)
    writeReceipt(evidence, "target-source-manifest.json", analysisManifest);
  writeReceipt(evidence, "risk-delta.json", risk);
  writeReceipt(evidence, "planning-reality.json", planningReality);
  writeReceipt(evidence, "planning-gate.json", planningGate);
  atomicWrite(
    join(evidence, "graph-companion", "summary.md"),
    summaryMarkdown({
      registry,
      toolHealth: tools,
      freshness: finalFreshness,
      architectureDelta: delta,
      testImpact: impact,
      riskDelta: risk,
      planningReality,
      planningGate,
      evidenceRoot: evidence
    })
  );
  writeEvidenceDigestManifest(evidence);
  return {
    registry,
    tools,
    freshness: finalFreshness,
    refreshReceipt,
    architectureDelta: delta,
    testImpact: impact,
    riskDelta: risk,
    planningReality,
    planningGate,
    evidenceRoot: evidence
  };
}

function parseArgs(argv) {
  const options = { mode: "entry" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode") options.mode = argv[++index];
    else if (arg === "--repo") options.repoRoot = argv[++index];
    else if (arg === "--evidence-root") options.evidenceRoot = argv[++index];
    else if (arg === "--graph-home") options.graphHome = argv[++index];
    else if (arg === "--base") options.baseSha = argv[++index];
    else if (arg === "--target") options.targetSha = argv[++index];
    else if (arg === "--current-sha") options.currentSha = argv[++index];
    else if (arg === "--json") options.json = true;
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    const result = runCompanion(parseArgs(process.argv.slice(2)));
    if (parseArgs(process.argv.slice(2)).json) console.log(JSON.stringify(result, null, 2));
    else
      console.log(
        `Graph Companion ${result.planningGate.status}: ${result.registry.current_repo_sha} (graph ${result.registry.graph_source_sha || "NONE"})`
      );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
