import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildW5AuthorityCensus,
  freezeW5CurrentBaseline,
  reproduceW5ModelBaseline
} from "../services/api/src/w5-formal-rebase.js";

const workspaceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const startMaster = process.env.W5_HEAD_SHA ?? "";
const treeSha = process.env.W5_TREE_SHA ?? "";
const missionLineage = process.env.W5_MISSION_LINEAGE_ID ?? "";
const missionStart = process.env.W5_MISSION_START_UTC ?? "";
const timestamp = process.env.W5_EVIDENCE_TIMESTAMP ?? new Date().toISOString();
const outputDir = resolve(
  process.env.W5_EVIDENCE_OUTPUT_DIR ?? resolve(workspaceRoot, "docs/evidence/w5-formal-rebase")
);

function required(name: string, value: string): string {
  if (!value) throw new Error(`missing required environment variable ${name}`);
  return value;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function gitValue(expression: string): string {
  return execFileSync("git", ["rev-parse", expression], {
    cwd: workspaceRoot,
    encoding: "utf8"
  }).trim();
}

function gitStatus(): string {
  return execFileSync("git", ["status", "--porcelain"], {
    cwd: workspaceRoot,
    encoding: "utf8"
  }).trim();
}

const actualHead = gitValue("HEAD");
const actualTree = gitValue("HEAD^{tree}");
const head = required("W5_HEAD_SHA", startMaster);
const tree = treeSha || actualTree;
if (head !== actualHead) throw new Error("W5_FORMAL_REBASE_HEAD_MISMATCH");
if (tree !== actualTree) throw new Error("W5_FORMAL_REBASE_TREE_MISMATCH");
if (gitStatus()) throw new Error("W5_FORMAL_REBASE_WORKTREE_NOT_CLEAN");
const lineage = required("W5_MISSION_LINEAGE_ID", missionLineage);
const missionStartUtc = required("W5_MISSION_START_UTC", missionStart);
const packageLockPath = resolve(workspaceRoot, "package-lock.json");
const coreModelPath = resolve(
  workspaceRoot,
  "services/simulation-core/src/eldercare-core-model.ts"
);
const convergencePath = resolve(
  workspaceRoot,
  "services/simulation-core/src/w5-governed-convergence.ts"
);
const runnerPath = resolve(workspaceRoot, "services/api/src/w5-formal-rebase.ts");
if (
  !existsSync(packageLockPath) ||
  !existsSync(coreModelPath) ||
  !existsSync(convergencePath) ||
  !existsSync(runnerPath)
) {
  throw new Error("W5_FORMAL_REBASE_REQUIRED_ARTIFACT_MISSING");
}

const environmentFingerprint = [
  `node=${process.version}`,
  `platform=${process.platform}/${process.arch}`,
  `package_lock_sha256=${sha256File(packageLockPath)}`,
  `core_model_sha256=${sha256File(coreModelPath)}`,
  `convergence_sha256=${sha256File(convergencePath)}`,
  `runner_sha256=${sha256File(runnerPath)}`
].join(";");

const context = {
  command: "npm run test:w5:formal-rebase",
  environment_fingerprint: environmentFingerprint,
  head_sha: head,
  mission_lineage_id: lineage,
  mission_start_utc: missionStartUtc,
  timestamp,
  tree_sha: tree,
  artifact_digests: {
    "simwar.w5.capacity.v1": sha256File(coreModelPath),
    "simwar.w5.core_realized.v1": sha256File(convergencePath),
    "simwar.w5.finance.v1": sha256File(coreModelPath),
    "simwar.w5.quality_risk.v1": sha256File(coreModelPath),
    "simwar.w5.shanghai.v1": sha256File(coreModelPath),
    "simwar.w5.synthetic_want.v1": sha256File(runnerPath),
    "simwar.w5.workforce.v1": sha256File(coreModelPath)
  }
};

const census = buildW5AuthorityCensus(context);
const reproduction = reproduceW5ModelBaseline(context, census);
const baseline = freezeW5CurrentBaseline(context, census, reproduction);
mkdirSync(outputDir, { recursive: true });

function writeJson(name: string, value: unknown): void {
  writeFileSync(resolve(outputDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

writeJson("2026-08-20-w5-formal-rebase-rb1.json", census);
writeJson("2026-08-20-w5-formal-rebase-rb2.json", reproduction);
writeJson("2026-08-20-w5-formal-rebase-rb3.json", baseline);
writeJson("2026-08-20-w5-formal-rebase-product-manifest.json", {
  evidence_after_mission_start: true,
  evidence_files: [
    "2026-08-20-w5-formal-rebase-rb1.json",
    "2026-08-20-w5-formal-rebase-rb2.json",
    "2026-08-20-w5-formal-rebase-rb3.json"
  ],
  head_sha: head,
  mission_id: "SIMWAR-W5-FORMAL-REBASE-COMPLETION-V5.8-20260820",
  mission_lineage_id: lineage,
  mission_start_utc: missionStartUtc,
  model_family_disposition: {
    current: census.entries
      .filter((entry) => entry.classification === "CURRENT")
      .map((entry) => entry.family),
    missing_or_deferred: census.entries
      .filter((entry) => entry.classification === "MISSING" || entry.classification === "DEFERRED")
      .map((entry) => entry.family),
    research: census.entries
      .filter((entry) => entry.classification === "RESEARCH")
      .map((entry) => entry.family),
    shadow: census.entries
      .filter((entry) => entry.classification === "SHADOW")
      .map((entry) => entry.family)
  },
  product_head_readback: process.env.W5_PRODUCT_HEAD ?? "RECORDED_IN_PR_READBACK",
  statuses: {
    m_rb1: census.status,
    m_rb2: reproduction.status,
    m_rb3: baseline.status
  },
  timestamp,
  tree_sha: tree
});

console.log(
  JSON.stringify(
    {
      output_dir: outputDir,
      m_rb1: census.status,
      m_rb2: reproduction.status,
      m_rb3: baseline.status,
      evidence_files: 4,
      mission_lineage_id: lineage
    },
    null,
    2
  )
);
