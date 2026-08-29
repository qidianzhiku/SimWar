import type { W4StateRef } from "./w4-enterprise-state.js";

export const ESL_SCHEMA_VERSION = "main-esl-o1.v1" as const;

export type ESLSurface = "teacher" | "student" | "admin";

export interface ESLExactBinding {
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  round_id: string;
  round_no: number;
  scenario_package_id: string;
  scenario_version: string;
  parameter_set_id: string;
  parameter_set_version: string;
  model_version_id: string;
  model_version: string;
  model_artifact_id: string;
  model_artifact_version: string;
  engine_id: string;
  plugin_ids: string[];
  seed: number;
}

export interface ESLPathRequest {
  path_id: string;
  label: string;
  decision_ids: string[];
}

export interface ESLRequest {
  discriminator: "esl_strategy_lab_request";
  exact_binding: ESLExactBinding;
  paths: ESLPathRequest[];
  transfer_hypothesis: string;
  idempotency_key: string;
}

export interface ESLOfficialBaseline {
  officiality: "OFFICIAL";
  outcome_id: string | null;
  state_ref: W4StateRef | null;
  summary: string;
  state_summary?: {
    cash: number;
    capacity: number;
    product_line_count: number;
    operating_unit_count: number;
    project_count: number;
  };
  changed_paths?: string[];
}

export interface ESLAlternativePath {
  path_id: string;
  label: string;
  officiality: "NON_OFFICIAL";
  decision_ids: string[];
  path_digest: string;
  changed_paths: string[];
  outcome: {
    cash_delta: number;
    capacity_delta: number;
    project_count_delta: number;
    terminal_state_digest: string;
  };
  mechanism_ids: string[];
}

export interface ESLMechanism {
  mechanism_id: string;
  label: string;
  explanation: string;
  evidence_path_ids: string[];
  uncertainty: "OBSERVED_DIFFERENTIAL_ONLY";
}

export interface ESLTransferHypothesis {
  status: "DRAFT";
  statement: string;
  evidence_path_ids: string[];
  applies_to_next_round: false;
}

export interface ESLSourceRefs {
  official_outcome_id: string | null;
  o4_candidate_digest: string | null;
  m4_candidate_digests: string[];
}

export interface ESLAuthority {
  runtime_authority: "JSON_INTERNAL_ONLY";
  official_realized_source: "SIMULATION_CORE";
  writer_authority: "SOLE_W4_ENTERPRISE_STATE_SERVICE";
  formal_truth_write: false;
  settlement_write: false;
  replay_truth_write: false;
  provider: "OFF";
}

export interface ESLTeacherProjection {
  surface: "teacher";
  available_actions: string[];
  official_baseline: ESLOfficialBaseline;
  paths: ESLAlternativePath[];
  mechanisms: ESLMechanism[];
  transfer: ESLTransferHypothesis;
}

export interface ESLStudentProjection {
  surface: "student";
  role_safe: true;
  role_key?: string;
  official_baseline: Pick<ESLOfficialBaseline, "officiality" | "outcome_id" | "summary">;
  paths: Array<
    Pick<
      ESLAlternativePath,
      "path_id" | "label" | "officiality" | "path_digest" | "changed_paths" | "outcome"
    >
  >;
  transfer: ESLTransferHypothesis;
  excluded_fields: string[];
}

export interface ESLAdminProjection {
  surface: "admin";
  tenant_id: string;
  exact_binding: ESLExactBinding;
  source_refs: ESLSourceRefs;
  officiality_counts: { official: number; non_official: number };
  audit: {
    candidate_id: string;
    generated_by: string;
    no_write: true;
    recovery: "REPLAY_REQUEST_WITH_EXACT_BINDING";
  };
}

export interface ESLResponse {
  schema_version: typeof ESL_SCHEMA_VERSION;
  candidate_id: string;
  surface: ESLSurface;
  exact_binding: ESLExactBinding;
  official_baseline: ESLOfficialBaseline;
  paths: ESLAlternativePath[];
  mechanisms: ESLMechanism[];
  transfer: ESLTransferHypothesis;
  source_refs: ESLSourceRefs;
  authority: ESLAuthority;
  known_limits: string[];
  teacher_projection?: ESLTeacherProjection;
  student_projection?: ESLStudentProjection;
  admin_projection?: ESLAdminProjection;
}

const BANNED_ID =
  /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i;
const EXACT_ID = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/;

function exactId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    EXACT_ID.test(value) &&
    !BANNED_ID.test(value)
  );
}

function exactBinding(value: unknown): value is ESLExactBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const binding = value as Record<string, unknown>;
  const stringFields = [
    "tenant_id",
    "course_id",
    "run_id",
    "team_id",
    "round_id",
    "scenario_package_id",
    "scenario_version",
    "parameter_set_id",
    "parameter_set_version",
    "model_version_id",
    "model_version",
    "model_artifact_id",
    "model_artifact_version",
    "engine_id"
  ];
  return (
    stringFields.every((field) => exactId(binding[field])) &&
    Number.isSafeInteger(binding.round_no) &&
    Number(binding.round_no) >= 1 &&
    Array.isArray(binding.plugin_ids) &&
    binding.plugin_ids.length <= 8 &&
    binding.plugin_ids.every((pluginId) => exactId(pluginId)) &&
    Number.isSafeInteger(binding.seed) &&
    Number(binding.seed) >= 0
  );
}

function pathRequest(value: unknown): value is ESLPathRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const path = value as Record<string, unknown>;
  return (
    exactId(path.path_id) &&
    typeof path.label === "string" &&
    path.label.trim() === path.label &&
    path.label.length > 0 &&
    Array.isArray(path.decision_ids) &&
    path.decision_ids.length > 0 &&
    path.decision_ids.length <= 8 &&
    path.decision_ids.every((decisionId) => exactId(decisionId))
  );
}

export function isESLRequest(value: unknown): value is ESLRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  if (
    request.discriminator !== "esl_strategy_lab_request" ||
    !exactBinding(request.exact_binding) ||
    !Array.isArray(request.paths) ||
    request.paths.length < 2 ||
    request.paths.length > 3 ||
    !request.paths.every(pathRequest) ||
    new Set(request.paths.map((path) => path.path_id)).size !== request.paths.length ||
    typeof request.transfer_hypothesis !== "string" ||
    request.transfer_hypothesis.trim() !== request.transfer_hypothesis ||
    request.transfer_hypothesis.length === 0 ||
    request.transfer_hypothesis.length > 500 ||
    !exactId(request.idempotency_key)
  ) {
    return false;
  }
  return true;
}

function stateRef(value: unknown): value is W4StateRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const ref = value as Record<string, unknown>;
  return (
    exactId(ref.tenant_id) &&
    exactId(ref.course_id) &&
    exactId(ref.run_id) &&
    exactId(ref.team_id) &&
    exactId(ref.round_id) &&
    exactId(ref.enterprise_state_id) &&
    Number.isSafeInteger(ref.version) &&
    typeof ref.state_digest === "string" &&
    /^[a-f0-9]{64}$/.test(ref.state_digest)
  );
}

export function isESLResponse(value: unknown): value is ESLResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const response = value as Record<string, unknown>;
  const baseline = response.official_baseline as Record<string, unknown> | undefined;
  const authority = response.authority as Record<string, unknown> | undefined;
  const transfer = response.transfer as Record<string, unknown> | undefined;
  const refs = response.source_refs as Record<string, unknown> | undefined;
  if (!refs) return false;
  return (
    response.schema_version === ESL_SCHEMA_VERSION &&
    exactId(response.candidate_id) &&
    ["teacher", "student", "admin"].includes(String(response.surface)) &&
    exactBinding(response.exact_binding) &&
    baseline?.officiality === "OFFICIAL" &&
    (baseline.outcome_id === null || exactId(baseline.outcome_id)) &&
    (baseline.state_ref === null || stateRef(baseline.state_ref)) &&
    typeof baseline.summary === "string" &&
    Array.isArray(response.paths) &&
    response.paths.every((path) => {
      const item = path as Record<string, unknown>;
      return (
        exactId(item.path_id) &&
        item.officiality === "NON_OFFICIAL" &&
        typeof item.path_digest === "string" &&
        /^[a-f0-9]{64}$/.test(item.path_digest)
      );
    }) &&
    Array.isArray(response.mechanisms) &&
    transfer?.status === "DRAFT" &&
    typeof transfer.statement === "string" &&
    transfer.applies_to_next_round === false &&
    (refs.official_outcome_id === null || exactId(refs.official_outcome_id)) &&
    Array.isArray(refs.m4_candidate_digests) &&
    authority?.runtime_authority === "JSON_INTERNAL_ONLY" &&
    authority.official_realized_source === "SIMULATION_CORE" &&
    authority.writer_authority === "SOLE_W4_ENTERPRISE_STATE_SERVICE" &&
    authority.formal_truth_write === false &&
    authority.settlement_write === false &&
    authority.replay_truth_write === false &&
    authority.provider === "OFF" &&
    Array.isArray(response.known_limits) &&
    response.known_limits.every((limit) => typeof limit === "string")
  );
}
