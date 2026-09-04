import type { ModelArtifactReference, ModelVersionReference } from "./model-governance.js";
import type {
  EvidenceAdoptionReference,
  EvidenceAdoptionState
} from "./model-qualification-evidence-adoption.js";
import type { GovernedRollbackRequest } from "./model-qualification-governed-rollback.js";

export const MODEL_QUALIFICATION_SCHEMA_VERSION = "model-qualification.v1" as const;
export const MODEL_QUALIFICATION_AUTHORITY_ID = "SIMWAR-MODEL-QUALIFICATION-PLANE" as const;
export const MODEL_QUALIFICATION_SOLE_WRITER = "MAIN_MODEL_GOVERNANCE" as const;

export const MODEL_QUALIFICATION_DECISIONS = ["APPROVED", "REJECTED", "NOT_ELIGIBLE"] as const;
export type ModelQualificationDecision = (typeof MODEL_QUALIFICATION_DECISIONS)[number];
export type ModelQualificationRightsStatus = "VALID" | "EXPIRED" | "UNKNOWN" | "RESTRICTED";
export type ModelQualificationFreshnessStatus = "FRESH" | "STALE" | "UNKNOWN";
export type ModelQualificationReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ModelQualificationBindingStatus = "UNBOUND" | "BOUND";
export type ModelQualificationRequalificationStatus =
  | "NO_CHANGE"
  | "REQUALIFICATION_REQUIRED"
  | "NOT_ELIGIBLE"
  | "BLOCKED"
  | "REBASE_REQUIRED";
export type ModelQualificationRequalificationReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ModelQualificationRequalificationResolution = "PENDING" | "ACCEPTED" | "REJECTED";
export type ModelQualificationEvidenceChangeDimension =
  | "content_digest"
  | "source_ref"
  | "source_version"
  | "feature_schema_digest"
  | "observed_at"
  | "expires_at"
  | "rights_status"
  | "freshness_status"
  | "quality"
  | "evidence_refs";

export interface ModelQualificationModelCatalogEntry {
  artifact: ModelArtifactReference;
  model_family: "toy_logit" | "blp" | "rcnl" | "w5_governed" | "custom";
  model_version_reference: ModelVersionReference;
  status: "APPROVED" | "RETIRED";
}

export interface ModelQualificationSourceQuality {
  conflict_count: number;
  missingness_rate: number;
  record_count: number;
}

export interface ModelQualificationSourcePackage {
  content_digest: string;
  course_id: string;
  evidence_refs: readonly string[];
  expires_at: string | null;
  feature_schema_digest: string;
  freshness_status: ModelQualificationFreshnessStatus;
  observed_at: string;
  quality: ModelQualificationSourceQuality;
  rights_status: ModelQualificationRightsStatus;
  source_package_id: string;
  source_ref: string;
  source_version: string;
  tenant_id: string;
  title: string;
}

export interface ModelQualificationCalibrationDataset {
  calibration_dataset_id: string;
  calibration_record_ids: readonly string[];
  content_digest: string;
  course_id: string;
  created_at: string;
  holdout_leakage_count: number;
  holdout_record_ids: readonly string[];
  record_count: number;
  source_package_id: string;
  status: "READY" | "NOT_ELIGIBLE";
  tenant_id: string;
  zero_holdout_leakage: boolean;
}

export interface ModelQualificationDiagnostics {
  baseline_error: number;
  convergence_status: "CONVERGED" | "NOT_CONVERGED";
  differential_error: number;
  drift_score: number;
  ood_rate: number;
  sensitivity_max_delta: number;
}

export interface ModelQualificationAuthorityFlags {
  official_truth_write: false;
  provider_calls: 0;
}

export interface ModelQualificationRecord {
  evidence_adoption?: EvidenceAdoptionState;
  governed_rollback_requests?: readonly GovernedRollbackRequest[];
  calibration_datasets: readonly ModelQualificationCalibrationDataset[];
  course_id: string;
  qualifications: readonly ModelQualification[];
  requalification_previews?: readonly ModelQualificationRequalificationPreview[];
  source_packages: readonly ModelQualificationSourcePackage[];
  tenant_id: string;
}

/**
 * Client-provided selector for a server-authoritative qualified Run admission.
 * It identifies an already adopted evidence epoch but does not grant admission
 * by itself; the server revalidates every reference before the existing Run
 * writer is entered.
 */
export interface ModelQualificationRunAdmissionSelection {
  readonly adoption: EvidenceAdoptionReference;
  readonly calibration_dataset_id: string;
  readonly model_artifact_reference: ModelArtifactReference;
  readonly model_version_reference: ModelVersionReference;
  readonly qualification_id: string;
  readonly source_package_id: string;
}

export interface ModelQualificationEvidenceIdentity {
  content_digest: string;
  evidence_refs: readonly string[];
  expires_at: string | null;
  feature_schema_digest: string;
  freshness_status: ModelQualificationFreshnessStatus;
  observed_at: string;
  quality: ModelQualificationSourceQuality;
  rights_status: ModelQualificationRightsStatus;
  source_package_id: string;
  source_ref: string;
  source_version: string;
}

export interface ModelQualificationEvidenceChangeSet {
  affected_qualification_ids: readonly string[];
  baseline: ModelQualificationEvidenceIdentity;
  candidate: ModelQualificationEvidenceIdentity;
  change_set_digest: string;
  changed_dimensions: readonly ModelQualificationEvidenceChangeDimension[];
  course_id: string;
  generated_at: string;
  historical_non_overwrite: true;
  tenant_id: string;
}

export interface ModelQualificationRequalificationPreview {
  change_set: ModelQualificationEvidenceChangeSet;
  course_id: string;
  created_at: string;
  historical_non_overwrite: true;
  known_limits: readonly string[];
  preview_id: string;
  reasons: readonly string[];
  resolution: ModelQualificationRequalificationResolution;
  review: {
    decision_note?: string;
    reviewed_at?: string;
    reviewed_by?: string;
    status: ModelQualificationRequalificationReviewStatus;
  };
  status: ModelQualificationRequalificationStatus;
  tenant_id: string;
  updated_at: string;
}

export interface ModelQualification {
  artifact: ModelArtifactReference;
  authority_flags: ModelQualificationAuthorityFlags;
  binding: {
    bound_at?: string;
    bound_by?: string;
    course_id?: string;
    status: ModelQualificationBindingStatus;
  };
  calibration_dataset_id: string;
  content_digest: string;
  course_id: string;
  created_at: string;
  decision: ModelQualificationDecision;
  deterministic_seed: number;
  diagnostics: ModelQualificationDiagnostics;
  known_limits: readonly string[];
  model_version_reference: ModelVersionReference;
  no_implicit_latest: true;
  qualification_id: string;
  reasons: readonly string[];
  review: {
    decision_note?: string;
    reviewed_at?: string;
    reviewed_by?: string;
    status: ModelQualificationReviewStatus;
  };
  source_package_id: string;
  tenant_id: string;
  updated_at: string;
}

export interface ModelQualificationTeacherProjection {
  evidence_adoption?: EvidenceAdoptionState;
  governed_rollback_requests?: readonly GovernedRollbackRequest[];
  calibration_datasets: readonly ModelQualificationCalibrationDataset[];
  known_limits: readonly string[];
  model_catalog: readonly ModelQualificationModelCatalogEntry[];
  operation_id: "MODEL_QUALIFICATION_TEACHER_STUDIO_GET_V1";
  qualifications: readonly ModelQualification[];
  requalification_previews?: readonly ModelQualificationRequalificationPreview[];
  security: {
    activity: string;
    course: string;
    role: string;
    tenant: string;
  };
  source_packages: readonly ModelQualificationSourcePackage[];
}

export interface ModelQualificationAdminProjection extends Omit<
  ModelQualificationTeacherProjection,
  "operation_id"
> {
  operation_id: "MODEL_QUALIFICATION_ADMIN_AUDIT_GET_V1";
  authority: {
    ai_provider: "OFF";
    formal_truth_writer: "SIMULATION_CORE";
    model_governance_writer: typeof MODEL_QUALIFICATION_SOLE_WRITER;
    repository_provider: "JSON_INTERNAL_ONLY";
    writes_formal_truth: false;
  };
}

export interface ModelQualificationStudentProjection {
  adoption?: {
    applicability:
      | "ADOPTED_FOR_FUTURE_ADMISSION"
      | "HISTORICAL_ONLY"
      | "NOT_ADOPTED"
      | "UNAVAILABLE";
    historical_non_overwrite: true;
    provider: "OFF";
    official_truth_write: false;
    known_limits: readonly string[];
  };
  known_limits: readonly string[];
  operation_id: "MODEL_QUALIFICATION_STUDENT_PROJECTION_GET_V1";
  qualification: {
    binding_status: ModelQualificationBindingStatus;
    decision: ModelQualificationDecision;
    diagnostics: Pick<
      ModelQualificationDiagnostics,
      "convergence_status" | "drift_score" | "ood_rate" | "sensitivity_max_delta"
    > & { holdout_leakage_count: number };
    explanation: readonly string[];
    model_family: ModelQualificationModelCatalogEntry["model_family"];
    model_version: string;
    qualification_id: string;
    review_status: ModelQualificationReviewStatus;
    source: {
      freshness_status: ModelQualificationFreshnessStatus;
      rights_status: ModelQualificationRightsStatus;
      source_version: string;
      title: string;
    };
  };
  requalification?: {
    historical_non_overwrite: true;
    known_limits: readonly string[];
    resolution: ModelQualificationRequalificationResolution;
    review_status: ModelQualificationRequalificationReviewStatus;
    status: ModelQualificationRequalificationStatus;
  };
  security: {
    activity: string;
    course: string;
    role: string;
    tenant: string;
  };
  visibility: "ROLE_SAFE_STUDENT";
}
