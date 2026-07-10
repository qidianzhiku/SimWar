export const R7_BFF_ENDPOINT_CONTRACT_SOURCE_MASTER_SHA =
  "40e4e6b2e7c1440598e54dc92ea66a5d9d8160d3" as const;

export const R7_BFF_ENDPOINT_CONTRACT_EXPLICIT_NON_PROOFS = [
  "BFF endpoint contract != BFF endpoint implementation",
  "BFF endpoint contract != API route registration",
  "BFF endpoint contract != frontend integration",
  "BFF endpoint contract != scenario runtime activation",
  "BFF endpoint contract != official ParameterSet write",
  "BFF endpoint contract != Replay execution",
  "BFF endpoint contract != R8-G1 release",
  "BFF endpoint contract != Pilot readiness",
  "BFF endpoint contract != Production readiness"
] as const;

export const R7_BFF_ENDPOINT_CONTRACT_NO_GO_REGISTER = [
  "student_private_visibility",
  "cross_tenant_scope",
  "cross_team_scope",
  "direct_internal_route_access",
  "official_result_overwrite",
  "state_true_exposure",
  "runtime_activation",
  "schema_or_database_drift"
] as const;

type RequiredRequestField =
  | "tenant_id"
  | "course_id"
  | "run_id"
  | "scenario_package_id"
  | "parameter_set_id";

export interface R7BffEndpointContractDraft {
  evidence_kind: "r7_bff_endpoint_contract_draft_no_implementation";
  evidence_version: "r7-bff-endpoint-contract-draft-no-implementation.v1";
  source_master_sha: typeof R7_BFF_ENDPOINT_CONTRACT_SOURCE_MASTER_SHA;
  status: "CONTRACT_DRAFT_ONLY";
  request_context: {
    tenant_id: "required";
    course_id: "required";
    run_id: "required";
    scenario_package_id: "required";
    parameter_set_id: "required";
    required_fields: readonly RequiredRequestField[];
    tenant_scope: "explicit_tenant_context_required";
    scenario_scope: "scenario_package_reference_only";
  };
  response_contract: {
    student_visibility: "redacted_projection_only";
    state_true_exposed: false;
    private_replay_exposed: false;
    advisory_only: true;
  };
  boundary: {
    api_route_enabled: false;
    bff_endpoint_enabled: false;
    frontend_fetch_enabled: false;
    io_enabled: false;
    runtime_activation_enabled: false;
    official_parameter_set_write: false;
    replay_execution_enabled: false;
    settlement_result_write: false;
    state_true_exposure: false;
    service_registration: false;
    schema_or_database_change: false;
  };
  allowed_future_gate: "OWNER_AUTHORIZED_R7_BFF_ENDPOINT_IMPLEMENTATION";
  no_go_register: typeof R7_BFF_ENDPOINT_CONTRACT_NO_GO_REGISTER;
  explicit_non_proofs: typeof R7_BFF_ENDPOINT_CONTRACT_EXPLICIT_NON_PROOFS;
}

export interface R7BffEndpointContractValidationResult {
  issues: string[];
  ok: boolean;
}

export function createR7BffEndpointContractDraft(): R7BffEndpointContractDraft {
  return {
    evidence_kind: "r7_bff_endpoint_contract_draft_no_implementation",
    evidence_version: "r7-bff-endpoint-contract-draft-no-implementation.v1",
    source_master_sha: R7_BFF_ENDPOINT_CONTRACT_SOURCE_MASTER_SHA,
    status: "CONTRACT_DRAFT_ONLY",
    request_context: {
      tenant_id: "required",
      course_id: "required",
      run_id: "required",
      scenario_package_id: "required",
      parameter_set_id: "required",
      required_fields: [
        "tenant_id",
        "course_id",
        "run_id",
        "scenario_package_id",
        "parameter_set_id"
      ],
      tenant_scope: "explicit_tenant_context_required",
      scenario_scope: "scenario_package_reference_only"
    },
    response_contract: {
      student_visibility: "redacted_projection_only",
      state_true_exposed: false,
      private_replay_exposed: false,
      advisory_only: true
    },
    boundary: {
      api_route_enabled: false,
      bff_endpoint_enabled: false,
      frontend_fetch_enabled: false,
      io_enabled: false,
      runtime_activation_enabled: false,
      official_parameter_set_write: false,
      replay_execution_enabled: false,
      settlement_result_write: false,
      state_true_exposure: false,
      service_registration: false,
      schema_or_database_change: false
    },
    allowed_future_gate: "OWNER_AUTHORIZED_R7_BFF_ENDPOINT_IMPLEMENTATION",
    no_go_register: R7_BFF_ENDPOINT_CONTRACT_NO_GO_REGISTER,
    explicit_non_proofs: R7_BFF_ENDPOINT_CONTRACT_EXPLICIT_NON_PROOFS
  };
}

export function validateR7BffEndpointContractDraft(
  value: unknown
): R7BffEndpointContractValidationResult {
  const issues: string[] = [];
  const candidate = value as Partial<R7BffEndpointContractDraft> | null;

  if (!candidate || typeof candidate !== "object") {
    return { issues: ["R7_BFF_ENDPOINT_CONTRACT_NOT_OBJECT"], ok: false };
  }

  if (candidate.evidence_kind !== "r7_bff_endpoint_contract_draft_no_implementation") {
    issues.push("R7_BFF_ENDPOINT_CONTRACT_EVIDENCE_KIND_INVALID");
  }
  if (candidate.source_master_sha !== R7_BFF_ENDPOINT_CONTRACT_SOURCE_MASTER_SHA) {
    issues.push("R7_BFF_ENDPOINT_CONTRACT_SOURCE_MASTER_SHA_INVALID");
  }
  if (candidate.status !== "CONTRACT_DRAFT_ONLY") {
    issues.push("R7_BFF_ENDPOINT_CONTRACT_STATUS_DRIFT");
  }
  const boundary = candidate.boundary;
  if (
    boundary?.api_route_enabled !== false ||
    boundary?.bff_endpoint_enabled !== false ||
    boundary?.frontend_fetch_enabled !== false ||
    boundary?.service_registration !== false ||
    boundary?.runtime_activation_enabled !== false
  ) {
    issues.push("R7_BFF_ENDPOINT_ROUTE_IMPLEMENTATION_DRIFT");
  }
  if (
    boundary?.io_enabled !== false ||
    boundary?.schema_or_database_change !== false ||
    boundary?.official_parameter_set_write !== false
  ) {
    issues.push("R7_BFF_ENDPOINT_SCOPE_ESCAPE_DRIFT");
  }
  if (boundary?.replay_execution_enabled !== false || boundary?.settlement_result_write !== false) {
    issues.push("R7_BFF_ENDPOINT_REPLAY_OR_SETTLEMENT_DRIFT");
  }
  if (
    boundary?.state_true_exposure !== false ||
    candidate.response_contract?.state_true_exposed !== false ||
    candidate.response_contract?.private_replay_exposed !== false
  ) {
    issues.push("R7_BFF_ENDPOINT_STATE_TRUE_EXPOSURE_DRIFT");
  }
  if (candidate.request_context?.tenant_scope !== "explicit_tenant_context_required") {
    issues.push("R7_BFF_ENDPOINT_TENANT_CONTEXT_DRIFT");
  }
  if (candidate.allowed_future_gate !== "OWNER_AUTHORIZED_R7_BFF_ENDPOINT_IMPLEMENTATION") {
    issues.push("R7_BFF_ENDPOINT_FUTURE_GATE_DRIFT");
  }

  return { issues, ok: issues.length === 0 };
}
