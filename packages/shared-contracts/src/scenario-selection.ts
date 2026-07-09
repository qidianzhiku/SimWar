import {
  createR7ScenarioParameterShadowReplayAlignmentPackage,
  R7_SCENARIO_ALIGNMENT_SOURCE_MASTER_SHA,
  type R7ScenarioParameterShadowReplayAlignmentPackage
} from "./scenario-alignment.js";

export const R7_TEACHER_SCENARIO_SELECTION_SOURCE_MASTER_SHA =
  "f51d49cf736bef1e3645b6b56f85c41c12d9872e" as const;

export const R7_TEACHER_SCENARIO_SELECTION_EXPLICIT_NON_PROOFS = [
  "Teacher selection DTO boundary != runtime BFF route",
  "Teacher selection DTO boundary != Scenario Factory runtime",
  "Teacher selection DTO boundary != official Scenario binding",
  "Teacher selection DTO boundary != official ParameterSet write",
  "Teacher selection DTO boundary != Shadow Replay execution",
  "Teacher selection DTO boundary != R8-G1 release",
  "Teacher selection DTO boundary != Teacher rehearsal",
  "Teacher selection DTO boundary != Pilot readiness",
  "Teacher selection DTO boundary != Production readiness"
] as const;

export type R7TeacherScenarioSelectionExplicitNonProof =
  (typeof R7_TEACHER_SCENARIO_SELECTION_EXPLICIT_NON_PROOFS)[number];

export type R7TeacherScenarioSelectionAllowedAction =
  | "preview_alignment_matrix"
  | "compare_internal_seed_references"
  | "request_owner_parameter_review";

export type R7TeacherScenarioSelectionForbiddenAction =
  | "write_state_true"
  | "write_settlement_result"
  | "publish_runtime_scenario"
  | "modify_official_parameter_set"
  | "execute_shadow_replay"
  | "overwrite_official_replay_result";

export type R7TeacherScenarioSelectionForbiddenField =
  | "state_true"
  | "SettlementResult"
  | "truth_hash"
  | "replay_hash"
  | "manifest_hash"
  | "canonical_evidence_digest"
  | "private_parameter_set"
  | "private_shadow_replay_trace"
  | "official_parameter_set";

export interface R7TeacherScenarioSelectionDto {
  actor_role: "teacher";
  allowed_actions: readonly R7TeacherScenarioSelectionAllowedAction[];
  course_id_required: true;
  explicit_non_proof: "dto_boundary_only";
  forbidden_actions: readonly R7TeacherScenarioSelectionForbiddenAction[];
  forbidden_fields: readonly R7TeacherScenarioSelectionForbiddenField[];
  parameter_set_id_required: true;
  plugin_package_id_required: true;
  redacted_fields: readonly [
    "private_parameter_set",
    "private_shadow_replay_trace",
    "official_parameter_set"
  ];
  run_id_required: true;
  scenario_package_id_required: true;
  source_runtime_path: "NOT_BOUND_TO_RUNTIME_ROUTE";
  tenant_id_required: true;
  visible_state: {
    compatibility_summary: "REFERENCE_ONLY";
    selection_status: "INTERNAL_BOUNDARY_DRAFT";
    shadow_replay_summary: "REFERENCE_ONLY_NON_EXECUTING";
  };
}

export interface R7TeacherScenarioSelectionQueryContract {
  direct_store_access: false;
  reads_runtime_store: false;
  required_scope: readonly ["tenant_id", "course_id", "run_id"];
  source_runtime_path: "NOT_BOUND_TO_RUNTIME_ROUTE";
}

export interface R7TeacherScenarioSelectionCommandContract {
  allowed_future_runtime_gate: "OWNER_AUTHORIZED_TEACHER_SELECTION_RUNTIME_ROUTE";
  command_status: "DRAFT_CONTRACT_ONLY";
  executes_shadow_replay: false;
  writes_official_parameter_set: false;
  writes_official_scenario_binding: false;
}

export interface R7TeacherScenarioSelectionAdvisorySlots {
  advisory_only: true;
  ai_writes_formal_truth: false;
  coach_output_reference: "COACH_OUTPUT_REFERENCE_ONLY";
  model_call_log_reference: "MODEL_CALL_LOG_REFERENCE_ONLY";
}

export interface R7TeacherScenarioSelectionGuardBoundary {
  direct_store_access: false;
  frontend_direct_internal_settle_route: false;
  frontend_ui_enabled: false;
  manifest_hash_semantics_changed: false;
  official_parameter_set_write: false;
  official_scenario_binding_write: false;
  replay_hash_semantics_changed: false;
  runtime_route_enabled: false;
  settlement_result_write: false;
  shadow_replay_executes: false;
  shadow_replay_overwrites_official_result: false;
  state_true_exposure: false;
  student_visibility_expansion: false;
  teacher_bff_endpoint_enabled: false;
}

export interface R7TeacherScenarioSelectionRuntimeAuthorization {
  ai_runtime: "NOT_AUTHORIZED";
  durable_settlement: "NOT_PROVEN";
  pilot: "NOT_AUTHORIZED";
  plugin_runtime: "NOT_AUTHORIZED";
  postgresql_runtime: "NOT_AUTHORIZED";
  production: "NOT_AUTHORIZED";
  scenario_factory_runtime_route: "NOT_AUTHORIZED";
  shadow_replay_runtime: "NOT_AUTHORIZED";
  teacher_bff_runtime_route: "NOT_AUTHORIZED";
}

export interface R7TeacherScenarioSelectionBoundaryPackage {
  advisory_slots: R7TeacherScenarioSelectionAdvisorySlots;
  alignment_reference: {
    evidence_version: "r7-scenario-parameterset-shadow-replay-alignment.v1";
    source_master_sha: typeof R7_SCENARIO_ALIGNMENT_SOURCE_MASTER_SHA;
    status: "ALIGNMENT_PACKAGE_MERGED_AND_POSTMERGE_VALIDATED";
  };
  boundary: R7TeacherScenarioSelectionGuardBoundary;
  command_contract: R7TeacherScenarioSelectionCommandContract;
  direct_store_delta: "NONE";
  docs: readonly [
    "docs/architecture/r7-teacher-scenario-selection-bff-dto-boundary.md",
    "docs/quality/r7-teacher-scenario-selection-compatibility-matrix.md",
    "docs/quality/r7-scenario-evidence-ledger.md",
    "docs/operations/r7-teacher-scenario-selection-boundary.md"
  ];
  evidence_kind: "r7_teacher_scenario_selection_bff_dto_boundary";
  evidence_version: "r7-teacher-scenario-selection-bff-dto-boundary.v1";
  explicit_non_proofs: typeof R7_TEACHER_SCENARIO_SELECTION_EXPLICIT_NON_PROOFS;
  g0_pass: "NOT_GRANTED";
  g0_status: "EXCEPTION";
  l1_status: "NOT_READY";
  query_contract: R7TeacherScenarioSelectionQueryContract;
  r8_g1_status: "INTERNAL_ONLY_DRAFT_NOT_RELEASED";
  runtime_authorization: R7TeacherScenarioSelectionRuntimeAuthorization;
  source_master_sha: typeof R7_TEACHER_SCENARIO_SELECTION_SOURCE_MASTER_SHA;
  status: "BOUNDARY_PACKAGE_ONLY";
  teacher_selection_dto: R7TeacherScenarioSelectionDto;
}

export interface R7TeacherScenarioSelectionValidationResult {
  issues: string[];
  ok: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireCondition(issues: string[], condition: boolean, issue: string): void {
  if (!condition) {
    issues.push(issue);
  }
}

export function createR7TeacherScenarioSelectionBoundaryPackage(
  alignmentPackage: R7ScenarioParameterShadowReplayAlignmentPackage = createR7ScenarioParameterShadowReplayAlignmentPackage()
): R7TeacherScenarioSelectionBoundaryPackage {
  return {
    advisory_slots: {
      advisory_only: true,
      ai_writes_formal_truth: false,
      coach_output_reference: "COACH_OUTPUT_REFERENCE_ONLY",
      model_call_log_reference: "MODEL_CALL_LOG_REFERENCE_ONLY"
    },
    alignment_reference: {
      evidence_version: alignmentPackage.evidence_version,
      source_master_sha: alignmentPackage.source_master_sha,
      status: "ALIGNMENT_PACKAGE_MERGED_AND_POSTMERGE_VALIDATED"
    },
    boundary: {
      direct_store_access: false,
      frontend_direct_internal_settle_route: false,
      frontend_ui_enabled: false,
      manifest_hash_semantics_changed: false,
      official_parameter_set_write: false,
      official_scenario_binding_write: false,
      replay_hash_semantics_changed: false,
      runtime_route_enabled: false,
      settlement_result_write: false,
      shadow_replay_executes: false,
      shadow_replay_overwrites_official_result: false,
      state_true_exposure: false,
      student_visibility_expansion: false,
      teacher_bff_endpoint_enabled: false
    },
    command_contract: {
      allowed_future_runtime_gate: "OWNER_AUTHORIZED_TEACHER_SELECTION_RUNTIME_ROUTE",
      command_status: "DRAFT_CONTRACT_ONLY",
      executes_shadow_replay: false,
      writes_official_parameter_set: false,
      writes_official_scenario_binding: false
    },
    direct_store_delta: "NONE",
    docs: [
      "docs/architecture/r7-teacher-scenario-selection-bff-dto-boundary.md",
      "docs/quality/r7-teacher-scenario-selection-compatibility-matrix.md",
      "docs/quality/r7-scenario-evidence-ledger.md",
      "docs/operations/r7-teacher-scenario-selection-boundary.md"
    ],
    evidence_kind: "r7_teacher_scenario_selection_bff_dto_boundary",
    evidence_version: "r7-teacher-scenario-selection-bff-dto-boundary.v1",
    explicit_non_proofs: R7_TEACHER_SCENARIO_SELECTION_EXPLICIT_NON_PROOFS,
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    l1_status: "NOT_READY",
    query_contract: {
      direct_store_access: false,
      reads_runtime_store: false,
      required_scope: ["tenant_id", "course_id", "run_id"],
      source_runtime_path: "NOT_BOUND_TO_RUNTIME_ROUTE"
    },
    r8_g1_status: "INTERNAL_ONLY_DRAFT_NOT_RELEASED",
    runtime_authorization: {
      ai_runtime: "NOT_AUTHORIZED",
      durable_settlement: "NOT_PROVEN",
      pilot: "NOT_AUTHORIZED",
      plugin_runtime: "NOT_AUTHORIZED",
      postgresql_runtime: "NOT_AUTHORIZED",
      production: "NOT_AUTHORIZED",
      scenario_factory_runtime_route: "NOT_AUTHORIZED",
      shadow_replay_runtime: "NOT_AUTHORIZED",
      teacher_bff_runtime_route: "NOT_AUTHORIZED"
    },
    source_master_sha: R7_TEACHER_SCENARIO_SELECTION_SOURCE_MASTER_SHA,
    status: "BOUNDARY_PACKAGE_ONLY",
    teacher_selection_dto: {
      actor_role: "teacher",
      allowed_actions: [
        "preview_alignment_matrix",
        "compare_internal_seed_references",
        "request_owner_parameter_review"
      ],
      course_id_required: true,
      explicit_non_proof: "dto_boundary_only",
      forbidden_actions: [
        "write_state_true",
        "write_settlement_result",
        "publish_runtime_scenario",
        "modify_official_parameter_set",
        "execute_shadow_replay",
        "overwrite_official_replay_result"
      ],
      forbidden_fields: [
        "state_true",
        "SettlementResult",
        "truth_hash",
        "replay_hash",
        "manifest_hash",
        "canonical_evidence_digest",
        "private_parameter_set",
        "private_shadow_replay_trace",
        "official_parameter_set"
      ],
      parameter_set_id_required: true,
      plugin_package_id_required: true,
      redacted_fields: [
        "private_parameter_set",
        "private_shadow_replay_trace",
        "official_parameter_set"
      ],
      run_id_required: true,
      scenario_package_id_required: true,
      source_runtime_path: "NOT_BOUND_TO_RUNTIME_ROUTE",
      tenant_id_required: true,
      visible_state: {
        compatibility_summary: "REFERENCE_ONLY",
        selection_status: "INTERNAL_BOUNDARY_DRAFT",
        shadow_replay_summary: "REFERENCE_ONLY_NON_EXECUTING"
      }
    }
  };
}

export function validateR7TeacherScenarioSelectionBoundaryPackage(
  value: unknown
): R7TeacherScenarioSelectionValidationResult {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return {
      issues: ["R7_TEACHER_SELECTION_PACKAGE_NOT_OBJECT"],
      ok: false
    };
  }

  const candidate = value as Partial<R7TeacherScenarioSelectionBoundaryPackage>;

  requireCondition(
    issues,
    candidate.evidence_kind === "r7_teacher_scenario_selection_bff_dto_boundary",
    "R7_TEACHER_SELECTION_EVIDENCE_KIND_INVALID"
  );
  requireCondition(
    issues,
    candidate.source_master_sha === R7_TEACHER_SCENARIO_SELECTION_SOURCE_MASTER_SHA,
    "R7_TEACHER_SELECTION_SOURCE_MASTER_SHA_INVALID"
  );
  requireCondition(
    issues,
    candidate.alignment_reference?.source_master_sha === R7_SCENARIO_ALIGNMENT_SOURCE_MASTER_SHA &&
      candidate.alignment_reference?.status === "ALIGNMENT_PACKAGE_MERGED_AND_POSTMERGE_VALIDATED",
    "R7_TEACHER_SELECTION_ALIGNMENT_REFERENCE_INVALID"
  );
  requireCondition(
    issues,
    candidate.status === "BOUNDARY_PACKAGE_ONLY" &&
      candidate.g0_status === "EXCEPTION" &&
      candidate.g0_pass === "NOT_GRANTED" &&
      candidate.l1_status === "NOT_READY" &&
      candidate.r8_g1_status === "INTERNAL_ONLY_DRAFT_NOT_RELEASED",
    "R7_TEACHER_SELECTION_STATUS_BOUNDARY_DRIFT"
  );
  requireCondition(
    issues,
    candidate.direct_store_delta === "NONE" &&
      candidate.query_contract?.direct_store_access === false &&
      candidate.boundary?.direct_store_access === false,
    "R7_TEACHER_SELECTION_DIRECT_STORE_DELTA_NOT_ALLOWED"
  );
  requireCondition(
    issues,
    candidate.boundary?.runtime_route_enabled === false &&
      candidate.boundary?.teacher_bff_endpoint_enabled === false &&
      candidate.runtime_authorization?.teacher_bff_runtime_route === "NOT_AUTHORIZED" &&
      candidate.runtime_authorization?.scenario_factory_runtime_route === "NOT_AUTHORIZED",
    "R7_TEACHER_SELECTION_RUNTIME_ROUTE_ENABLED"
  );
  requireCondition(
    issues,
    candidate.boundary?.official_parameter_set_write === false &&
      candidate.command_contract?.writes_official_parameter_set === false,
    "R7_TEACHER_SELECTION_PARAMETERSET_WRITE_DRIFT"
  );
  requireCondition(
    issues,
    candidate.boundary?.shadow_replay_executes === false &&
      candidate.boundary?.shadow_replay_overwrites_official_result === false &&
      candidate.command_contract?.executes_shadow_replay === false &&
      candidate.boundary?.replay_hash_semantics_changed === false &&
      candidate.boundary?.manifest_hash_semantics_changed === false,
    "R7_TEACHER_SELECTION_REPLAY_OVERWRITE_DRIFT"
  );
  requireCondition(
    issues,
    candidate.boundary?.state_true_exposure === false &&
      candidate.boundary?.settlement_result_write === false &&
      candidate.command_contract?.writes_official_scenario_binding === false,
    "R7_TEACHER_SELECTION_TRUTH_AUTHORITY_DRIFT"
  );
  requireCondition(
    issues,
    candidate.boundary?.student_visibility_expansion === false,
    "R7_TEACHER_SELECTION_STUDENT_VISIBILITY_DRIFT"
  );
  requireCondition(
    issues,
    candidate.advisory_slots?.advisory_only === true &&
      candidate.advisory_slots?.ai_writes_formal_truth === false &&
      candidate.runtime_authorization?.ai_runtime === "NOT_AUTHORIZED" &&
      candidate.runtime_authorization?.plugin_runtime === "NOT_AUTHORIZED" &&
      candidate.runtime_authorization?.postgresql_runtime === "NOT_AUTHORIZED" &&
      candidate.runtime_authorization?.durable_settlement === "NOT_PROVEN",
    "R7_TEACHER_SELECTION_RUNTIME_AUTHORIZATION_DRIFT"
  );

  return {
    issues,
    ok: issues.length === 0
  };
}
