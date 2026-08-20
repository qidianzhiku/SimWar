import type { ActorRole } from "./index.js";
import type { ParameterSetReference } from "./parameter-set-authority.js";
import type { ScenarioPackageReference } from "./scenario-package-authority.js";

export const W5_GOVERNED_MODEL_SCHEMA_VERSION = "w5-governed-model.v1" as const;
export const W5_MODEL_VERSION_REF = "eldercare_w5_governed_v1@1.0.0" as const;

export type W5DraftStatus = "DRAFT" | "VALIDATED" | "FROZEN" | "BOUND";
export type W5ExperienceProfile = "STANDARD" | "ADVANCED";
export type W5DataClassification = "REALITY" | "SYNTHETIC" | "ASSUMPTION" | "STRESS_TEST";
export type W5MappingReadiness = "READY" | "DRAFT";
export type W5SecurityStatus = "PASS" | "N/A" | "LIMIT";
export type W5SecurityDimension =
  | "actor"
  | "tenant"
  | "course"
  | "run"
  | "round"
  | "team"
  | "role"
  | "activity";

export interface W5SecurityDimensionEvidence {
  dimension: W5SecurityDimension;
  enforcement_point: string;
  evidence_ref: string;
  negative_test: string;
  status: W5SecurityStatus;
  value: number | string | null;
}

export interface W5SecurityContext {
  activity: string;
  actor: string;
  course: string;
  dimensions: readonly W5SecurityDimensionEvidence[];
  role: ActorRole;
  round: number | null;
  run: string | null;
  team: string | null;
  tenant: string;
}

export interface W5ParameterDescriptor {
  consumer: string;
  default: boolean | number | string;
  key: string;
  label: string;
  mapping_readiness: W5MappingReadiness;
  range?: { max: number; min: number };
  source: string;
  type: "boolean" | "enum" | "number" | "string";
  unit: string;
  visibility: "advanced" | "standard" | "teacher";
}

export interface W5FeatureOwnership {
  economic_meaning: string;
  feature_id: string;
  primary_producer: string;
  source_ref: string;
  unit: string;
  visibility: "approved_view" | "internal" | "shadow";
}

export interface W5ModelVersion {
  approved_at: string;
  engine_reference: { engine_id: string; version: string };
  feature_ownership: readonly W5FeatureOwnership[];
  fallback: {
    deterministic_plane: "CORE_ELDERCARE_V1";
    mode: "PLANE_OFF";
    official_path_continues: true;
  };
  model_family: "eldercare_core_model_v1";
  model_version_ref: typeof W5_MODEL_VERSION_REF;
  no_implicit_latest: true;
  status: "APPROVED";
  visibility: {
    advanced: readonly string[];
    standard: readonly string[];
    teacher: readonly string[];
  };
}

export interface W5ExactRuntimeBinding {
  binding_digest: string;
  binding_id: string;
  course_id: string;
  model_version_ref: typeof W5_MODEL_VERSION_REF;
  no_implicit_latest: true;
  parameter_set_reference: ParameterSetReference;
  round_no: number;
  run_id: string;
  scenario_package_reference: ScenarioPackageReference;
  seed: number;
  status: "BOUND";
  tenant_id: string;
}

export interface W5ScenarioDraft {
  course_id: string;
  created_by: string;
  data_classification: W5DataClassification;
  draft_id: string;
  exact_runtime_binding: W5ExactRuntimeBinding | null;
  model_version_ref: typeof W5_MODEL_VERSION_REF;
  parameter_descriptors: readonly W5ParameterDescriptor[];
  parameter_values: Readonly<Record<string, boolean | number | string>>;
  seed: number;
  status: W5DraftStatus;
  tenant_id: string;
  title: string;
  updated_at: string;
}

export interface W5MutationReceipt {
  action: "bind" | "create_draft" | "freeze" | "validate";
  authority: "W5_MODEL_GOVERNANCE_PLANE";
  receipt_id: string;
  security: W5SecurityContext;
  writes_formal_truth: false;
}

export interface W5ConvergenceProjection {
  can: {
    constraints: readonly string[];
    eligible: boolean;
    official: false;
    source_plane: "CAPACITY_WORKFORCE_QUALITY_ELIGIBILITY";
  };
  experience_profile: W5ExperienceProfile;
  fallback: {
    applied: boolean;
    official_path_continues: true;
    plane: "PLANE_OFF" | "ON";
  };
  known_limits: readonly string[];
  model_version_ref: typeof W5_MODEL_VERSION_REF;
  provenance: {
    data_classification: W5DataClassification;
    exact_binding_digest: string | null;
    model_version_ref: typeof W5_MODEL_VERSION_REF;
    parameter_set_reference: ParameterSetReference | null;
    scenario_package_reference: ScenarioPackageReference | null;
    seed: number;
  };
  realized: {
    authority: "SIMULATION_CORE";
    official: true;
    replay_relevant_digest: string;
    writes_formal_result: false;
  };
  replay: {
    differential: "NON_OFFICIAL";
    exact_identity: "READY" | "NOT_BOUND";
    replay_writes_official_results: false;
  };
  security: W5SecurityContext;
  shadow: {
    non_official: true;
    overwrites_official_result: false;
    plane: "SYSTEM_DYNAMICS";
  };
  want: {
    candidate_value: number;
    official: false;
    source_plane: "BLP_RCNL_LANCaster_IDEAL_POINT";
  };
}

export interface W5GovernedModelTeacherProjection {
  known_limits: readonly string[];
  model_version: W5ModelVersion;
  operation_id: "W5_TEACHER_GOVERNED_MODEL_STUDIO_GET_V1";
  parameter_descriptors: readonly W5ParameterDescriptor[];
  drafts: readonly W5ScenarioDraft[];
  security: W5SecurityContext;
}

export interface W5GovernedModelStudentProjection {
  convergence: Pick<W5ConvergenceProjection, "can" | "experience_profile" | "fallback" | "known_limits" | "realized" | "replay" | "shadow" | "want"> & {
    model_version_ref: typeof W5_MODEL_VERSION_REF;
  };
  operation_id: "W5_STUDENT_GOVERNED_MODEL_PROJECTION_GET_V1";
  security: W5SecurityContext;
  visibility: "ROLE_SAFE_STUDENT";
}
