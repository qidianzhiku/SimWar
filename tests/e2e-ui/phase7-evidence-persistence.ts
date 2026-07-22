import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeSync
} from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import type { TestInfo } from "@playwright/test";

export const RUN_A_DURABLE_FREEZE_GATE = "RUN_A_DURABLE_FREEZE_GATE";
export const PHASE7_CORE_EVIDENCE_DIRECTORY = "core-evidence";
export const PHASE7_CORE_EVIDENCE_FILENAMES = [
  "run-a-evidence.json",
  "run-a-freeze.json",
  "phase7-evidence-order.json",
  "run-b-lifecycle.json"
] as const;
export const RUN_A_EVIDENCE_EVENT_SEQUENCE = [
  "RUN_A_CREATED",
  "ROUND_OPENED",
  "STUDENT_A_SUBMITTED",
  "STUDENT_B_SUBMITTED",
  "ROUND_LOCKED",
  "SETTLEMENT_COMMITTED",
  "RESULT_PUBLISHED",
  "RUN_A_PRODUCT_READBACK_COMPLETED",
  "RUN_A_BOUNDARY_VALIDATED",
  "RUN_A_EVIDENCE_PERSIST_STARTED",
  "RUN_A_EVIDENCE_PERSISTED",
  "RUN_A_EVIDENCE_READBACK_VERIFIED"
] as const;
export const RUN_A_FREEZE_EVENT_SEQUENCE = [
  "RUN_A_EVIDENCE_READBACK_VERIFIED",
  "RUN_A_FREEZE_PERSIST_STARTED",
  "RUN_A_FREEZE_PERSISTED",
  "RUN_A_FREEZE_READBACK_VERIFIED",
  "RUN_A_DURABLE_FREEZE_GATE_PASSED"
] as const;
export const EVIDENCE_ORDER_EVENT_SEQUENCE = [
  "RUN_A_EVIDENCE_PERSISTED",
  "RUN_A_EVIDENCE_READBACK_VERIFIED",
  "RUN_A_FREEZE_PERSISTED",
  "RUN_A_FREEZE_READBACK_VERIFIED",
  "RUN_A_DURABLE_FREEZE_GATE_PASSED",
  "RUN_B_CREATION_STARTED",
  "RUN_B_CREATED"
] as const;
export const RUN_B_LIFECYCLE_EVENTS = [
  "ACTIVE",
  "ABORTED",
  "RESET_READY",
  "ABORTED",
  "CLEANED"
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
const sha256Pattern = /^[0-9a-f]{64}$/;
const sourceShaPattern = /^[0-9a-f]{40}$/;
const contextIsolationKeys = [
  "admin_context",
  "student_a_b_identity_isolated",
  "student_a_b_storage_isolated",
  "student_a_b_team_isolated",
  "student_a_context",
  "student_b_context",
  "teacher_context"
] as const;
const boundaryResultKeys = [
  "cross_team_exposure",
  "cross_tenant_exposure",
  "student_a_internal_route_count",
  "student_a_other_team_exposure",
  "student_a_other_tenant_exposure",
  "student_a_private_replay_exposure",
  "student_a_state_true_exposure",
  "student_b_internal_route_count",
  "student_b_other_team_exposure",
  "student_b_other_tenant_exposure",
  "student_b_private_replay_exposure",
  "student_b_state_true_exposure"
] as const;
const runAEvidenceKeys = [
  "boundary_results",
  "captured_at",
  "classification",
  "context_isolation",
  "course_safe_reference",
  "credential_scan",
  "decision_submission_states",
  "event_sequence",
  "feedback_safe_digests",
  "learning_report_safe_digests",
  "lock_count",
  "official_result_safe_digest",
  "placeholder_scan",
  "publish_count",
  "published_state",
  "run_a_id",
  "schema_version",
  "settlement_count",
  "settlement_outcome",
  "source_sha",
  "student_a_result_safe_digest",
  "student_a_team_id",
  "student_b_result_safe_digest",
  "student_b_team_id",
  "teacher_replay_summary_safe_digest",
  "tenant_admin_summary_safe_digest"
] as const;
const runAFreezeKeys = [
  "boundary_status",
  "credential_scan",
  "event_sequence",
  "feedback_digests",
  "freeze_id",
  "learning_report_digests",
  "official_result_digest",
  "placeholder_scan",
  "publish_count",
  "run_a_evidence_filename",
  "run_a_evidence_sha256",
  "run_a_id",
  "run_b_creation_allowed",
  "run_b_creation_attempted_at_freeze",
  "run_b_exists_at_freeze",
  "schema_version",
  "sealed_at",
  "settlement_count",
  "source_sha",
  "status",
  "student_result_digests",
  "teacher_replay_summary_digest",
  "tenant_admin_summary_digest"
] as const;
const evidenceOrderKeys = [
  "event_sequence",
  "run_a_evidence_filename",
  "run_a_evidence_readback_verified_at",
  "run_a_evidence_sha256",
  "run_a_freeze_filename",
  "run_a_freeze_readback_verified_at",
  "run_a_freeze_sha256",
  "run_a_id",
  "run_b_created_after_freeze_readback",
  "run_b_created_at",
  "run_b_creation_started_at",
  "run_b_id",
  "schema_version",
  "source_sha"
] as const;
const runBLifecycleKeys = [
  "abort_count",
  "classification",
  "cleanup_count",
  "completed_at",
  "evidence_order_filename",
  "evidence_order_sha256",
  "final_state",
  "initial_state",
  "lifecycle_events",
  "publish_count",
  "replay_execution_count",
  "reset_count",
  "run_a_freeze_filename",
  "run_a_freeze_sha256",
  "run_a_historical_state_unchanged",
  "run_a_id",
  "run_a_official_result_unchanged",
  "run_a_replay_summary_unchanged",
  "run_b_id",
  "schema_version",
  "settlement_count",
  "source_sha",
  "student_decision_count"
] as const;

export type Phase7EvidenceFilename = (typeof PHASE7_CORE_EVIDENCE_FILENAMES)[number];
export type Phase7EvidenceReceipt = Readonly<{
  attachment_mode: "NONE_FOR_CORE_EVIDENCE";
  byte_length: number;
  filename: Phase7EvidenceFilename;
  json_parse: "PASS";
  readback_completed_at: string;
  safe_relative_path: string;
  schema_validation_after_readback: "PASS";
  schema_validation_before_write: "PASS";
  schema_version: string;
  sha256: string;
  temp_residue: 0;
  write_completed_at: string;
}>;
export type Phase7EvidenceReadback = Readonly<{
  payload: Readonly<Record<string, unknown>>;
  receipt: Phase7EvidenceReceipt;
  verified_at: string;
}>;
type EvidenceTestInfo = Pick<TestInfo, "outputDir" | "outputPath">;

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeEvidenceValue(value: unknown, path: string): unknown {
  if (value === undefined) throw new Error(`Phase 7 evidence contains undefined at ${path}`);
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error(`Phase 7 evidence contains a non-finite number at ${path}`);
    return value;
  }
  if (typeof value === "string") {
    for (const pattern of forbiddenValuePatterns) {
      if (pattern.test(value))
        throw new Error(`Phase 7 evidence contains a forbidden value at ${path}`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => normalizeEvidenceValue(entry, `${path}[${index}]`));
  }
  if (typeof value !== "object")
    throw new Error(`Phase 7 evidence contains an unsupported value at ${path}`);
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
        )
          throw new Error(`Phase 7 evidence contains a forbidden key at ${path}.${key}`);
        return [key, normalizeEvidenceValue(record[key], `${path}.${key}`)];
      })
  );
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw new Error(`${label} must be a plain object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new Error(`${label} must be a plain object`);
  return value as Record<string, unknown>;
}
function assertExactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
  label: string
): void {
  const actual = Object.keys(record).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    throw new Error(`${label} exact keys failed`);
  }
}
function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`${label} must be a non-empty string`);
}
function assertExactValue(value: unknown, expected: unknown, label: string): void {
  if (value !== expected) throw new Error(`${label} must equal ${String(expected)}`);
}
function assertSha(value: unknown, label: string): void {
  if (typeof value !== "string" || !sha256Pattern.test(value))
    throw new Error(`${label} must be a lowercase SHA-256`);
}
function assertSourceSha(value: unknown, label: string): void {
  if (typeof value !== "string" || !sourceShaPattern.test(value))
    throw new Error(`${label} must be a lowercase source SHA`);
}
function assertIsoTimestamp(value: unknown, label: string): void {
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new Error(`${label} must use canonical UTC ISO-8601 format`);
  }
}
function assertExactSequence(value: unknown, expected: readonly string[], label: string): void {
  if (
    !Array.isArray(value) ||
    value.length !== expected.length ||
    value.some((entry, index) => entry !== expected[index])
  ) {
    throw new Error(`${label} exact event sequence failed`);
  }
}
function assertDigestPair(value: unknown, label: string): void {
  const record = asRecord(value, label);
  assertExactKeys(record, ["student_a", "student_b"], label);
  assertSha(record.student_a, `${label}.student_a`);
  assertSha(record.student_b, `${label}.student_b`);
}

function assertRunAEvidence(payload: Record<string, unknown>): void {
  const label = "Run A evidence schema";
  assertExactKeys(payload, runAEvidenceKeys, label);
  assertExactValue(
    payload.schema_version,
    "simwar.phase7.run-a-evidence.v1",
    `${label}.schema_version`
  );
  assertExactValue(
    payload.classification,
    "AUTOMATED_OPERATOR_EXECUTION",
    `${label}.classification`
  );
  assertSourceSha(payload.source_sha, `${label}.source_sha`);
  for (const key of [
    "course_safe_reference",
    "run_a_id",
    "student_a_team_id",
    "student_b_team_id"
  ] as const) {
    assertString(payload[key], `${label}.${key}`);
  }
  if (payload.student_a_team_id === payload.student_b_team_id)
    throw new Error(`${label} requires distinct Student team ids`);
  const decisions = asRecord(
    payload.decision_submission_states,
    `${label}.decision_submission_states`
  );
  assertExactKeys(decisions, ["student_a", "student_b"], `${label}.decision_submission_states`);
  assertExactValue(
    decisions.student_a,
    "SUBMITTED",
    `${label}.decision_submission_states.student_a`
  );
  assertExactValue(
    decisions.student_b,
    "SUBMITTED",
    `${label}.decision_submission_states.student_b`
  );
  assertExactValue(payload.lock_count, 1, `${label}.lock_count`);
  assertExactValue(payload.settlement_count, 1, `${label}.settlement_count`);
  assertExactValue(payload.settlement_outcome, "COMMITTED", `${label}.settlement_outcome`);
  assertExactValue(payload.publish_count, 1, `${label}.publish_count`);
  assertExactValue(payload.published_state, "PUBLISHED", `${label}.published_state`);
  for (const key of [
    "student_a_result_safe_digest",
    "student_b_result_safe_digest",
    "teacher_replay_summary_safe_digest",
    "tenant_admin_summary_safe_digest",
    "official_result_safe_digest"
  ] as const) {
    assertSha(payload[key], `${label}.${key}`);
  }
  assertDigestPair(payload.feedback_safe_digests, `${label}.feedback_safe_digests`);
  assertDigestPair(payload.learning_report_safe_digests, `${label}.learning_report_safe_digests`);
  const contexts = asRecord(payload.context_isolation, `${label}.context_isolation`);
  assertExactKeys(contexts, contextIsolationKeys, `${label}.context_isolation`);
  for (const key of [
    "admin_context",
    "teacher_context",
    "student_a_context",
    "student_b_context"
  ] as const) {
    assertExactValue(contexts[key], "ISOLATED", `${label}.context_isolation.${key}`);
  }
  for (const key of [
    "student_a_b_storage_isolated",
    "student_a_b_identity_isolated",
    "student_a_b_team_isolated"
  ] as const) {
    assertExactValue(contexts[key], true, `${label}.context_isolation.${key}`);
  }
  const boundaries = asRecord(payload.boundary_results, `${label}.boundary_results`);
  assertExactKeys(boundaries, boundaryResultKeys, `${label}.boundary_results`);
  for (const key of boundaryResultKeys)
    assertExactValue(boundaries[key], 0, `${label}.boundary_results.${key}`);
  assertExactValue(payload.credential_scan, 0, `${label}.credential_scan`);
  assertExactValue(payload.placeholder_scan, 0, `${label}.placeholder_scan`);
  assertIsoTimestamp(payload.captured_at, `${label}.captured_at`);
  assertExactSequence(
    payload.event_sequence,
    RUN_A_EVIDENCE_EVENT_SEQUENCE,
    `${label}.event_sequence`
  );
}

function assertRunAFreeze(payload: Record<string, unknown>): void {
  const label = "Run A freeze schema";
  assertExactKeys(payload, runAFreezeKeys, label);
  assertExactValue(
    payload.schema_version,
    "simwar.phase7.run-a-freeze.v1",
    `${label}.schema_version`
  );
  assertString(payload.freeze_id, `${label}.freeze_id`);
  assertExactValue(payload.status, "SEALED_AUTOMATED_RUN_A_BEFORE_RUN_B", `${label}.status`);
  assertSourceSha(payload.source_sha, `${label}.source_sha`);
  assertString(payload.run_a_id, `${label}.run_a_id`);
  assertExactValue(
    payload.run_a_evidence_filename,
    "run-a-evidence.json",
    `${label}.run_a_evidence_filename`
  );
  assertSha(payload.run_a_evidence_sha256, `${label}.run_a_evidence_sha256`);
  assertDigestPair(payload.student_result_digests, `${label}.student_result_digests`);
  assertDigestPair(payload.feedback_digests, `${label}.feedback_digests`);
  assertDigestPair(payload.learning_report_digests, `${label}.learning_report_digests`);
  for (const key of [
    "teacher_replay_summary_digest",
    "tenant_admin_summary_digest",
    "official_result_digest"
  ] as const) {
    assertSha(payload[key], `${label}.${key}`);
  }
  assertExactValue(payload.settlement_count, 1, `${label}.settlement_count`);
  assertExactValue(payload.publish_count, 1, `${label}.publish_count`);
  assertExactValue(payload.boundary_status, "PASS", `${label}.boundary_status`);
  assertExactValue(payload.credential_scan, 0, `${label}.credential_scan`);
  assertExactValue(payload.placeholder_scan, 0, `${label}.placeholder_scan`);
  assertExactValue(payload.run_b_exists_at_freeze, false, `${label}.run_b_exists_at_freeze`);
  assertExactValue(
    payload.run_b_creation_attempted_at_freeze,
    false,
    `${label}.run_b_creation_attempted_at_freeze`
  );
  assertIsoTimestamp(payload.sealed_at, `${label}.sealed_at`);
  assertExactSequence(
    payload.event_sequence,
    RUN_A_FREEZE_EVENT_SEQUENCE,
    `${label}.event_sequence`
  );
  assertExactValue(payload.run_b_creation_allowed, true, `${label}.run_b_creation_allowed`);
}

function assertEvidenceOrder(payload: Record<string, unknown>): void {
  const label = "Evidence order schema";
  assertExactKeys(payload, evidenceOrderKeys, label);
  assertExactValue(
    payload.schema_version,
    "simwar.phase7.evidence-order.v1",
    `${label}.schema_version`
  );
  assertSourceSha(payload.source_sha, `${label}.source_sha`);
  assertString(payload.run_a_id, `${label}.run_a_id`);
  assertString(payload.run_b_id, `${label}.run_b_id`);
  if (payload.run_a_id === payload.run_b_id) throw new Error(`${label} requires distinct Run ids`);
  assertExactValue(
    payload.run_a_evidence_filename,
    "run-a-evidence.json",
    `${label}.run_a_evidence_filename`
  );
  assertSha(payload.run_a_evidence_sha256, `${label}.run_a_evidence_sha256`);
  assertExactValue(
    payload.run_a_freeze_filename,
    "run-a-freeze.json",
    `${label}.run_a_freeze_filename`
  );
  assertSha(payload.run_a_freeze_sha256, `${label}.run_a_freeze_sha256`);
  for (const key of [
    "run_a_evidence_readback_verified_at",
    "run_a_freeze_readback_verified_at",
    "run_b_creation_started_at",
    "run_b_created_at"
  ] as const) {
    assertIsoTimestamp(payload[key], `${label}.${key}`);
  }
  if (
    Date.parse(payload.run_b_creation_started_at as string) <=
    Date.parse(payload.run_a_freeze_readback_verified_at as string)
  ) {
    throw new Error(`${label} requires Run B creation after freeze readback`);
  }
  if (
    Date.parse(payload.run_b_created_at as string) <
    Date.parse(payload.run_b_creation_started_at as string)
  ) {
    throw new Error(`${label} requires Run B creation completion after start`);
  }
  assertExactValue(
    payload.run_b_created_after_freeze_readback,
    true,
    `${label}.run_b_created_after_freeze_readback`
  );
  assertExactSequence(
    payload.event_sequence,
    EVIDENCE_ORDER_EVENT_SEQUENCE,
    `${label}.event_sequence`
  );
}

function assertRunBLifecycle(payload: Record<string, unknown>): void {
  const label = "Run B lifecycle schema";
  assertExactKeys(payload, runBLifecycleKeys, label);
  assertExactValue(
    payload.schema_version,
    "simwar.phase7.run-b-lifecycle.v1",
    `${label}.schema_version`
  );
  assertExactValue(
    payload.classification,
    "AUTOMATED_OPERATOR_EXECUTION",
    `${label}.classification`
  );
  assertSourceSha(payload.source_sha, `${label}.source_sha`);
  assertString(payload.run_a_id, `${label}.run_a_id`);
  assertString(payload.run_b_id, `${label}.run_b_id`);
  if (payload.run_a_id === payload.run_b_id) throw new Error(`${label} requires distinct Run ids`);
  assertExactValue(
    payload.run_a_freeze_filename,
    "run-a-freeze.json",
    `${label}.run_a_freeze_filename`
  );
  assertSha(payload.run_a_freeze_sha256, `${label}.run_a_freeze_sha256`);
  assertExactValue(
    payload.evidence_order_filename,
    "phase7-evidence-order.json",
    `${label}.evidence_order_filename`
  );
  assertSha(payload.evidence_order_sha256, `${label}.evidence_order_sha256`);
  assertExactValue(payload.initial_state, "ACTIVE", `${label}.initial_state`);
  assertExactSequence(
    payload.lifecycle_events,
    RUN_B_LIFECYCLE_EVENTS,
    `${label}.lifecycle_events`
  );
  assertExactValue(payload.abort_count, 2, `${label}.abort_count`);
  assertExactValue(payload.reset_count, 1, `${label}.reset_count`);
  assertExactValue(payload.cleanup_count, 1, `${label}.cleanup_count`);
  assertExactValue(payload.final_state, "CLEANED", `${label}.final_state`);
  assertExactValue(payload.settlement_count, 0, `${label}.settlement_count`);
  assertExactValue(payload.publish_count, 0, `${label}.publish_count`);
  assertExactValue(payload.replay_execution_count, 0, `${label}.replay_execution_count`);
  assertExactValue(payload.student_decision_count, 0, `${label}.student_decision_count`);
  assertExactValue(
    payload.run_a_official_result_unchanged,
    true,
    `${label}.run_a_official_result_unchanged`
  );
  assertExactValue(
    payload.run_a_replay_summary_unchanged,
    true,
    `${label}.run_a_replay_summary_unchanged`
  );
  assertExactValue(
    payload.run_a_historical_state_unchanged,
    true,
    `${label}.run_a_historical_state_unchanged`
  );
  assertIsoTimestamp(payload.completed_at, `${label}.completed_at`);
}

export function validatePhase7CoreEvidence(
  filename: Phase7EvidenceFilename,
  payload: unknown
): Readonly<Record<string, unknown>> {
  assertEvidenceFilename(filename);
  const normalized = asRecord(normalizeEvidenceValue(payload, "$"), `${filename} payload`);
  if (filename === "run-a-evidence.json") assertRunAEvidence(normalized);
  else if (filename === "run-a-freeze.json") assertRunAFreeze(normalized);
  else if (filename === "phase7-evidence-order.json") assertEvidenceOrder(normalized);
  else assertRunBLifecycle(normalized);
  return Object.freeze(normalized);
}
function serializeEvidence(filename: Phase7EvidenceFilename, payload: unknown): Buffer {
  const validated = validatePhase7CoreEvidence(filename, payload);
  return Buffer.from(`${JSON.stringify(validated, null, 2)}\n`, "utf8");
}
function assertEvidenceFilename(filename: string): asserts filename is Phase7EvidenceFilename {
  if (!(PHASE7_CORE_EVIDENCE_FILENAMES as readonly string[]).includes(filename)) {
    throw new Error(`Phase 7 evidence filename is not allowlisted: ${filename}`);
  }
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    throw new Error(`Phase 7 evidence filename is unsafe: ${filename}`);
  }
}
function resolveEvidencePath(testInfo: EvidenceTestInfo, filename: Phase7EvidenceFilename): string {
  const outputDirectory = resolve(testInfo.outputDir);
  const finalPath = resolve(testInfo.outputPath(PHASE7_CORE_EVIDENCE_DIRECTORY, filename));
  const safeRelativePath = relative(outputDirectory, finalPath).replaceAll("\\", "/");
  if (
    safeRelativePath !== `${PHASE7_CORE_EVIDENCE_DIRECTORY}/${filename}` ||
    isAbsolute(safeRelativePath)
  ) {
    throw new Error("Phase 7 evidence path escaped the Playwright test output directory");
  }
  return finalPath;
}
function parseCanonicalPayload(
  filename: Phase7EvidenceFilename,
  bytes: Buffer
): Readonly<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Phase 7 evidence JSON readback failed");
  }
  const validated = validatePhase7CoreEvidence(filename, parsed);
  const canonicalBytes = Buffer.from(`${JSON.stringify(validated, null, 2)}\n`, "utf8");
  if (!canonicalBytes.equals(bytes)) throw new Error("Phase 7 evidence readback is not canonical");
  return validated;
}

export function assertExternalPhase7EvidencePath(outputFile: string, repositoryRoot: string): void {
  const resolvedOutput = resolve(outputFile);
  const resolvedRepository = resolve(repositoryRoot);
  const relation = relative(resolvedRepository, resolvedOutput);
  if (relation === "" || (!relation.startsWith("..") && !isAbsolute(relation))) {
    throw new Error("Formal Phase 7 evidence output must be outside the repository");
  }
}
export function assertSeparatePhase7OutputRoots(
  foundationOutputRoot: string,
  productOutputRoot: string
): void {
  const foundation = resolve(foundationOutputRoot);
  const product = resolve(productOutputRoot);
  const foundationFromProduct = relative(product, foundation);
  const productFromFoundation = relative(foundation, product);
  const nested = (path: string) => path === "" || (!path.startsWith("..") && !isAbsolute(path));
  if (nested(foundationFromProduct) || nested(productFromFoundation)) {
    throw new Error("Phase 7 foundation and product output roots must be separate siblings");
  }
}
function collectFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}
export function verifyPhase7CoreEvidenceRoot(productOutputRoot: string): Readonly<{
  common_parent: string;
  exact_match_counts: Readonly<Record<Phase7EvidenceFilename, 1>>;
  relative_paths: readonly string[];
}> {
  const root = resolve(productOutputRoot);
  if (!existsSync(root) || !statSync(root).isDirectory())
    throw new Error("Phase 7 product output root does not exist");
  const files = collectFiles(root);
  const matches = new Map<Phase7EvidenceFilename, string[]>();
  for (const filename of PHASE7_CORE_EVIDENCE_FILENAMES) {
    matches.set(
      filename,
      files.filter((path) => basename(path) === filename)
    );
  }
  for (const [filename, paths] of matches) {
    if (paths.length !== 1)
      throw new Error(`Phase 7 core basename must appear exactly once: ${filename}`);
  }
  const corePaths = PHASE7_CORE_EVIDENCE_FILENAMES.map((filename) => matches.get(filename)![0]!);
  const parentDirectories = new Set(corePaths.map((path) => dirname(path)));
  if (parentDirectories.size !== 1)
    throw new Error("Phase 7 core evidence files must share one parent directory");
  const commonParent = [...parentDirectories][0]!;
  if (basename(commonParent) !== PHASE7_CORE_EVIDENCE_DIRECTORY) {
    throw new Error("Phase 7 core evidence parent must be core-evidence");
  }
  const relativePaths = corePaths.map((path) => relative(root, path).replaceAll("\\", "/"));
  if (
    relativePaths.some((path) =>
      /(^|\/)(?:attachments|foundation-output|retry[^/]*)(\/|$)/i.test(path)
    )
  ) {
    throw new Error("Phase 7 core evidence appeared in a forbidden output subtree");
  }
  return Object.freeze({
    common_parent: relative(root, commonParent).replaceAll("\\", "/"),
    exact_match_counts: Object.freeze(
      Object.fromEntries(PHASE7_CORE_EVIDENCE_FILENAMES.map((filename) => [filename, 1])) as Record<
        Phase7EvidenceFilename,
        1
      >
    ),
    relative_paths: Object.freeze(relativePaths)
  });
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
  const bytes = serializeEvidence(filename, payload);
  let descriptor: number | undefined;
  let published = false;
  mkdirSync(outputDirectory, { recursive: true });
  if (existsSync(finalPath)) throw new Error(`Phase 7 evidence file already exists: ${filename}`);
  try {
    descriptor = openSync(temporaryPath, "wx", 0o600);
    writeSync(descriptor, bytes, 0, bytes.length, null);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    linkSync(temporaryPath, finalPath);
    published = true;
    unlinkSync(temporaryPath);
    const writeCompletedAt = new Date().toISOString();
    const readbackBytes = readFileSync(finalPath);
    if (!readbackBytes.equals(bytes))
      throw new Error(`Phase 7 evidence byte readback failed: ${filename}`);
    const readback = parseCanonicalPayload(filename, readbackBytes);
    const readbackCompletedAt = new Date().toISOString();
    return Object.freeze({
      attachment_mode: "NONE_FOR_CORE_EVIDENCE",
      byte_length: readbackBytes.length,
      filename,
      json_parse: "PASS",
      readback_completed_at: readbackCompletedAt,
      safe_relative_path: `${PHASE7_CORE_EVIDENCE_DIRECTORY}/${filename}`,
      schema_validation_after_readback: "PASS",
      schema_validation_before_write: "PASS",
      schema_version: readback.schema_version as string,
      sha256: sha256(readbackBytes),
      temp_residue: 0,
      write_completed_at: writeCompletedAt
    });
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
    receipt.safe_relative_path !== `${PHASE7_CORE_EVIDENCE_DIRECTORY}/${receipt.filename}` ||
    receipt.attachment_mode !== "NONE_FOR_CORE_EVIDENCE" ||
    receipt.schema_validation_before_write !== "PASS" ||
    receipt.schema_validation_after_readback !== "PASS" ||
    receipt.json_parse !== "PASS" ||
    receipt.temp_residue !== 0
  )
    throw new Error(`Phase 7 evidence receipt is invalid: ${receipt.filename}`);
  const finalPath = resolveEvidencePath(testInfo, receipt.filename);
  const bytes = readFileSync(finalPath);
  if (bytes.length !== receipt.byte_length || sha256(bytes) !== receipt.sha256) {
    throw new Error(`Phase 7 evidence hash readback failed: ${receipt.filename}`);
  }
  const payload = parseCanonicalPayload(receipt.filename, bytes);
  if (payload.schema_version !== receipt.schema_version) {
    throw new Error(`Phase 7 evidence schema version readback failed: ${receipt.filename}`);
  }
  return Object.freeze({ payload, receipt, verified_at: new Date().toISOString() });
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
  if (!sourceShaPattern.test(expectedSourceSha))
    throw new Error("Run A durable freeze gate requires an exact source SHA");
  if (evidence.receipt.filename !== "run-a-evidence.json")
    throw new Error("Run A durable freeze gate received the wrong evidence file");
  if (freeze.receipt.filename !== "run-a-freeze.json")
    throw new Error("Run A durable freeze gate received the wrong freeze file");
  const evidencePayload = evidence.payload;
  const freezePayload = freeze.payload;
  if (
    evidencePayload.run_a_id !== expectedRunId ||
    evidencePayload.source_sha !== expectedSourceSha ||
    freezePayload.status !== "SEALED_AUTOMATED_RUN_A_BEFORE_RUN_B" ||
    freezePayload.run_b_creation_allowed !== true ||
    freezePayload.run_b_exists_at_freeze !== false ||
    freezePayload.run_b_creation_attempted_at_freeze !== false ||
    freezePayload.run_a_id !== expectedRunId ||
    freezePayload.source_sha !== expectedSourceSha ||
    freezePayload.run_a_evidence_filename !== evidence.receipt.filename ||
    freezePayload.run_a_evidence_sha256 !== evidence.receipt.sha256
  )
    throw new Error("RUN_A_DURABLE_FREEZE_GATE did not pass");
  if (Date.parse(evidence.verified_at) > Date.parse(freeze.receipt.write_completed_at)) {
    throw new Error("Run A evidence was not read back before the freeze was written");
  }
  return Object.freeze({
    evidence_sha256: evidence.receipt.sha256,
    freeze_sha256: freeze.receipt.sha256,
    gate: RUN_A_DURABLE_FREEZE_GATE,
    status: "PASS"
  });
}
