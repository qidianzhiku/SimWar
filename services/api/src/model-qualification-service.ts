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
  digestEvidenceAdoptionState
} from "./model-qualification-adoption-drift-assessment.js";
import { runAdoptionRollbackDryRun } from "./model-qualification-rollback-dry-run.js";
import type {
  AdoptionDriftAssessment,
  AdoptionDriftAssessmentRequest,
  AdoptionRollbackDryRun,
  AdoptionRollbackDryRunRequest,
  DisposeEvidenceAdoption,
  EvidenceAdoptionCommandContext,
  EvidenceAdoptionReference,
  EvidenceAdoptionState,
  QualifiedRunAdmissionSnapshot,
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
  ModelQualificationSourcePackage
} from "@simwar/shared-contracts";
import { MODEL_QUALIFICATION_SOLE_WRITER } from "@simwar/shared-contracts";

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
  ) {
    super(code);
    this.name = "ModelQualificationError";
  }
}

export class ModelQualificationService {
  private readonly admissionGuards = new Set<string>();
  readonly modelCatalog = [clone(MODEL_QUALIFICATION_MODEL_VERSION)] as const;
  private readonly clock: ModelQualificationClock;
  private readonly persistence: ModelQualificationPersistence | undefined;
  private readonly records = new Map<string, ModelQualificationRecord>();
  private sequence = 0;

  constructor(
    clock: ModelQualificationClock = DEFAULT_CLOCK,
    persistence?: ModelQualificationPersistence
  ) {
    this.clock = clock;
    this.persistence = persistence;
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
   * Read one tenant/course-scoped qualification record for an existing
   * admission boundary. The returned value is cloned so this read cannot
   * mutate the sole model-governance writer's in-memory authority.
   */
  getRecordForScope(
    scope: Pick<ModelQualificationScope, "tenant_id" | "course_id">
  ): ModelQualificationRecord | null {
    const record = this.records.get(this.key(scope.tenant_id, scope.course_id));
    return record ? clone(record) : null;
  }

  private adoptionContext(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    commandId: string
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
      now: this.clock.now()
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
    return this.withEvidenceAdmission(actor, scope, async (record) =>
      assessAdoptionDrift({
        ...input,
        record,
        selection_requirement: "CURRENT",
        state: this.validatedAdoptionState(record, scope)
      })
    );
  }

  /** Pure rollback impact preview. It never applies an adoption mutation. */
  async dryRunEvidenceAdoptionRollback(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: AdoptionRollbackDryRunRequest
  ): Promise<AdoptionRollbackDryRun> {
    return this.withEvidenceAdmission(actor, scope, async (record) => {
      const state = this.validatedAdoptionState(record, scope);
      const actualStateDigest = digestEvidenceAdoptionState(state);
      const actualPolicyDigest = digestAdoptionOperationsPolicy();
      const predecessorAssessment = assessAdoptionDrift({
        assessed_at: input.assessed_at,
        expected_adoption: input.predecessor_adoption,
        expected_adoption_state_digest: input.expected_adoption_state_digest,
        expected_operations_policy_digest: input.expected_operations_policy_digest,
        record,
        selection_requirement: "HISTORICAL_PREDECESSOR",
        state
      });
      return runAdoptionRollbackDryRun({
        ...input,
        actual_adoption_state_digest: actualStateDigest,
        actual_operations_policy_digest: actualPolicyDigest,
        adoption_state: state,
        predecessor_assessment: predecessorAssessment
      });
    });
  }

  async getAdoptionOperationsProjection(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope
  ): Promise<
    | ModelQualificationAdoptionOperationsTeacherProjection
    | ModelQualificationAdoptionOperationsAdminProjection
  > {
    return this.withEvidenceAdmission(actor, scope, async (record, now) => {
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
    return this.withScopedEvidenceAdmission(actor, scope, async (record, now) => {
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
    return (
      this.records.get(this.key(scope.tenant_id, scope.course_id)) ?? {
        calibration_datasets: [],
        course_id: scope.course_id,
        qualifications: [],
        requalification_previews: [],
        source_packages: [],
        tenant_id: scope.tenant_id
      }
    );
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
    resourceId: string
  ): void {
    if (this.admissionGuards.has(this.key(record.tenant_id, record.course_id)))
      throw new Error("EVIDENCE_ADOPTION_ADMISSION_IN_PROGRESS");
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
