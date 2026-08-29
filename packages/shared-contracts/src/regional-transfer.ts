import type { CourseBlueprintReference } from "./index.js";
import type { ParameterSetReference } from "./parameter-set-authority.js";
import type { ScenarioPackageReference } from "./scenario-package-authority.js";

export const REGIONAL_TRANSFER_SCHEMA_VERSION = "regional-transfer.v1" as const;

export const REGIONAL_TRANSFER_OPERATION_IDS = {
  admin: "REGIONAL_TRANSFER_ADMIN_AUDIT_GET_V1",
  bind: "REGIONAL_TRANSFER_BIND_V1",
  freeze: "REGIONAL_TRANSFER_FREEZE_V1",
  list: "REGIONAL_TRANSFER_TEACHER_LIST_V1",
  preview: "REGIONAL_TRANSFER_PREVIEW_V1",
  student: "REGIONAL_TRANSFER_STUDENT_PROJECTION_GET_V1",
  validate: "REGIONAL_TRANSFER_VALIDATE_V1"
} as const;

export type RegionalTransferLifecycle = "PREVIEWED" | "VALIDATED" | "FROZEN" | "ACTIVATED";

export type RegionalTransferFailureCode =
  | "RT_CANDIDATE_NOT_FOUND"
  | "RT_EXACT_BINDING_REQUIRED"
  | "RT_EXACT_VERSION_REQUIRED"
  | "RT_INPUT_INVALID"
  | "RT_INVALID_TRANSITION"
  | "RT_NOT_PUBLISHED"
  | "RT_PACKAGE_DIGEST_MISMATCH"
  | "RT_PACKAGE_NOT_FOUND"
  | "RT_MULTI_TEAM_CONSUMPTION_REQUIRED"
  | "RT_SCOPE_CONFLICT"
  | "RT_SOURCE_NOT_BINDABLE";

export interface RegionalTransferPackageReference {
  digest: string;
  package_id: string;
  version: string;
}

export interface RegionalTransferCandidateInput {
  baseline_package_reference: RegionalTransferPackageReference;
  baseline_region: string;
  course_blueprint_reference: CourseBlueprintReference;
  course_id: string;
  parameter_set_reference: ParameterSetReference;
  round_no: number;
  run_id: string;
  scenario_package_reference: ScenarioPackageReference;
  target_package_reference: RegionalTransferPackageReference;
  target_region: string;
}

export interface RegionalTransferCandidateRef {
  candidate_id: string;
  content_digest: string;
  tenant_id: string;
  version: string;
}

export interface RegionalTransferConsumerScope {
  minimum_team_count: 2;
  run_id: string;
  status: "SHARED_GOVERNED_SCENARIO";
  team_ids: readonly string[];
}

export interface RegionalTransferCandidate {
  activation: {
    published: boolean;
    status: "ACTIVATED" | "NOT_ACTIVATED";
  };
  authority: {
    formal_writer_mutations: 0;
    official_truth_write: false;
    provider: "OFF";
    runtime_authority: "JSON_INTERNAL_ONLY";
    settlement_write: false;
  };
  baseline: {
    package_reference: RegionalTransferPackageReference;
    region: string;
  };
  candidate_ref: RegionalTransferCandidateRef;
  consumer_scope: RegionalTransferConsumerScope;
  diff: {
    changes: readonly {
      field: "region" | "package" | "qualification";
      from: string;
      to: string;
    }[];
    status: "DIFF_RECORDED";
  };
  formal_references: {
    course_blueprint_reference: CourseBlueprintReference;
    parameter_set_reference: ParameterSetReference;
    scenario_package_reference: ScenarioPackageReference;
  };
  impact: {
    affected_consumers: readonly ["TSS", "Course", "Run", "Student", "Admin"];
    requalification_required: true;
    rollback_candidate: true;
  };
  known_limits: readonly string[];
  lifecycle: RegionalTransferLifecycle;
  provenance: {
    current_source_readback: "EXACT_SOURCE_READBACK_REQUIRED";
    support_packs: {
      m4_pack_digest: string;
      m4_source_revision: string;
      m5_pack_digest: string;
      m5_source_revision: string;
      m6_pack_digest: string;
      m6_source_revision: string;
    };
  };
  qualification: {
    calibration_eligible: false;
    rights_status: "PUBLIC_SAFE";
    status: "READY_WITH_LIMITS";
    source_status: "REFERENCE_ONLY_WITH_SYNTHETIC_FALLBACK";
  };
  rollback: {
    candidate_version: string;
    dry_run: true;
    executed: false;
    resolution: "SAFE_DRY_RUN_CANDIDATE";
    rollback_version: string;
    version_guard: "EXACT_VERSION_REQUIRED";
  };
  schema_version: typeof REGIONAL_TRANSFER_SCHEMA_VERSION;
  scope: {
    course_id: string;
    round_no: number;
    run_id: string;
    tenant_id: string;
  };
  target: {
    package_reference: RegionalTransferPackageReference;
    region: string;
  };
}

export interface RegionalTransferTeacherProjection extends RegionalTransferCandidate {
  operation_id: typeof REGIONAL_TRANSFER_OPERATION_IDS.preview;
}

export interface RegionalTransferStudentProjection {
  activation: { published: true; status: "ACTIVATED" };
  authority: { official_truth_write: false; settlement_write: false };
  context: {
    course_id: string;
    round_no: number;
    run_id: string;
    target_region: string;
  };
  known_limits: readonly string[];
  operation_id: typeof REGIONAL_TRANSFER_OPERATION_IDS.student;
  status: "ACTIVATED";
  visibility: "ROLE_SAFE_STUDENT";
}

export interface RegionalTransferAdminProjection {
  audit: {
    candidate_id: string;
    lifecycle: readonly RegionalTransferLifecycle[];
    tenant_id: string;
  };
  candidate: RegionalTransferCandidate;
  operation_id: typeof REGIONAL_TRANSFER_OPERATION_IDS.admin;
  rollback: RegionalTransferCandidate["rollback"];
  visibility: "TENANT_SAFE_ADMIN";
}
