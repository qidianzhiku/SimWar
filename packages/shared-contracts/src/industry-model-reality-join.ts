import type { ModelArtifactReference, ModelVersionReference } from "./model-governance.js";
import type {
  IndustryDiagnosticClassification,
  IndustryDiagnosticReadinessStatus
} from "./industry-model-diagnostic.js";

export const INDUSTRY_MODEL_REALITY_JOIN_SCHEMA_VERSION = "industry-model-reality-join.v1" as const;

export type IndustryModelRealityJoinStatus = IndustryDiagnosticReadinessStatus;
export type IndustryModelRealityJoinRecovery =
  | "NONE"
  | "RELOAD_EXACT_CONTEXT"
  | "REAUTHORIZE"
  | "RETRY_EXACT_REQUEST";

export interface IndustryModelRealityJoinContextDto {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly run_id: string;
  readonly team_id: string;
  readonly round_id: string;
  readonly scenario_package_id: string;
  readonly parameter_set_id: string;
}

export interface IndustryModelRealityJoinStudentContextDto {
  readonly course_id: string;
  readonly run_id: string;
  readonly team_id: string;
  readonly round_id: string;
}

export interface IndustryModelRealityJoinBoundSupportEvidenceDto {
  readonly availability: "BOUND";
  readonly applicability_digest: string;
  readonly upstream_pack_digests: {
    readonly m4: string;
    readonly m5: string;
    readonly m29: string;
  };
  readonly portability: {
    readonly status: "PORTABILITY_EVIDENCE_WITH_LIMITS";
    readonly compatibility_status: "COMPATIBLE" | "NON_BREAKING" | "BREAKING";
    readonly external_validity: "NOT_PROVEN";
    readonly package_identity: string;
  };
  readonly holdout: {
    readonly status: "NOT_ELIGIBLE";
    readonly leakage_count: number;
    readonly eligibility: "NOT_ELIGIBLE";
  };
  readonly shanghai: {
    readonly consumption_status: "LOOKAHEAD_READY";
    readonly qualification_status: "LIMITED";
    readonly calibration_evidence: "NOT_PROVEN";
    readonly formal_binding_eligible: false;
  };
}

export interface IndustryModelRealityJoinUnavailableSupportEvidenceDto {
  readonly availability: "UNAVAILABLE";
  readonly reason: "EXACT_SUPPORT_APPLICABILITY_NOT_PROVEN";
  readonly request_context_digest: string;
  readonly upstream_pack_digests: {
    readonly m4: string;
    readonly m5: string;
    readonly m29: string;
  };
}

export type IndustryModelRealityJoinSupportEvidenceDto =
  | IndustryModelRealityJoinBoundSupportEvidenceDto
  | IndustryModelRealityJoinUnavailableSupportEvidenceDto;

export type IndustryModelRealityJoinSupportStatus =
  | "PORTABILITY_EVIDENCE_WITH_LIMITS"
  | "NOT_ELIGIBLE"
  | "LOOKAHEAD_READY"
  | "UNAVAILABLE";

export interface IndustryModelRealityJoinProjectionBase {
  readonly schema_version: typeof INDUSTRY_MODEL_REALITY_JOIN_SCHEMA_VERSION;
  readonly readiness_status: IndustryModelRealityJoinStatus;
  readonly rebase_required: boolean;
  readonly known_limits: readonly string[];
  readonly provider: "OFF";
  readonly official_truth_write: false;
  readonly readiness_digest: string;
}

export type IndustryModelRealityJoinTeacherAdminDto = IndustryModelRealityJoinProjectionBase & {
  readonly operation_id:
    | "INDUSTRY_MODEL_REALITY_JOIN_TEACHER_GET_V1"
    | "INDUSTRY_MODEL_REALITY_JOIN_ADMIN_GET_V1";
  readonly role: "teacher" | "admin";
  readonly exact_context: IndustryModelRealityJoinContextDto;
  readonly model_version_reference: ModelVersionReference;
  readonly model_artifact_reference: ModelArtifactReference;
  readonly qualification: {
    readonly qualification_id: string;
    readonly qualification_digest: string;
    readonly decision: "APPROVED" | "REJECTED" | "NOT_ELIGIBLE";
    readonly review_status: "APPROVED" | "PENDING" | "REJECTED";
    readonly binding_status: "BOUND" | "UNBOUND";
  };
  readonly adoption: { readonly adoption_id: string; readonly adoption_digest: string } | null;
  readonly diagnostic_evidence_digest: string;
  readonly interpretation_policy_digest: string;
  readonly provability: readonly {
    readonly producer_id: string;
    readonly diagnostic_family: string;
    readonly classification: IndustryDiagnosticClassification;
    readonly evidence_identity: string;
    readonly authority_owner: string;
    readonly source: { readonly path: string; readonly symbol: string };
    readonly freshness: "FRESH" | "STALE" | "UNKNOWN";
  }[];
  readonly support_evidence: IndustryModelRealityJoinSupportEvidenceDto;
};

export interface IndustryModelRealityJoinStudentDto extends IndustryModelRealityJoinProjectionBase {
  readonly operation_id: "INDUSTRY_MODEL_REALITY_JOIN_STUDENT_GET_V1";
  readonly role: "student";
  readonly exact_context: IndustryModelRealityJoinStudentContextDto;
  readonly readiness_class: IndustryModelRealityJoinStatus;
  readonly evidence_classes: readonly IndustryDiagnosticClassification[];
  readonly portability_status: IndustryModelRealityJoinSupportStatus;
  readonly holdout_status: IndustryModelRealityJoinSupportStatus;
  readonly shanghai_status: IndustryModelRealityJoinSupportStatus;
  readonly recovery: IndustryModelRealityJoinRecovery;
}

export type IndustryModelRealityJoinDto =
  | IndustryModelRealityJoinTeacherAdminDto
  | IndustryModelRealityJoinStudentDto;
