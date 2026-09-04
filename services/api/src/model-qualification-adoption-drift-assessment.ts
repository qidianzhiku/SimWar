import { createHash } from "node:crypto";
import type {
  AdoptionDriftAssessment,
  AdoptionDriftIssueCode,
  EvidenceAdoptionEpoch,
  EvidenceAdoptionRecord,
  EvidenceAdoptionReference,
  EvidenceAdoptionState,
  ModelQualification,
  ModelQualificationAdoptionOperationsPolicy,
  ModelQualificationCalibrationDataset,
  ModelQualificationRecord,
  ModelQualificationSourcePackage
} from "@simwar/shared-contracts";
import { assertEvidenceAdoptionState } from "./model-qualification-evidence-adoption.js";

const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const ISO_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/u;

/** The only policy accepted by this O6 leaf; callers bind its digest explicitly. */
export const MODEL_QUALIFICATION_ADOPTION_OPERATIONS_POLICY_V1 = Object.freeze({
  schema_version: "model-qualification-adoption-operations.v1",
  policy_id: "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_POLICY_V1",
  max_drift_score: 0.25,
  max_ood_rate: 0.1,
  max_sensitivity_delta: 0.2,
  max_missingness_rate: 0.1,
  expiry_warning_window_hours: 24,
  require_bound_qualification: true,
  require_fresh_source: true,
  require_valid_rights: true,
  require_zero_holdout_leakage: true,
  provider: "OFF",
  dry_run_only: true
} as const satisfies ModelQualificationAdoptionOperationsPolicy);

export type AdoptionDriftSelectionRequirement = "CURRENT" | "HISTORICAL_PREDECESSOR";

export interface AdoptionDriftAssessmentInput {
  readonly assessed_at: string;
  readonly expected_adoption: EvidenceAdoptionReference;
  readonly expected_adoption_state_digest: string;
  readonly expected_operations_policy_digest: string;
  readonly record: ModelQualificationRecord;
  readonly selection_requirement: AdoptionDriftSelectionRequirement;
  readonly state: EvidenceAdoptionState;
}

export type AdoptionDriftAssessmentResult = AdoptionDriftAssessment;

const BASE_KNOWN_LIMITS = Object.freeze([
  "This is a deterministic dry-run assessment; it never mutates adoption state.",
  "Provider is OFF; no model, network, Writer, Store, Registry, or Authority call is performed.",
  "The assessment does not write formal truth, settlement, score, rank, or replay state.",
  "HEALTHY means the exact referenced evidence remains eligible at assessed_at; it is not a promotion."
]);

function fail(code: string): never {
  throw new Error(code);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Canonical JSON used by O5 and O6: object keys sort, array order remains semantic. */
function canonical(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("O6_CANONICAL_VALUE_INVALID");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  if (!isPlainRecord(value)) fail("O6_CANONICAL_VALUE_INVALID");
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

/** Stable SHA-256 over canonical JSON. This function never mutates the input. */
export function stableSha256(value: unknown): string {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

export function digestAdoptionOperationsPolicy(
  policy: ModelQualificationAdoptionOperationsPolicy = MODEL_QUALIFICATION_ADOPTION_OPERATIONS_POLICY_V1
): string {
  return stableSha256(policy);
}

export function digestEvidenceAdoptionState(state: EvidenceAdoptionState): string {
  return stableSha256(state);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_PATTERN.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = value.match(ISO_TIMESTAMP_PATTERN);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = match[7] ? Number(match[7]) : 0;
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  const parsed = new Date(value);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day &&
    parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute &&
    parsed.getUTCSeconds() === second &&
    parsed.getUTCMilliseconds() === millisecond
  );
}

function sameReference(left: EvidenceAdoptionReference, right: EvidenceAdoptionReference): boolean {
  return left.adoption_id === right.adoption_id && left.adoption_digest === right.adoption_digest;
}

function sameModelVersionReference(
  left: EvidenceAdoptionEpoch["model_version_reference"],
  right: EvidenceAdoptionEpoch["model_version_reference"]
): boolean {
  return (
    left.model_version_id === right.model_version_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameModelArtifactReference(
  left: EvidenceAdoptionEpoch["model_artifact_reference"],
  right: EvidenceAdoptionEpoch["model_artifact_reference"]
): boolean {
  return (
    left.artifact_id === right.artifact_id &&
    left.content_digest === right.content_digest &&
    left.format === right.format &&
    left.source_ref === right.source_ref
  );
}

function isReference(value: unknown): value is EvidenceAdoptionReference {
  return (
    isPlainRecord(value) &&
    typeof value.adoption_id === "string" &&
    value.adoption_id.trim().length > 0 &&
    isDigest(value.adoption_digest)
  );
}

function validateInput(input: AdoptionDriftAssessmentInput): void {
  if (!isPlainRecord(input)) fail("O6_INPUT_INVALID");
  if (!isIsoTimestamp(input.assessed_at)) fail("O6_ASSESSED_AT_INVALID");
  if (!isReference(input.expected_adoption)) fail("O6_EXPECTED_ADOPTION_INVALID");
  if (!isDigest(input.expected_adoption_state_digest)) {
    fail("O6_EXPECTED_STATE_DIGEST_INVALID");
  }
  if (!isDigest(input.expected_operations_policy_digest)) {
    fail("O6_EXPECTED_POLICY_DIGEST_INVALID");
  }
  if (
    input.selection_requirement !== "CURRENT" &&
    input.selection_requirement !== "HISTORICAL_PREDECESSOR"
  ) {
    fail("O6_SELECTION_REQUIREMENT_INVALID");
  }
}

function findOne<T>(items: readonly T[], predicate: (item: T) => boolean, code: string): T {
  const matches = items.filter(predicate);
  if (matches.length !== 1) fail(code);
  return matches[0]!;
}

interface ExactEvidence {
  readonly dataset: ModelQualificationCalibrationDataset;
  readonly qualification: ModelQualification;
  readonly source: ModelQualificationSourcePackage;
}

function exactEvidence(
  record: ModelQualificationRecord,
  epoch: EvidenceAdoptionEpoch
): ExactEvidence {
  const source = findOne(
    record.source_packages,
    (candidate) => candidate.source_package_id === epoch.source_package_id,
    "O6_SOURCE_IDENTITY_MISMATCH"
  );
  if (
    source.tenant_id !== record.tenant_id ||
    source.course_id !== record.course_id ||
    source.source_package_id !== epoch.source_package_id ||
    source.content_digest !== epoch.source_content_digest ||
    source.expires_at !== epoch.source_expires_at
  ) {
    fail("O6_SOURCE_IDENTITY_MISMATCH");
  }

  const dataset = findOne(
    record.calibration_datasets,
    (candidate) => candidate.calibration_dataset_id === epoch.calibration_dataset_id,
    "O6_DATASET_IDENTITY_MISMATCH"
  );
  if (
    dataset.tenant_id !== record.tenant_id ||
    dataset.course_id !== record.course_id ||
    dataset.calibration_dataset_id !== epoch.calibration_dataset_id ||
    dataset.content_digest !== epoch.calibration_dataset_content_digest ||
    dataset.source_package_id !== source.source_package_id
  ) {
    fail("O6_DATASET_IDENTITY_MISMATCH");
  }

  const qualification = findOne(
    record.qualifications,
    (candidate) => candidate.qualification_id === epoch.qualification_id,
    "O6_QUALIFICATION_IDENTITY_MISMATCH"
  );
  if (
    qualification.tenant_id !== record.tenant_id ||
    qualification.course_id !== record.course_id ||
    qualification.qualification_id !== epoch.qualification_id ||
    qualification.content_digest !== epoch.qualification_content_digest ||
    qualification.source_package_id !== source.source_package_id ||
    qualification.calibration_dataset_id !== dataset.calibration_dataset_id
  ) {
    fail("O6_QUALIFICATION_IDENTITY_MISMATCH");
  }
  if (
    !sameModelVersionReference(
      qualification.model_version_reference,
      epoch.model_version_reference
    ) ||
    !sameModelArtifactReference(qualification.artifact, epoch.model_artifact_reference)
  ) {
    fail("O6_MODEL_IDENTITY_MISMATCH");
  }
  return { dataset, qualification, source };
}

function addIssue(issues: AdoptionDriftIssueCode[], issue: AdoptionDriftIssueCode): void {
  if (!issues.includes(issue)) issues.push(issue);
}

function addSourceIssues(
  source: ModelQualificationSourcePackage,
  assessedAtMs: number,
  issues: AdoptionDriftIssueCode[],
  knownLimits: string[]
): void {
  const policy = MODEL_QUALIFICATION_ADOPTION_OPERATIONS_POLICY_V1;
  if (policy.require_valid_rights && source.rights_status !== "VALID") {
    addIssue(issues, "SOURCE_RIGHTS_INVALID");
  }
  if (policy.require_fresh_source && source.freshness_status !== "FRESH") {
    addIssue(issues, "SOURCE_NOT_FRESH");
  }

  const observedAtMs = Date.parse(source.observed_at);
  if (
    !isIsoTimestamp(source.observed_at) ||
    !Number.isFinite(observedAtMs) ||
    observedAtMs > assessedAtMs
  ) {
    addIssue(issues, "SOURCE_NOT_FRESH");
  }

  const expiryMs =
    source.expires_at === null ? Number.POSITIVE_INFINITY : Date.parse(source.expires_at);
  if (!Number.isFinite(expiryMs) && source.expires_at !== null) {
    addIssue(issues, "SOURCE_EXPIRED");
  } else if (expiryMs <= assessedAtMs) {
    addIssue(issues, "SOURCE_EXPIRED");
  } else if (expiryMs - assessedAtMs <= policy.expiry_warning_window_hours * 60 * 60 * 1000) {
    knownLimits.push("SOURCE_EXPIRY_APPROACHING");
  }

  if (
    !Number.isFinite(source.quality.conflict_count) ||
    source.quality.conflict_count !== 0 ||
    !Number.isFinite(source.quality.missingness_rate) ||
    source.quality.missingness_rate < 0 ||
    source.quality.missingness_rate > policy.max_missingness_rate ||
    !Number.isFinite(source.quality.record_count) ||
    source.quality.record_count < 0
  ) {
    addIssue(issues, "SOURCE_QUALITY_INVALID");
  }
}

function addDatasetIssues(
  dataset: ModelQualificationCalibrationDataset,
  issues: AdoptionDriftIssueCode[]
): void {
  if (dataset.status !== "READY") addIssue(issues, "DATASET_NOT_READY");
  if (
    !MODEL_QUALIFICATION_ADOPTION_OPERATIONS_POLICY_V1.require_zero_holdout_leakage ||
    !dataset.zero_holdout_leakage ||
    dataset.holdout_leakage_count !== 0 ||
    dataset.calibration_record_ids.some((id) => dataset.holdout_record_ids.includes(id))
  ) {
    addIssue(issues, "HOLDOUT_LEAKAGE");
  }
}

function addQualificationIssues(
  qualification: ModelQualification,
  issues: AdoptionDriftIssueCode[]
): void {
  const diagnostics = qualification.diagnostics;
  const diagnosticsValid =
    Number.isFinite(diagnostics.baseline_error) &&
    diagnostics.baseline_error >= 0 &&
    Number.isFinite(diagnostics.differential_error) &&
    diagnostics.differential_error >= 0 &&
    Number.isFinite(diagnostics.drift_score) &&
    diagnostics.drift_score >= 0 &&
    Number.isFinite(diagnostics.ood_rate) &&
    diagnostics.ood_rate >= 0 &&
    Number.isFinite(diagnostics.sensitivity_max_delta) &&
    diagnostics.sensitivity_max_delta >= 0;
  if (
    qualification.decision !== "APPROVED" ||
    qualification.no_implicit_latest !== true ||
    qualification.authority_flags.official_truth_write !== false ||
    qualification.authority_flags.provider_calls !== 0 ||
    qualification.diagnostics.convergence_status !== "CONVERGED" ||
    !diagnosticsValid
  ) {
    addIssue(issues, "QUALIFICATION_NOT_APPROVED");
  }
  if (qualification.review.status !== "APPROVED") {
    addIssue(issues, "QUALIFICATION_REVIEW_NOT_APPROVED");
  }
  if (
    qualification.binding.status !== "BOUND" ||
    qualification.binding.course_id !== qualification.course_id
  ) {
    addIssue(issues, "QUALIFICATION_NOT_BOUND");
  }
  if (
    !Number.isFinite(diagnostics.drift_score) ||
    diagnostics.drift_score < 0 ||
    diagnostics.drift_score > MODEL_QUALIFICATION_ADOPTION_OPERATIONS_POLICY_V1.max_drift_score
  ) {
    addIssue(issues, "QUALIFICATION_DIAGNOSTIC_DRIFT");
  }
  if (
    !Number.isFinite(diagnostics.ood_rate) ||
    diagnostics.ood_rate < 0 ||
    diagnostics.ood_rate > MODEL_QUALIFICATION_ADOPTION_OPERATIONS_POLICY_V1.max_ood_rate
  ) {
    addIssue(issues, "QUALIFICATION_DIAGNOSTIC_OOD");
  }
  if (
    !Number.isFinite(diagnostics.sensitivity_max_delta) ||
    diagnostics.sensitivity_max_delta < 0 ||
    diagnostics.sensitivity_max_delta >
      MODEL_QUALIFICATION_ADOPTION_OPERATIONS_POLICY_V1.max_sensitivity_delta
  ) {
    addIssue(issues, "QUALIFICATION_DIAGNOSTIC_SENSITIVITY");
  }
}

function addRequalificationIssues(
  record: ModelQualificationRecord,
  qualification: ModelQualification,
  source: ModelQualificationSourcePackage,
  issues: AdoptionDriftIssueCode[]
): void {
  const unresolved = (record.requalification_previews ?? []).some(
    (preview) =>
      preview.tenant_id === record.tenant_id &&
      preview.course_id === record.course_id &&
      (preview.change_set.affected_qualification_ids.includes(qualification.qualification_id) ||
        preview.change_set.candidate.source_package_id === source.source_package_id) &&
      preview.status !== "NO_CHANGE" &&
      preview.resolution !== "ACCEPTED" &&
      preview.resolution !== "REJECTED"
  );
  if (unresolved) addIssue(issues, "REQUALIFICATION_UNRESOLVED");
}

function buildAssessment(input: {
  readonly adoption: EvidenceAdoptionReference;
  readonly assessed_at: string;
  readonly epoch: EvidenceAdoptionEpoch;
  readonly expected_selection: AdoptionDriftSelectionRequirement;
  readonly future_admission_impact: AdoptionDriftAssessment["future_admission_impact"];
  readonly issue_codes: readonly AdoptionDriftIssueCode[];
  readonly known_limits: readonly string[];
  readonly adoption_state_digest: string;
  readonly operations_policy_digest: string;
  readonly status: AdoptionDriftAssessment["status"];
}): AdoptionDriftAssessmentResult {
  const identity = {
    adoption: input.adoption,
    assessed_at: input.assessed_at,
    adoption_state_digest: input.adoption_state_digest,
    epoch: input.epoch,
    expected_selection: input.expected_selection,
    future_admission_impact: input.future_admission_impact,
    issue_codes: input.issue_codes,
    known_limits: input.known_limits,
    operations_policy_digest: input.operations_policy_digest,
    status: input.status
  };
  const assessment_id = `adoption_drift_${stableSha256(identity)}`;
  const unsigned = {
    assessment_id,
    assessed_at: input.assessed_at,
    adoption: { ...input.adoption },
    adoption_state_digest: input.adoption_state_digest,
    epoch: input.epoch,
    future_admission_impact: input.future_admission_impact,
    issue_codes: [...input.issue_codes],
    known_limits: [...input.known_limits],
    official_truth_write: false as const,
    operations_policy_digest: input.operations_policy_digest,
    provider: "OFF" as const,
    status: input.status,
    advisory_only: true as const,
    adoption_mutation: false as const
  } satisfies Omit<AdoptionDriftAssessment, "assessment_digest">;
  return {
    ...unsigned,
    assessment_digest: stableSha256(unsigned)
  };
}

function currentSelectionForEpoch(
  state: EvidenceAdoptionState,
  epoch: EvidenceAdoptionEpoch
): EvidenceAdoptionRecord | undefined {
  const selections = state.selections.filter(
    (selection) =>
      sameModelVersionReference(selection.model_version_reference, epoch.model_version_reference) &&
      sameModelArtifactReference(selection.model_artifact_reference, epoch.model_artifact_reference)
  );
  if (selections.length !== 1) return undefined;
  return state.records.find((record) => sameReference(record, selections[0]!));
}

function assertUniqueAdoptionReferences(state: EvidenceAdoptionState): void {
  if (!Array.isArray(state.records) || !Array.isArray(state.selections)) {
    fail("O6_EXACT_ADOPTION_REQUIRED");
  }
  const recordIds = new Set<string>();
  const recordReferences = new Set<string>();
  for (const record of state.records) {
    const referenceKey = `${record.adoption_id}\u0000${record.adoption_digest}`;
    if (recordIds.has(record.adoption_id) || recordReferences.has(referenceKey)) {
      fail("O6_EXACT_ADOPTION_REQUIRED");
    }
    recordIds.add(record.adoption_id);
    recordReferences.add(referenceKey);
  }
  const selectionIds = new Set<string>();
  const selectionReferences = new Set<string>();
  for (const selection of state.selections) {
    const referenceKey = `${selection.adoption_id}\u0000${selection.adoption_digest}`;
    if (selectionIds.has(selection.adoption_id) || selectionReferences.has(referenceKey)) {
      fail("O6_EXACT_ADOPTION_REQUIRED");
    }
    selectionIds.add(selection.adoption_id);
    selectionReferences.add(referenceKey);
  }
}

function resolveExactAdoption(
  state: EvidenceAdoptionState,
  expectedAdoption: EvidenceAdoptionReference
): EvidenceAdoptionRecord {
  const idMatches = state.records.filter(
    (record) => record.adoption_id === expectedAdoption.adoption_id
  );
  const exactMatches = state.records.filter((record) => sameReference(record, expectedAdoption));
  if (
    idMatches.length !== 1 ||
    exactMatches.length !== 1 ||
    exactMatches[0]!.disposition !== "ADOPTED_FOR_FUTURE_ADMISSION"
  ) {
    fail("O6_EXACT_ADOPTION_REQUIRED");
  }
  return exactMatches[0]!;
}

/**
 * Pure O6 A1 assessment leaf. It reads an exact O5 state and qualification
 * record, emits a deterministic dry-run result, and never persists or mutates.
 */
export function assessAdoptionDrift(
  input: AdoptionDriftAssessmentInput
): AdoptionDriftAssessmentResult {
  validateInput(input);
  assertUniqueAdoptionReferences(input.state);
  assertEvidenceAdoptionState(input.state);
  if (
    input.record.tenant_id !== input.state.tenant_id ||
    input.record.course_id !== input.state.course_id
  ) {
    fail("O6_SCOPE_MISMATCH");
  }

  const adoptionStateDigest = digestEvidenceAdoptionState(input.state);
  const operationsPolicyDigest = digestAdoptionOperationsPolicy();
  const target = resolveExactAdoption(input.state, input.expected_adoption);
  const epoch = target.epoch;
  const outputAdoption = {
    adoption_digest: target.adoption_digest,
    adoption_id: target.adoption_id
  };

  const rebaseIssues: AdoptionDriftIssueCode[] = [];
  if (input.expected_adoption_state_digest !== adoptionStateDigest) {
    rebaseIssues.push("ADOPTION_STATE_DIGEST_CHANGED");
  }
  if (input.expected_operations_policy_digest !== operationsPolicyDigest) {
    rebaseIssues.push("OPERATIONS_POLICY_DIGEST_CHANGED");
  }
  if (rebaseIssues.length > 0) {
    return buildAssessment({
      adoption: outputAdoption,
      assessed_at: input.assessed_at,
      adoption_state_digest: adoptionStateDigest,
      epoch,
      expected_selection: input.selection_requirement,
      future_admission_impact: "REBASE_REQUIRED",
      issue_codes: rebaseIssues,
      known_limits: [
        ...BASE_KNOWN_LIMITS,
        "The caller must rebind the exact current adoption state and operations policy before assessment."
      ],
      operations_policy_digest: operationsPolicyDigest,
      status: "REBASE_REQUIRED"
    });
  }

  const issues: AdoptionDriftIssueCode[] = [];
  const knownLimits = [...BASE_KNOWN_LIMITS];
  const targetReference = {
    adoption_digest: target.adoption_digest,
    adoption_id: target.adoption_id
  };
  const selectedRecord = currentSelectionForEpoch(input.state, target.epoch);
  if (input.selection_requirement === "CURRENT") {
    if (!selectedRecord || !sameReference(selectedRecord, targetReference)) {
      addIssue(issues, "ADOPTION_NOT_CURRENT");
    }
  } else if (
    !selectedRecord ||
    selectedRecord.predecessor === null ||
    !sameReference(selectedRecord.predecessor, targetReference)
  ) {
    addIssue(issues, "ADOPTION_NOT_CURRENT");
  }

  const { dataset, qualification, source } = exactEvidence(input.record, target.epoch);
  addSourceIssues(source, Date.parse(input.assessed_at), issues, knownLimits);
  addDatasetIssues(dataset, issues);
  addQualificationIssues(qualification, issues);
  addRequalificationIssues(input.record, qualification, source, issues);

  const status =
    issues.length > 0
      ? "FUTURE_ADMISSION_BLOCKED"
      : knownLimits.includes("SOURCE_EXPIRY_APPROACHING")
        ? "REVIEW_REQUIRED"
        : "HEALTHY";
  const futureAdmissionImpact =
    status === "FUTURE_ADMISSION_BLOCKED"
      ? "BLOCKED"
      : status === "REVIEW_REQUIRED"
        ? "REVIEW_REQUIRED"
        : "UNCHANGED";
  return buildAssessment({
    adoption: targetReference,
    assessed_at: input.assessed_at,
    adoption_state_digest: adoptionStateDigest,
    epoch: target.epoch,
    expected_selection: input.selection_requirement,
    future_admission_impact: futureAdmissionImpact,
    issue_codes: issues,
    known_limits: knownLimits,
    operations_policy_digest: operationsPolicyDigest,
    status
  });
}
