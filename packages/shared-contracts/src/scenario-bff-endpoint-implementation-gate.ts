export const R7_BFF_ENDPOINT_IMPLEMENTATION_GATE_SOURCE_MASTER_SHA =
  "aec5d6f762a16cd3f503bf6c4d33e45a753a830c" as const;

export const R7_BFF_ENDPOINT_IMPLEMENTATION_GATE_EXPLICIT_NON_PROOFS = [
  "implementation gate != endpoint implementation",
  "implementation gate != API route registration",
  "implementation gate != frontend integration",
  "implementation gate != runtime adapter activation",
  "gate pass != Owner authorization",
  "gate pass != Student visibility proof",
  "gate pass != Pilot readiness",
  "gate pass != Production readiness"
] as const;

export const R7_BFF_ENDPOINT_IMPLEMENTATION_GATE_NO_GO_REGISTER = [
  "student_invocation",
  "missing_tenant_context",
  "missing_course_or_run_context",
  "missing_teacher_authority",
  "cross_tenant_scope",
  "cross_team_scope",
  "unapproved_scenario_package",
  "private_parameterset_visibility",
  "private_replay_visibility",
  "official_result_overwrite",
  "runtime_activation",
  "schema_or_database_drift",
  "ai_or_plugin_runtime"
] as const;

const REQUIRED_REQUEST_FIELDS = [
  "tenant_id",
  "course_id",
  "run_id",
  "teacher_id",
  "scenario_package_id",
  "parameter_set_id"
] as const;

const REQUIRED_PREREQUISITES = [
  "authenticated_teacher",
  "explicit_tenant_context",
  "course_run_authority",
  "approved_scenario_package",
  "runtime_adapter_readiness",
  "read_only_parameterset_reference",
  "replay_non_overwrite_evidence",
  "student_projection_negative_tests",
  "security_review",
  "browser_regression"
] as const;

export interface R7BffEndpointImplementationGate {
  evidence_kind: "r7_bff_endpoint_implementation_gate";
  evidence_version: "r7-bff-endpoint-implementation-gate.v1";
  source_master_sha: typeof R7_BFF_ENDPOINT_IMPLEMENTATION_GATE_SOURCE_MASTER_SHA;
  status: "IMPLEMENTATION_GATE_ONLY";
  authorized_roles: readonly ["teacher"];
  request_context: {
    required_fields: typeof REQUIRED_REQUEST_FIELDS;
    tenant_required: true;
    course_run_scope_required: true;
    teacher_authority_required: true;
    platform_scope_implicit: false;
  };
  prerequisites: typeof REQUIRED_PREREQUISITES;
  boundary: {
    route_enabled: false;
    handler_enabled: false;
    frontend_fetch_enabled: false;
    runtime_activation_enabled: false;
    scenario_execution_enabled: false;
    official_parameter_set_write: false;
    replay_execution_enabled: false;
    replay_overwrites_official_result: false;
    settlement_result_write: false;
    state_true_exposure: false;
    private_replay_exposure: false;
    database_or_schema_change: false;
    ai_runtime_enabled: false;
    plugin_runtime_enabled: false;
  };
  allowed_future_gate: "OWNER_AUTHORIZED_R7_BFF_ENDPOINT_IMPLEMENTATION";
  no_go_register: typeof R7_BFF_ENDPOINT_IMPLEMENTATION_GATE_NO_GO_REGISTER;
  explicit_non_proofs: typeof R7_BFF_ENDPOINT_IMPLEMENTATION_GATE_EXPLICIT_NON_PROOFS;
}

export interface R7BffEndpointImplementationGateValidationResult {
  issues: string[];
  ok: boolean;
}

export function createR7BffEndpointImplementationGate(): R7BffEndpointImplementationGate {
  return {
    evidence_kind: "r7_bff_endpoint_implementation_gate",
    evidence_version: "r7-bff-endpoint-implementation-gate.v1",
    source_master_sha: R7_BFF_ENDPOINT_IMPLEMENTATION_GATE_SOURCE_MASTER_SHA,
    status: "IMPLEMENTATION_GATE_ONLY",
    authorized_roles: ["teacher"],
    request_context: {
      required_fields: REQUIRED_REQUEST_FIELDS,
      tenant_required: true,
      course_run_scope_required: true,
      teacher_authority_required: true,
      platform_scope_implicit: false
    },
    prerequisites: REQUIRED_PREREQUISITES,
    boundary: {
      route_enabled: false,
      handler_enabled: false,
      frontend_fetch_enabled: false,
      runtime_activation_enabled: false,
      scenario_execution_enabled: false,
      official_parameter_set_write: false,
      replay_execution_enabled: false,
      replay_overwrites_official_result: false,
      settlement_result_write: false,
      state_true_exposure: false,
      private_replay_exposure: false,
      database_or_schema_change: false,
      ai_runtime_enabled: false,
      plugin_runtime_enabled: false
    },
    allowed_future_gate: "OWNER_AUTHORIZED_R7_BFF_ENDPOINT_IMPLEMENTATION",
    no_go_register: R7_BFF_ENDPOINT_IMPLEMENTATION_GATE_NO_GO_REGISTER,
    explicit_non_proofs: R7_BFF_ENDPOINT_IMPLEMENTATION_GATE_EXPLICIT_NON_PROOFS
  };
}

export function validateR7BffEndpointImplementationGate(
  value: unknown
): R7BffEndpointImplementationGateValidationResult {
  const issues: string[] = [];
  const candidate = value as Partial<R7BffEndpointImplementationGate> | null;

  if (!candidate || typeof candidate !== "object") {
    return { issues: ["R7_BFF_GATE_NOT_OBJECT"], ok: false };
  }
  if (candidate.evidence_kind !== "r7_bff_endpoint_implementation_gate") {
    issues.push("R7_BFF_GATE_EVIDENCE_KIND_INVALID");
  }
  if (candidate.source_master_sha !== R7_BFF_ENDPOINT_IMPLEMENTATION_GATE_SOURCE_MASTER_SHA) {
    issues.push("R7_BFF_GATE_SOURCE_MASTER_SHA_INVALID");
  }
  if (candidate.status !== "IMPLEMENTATION_GATE_ONLY") {
    issues.push("R7_BFF_GATE_STATUS_DRIFT");
  }
  if (candidate.authorized_roles?.length !== 1 || candidate.authorized_roles[0] !== "teacher") {
    issues.push("R7_BFF_GATE_ROLE_SCOPE_DRIFT");
  }
  if (
    candidate.request_context?.tenant_required !== true ||
    candidate.request_context?.course_run_scope_required !== true ||
    candidate.request_context?.teacher_authority_required !== true ||
    candidate.request_context?.platform_scope_implicit !== false
  ) {
    issues.push("R7_BFF_GATE_TENANT_CONTEXT_DRIFT");
  }
  if (
    candidate.boundary?.route_enabled !== false ||
    candidate.boundary?.handler_enabled !== false ||
    candidate.boundary?.frontend_fetch_enabled !== false ||
    candidate.boundary?.runtime_activation_enabled !== false ||
    candidate.boundary?.scenario_execution_enabled !== false
  ) {
    issues.push("R7_BFF_GATE_ROUTE_IMPLEMENTATION_DRIFT");
  }
  if (candidate.boundary?.official_parameter_set_write !== false) {
    issues.push("R7_BFF_GATE_PARAMETERSET_WRITE_DRIFT");
  }
  if (
    candidate.boundary?.replay_execution_enabled !== false ||
    candidate.boundary?.replay_overwrites_official_result !== false ||
    candidate.boundary?.settlement_result_write !== false
  ) {
    issues.push("R7_BFF_GATE_REPLAY_OR_SETTLEMENT_DRIFT");
  }
  if (
    candidate.boundary?.state_true_exposure !== false ||
    candidate.boundary?.private_replay_exposure !== false
  ) {
    issues.push("R7_BFF_GATE_TRUTH_VISIBILITY_DRIFT");
  }
  if (
    candidate.boundary?.database_or_schema_change !== false ||
    candidate.boundary?.ai_runtime_enabled !== false ||
    candidate.boundary?.plugin_runtime_enabled !== false
  ) {
    issues.push("R7_BFF_GATE_FORBIDDEN_RUNTIME_DRIFT");
  }
  if (candidate.allowed_future_gate !== "OWNER_AUTHORIZED_R7_BFF_ENDPOINT_IMPLEMENTATION") {
    issues.push("R7_BFF_GATE_FUTURE_AUTHORIZATION_DRIFT");
  }

  return { issues, ok: issues.length === 0 };
}
