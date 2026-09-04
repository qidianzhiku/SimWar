import type {
  EvidenceAdoptionEpoch,
  EvidenceAdoptionReference
} from "./model-qualification-evidence-adoption.js";

export const MODEL_QUALIFICATION_ADOPTION_OPERATIONS_SCHEMA_VERSION =
  "model-qualification-adoption-operations.v1" as const;

/**
 * Explicit O6 policy. Callers must bind its digest; no latest/default policy
 * lookup is permitted by the operations plane.
 */
export interface ModelQualificationAdoptionOperationsPolicy {
  readonly schema_version: typeof MODEL_QUALIFICATION_ADOPTION_OPERATIONS_SCHEMA_VERSION;
  readonly policy_id: string;
  readonly max_drift_score: number;
  readonly max_ood_rate: number;
  readonly max_sensitivity_delta: number;
  readonly max_missingness_rate: number;
  readonly expiry_warning_window_hours: number;
  readonly require_bound_qualification: true;
  readonly require_fresh_source: true;
  readonly require_valid_rights: true;
  readonly require_zero_holdout_leakage: true;
  readonly provider: "OFF";
  readonly dry_run_only: true;
}

export type AdoptionDriftAssessmentStatus =
  | "HEALTHY"
  | "REVIEW_REQUIRED"
  | "FUTURE_ADMISSION_BLOCKED"
  | "REBASE_REQUIRED";

export type AdoptionDriftIssueCode =
  | "ADOPTION_NOT_FOUND"
  | "ADOPTION_NOT_CURRENT"
  | "ADOPTION_STATE_DIGEST_CHANGED"
  | "OPERATIONS_POLICY_DIGEST_CHANGED"
  | "SOURCE_EXPIRED"
  | "SOURCE_RIGHTS_INVALID"
  | "SOURCE_NOT_FRESH"
  | "SOURCE_QUALITY_INVALID"
  | "DATASET_NOT_READY"
  | "HOLDOUT_LEAKAGE"
  | "QUALIFICATION_NOT_APPROVED"
  | "QUALIFICATION_REVIEW_NOT_APPROVED"
  | "QUALIFICATION_NOT_BOUND"
  | "QUALIFICATION_DIAGNOSTIC_DRIFT"
  | "QUALIFICATION_DIAGNOSTIC_OOD"
  | "QUALIFICATION_DIAGNOSTIC_SENSITIVITY"
  | "REQUALIFICATION_UNRESOLVED";

export interface AdoptionDriftAssessment {
  readonly assessment_id: string;
  readonly assessment_digest: string;
  readonly assessed_at: string;
  readonly adoption: EvidenceAdoptionReference;
  readonly adoption_state_digest: string;
  readonly epoch: EvidenceAdoptionEpoch;
  readonly operations_policy_digest: string;
  readonly status: AdoptionDriftAssessmentStatus;
  readonly future_admission_impact: "UNCHANGED" | "REVIEW_REQUIRED" | "BLOCKED" | "REBASE_REQUIRED";
  readonly issue_codes: readonly AdoptionDriftIssueCode[];
  readonly known_limits: readonly string[];
  readonly provider: "OFF";
  readonly advisory_only: true;
  readonly adoption_mutation: false;
  readonly official_truth_write: false;
}

export interface AdoptionDriftAssessmentRequest {
  readonly expected_adoption: EvidenceAdoptionReference;
  readonly expected_adoption_state_digest: string;
  readonly expected_operations_policy_digest: string;
  readonly assessed_at: string;
}

export type AdoptionRollbackDryRunStatus =
  | "READY_WITH_LIMITS"
  | "BLOCKED"
  | "REBASE_REQUIRED"
  | "NO_PREDECESSOR";

export type AdoptionRollbackDryRunBlocker =
  | AdoptionDriftIssueCode
  | "CURRENT_ADOPTION_NOT_FOUND"
  | "CURRENT_ADOPTION_NOT_ACTIVE"
  | "PREDECESSOR_NOT_FOUND"
  | "PREDECESSOR_REFERENCE_MISMATCH"
  | "PREDECESSOR_NOT_HISTORICALLY_ADOPTED"
  | "PREDECESSOR_NOT_CURRENTLY_ELIGIBLE";

export interface AdoptionRollbackDryRunRequest {
  readonly current_adoption: EvidenceAdoptionReference;
  readonly predecessor_adoption: EvidenceAdoptionReference;
  readonly expected_adoption_state_digest: string;
  readonly expected_operations_policy_digest: string;
  readonly assessed_at: string;
}

export interface AdoptionRollbackDryRun {
  readonly dry_run_id: string;
  readonly dry_run_digest: string;
  readonly assessed_at: string;
  readonly current_adoption: EvidenceAdoptionReference;
  readonly predecessor_adoption: EvidenceAdoptionReference;
  readonly predecessor_epoch: EvidenceAdoptionEpoch | null;
  readonly adoption_state_digest: string;
  readonly operations_policy_digest: string;
  readonly status: AdoptionRollbackDryRunStatus;
  readonly predecessor_currently_eligible: boolean;
  readonly future_admission_impact:
    | "WOULD_SELECT_EXACT_PREDECESSOR"
    | "BLOCKED"
    | "REBASE_REQUIRED";
  readonly blockers: readonly AdoptionRollbackDryRunBlocker[];
  readonly known_limits: readonly string[];
  readonly provider: "OFF";
  readonly advisory_only: true;
  readonly rollback_applied: false;
  readonly adoption_mutation: false;
  readonly official_truth_write: false;
  readonly history_deleted: false;
  readonly historical_receipt_rewritten: false;
}

export interface ModelQualificationAdoptionOperationsTeacherProjection {
  readonly operation_id: "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_TEACHER_GET_V1";
  readonly current_adoption: EvidenceAdoptionReference | null;
  readonly current_assessment: AdoptionDriftAssessment | null;
  readonly rollback_dry_run: AdoptionRollbackDryRun | null;
  readonly adoption_state_digest: string;
  readonly operations_policy_digest: string;
  readonly known_limits: readonly string[];
  readonly provider: "OFF";
  readonly advisory_only: true;
}

export interface ModelQualificationAdoptionOperationsAdminProjection extends Omit<
  ModelQualificationAdoptionOperationsTeacherProjection,
  "operation_id"
> {
  readonly operation_id: "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_ADMIN_GET_V1";
  readonly authority: {
    readonly model_governance_writer: "MAIN_MODEL_GOVERNANCE";
    readonly formal_truth_writer: "SIMULATION_CORE";
    readonly writes_formal_truth: false;
  };
}

export interface ModelQualificationAdoptionOperationsStudentProjection {
  readonly operation_id: "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_STUDENT_GET_V1";
  readonly applicability: "HEALTHY" | "LIMITED" | "BLOCKED" | "UNAVAILABLE";
  readonly freshness: "FRESH" | "STALE" | "UNKNOWN";
  readonly requalification_impact: "NONE" | "REVIEW_REQUIRED" | "BLOCKED" | "REBASE_REQUIRED";
  readonly known_limits: readonly string[];
  readonly provider: "OFF";
  readonly advisory_only: true;
  readonly rollback_applied: false;
  readonly official_truth_write: false;
  readonly visibility: "ROLE_SAFE_STUDENT";
}
