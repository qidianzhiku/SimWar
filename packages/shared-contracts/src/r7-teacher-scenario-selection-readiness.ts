export const R7_TEACHER_SCENARIO_SELECTION_READINESS_OPERATION_ID =
  "R7_TEACHER_SCENARIO_SELECTION_READINESS_GET_V1" as const;

export const R7_TEACHER_SCENARIO_SELECTION_READINESS_PATH =
  "/api/v1/bff/teacher/runs/{runId}/scenario-selection-readiness" as const;

export const R7_TEACHER_SCENARIO_SELECTION_READINESS_EXPLICIT_NON_PROOFS = [
  "SCENARIO_RUNTIME_NOT_ACTIVATED",
  "PARAMETERSET_NOT_MUTATED",
  "REPLAY_NOT_EXECUTED",
  "SETTLEMENT_NOT_EXECUTED",
  "ENDPOINT_RESPONSE_NOT_FORMAL_TRUTH"
] as const;

export interface R7TeacherScenarioSelectionReadinessDto {
  calibration_status: string;
  compatibility_status: string;
  course_id: string;
  eligible: boolean;
  evidence_freshness: {
    collected_at: string | null;
    expires_at: string | null;
    is_expired: boolean;
  };
  explicit_non_proofs: typeof R7_TEACHER_SCENARIO_SELECTION_READINESS_EXPLICIT_NON_PROOFS;
  license_status: string;
  no_go_reasons: string[];
  operation_id: typeof R7_TEACHER_SCENARIO_SELECTION_READINESS_OPERATION_ID;
  parameter_set_id: string;
  provenance_status: string;
  qa_status: string;
  readiness_status: "BLOCKED" | "READY";
  run_id: string;
  runtime_adapter_status: string;
  scenario_package_id: string;
  tenant_id: string;
}

export interface R7TeacherScenarioSelectionReadinessContract {
  direct_store_access: false;
  frontend_direct_internal_settle_route: false;
  method: "GET";
  official_parameter_set_write: false;
  official_scenario_binding_write: false;
  operation_id: typeof R7_TEACHER_SCENARIO_SELECTION_READINESS_OPERATION_ID;
  path: typeof R7_TEACHER_SCENARIO_SELECTION_READINESS_PATH;
  reads_runtime_store_through_repository_facade: true;
  replay_hash_semantics_changed: false;
  runtime_activation: false;
  settlement_result_write: false;
  student_visibility_expansion: false;
  teacher_authority_required: true;
}

export function createR7TeacherScenarioSelectionReadinessContract(): R7TeacherScenarioSelectionReadinessContract {
  return {
    direct_store_access: false,
    frontend_direct_internal_settle_route: false,
    method: "GET",
    official_parameter_set_write: false,
    official_scenario_binding_write: false,
    operation_id: R7_TEACHER_SCENARIO_SELECTION_READINESS_OPERATION_ID,
    path: R7_TEACHER_SCENARIO_SELECTION_READINESS_PATH,
    reads_runtime_store_through_repository_facade: true,
    replay_hash_semantics_changed: false,
    runtime_activation: false,
    settlement_result_write: false,
    student_visibility_expansion: false,
    teacher_authority_required: true
  };
}
