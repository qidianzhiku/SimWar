import type {
  RoleKey,
  W4CapitalAction,
  W4CounterfactualRoundEvidence,
  W4DecisionPayloadBinding,
  W4StateRef
} from "./index.js";

export const M4_MULTIPATH_COUNTERFACTUAL_TRANSFER_SCHEMA_VERSION =
  "m4-multipath-counterfactual-transfer.v1" as const;

export type M4MultipathSurface = "student" | "teacher";
export type M4Officiality = "OFFICIAL" | "NON_OFFICIAL";

export interface M4CounterfactualPathInput {
  path_id: string;
  label: string;
  decision_ids: string[];
}

export interface M4MultipathCounterfactualInput {
  source_state_ref: W4StateRef;
  source_outcome_id: string;
  paths: M4CounterfactualPathInput[];
  horizon_rounds: number;
  scenario_package_id: string;
  parameter_set_id: string;
  engine_id: string;
  plugin_ids: string[];
  seed: number;
}

export interface M4OfficialPathProjection {
  officiality: "OFFICIAL";
  unchanged: true;
  outcome_id: string;
  opening_state_ref: W4StateRef;
  closing_state_ref: W4StateRef;
  decision_ids: string[];
  replay_writes_formal_results: false;
}

export interface M4MechanismDifferential {
  changed_paths: string[];
  changed_path_count: number;
  interpretation: "DETERMINISTIC_STATE_TRANSITION_DIFFERENTIAL";
}

export interface M4OutcomeDifferential {
  baseline: "OFFICIAL_SOURCE_CLOSING_STATE";
  cash_delta: number;
  capacity_delta: number;
  product_line_count_delta: number;
  operating_unit_count_delta: number;
  project_count_delta: number;
  facility_count_delta: number;
  terminal_state_ref: W4StateRef;
  terminal_state_digest: string;
}

export interface M4TeacherPathProjection {
  path_id: string;
  label: string;
  officiality: "NON_OFFICIAL";
  decision_ids: string[];
  decision_payload_bindings: W4DecisionPayloadBinding[];
  capital_actions: W4CapitalAction[];
  path_digest: string;
  rounds: W4CounterfactualRoundEvidence[];
  mechanism_differential: M4MechanismDifferential;
  outcome_differential: M4OutcomeDifferential;
}

export interface M4StudentPathProjection {
  path_id: string;
  label: string;
  officiality: "NON_OFFICIAL";
  decision_ids: string[];
  path_digest: string;
  mechanism_differential: M4MechanismDifferential;
  outcome_differential: M4OutcomeDifferential;
}

export interface M4RoleLineageProjection {
  source_round_id: string;
  source_section_ids: string[];
  merge_commit_id?: string;
  resolution_id?: string;
  preserved_dissent_role_keys: RoleKey[];
  resolution_status: "NOT_PRESENT" | "PROPOSED";
  history_event_types: string[];
  historical_decision_reentry_blocked: true;
}

export interface M4TeacherDebriefProjection {
  available: true;
  learning_points: string[];
  exact_next_opening_state_ref?: W4StateRef;
  apply_to_next_round: false;
}

export interface M4StudentTransferProjection {
  role_safe: true;
  visible_path_ids: string[];
  explanation: string;
  excluded_fields: string[];
}

export interface M4MultipathInvariantProjection {
  official_decision_writes: false;
  official_settlement_writes: false;
  official_state_writes: false;
  apply_to_next_round: false;
  replay_writes_formal_results: false;
}

interface M4MultipathCounterfactualResponseBase {
  schema_version: typeof M4_MULTIPATH_COUNTERFACTUAL_TRANSFER_SCHEMA_VERSION;
  runtime_authority: "JSON_INTERNAL_ONLY";
  exact_binding: {
    source_state_ref: W4StateRef;
    source_outcome_id: string;
    horizon_rounds: number;
    scenario_package_id: string;
    parameter_set_id: string;
    engine_id: string;
    plugin_ids: string[];
    seed: number;
  };
  official_path: M4OfficialPathProjection;
  lineage: M4RoleLineageProjection;
  teacher_debrief: M4TeacherDebriefProjection;
  student_transfer: M4StudentTransferProjection;
  transfer: {
    status: "READY";
    apply_to_next_round: false;
    source_official_state_ref: W4StateRef;
  };
  invariants: M4MultipathInvariantProjection;
  known_limits: string[];
}

export interface M4TeacherSafeCounterfactualResponse
  extends M4MultipathCounterfactualResponseBase {
  visibility: "teacher_safe";
  paths: M4TeacherPathProjection[];
}

export interface M4StudentSafeCounterfactualResponse
  extends M4MultipathCounterfactualResponseBase {
  visibility: "student_safe";
  paths: M4StudentPathProjection[];
}

export type M4MultipathCounterfactualResponse =
  | M4TeacherSafeCounterfactualResponse
  | M4StudentSafeCounterfactualResponse;
