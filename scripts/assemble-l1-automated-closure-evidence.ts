import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createL1AutomatedClosureEvidencePack,
  type L1AutomatedClosureEvidenceInput
} from "../services/api/src/l1-internal-validation-ready-package.js";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");
const coreEvidenceFilenames = {
  evidence_order: "phase7-evidence-order.json",
  run_a: "run-a-evidence.json",
  run_a_freeze: "run-a-freeze.json",
  run_b_lifecycle: "run-b-lifecycle.json"
} as const;

const usage = [
  "Usage: npm run evidence:l1:assemble -- --facts <facts.json> --core-evidence-dir <directory> --known-limits <readback.json> --output <pack.json>",
  "",
  "Reads external, source-SHA-bound automated evidence and writes one new external L1 closure pack.",
  "The command does not modify repository source, runtime state, Truth, or existing evidence."
].join("\n");

type Arguments = {
  coreEvidenceDirectory: string;
  factsPath: string;
  knownLimitsPath: string;
  outputPath: string;
};

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function readJson(path: string): { bytes: Buffer; payload: Record<string, unknown> } {
  const bytes = readFileSync(path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(`Evidence JSON is invalid: ${path}`);
  }
  return { bytes, payload: assertRecord(parsed, path) };
}

function parseArguments(args: string[]): Arguments {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (!option?.startsWith("--")) {
      throw new Error(`Unknown argument: ${option ?? ""}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${option}`);
    }
    values.set(option, value);
    index += 1;
  }
  const factsPath = values.get("--facts");
  const coreEvidenceDirectory = values.get("--core-evidence-dir");
  const knownLimitsPath = values.get("--known-limits");
  const outputPath = values.get("--output");
  if (
    !factsPath ||
    !coreEvidenceDirectory ||
    !knownLimitsPath ||
    !outputPath ||
    values.size !== 4
  ) {
    throw new Error(usage);
  }
  return { coreEvidenceDirectory, factsPath, knownLimitsPath, outputPath };
}

function assertExternalNewOutput(outputPath: string): string {
  if (!isAbsolute(outputPath)) {
    throw new Error("L1 closure evidence output must use an absolute path");
  }
  const resolvedOutput = resolve(outputPath);
  const relation = relative(repositoryRoot, resolvedOutput);
  if (relation === "" || (!relation.startsWith("..") && !isAbsolute(relation))) {
    throw new Error("L1 closure evidence output must be outside the repository");
  }
  if (existsSync(resolvedOutput)) {
    throw new Error("L1 closure evidence output already exists and cannot be overwritten");
  }
  return resolvedOutput;
}

function buildInput(args: Arguments): L1AutomatedClosureEvidenceInput {
  const facts = readJson(resolve(args.factsPath)).payload;
  const evidenceDirectory = resolve(args.coreEvidenceDirectory);
  const readArtifact = (filename: string) => {
    const artifact = readJson(resolve(evidenceDirectory, filename));
    return { payload: artifact.payload, sha256: sha256(artifact.bytes) };
  };
  const knownLimits = readJson(resolve(args.knownLimitsPath));
  return {
    current_facts: facts.current_facts as L1AutomatedClosureEvidenceInput["current_facts"],
    human_validation: facts.human_validation as L1AutomatedClosureEvidenceInput["human_validation"],
    known_limits: {
      payload: knownLimits.payload,
      sha256: sha256(knownLimits.bytes)
    },
    phase7_core: {
      evidence_order: readArtifact(coreEvidenceFilenames.evidence_order),
      run_a: readArtifact(coreEvidenceFilenames.run_a),
      run_a_freeze: readArtifact(coreEvidenceFilenames.run_a_freeze),
      run_b_lifecycle: readArtifact(coreEvidenceFilenames.run_b_lifecycle)
    }
  };
}

function main(): number {
  const args = parseArguments(process.argv.slice(2));
  const outputPath = assertExternalNewOutput(args.outputPath);
  const pack = createL1AutomatedClosureEvidencePack(buildInput(args));
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(pack, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ output_path: outputPath, pack }, null, 2));
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "L1 closure evidence assembly failed");
  process.exitCode = 1;
}
