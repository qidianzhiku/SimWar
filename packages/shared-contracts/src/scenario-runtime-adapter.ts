import {
  createR7TeacherScenarioSelectionBoundaryPackage,
  R7_TEACHER_SCENARIO_SELECTION_SOURCE_MASTER_SHA,
  type R7TeacherScenarioSelectionBoundaryPackage
} from "./scenario-selection.js";

export const R7_RUNTIME_ADAPTER_PREPARATION_SOURCE_MASTER_SHA =
  "9bc3c1dac3491fd6103fb50354bff566b75579ef" as const;

export const R7_RUNTIME_ADAPTER_PREPARATION_EXPLICIT_NON_PROOFS = [
  "Runtime adapter preparation != Scenario runtime activation",
  "Runtime adapter preparation != runtime API route",
  "Runtime adapter preparation != Teacher scenario selection UI",
  "Runtime adapter preparation != official Scenario binding",
  "Runtime adapter preparation != official ParameterSet write",
  "Runtime adapter preparation != Shadow Replay execution",
  "Runtime adapter preparation != Plugin runtime",
  "Runtime adapter preparation != AI advisory runtime",
  "Runtime adapter preparation != R8-G1 release",
  "Runtime adapter preparation != Pilot readiness",
  "Runtime adapter preparation != Production readiness"
] as const;

export const R7_RUNTIME_ADAPTER_PREPARATION_FORBIDDEN_WRITES = [
  "state_true",
  "SettlementResult",
  "truth_hash",
  "replay_hash",
  "manifest_hash",
  "canonical_evidence_digest",
  "official_parameter_set",
  "official_scenario_binding",
  "official_replay_result",
  "plugin_runtime_trace",
  "ai_formal_output"
] as const;

export const R7_RUNTIME_ADAPTER_PREPARATION_NO_GO_REGISTER = [
  "runtime_route_enabled",
  "api_route_enabled",
  "bff_endpoint_enabled",
  "frontend_ui_enabled",
  "scenario_runtime_executes",
  "official_parameter_set_write",
  "official_scenario_binding_write",
  "settlement_result_write",
  "state_true_exposure",
  "replay_executes",
  "shadow_replay_executes",
  "shadow_replay_overwrites_official_result",
  "replay_hash_semantics_changed",
  "manifest_hash_semantics_changed",
  "student_visibility_expansion",
  "io_enabled",
  "network_enabled",
  "database_enabled",
  "postgresql_enabled",
  "service_registration",
  "plugin_runtime_enabled",
  "ai_runtime_enabled",
  "pilot_or_production_enabled"
] as const;

export type R7RuntimeAdapterPreparationExplicitNonProof =
  (typeof R7_RUNTIME_ADAPTER_PREPARATION_EXPLICIT_NON_PROOFS)[number];

export type R7RuntimeAdapterPreparationForbiddenWrite =
  (typeof R7_RUNTIME_ADAPTER_PREPARATION_FORBIDDEN_WRITES)[number];

export type R7RuntimeAdapterPreparationNoGoTrigger =
  (typeof R7_RUNTIME_ADAPTER_PREPARATION_NO_GO_REGISTER)[number];

export interface R7RuntimeAdapterPreparationSelectionReference {
  evidence_version: "r7-teacher-scenario-selection-bff-dto-boundary.v1";
  source_master_sha: typeof R7_TEACHER_SCENARIO_SELECTION_SOURCE_MASTER_SHA;
  status: "TEACHER_SELECTION_BOUNDARY_MERGED_AND_POSTMERGE_VALIDATED";
}

export interface R7RuntimeAdapterPreparationAdapterContract {
  adapter_status: "DRAFT_CONTRACT_ONLY";
  allowed_future_gate: "OWNER_AUTHORIZED_R7_SCENARIO_RUNTIME_ADAPTER";
  input_reference_scope: readonly [
    "tenant_id",
    "course_id",
    "run_id",
    "scenario_package_id",
    "parameter_set_id",
    "plugin_package_id",
    "seed"
  ];
  output_reference_scope: readonly [
    "adapter_readiness",
    "compatibility_guard",
    "no_go_register",
    "explicit_non_proof"
  ];
  source_runtime_path: "NOT_BOUND_TO_RUNTIME_ROUTE";
}

export interface R7RuntimeAdapterPreparationBoundary {
  ai_runtime_enabled: false;
  api_route_enabled: false;
  bff_endpoint_enabled: false;
  database_enabled: false;
  external_source_fetch: false;
  frontend_ui_enabled: false;
  io_enabled: false;
  manifest_hash_semantics_changed: false;
  network_enabled: false;
  official_parameter_set_write: false;
  official_scenario_binding_write: false;
  pilot_or_production_enabled: false;
  plugin_runtime_enabled: false;
  postgresql_enabled: false;
  replay_executes: false;
  replay_hash_semantics_changed: false;
  scenario_runtime_executes: false;
  service_registration: false;
  settlement_result_write: false;
  shadow_replay_executes: false;
  shadow_replay_overwrites_official_result: false;
  state_true_exposure: false;
  student_visibility_expansion: false;
  runtime_route_enabled: false;
}

export interface R7RuntimeAdapterPreparationRuntimeAuthorization {
  ai_runtime: "NOT_AUTHORIZED";
  durable_settlement: "NOT_PROVEN";
  pilot: "NOT_AUTHORIZED";
  plugin_runtime: "NOT_AUTHORIZED";
  postgresql_runtime: "NOT_AUTHORIZED";
  production: "NOT_AUTHORIZED";
  scenario_factory_runtime_route: "NOT_AUTHORIZED";
  scenario_runtime_adapter_route: "NOT_AUTHORIZED";
  shadow_replay_runtime: "NOT_AUTHORIZED";
  teacher_bff_runtime_route: "NOT_AUTHORIZED";
}

export interface R7RuntimeAdapterPreparationAdvisoryBoundary {
  advisory_only: true;
  ai_runtime_call: false;
  ai_writes_formal_truth: false;
  coach_output_reference: "REFERENCE_ONLY";
  model_call_log_reference: "REFERENCE_ONLY";
}

export interface R7RuntimeAdapterPreparationPluginBoundary {
  plugin_package_id_reference_required: true;
  plugin_runtime_enabled: false;
  plugin_trace_write: false;
  plugin_write_authority: false;
}

export interface R7RuntimeAdapterPreparationCompatibilityGuard {
  parameter_set_reference: "REFERENCE_ONLY_NON_WRITING";
  scenario_package_reference: "REFERENCE_ONLY_NON_BINDING";
  seed_reference: "REFERENCE_ONLY_NON_EXECUTING";
  shadow_replay_reference: "REFERENCE_ONLY_NON_EXECUTING_NON_OVERWRITE";
}

export interface R7RuntimeAdapterPreparationPackage {
  adapter_contract: R7RuntimeAdapterPreparationAdapterContract;
  advisory_boundary: R7RuntimeAdapterPreparationAdvisoryBoundary;
  boundary: R7RuntimeAdapterPreparationBoundary;
  compatibility_guard: R7RuntimeAdapterPreparationCompatibilityGuard;
  direct_store_delta: "NONE";
  docs: readonly [
    "docs/architecture/r7-runtime-adapter-preparation-no-activation.md",
    "docs/quality/r7-runtime-adapter-compatibility-matrix.md",
    "docs/quality/r7-scenario-evidence-ledger.md",
    "docs/quality/r7-runtime-adapter-no-go-register.md",
    "docs/operations/r7-runtime-adapter-boundary.md"
  ];
  evidence_kind: "r7_runtime_adapter_preparation_no_activation";
  evidence_version: "r7-runtime-adapter-preparation-no-activation.v1";
  explicit_non_proofs: typeof R7_RUNTIME_ADAPTER_PREPARATION_EXPLICIT_NON_PROOFS;
  forbidden_writes: typeof R7_RUNTIME_ADAPTER_PREPARATION_FORBIDDEN_WRITES;
  g0_pass: "NOT_GRANTED";
  g0_status: "EXCEPTION";
  l1_status: "NOT_READY";
  no_go_register: typeof R7_RUNTIME_ADAPTER_PREPARATION_NO_GO_REGISTER;
  plugin_boundary: R7RuntimeAdapterPreparationPluginBoundary;
  r8_g1_status: "INTERNAL_ONLY_DRAFT_NOT_RELEASED";
  runtime_authorization: R7RuntimeAdapterPreparationRuntimeAuthorization;
  selection_reference: R7RuntimeAdapterPreparationSelectionReference;
  source_master_sha: typeof R7_RUNTIME_ADAPTER_PREPARATION_SOURCE_MASTER_SHA;
  status: "PREPARATION_PACKAGE_ONLY";
}

export interface R7RuntimeAdapterPreparationValidationResult {
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

export function createR7RuntimeAdapterPreparationPackage(
  selectionPackage: R7TeacherScenarioSelectionBoundaryPackage = createR7TeacherScenarioSelectionBoundaryPackage()
): R7RuntimeAdapterPreparationPackage {
  return {
    adapter_contract: {
      adapter_status: "DRAFT_CONTRACT_ONLY",
      allowed_future_gate: "OWNER_AUTHORIZED_R7_SCENARIO_RUNTIME_ADAPTER",
      input_reference_scope: [
        "tenant_id",
        "course_id",
        "run_id",
        "scenario_package_id",
        "parameter_set_id",
        "plugin_package_id",
        "seed"
      ],
      output_reference_scope: [
        "adapter_readiness",
        "compatibility_guard",
        "no_go_register",
        "explicit_non_proof"
      ],
      source_runtime_path: "NOT_BOUND_TO_RUNTIME_ROUTE"
    },
    advisory_boundary: {
      advisory_only: true,
      ai_runtime_call: false,
      ai_writes_formal_truth: false,
      coach_output_reference: "REFERENCE_ONLY",
      model_call_log_reference: "REFERENCE_ONLY"
    },
    boundary: {
      ai_runtime_enabled: false,
      api_route_enabled: false,
      bff_endpoint_enabled: false,
      database_enabled: false,
      external_source_fetch: false,
      frontend_ui_enabled: false,
      io_enabled: false,
      manifest_hash_semantics_changed: false,
      network_enabled: false,
      official_parameter_set_write: false,
      official_scenario_binding_write: false,
      pilot_or_production_enabled: false,
      plugin_runtime_enabled: false,
      postgresql_enabled: false,
      replay_executes: false,
      replay_hash_semantics_changed: false,
      scenario_runtime_executes: false,
      service_registration: false,
      settlement_result_write: false,
      shadow_replay_executes: false,
      shadow_replay_overwrites_official_result: false,
      state_true_exposure: false,
      student_visibility_expansion: false,
      runtime_route_enabled: false
    },
    compatibility_guard: {
      parameter_set_reference: "REFERENCE_ONLY_NON_WRITING",
      scenario_package_reference: "REFERENCE_ONLY_NON_BINDING",
      seed_reference: "REFERENCE_ONLY_NON_EXECUTING",
      shadow_replay_reference: "REFERENCE_ONLY_NON_EXECUTING_NON_OVERWRITE"
    },
    direct_store_delta: "NONE",
    docs: [
      "docs/architecture/r7-runtime-adapter-preparation-no-activation.md",
      "docs/quality/r7-runtime-adapter-compatibility-matrix.md",
      "docs/quality/r7-scenario-evidence-ledger.md",
      "docs/quality/r7-runtime-adapter-no-go-register.md",
      "docs/operations/r7-runtime-adapter-boundary.md"
    ],
    evidence_kind: "r7_runtime_adapter_preparation_no_activation",
    evidence_version: "r7-runtime-adapter-preparation-no-activation.v1",
    explicit_non_proofs: R7_RUNTIME_ADAPTER_PREPARATION_EXPLICIT_NON_PROOFS,
    forbidden_writes: R7_RUNTIME_ADAPTER_PREPARATION_FORBIDDEN_WRITES,
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    l1_status: "NOT_READY",
    no_go_register: R7_RUNTIME_ADAPTER_PREPARATION_NO_GO_REGISTER,
    plugin_boundary: {
      plugin_package_id_reference_required: true,
      plugin_runtime_enabled: false,
      plugin_trace_write: false,
      plugin_write_authority: false
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
      scenario_runtime_adapter_route: "NOT_AUTHORIZED",
      shadow_replay_runtime: "NOT_AUTHORIZED",
      teacher_bff_runtime_route: "NOT_AUTHORIZED"
    },
    selection_reference: {
      evidence_version: selectionPackage.evidence_version,
      source_master_sha: selectionPackage.source_master_sha,
      status: "TEACHER_SELECTION_BOUNDARY_MERGED_AND_POSTMERGE_VALIDATED"
    },
    source_master_sha: R7_RUNTIME_ADAPTER_PREPARATION_SOURCE_MASTER_SHA,
    status: "PREPARATION_PACKAGE_ONLY"
  };
}

export function validateR7RuntimeAdapterPreparationPackage(
  value: unknown
): R7RuntimeAdapterPreparationValidationResult {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return {
      issues: ["R7_RUNTIME_ADAPTER_PACKAGE_NOT_OBJECT"],
      ok: false
    };
  }

  const candidate = value as Partial<R7RuntimeAdapterPreparationPackage>;

  requireCondition(
    issues,
    candidate.evidence_kind === "r7_runtime_adapter_preparation_no_activation",
    "R7_RUNTIME_ADAPTER_EVIDENCE_KIND_INVALID"
  );
  requireCondition(
    issues,
    candidate.source_master_sha === R7_RUNTIME_ADAPTER_PREPARATION_SOURCE_MASTER_SHA,
    "R7_RUNTIME_ADAPTER_SOURCE_MASTER_SHA_INVALID"
  );
  requireCondition(
    issues,
    candidate.selection_reference?.source_master_sha ===
      R7_TEACHER_SCENARIO_SELECTION_SOURCE_MASTER_SHA &&
      candidate.selection_reference?.status ===
        "TEACHER_SELECTION_BOUNDARY_MERGED_AND_POSTMERGE_VALIDATED",
    "R7_RUNTIME_ADAPTER_SELECTION_REFERENCE_INVALID"
  );
  requireCondition(
    issues,
    candidate.status === "PREPARATION_PACKAGE_ONLY" &&
      candidate.g0_status === "EXCEPTION" &&
      candidate.g0_pass === "NOT_GRANTED" &&
      candidate.l1_status === "NOT_READY" &&
      candidate.r8_g1_status === "INTERNAL_ONLY_DRAFT_NOT_RELEASED",
    "R7_RUNTIME_ADAPTER_STATUS_BOUNDARY_DRIFT"
  );
  requireCondition(
    issues,
    candidate.direct_store_delta === "NONE",
    "R7_RUNTIME_ADAPTER_DIRECT_STORE_DELTA_NOT_ALLOWED"
  );
  requireCondition(
    issues,
    candidate.boundary?.runtime_route_enabled === false &&
      candidate.boundary?.api_route_enabled === false &&
      candidate.boundary?.bff_endpoint_enabled === false &&
      candidate.boundary?.frontend_ui_enabled === false &&
      candidate.boundary?.scenario_runtime_executes === false &&
      candidate.boundary?.service_registration === false &&
      candidate.runtime_authorization?.scenario_runtime_adapter_route === "NOT_AUTHORIZED",
    "R7_RUNTIME_ADAPTER_RUNTIME_ACTIVATION_DRIFT"
  );
  requireCondition(
    issues,
    candidate.boundary?.io_enabled === false &&
      candidate.boundary?.network_enabled === false &&
      candidate.boundary?.database_enabled === false &&
      candidate.boundary?.external_source_fetch === false &&
      candidate.boundary?.postgresql_enabled === false,
    "R7_RUNTIME_ADAPTER_IO_OR_DATABASE_DRIFT"
  );
  requireCondition(
    issues,
    candidate.boundary?.official_parameter_set_write === false,
    "R7_RUNTIME_ADAPTER_PARAMETERSET_WRITE_DRIFT"
  );
  requireCondition(
    issues,
    candidate.boundary?.official_scenario_binding_write === false &&
      candidate.boundary?.state_true_exposure === false &&
      candidate.boundary?.settlement_result_write === false,
    "R7_RUNTIME_ADAPTER_TRUTH_AUTHORITY_DRIFT"
  );
  requireCondition(
    issues,
    candidate.boundary?.replay_executes === false &&
      candidate.boundary?.shadow_replay_executes === false &&
      candidate.boundary?.shadow_replay_overwrites_official_result === false &&
      candidate.boundary?.replay_hash_semantics_changed === false &&
      candidate.boundary?.manifest_hash_semantics_changed === false,
    "R7_RUNTIME_ADAPTER_REPLAY_SEMANTICS_DRIFT"
  );
  requireCondition(
    issues,
    candidate.boundary?.student_visibility_expansion === false,
    "R7_RUNTIME_ADAPTER_STUDENT_VISIBILITY_DRIFT"
  );
  requireCondition(
    issues,
    candidate.advisory_boundary?.advisory_only === true &&
      candidate.advisory_boundary?.ai_runtime_call === false &&
      candidate.advisory_boundary?.ai_writes_formal_truth === false &&
      candidate.boundary?.ai_runtime_enabled === false &&
      candidate.runtime_authorization?.ai_runtime === "NOT_AUTHORIZED",
    "R7_RUNTIME_ADAPTER_AI_AUTHORIZATION_DRIFT"
  );
  requireCondition(
    issues,
    candidate.plugin_boundary?.plugin_runtime_enabled === false &&
      candidate.plugin_boundary?.plugin_trace_write === false &&
      candidate.plugin_boundary?.plugin_write_authority === false &&
      candidate.boundary?.plugin_runtime_enabled === false &&
      candidate.runtime_authorization?.plugin_runtime === "NOT_AUTHORIZED",
    "R7_RUNTIME_ADAPTER_PLUGIN_AUTHORIZATION_DRIFT"
  );
  requireCondition(
    issues,
    candidate.boundary?.pilot_or_production_enabled === false &&
      candidate.runtime_authorization?.pilot === "NOT_AUTHORIZED" &&
      candidate.runtime_authorization?.production === "NOT_AUTHORIZED" &&
      candidate.runtime_authorization?.durable_settlement === "NOT_PROVEN",
    "R7_RUNTIME_ADAPTER_RELEASE_AUTHORIZATION_DRIFT"
  );
  requireCondition(
    issues,
    R7_RUNTIME_ADAPTER_PREPARATION_FORBIDDEN_WRITES.every((write) =>
      candidate.forbidden_writes?.includes(write)
    ),
    "R7_RUNTIME_ADAPTER_FORBIDDEN_WRITE_LIST_INCOMPLETE"
  );
  requireCondition(
    issues,
    R7_RUNTIME_ADAPTER_PREPARATION_NO_GO_REGISTER.every((trigger) =>
      candidate.no_go_register?.includes(trigger)
    ),
    "R7_RUNTIME_ADAPTER_NO_GO_REGISTER_INCOMPLETE"
  );

  return {
    issues,
    ok: issues.length === 0
  };
}
