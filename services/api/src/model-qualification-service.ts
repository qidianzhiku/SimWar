import { createHash } from "node:crypto";
import {
  assertEvidenceAdoptionState,
  emptyEvidenceAdoptionState,
  requestEvidenceAdoption,
  reviewEvidenceAdoption,
  disposeEvidenceAdoption,
  resolveFutureEvidenceAdoption,
  resolveHistoricalEvidenceAdoption
} from "./model-qualification-evidence-adoption.js";
import { deriveEvidenceAdoptionEpoch } from "./model-qualification-adopted-run-admission.js";
import {
  assessAdoptionDrift,
  digestAdoptionOperationsPolicy,
  digestEvidenceAdoptionState,
  stableSha256
} from "./model-qualification-adoption-drift-assessment.js";
import { runAdoptionRollbackDryRun } from "./model-qualification-rollback-dry-run.js";
import {
  createGovernedRollbackRequest,
  digestPersistedGovernedRollbackRequest,
  GovernedRollbackRequestError,
  isPersistedGovernedRollbackRequest
} from "./model-qualification-governed-rollback-request.js";
import {
  classifyExplicitReadoptionTarget,
  ExplicitReadoptionError,
  predictExplicitReadoption
} from "./model-qualification-explicit-readoption.js";
import { resolveRollbackRequestOutcome } from "./model-qualification-rollback-request-resolution.js";
import { assessReadoptionHistoricalConsistency } from "./model-qualification-readoption-historical-consistency.js";
import {
  buildIndustryModelDiagnosticReadiness,
  type IndustryModelDiagnosticReadinessInput
} from "./industry-model-diagnostic-readiness.js";
import { interpretIndustryModelDiagnostics } from "./industry-model-diagnostic-interpretation.js";
import { readQualifiedProducerLineage } from "./industry-model-qualified-producer-lineage.js";
import {
  reconcileQualifiedProducerEvidence,
  type QualifiedProducerEvidenceCandidate
} from "./industry-model-qualified-producer-admission.js";
import {
  buildModelQualificationCoursePortfolio,
  type ModelQualificationAuthorizedCourse,
  type ModelQualificationCoursePortfolio
} from "./model-qualification-course-portfolio.js";
import {
  buildModelQualificationPortfolioSupersessionPreview,
  digestModelQualificationPortfolioCourseState,
  type ModelQualificationPortfolio,
  type ModelQualificationPortfolioCourseState,
  type ModelQualificationPortfolioSupersessionPreview
} from "./model-qualification-portfolio-supersession-preview.js";
import {
  buildPortfolioChangeSetRequest,
  digestPortfolioChangeSetPolicy,
  type PortfolioChangeSetRequestEnvelope
} from "./model-qualification-portfolio-changeset-request.js";
import {
  buildPerCourseGovernedHandoffs,
  type PerCourseGovernedHandoff
} from "./model-qualification-per-course-governed-handoff.js";
import {
  buildStrategicPortfolioModelGovernanceReadiness,
  STRATEGIC_PORTFOLIO_MODEL_GOVERNANCE_READINESS_POLICY_DIGEST,
  type StrategicPortfolioModelGovernanceReadiness
} from "./strategic-portfolio-model-governance-readiness.js";
import {
  projectStrategicPortfolioModelGovernanceReadiness,
  type StrategicPortfolioModelGovernanceRoleProjection
} from "./strategic-portfolio-model-governance-role-projection.js";
import type {
  AdoptionDriftAssessment,
  AdoptionDriftAssessmentRequest,
  AdoptionRollbackDryRun,
  AdoptionRollbackDryRunRequest,
  DisposeEvidenceAdoption,
  EvidenceAdoptionCommandContext,
  EvidenceAdoptionReference,
  EvidenceAdoptionState,
  GovernedRollbackRequest,
  GovernedRollbackRequestInput,
  GovernedRollbackRequestReceipt,
  QualifiedRunAdmissionSnapshot,
  CoursePackageVersion,
  ReviewEvidenceAdoption,
  AuditLog,
  ModelArtifactReference,
  ModelVersionReference,
  ModelQualification,
  ModelQualificationAdminProjection,
  ModelQualificationAdoptionOperationsAdminProjection,
  ModelQualificationAdoptionOperationsStudentProjection,
  ModelQualificationAdoptionOperationsTeacherProjection,
  ModelQualificationCalibrationDataset,
  ModelQualificationDecision,
  ModelQualificationDiagnostics,
  ModelQualificationEvidenceChangeDimension,
  ModelQualificationEvidenceChangeSet,
  ModelQualificationEvidenceIdentity,
  ModelQualificationModelCatalogEntry,
  ModelQualificationRecord,
  ModelQualificationRequalificationPreview,
  ModelQualificationRequalificationStatus,
  ModelQualificationStudentProjection,
  ModelQualificationTeacherProjection,
  ModelQualificationSourcePackage,
  ModelQualificationRollbackOutcomeResolution,
  ModelQualificationRollbackOutcomeStudentSummary,
  IndustryQualifiedProducerAdmissionDto,
  IndustryModelDiagnosticReadinessDto,
  IndustryModelRealityJoinDto,
  IndustryModelRealityJoinSupportEvidenceDto,
  CanServiceFeasibilityCandidate,
  CanServiceFeasibilityDomainInput,
  W5ConvergenceProjection,
  W5ScenarioDraft
} from "@simwar/shared-contracts";
import {
  MODEL_QUALIFICATION_ROLLBACK_OUTCOME_SCHEMA_VERSION,
  MODEL_QUALIFICATION_SOLE_WRITER
} from "@simwar/shared-contracts";
import { composeIndustryModelRealityJoinSupport } from "./industry-model-reality-join-evidence.js";
import { adaptCanIndustryDiagnosticProducer } from "./industry-model-can-producer-adapter.js";
import { adaptW5IndustryDiagnosticProducers } from "./industry-model-w5-producer-adapter.js";
import { evaluateCanServiceFeasibility } from "@simwar/simulation-core";

export interface ModelQualificationActor {
  actor_id: string;
  role: "student" | "learner" | "teacher" | "tenant_admin";
  tenant_id: string;
}

export interface ModelQualificationScope {
  activity_id: string;
  course_id: string;
  tenant_id: string;
}

export interface IndustryDiagnosticW5ReaderInput {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly run_id: string;
  readonly team_id: string;
  readonly round_id: string;
  readonly round_no: number;
  readonly scenario_package_id: string;
  readonly parameter_set_id: string;
  readonly w5_draft_id: string;
}

export interface IndustryDiagnosticW5Reader {
  read(
    actor: ModelQualificationActor,
    input: IndustryDiagnosticW5ReaderInput
  ): { readonly draft: W5ScenarioDraft; readonly convergence: W5ConvergenceProjection } | null;
}

function numericW5Parameter(
  values: Readonly<Record<string, boolean | number | string>>,
  key: string
): number | null {
  const value = values[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function numericW5Constraint(constraints: readonly string[], name: string): number | undefined {
  const raw = constraints.find((constraint) => constraint.startsWith(`${name}=`));
  if (!raw) return undefined;
  const value = Number(raw.slice(name.length + 1));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function buildCanCandidateFromW5(input: {
  readonly context: IndustryDiagnosticW5ReaderInput;
  readonly draft: W5ScenarioDraft;
  readonly convergence: W5ConvergenceProjection;
}): CanServiceFeasibilityCandidate | null {
  const draftBinding = input.draft.exact_runtime_binding;
  if (!draftBinding || draftBinding.status !== "BOUND") return null;
  const demand = numericW5Parameter(input.draft.parameter_values, "customer_demand");
  const workforce = numericW5Parameter(input.draft.parameter_values, "caregiver_supply");
  if (demand === null || workforce === null) return null;
  const bindingWithoutDigest = {
    course_id: draftBinding.course_id,
    model_version_ref: draftBinding.model_version_ref,
    no_implicit_latest: true as const,
    parameter_set_reference: { ...draftBinding.parameter_set_reference },
    round_id: input.context.round_id,
    round_no: draftBinding.round_no,
    run_id: draftBinding.run_id,
    scenario_package_reference: { ...draftBinding.scenario_package_reference },
    seed: draftBinding.seed,
    tenant_id: draftBinding.tenant_id
  };
  const capacity = numericW5Constraint(input.convergence.can.constraints, "capacity");
  const domainInput: CanServiceFeasibilityDomainInput = {
    ...(capacity === undefined
      ? {}
      : {
          available_capacity_units: {
            source_ref: `w5:${input.context.w5_draft_id}:can.capacity`,
            unit: "service_units",
            value: capacity
          }
        }),
    binding: {
      ...bindingWithoutDigest,
      binding_digest: stableSha256(bindingWithoutDigest)
    },
    demand_units: {
      source_ref: `w5:${input.context.w5_draft_id}:customer_demand`,
      unit: "households",
      value: demand
    },
    eligibility: {
      licensed: {
        source_ref: `w5:${input.context.w5_draft_id}:eligibility:input-unavailable`,
        value: null
      },
      staffing_compliant: {
        source_ref: `w5:${input.context.w5_draft_id}:eligibility:input-unavailable`,
        value: null
      }
    },
    minimum_service_quality_budget: {
      source_ref: "r1:minimum_service_quality_budget_v1",
      unit: "CNY",
      value: 120000
    },
    minimum_workforce_units: {
      source_ref: "r1:minimum_workforce_units_v1",
      unit: "people",
      value: 1
    },
    service_quality_budget: {
      source_ref: `w5:${input.context.w5_draft_id}:service_quality_budget_formula_v1`,
      unit: "CNY",
      value: 120000 + demand * 250
    },
    workforce_units: {
      source_ref: `w5:${input.context.w5_draft_id}:caregiver_supply`,
      unit: "people",
      value: workforce
    }
  };
  try {
    return evaluateCanServiceFeasibility(domainInput);
  } catch {
    return null;
  }
}

function toDiagnosticProducer(
  producer: {
    readonly producer_id: string;
    readonly diagnostic_family: string;
    readonly classification: IndustryModelDiagnosticReadinessInput["producers"][number]["candidate_classification"];
    readonly evidence_identity: string;
    readonly authority_owner: string;
    readonly source: { readonly path: string; readonly symbol: string };
    readonly freshness: "FRESH" | "STALE" | "UNKNOWN";
    readonly known_limits?: readonly string[];
  },
  contract: string,
  tests: readonly string[]
): IndustryModelDiagnosticReadinessInput["producers"][number] {
  return {
    producer_id: producer.producer_id,
    current_source_path: producer.source.path,
    exact_symbol: producer.source.symbol,
    contract,
    diagnostic_family: producer.diagnostic_family,
    evidence_identity: producer.evidence_identity,
    tests,
    freshness: producer.freshness,
    authority_owner: producer.authority_owner,
    candidate_classification: producer.classification,
    ...(producer.known_limits ? { known_limits: [...producer.known_limits] } : {})
  };
}

function reconcileDiagnosticProducer(input: {
  readonly producer: {
    readonly producer_id: string;
    readonly diagnostic_family: string;
    readonly classification: IndustryModelDiagnosticReadinessInput["producers"][number]["candidate_classification"];
    readonly evidence_identity: string;
    readonly authority_owner: string;
    readonly source: { readonly path: string; readonly symbol: string };
    readonly freshness: "FRESH" | "STALE" | "UNKNOWN";
    readonly known_limits?: readonly string[];
    readonly official_truth_write?: false;
    readonly producer_model_version_reference?: ModelVersionReference;
    readonly producer_model_artifact_reference?: ModelArtifactReference;
    readonly producer_qualification_id?: string;
    readonly producer_qualification_digest?: string;
  };
  readonly identity_movements: readonly string[];
  readonly qualification: {
    readonly qualification_id: string;
    readonly qualification_digest: string;
    readonly model_version_reference: ModelVersionReference;
    readonly model_artifact_reference: ModelArtifactReference;
  };
  readonly contract: string;
  readonly tests: readonly string[];
}): {
  readonly producer: IndustryModelDiagnosticReadinessInput["producers"][number];
  readonly admission: IndustryQualifiedProducerAdmissionDto;
} {
  const lineage = readQualifiedProducerLineage({
    ...(input.producer.producer_model_version_reference
      ? { producer_model_version_reference: input.producer.producer_model_version_reference }
      : {}),
    ...(input.producer.producer_model_artifact_reference
      ? { producer_model_artifact_reference: input.producer.producer_model_artifact_reference }
      : {}),
    ...(input.producer.producer_qualification_id
      ? { producer_qualification_id: input.producer.producer_qualification_id }
      : {}),
    ...(input.producer.producer_qualification_digest
      ? { producer_qualification_digest: input.producer.producer_qualification_digest }
      : {}),
    identity_movements: input.identity_movements
  });
  const candidate: QualifiedProducerEvidenceCandidate = {
    producer_id: input.producer.producer_id,
    diagnostic_family: input.producer.diagnostic_family,
    candidate_classification: input.producer.classification,
    evidence_identity: input.producer.evidence_identity,
    authority_owner: input.producer.authority_owner,
    source: input.producer.source,
    freshness: input.producer.freshness,
    ...(input.producer.known_limits ? { known_limits: [...input.producer.known_limits] } : {}),
    official_truth_write: false,
    ...(lineage.model_version_reference
      ? { producer_model_version_reference: lineage.model_version_reference }
      : {}),
    ...(lineage.model_artifact_reference
      ? { producer_model_artifact_reference: lineage.model_artifact_reference }
      : {}),
    ...(lineage.qualification_id ? { producer_qualification_id: lineage.qualification_id } : {}),
    ...(lineage.qualification_digest
      ? { producer_qualification_digest: lineage.qualification_digest }
      : {}),
    ...(lineage.identity_movements.length > 0
      ? { identity_movements: lineage.identity_movements }
      : {})
  };
  const reconciled = reconcileQualifiedProducerEvidence({
    qualification: input.qualification,
    producer: candidate
  });
  const producer = toDiagnosticProducer(
    {
      producer_id: reconciled.producer.producer_id,
      diagnostic_family: reconciled.producer.diagnostic_family,
      classification: reconciled.producer.candidate_classification,
      evidence_identity: reconciled.producer.evidence_identity,
      authority_owner: reconciled.producer.authority_owner,
      source: reconciled.producer.source,
      freshness: reconciled.producer.freshness,
      known_limits: reconciled.known_limits
    },
    input.contract,
    input.tests
  );
  return {
    producer,
    admission: {
      producer_id: reconciled.producer.producer_id,
      status: reconciled.status,
      admission_digest: reconciled.admission_digest,
      known_limits: reconciled.known_limits
    }
  };
}

export interface ModelQualificationPortfolioChangeSetQuery {
  readonly request: PortfolioChangeSetRequestEnvelope;
  readonly handoffs: readonly PerCourseGovernedHandoff[];
}

export interface ModelQualificationClock {
  now(): string;
}

export interface ModelQualificationSourceInput {
  content_digest: string;
  evidence_refs: readonly string[];
  expires_at?: string | null;
  feature_schema_digest: string;
  freshness_status: ModelQualificationSourcePackage["freshness_status"];
  observed_at: string;
  quality: ModelQualificationSourcePackage["quality"];
  rights_status: ModelQualificationSourcePackage["rights_status"];
  source_ref: string;
  source_version: string;
  title: string;
}

export interface ModelQualificationDatasetInput {
  calibration_record_ids: readonly string[];
  content_digest: string;
  holdout_record_ids: readonly string[];
  source_package_id: string;
}

export interface ModelQualificationRunInput {
  calibration_dataset_id: string;
  deterministic_seed: number;
  model_version_reference: ModelVersionReference;
  source_package_id: string;
}

export interface ModelQualificationPersistence {
  commitRecord(record: ModelQualificationRecord, auditLog: AuditLog): void;
  listRecords(): readonly ModelQualificationRecord[];
}

export const MODEL_QUALIFICATION_MODEL_VERSION: ModelQualificationModelCatalogEntry = {
  artifact: {
    artifact_id: "artifact_toy_logit_v2",
    content_digest: "e".repeat(64),
    format: "typescript-boundary",
    source_ref: "services/simulation-core/src/toy-logit-engine.ts"
  },
  model_family: "toy_logit",
  model_version_reference: {
    content_digest: "c".repeat(64),
    model_version_id: "toy_logit_wellness_v2",
    version: "2.0.0"
  },
  status: "APPROVED"
};

export const DEFAULT_MODEL_QUALIFICATION_LIMITS = [
  "Qualification is candidate governance evidence and never official REALIZED truth.",
  "Provider is OFF; PyBLP and external models remain offline/reference-only.",
  "PostgreSQL/RLS is not activated; JSON_INTERNAL_ONLY remains the runtime authority.",
  "A qualification is bound only after exact ModelVersion/ModelArtifact review.",
  "Shanghai or other domain calibration is not implied by a generic source package."
] as const;

const DEFAULT_CLOCK: ModelQualificationClock = { now: () => new Date().toISOString() };
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const MAX_DRIFT = 0.25;
const MAX_OOD = 0.1;
const MAX_SENSITIVITY_DELTA = 0.2;
const MAX_MISSINGNESS = 0.1;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
    .join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value), "utf8").digest("hex");
}

function liveQualificationConsistency(
  record: ModelQualificationRecord,
  state: EvidenceAdoptionState,
  request: GovernedRollbackRequest,
  now: string
): ModelQualificationRollbackOutcomeResolution["qualification_consistency"] {
  const requestRecord = state.records.find(
    (candidate) =>
      candidate.adoption_id === request.current_adoption.adoption_id &&
      candidate.adoption_digest === request.current_adoption.adoption_digest
  );
  if (!requestRecord) return "BLOCKED";
  const currentSelections = state.selections.filter(
    (selection) =>
      stable(selection.model_version_reference) ===
        stable(requestRecord.epoch.model_version_reference) &&
      stable(selection.model_artifact_reference) ===
        stable(requestRecord.epoch.model_artifact_reference)
  );
  if (currentSelections.length !== 1) return "BLOCKED";
  try {
    const assessment = assessAdoptionDrift({
      assessed_at: now,
      expected_adoption: {
        adoption_id: currentSelections[0]!.adoption_id,
        adoption_digest: currentSelections[0]!.adoption_digest
      },
      expected_adoption_state_digest: digestEvidenceAdoptionState(state),
      expected_operations_policy_digest: digestAdoptionOperationsPolicy(),
      record,
      selection_requirement: "CURRENT",
      state
    });
    if (assessment.status === "HEALTHY") return "CONSISTENT";
    if (assessment.status === "REVIEW_REQUIRED") return "LIMITED";
    return "BLOCKED";
  } catch {
    return "BLOCKED";
  }
}

function withResolutionDigest(
  resolution: ModelQualificationRollbackOutcomeResolution
): ModelQualificationRollbackOutcomeResolution {
  const body: Record<string, unknown> = { ...resolution };
  delete body.resolution_digest;
  return { ...resolution, resolution_digest: stableSha256(body) };
}

function assertGovernedRollbackRequestIntegrity(record: ModelQualificationRecord): void {
  const requests = record.governed_rollback_requests;
  if (requests !== undefined && !Array.isArray(requests)) {
    throw new Error("EVIDENCE_ADOPTION_STATE_INVALID");
  }
  if (requests === undefined) return;
  if (requests.length === 0) return;
  const state = record.evidence_adoption;
  if (!state) throw new Error("EVIDENCE_ADOPTION_STATE_INVALID");
  assertEvidenceAdoptionState(state);
  const commandIds = new Set<string>();
  const requestIds = new Set<string>();
  for (const request of requests) {
    if (
      !isPersistedGovernedRollbackRequest(request) ||
      request.tenant_id !== record.tenant_id ||
      request.course_id !== record.course_id ||
      commandIds.has(request.command_id) ||
      requestIds.has(request.rollback_request_id)
    ) {
      throw new Error("EVIDENCE_ADOPTION_STATE_INVALID");
    }
    commandIds.add(request.command_id);
    requestIds.add(request.rollback_request_id);
    const proposals = state.proposals.filter(
      (proposal) =>
        proposal.proposal_id === request.linked_proposal.proposal_id &&
        proposal.proposal_digest === request.linked_proposal.proposal_digest
    );
    if (proposals.length !== 1) throw new Error("EVIDENCE_ADOPTION_STATE_INVALID");
    const proposal = proposals[0]!;
    if (
      stable(proposal.epoch) !== stable(request.predecessor_epoch) ||
      stable(proposal.expected_adoption) !== stable(request.current_adoption) ||
      proposal.requested_by !== request.requested_by ||
      proposal.requested_at !== request.requested_at
    ) {
      throw new Error("EVIDENCE_ADOPTION_STATE_INVALID");
    }
  }
}

function sequenceFromId(value: string): number {
  const suffix = value.match(/_(\d+)$/)?.[1];
  return suffix ? Number(suffix) : 0;
}

function isExactModelReference(left: ModelVersionReference, right: ModelVersionReference): boolean {
  return (
    left.model_version_id === right.model_version_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function isFiniteRatio(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isIsoTimestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function validateSourceInput(input: ModelQualificationSourceInput): void {
  if (
    !input.title.trim() ||
    !input.source_ref.trim() ||
    !input.source_version.trim() ||
    !input.observed_at.trim() ||
    !isIsoTimestamp(input.observed_at) ||
    !DIGEST_PATTERN.test(input.content_digest) ||
    !DIGEST_PATTERN.test(input.feature_schema_digest) ||
    input.evidence_refs.length === 0 ||
    !Number.isSafeInteger(input.quality.record_count) ||
    input.quality.record_count <= 0 ||
    !isFiniteRatio(input.quality.missingness_rate) ||
    !Number.isSafeInteger(input.quality.conflict_count) ||
    input.quality.conflict_count < 0 ||
    (input.expires_at !== null &&
      input.expires_at !== undefined &&
      !isIsoTimestamp(input.expires_at))
  ) {
    throw new ModelQualificationError("MODEL_QUALIFICATION_SOURCE_INVALID");
  }
}

function ratioFromFingerprint(fingerprint: string): number {
  return parseInt(fingerprint.slice(0, 8), 16) / 0xffffffff;
}

export function deriveModelQualificationDiagnostics(
  source: ModelQualificationSourcePackage,
  dataset: ModelQualificationCalibrationDataset,
  model: ModelQualificationModelCatalogEntry
): ModelQualificationDiagnostics {
  const fingerprint = digest({
    dataset_content_digest: dataset.content_digest,
    feature_schema_digest: source.feature_schema_digest,
    model_version_reference: model.model_version_reference,
    source_content_digest: source.content_digest
  });
  const variation = ratioFromFingerprint(fingerprint);
  return {
    baseline_error: Number(
      (0.02 + source.quality.missingness_rate * 0.5 + variation * 0.02).toFixed(6)
    ),
    convergence_status: "CONVERGED",
    differential_error: Number((0.01 + variation * 0.04).toFixed(6)),
    drift_score: Number((variation * 0.2).toFixed(6)),
    ood_rate: Number((variation * 0.05).toFixed(6)),
    sensitivity_max_delta: Number((variation * 0.1).toFixed(6))
  };
}

function validateDiagnostics(input: ModelQualificationDiagnostics): void {
  if (
    !Number.isFinite(input.baseline_error) ||
    input.baseline_error < 0 ||
    !Number.isFinite(input.differential_error) ||
    input.differential_error < 0 ||
    !isFiniteRatio(input.drift_score) ||
    !isFiniteRatio(input.ood_rate) ||
    !isFiniteRatio(input.sensitivity_max_delta)
  ) {
    throw new ModelQualificationError("MODEL_QUALIFICATION_DIAGNOSTICS_INVALID");
  }
}

function classify(
  source: ModelQualificationSourcePackage,
  dataset: ModelQualificationCalibrationDataset,
  diagnostics: ModelQualificationDiagnostics,
  now: string
): { decision: ModelQualificationDecision; reasons: string[] } {
  const reasons: string[] = [];
  if (source.rights_status !== "VALID") reasons.push("SOURCE_RIGHTS_NOT_ELIGIBLE");
  if (source.expires_at && Date.parse(source.expires_at) <= Date.parse(now)) {
    reasons.push("SOURCE_EXPIRED");
  }
  if (source.freshness_status !== "FRESH") reasons.push("SOURCE_NOT_FRESH");
  if (source.quality.missingness_rate > MAX_MISSINGNESS || source.quality.conflict_count > 0) {
    reasons.push("SOURCE_QUALITY_NOT_ELIGIBLE");
  }
  if (dataset.holdout_leakage_count > 0 || !dataset.zero_holdout_leakage) {
    reasons.push("HOLDOUT_LEAKAGE");
  }
  if (diagnostics.drift_score > MAX_DRIFT) reasons.push("DRIFT_THRESHOLD_EXCEEDED");
  if (diagnostics.ood_rate > MAX_OOD) reasons.push("OOD_THRESHOLD_EXCEEDED");
  if (diagnostics.sensitivity_max_delta > MAX_SENSITIVITY_DELTA) {
    reasons.push("SENSITIVITY_THRESHOLD_EXCEEDED");
  }
  if (diagnostics.convergence_status !== "CONVERGED") {
    reasons.push("QUALIFICATION_NOT_CONVERGED");
  }
  const hardEligibility = reasons.some((reason) =>
    [
      "SOURCE_RIGHTS_NOT_ELIGIBLE",
      "SOURCE_EXPIRED",
      "SOURCE_NOT_FRESH",
      "SOURCE_QUALITY_NOT_ELIGIBLE",
      "HOLDOUT_LEAKAGE"
    ].includes(reason)
  );
  return {
    decision: reasons.length === 0 ? "APPROVED" : hardEligibility ? "NOT_ELIGIBLE" : "REJECTED",
    reasons
  };
}

function studentExplanation(qualification: ModelQualification): string[] {
  const reviewNote = qualification.review.decision_note ? [qualification.review.decision_note] : [];
  if (qualification.decision === "APPROVED" && qualification.review.status === "APPROVED") {
    return [
      "该模型通过来源权利、新鲜度、质量、holdout 和诊断检查，并已完成治理复核。",
      "它可以作为本课程的受治理候选解释；它不会直接写入正式结算结果。",
      ...reviewNote
    ];
  }
  return qualification.reasons.length > 0
    ? [...qualification.reasons.map((reason) => `当前限制：${reason}`), ...reviewNote]
    : ["模型尚未完成治理复核，暂不可绑定到课程。", ...reviewNote];
}

export class ModelQualificationError extends Error {
  constructor(
    readonly code:
      | "MODEL_QUALIFICATION_SCOPE_CONFLICT"
      | "MODEL_QUALIFICATION_SOURCE_INVALID"
      | "MODEL_QUALIFICATION_SOURCE_NOT_FOUND"
      | "MODEL_QUALIFICATION_DATASET_INVALID"
      | "MODEL_QUALIFICATION_DATASET_NOT_FOUND"
      | "MODEL_QUALIFICATION_NOT_FOUND"
      | "MODEL_QUALIFICATION_DIAGNOSTICS_INVALID"
      | "MODEL_VERSION_REFERENCE_NOT_FOUND"
      | "MODEL_QUALIFICATION_REVIEW_REQUIRED"
      | "MODEL_QUALIFICATION_REVIEW_INVALID"
      | "MODEL_QUALIFICATION_BINDING_REQUIRED"
      | "MODEL_QUALIFICATION_REQUALIFICATION_INVALID"
      | "MODEL_QUALIFICATION_REQUALIFICATION_CONFLICT"
      | "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_INVALID"
  ) {
    super(code);
    this.name = "ModelQualificationError";
  }
}

function rethrowAdoptionOperationsError(error: unknown): never {
  if (error instanceof Error && /^O6_/.test(error.message)) {
    throw new ModelQualificationError("MODEL_QUALIFICATION_ADOPTION_OPERATIONS_INVALID");
  }
  throw error;
}

function rethrowGovernedRollbackError(error: unknown): never {
  if (error instanceof GovernedRollbackRequestError || error instanceof ExplicitReadoptionError) {
    if (/ROLE/.test(error.message)) throw new Error("EVIDENCE_ADOPTION_ROLE_DENIED");
    if (/SCOPE/.test(error.message)) throw new Error("EVIDENCE_ADOPTION_SCOPE_MISMATCH");
    if (/REBASE|DIGEST|MOVED/.test(error.message)) {
      throw new Error("EVIDENCE_ADOPTION_REBASE_REQUIRED");
    }
    if (/ROLLBACK_REQUEST_REQUIRED/.test(error.message)) {
      throw new Error("EVIDENCE_ADOPTION_ROLLBACK_REQUEST_REQUIRED");
    }
    if (/CONFLICT/.test(error.message)) {
      throw new Error("EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT");
    }
    throw new Error("EVIDENCE_ADOPTION_ROLLBACK_REQUEST_INVALID");
  }
  throw error;
}

export class ModelQualificationService {
  private readonly admissionGuards = new Set<string>();
  readonly modelCatalog = [clone(MODEL_QUALIFICATION_MODEL_VERSION)] as const;
  private readonly clock: ModelQualificationClock;
  private readonly persistence: ModelQualificationPersistence | undefined;
  private readonly w5Reader: IndustryDiagnosticW5Reader | undefined;
  private readonly records = new Map<string, ModelQualificationRecord>();
  private sequence = 0;

  constructor(
    clock: ModelQualificationClock = DEFAULT_CLOCK,
    persistence?: ModelQualificationPersistence,
    options?: { readonly w5Reader?: IndustryDiagnosticW5Reader }
  ) {
    this.clock = clock;
    this.persistence = persistence;
    this.w5Reader = options?.w5Reader;
    for (const record of persistence?.listRecords() ?? []) {
      this.records.set(this.key(record.tenant_id, record.course_id), clone(record));
      this.sequence = Math.max(
        this.sequence,
        ...record.source_packages.map((item) => sequenceFromId(item.source_package_id)),
        ...record.calibration_datasets.map((item) => sequenceFromId(item.calibration_dataset_id)),
        ...record.qualifications.map((item) => sequenceFromId(item.qualification_id)),
        ...(record.requalification_previews ?? []).map((item) => sequenceFromId(item.preview_id))
      );
    }
  }

  /**
   * Read-only governance records for derived projections. Returning clones
   * keeps the existing MAIN_MODEL_GOVERNANCE writer as the sole mutator.
   */
  listRecords(): readonly ModelQualificationRecord[] {
    return [...this.records.values()].map((record) => clone(record));
  }

  /**
   * Read one tenant/course-scoped qualification record for an existing
   * admission boundary. The returned value is cloned so this read cannot
   * mutate the sole model-governance writer's in-memory authority.
   */
  getRecordForScope(
    scope: Pick<ModelQualificationScope, "tenant_id" | "course_id">
  ): ModelQualificationRecord | null {
    const record = this.records.get(this.key(scope.tenant_id, scope.course_id));
    if (record) assertGovernedRollbackRequestIntegrity(record);
    return record ? clone(record) : null;
  }

  /**
   * Build O9's tenant-scoped portfolio from the canonical Course Authority
   * list supplied by the route. This is derived/query-only and never creates
   * a course or writes governance/formal truth.
   */
  getCoursePortfolio(
    actor: ModelQualificationActor,
    authorizedCourses: readonly ModelQualificationAuthorizedCourse[]
  ): ModelQualificationCoursePortfolio {
    if (actor.role !== "tenant_admin") {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
    }
    if (authorizedCourses.some((course) => course.tenant_id !== actor.tenant_id)) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
    }
    return buildModelQualificationCoursePortfolio({
      authorized_courses: authorizedCourses,
      governance_records: this.listRecords().filter(
        (record) => record.tenant_id === actor.tenant_id
      ),
      tenant_id: actor.tenant_id
    });
  }

  /**
   * Derive the O9 supersession preview from one exact portfolio snapshot and
   * explicit course IDs. The route never supplies an implicit selector.
   */
  getCoursePortfolioSupersessionPreview(
    actor: ModelQualificationActor,
    authorizedCourses: readonly ModelQualificationAuthorizedCourse[],
    selectedCourseIds: readonly string[],
    expectedPortfolioStateDigest: string
  ): ModelQualificationPortfolioSupersessionPreview {
    const portfolio = this.getCoursePortfolio(actor, authorizedCourses);
    const portfolioForPreview: ModelQualificationPortfolio = {
      courses: portfolio.courses.map((entry) => {
        const state: ModelQualificationPortfolioCourseState = {
          blocked_reasons: entry.blockers.map((item) => item.code),
          current_adoption: entry.current_adoption
            ? {
                adoption_digest: entry.current_adoption.adoption_digest,
                adoption_id: entry.current_adoption.adoption_id
              }
            : null,
          governed_rollback_available: entry.o8_outcomes.some(
            (outcome) =>
              outcome.current_effect !== "SUPERSEDED" &&
              [
                "PENDING_REVIEW",
                "APPROVED_PENDING_DISPOSITION",
                "READOPTED_FOR_FUTURE_ADMISSION"
              ].includes(outcome.outcome_status)
          ),
          requalification_required:
            entry.qualification_consistency !== "CONSISTENT" ||
            entry.blockers.some((item) =>
              /QUALIFICATION|REQUALIFICATION|CURRENT_ADOPTION_NOT_EFFECTIVE/u.test(item.code)
            ),
          review_required:
            entry.qualification?.review.status !== "APPROVED" ||
            entry.o8_outcomes.some((outcome) =>
              ["PENDING_REVIEW", "APPROVED_PENDING_DISPOSITION"].includes(outcome.outcome_status)
            )
        };
        return {
          authorized: true,
          course_id: entry.course.course_id,
          state,
          tenant_id: entry.course.tenant_id
        };
      }),
      portfolio_id: `model-qualification-course-portfolio:${actor.tenant_id}`,
      portfolio_state_digest: portfolio.portfolio_state_digest,
      tenant_id: actor.tenant_id
    };
    const selectedCourseIdentities = selectedCourseIds.map((courseId) => {
      const entry = portfolio.courses.find((candidate) => candidate.course.course_id === courseId);
      if (!entry) {
        return {
          course_id: courseId,
          course_state_digest: "0".repeat(64),
          current_adoption: null,
          tenant_id: actor.tenant_id
        };
      }
      const state = portfolioForPreview.courses.find(
        (candidate) => candidate.course_id === courseId
      )!.state;
      return {
        course_id: courseId,
        course_state_digest: digestModelQualificationPortfolioCourseState(state),
        current_adoption: state.current_adoption,
        tenant_id: actor.tenant_id
      };
    });
    return buildModelQualificationPortfolioSupersessionPreview({
      expected_portfolio_state_digest: expectedPortfolioStateDigest,
      portfolio: portfolioForPreview,
      selected_course_identities: selectedCourseIdentities
    });
  }

  /**
   * Compile the exact O9 portfolio and preview into an O10 query-only
   * changeset request plus per-course handoff descriptions. The server binds
   * the current versioned policy digest; no caller-supplied "latest" value or
   * mutation command is accepted.
   */
  getCoursePortfolioChangeSetRequest(
    actor: ModelQualificationActor,
    authorizedCourses: readonly ModelQualificationAuthorizedCourse[],
    selectedCourseIds: readonly string[],
    expectedPortfolioStateDigest: string
  ): ModelQualificationPortfolioChangeSetQuery {
    const portfolio = this.getCoursePortfolio(actor, authorizedCourses);
    const preview = this.getCoursePortfolioSupersessionPreview(
      actor,
      authorizedCourses,
      selectedCourseIds,
      expectedPortfolioStateDigest
    );
    const request = buildPortfolioChangeSetRequest({
      portfolio,
      preview,
      expected_portfolio_state_digest: expectedPortfolioStateDigest,
      expected_changeset_policy_digest: digestPortfolioChangeSetPolicy()
    });
    return {
      request,
      handoffs: buildPerCourseGovernedHandoffs(
        {
          request_id: request.request_id,
          request_digest: request.request_digest,
          tenant_id: request.tenant_id,
          status: request.status
        },
        preview.course_previews
      )
    };
  }

  private adoptionContext(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    commandId: string,
    now?: string
  ): EvidenceAdoptionCommandContext {
    this.assertScope(actor, scope);
    if (actor.role !== "teacher" && actor.role !== "tenant_admin")
      throw new Error("EVIDENCE_ADOPTION_ROLE_DENIED");
    return {
      tenant_id: scope.tenant_id,
      course_id: scope.course_id,
      actor_id: actor.actor_id,
      role: actor.role,
      command_id: commandId,
      now: now ?? this.clock.now()
    };
  }

  getEvidenceAdoptionState(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope
  ): EvidenceAdoptionState {
    this.adoptionContext(actor, scope, "read");
    const record = this.recordOrEmpty(scope);
    if (record.tenant_id !== scope.tenant_id || record.course_id !== scope.course_id)
      throw new Error("EVIDENCE_ADOPTION_SCOPE_MISMATCH");
    return this.validatedAdoptionState(record, scope);
  }

  private validatedAdoptionState(
    record: ModelQualificationRecord,
    scope: ModelQualificationScope
  ): EvidenceAdoptionState {
    const state =
      record.evidence_adoption ?? emptyEvidenceAdoptionState(scope.tenant_id, scope.course_id);
    if (state.tenant_id !== scope.tenant_id || state.course_id !== scope.course_id)
      throw new Error("EVIDENCE_ADOPTION_SCOPE_MISMATCH");
    assertEvidenceAdoptionState(state);
    return clone(state);
  }

  requestEvidenceAdoption(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: {
      command_id: string;
      qualification_id: string;
      expected_adoption: EvidenceAdoptionReference | null;
    }
  ) {
    const context = this.adoptionContext(actor, scope, input.command_id);
    this.assertAdmissionNotInProgress(scope);
    const state = this.getEvidenceAdoptionState(actor, scope);
    const record = this.mutableRecord(scope);
    const retry = state.commands.some((item) => item.command_id === input.command_id);
    const epoch = deriveEvidenceAdoptionEpoch(
      record,
      input.qualification_id,
      this.modelCatalog,
      context.now,
      retry
    );
    const matchingHistorical = state.records.filter(
      (item) =>
        item.disposition === "ADOPTED_FOR_FUTURE_ADMISSION" && stable(item.epoch) === stable(epoch)
    );
    if (!retry && matchingHistorical.length > 0) {
      try {
        if (matchingHistorical.length === 1) {
          const current = state.selections.filter(
            (item) =>
              stable(item.model_version_reference) === stable(epoch.model_version_reference) &&
              stable(item.model_artifact_reference) === stable(epoch.model_artifact_reference)
          );
          if (current.length === 1) {
            classifyExplicitReadoptionTarget({
              tenant_id: scope.tenant_id,
              course_id: scope.course_id,
              adoption_state: state,
              current_adoption: {
                adoption_id: current[0]!.adoption_id,
                adoption_digest: current[0]!.adoption_digest
              },
              target: {
                adoption: {
                  adoption_id: matchingHistorical[0]!.adoption_id,
                  adoption_digest: matchingHistorical[0]!.adoption_digest
                },
                epoch
              }
            });
          }
        }
      } catch (error) {
        rethrowGovernedRollbackError(error);
      }
      throw new Error("EVIDENCE_ADOPTION_ROLLBACK_REQUEST_REQUIRED");
    }
    const result = requestEvidenceAdoption(state, context, {
      epoch,
      expected_adoption: input.expected_adoption
    });
    if (!result.reused) {
      record.evidence_adoption = result.state;
      this.commit(
        record,
        actor,
        "model_qualification.adoption_request",
        result.receipt.proposal_id
      );
    }
    return { proposal: result.receipt, reused: result.reused };
  }

  reviewEvidenceAdoption(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: ReviewEvidenceAdoption & { command_id: string }
  ) {
    const context = this.adoptionContext(actor, scope, input.command_id);
    this.assertAdmissionNotInProgress(scope);
    const intent: ReviewEvidenceAdoption = {
      proposal_id: input.proposal_id,
      proposal_digest: input.proposal_digest,
      decision: input.decision,
      note: input.note
    };
    const result = reviewEvidenceAdoption(
      this.getEvidenceAdoptionState(actor, scope),
      context,
      intent
    );
    if (!result.reused) {
      const record = this.mutableRecord(scope);
      record.evidence_adoption = result.state;
      this.commit(record, actor, "model_qualification.adoption_review", result.receipt.review_id);
    }
    return { review: result.receipt, reused: result.reused };
  }

  disposeEvidenceAdoption(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: DisposeEvidenceAdoption & { command_id: string }
  ) {
    const context = this.adoptionContext(actor, scope, input.command_id);
    this.assertAdmissionNotInProgress(scope);
    const state = this.getEvidenceAdoptionState(actor, scope);
    if (
      input.disposition === "ADOPTED_FOR_FUTURE_ADMISSION" &&
      !state.commands.some((item) => item.command_id === input.command_id)
    ) {
      const matches = state.proposals.filter(
        (item) =>
          item.proposal_id === input.proposal_id && item.proposal_digest === input.proposal_digest
      );
      if (matches.length !== 1) throw new Error("EVIDENCE_ADOPTION_EXACT_PROPOSAL_REQUIRED");
      const epoch = deriveEvidenceAdoptionEpoch(
        this.recordOrEmpty(scope),
        matches[0]!.epoch.qualification_id,
        this.modelCatalog,
        context.now
      );
      if (stable(epoch) !== stable(matches[0]!.epoch))
        throw new Error("EVIDENCE_ADOPTION_REBASE_REQUIRED");
    }
    const intent: DisposeEvidenceAdoption = {
      proposal_id: input.proposal_id,
      proposal_digest: input.proposal_digest,
      disposition: input.disposition,
      expires_at: input.expires_at,
      note: input.note
    };
    const result = disposeEvidenceAdoption(state, context, intent);
    if (!result.reused) {
      const record = this.mutableRecord(scope);
      record.evidence_adoption = result.state;
      this.commit(
        record,
        actor,
        "model_qualification.adoption_disposition",
        result.receipt.adoption_id
      );
    }
    return { adoption: result.receipt, reused: result.reused };
  }

  /** Process-local guard for the existing JSON authority; not a durable runtime claim. */
  async withEvidenceAdmission<T>(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    operation: (record: ModelQualificationRecord, now: () => string) => Promise<T>,
    options: { allowMissingRecord?: boolean } = {}
  ): Promise<T> {
    this.adoptionContext(actor, scope, "admit");
    return this.withScopedEvidenceAdmission(actor, scope, operation, options);
  }

  /**
   * Reuses the same course-scoped guard for Run creation even when the course
   * has no qualification record yet. The actor tenant is still checked here;
   * role-specific adoption operations remain behind adoptionContext above.
   */
  async withScopedEvidenceAdmission<T>(
    actor: Pick<ModelQualificationActor, "tenant_id">,
    scope: ModelQualificationScope,
    operation: (record: ModelQualificationRecord, now: () => string) => Promise<T>,
    options: { allowMissingRecord?: boolean } = {}
  ): Promise<T> {
    if (!actor.tenant_id || actor.tenant_id !== scope.tenant_id || !scope.course_id)
      throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
    const key = this.key(scope.tenant_id, scope.course_id);
    this.assertAdmissionNotInProgress(scope);
    const record = this.getRecordForScope(scope);
    if (!record && !options.allowMissingRecord)
      throw new Error("EVIDENCE_ADOPTION_EXACT_SOURCE_REQUIRED");
    this.admissionGuards.add(key);
    try {
      return await operation(record ?? this.recordOrEmpty(scope), () => this.clock.now());
    } finally {
      this.admissionGuards.delete(key);
    }
  }

  /**
   * Evaluate the exact O5 adoption under the existing course-scoped admission
   * guard. This is a transient operations receipt: no record, adoption, Run,
   * settlement, or official-truth writer is invoked.
   */
  async assessEvidenceAdoptionDrift(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: AdoptionDriftAssessmentRequest
  ): Promise<AdoptionDriftAssessment> {
    if (input.course_id !== scope.course_id) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
    }
    const request = {
      assessed_at: input.assessed_at,
      expected_adoption: input.expected_adoption,
      expected_adoption_state_digest: input.expected_adoption_state_digest,
      expected_operations_policy_digest: input.expected_operations_policy_digest
    };
    try {
      return await this.withEvidenceAdmission(actor, scope, async (record) =>
        assessAdoptionDrift({
          ...request,
          record,
          selection_requirement: "CURRENT",
          state: this.validatedAdoptionState(record, scope)
        })
      );
    } catch (error) {
      rethrowAdoptionOperationsError(error);
    }
  }

  /** Pure rollback impact preview. It never applies an adoption mutation. */
  async dryRunEvidenceAdoptionRollback(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: AdoptionRollbackDryRunRequest
  ): Promise<AdoptionRollbackDryRun> {
    if (input.course_id !== scope.course_id) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
    }
    const request = {
      assessed_at: input.assessed_at,
      current_adoption: input.current_adoption,
      predecessor_adoption: input.predecessor_adoption,
      expected_adoption_state_digest: input.expected_adoption_state_digest,
      expected_operations_policy_digest: input.expected_operations_policy_digest
    };
    try {
      return await this.withEvidenceAdmission(actor, scope, async (record) => {
        const state = this.validatedAdoptionState(record, scope);
        const actualStateDigest = digestEvidenceAdoptionState(state);
        const actualPolicyDigest = digestAdoptionOperationsPolicy();
        const predecessorAssessment = assessAdoptionDrift({
          assessed_at: request.assessed_at,
          expected_adoption: request.predecessor_adoption,
          expected_adoption_state_digest: request.expected_adoption_state_digest,
          expected_operations_policy_digest: request.expected_operations_policy_digest,
          record,
          selection_requirement: "HISTORICAL_PREDECESSOR",
          state
        });
        return runAdoptionRollbackDryRun({
          ...request,
          actual_adoption_state_digest: actualStateDigest,
          actual_operations_policy_digest: actualPolicyDigest,
          adoption_state: state,
          predecessor_assessment: predecessorAssessment
        });
      });
    } catch (error) {
      rethrowAdoptionOperationsError(error);
    }
  }

  /**
   * Atomically appends one immutable O7 request and its linked standard O5
   * proposal under the existing course-scoped MAIN_MODEL_GOVERNANCE guard.
   * Request creation never changes the current adoption selection.
   */
  async requestGovernedRollback(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: GovernedRollbackRequestInput
  ): Promise<GovernedRollbackRequestReceipt> {
    try {
      return await this.withEvidenceAdmission(actor, scope, async (record) => {
        const state = this.validatedAdoptionState(record, scope);
        const requestedAt = this.clock.now();
        const retryCandidate = createGovernedRollbackRequest({
          tenant_id: scope.tenant_id,
          course_id: scope.course_id,
          actor_id: actor.actor_id,
          role: actor.role as "teacher" | "tenant_admin",
          command_id: input.command_id,
          requested_at: requestedAt,
          reason: input.reason,
          current_adoption: input.dry_run.current_adoption,
          predecessor_adoption: input.dry_run.predecessor_adoption,
          adoption_state_digest: input.dry_run.adoption_state_digest,
          operations_policy_digest: input.dry_run.operations_policy_digest,
          actual_adoption_state_digest: input.dry_run.adoption_state_digest,
          actual_operations_policy_digest: input.dry_run.operations_policy_digest,
          dry_run: input.dry_run
        });
        const existingRequests = (record.governed_rollback_requests ?? []).filter(
          (item) => item.command_id === input.command_id
        );
        if (existingRequests.length > 1) throw new Error("EVIDENCE_ADOPTION_STATE_INVALID");
        if (existingRequests.length === 1) {
          const existing = existingRequests[0]!;
          if (existing.command_fingerprint !== retryCandidate.request.idempotency_fingerprint) {
            throw new Error("EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT");
          }
          const proposals = state.proposals.filter(
            (item) =>
              item.proposal_id === existing.linked_proposal.proposal_id &&
              item.proposal_digest === existing.linked_proposal.proposal_digest
          );
          if (proposals.length !== 1) throw new Error("EVIDENCE_ADOPTION_STATE_INVALID");
          return { request: clone(existing), proposal: clone(proposals[0]!), reused: true };
        }

        const actualStateDigest = digestEvidenceAdoptionState(state);
        const actualPolicyDigest = digestAdoptionOperationsPolicy();
        const predecessorAssessment = assessAdoptionDrift({
          assessed_at: input.dry_run.assessed_at,
          expected_adoption: input.dry_run.predecessor_adoption,
          expected_adoption_state_digest: input.dry_run.adoption_state_digest,
          expected_operations_policy_digest: input.dry_run.operations_policy_digest,
          record,
          selection_requirement: "HISTORICAL_PREDECESSOR",
          state
        });
        const freshDryRun = runAdoptionRollbackDryRun({
          assessed_at: input.dry_run.assessed_at,
          current_adoption: input.dry_run.current_adoption,
          predecessor_adoption: input.dry_run.predecessor_adoption,
          expected_adoption_state_digest: input.dry_run.adoption_state_digest,
          expected_operations_policy_digest: input.dry_run.operations_policy_digest,
          actual_adoption_state_digest: actualStateDigest,
          actual_operations_policy_digest: actualPolicyDigest,
          adoption_state: state,
          predecessor_assessment: predecessorAssessment
        });
        if (stable(freshDryRun) !== stable(input.dry_run)) {
          throw new Error("EVIDENCE_ADOPTION_REBASE_REQUIRED");
        }

        // The submitted O6 receipt is immutable evidence of what was previewed,
        // not a lease on predecessor eligibility. Re-evaluate the same exact
        // predecessor at the authoritative request clock before any request or
        // linked proposal is appended.
        const requestTimePredecessorAssessment = assessAdoptionDrift({
          assessed_at: requestedAt,
          expected_adoption: input.dry_run.predecessor_adoption,
          expected_adoption_state_digest: input.dry_run.adoption_state_digest,
          expected_operations_policy_digest: input.dry_run.operations_policy_digest,
          record,
          selection_requirement: "HISTORICAL_PREDECESSOR",
          state
        });
        const requestTimeDryRun = runAdoptionRollbackDryRun({
          assessed_at: requestedAt,
          current_adoption: input.dry_run.current_adoption,
          predecessor_adoption: input.dry_run.predecessor_adoption,
          expected_adoption_state_digest: input.dry_run.adoption_state_digest,
          expected_operations_policy_digest: input.dry_run.operations_policy_digest,
          actual_adoption_state_digest: actualStateDigest,
          actual_operations_policy_digest: actualPolicyDigest,
          adoption_state: state,
          predecessor_assessment: requestTimePredecessorAssessment
        });
        if (
          requestTimeDryRun.status !== "READY_WITH_LIMITS" ||
          !requestTimeDryRun.predecessor_currently_eligible ||
          requestTimeDryRun.blockers.length > 0
        ) {
          throw new GovernedRollbackRequestError("ROLLBACK_PREDECESSOR_NOT_ELIGIBLE");
        }

        const candidate = createGovernedRollbackRequest({
          tenant_id: scope.tenant_id,
          course_id: scope.course_id,
          actor_id: actor.actor_id,
          role: actor.role as "teacher" | "tenant_admin",
          command_id: input.command_id,
          requested_at: requestedAt,
          reason: input.reason,
          current_adoption: input.dry_run.current_adoption,
          predecessor_adoption: input.dry_run.predecessor_adoption,
          adoption_state_digest: input.dry_run.adoption_state_digest,
          operations_policy_digest: input.dry_run.operations_policy_digest,
          actual_adoption_state_digest: actualStateDigest,
          actual_operations_policy_digest: actualPolicyDigest,
          dry_run: freshDryRun
        });

        predictExplicitReadoption({
          tenant_id: scope.tenant_id,
          course_id: scope.course_id,
          adoption_state: state,
          current_adoption: input.dry_run.current_adoption,
          target: {
            adoption: input.dry_run.predecessor_adoption,
            epoch: candidate.request.predecessor_epoch
          },
          rollback_basis: {
            tenant_id: scope.tenant_id,
            course_id: scope.course_id,
            current_adoption: input.dry_run.current_adoption,
            target_adoption: input.dry_run.predecessor_adoption,
            request_id: candidate.request.request_id,
            request_digest: candidate.request.request_digest,
            linked_proposal: {
              proposal_id: candidate.proposal.proposal_id,
              proposal_digest: candidate.proposal.proposal_digest,
              expected_adoption: input.dry_run.current_adoption,
              epoch: candidate.proposal.epoch
            }
          }
        });

        const context = this.adoptionContext(actor, scope, input.command_id, requestedAt);
        const reduction = requestEvidenceAdoption(state, context, {
          epoch: candidate.request.predecessor_epoch,
          expected_adoption: input.dry_run.current_adoption
        });
        if (reduction.reused || stable(reduction.receipt) !== stable(candidate.proposal)) {
          throw new Error("EVIDENCE_ADOPTION_STATE_INVALID");
        }
        if (stable(reduction.state.selections) !== stable(state.selections)) {
          throw new Error("EVIDENCE_ADOPTION_STATE_INVALID");
        }

        const governedRequestBody: Omit<GovernedRollbackRequest, "rollback_request_digest"> = {
          schema_version: "model-qualification-governed-rollback.v1",
          rollback_request_id: candidate.request.request_id,
          tenant_id: scope.tenant_id,
          course_id: scope.course_id,
          command_id: input.command_id,
          command_fingerprint: candidate.request.idempotency_fingerprint,
          requested_by: actor.actor_id,
          requested_role: actor.role as "teacher" | "tenant_admin",
          requested_at: candidate.request.requested_at,
          reason: candidate.request.reason,
          dry_run_id: candidate.request.dry_run_id,
          dry_run_digest: candidate.request.dry_run_digest,
          current_adoption: clone(candidate.request.current_adoption),
          predecessor_adoption: clone(candidate.request.predecessor_adoption),
          predecessor_epoch: clone(candidate.request.predecessor_epoch),
          adoption_state_digest: candidate.request.adoption_state_digest,
          operations_policy_digest: candidate.request.operations_policy_digest,
          linked_proposal: {
            proposal_id: reduction.receipt.proposal_id,
            proposal_digest: reduction.receipt.proposal_digest
          },
          status: "LINKED_PROPOSAL_PENDING_REVIEW",
          current_selection_changed: false,
          rollback_applied: false,
          adoption_mutation: false,
          official_truth_write: false,
          history_deleted: false,
          historical_receipt_rewritten: false,
          provider: "OFF"
        };
        const governedRequest: GovernedRollbackRequest = {
          ...governedRequestBody,
          rollback_request_digest: digestPersistedGovernedRollbackRequest(governedRequestBody)
        };
        const nextRecord = clone(record);
        nextRecord.evidence_adoption = reduction.state;
        nextRecord.governed_rollback_requests = [
          ...(record.governed_rollback_requests ?? []),
          governedRequest
        ];
        this.commit(
          nextRecord,
          actor,
          "model_qualification.governed_rollback_request",
          governedRequest.rollback_request_id,
          { withinAdmissionGuard: true }
        );
        return {
          request: clone(governedRequest),
          proposal: clone(reduction.receipt),
          reused: false
        };
      });
    } catch (error) {
      rethrowGovernedRollbackError(error);
    }
  }

  async getAdoptionOperationsProjection(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope
  ): Promise<
    | ModelQualificationAdoptionOperationsTeacherProjection
    | ModelQualificationAdoptionOperationsAdminProjection
  > {
    try {
      return await this.withEvidenceAdmission(actor, scope, async (record, now) => {
        const state = this.validatedAdoptionState(record, scope);
        const selections = state.selections;
        const current =
          selections.length === 1
            ? {
                adoption_id: selections[0]!.adoption_id,
                adoption_digest: selections[0]!.adoption_digest
              }
            : null;
        const stateDigest = digestEvidenceAdoptionState(state);
        const policyDigest = digestAdoptionOperationsPolicy();
        const currentAssessment = current
          ? assessAdoptionDrift({
              assessed_at: now(),
              expected_adoption: current,
              expected_adoption_state_digest: stateDigest,
              expected_operations_policy_digest: policyDigest,
              record,
              selection_requirement: "CURRENT",
              state
            })
          : null;
        const common = {
          current_adoption: current,
          current_assessment: currentAssessment,
          rollback_dry_run: null,
          adoption_state_digest: stateDigest,
          operations_policy_digest: policyDigest,
          known_limits: [
            "Dry-run operations do not mutate adoption, Run, settlement, or official truth.",
            ...(selections.length > 1
              ? [
                  "Multiple exact model selections exist; supply an exact adoption selector to assess one."
                ]
              : [])
          ],
          provider: "OFF" as const,
          advisory_only: true as const
        };
        if (actor.role === "tenant_admin") {
          return {
            ...common,
            operation_id: "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_ADMIN_GET_V1" as const,
            authority: {
              model_governance_writer: MODEL_QUALIFICATION_SOLE_WRITER,
              formal_truth_writer: "SIMULATION_CORE" as const,
              writes_formal_truth: false as const
            }
          };
        }
        return {
          ...common,
          operation_id: "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_TEACHER_GET_V1" as const
        };
      });
    } catch (error) {
      rethrowAdoptionOperationsError(error);
    }
  }

  /**
   * Resolve one immutable O7 request through the existing O5 review and
   * disposition records. This is a derived read and does not persist an O8
   * outcome or change the current adoption selection.
   */
  async getRollbackRequestOutcome(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    rollbackRequestId: string
  ): Promise<ModelQualificationRollbackOutcomeResolution> {
    if (actor.role !== "teacher" && actor.role !== "tenant_admin") {
      throw new Error("EVIDENCE_ADOPTION_ROLE_DENIED");
    }
    return this.withEvidenceAdmission(actor, scope, async (record, now) => {
      const state = this.validatedAdoptionState(record, scope);
      const request = (record.governed_rollback_requests ?? []).find(
        (candidate) => candidate.rollback_request_id === rollbackRequestId
      );
      if (!request) throw new ModelQualificationError("MODEL_QUALIFICATION_NOT_FOUND");
      const resolved = resolveRollbackRequestOutcome({
        tenant_id: scope.tenant_id,
        course_id: scope.course_id,
        request,
        adoption_state: state
      });
      const historical = resolved.linked_proposal
        ? assessReadoptionHistoricalConsistency({
            tenant_id: scope.tenant_id,
            course_id: scope.course_id,
            current_adoption: request.current_adoption,
            target_adoption: request.predecessor_adoption,
            proposal: resolved.linked_proposal,
            review: resolved.review,
            disposition: resolved.disposition,
            adoption_state: state
          })
        : null;
      const currentQualificationConsistency = liveQualificationConsistency(
        record,
        state,
        request,
        now()
      );
      const source = historical
        ? {
            outcome_status:
              historical.historical_consistency === "INCONSISTENT"
                ? ("REBASE_REQUIRED" as const)
                : historical.outcome_status,
            current_effect: historical.current_effect,
            qualification_consistency: currentQualificationConsistency,
            historical_consistency: historical.historical_consistency,
            resulting_adoption: historical.resulting_adoption,
            known_limits: historical.known_limits
          }
        : {
            outcome_status: resolved.outcome_status,
            current_effect: resolved.current_effect,
            qualification_consistency: currentQualificationConsistency,
            historical_consistency: resolved.historical_consistency,
            resulting_adoption: resolved.resulting_adoption,
            known_limits: resolved.known_limits
          };
      const outcome: ModelQualificationRollbackOutcomeResolution = {
        ...resolved,
        schema_version: MODEL_QUALIFICATION_ROLLBACK_OUTCOME_SCHEMA_VERSION,
        outcome_status: source.outcome_status,
        historical_outcome: {
          ...resolved.historical_outcome,
          status: source.outcome_status,
          resulting_adoption: source.resulting_adoption
        },
        resulting_adoption: source.resulting_adoption,
        current_effect: source.current_effect,
        qualification_consistency: source.qualification_consistency,
        historical_consistency: source.historical_consistency,
        known_limits: [...source.known_limits],
        visibility: "TEACHER_ADMIN_DETAIL"
      };
      return clone(withResolutionDigest(outcome));
    });
  }

  /** Student-safe aggregate summaries intentionally omit every governance ID. */
  async getStudentRollbackOutcomeSummaries(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope
  ): Promise<readonly ModelQualificationRollbackOutcomeStudentSummary[]> {
    if (actor.role !== "student" && actor.role !== "learner") {
      throw new Error("EVIDENCE_ADOPTION_ROLE_DENIED");
    }
    return this.withScopedEvidenceAdmission(actor, scope, async (record, now) => {
      const state = this.validatedAdoptionState(record, scope);
      return (record.governed_rollback_requests ?? []).map((request) => {
        const resolved = resolveRollbackRequestOutcome({
          tenant_id: scope.tenant_id,
          course_id: scope.course_id,
          request,
          adoption_state: state
        });
        const consistency = resolved.historical_consistency;
        const qualificationConsistency = liveQualificationConsistency(
          record,
          state,
          request,
          now()
        );
        return {
          schema_version: MODEL_QUALIFICATION_ROLLBACK_OUTCOME_SCHEMA_VERSION,
          operation_id: "MODEL_QUALIFICATION_ROLLBACK_OUTCOME_STUDENT_GET_V1" as const,
          applicability: resolved.current_effect,
          qualification_consistency: qualificationConsistency,
          historical_consistency: consistency,
          known_limits: [
            "Role-safe aggregate status only; rollback request, proposal, adoption identities and governance reasons are hidden.",
            "Historical outcome is separate from current effect and qualification consistency.",
            "Provider OFF; this advisory-only projection never applies rollback or changes official truth."
          ],
          provider: "OFF" as const,
          advisory_only: true as const,
          rollback_applied: false as const,
          official_truth_write: false as const,
          visibility: "ROLE_SAFE_STUDENT" as const
        };
      });
    });
  }

  async getStudentAdoptionOperationsProjection(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    qualificationId: string
  ): Promise<ModelQualificationAdoptionOperationsStudentProjection> {
    this.assertScope(actor, scope);
    if (actor.role !== "student" && actor.role !== "learner") {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
    }
    try {
      return await this.withScopedEvidenceAdmission(actor, scope, async (record, now) => {
        if (!record.qualifications.some((item) => item.qualification_id === qualificationId)) {
          throw new ModelQualificationError("MODEL_QUALIFICATION_NOT_FOUND");
        }
        const state = this.validatedAdoptionState(record, scope);
        const matches = state.selections.filter((selection) =>
          state.records.some(
            (candidate) =>
              candidate.adoption_id === selection.adoption_id &&
              candidate.adoption_digest === selection.adoption_digest &&
              candidate.epoch.qualification_id === qualificationId
          )
        );
        let assessment: AdoptionDriftAssessment | null = null;
        if (matches.length === 1) {
          const reference = {
            adoption_id: matches[0]!.adoption_id,
            adoption_digest: matches[0]!.adoption_digest
          };
          const stateDigest = digestEvidenceAdoptionState(state);
          assessment = assessAdoptionDrift({
            assessed_at: now(),
            expected_adoption: reference,
            expected_adoption_state_digest: stateDigest,
            expected_operations_policy_digest: digestAdoptionOperationsPolicy(),
            record,
            selection_requirement: "CURRENT",
            state
          });
        }
        const applicability =
          assessment?.status === "HEALTHY"
            ? "HEALTHY"
            : assessment?.status === "REVIEW_REQUIRED"
              ? "LIMITED"
              : assessment?.status === "FUTURE_ADMISSION_BLOCKED" ||
                  assessment?.status === "REBASE_REQUIRED"
                ? "BLOCKED"
                : "UNAVAILABLE";
        const freshness =
          assessment?.issue_codes.includes("SOURCE_EXPIRED") ||
          assessment?.issue_codes.includes("SOURCE_NOT_FRESH")
            ? "STALE"
            : assessment
              ? "FRESH"
              : "UNKNOWN";
        const requalificationImpact =
          assessment?.future_admission_impact === "REBASE_REQUIRED"
            ? "REBASE_REQUIRED"
            : assessment?.future_admission_impact === "BLOCKED"
              ? "BLOCKED"
              : assessment?.future_admission_impact === "REVIEW_REQUIRED"
                ? "REVIEW_REQUIRED"
                : "NONE";
        return {
          operation_id: "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_STUDENT_GET_V1",
          applicability,
          freshness,
          requalification_impact: requalificationImpact,
          known_limits: [
            "Role-safe status only; exact adoption, evidence, digest, and rollback candidate identities are hidden.",
            "Provider OFF; this advisory-only projection does not change decisions or official truth."
          ],
          provider: "OFF",
          advisory_only: true,
          rollback_applied: false,
          official_truth_write: false,
          visibility: "ROLE_SAFE_STUDENT"
        };
      });
    } catch (error) {
      rethrowAdoptionOperationsError(error);
    }
  }

  resolveHistoricalAdmission(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    snapshot: QualifiedRunAdmissionSnapshot
  ) {
    const state = this.getEvidenceAdoptionState(actor, scope);
    if (snapshot.tenant_id !== scope.tenant_id || snapshot.course_id !== scope.course_id)
      throw new Error("EVIDENCE_ADOPTION_SCOPE_MISMATCH");
    const epoch = deriveEvidenceAdoptionEpoch(
      this.recordOrEmpty(scope),
      snapshot.admission.qualification_id,
      this.modelCatalog,
      this.clock.now(),
      true
    );
    if (stable(epoch) !== stable(snapshot.admission.evidence_epoch))
      throw new Error("HISTORICAL_REFERENCE_UNAVAILABLE");
    resolveHistoricalEvidenceAdoption(state, {
      tenant_id: scope.tenant_id,
      course_id: scope.course_id,
      ...snapshot.admission.adoption,
      epoch
    });
    return clone(snapshot);
  }

  private studentAdoption(
    scope: ModelQualificationScope,
    qualificationId: string
  ): ModelQualificationStudentProjection["adoption"] {
    const record = this.recordOrEmpty(scope),
      state = record.evidence_adoption;
    if (!state) return undefined;
    let applicability: NonNullable<
      ModelQualificationStudentProjection["adoption"]
    >["applicability"] = "NOT_ADOPTED";
    try {
      const historical = state.records.filter(
        (item) =>
          item.epoch.qualification_id === qualificationId &&
          item.disposition === "ADOPTED_FOR_FUTURE_ADMISSION"
      );
      if (historical.length > 0) applicability = "HISTORICAL_ONLY";
      const current = historical.filter((item) =>
        state.selections.some(
          (selection) =>
            selection.adoption_id === item.adoption_id &&
            selection.adoption_digest === item.adoption_digest
        )
      );
      if (current.length > 1) throw new Error("ambiguous adoption");
      if (current.length === 1) {
        const epoch = deriveEvidenceAdoptionEpoch(
          record,
          qualificationId,
          this.modelCatalog,
          this.clock.now()
        );
        resolveFutureEvidenceAdoption(state, {
          tenant_id: scope.tenant_id,
          course_id: scope.course_id,
          adoption_id: current[0]!.adoption_id,
          adoption_digest: current[0]!.adoption_digest,
          epoch,
          now: this.clock.now()
        });
        applicability = "ADOPTED_FOR_FUTURE_ADMISSION";
      }
    } catch {
      applicability = "UNAVAILABLE";
    }
    return {
      applicability,
      historical_non_overwrite: true,
      provider: "OFF",
      official_truth_write: false,
      known_limits: [
        "Adoption governs future admission only, never historical Run identity or official truth."
      ]
    };
  }

  getTeacherProjection(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope
  ): ModelQualificationTeacherProjection {
    this.assertScope(actor, scope);
    const record = this.recordOrEmpty(scope);
    return {
      calibration_datasets: clone(record.calibration_datasets),
      ...(record.evidence_adoption
        ? { evidence_adoption: this.validatedAdoptionState(record, scope) }
        : {}),
      ...(record.governed_rollback_requests
        ? { governed_rollback_requests: clone(record.governed_rollback_requests) }
        : {}),
      known_limits: [...DEFAULT_MODEL_QUALIFICATION_LIMITS],
      model_catalog: clone(this.modelCatalog),
      operation_id: "MODEL_QUALIFICATION_TEACHER_STUDIO_GET_V1",
      qualifications: clone(record.qualifications),
      requalification_previews: clone(record.requalification_previews ?? []),
      security: this.security(actor, scope),
      source_packages: clone(record.source_packages)
    };
  }

  getAdminProjection(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope
  ): ModelQualificationAdminProjection {
    this.assertScope(actor, scope);
    const teacher = this.getTeacherProjection(actor, scope);
    return {
      ...teacher,
      authority: {
        ai_provider: "OFF",
        formal_truth_writer: "SIMULATION_CORE",
        model_governance_writer: MODEL_QUALIFICATION_SOLE_WRITER,
        repository_provider: "JSON_INTERNAL_ONLY",
        writes_formal_truth: false
      },
      operation_id: "MODEL_QUALIFICATION_ADMIN_AUDIT_GET_V1"
    };
  }

  getStudentProjection(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    qualificationId: string
  ): ModelQualificationStudentProjection {
    this.assertScope(actor, scope);
    const qualification = this.findQualification(scope, qualificationId);
    if (qualification.binding.status !== "BOUND") {
      throw new ModelQualificationError("MODEL_QUALIFICATION_BINDING_REQUIRED");
    }
    const source = this.findSource(scope, qualification.source_package_id);
    const dataset = this.findDataset(scope, qualification.calibration_dataset_id);
    const model = this.modelCatalog.find((entry) =>
      isExactModelReference(entry.model_version_reference, qualification.model_version_reference)
    );
    if (!source || !model) throw new ModelQualificationError("MODEL_QUALIFICATION_NOT_FOUND");
    const preview = [...(this.recordOrEmpty(scope).requalification_previews ?? [])]
      .filter(
        (item) =>
          item.change_set.affected_qualification_ids.includes(qualification.qualification_id) ||
          item.change_set.candidate.source_package_id === qualification.source_package_id
      )
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0];
    const adoption = this.studentAdoption(scope, qualificationId);
    return {
      known_limits: [...DEFAULT_MODEL_QUALIFICATION_LIMITS],
      operation_id: "MODEL_QUALIFICATION_STUDENT_PROJECTION_GET_V1",
      ...(adoption ? { adoption } : {}),
      qualification: {
        binding_status: qualification.binding.status,
        decision: qualification.decision,
        diagnostics: {
          convergence_status: qualification.diagnostics.convergence_status,
          drift_score: qualification.diagnostics.drift_score,
          holdout_leakage_count: dataset?.holdout_leakage_count ?? 0,
          ood_rate: qualification.diagnostics.ood_rate,
          sensitivity_max_delta: qualification.diagnostics.sensitivity_max_delta
        },
        explanation: studentExplanation(qualification),
        model_family: model.model_family,
        model_version: `${model.model_version_reference.model_version_id}@${model.model_version_reference.version}`,
        qualification_id: qualification.qualification_id,
        review_status: qualification.review.status,
        source: {
          freshness_status: source.freshness_status,
          rights_status: source.rights_status,
          source_version: source.source_version,
          title: source.title
        }
      },
      requalification: {
        historical_non_overwrite: true,
        known_limits: [...DEFAULT_MODEL_QUALIFICATION_LIMITS],
        resolution: preview?.resolution ?? "PENDING",
        review_status: preview?.review.status ?? "PENDING",
        status: preview?.status ?? "NO_CHANGE"
      },
      security: this.security(actor, scope),
      visibility: "ROLE_SAFE_STUDENT"
    };
  }

  /**
   * Derive the IM-O1 diagnostic readiness envelope from the existing
   * ModelQualification authority.  This is query-only: it never registers a
   * producer, mutates adoption, writes REALIZED, or creates a second store.
   */
  getIndustryModelDiagnosticReadiness(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: {
      readonly run_id: string;
      readonly team_id: string;
      readonly round_id: string;
      readonly round_no?: number;
      readonly scenario_package_id: string;
      readonly parameter_set_id: string;
      readonly qualification_id: string;
      readonly w5_draft_id?: string;
      readonly expected_diagnostic_evidence_digest?: string;
      readonly expected_interpretation_policy_digest?: string;
    }
  ): IndustryModelDiagnosticReadinessDto {
    this.assertScope(actor, scope);
    if (
      !input.run_id ||
      !input.team_id ||
      !input.round_id ||
      !input.scenario_package_id ||
      !input.parameter_set_id
    ) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
    }
    const roundNo = input.round_no;
    if (
      input.w5_draft_id !== undefined &&
      (!input.w5_draft_id.trim() || typeof roundNo !== "number" || !Number.isSafeInteger(roundNo) || roundNo < 1)
    ) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
    }
    const record = this.recordOrEmpty(scope);
    const qualification = record.qualifications.find(
      (item) => item.qualification_id === input.qualification_id
    );
    if (!qualification) throw new ModelQualificationError("MODEL_QUALIFICATION_NOT_FOUND");
    const source = this.findSource(scope, qualification.source_package_id);
    if (!source) throw new ModelQualificationError("MODEL_QUALIFICATION_SOURCE_NOT_FOUND");
    const dataset = this.findDataset(scope, qualification.calibration_dataset_id);
    if (!dataset || dataset.source_package_id !== source.source_package_id) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_DATASET_NOT_FOUND");
    }
    const model = this.modelCatalog.find((entry) =>
      isExactModelReference(entry.model_version_reference, qualification.model_version_reference)
    );
    if (!model) throw new ModelQualificationError("MODEL_VERSION_REFERENCE_NOT_FOUND");
    const diagnostics = deriveModelQualificationDiagnostics(source, dataset, model);
    validateDiagnostics(diagnostics);
    const state = record.evidence_adoption;
    const currentAdoptions = state
      ? state.records.filter(
          (item) =>
            item.disposition === "ADOPTED_FOR_FUTURE_ADMISSION" &&
            item.epoch.qualification_id === qualification.qualification_id &&
            state.selections.some(
              (selection) =>
                selection.adoption_id === item.adoption_id &&
                selection.adoption_digest === item.adoption_digest
            )
        )
      : [];
    if (currentAdoptions.length > 1) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
    }
    const currentAdoption = currentAdoptions[0]
      ? {
          adoption_id: currentAdoptions[0].adoption_id,
          adoption_digest: currentAdoptions[0].adoption_digest
        }
      : null;
    const w5Context =
      input.w5_draft_id === undefined
        ? null
        : {
            tenant_id: scope.tenant_id,
            course_id: scope.course_id,
            run_id: input.run_id,
            team_id: input.team_id,
            round_id: input.round_id,
            round_no: roundNo as number,
            scenario_package_id: input.scenario_package_id,
            parameter_set_id: input.parameter_set_id,
            w5_draft_id: input.w5_draft_id
          };
    const w5Read = w5Context && this.w5Reader ? this.w5Reader.read(actor, w5Context) : null;
    const w5Producers =
      w5Context === null
        ? null
        : adaptW5IndustryDiagnosticProducers({
            context: w5Context,
            draft: w5Read?.draft ?? null,
            convergence: w5Read?.convergence ?? null
          });
    const canProducer =
      w5Context === null
        ? null
        : adaptCanIndustryDiagnosticProducer({
            context: {
              ...w5Context,
              observed_team_id: w5Read?.convergence.security.team ?? ""
            },
            candidate:
              w5Read === null
                ? null
                : buildCanCandidateFromW5({ context: w5Context, ...w5Read })
          });
    const diagnosticEvidenceDigest = stableSha256({
      dataset_content_digest: dataset.content_digest,
      diagnostics,
      model_version_reference: model.model_version_reference,
      source_content_digest: source.content_digest,
      w5: w5Producers
        ? w5Producers.producers.map((item) => ({
            classification: item.classification,
            evidence_identity: item.evidence_identity,
            producer_id: item.producer_id
          }))
        : null,
      can: canProducer?.producer
        ? {
            classification: canProducer.producer.classification,
            evidence_identity: canProducer.producer.evidence_identity,
            producer_id: canProducer.producer.producer_id,
            status: canProducer.producer.derived_status
          }
        : null
    });
    const interpretationPolicyDigest = stableSha256({
      policy: "IM-O1-diagnostic-interpretation",
      version: "1"
    });
    const identityMovements = [
      ...(input.expected_diagnostic_evidence_digest &&
      input.expected_diagnostic_evidence_digest !== diagnosticEvidenceDigest
        ? ["diagnostic_evidence"]
        : []),
      ...(input.expected_interpretation_policy_digest &&
      input.expected_interpretation_policy_digest !== interpretationPolicyDigest
        ? ["interpretation_policy"]
        : []),
      ...(w5Producers?.identity_movements ?? []),
      ...(canProducer?.identity_movements ?? [])
    ];
    const baseProducer: IndustryModelDiagnosticReadinessInput["producers"][number] = {
      producer_id: "model-qualification-diagnostics",
      current_source_path: "services/api/src/model-qualification-service.ts",
      exact_symbol: "deriveModelQualificationDiagnostics",
      contract: "ModelQualificationDiagnostics",
      diagnostic_family: "qualification quality/drift/ood/sensitivity",
      evidence_identity: diagnosticEvidenceDigest,
      tests: ["tests/unit/model-qualification-service.test.ts"],
      freshness: source.freshness_status,
      authority_owner: "SIMWAR-MODEL-QUALIFICATION-PLANE",
      candidate_classification: "NOT_PROVEN"
    };
    const qualificationIdentity = {
      qualification_id: qualification.qualification_id,
      qualification_digest: qualification.content_digest,
      model_version_reference: qualification.model_version_reference,
      model_artifact_reference: qualification.artifact
    };
    const qualificationAdmission = reconcileDiagnosticProducer({
      producer: {
        producer_id: baseProducer.producer_id,
        diagnostic_family: baseProducer.diagnostic_family,
        classification: baseProducer.candidate_classification,
        evidence_identity: baseProducer.evidence_identity,
        authority_owner: baseProducer.authority_owner,
        source: { path: baseProducer.current_source_path, symbol: baseProducer.exact_symbol },
        freshness: baseProducer.freshness,
        ...(baseProducer.known_limits ? { known_limits: baseProducer.known_limits } : {})
      },
      identity_movements: [],
      qualification: qualificationIdentity,
      contract: baseProducer.contract,
      tests: baseProducer.tests
    });
    const w5Qualified = (w5Producers?.producers ?? []).map((item) =>
      reconcileDiagnosticProducer({
        producer: item,
        identity_movements: w5Producers?.identity_movements ?? [],
        qualification: qualificationIdentity,
        contract: "W5IndustryDiagnosticProducerEvidence",
        tests: ["tests/unit/industry-model-w5-producer-adapter.test.ts"]
      })
    );
    const canQualified = canProducer?.producer
      ? [
          reconcileDiagnosticProducer({
            producer: canProducer.producer,
            identity_movements: canProducer.identity_movements,
            qualification: qualificationIdentity,
            contract: "CanServiceFeasibilityCandidate",
            tests: [
              "tests/unit/industry-model-can-producer-adapter.test.ts",
              "tests/unit/can-service-feasibility-service.test.ts"
            ]
          })
        ]
      : [];
    const qualifiedProducers = [
      qualificationAdmission.producer,
      ...w5Qualified.map((item) => item.producer),
      ...canQualified.map((item) => item.producer)
    ];
    const qualifiedProducerAdmissions = [
      qualificationAdmission.admission,
      ...w5Qualified.map((item) => item.admission),
      ...canQualified.map((item) => item.admission)
    ];
    const readiness = buildIndustryModelDiagnosticReadiness({
      context: {
        tenant_id: scope.tenant_id,
        course_id: scope.course_id,
        run_id: input.run_id,
        team_id: input.team_id,
        round_id: input.round_id,
        scenario_package_id: input.scenario_package_id,
        parameter_set_id: input.parameter_set_id
      },
      model_version_reference: qualification.model_version_reference,
      model_artifact_reference: qualification.artifact,
      qualification: {
        qualification_id: qualification.qualification_id,
        qualification_digest: qualification.content_digest,
        decision: qualification.decision,
        review_status: qualification.review.status,
        binding_status: qualification.binding.status
      },
      adoption: currentAdoption,
      diagnostic_evidence_digest: diagnosticEvidenceDigest,
      interpretation_policy_digest: interpretationPolicyDigest,
      producers: qualifiedProducers,
      identity_movements: identityMovements,
      official_truth_write: false,
      provider_calls: 0,
      qualified_producer_admission: qualifiedProducerAdmissions
    });
    const interpretation = interpretIndustryModelDiagnostics({
      context: {
        tenant_id: scope.tenant_id,
        course_id: scope.course_id,
        run_id: input.run_id,
        team_id: input.team_id,
        round_id: input.round_id
      },
      readiness_status: readiness.readiness_status,
      diagnostic_evidence_digest: diagnosticEvidenceDigest,
      interpretation_policy_digest: interpretationPolicyDigest,
      entries: readiness.provability.map((entry) => ({
        producer_id: entry.producer_id,
        diagnostic_family: entry.diagnostic_family,
        classification: entry.classification,
        status:
          entry.classification === "NOT_PROVEN"
            ? "WARN"
            : qualification.decision === "APPROVED"
              ? "PASS"
              : "FAIL",
        bounded_metrics: {},
        provenance: { source_path: entry.source.path, symbol: entry.source.symbol },
        known_limits: entry.known_limits ?? readiness.known_limits
      })),
      identity_movements: identityMovements,
      provider: "OFF",
      official_truth_write: false
    });
    const common = {
      schema_version: "industry-model-diagnostic-readiness.v1" as const,
      readiness_status: readiness.readiness_status,
      rebase_required: readiness.rebase_required,
      exact_context: readiness.bound_context,
      known_limits: [
        ...new Set([
          ...readiness.known_limits,
          ...interpretation.known_limits,
          ...qualifiedProducerAdmissions.flatMap((item) => item.known_limits)
        ])
      ].sort(),
      provider: "OFF" as const,
      official_truth_write: false as const,
      readiness_digest: readiness.readiness_digest
    };
    if (actor.role === "student" || actor.role === "learner") {
      return {
        ...common,
        operation_id: "INDUSTRY_MODEL_DIAGNOSTIC_STUDENT_GET_V1",
        role: "student",
         student_summary: {
           ...interpretation.student,
           qualified_producer_admission_statuses: qualifiedProducerAdmissions.map(
             (item) => item.status
           )
         }
      };
    }
    return {
      ...common,
      operation_id:
        actor.role === "tenant_admin"
          ? "INDUSTRY_MODEL_DIAGNOSTIC_ADMIN_GET_V1"
          : "INDUSTRY_MODEL_DIAGNOSTIC_TEACHER_GET_V1",
      role: actor.role === "tenant_admin" ? "admin" : "teacher",
      model_version_reference: qualification.model_version_reference,
      model_artifact_reference: qualification.artifact,
      qualification: {
        qualification_id: qualification.qualification_id,
        qualification_digest: qualification.content_digest,
        decision: qualification.decision,
        review_status: qualification.review.status,
        binding_status: qualification.binding.status
      },
      adoption: currentAdoption,
      diagnostic_evidence_digest: diagnosticEvidenceDigest,
      interpretation_policy_digest: interpretationPolicyDigest,
      provability: readiness.provability,
      qualified_producer_admission: qualifiedProducerAdmissions
    };
  }

  /**
   * Join the existing IM-O1 exact diagnostic projection with the bounded M4,
   * M5, and M29 support evidence. This is derived/query-only: the join does
   * not create a course, mutate qualification/adoption, write REALIZED, or
   * introduce a second authority.
   */
  getIndustryModelRealityJoin(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: {
      readonly run_id: string;
      readonly team_id: string;
      readonly round_id: string;
      readonly round_no?: number;
      readonly scenario_package_id: string;
      readonly parameter_set_id: string;
      readonly qualification_id: string;
      readonly w5_draft_id?: string;
      readonly expected_reality_join_digest?: string;
      readonly course_package_version?: CoursePackageVersion | null;
      readonly qualified_run_admission_snapshot?: QualifiedRunAdmissionSnapshot | null;
      readonly expected_applicability_digest?: string;
    }
  ): IndustryModelRealityJoinDto {
    const diagnostic = this.getIndustryModelDiagnosticReadiness(actor, scope, input);
    const support = composeIndustryModelRealityJoinSupport({
      ...diagnostic.exact_context,
      qualification_id: input.qualification_id,
      ...(input.course_package_version === undefined
        ? {}
        : { course_package_version: input.course_package_version }),
      ...(input.qualified_run_admission_snapshot === undefined
        ? {}
        : { qualified_run_admission_snapshot: input.qualified_run_admission_snapshot }),
      ...(input.expected_applicability_digest === undefined
        ? {}
        : { expected_applicability_digest: input.expected_applicability_digest })
    });
    const supportEvidence: IndustryModelRealityJoinSupportEvidenceDto = support.support_evidence;
    const joinDigest = stableSha256({
      diagnostic_readiness_digest: diagnostic.readiness_digest,
      support_evidence_digest: support.support_evidence_digest,
      exact_context: diagnostic.exact_context
    });
    const identityMoved =
      support.applicability_status === "REBASE_REQUIRED" ||
      (input.expected_reality_join_digest !== undefined &&
        input.expected_reality_join_digest !== joinDigest);
    const readinessStatus = identityMoved ? "REBASE_REQUIRED" : diagnostic.readiness_status;
    const common = {
      schema_version: "industry-model-reality-join.v1" as const,
      readiness_status: readinessStatus,
      rebase_required: diagnostic.rebase_required || identityMoved,
      known_limits: [
        ...new Set([
          ...diagnostic.known_limits,
          ...support.known_limits,
          ...(identityMoved ? ["REALITY_JOIN_IDENTITY_MOVED_REQUIRES_REBASE"] : [])
        ])
      ].sort(),
      provider: "OFF" as const,
      official_truth_write: false as const,
      readiness_digest: joinDigest
    };
    if (diagnostic.role === "student") {
      return {
        ...common,
        operation_id: "INDUSTRY_MODEL_REALITY_JOIN_STUDENT_GET_V1",
        role: "student",
        exact_context: {
          course_id: diagnostic.exact_context.course_id,
          run_id: diagnostic.exact_context.run_id,
          team_id: diagnostic.exact_context.team_id,
          round_id: diagnostic.exact_context.round_id
        },
        readiness_class: readinessStatus,
        evidence_classes: ["NOT_PROVEN"],
        portability_status:
          supportEvidence.availability === "BOUND"
            ? supportEvidence.portability.status
            : "UNAVAILABLE",
        holdout_status:
          supportEvidence.availability === "BOUND" ? supportEvidence.holdout.status : "UNAVAILABLE",
        shanghai_status:
          supportEvidence.availability === "BOUND"
            ? supportEvidence.shanghai.consumption_status
            : "UNAVAILABLE",
        recovery: identityMoved ? "RELOAD_EXACT_CONTEXT" : "NONE"
      };
    }
    return {
      ...common,
      operation_id:
        diagnostic.role === "admin"
          ? "INDUSTRY_MODEL_REALITY_JOIN_ADMIN_GET_V1"
          : "INDUSTRY_MODEL_REALITY_JOIN_TEACHER_GET_V1",
      role: diagnostic.role,
      exact_context: diagnostic.exact_context,
      model_version_reference: diagnostic.model_version_reference!,
      model_artifact_reference: diagnostic.model_artifact_reference!,
      qualification: diagnostic.qualification!,
      adoption: diagnostic.adoption ?? null,
      diagnostic_evidence_digest: diagnostic.diagnostic_evidence_digest!,
      interpretation_policy_digest: diagnostic.interpretation_policy_digest!,
      provability: diagnostic.provability ?? [],
      support_evidence: supportEvidence
    };
  }

  registerSourcePackage(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: ModelQualificationSourceInput
  ): { source_package: ModelQualificationSourcePackage } {
    this.assertScope(actor, scope);
    validateSourceInput(input);
    const record = this.mutableRecord(scope);
    const sourcePackage: ModelQualificationSourcePackage = {
      content_digest: input.content_digest,
      course_id: scope.course_id,
      evidence_refs: [...input.evidence_refs],
      expires_at: input.expires_at ?? null,
      feature_schema_digest: input.feature_schema_digest,
      freshness_status: input.freshness_status,
      observed_at: input.observed_at,
      quality: clone(input.quality),
      rights_status: input.rights_status,
      source_package_id: `mq_source_${++this.sequence}`,
      source_ref: input.source_ref,
      source_version: input.source_version,
      tenant_id: scope.tenant_id,
      title: input.title.trim()
    };
    record.source_packages = [...record.source_packages, sourcePackage];
    this.commit(
      record,
      actor,
      "model_qualification.source_register",
      sourcePackage.source_package_id
    );
    return { source_package: clone(sourcePackage) };
  }

  createCalibrationDataset(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: ModelQualificationDatasetInput
  ): { calibration_dataset: ModelQualificationCalibrationDataset } {
    this.assertScope(actor, scope);
    if (
      !DIGEST_PATTERN.test(input.content_digest) ||
      input.calibration_record_ids.length === 0 ||
      input.holdout_record_ids.length === 0 ||
      new Set(input.calibration_record_ids).size !== input.calibration_record_ids.length ||
      new Set(input.holdout_record_ids).size !== input.holdout_record_ids.length
    ) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_DATASET_INVALID");
    }
    const record = this.mutableRecord(scope);
    if (!this.findSource(scope, input.source_package_id)) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SOURCE_NOT_FOUND");
    }
    const holdout = new Set(input.holdout_record_ids);
    const overlap = input.calibration_record_ids.filter((id) => holdout.has(id));
    const dataset: ModelQualificationCalibrationDataset = {
      calibration_dataset_id: `mq_dataset_${++this.sequence}`,
      calibration_record_ids: [...input.calibration_record_ids],
      content_digest: input.content_digest,
      course_id: scope.course_id,
      created_at: this.clock.now(),
      holdout_leakage_count: overlap.length,
      holdout_record_ids: [...input.holdout_record_ids],
      record_count: input.calibration_record_ids.length + input.holdout_record_ids.length,
      source_package_id: input.source_package_id,
      status: overlap.length === 0 ? "READY" : "NOT_ELIGIBLE",
      tenant_id: scope.tenant_id,
      zero_holdout_leakage: overlap.length === 0
    };
    record.calibration_datasets = [...record.calibration_datasets, dataset];
    this.commit(
      record,
      actor,
      "model_qualification.dataset_register",
      dataset.calibration_dataset_id
    );
    return { calibration_dataset: clone(dataset) };
  }

  runQualification(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: ModelQualificationRunInput
  ): { qualification: ModelQualification } {
    this.assertScope(actor, scope);
    if (!Number.isSafeInteger(input.deterministic_seed) || input.deterministic_seed < 0) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_DIAGNOSTICS_INVALID");
    }
    const model = this.modelCatalog.find((entry) =>
      isExactModelReference(entry.model_version_reference, input.model_version_reference)
    );
    if (!model) throw new ModelQualificationError("MODEL_VERSION_REFERENCE_NOT_FOUND");
    const record = this.mutableRecord(scope);
    const source = this.findSource(scope, input.source_package_id);
    const dataset = this.findDataset(scope, input.calibration_dataset_id);
    if (!source) throw new ModelQualificationError("MODEL_QUALIFICATION_SOURCE_NOT_FOUND");
    if (!dataset || dataset.source_package_id !== source.source_package_id) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_DATASET_NOT_FOUND");
    }
    const diagnostics = deriveModelQualificationDiagnostics(source, dataset, model);
    validateDiagnostics(diagnostics);
    const classified = classify(source, dataset, diagnostics, this.clock.now());
    const createdAt = this.clock.now();
    const qualificationWithoutDigest = {
      artifact: clone(model.artifact),
      authority_flags: { official_truth_write: false as const, provider_calls: 0 as const },
      binding: { status: "UNBOUND" as const },
      calibration_dataset_id: dataset.calibration_dataset_id,
      course_id: scope.course_id,
      created_at: createdAt,
      decision: classified.decision,
      deterministic_seed: input.deterministic_seed,
      diagnostics,
      known_limits: [...DEFAULT_MODEL_QUALIFICATION_LIMITS],
      model_version_reference: clone(model.model_version_reference),
      no_implicit_latest: true as const,
      qualification_id: `mq_qualification_${++this.sequence}`,
      reasons: classified.reasons,
      review: { status: "PENDING" as const },
      source_package_id: source.source_package_id,
      tenant_id: scope.tenant_id,
      updated_at: createdAt
    } satisfies Omit<ModelQualification, "content_digest">;
    const qualification: ModelQualification = {
      ...qualificationWithoutDigest,
      content_digest: digest(qualificationWithoutDigest)
    };
    record.qualifications = [...record.qualifications, qualification];
    this.commit(record, actor, "model_qualification.run", qualification.qualification_id);
    return { qualification: clone(qualification) };
  }

  reviewQualification(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    qualificationId: string,
    input: { decision: "APPROVED" | "REJECTED"; note: string }
  ): { qualification: ModelQualification } {
    this.assertScope(actor, scope);
    if (!input.note.trim()) throw new ModelQualificationError("MODEL_QUALIFICATION_REVIEW_INVALID");
    const record = this.mutableRecord(scope);
    const index = record.qualifications.findIndex(
      (item) => item.qualification_id === qualificationId
    );
    if (index < 0) throw new ModelQualificationError("MODEL_QUALIFICATION_NOT_FOUND");
    const current = record.qualifications[index];
    if (!current) throw new ModelQualificationError("MODEL_QUALIFICATION_NOT_FOUND");
    if (current.decision !== "APPROVED" || current.review.status !== "PENDING") {
      throw new ModelQualificationError("MODEL_QUALIFICATION_REVIEW_REQUIRED");
    }
    const next: ModelQualification = {
      ...clone(current),
      review: {
        decision_note: input.note.trim(),
        reviewed_at: this.clock.now(),
        reviewed_by: actor.actor_id,
        status: input.decision
      },
      updated_at: this.clock.now()
    };
    record.qualifications = record.qualifications.map((item, itemIndex) =>
      itemIndex === index ? next : item
    );
    this.commit(record, actor, "model_qualification.review", qualificationId);
    return { qualification: clone(next) };
  }

  bindQualification(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    qualificationId: string
  ): { qualification: ModelQualification } {
    this.assertScope(actor, scope);
    const record = this.mutableRecord(scope);
    const index = record.qualifications.findIndex(
      (item) => item.qualification_id === qualificationId
    );
    if (index < 0) throw new ModelQualificationError("MODEL_QUALIFICATION_NOT_FOUND");
    const current = record.qualifications[index];
    if (!current) throw new ModelQualificationError("MODEL_QUALIFICATION_NOT_FOUND");
    if (current.decision !== "APPROVED" || current.review.status !== "APPROVED") {
      throw new ModelQualificationError("MODEL_QUALIFICATION_REVIEW_REQUIRED");
    }
    const requalificationPreviews = [...(record.requalification_previews ?? [])]
      .filter(
        (item) =>
          item.change_set.candidate.source_package_id === current.source_package_id &&
          item.change_set.affected_qualification_ids.length > 0
      )
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
    const requalificationPreview = requalificationPreviews[0];
    if (requalificationPreviews.some((preview) => blocksCandidateBinding(preview))) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_REVIEW_REQUIRED");
    }
    const candidateSource = this.findSource(scope, current.source_package_id);
    if (!candidateSource || !isSourceEligibleAt(candidateSource, this.clock.now())) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_REVIEW_REQUIRED");
    }
    const next: ModelQualification = {
      ...clone(current),
      binding: {
        bound_at: this.clock.now(),
        bound_by: actor.actor_id,
        course_id: scope.course_id,
        status: "BOUND"
      },
      updated_at: this.clock.now()
    };
    record.qualifications = record.qualifications.map((item, itemIndex) =>
      itemIndex === index ? next : item
    );
    if (requalificationPreview) {
      record.requalification_previews = (record.requalification_previews ?? []).map((item) =>
        item.preview_id === requalificationPreview.preview_id
          ? { ...item, resolution: "ACCEPTED" as const, updated_at: this.clock.now() }
          : item
      );
    }
    this.commit(record, actor, "model_qualification.bind", qualificationId);
    return { qualification: clone(next) };
  }

  createRequalificationPreview(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: {
      baseline_source_package_id: string;
      candidate_source_package_id: string;
    }
  ): { preview: ModelQualificationRequalificationPreview } {
    this.assertScope(actor, scope);
    if (!input.baseline_source_package_id || !input.candidate_source_package_id) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_REQUALIFICATION_INVALID");
    }
    if (input.baseline_source_package_id === input.candidate_source_package_id) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_REQUALIFICATION_CONFLICT");
    }
    const record = this.mutableRecord(scope);
    const baseline = this.findSource(scope, input.baseline_source_package_id);
    const candidate = this.findSource(scope, input.candidate_source_package_id);
    if (!baseline || !candidate) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SOURCE_NOT_FOUND");
    }
    const changedDimensions = evidenceChangeDimensions(baseline, candidate);
    const affectedQualificationIds = record.qualifications
      .filter((qualification) => qualification.source_package_id === baseline.source_package_id)
      .map((qualification) => qualification.qualification_id);
    const generatedAt = this.clock.now();
    const reasons = requalificationReasons(baseline, candidate, changedDimensions, generatedAt);
    const status = requalificationStatus(candidate, changedDimensions, reasons, generatedAt);
    const changeSetWithoutDigest = {
      affected_qualification_ids: affectedQualificationIds,
      baseline: evidenceIdentity(baseline),
      candidate: evidenceIdentity(candidate),
      changed_dimensions: changedDimensions,
      course_id: scope.course_id,
      generated_at: generatedAt,
      historical_non_overwrite: true as const,
      tenant_id: scope.tenant_id
    } satisfies Omit<ModelQualificationEvidenceChangeSet, "change_set_digest">;
    const changeSet: ModelQualificationEvidenceChangeSet = {
      ...changeSetWithoutDigest,
      change_set_digest: (() => {
        const {
          affected_qualification_ids,
          baseline,
          candidate,
          changed_dimensions,
          course_id,
          historical_non_overwrite,
          tenant_id
        } = changeSetWithoutDigest;
        return digest({
          affected_qualification_ids,
          baseline,
          candidate,
          changed_dimensions,
          course_id,
          historical_non_overwrite,
          tenant_id
        });
      })()
    };
    const preview: ModelQualificationRequalificationPreview = {
      change_set: changeSet,
      course_id: scope.course_id,
      created_at: generatedAt,
      historical_non_overwrite: true,
      known_limits: [...DEFAULT_MODEL_QUALIFICATION_LIMITS],
      preview_id: `mq_preview_${++this.sequence}`,
      reasons,
      resolution: "PENDING",
      review: { status: status === "NO_CHANGE" ? "APPROVED" : "PENDING" },
      status,
      tenant_id: scope.tenant_id,
      updated_at: generatedAt
    };
    record.requalification_previews = [...(record.requalification_previews ?? []), preview];
    this.commit(record, actor, "model_qualification.requalification_preview", preview.preview_id);
    return { preview: clone(preview) };
  }

  reviewRequalificationPreview(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    previewId: string,
    input: { decision: "APPROVED" | "REJECTED"; note: string }
  ): { preview: ModelQualificationRequalificationPreview } {
    this.assertScope(actor, scope);
    if (!input.note.trim()) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_REVIEW_INVALID");
    }
    const record = this.mutableRecord(scope);
    const current = (record.requalification_previews ?? []).find(
      (item) => item.preview_id === previewId
    );
    if (!current) throw new ModelQualificationError("MODEL_QUALIFICATION_NOT_FOUND");
    if (current.status === "NO_CHANGE" || current.resolution !== "PENDING") {
      throw new ModelQualificationError("MODEL_QUALIFICATION_REVIEW_REQUIRED");
    }
    const reviewedAt = this.clock.now();
    const next: ModelQualificationRequalificationPreview = {
      ...clone(current),
      review: {
        decision_note: input.note.trim(),
        reviewed_at: reviewedAt,
        reviewed_by: actor.actor_id,
        status: input.decision
      },
      resolution: input.decision === "REJECTED" ? "REJECTED" : "PENDING",
      updated_at: reviewedAt
    };
    record.requalification_previews = (record.requalification_previews ?? []).map((item) =>
      item.preview_id === previewId ? next : item
    );
    this.commit(record, actor, "model_qualification.requalification_review", previewId);
    return { preview: clone(next) };
  }

  private key(tenantId: string, courseId: string): string {
    return JSON.stringify([tenantId, courseId]);
  }

  private recordOrEmpty(scope: ModelQualificationScope): ModelQualificationRecord {
    const record =
      this.records.get(this.key(scope.tenant_id, scope.course_id)) ??
      ({
        calibration_datasets: [],
        course_id: scope.course_id,
        qualifications: [],
        requalification_previews: [],
        source_packages: [],
        tenant_id: scope.tenant_id
      } satisfies ModelQualificationRecord);
    assertGovernedRollbackRequestIntegrity(record);
    return record;
  }

  private mutableRecord(scope: ModelQualificationScope): ModelQualificationRecord {
    return clone(this.recordOrEmpty(scope));
  }

  private findSource(
    scope: ModelQualificationScope,
    sourceId: string
  ): ModelQualificationSourcePackage | undefined {
    return this.recordOrEmpty(scope).source_packages.find(
      (item) => item.source_package_id === sourceId
    );
  }

  /**
   * Join the canonical tenant Course Authority, W4 strategic portfolio
   * projections, and existing model-governance records. The W4 projections
   * are supplied by the existing W4 Enterprise State authority; this method
   * only derives a read model and never persists a portfolio or readiness
   * result.
   */
  getStrategicPortfolioModelGovernanceReadiness(
    actor: ModelQualificationActor,
    authorizedCourses: readonly ModelQualificationAuthorizedCourse[],
    strategicPortfolios: Parameters<
      typeof buildStrategicPortfolioModelGovernanceReadiness
    >[0]["strategic_portfolios"],
    expectedPortfolioStateDigest?: string
  ): StrategicPortfolioModelGovernanceRoleProjection {
    if (actor.role !== "tenant_admin") {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
    }
    const readiness: StrategicPortfolioModelGovernanceReadiness =
      buildStrategicPortfolioModelGovernanceReadiness({
        tenant_id: actor.tenant_id,
        mqr_portfolio: this.getCoursePortfolio(actor, authorizedCourses),
        strategic_portfolios: strategicPortfolios,
        readiness_policy_digest: STRATEGIC_PORTFOLIO_MODEL_GOVERNANCE_READINESS_POLICY_DIGEST,
        ...(expectedPortfolioStateDigest
          ? { expected_portfolio_state_digest: expectedPortfolioStateDigest }
          : {})
      });
    return projectStrategicPortfolioModelGovernanceReadiness(
      {
        tenant_id: readiness.tenant_id,
        readiness_policy_digest: readiness.readiness_policy_digest,
        portfolio_state_digest: readiness.portfolio_state_digest,
        readiness_digest: readiness.readiness_digest,
        readiness_status: readiness.readiness_status,
        known_limits: readiness.known_limits,
        entries: readiness.entries.map((entry) => ({
          course: entry.course,
          exact_scope: entry.exact_scope,
          portfolio_id: entry.portfolio_id,
          portfolio_digest: entry.portfolio_digest,
          model_qualification_portfolio_state_digest:
            entry.model_qualification_portfolio_state_digest,
          adoption_state_digest: entry.adoption_state_digest,
          current_adoption: entry.current_adoption,
          qualification: entry.qualification
            ? {
                qualification_id: entry.qualification.qualification_id,
                content_digest: entry.qualification.content_digest
              }
            : null,
          blockers: entry.blockers,
          known_limits: entry.known_limits,
          readiness: entry.readiness,
          readiness_digest: entry.readiness_digest
        }))
      },
      "admin"
    );
  }

  private findDataset(
    scope: ModelQualificationScope,
    datasetId: string
  ): ModelQualificationCalibrationDataset | undefined {
    return this.recordOrEmpty(scope).calibration_datasets.find(
      (item) => item.calibration_dataset_id === datasetId
    );
  }

  private findQualification(
    scope: ModelQualificationScope,
    qualificationId: string
  ): ModelQualification {
    const qualification = this.recordOrEmpty(scope).qualifications.find(
      (item) => item.qualification_id === qualificationId
    );
    if (!qualification) throw new ModelQualificationError("MODEL_QUALIFICATION_NOT_FOUND");
    return qualification;
  }

  private assertScope(actor: ModelQualificationActor, scope: ModelQualificationScope): void {
    if (
      !actor.tenant_id ||
      actor.tenant_id !== scope.tenant_id ||
      !scope.activity_id ||
      !scope.course_id
    ) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
    }
  }

  private assertAdmissionNotInProgress(scope: ModelQualificationScope): void {
    if (this.admissionGuards.has(this.key(scope.tenant_id, scope.course_id)))
      throw new Error("EVIDENCE_ADOPTION_ADMISSION_IN_PROGRESS");
  }

  private security(actor: ModelQualificationActor, scope: ModelQualificationScope) {
    return {
      activity: scope.activity_id,
      course: scope.course_id,
      role: actor.role,
      tenant: scope.tenant_id
    };
  }

  private commit(
    record: ModelQualificationRecord,
    actor: ModelQualificationActor,
    action: string,
    resourceId: string,
    options: { withinAdmissionGuard?: boolean } = {}
  ): void {
    if (
      this.admissionGuards.has(this.key(record.tenant_id, record.course_id)) &&
      !options.withinAdmissionGuard
    )
      throw new Error("EVIDENCE_ADOPTION_ADMISSION_IN_PROGRESS");
    assertGovernedRollbackRequestIntegrity(record);
    const audit: AuditLog = {
      action,
      actor_id: actor.actor_id,
      actor_role: actor.role,
      after: {
        course_id: record.course_id,
        model_governance_writer: MODEL_QUALIFICATION_SOLE_WRITER,
        source_package_count: record.source_packages.length,
        dataset_count: record.calibration_datasets.length,
        qualification_count: record.qualifications.length
      },
      audit_id: `mq_audit_${resourceId}`,
      created_at: this.clock.now(),
      request_id: resourceId,
      resource_id: resourceId,
      resource_type: "model_qualification",
      tenant_id: actor.tenant_id
    };
    this.persistence?.commitRecord(clone(record), audit);
    this.records.set(this.key(record.tenant_id, record.course_id), clone(record));
  }
}

function evidenceIdentity(
  source: ModelQualificationSourcePackage
): ModelQualificationEvidenceIdentity {
  return {
    content_digest: source.content_digest,
    evidence_refs: [...source.evidence_refs],
    expires_at: source.expires_at,
    feature_schema_digest: source.feature_schema_digest,
    freshness_status: source.freshness_status,
    observed_at: source.observed_at,
    quality: clone(source.quality),
    rights_status: source.rights_status,
    source_package_id: source.source_package_id,
    source_ref: source.source_ref,
    source_version: source.source_version
  };
}

function evidenceChangeDimensions(
  baseline: ModelQualificationSourcePackage,
  candidate: ModelQualificationSourcePackage
): ModelQualificationEvidenceChangeDimension[] {
  const dimensions: ModelQualificationEvidenceChangeDimension[] = [];
  if (baseline.content_digest !== candidate.content_digest) dimensions.push("content_digest");
  if (baseline.source_ref !== candidate.source_ref) dimensions.push("source_ref");
  if (baseline.source_version !== candidate.source_version) dimensions.push("source_version");
  if (baseline.feature_schema_digest !== candidate.feature_schema_digest) {
    dimensions.push("feature_schema_digest");
  }
  if (baseline.observed_at !== candidate.observed_at) dimensions.push("observed_at");
  if (baseline.expires_at !== candidate.expires_at) dimensions.push("expires_at");
  if (baseline.rights_status !== candidate.rights_status) dimensions.push("rights_status");
  if (baseline.freshness_status !== candidate.freshness_status) {
    dimensions.push("freshness_status");
  }
  if (stable(baseline.quality) !== stable(candidate.quality)) dimensions.push("quality");
  if (stable(baseline.evidence_refs) !== stable(candidate.evidence_refs)) {
    dimensions.push("evidence_refs");
  }
  return dimensions;
}

function requalificationReasons(
  baseline: ModelQualificationSourcePackage,
  candidate: ModelQualificationSourcePackage,
  dimensions: readonly ModelQualificationEvidenceChangeDimension[],
  now: string
): string[] {
  const reasons = dimensions.map((dimension) => `SOURCE_${dimension.toUpperCase()}_CHANGED`);
  if (candidate.rights_status !== "VALID") reasons.push("CANDIDATE_RIGHTS_NOT_ELIGIBLE");
  if (candidate.freshness_status !== "FRESH") reasons.push("CANDIDATE_NOT_FRESH");
  if (
    candidate.quality.missingness_rate > MAX_MISSINGNESS ||
    candidate.quality.conflict_count > 0
  ) {
    reasons.push("CANDIDATE_QUALITY_NOT_ELIGIBLE");
  }
  if (candidate.expires_at && Date.parse(candidate.expires_at) <= Date.parse(now)) {
    reasons.push("CANDIDATE_EXPIRED");
  }
  if (baseline.tenant_id !== candidate.tenant_id || baseline.course_id !== candidate.course_id) {
    reasons.push("EVIDENCE_SCOPE_CONFLICT");
  }
  return [...new Set(reasons)];
}

function requalificationStatus(
  candidate: ModelQualificationSourcePackage,
  dimensions: readonly ModelQualificationEvidenceChangeDimension[],
  reasons: readonly string[],
  now: string
): ModelQualificationRequalificationStatus {
  if (
    candidate.rights_status !== "VALID" ||
    candidate.freshness_status !== "FRESH" ||
    candidate.quality.missingness_rate > MAX_MISSINGNESS ||
    candidate.quality.conflict_count > 0 ||
    Boolean(candidate.expires_at && Date.parse(candidate.expires_at) <= Date.parse(now)) ||
    reasons.includes("EVIDENCE_SCOPE_CONFLICT")
  ) {
    return "NOT_ELIGIBLE";
  }
  if (dimensions.length === 0) return "NO_CHANGE";
  if (dimensions.includes("feature_schema_digest")) return "REBASE_REQUIRED";
  return "REQUALIFICATION_REQUIRED";
}

function isSourceEligibleAt(source: ModelQualificationSourcePackage, now: string): boolean {
  return (
    source.rights_status === "VALID" &&
    source.freshness_status === "FRESH" &&
    source.quality.missingness_rate <= MAX_MISSINGNESS &&
    source.quality.conflict_count === 0 &&
    !(source.expires_at && Date.parse(source.expires_at) <= Date.parse(now))
  );
}

function blocksCandidateBinding(preview: ModelQualificationRequalificationPreview): boolean {
  if (preview.resolution === "ACCEPTED") return false;
  if (preview.status === "NO_CHANGE") return false;
  if (preview.status === "NOT_ELIGIBLE" || preview.status === "REBASE_REQUIRED") return true;
  return preview.review.status !== "APPROVED";
}

export type { ModelArtifactReference };
