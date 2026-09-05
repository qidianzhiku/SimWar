import type {
  EvidenceAdoptionProposal,
  EvidenceAdoptionRecord,
  EvidenceAdoptionReference,
  EvidenceAdoptionReview
} from "./model-qualification-evidence-adoption.js";
import type { GovernedRollbackRequest } from "./model-qualification-governed-rollback.js";

export const MODEL_QUALIFICATION_ROLLBACK_OUTCOME_SCHEMA_VERSION =
  "model-qualification-rollback-outcome.v1" as const;

export type ModelQualificationRollbackOutcomeStatus =
  | "PENDING_REVIEW"
  | "REVIEW_REJECTED"
  | "APPROVED_PENDING_DISPOSITION"
  | "DEFERRED_WITH_EXPIRY"
  | "REJECTED_CANDIDATE"
  | "REBASE_REQUIRED"
  | "READOPTED_FOR_FUTURE_ADMISSION";

export type ModelQualificationRollbackCurrentEffect =
  | "CURRENT"
  | "SUPERSEDED"
  | "NOT_APPLICABLE"
  | "REBASE_REQUIRED";

export type ModelQualificationRollbackConsistencyStatus =
  | "CONSISTENT"
  | "LIMITED"
  | "BLOCKED"
  | "INCONSISTENT";

export interface ModelQualificationRollbackOutcomeResolution {
  readonly schema_version: typeof MODEL_QUALIFICATION_ROLLBACK_OUTCOME_SCHEMA_VERSION;
  readonly resolution_id: string;
  readonly resolution_digest: string;
  readonly tenant_id: string;
  readonly course_id: string;
  readonly rollback_request_id: string;
  readonly rollback_request_digest: string;
  readonly immutable_request_status: GovernedRollbackRequest["status"];
  readonly request: GovernedRollbackRequest;
  readonly linked_proposal: EvidenceAdoptionProposal | null;
  readonly review: EvidenceAdoptionReview | null;
  readonly disposition: EvidenceAdoptionRecord | null;
  readonly resulting_adoption: EvidenceAdoptionReference | null;
  readonly outcome_status: ModelQualificationRollbackOutcomeStatus;
  readonly historical_outcome: {
    readonly status: ModelQualificationRollbackOutcomeStatus;
    readonly request_status: GovernedRollbackRequest["status"];
    readonly resulting_adoption: EvidenceAdoptionReference | null;
  };
  readonly current_effect: ModelQualificationRollbackCurrentEffect;
  readonly qualification_consistency: ModelQualificationRollbackConsistencyStatus;
  readonly historical_consistency: ModelQualificationRollbackConsistencyStatus;
  readonly known_limits: readonly string[];
  readonly provider: "OFF";
  readonly advisory_only: true;
  readonly rollback_applied: false;
  readonly adoption_mutation: false;
  readonly official_truth_write: false;
  readonly history_deleted: false;
  readonly historical_receipt_rewritten: false;
  readonly visibility: "TEACHER_ADMIN_DETAIL";
}

export interface ModelQualificationRollbackOutcomeStudentSummary {
  readonly schema_version: typeof MODEL_QUALIFICATION_ROLLBACK_OUTCOME_SCHEMA_VERSION;
  readonly operation_id: "MODEL_QUALIFICATION_ROLLBACK_OUTCOME_STUDENT_GET_V1";
  readonly applicability:
    | "CURRENT"
    | "SUPERSEDED"
    | "NOT_APPLICABLE"
    | "REBASE_REQUIRED"
    | "UNKNOWN";
  readonly qualification_consistency: ModelQualificationRollbackConsistencyStatus;
  readonly historical_consistency: ModelQualificationRollbackConsistencyStatus;
  readonly known_limits: readonly string[];
  readonly provider: "OFF";
  readonly advisory_only: true;
  readonly rollback_applied: false;
  readonly official_truth_write: false;
  readonly visibility: "ROLE_SAFE_STUDENT";
}
