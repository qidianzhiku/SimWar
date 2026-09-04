import type { ModelArtifactReference, ModelVersionReference } from "./model-governance.js";

/** Governance-only exact evidence identity; never a simulation truth input. */
export interface EvidenceAdoptionEpoch {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly source_package_id: string;
  readonly source_content_digest: string;
  readonly calibration_dataset_id: string;
  readonly calibration_dataset_content_digest: string;
  readonly qualification_id: string;
  readonly qualification_content_digest: string;
  readonly model_version_reference: ModelVersionReference;
  readonly model_artifact_reference: ModelArtifactReference;
  readonly source_expires_at: string | null;
  readonly epoch_digest: string;
}

export interface EvidenceAdoptionReference {
  readonly adoption_id: string;
  readonly adoption_digest: string;
}

export type EvidenceAdoptionDisposition =
  | "ADOPTED_FOR_FUTURE_ADMISSION"
  | "DEFERRED_WITH_EXPIRY"
  | "REJECTED_CANDIDATE"
  | "REBASE_REQUIRED";

export interface EvidenceAdoptionProposal {
  readonly proposal_id: string;
  readonly proposal_digest: string;
  readonly epoch: EvidenceAdoptionEpoch;
  readonly expected_adoption: EvidenceAdoptionReference | null;
  readonly requested_by: string;
  readonly requested_at: string;
}

export interface EvidenceAdoptionReview {
  readonly review_id: string;
  /** Immutable receipt digest includes reviewed_at; retry fingerprints do not. */
  readonly review_digest: string;
  readonly proposal_id: string;
  readonly proposal_digest: string;
  readonly decision: "APPROVED" | "REJECTED";
  readonly note: string;
  readonly reviewed_by: string;
  readonly reviewed_at: string;
}

export interface EvidenceAdoptionRecord extends EvidenceAdoptionReference {
  readonly proposal_id: string;
  readonly proposal_digest: string;
  readonly review_id: string;
  readonly review_digest: string;
  readonly epoch: EvidenceAdoptionEpoch;
  readonly predecessor: EvidenceAdoptionReference | null;
  readonly disposition: EvidenceAdoptionDisposition;
  readonly expires_at: string | null;
  readonly note: string;
  readonly decided_by: string;
  readonly decided_at: string;
  readonly official_truth_write: false;
  readonly provider: "OFF";
}

export interface FutureEvidenceAdoptionSelection extends EvidenceAdoptionReference {
  readonly model_version_reference: ModelVersionReference;
  readonly model_artifact_reference: ModelArtifactReference;
}

/** One scoped immutable command journal, persisted by MAIN_MODEL_GOVERNANCE. */
export interface EvidenceAdoptionCommandReceipt {
  readonly command_id: string;
  readonly command_fingerprint: string;
  readonly actor_id: string;
  readonly action: "REQUEST" | "REVIEW" | "DISPOSE";
  readonly entity_id: string;
}

export interface EvidenceAdoptionState {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly proposals: readonly EvidenceAdoptionProposal[];
  readonly reviews: readonly EvidenceAdoptionReview[];
  readonly records: readonly EvidenceAdoptionRecord[];
  readonly selections: readonly FutureEvidenceAdoptionSelection[];
  readonly commands: readonly EvidenceAdoptionCommandReceipt[];
}

export interface EvidenceAdoptionCommandContext {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly actor_id: string;
  readonly role: "teacher" | "tenant_admin";
  readonly command_id: string;
  readonly now: string;
}

export interface RequestEvidenceAdoption {
  readonly epoch: EvidenceAdoptionEpoch;
  readonly expected_adoption: EvidenceAdoptionReference | null;
}

export interface ReviewEvidenceAdoption {
  readonly proposal_id: string;
  readonly proposal_digest: string;
  readonly decision: "APPROVED" | "REJECTED";
  readonly note: string;
}

export interface DisposeEvidenceAdoption {
  readonly proposal_id: string;
  readonly proposal_digest: string;
  readonly disposition: EvidenceAdoptionDisposition;
  readonly expires_at: string | null;
  readonly note: string;
}

export interface EvidenceAdoptionReduction<T> {
  readonly state: EvidenceAdoptionState;
  readonly receipt: T;
  readonly reused: boolean;
}
