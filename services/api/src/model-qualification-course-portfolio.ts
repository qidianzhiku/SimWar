import type {
  Course,
  EvidenceAdoptionEpoch,
  EvidenceAdoptionReference,
  EvidenceAdoptionRecord,
  EvidenceAdoptionState,
  ModelQualification,
  ModelQualificationRecord,
  ModelQualificationRollbackOutcomeResolution,
  ModelQualificationRollbackConsistencyStatus
} from "@simwar/shared-contracts";
import { assertEvidenceAdoptionState } from "./model-qualification-evidence-adoption.js";
import { stableSha256 } from "./model-qualification-adoption-drift-assessment.js";
import { resolveRollbackRequestOutcome } from "./model-qualification-rollback-request-resolution.js";
import { assessReadoptionHistoricalConsistency } from "./model-qualification-readoption-historical-consistency.js";

export const MODEL_QUALIFICATION_COURSE_PORTFOLIO_SCHEMA_VERSION =
  "model-qualification-course-portfolio.v1" as const;

export type ModelQualificationAuthorizedCourse = Pick<Course, "course_id" | "tenant_id" | "title">;

export interface ModelQualificationCoursePortfolioInput {
  /** The already-authorized, canonical tenant course list. */
  readonly authorized_courses: readonly ModelQualificationAuthorizedCourse[];
  /** Governance records read by the caller; this leaf never discovers records itself. */
  readonly governance_records: readonly ModelQualificationRecord[];
  readonly o8_outcomes?: readonly ModelQualificationRollbackOutcomeResolution[];
  readonly tenant_id: string;
}

export type ModelQualificationCoursePortfolioStatus = "READY" | "BLOCKED";

export type ModelQualificationCoursePortfolioBlockerCode =
  | "AUTHORIZED_COURSE_INVALID"
  | "AUTHORIZED_COURSE_SCOPE_MISMATCH"
  | "AUTHORIZED_COURSE_DUPLICATE"
  | "GOVERNANCE_RECORD_MALFORMED"
  | "SCOPE_MISMATCH"
  | "ORPHAN_GOVERNANCE_RECORD"
  | "AMBIGUOUS_GOVERNANCE_RECORD"
  | "GOVERNANCE_RECORD_MISSING"
  | "ADOPTION_STATE_INVALID"
  | "ADOPTION_STATE_SCOPE_MISMATCH"
  | "AMBIGUOUS_CURRENT_ADOPTION"
  | "CURRENT_ADOPTION_NOT_FOUND"
  | "CURRENT_ADOPTION_IDENTITY_MISMATCH"
  | "CURRENT_ADOPTION_NOT_EFFECTIVE"
  | "QUALIFICATION_MISSING"
  | "AMBIGUOUS_QUALIFICATION"
  | "QUALIFICATION_IDENTITY_MISMATCH"
  | "QUALIFICATION_SCOPE_MISMATCH"
  | "QUALIFICATION_AUTHORITY_INVALID"
  | "QUALIFICATION_DECISION_INVALID"
  | "QUALIFICATION_REVIEW_INVALID"
  | "QUALIFICATION_BINDING_INVALID"
  | "SOURCE_PACKAGE_MISSING"
  | "SOURCE_PACKAGE_AMBIGUOUS"
  | "CALIBRATION_DATASET_MISSING"
  | "CALIBRATION_DATASET_AMBIGUOUS"
  | "QUALIFICATION_EVIDENCE_SCOPE_MISMATCH"
  | "QUALIFICATION_EVIDENCE_REFERENCE_MISMATCH"
  | "O8_OUTCOME_INVALID"
  | "O8_OUTCOME_SCOPE_MISMATCH"
  | "ORPHAN_O8_OUTCOME"
  | "AMBIGUOUS_O8_OUTCOME";

export interface ModelQualificationCoursePortfolioBlocker {
  readonly code: ModelQualificationCoursePortfolioBlockerCode;
  readonly course_id: string | null;
  readonly observed_tenant_id: string | null;
  readonly related_digests: readonly string[];
  readonly related_ids: readonly string[];
}

export interface ModelQualificationCoursePortfolioQualificationIdentity {
  readonly content_digest: string;
  readonly qualification_id: string;
}

export interface ModelQualificationCoursePortfolioO8Summary {
  readonly current_effect: ModelQualificationRollbackOutcomeResolution["current_effect"];
  readonly historical_consistency: ModelQualificationRollbackOutcomeResolution["historical_consistency"];
  readonly outcome_status: ModelQualificationRollbackOutcomeResolution["outcome_status"];
  readonly qualification_consistency: ModelQualificationRollbackOutcomeResolution["qualification_consistency"];
  readonly resolution_digest: string;
  readonly resolution_id: string;
  readonly resulting_adoption: EvidenceAdoptionReference | null;
  readonly rollback_request_digest: string;
  readonly rollback_request_id: string;
}

export interface ModelQualificationCoursePortfolioEntry {
  readonly adoption_state_digest: string | null;
  readonly blockers: readonly ModelQualificationCoursePortfolioBlocker[];
  readonly course: ModelQualificationAuthorizedCourse;
  readonly current_adoption: EvidenceAdoptionReference | null;
  readonly current_adoption_candidates: readonly EvidenceAdoptionReference[];
  readonly current_adoption_epoch: EvidenceAdoptionEpoch | null;
  readonly known_limits: readonly string[];
  readonly o8_outcomes: readonly ModelQualificationCoursePortfolioO8Summary[];
  readonly qualification: ModelQualification | null;
  readonly qualification_candidates: readonly ModelQualificationCoursePortfolioQualificationIdentity[];
  readonly qualification_consistency: ModelQualificationRollbackConsistencyStatus;
  readonly writer_effect: "NONE";
}

export interface ModelQualificationCoursePortfolio {
  readonly adoption_mutation: false;
  readonly blockers: readonly ModelQualificationCoursePortfolioBlocker[];
  readonly courses: readonly ModelQualificationCoursePortfolioEntry[];
  readonly derived: true;
  readonly formal_truth_write: false;
  readonly history_deleted: false;
  readonly known_limits: readonly string[];
  readonly no_new_registry: true;
  readonly no_new_store: true;
  readonly no_new_writer: true;
  readonly official_truth_write: false;
  readonly portfolio_state_digest: string;
  readonly portfolio_status: ModelQualificationCoursePortfolioStatus;
  readonly provider: "OFF";
  readonly query_only: true;
  readonly rank_write: false;
  readonly rollback_applied: false;
  readonly score_write: false;
  readonly schema_version: typeof MODEL_QUALIFICATION_COURSE_PORTFOLIO_SCHEMA_VERSION;
  readonly settlement_write: false;
  readonly writes_formal_truth: false;
  readonly writer_effect: "NONE";
}

const PORTFOLIO_KNOWN_LIMITS = Object.freeze([
  "This portfolio is a deterministic derived query; it does not create or persist governance records.",
  "The canonical authorized-course list is the only source of portfolio membership; governance records cannot create phantom courses.",
  "Provider is OFF; no model, network, Writer, Store, Registry, or Authority call is performed.",
  "No official truth, formal truth, settlement, score, rank, replay, adoption, rollback, or historical receipt is written.",
  "Exact current adoption is exposed only when one unambiguous adoption identity and matching epoch are present.",
  "No latest, current, default, fallback, first, last, or newest-timestamp record selection is permitted."
] as const);

const NO_CURRENT_ADOPTION_LIMIT =
  "No exact current adoption selection is available for this course; historical governance records are not promoted implicitly.";
const NO_O8_LIMIT =
  "O8 summaries are shown only from exact supplied outcomes or exact record-derived rollback requests; absence is not proof that no historical outcome exists.";

const INCONSISTENT_CODES = new Set<ModelQualificationCoursePortfolioBlockerCode>([
  "AUTHORIZED_COURSE_DUPLICATE",
  "AUTHORIZED_COURSE_SCOPE_MISMATCH",
  "ADOPTION_STATE_SCOPE_MISMATCH",
  "AMBIGUOUS_CURRENT_ADOPTION",
  "CURRENT_ADOPTION_IDENTITY_MISMATCH",
  "AMBIGUOUS_QUALIFICATION",
  "QUALIFICATION_IDENTITY_MISMATCH",
  "QUALIFICATION_SCOPE_MISMATCH",
  "QUALIFICATION_EVIDENCE_SCOPE_MISMATCH",
  "QUALIFICATION_EVIDENCE_REFERENCE_MISMATCH",
  "AMBIGUOUS_O8_OUTCOME",
  "O8_OUTCOME_SCOPE_MISMATCH"
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sameReference(
  left: EvidenceAdoptionReference | null | undefined,
  right: EvidenceAdoptionReference | null | undefined
): boolean {
  return Boolean(
    left &&
    right &&
    left.adoption_id === right.adoption_id &&
    left.adoption_digest === right.adoption_digest
  );
}

function sameModelVersion(
  left: ModelQualification["model_version_reference"],
  right: ModelQualification["model_version_reference"]
): boolean {
  return (
    left.model_version_id === right.model_version_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameArtifact(
  left: ModelQualification["artifact"],
  right: ModelQualification["artifact"]
): boolean {
  return (
    left.artifact_id === right.artifact_id &&
    left.content_digest === right.content_digest &&
    left.format === right.format &&
    left.source_ref === right.source_ref
  );
}

function blocker(
  code: ModelQualificationCoursePortfolioBlockerCode,
  courseId: string | null = null,
  tenantId: string | null = null,
  relatedIds: readonly string[] = [],
  relatedDigests: readonly string[] = []
): ModelQualificationCoursePortfolioBlocker {
  return {
    code,
    course_id: courseId,
    observed_tenant_id: tenantId,
    related_digests: sortedUnique(relatedDigests),
    related_ids: sortedUnique(relatedIds)
  };
}

function blockerSort(
  left: ModelQualificationCoursePortfolioBlocker,
  right: ModelQualificationCoursePortfolioBlocker
): number {
  return (
    left.code.localeCompare(right.code) ||
    (left.course_id ?? "").localeCompare(right.course_id ?? "") ||
    (left.observed_tenant_id ?? "").localeCompare(right.observed_tenant_id ?? "") ||
    left.related_ids.join("\u0000").localeCompare(right.related_ids.join("\u0000")) ||
    left.related_digests.join("\u0000").localeCompare(right.related_digests.join("\u0000"))
  );
}

function uniqueSortedBlockers(
  values: readonly ModelQualificationCoursePortfolioBlocker[]
): ModelQualificationCoursePortfolioBlocker[] {
  const seen = new Set<string>();
  const result: ModelQualificationCoursePortfolioBlocker[] = [];
  for (const value of [...values].sort(blockerSort)) {
    const key = JSON.stringify(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function qualificationIdentity(
  qualification: ModelQualification
): ModelQualificationCoursePortfolioQualificationIdentity {
  return {
    content_digest: qualification.content_digest,
    qualification_id: qualification.qualification_id
  };
}

function asQualification(value: unknown): ModelQualification | null {
  const candidate = asRecord(value);
  if (!candidate) return null;
  const artifact = asRecord(candidate.artifact);
  const authorityFlags = asRecord(candidate.authority_flags);
  const binding = asRecord(candidate.binding);
  const modelVersion = asRecord(candidate.model_version_reference);
  const review = asRecord(candidate.review);
  if (
    !artifact ||
    !authorityFlags ||
    !binding ||
    !modelVersion ||
    !review ||
    !text(candidate.qualification_id) ||
    !text(candidate.content_digest) ||
    !text(candidate.tenant_id) ||
    !text(candidate.course_id) ||
    !text(candidate.source_package_id) ||
    !text(candidate.calibration_dataset_id)
  ) {
    return null;
  }
  return value as ModelQualification;
}

function compareQualificationIdentity(
  left: ModelQualificationCoursePortfolioQualificationIdentity,
  right: ModelQualificationCoursePortfolioQualificationIdentity
): number {
  return (
    left.qualification_id.localeCompare(right.qualification_id) ||
    left.content_digest.localeCompare(right.content_digest)
  );
}

function compareAdoptionReference(
  left: EvidenceAdoptionReference,
  right: EvidenceAdoptionReference
): number {
  return (
    left.adoption_id.localeCompare(right.adoption_id) ||
    left.adoption_digest.localeCompare(right.adoption_digest)
  );
}

function summarizeO8(
  outcome: ModelQualificationRollbackOutcomeResolution
): ModelQualificationCoursePortfolioO8Summary {
  return {
    current_effect: outcome.current_effect,
    historical_consistency: outcome.historical_consistency,
    outcome_status: outcome.outcome_status,
    qualification_consistency: outcome.qualification_consistency,
    resolution_digest: outcome.resolution_digest,
    resolution_id: outcome.resolution_id,
    resulting_adoption: outcome.resulting_adoption ? clone(outcome.resulting_adoption) : null,
    rollback_request_digest: outcome.rollback_request_digest,
    rollback_request_id: outcome.rollback_request_id
  };
}

function o8SummarySort(
  left: ModelQualificationCoursePortfolioO8Summary,
  right: ModelQualificationCoursePortfolioO8Summary
): number {
  return (
    left.rollback_request_id.localeCompare(right.rollback_request_id) ||
    left.rollback_request_digest.localeCompare(right.rollback_request_digest) ||
    left.resolution_id.localeCompare(right.resolution_id) ||
    left.resolution_digest.localeCompare(right.resolution_digest)
  );
}

function hasDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function hasValidO8Digest(outcome: ModelQualificationRollbackOutcomeResolution): boolean {
  if (!hasDigest(outcome.resolution_digest)) return false;
  const body: Record<string, unknown> = { ...outcome };
  delete body.resolution_digest;
  try {
    return stableSha256(body) === outcome.resolution_digest;
  } catch {
    return false;
  }
}

function currentAdoptionRecord(
  state: EvidenceAdoptionState,
  reference: EvidenceAdoptionReference
): {
  record: EvidenceAdoptionRecord | null;
  code: ModelQualificationCoursePortfolioBlockerCode | null;
} {
  const idMatches = state.records.filter(
    (candidate) => candidate.adoption_id === reference.adoption_id
  );
  const exactMatches = idMatches.filter((candidate) => sameReference(candidate, reference));
  if (idMatches.length === 0) return { code: "CURRENT_ADOPTION_NOT_FOUND", record: null };
  if (exactMatches.length !== 1) {
    return { code: "CURRENT_ADOPTION_IDENTITY_MISMATCH", record: null };
  }
  return { code: null, record: exactMatches[0]! };
}

function findUniqueById<T extends { [key: string]: unknown }>(
  values: readonly T[],
  field: string,
  id: string
): { value: T | null; ambiguous: boolean } {
  const matches = values.filter((value) => value[field] === id);
  if (matches.length !== 1) return { ambiguous: matches.length > 1, value: null };
  return { ambiguous: false, value: matches[0]! };
}

interface AdoptionBinding {
  readonly candidates: readonly EvidenceAdoptionReference[];
  readonly current: EvidenceAdoptionReference | null;
  readonly epoch: EvidenceAdoptionEpoch | null;
  readonly state: EvidenceAdoptionState | null;
  readonly state_digest: string | null;
}

function inspectAdoption(
  record: ModelQualificationRecord,
  tenantId: string,
  courseId: string,
  blockers: ModelQualificationCoursePortfolioBlocker[]
): AdoptionBinding {
  const rawState = (asRecord(record)?.evidence_adoption ?? undefined) as unknown;
  if (rawState === undefined) {
    return { candidates: [], current: null, epoch: null, state: null, state_digest: null };
  }
  const state = rawState as EvidenceAdoptionState;
  const stateRecord = asRecord(rawState);
  if (!stateRecord) {
    blockers.push(blocker("ADOPTION_STATE_INVALID", courseId, tenantId));
    return { candidates: [], current: null, epoch: null, state: null, state_digest: null };
  }
  if (state.tenant_id !== tenantId || state.course_id !== courseId) {
    blockers.push(
      blocker("ADOPTION_STATE_SCOPE_MISMATCH", courseId, state.tenant_id ?? null, [], [])
    );
    return { candidates: [], current: null, epoch: null, state: null, state_digest: null };
  }
  try {
    assertEvidenceAdoptionState(state);
  } catch {
    blockers.push(blocker("ADOPTION_STATE_INVALID", courseId, tenantId));
    return { candidates: [], current: null, epoch: null, state: null, state_digest: null };
  }

  const candidates = [...state.selections]
    .map((selection) => ({
      adoption_digest: selection.adoption_digest,
      adoption_id: selection.adoption_id
    }))
    .sort(compareAdoptionReference);
  const stateDigest = stableSha256(state);
  if (candidates.length !== 1) {
    if (candidates.length > 1) {
      blockers.push(
        blocker(
          "AMBIGUOUS_CURRENT_ADOPTION",
          courseId,
          tenantId,
          candidates.map((candidate) => candidate.adoption_id),
          candidates.map((candidate) => candidate.adoption_digest)
        )
      );
    }
    return { candidates, current: null, epoch: null, state, state_digest: stateDigest };
  }

  const reference = candidates[0]!;
  const resolved = currentAdoptionRecord(state, reference);
  if (resolved.code) {
    blockers.push(
      blocker(
        resolved.code,
        courseId,
        tenantId,
        [reference.adoption_id],
        [reference.adoption_digest]
      )
    );
    return { candidates, current: null, epoch: null, state, state_digest: stateDigest };
  }
  const adoption = resolved.record!;
  if (adoption.disposition !== "ADOPTED_FOR_FUTURE_ADMISSION") {
    blockers.push(
      blocker(
        "CURRENT_ADOPTION_NOT_EFFECTIVE",
        courseId,
        tenantId,
        [reference.adoption_id],
        [reference.adoption_digest]
      )
    );
    return { candidates, current: null, epoch: null, state, state_digest: stateDigest };
  }
  if (
    adoption.epoch.tenant_id !== tenantId ||
    adoption.epoch.course_id !== courseId ||
    !sameModelVersion(
      adoption.epoch.model_version_reference,
      state.selections[0]!.model_version_reference
    ) ||
    !sameArtifact(
      adoption.epoch.model_artifact_reference,
      state.selections[0]!.model_artifact_reference
    )
  ) {
    blockers.push(
      blocker(
        "CURRENT_ADOPTION_IDENTITY_MISMATCH",
        courseId,
        tenantId,
        [reference.adoption_id],
        [reference.adoption_digest]
      )
    );
    return { candidates, current: null, epoch: null, state, state_digest: stateDigest };
  }
  return {
    candidates,
    current: reference,
    epoch: clone(adoption.epoch),
    state,
    state_digest: stateDigest
  };
}

function selectQualification(
  record: ModelQualificationRecord,
  tenantId: string,
  courseId: string,
  epoch: EvidenceAdoptionEpoch | null,
  blockers: ModelQualificationCoursePortfolioBlocker[]
): {
  candidates: ModelQualificationCoursePortfolioQualificationIdentity[];
  selected: ModelQualification | null;
} {
  const raw = asRecord(record)?.qualifications;
  if (!Array.isArray(raw)) {
    blockers.push(blocker("GOVERNANCE_RECORD_MALFORMED", courseId, tenantId));
    return { candidates: [], selected: null };
  }
  const qualifications = raw
    .map(asQualification)
    .filter((qualification): qualification is ModelQualification => qualification !== null);
  const malformedQualification = raw.some(
    (qualification) => asQualification(qualification) === null
  );
  if (malformedQualification) {
    blockers.push(blocker("GOVERNANCE_RECORD_MALFORMED", courseId, tenantId));
    return {
      candidates: qualifications.map(qualificationIdentity).sort(compareQualificationIdentity),
      selected: null
    };
  }
  const candidates = qualifications.map(qualificationIdentity).sort(compareQualificationIdentity);
  if (qualifications.length === 0) {
    blockers.push(blocker("QUALIFICATION_MISSING", courseId, tenantId));
    return { candidates, selected: null };
  }

  let matches: readonly ModelQualification[];
  if (epoch) {
    const idMatches = qualifications.filter(
      (qualification) => qualification.qualification_id === epoch.qualification_id
    );
    matches = idMatches.filter(
      (qualification) => qualification.content_digest === epoch.qualification_content_digest
    );
    if (matches.length !== 1) {
      blockers.push(
        blocker(
          idMatches.length > 0 ? "QUALIFICATION_IDENTITY_MISMATCH" : "QUALIFICATION_MISSING",
          courseId,
          tenantId,
          [epoch.qualification_id],
          [epoch.qualification_content_digest]
        )
      );
      return { candidates, selected: null };
    }
  } else {
    matches = qualifications.length === 1 ? qualifications : [];
    if (matches.length !== 1) {
      blockers.push(
        blocker(
          "AMBIGUOUS_QUALIFICATION",
          courseId,
          tenantId,
          qualifications.map((qualification) => qualification.qualification_id),
          qualifications.map((qualification) => qualification.content_digest)
        )
      );
      return { candidates, selected: null };
    }
  }

  const selected = matches[0]!;
  if (selected.tenant_id !== tenantId || selected.course_id !== courseId) {
    blockers.push(
      blocker("QUALIFICATION_SCOPE_MISMATCH", courseId, selected.tenant_id ?? null, [
        selected.qualification_id
      ])
    );
    return { candidates, selected: null };
  }
  if (
    selected.authority_flags.official_truth_write !== false ||
    selected.authority_flags.provider_calls !== 0
  ) {
    blockers.push(
      blocker("QUALIFICATION_AUTHORITY_INVALID", courseId, tenantId, [selected.qualification_id])
    );
  }
  if (selected.no_implicit_latest !== true) {
    blockers.push(
      blocker("QUALIFICATION_IDENTITY_MISMATCH", courseId, tenantId, [selected.qualification_id])
    );
  }
  if (selected.decision !== "APPROVED") {
    blockers.push(
      blocker("QUALIFICATION_DECISION_INVALID", courseId, tenantId, [selected.qualification_id])
    );
  }
  if (selected.review.status !== "APPROVED") {
    blockers.push(
      blocker("QUALIFICATION_REVIEW_INVALID", courseId, tenantId, [selected.qualification_id])
    );
  }
  if (selected.binding.status !== "BOUND" || selected.binding.course_id !== courseId) {
    blockers.push(
      blocker("QUALIFICATION_BINDING_INVALID", courseId, tenantId, [selected.qualification_id])
    );
  }
  return {
    candidates,
    selected: blockers.some((item) => item.code === "QUALIFICATION_SCOPE_MISMATCH")
      ? null
      : clone(selected)
  };
}

function validateQualificationEvidence(
  record: ModelQualificationRecord,
  qualification: ModelQualification,
  epoch: EvidenceAdoptionEpoch | null,
  tenantId: string,
  courseId: string,
  blockers: ModelQualificationCoursePortfolioBlocker[]
): void {
  const raw = asRecord(record);
  const sources = raw?.source_packages;
  const datasets = raw?.calibration_datasets;
  if (!Array.isArray(sources) || !Array.isArray(datasets)) {
    blockers.push(blocker("GOVERNANCE_RECORD_MALFORMED", courseId, tenantId));
    return;
  }
  const sourceId = epoch?.source_package_id ?? qualification.source_package_id;
  const datasetId = epoch?.calibration_dataset_id ?? qualification.calibration_dataset_id;
  const sourceResult = findUniqueById(
    sources as readonly Record<string, unknown>[],
    "source_package_id",
    sourceId
  );
  if (sourceResult.ambiguous) {
    blockers.push(blocker("SOURCE_PACKAGE_AMBIGUOUS", courseId, tenantId, [sourceId]));
    return;
  }
  if (!sourceResult.value) {
    blockers.push(blocker("SOURCE_PACKAGE_MISSING", courseId, tenantId, [sourceId]));
    return;
  }
  const source = sourceResult.value;
  if (source.tenant_id !== tenantId || source.course_id !== courseId) {
    blockers.push(
      blocker("QUALIFICATION_EVIDENCE_SCOPE_MISMATCH", courseId, text(source.tenant_id), [sourceId])
    );
  }
  if (
    source.source_package_id !== qualification.source_package_id ||
    (epoch !== null &&
      (source.source_package_id !== epoch.source_package_id ||
        source.content_digest !== epoch.source_content_digest))
  ) {
    blockers.push(
      blocker(
        "QUALIFICATION_EVIDENCE_REFERENCE_MISMATCH",
        courseId,
        tenantId,
        [sourceId],
        [text(source.content_digest) ?? ""]
      )
    );
  }
  if (source.freshness_status !== "FRESH" || source.rights_status !== "VALID") {
    blockers.push(
      blocker("QUALIFICATION_EVIDENCE_REFERENCE_MISMATCH", courseId, tenantId, [sourceId])
    );
  }

  const datasetResult = findUniqueById(
    datasets as readonly Record<string, unknown>[],
    "calibration_dataset_id",
    datasetId
  );
  if (datasetResult.ambiguous) {
    blockers.push(blocker("CALIBRATION_DATASET_AMBIGUOUS", courseId, tenantId, [datasetId]));
    return;
  }
  if (!datasetResult.value) {
    blockers.push(blocker("CALIBRATION_DATASET_MISSING", courseId, tenantId, [datasetId]));
    return;
  }
  const dataset = datasetResult.value;
  if (dataset.tenant_id !== tenantId || dataset.course_id !== courseId) {
    blockers.push(
      blocker("QUALIFICATION_EVIDENCE_SCOPE_MISMATCH", courseId, text(dataset.tenant_id), [
        datasetId
      ])
    );
  }
  if (
    dataset.source_package_id !== qualification.source_package_id ||
    (epoch !== null &&
      (dataset.source_package_id !== epoch.source_package_id ||
        dataset.content_digest !== epoch.calibration_dataset_content_digest))
  ) {
    blockers.push(
      blocker(
        "QUALIFICATION_EVIDENCE_REFERENCE_MISMATCH",
        courseId,
        tenantId,
        [datasetId],
        [text(dataset.content_digest) ?? ""]
      )
    );
  }
  if (
    dataset.status !== "READY" ||
    dataset.zero_holdout_leakage !== true ||
    dataset.holdout_leakage_count !== 0
  ) {
    blockers.push(
      blocker("QUALIFICATION_EVIDENCE_REFERENCE_MISMATCH", courseId, tenantId, [datasetId])
    );
  }
  if (
    epoch &&
    !sameModelVersion(qualification.model_version_reference, epoch.model_version_reference)
  ) {
    blockers.push(
      blocker("QUALIFICATION_EVIDENCE_REFERENCE_MISMATCH", courseId, tenantId, [
        qualification.qualification_id
      ])
    );
  }
  if (epoch && !sameArtifact(qualification.artifact, epoch.model_artifact_reference)) {
    blockers.push(
      blocker("QUALIFICATION_EVIDENCE_REFERENCE_MISMATCH", courseId, tenantId, [
        qualification.qualification_id
      ])
    );
  }
}

function deriveO8Outcomes(
  record: ModelQualificationRecord,
  state: EvidenceAdoptionState | null,
  tenantId: string,
  courseId: string,
  qualificationConsistency: ModelQualificationRollbackConsistencyStatus,
  blockers: ModelQualificationCoursePortfolioBlocker[]
): ModelQualificationCoursePortfolioO8Summary[] {
  const requests = asRecord(record)?.governed_rollback_requests;
  if (requests === undefined) return [];
  if (!Array.isArray(requests) || !state) {
    blockers.push(blocker("O8_OUTCOME_INVALID", courseId, tenantId));
    return [];
  }
  const summaries: ModelQualificationCoursePortfolioO8Summary[] = [];
  for (const request of requests) {
    try {
      const resolved = resolveRollbackRequestOutcome({
        tenant_id: tenantId,
        course_id: courseId,
        request,
        adoption_state: state
      });
      const historical = resolved.linked_proposal
        ? assessReadoptionHistoricalConsistency({
            tenant_id: tenantId,
            course_id: courseId,
            current_adoption: request.current_adoption,
            target_adoption: request.predecessor_adoption,
            proposal: resolved.linked_proposal,
            review: resolved.review,
            disposition: resolved.disposition,
            adoption_state: state
          })
        : null;
      const source = historical
        ? {
            current_effect: historical.current_effect,
            historical_consistency: historical.historical_consistency,
            outcome_status:
              historical.historical_consistency === "INCONSISTENT"
                ? ("REBASE_REQUIRED" as const)
                : historical.outcome_status,
            resulting_adoption: historical.resulting_adoption,
            known_limits: historical.known_limits
          }
        : {
            current_effect: resolved.current_effect,
            historical_consistency: resolved.historical_consistency,
            outcome_status: resolved.outcome_status,
            resulting_adoption: resolved.resulting_adoption,
            known_limits: resolved.known_limits
          };
      const { resolution_digest: resolvedDigest, ...resolvedWithoutDigest } = resolved;
      void resolvedDigest;
      const body: Omit<ModelQualificationRollbackOutcomeResolution, "resolution_digest"> = {
        ...resolvedWithoutDigest,
        schema_version: "model-qualification-rollback-outcome.v1",
        outcome_status: source.outcome_status,
        historical_outcome: {
          ...resolved.historical_outcome,
          status: source.outcome_status,
          resulting_adoption: source.resulting_adoption
        },
        resulting_adoption: source.resulting_adoption,
        current_effect: source.current_effect,
        qualification_consistency: qualificationConsistency,
        historical_consistency: source.historical_consistency,
        known_limits: [...source.known_limits],
        visibility: "TEACHER_ADMIN_DETAIL"
      };
      const outcome: ModelQualificationRollbackOutcomeResolution = {
        ...body,
        resolution_digest: stableSha256(body)
      };
      summaries.push(summarizeO8(outcome));
    } catch {
      blockers.push(blocker("O8_OUTCOME_INVALID", courseId, tenantId));
    }
  }
  return summaries.sort(o8SummarySort);
}

function buildEntry(
  course: ModelQualificationAuthorizedCourse,
  record: ModelQualificationRecord | null,
  recordBlockers: readonly ModelQualificationCoursePortfolioBlocker[],
  suppliedOutcomes: readonly ModelQualificationRollbackOutcomeResolution[] | undefined,
  suppliedOutcomeBlockers: readonly ModelQualificationCoursePortfolioBlocker[]
): ModelQualificationCoursePortfolioEntry {
  const blockers = [...recordBlockers, ...suppliedOutcomeBlockers];
  if (!record) {
    blockers.push(blocker("GOVERNANCE_RECORD_MISSING", course.course_id, course.tenant_id));
    return {
      adoption_state_digest: null,
      blockers: uniqueSortedBlockers(blockers),
      course: clone(course),
      current_adoption: null,
      current_adoption_candidates: [],
      current_adoption_epoch: null,
      known_limits: [...PORTFOLIO_KNOWN_LIMITS, NO_CURRENT_ADOPTION_LIMIT, NO_O8_LIMIT].sort(
        (a, b) => a.localeCompare(b)
      ),
      o8_outcomes: suppliedOutcomes ? suppliedOutcomes.map(summarizeO8).sort(o8SummarySort) : [],
      qualification: null,
      qualification_candidates: [],
      qualification_consistency: "BLOCKED",
      writer_effect: "NONE"
    };
  }

  const localBlockers = [...blockers];
  const adoption = inspectAdoption(record, course.tenant_id, course.course_id, localBlockers);
  const selectedQualification = selectQualification(
    record,
    course.tenant_id,
    course.course_id,
    adoption.epoch,
    localBlockers
  );
  if (selectedQualification.selected) {
    validateQualificationEvidence(
      record,
      selectedQualification.selected,
      adoption.epoch,
      course.tenant_id,
      course.course_id,
      localBlockers
    );
  }
  const qualificationBlockers = uniqueSortedBlockers(localBlockers);
  const qualificationConsistency: ModelQualificationRollbackConsistencyStatus =
    qualificationBlockers.some((item) => INCONSISTENT_CODES.has(item.code))
      ? "INCONSISTENT"
      : qualificationBlockers.length > 0
        ? "BLOCKED"
        : adoption.current
          ? "CONSISTENT"
          : "LIMITED";
  const o8Outcomes = suppliedOutcomes
    ? suppliedOutcomes.map(summarizeO8).sort(o8SummarySort)
    : deriveO8Outcomes(
        record,
        adoption.state,
        course.tenant_id,
        course.course_id,
        qualificationConsistency,
        localBlockers
      );
  const entryBlockers = uniqueSortedBlockers(localBlockers);
  const knownLimits: string[] = [...PORTFOLIO_KNOWN_LIMITS];
  if (!adoption.current) knownLimits.push(NO_CURRENT_ADOPTION_LIMIT);
  if (o8Outcomes.length === 0) knownLimits.push(NO_O8_LIMIT);
  return {
    adoption_state_digest: adoption.state_digest,
    blockers: entryBlockers,
    course: clone(course),
    current_adoption: adoption.current ? clone(adoption.current) : null,
    current_adoption_candidates: adoption.candidates.map(clone),
    current_adoption_epoch: adoption.epoch ? clone(adoption.epoch) : null,
    known_limits: sortedUnique(knownLimits),
    o8_outcomes: o8Outcomes,
    qualification: selectedQualification.selected ? clone(selectedQualification.selected) : null,
    qualification_candidates: selectedQualification.candidates,
    qualification_consistency: qualificationConsistency,
    writer_effect: "NONE"
  };
}

function digestEntry(entry: ModelQualificationCoursePortfolioEntry): Record<string, unknown> {
  return {
    adoption_state_digest: entry.adoption_state_digest,
    blockers: entry.blockers,
    course: entry.course,
    current_adoption: entry.current_adoption,
    current_adoption_candidates: entry.current_adoption_candidates,
    current_adoption_epoch: entry.current_adoption_epoch,
    known_limits: entry.known_limits,
    o8_outcomes: entry.o8_outcomes,
    qualification: entry.qualification
      ? {
          artifact: entry.qualification.artifact,
          authority_flags: entry.qualification.authority_flags,
          binding: entry.qualification.binding,
          calibration_dataset_id: entry.qualification.calibration_dataset_id,
          content_digest: entry.qualification.content_digest,
          course_id: entry.qualification.course_id,
          decision: entry.qualification.decision,
          model_version_reference: entry.qualification.model_version_reference,
          qualification_id: entry.qualification.qualification_id,
          review: entry.qualification.review,
          source_package_id: entry.qualification.source_package_id,
          tenant_id: entry.qualification.tenant_id
        }
      : null,
    qualification_candidates: entry.qualification_candidates,
    qualification_consistency: entry.qualification_consistency,
    writer_effect: entry.writer_effect
  };
}

function canonicalCourse(
  value: unknown,
  tenantId: string
): ModelQualificationAuthorizedCourse | null {
  const candidate = asRecord(value);
  if (!candidate) return null;
  const courseId = text(candidate.course_id);
  const candidateTenant = text(candidate.tenant_id);
  const title = text(candidate.title);
  if (!courseId || !candidateTenant || !title || candidateTenant !== tenantId) return null;
  return { course_id: courseId, tenant_id: candidateTenant, title };
}

/**
 * Build a tenant-scoped course portfolio from caller-supplied canonical
 * courses and exact governance data. This function is pure, query-only, and
 * never discovers, selects, persists, or mutates a governance record.
 */
export function buildModelQualificationCoursePortfolio(
  input: ModelQualificationCoursePortfolioInput
): ModelQualificationCoursePortfolio {
  const tenantId = text(input?.tenant_id) ?? "";
  const globalBlockers: ModelQualificationCoursePortfolioBlocker[] = [];
  const authorizedByCourse = new Map<string, ModelQualificationAuthorizedCourse>();
  const duplicateCourseIds = new Set<string>();
  const rawCourses = Array.isArray(input?.authorized_courses) ? input.authorized_courses : [];
  if (!Array.isArray(input?.authorized_courses)) {
    globalBlockers.push(blocker("AUTHORIZED_COURSE_INVALID", null, tenantId || null));
  }
  for (const rawCourse of rawCourses) {
    const candidate = canonicalCourse(rawCourse, tenantId);
    const raw = asRecord(rawCourse);
    const rawId = text(raw?.course_id);
    const rawTenant = text(raw?.tenant_id);
    if (!candidate) {
      globalBlockers.push(
        blocker(
          rawTenant && rawTenant !== tenantId
            ? "AUTHORIZED_COURSE_SCOPE_MISMATCH"
            : "AUTHORIZED_COURSE_INVALID",
          rawId,
          rawTenant
        )
      );
      continue;
    }
    if (authorizedByCourse.has(candidate.course_id)) {
      duplicateCourseIds.add(candidate.course_id);
      authorizedByCourse.delete(candidate.course_id);
      globalBlockers.push(blocker("AUTHORIZED_COURSE_DUPLICATE", candidate.course_id, tenantId));
      continue;
    }
    if (duplicateCourseIds.has(candidate.course_id)) continue;
    authorizedByCourse.set(candidate.course_id, candidate);
  }

  const recordsByCourse = new Map<string, ModelQualificationRecord[]>();
  const rawRecords = Array.isArray(input?.governance_records) ? input.governance_records : [];
  if (!Array.isArray(input?.governance_records)) {
    globalBlockers.push(blocker("GOVERNANCE_RECORD_MALFORMED", null, tenantId || null));
  }
  for (const rawRecord of rawRecords) {
    const record = asRecord(rawRecord);
    const recordTenant = text(record?.tenant_id);
    const recordCourse = text(record?.course_id);
    if (!recordTenant || !recordCourse) {
      globalBlockers.push(blocker("GOVERNANCE_RECORD_MALFORMED", recordCourse, recordTenant));
      continue;
    }
    if (recordTenant !== tenantId) {
      globalBlockers.push(blocker("SCOPE_MISMATCH", recordCourse, recordTenant, [recordCourse]));
      continue;
    }
    if (!authorizedByCourse.has(recordCourse)) {
      globalBlockers.push(
        blocker("ORPHAN_GOVERNANCE_RECORD", recordCourse, recordTenant, [recordCourse])
      );
      continue;
    }
    const bucket = recordsByCourse.get(recordCourse) ?? [];
    bucket.push(rawRecord);
    recordsByCourse.set(recordCourse, bucket);
  }

  const suppliedOutcomesByCourse = new Map<string, ModelQualificationRollbackOutcomeResolution[]>();
  const suppliedOutcomeBlockersByCourse = new Map<
    string,
    ModelQualificationCoursePortfolioBlocker[]
  >();
  if (input?.o8_outcomes !== undefined) {
    if (!Array.isArray(input.o8_outcomes)) {
      globalBlockers.push(blocker("O8_OUTCOME_INVALID", null, tenantId || null));
    } else {
      for (const outcome of input.o8_outcomes) {
        const rawOutcome = asRecord(outcome);
        const outcomeTenant = text(rawOutcome?.tenant_id);
        const outcomeCourse = text(rawOutcome?.course_id);
        if (!outcomeTenant || !outcomeCourse || !hasValidO8Digest(outcome)) {
          globalBlockers.push(blocker("O8_OUTCOME_INVALID", outcomeCourse, outcomeTenant));
          continue;
        }
        if (outcomeTenant !== tenantId) {
          globalBlockers.push(blocker("O8_OUTCOME_SCOPE_MISMATCH", outcomeCourse, outcomeTenant));
          continue;
        }
        if (!authorizedByCourse.has(outcomeCourse)) {
          globalBlockers.push(blocker("ORPHAN_O8_OUTCOME", outcomeCourse, outcomeTenant));
          continue;
        }
        const bucket = suppliedOutcomesByCourse.get(outcomeCourse) ?? [];
        bucket.push(outcome);
        suppliedOutcomesByCourse.set(outcomeCourse, bucket);
      }
    }
  }

  const entries: ModelQualificationCoursePortfolioEntry[] = [];
  for (const course of [...authorizedByCourse.values()].sort((left, right) =>
    left.course_id.localeCompare(right.course_id)
  )) {
    const records = recordsByCourse.get(course.course_id) ?? [];
    const recordBlockers: ModelQualificationCoursePortfolioBlocker[] = [];
    let record: ModelQualificationRecord | null = null;
    if (records.length === 1) record = records[0]!;
    else if (records.length > 1) {
      recordBlockers.push(
        blocker(
          "AMBIGUOUS_GOVERNANCE_RECORD",
          course.course_id,
          tenantId,
          records.map((candidate) => candidate.course_id)
        )
      );
      globalBlockers.push(recordBlockers[0]!);
    }
    const suppliedOutcomes = suppliedOutcomesByCourse.get(course.course_id);
    const outcomeBlockers = suppliedOutcomeBlockersByCourse.get(course.course_id) ?? [];
    entries.push(buildEntry(course, record, recordBlockers, suppliedOutcomes, outcomeBlockers));
  }

  const courses = entries.sort((left, right) =>
    left.course.course_id.localeCompare(right.course.course_id)
  );
  const allBlockers = uniqueSortedBlockers([
    ...globalBlockers,
    ...courses.flatMap((entry) => entry.blockers)
  ]);
  const knownLimits = sortedUnique([
    ...PORTFOLIO_KNOWN_LIMITS,
    "Portfolio membership is not inferred from governance data that is absent from the supplied canonical course list."
  ]);
  const portfolioStatus: ModelQualificationCoursePortfolioStatus =
    allBlockers.length === 0 ? "READY" : "BLOCKED";
  const digestBody = {
    blockers: allBlockers,
    courses: courses.map(digestEntry),
    derived: true,
    formal_truth_write: false,
    known_limits: knownLimits,
    no_new_registry: true,
    no_new_store: true,
    no_new_writer: true,
    official_truth_write: false,
    portfolio_status: portfolioStatus,
    provider: "OFF",
    query_only: true,
    rank_write: false,
    schema_version: MODEL_QUALIFICATION_COURSE_PORTFOLIO_SCHEMA_VERSION,
    score_write: false,
    settlement_write: false,
    tenant_id: tenantId,
    writes_formal_truth: false,
    writer_effect: "NONE"
  };
  return {
    adoption_mutation: false,
    blockers: allBlockers,
    courses,
    derived: true,
    formal_truth_write: false,
    history_deleted: false,
    known_limits: knownLimits,
    no_new_registry: true,
    no_new_store: true,
    no_new_writer: true,
    official_truth_write: false,
    portfolio_state_digest: stableSha256(digestBody),
    portfolio_status: portfolioStatus,
    provider: "OFF",
    query_only: true,
    rank_write: false,
    rollback_applied: false,
    score_write: false,
    schema_version: MODEL_QUALIFICATION_COURSE_PORTFOLIO_SCHEMA_VERSION,
    settlement_write: false,
    writes_formal_truth: false,
    writer_effect: "NONE"
  };
}
