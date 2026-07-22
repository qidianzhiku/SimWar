import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeSync
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { TestInfo } from "@playwright/test";

export const RUN_A_DURABLE_FREEZE_GATE = "RUN_A_DURABLE_FREEZE_GATE";

const evidenceFilenames = [
  "run-a-evidence.json",
  "run-a-freeze.json",
  "phase7-evidence-order.json",
  "run-b-lifecycle.json"
] as const;

const forbiddenEvidenceKeys = new Set([
  "access_token",
  "authorization",
  "cookie",
  "jwt_secret",
  "password",
  "private_parameter_set",
  "private_replay",
  "replay_manifest",
  "secret",
  "state_true",
  "token"
]);

const forbiddenValuePatterns = [
  /\bbearer\s+[a-z0-9._~-]+/i,
  /\b(?:todo|tbd|placeholder)\b/i,
  /<[^>]*(?:current|yyyy|actual|fill|placeholder)[^>]*>/i,
  /\bstate_true\b/i,
  /\bReplayManifest\b/,
  /\bprivate\s+(?:ParameterSet|Replay)\b/i
];

export type Phase7EvidenceFilename = (typeof evidenceFilenames)[number];

export type Phase7EvidenceReceipt = Readonly<{
  attachment: Readonly<{
    content_type: "application/json";
    mode: "PATH";
    name: string;
  }>;
  bytes: number;
  filename: Phase7EvidenceFilename;
  json_validation: "PASS";
  path_mode: "TEST_INFO_OUTPUT_PATH";
  readback_completed_at: string;
  relative_output_path: Phase7EvidenceFilename;
  sha256: string;
  temporary_residue_count: 0;
  write_started_at: string;
}>;

export type Phase7EvidenceReadback = Readonly<{
  payload: Readonly<Record<string, unknown>>;
  receipt: Phase7EvidenceReceipt;
  verified_at: string;
}>;

type EvidenceTestInfo = Pick<TestInfo, "attach" | "outputDir" | "outputPath">;

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeEvidenceValue(value: unknown, path: string): unknown {
  if (value === undefined) {
    throw new Error(`Phase 7 evidence contains undefined at ${path}`);
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Phase 7 evidence contains a non-finite number at ${path}`);
    }
    return value;
  }
  if (typeof value === "string") {
    for (const pattern of forbiddenValuePatterns) {
      if (pattern.test(value)) {
        throw new Error(`Phase 7 evidence contains a forbidden value at ${path}`);
      }
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => normalizeEvidenceValue(entry, `${path}[${index}]`));
  }
  if (typeof value !== "object") {
    throw new Error(`Phase 7 evidence contains an unsupported value at ${path}`);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`Phase 7 evidence requires plain objects at ${path}`);
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => {
        const normalizedKey = key.toLowerCase().replaceAll("-", "_");
        if (
          forbiddenEvidenceKeys.has(normalizedKey) ||
          normalizedKey.endsWith("_password") ||
          normalizedKey.endsWith("_secret") ||
          normalizedKey.endsWith("_token")
        ) {
          throw new Error(`Phase 7 evidence contains a forbidden key at ${path}.${key}`);
        }
        return [key, normalizeEvidenceValue(record[key], `${path}.${key}`)];
      })
  );
}

function serializeEvidence(payload: Record<string, unknown>): Buffer {
  const normalized = normalizeEvidenceValue(payload, "$");
  if (!normalized || Array.isArray(normalized) || typeof normalized !== "object") {
    throw new Error("Phase 7 evidence payload must be a top-level object");
  }
  return Buffer.from(`${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

function assertEvidenceFilename(filename: string): asserts filename is Phase7EvidenceFilename {
  if (!(evidenceFilenames as readonly string[]).includes(filename)) {
    throw new Error(`Phase 7 evidence filename is not allowlisted: ${filename}`);
  }
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    throw new Error(`Phase 7 evidence filename is unsafe: ${filename}`);
  }
}

function resolveEvidencePath(testInfo: EvidenceTestInfo, filename: Phase7EvidenceFilename): string {
  const outputDirectory = resolve(testInfo.outputDir);
  const finalPath = resolve(testInfo.outputPath(filename));
  const relativePath = relative(outputDirectory, finalPath).replaceAll("\\", "/");
  if (relativePath !== filename || isAbsolute(relativePath)) {
    throw new Error("Phase 7 evidence path escaped the Playwright test output directory");
  }
  return finalPath;
}

function parseCanonicalPayload(bytes: Buffer): Readonly<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Phase 7 evidence JSON readback failed");
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Phase 7 evidence readback is not a top-level object");
  }
  const canonicalBytes = serializeEvidence(parsed as Record<string, unknown>);
  if (!canonicalBytes.equals(bytes)) {
    throw new Error("Phase 7 evidence readback is not canonical");
  }
  return Object.freeze(parsed as Record<string, unknown>);
}

export function assertExternalPhase7EvidencePath(outputFile: string, repositoryRoot: string): void {
  const resolvedOutput = resolve(outputFile);
  const resolvedRepository = resolve(repositoryRoot);
  const relation = relative(resolvedRepository, resolvedOutput);
  if (relation === "" || (!relation.startsWith("..") && !isAbsolute(relation))) {
    throw new Error("Formal Phase 7 evidence output must be outside the repository");
  }
}

export async function persistPhase7EvidenceFile(
  testInfo: EvidenceTestInfo,
  filenameInput: string,
  payload: Record<string, unknown>
): Promise<Phase7EvidenceReceipt> {
  assertEvidenceFilename(filenameInput);
  const filename = filenameInput;
  const finalPath = resolveEvidencePath(testInfo, filename);
  const outputDirectory = dirname(finalPath);
  const temporaryPath = `${finalPath}.${process.pid}.${randomUUID()}.tmp`;
  const bytes = serializeEvidence(payload);
  const writeStartedAt = new Date().toISOString();
  let descriptor: number | undefined;
  let published = false;

  mkdirSync(outputDirectory, { recursive: true });
  if (existsSync(finalPath)) {
    throw new Error(`Phase 7 evidence file already exists: ${filename}`);
  }

  try {
    descriptor = openSync(temporaryPath, "wx", 0o600);
    writeSync(descriptor, bytes, 0, bytes.length, null);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;

    // A same-directory hard link atomically publishes without overwriting an existing final file.
    linkSync(temporaryPath, finalPath);
    published = true;
    unlinkSync(temporaryPath);

    const readbackBytes = readFileSync(finalPath);
    if (!readbackBytes.equals(bytes)) {
      throw new Error(`Phase 7 evidence byte readback failed: ${filename}`);
    }
    parseCanonicalPayload(readbackBytes);

    const receipt: Phase7EvidenceReceipt = Object.freeze({
      attachment: Object.freeze({
        content_type: "application/json",
        mode: "PATH",
        name: filename
      }),
      bytes: readbackBytes.length,
      filename,
      json_validation: "PASS",
      path_mode: "TEST_INFO_OUTPUT_PATH",
      readback_completed_at: new Date().toISOString(),
      relative_output_path: filename,
      sha256: sha256(readbackBytes),
      temporary_residue_count: 0,
      write_started_at: writeStartedAt
    });

    await testInfo.attach(filename, {
      contentType: "application/json",
      path: finalPath
    });
    return receipt;
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    rmSync(temporaryPath, { force: true });
    if (published) rmSync(finalPath, { force: true });
    throw error;
  }
}

export function readBackPhase7EvidenceFile(
  testInfo: EvidenceTestInfo,
  receipt: Phase7EvidenceReceipt
): Phase7EvidenceReadback {
  assertEvidenceFilename(receipt.filename);
  if (
    receipt.relative_output_path !== receipt.filename ||
    receipt.path_mode !== "TEST_INFO_OUTPUT_PATH" ||
    receipt.json_validation !== "PASS" ||
    receipt.temporary_residue_count !== 0
  ) {
    throw new Error(`Phase 7 evidence receipt is invalid: ${receipt.filename}`);
  }

  const finalPath = resolveEvidencePath(testInfo, receipt.filename);
  const bytes = readFileSync(finalPath);
  if (bytes.length !== receipt.bytes || sha256(bytes) !== receipt.sha256) {
    throw new Error(`Phase 7 evidence hash readback failed: ${receipt.filename}`);
  }

  return Object.freeze({
    payload: parseCanonicalPayload(bytes),
    receipt,
    verified_at: new Date().toISOString()
  });
}

export function assertRunADurableFreezeGate(input: {
  evidence: Phase7EvidenceReadback;
  expectedRunId: string;
  expectedSourceSha: string;
  freeze: Phase7EvidenceReadback;
}): Readonly<{
  evidence_sha256: string;
  freeze_sha256: string;
  gate: typeof RUN_A_DURABLE_FREEZE_GATE;
  status: "PASS";
}> {
  const { evidence, expectedRunId, expectedSourceSha, freeze } = input;
  if (!/^[0-9a-f]{40}$/.test(expectedSourceSha)) {
    throw new Error("Run A durable freeze gate requires an exact source SHA");
  }
  if (evidence.receipt.filename !== "run-a-evidence.json") {
    throw new Error("Run A durable freeze gate received the wrong evidence file");
  }
  if (freeze.receipt.filename !== "run-a-freeze.json") {
    throw new Error("Run A durable freeze gate received the wrong freeze file");
  }

  const payload = freeze.payload;
  if (
    payload.gate !== RUN_A_DURABLE_FREEZE_GATE ||
    payload.gate_status !== "PASS" ||
    payload.frozen_before_run_b !== true ||
    payload.run_b_creation_allowed !== true ||
    payload.run_id !== expectedRunId ||
    payload.source_sha !== expectedSourceSha ||
    payload.run_a_evidence_sha256 !== evidence.receipt.sha256
  ) {
    throw new Error("RUN_A_DURABLE_FREEZE_GATE did not pass");
  }
  if (
    Date.parse(evidence.receipt.readback_completed_at) > Date.parse(freeze.receipt.write_started_at)
  ) {
    throw new Error("Run A evidence was not read back before the freeze was written");
  }

  return Object.freeze({
    evidence_sha256: evidence.receipt.sha256,
    freeze_sha256: freeze.receipt.sha256,
    gate: RUN_A_DURABLE_FREEZE_GATE,
    status: "PASS"
  });
}
