import type { ModelArtifactReference, ModelVersionReference } from "./model-governance.js";

export const INDUSTRY_MODEL_DIAGNOSTIC_SCHEMA_VERSION =
  "industry-model-diagnostic-readiness.v1" as const;

export type IndustryDiagnosticClassification =
  | "WANT_EVIDENCE"
  | "CAN_EVIDENCE"
  | "REALIZED_REFERENCE"
  | "NOT_PROVEN";

export type IndustryDiagnosticReadinessStatus =
  | "READY"
  | "READY_WITH_LIMITS"
  | "BLOCKED"
  | "REBASE_REQUIRED";

export type IndustryQualifiedProducerAdmissionStatus =
  | "QUALIFICATION_COMPATIBLE"
  | "QUALIFICATION_NOT_PROVEN"
  | "REBASE_REQUIRED";

export interface IndustryDiagnosticContextDto {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly run_id: string;
  readonly team_id: string;
  readonly round_id: string;
  readonly scenario_package_id: string;
  readonly parameter_set_id: string;
}

export interface IndustryDiagnosticProvabilityDto {
  readonly producer_id: string;
  readonly diagnostic_family: string;
  readonly classification: IndustryDiagnosticClassification;
  readonly evidence_identity: string;
  readonly authority_owner: string;
  readonly source: { readonly path: string; readonly symbol: string };
  readonly freshness: "FRESH" | "STALE" | "UNKNOWN";
  /** Producer-owned intrinsic lineage; qualification membership remains a
   * separate consumer admission decision. This field is never emitted in the
   * Student projection. */
  readonly producer_model_version_reference?: ModelVersionReference;
  readonly producer_model_artifact_reference?: ModelArtifactReference;
  readonly known_limits?: readonly string[];
}

export interface IndustryQualifiedProducerAdmissionDto {
  readonly producer_id: string;
  readonly status: IndustryQualifiedProducerAdmissionStatus;
  readonly admission_digest: string;
  readonly known_limits: readonly string[];
}

export interface IndustryDiagnosticStudentSummaryDto {
  readonly visibility: "ROLE_SAFE_STUDENT";
  readonly readiness_class: IndustryDiagnosticReadinessStatus;
  readonly evidence_classes: readonly IndustryDiagnosticClassification[];
  readonly qualified_producer_admission_statuses?: readonly IndustryQualifiedProducerAdmissionStatus[];
  readonly known_limits: readonly string[];
}

export interface IndustryModelDiagnosticReadinessDto {
  readonly schema_version: typeof INDUSTRY_MODEL_DIAGNOSTIC_SCHEMA_VERSION;
  readonly operation_id:
    | "INDUSTRY_MODEL_DIAGNOSTIC_TEACHER_GET_V1"
    | "INDUSTRY_MODEL_DIAGNOSTIC_ADMIN_GET_V1"
    | "INDUSTRY_MODEL_DIAGNOSTIC_STUDENT_GET_V1";
  readonly role: "teacher" | "admin" | "student";
  readonly readiness_status: IndustryDiagnosticReadinessStatus;
  readonly rebase_required: boolean;
  readonly exact_context: IndustryDiagnosticContextDto;
  readonly model_version_reference?: ModelVersionReference;
  readonly model_artifact_reference?: ModelArtifactReference;
  readonly qualification?: {
    readonly qualification_id: string;
    readonly qualification_digest: string;
    readonly decision: "APPROVED" | "REJECTED" | "NOT_ELIGIBLE";
    readonly review_status: "APPROVED" | "PENDING" | "REJECTED";
    readonly binding_status: "BOUND" | "UNBOUND";
  };
  readonly adoption?: { readonly adoption_id: string; readonly adoption_digest: string } | null;
  readonly diagnostic_evidence_digest?: string;
  readonly interpretation_policy_digest?: string;
  readonly provability?: readonly IndustryDiagnosticProvabilityDto[];
  readonly qualified_producer_admission?: readonly IndustryQualifiedProducerAdmissionDto[];
  readonly student_summary?: IndustryDiagnosticStudentSummaryDto;
  readonly known_limits: readonly string[];
  readonly provider: "OFF";
  readonly official_truth_write: false;
  readonly readiness_digest: string;
}
