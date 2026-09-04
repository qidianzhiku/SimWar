import type {
  EvidenceAdoptionEpoch,
  EvidenceAdoptionProposal,
  EvidenceAdoptionReference
} from "./model-qualification-evidence-adoption.js";
import type { AdoptionRollbackDryRun } from "./model-qualification-adoption-operations.js";

export const MODEL_QUALIFICATION_GOVERNED_ROLLBACK_SCHEMA_VERSION =
  "model-qualification-governed-rollback.v1" as const;

export interface GovernedRollbackRequestReference {
  readonly rollback_request_id: string;
  readonly rollback_request_digest: string;
}

/** Immutable governance receipt. It requests a proposal; it never applies a rollback. */
export interface GovernedRollbackRequest extends GovernedRollbackRequestReference {
  readonly schema_version: typeof MODEL_QUALIFICATION_GOVERNED_ROLLBACK_SCHEMA_VERSION;
  readonly tenant_id: string;
  readonly course_id: string;
  readonly command_id: string;
  readonly command_fingerprint: string;
  readonly requested_by: string;
  readonly requested_role: "teacher" | "tenant_admin";
  readonly requested_at: string;
  readonly reason: string;
  readonly dry_run_id: string;
  readonly dry_run_digest: string;
  readonly current_adoption: EvidenceAdoptionReference;
  readonly predecessor_adoption: EvidenceAdoptionReference;
  readonly predecessor_epoch: EvidenceAdoptionEpoch;
  readonly adoption_state_digest: string;
  readonly operations_policy_digest: string;
  readonly linked_proposal: Pick<EvidenceAdoptionProposal, "proposal_id" | "proposal_digest">;
  readonly status: "LINKED_PROPOSAL_PENDING_REVIEW";
  readonly current_selection_changed: false;
  readonly rollback_applied: false;
  readonly adoption_mutation: false;
  readonly official_truth_write: false;
  readonly history_deleted: false;
  readonly historical_receipt_rewritten: false;
  readonly provider: "OFF";
}

export interface GovernedRollbackRequestInput {
  readonly command_id: string;
  readonly dry_run: AdoptionRollbackDryRun;
  readonly reason: string;
}

export interface GovernedRollbackRequestReceipt {
  readonly request: GovernedRollbackRequest;
  readonly proposal: EvidenceAdoptionProposal;
  readonly reused: boolean;
}

export interface ModelQualificationGovernedRollbackTeacherProjection {
  readonly operation_id: "MODEL_QUALIFICATION_GOVERNED_ROLLBACK_TEACHER_GET_V1";
  readonly requests: readonly GovernedRollbackRequest[];
  readonly known_limits: readonly string[];
  readonly provider: "OFF";
  readonly rollback_applied: false;
  readonly official_truth_write: false;
}

export interface ModelQualificationGovernedRollbackAdminProjection extends Omit<
  ModelQualificationGovernedRollbackTeacherProjection,
  "operation_id"
> {
  readonly operation_id: "MODEL_QUALIFICATION_GOVERNED_ROLLBACK_ADMIN_GET_V1";
  readonly authority: {
    readonly model_governance_writer: "MAIN_MODEL_GOVERNANCE";
    readonly formal_truth_writer: "SIMULATION_CORE";
    readonly writes_formal_truth: false;
  };
}
