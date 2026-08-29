import type { W4StateRef } from "./w4-enterprise-state.js";
import type {
  ESLFinanceProjection,
  ESLFinanceStudentProjection
} from "./executive-strategy-lab-finance.js";

export const ESL_SCHEMA_VERSION = "main-esl-o2p.v1" as const;

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
  finance_feasibility: ESLFinanceProjection;
}

export interface ESLStudentAlternativePath extends Omit<
  ESLAlternativePath,
  "decision_ids" | "mechanism_ids" | "finance_feasibility"
> {
  finance_feasibility: ESLFinanceStudentProjection;
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
  paths: ESLStudentAlternativePath[];
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
  finance_models: Array<{
    path_id: string;
    model: import("./executive-strategy-lab-finance.js").ESLFinanceModelIdentity;
    input_digest: string;
    source_refs: string[];
  }>;
}

export interface ESLResponse {
  schema_version: typeof ESL_SCHEMA_VERSION;
  candidate_id: string;
  surface: ESLSurface;
  exact_binding: ESLExactBinding;
  official_baseline: ESLOfficialBaseline;
  paths: Array<ESLAlternativePath | ESLStudentAlternativePath>;
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

function projectionHasSurface(value: unknown, surface: ESLSurface): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).surface === surface
  );
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
): boolean {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function digest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function financeUnit(value: unknown): boolean {
  return ["SIMWAR_CURRENCY", "RATIO", "BASIS_POINTS", "ROUNDS", "COUNT"].includes(String(value));
}

function financeStatus(value: unknown): boolean {
  return value === "KNOWN" || value === "UNKNOWN";
}

function financeFeasibility(value: unknown): boolean {
  return value === "FEASIBLE" || value === "INFEASIBLE" || value === "UNKNOWN";
}

function financeCovenantStatus(value: unknown): boolean {
  return value === "WITHIN_LIMIT" || value === "BREACHED" || value === "UNKNOWN";
}

function stringArray(value: unknown, minimum = 0): value is string[] {
  return (
    Array.isArray(value) && value.length >= minimum && value.every((item) => nonEmptyString(item))
  );
}

function financeDisplayValue(value: unknown): boolean {
  const display = record(value);
  return (
    display !== null &&
    hasExactKeys(display, ["amount", "status", "unit"]) &&
    (display.amount === null || finiteNumber(display.amount)) &&
    financeStatus(display.status) &&
    financeUnit(display.unit)
  );
}

function financeStudentStressRegime(value: unknown): boolean {
  const regime = record(value);
  return (
    regime !== null &&
    hasExactKeys(regime, ["regime_id", "covenant_status", "feasibility"]) &&
    ["DEMAND_PRICE_DOWNSIDE", "WORKFORCE_CAPACITY_PRESSURE", "FUNDING_COVENANT_PRESSURE"].includes(
      String(regime.regime_id)
    ) &&
    financeCovenantStatus(regime.covenant_status) &&
    financeFeasibility(regime.feasibility)
  );
}

function financeStudentProjection(value: unknown): boolean {
  const projection = record(value);
  if (
    projection === null ||
    !hasExactKeys(projection, [
      "official",
      "role_safe",
      "feasibility",
      "cash_flow",
      "liquidity_headroom",
      "capital_tradeoff_summary",
      "stress_regimes",
      "excluded_fields"
    ])
  ) {
    return false;
  }
  const stressRegimes = projection.stress_regimes;
  return (
    projection.official === false &&
    projection.role_safe === true &&
    financeFeasibility(projection.feasibility) &&
    financeDisplayValue(projection.cash_flow) &&
    financeDisplayValue(projection.liquidity_headroom) &&
    nonEmptyString(projection.capital_tradeoff_summary) &&
    Array.isArray(stressRegimes) &&
    stressRegimes.length === 3 &&
    stressRegimes.every(financeStudentStressRegime) &&
    new Set(stressRegimes.map((regime) => (record(regime) as Record<string, unknown>).regime_id))
      .size === stressRegimes.length &&
    stringArray(projection.excluded_fields, 1)
  );
}

function studentOfficialBaseline(value: unknown): boolean {
  const baseline = record(value);
  return (
    baseline !== null &&
    hasExactKeys(baseline, ["officiality", "outcome_id", "summary"]) &&
    baseline.officiality === "OFFICIAL" &&
    (baseline.outcome_id === null || exactId(baseline.outcome_id)) &&
    nonEmptyString(baseline.summary)
  );
}

function transfer(value: unknown): boolean {
  const transferValue = record(value);
  return (
    transferValue !== null &&
    hasExactKeys(transferValue, [
      "status",
      "statement",
      "evidence_path_ids",
      "applies_to_next_round"
    ]) &&
    transferValue.status === "DRAFT" &&
    nonEmptyString(transferValue.statement) &&
    stringArray(transferValue.evidence_path_ids) &&
    transferValue.applies_to_next_round === false
  );
}

function studentAlternativePath(value: unknown): boolean {
  const path = record(value);
  const outcome = record(path?.outcome);
  return (
    path !== null &&
    hasExactKeys(path, [
      "path_id",
      "label",
      "officiality",
      "path_digest",
      "changed_paths",
      "outcome",
      "finance_feasibility"
    ]) &&
    exactId(path.path_id) &&
    nonEmptyString(path.label) &&
    path.officiality === "NON_OFFICIAL" &&
    digest(path.path_digest) &&
    stringArray(path.changed_paths) &&
    outcome !== null &&
    hasExactKeys(outcome, [
      "cash_delta",
      "capacity_delta",
      "project_count_delta",
      "terminal_state_digest"
    ]) &&
    finiteNumber(outcome.cash_delta) &&
    finiteNumber(outcome.capacity_delta) &&
    finiteNumber(outcome.project_count_delta) &&
    digest(outcome.terminal_state_digest) &&
    financeStudentProjection(path.finance_feasibility)
  );
}

function studentProjection(value: unknown): boolean {
  const projection = record(value);
  return (
    projection !== null &&
    hasExactKeys(
      projection,
      ["surface", "role_safe", "official_baseline", "paths", "transfer", "excluded_fields"],
      ["role_key"]
    ) &&
    projection.surface === "student" &&
    projection.role_safe === true &&
    (projection.role_key === undefined || exactId(projection.role_key)) &&
    studentOfficialBaseline(projection.official_baseline) &&
    Array.isArray(projection.paths) &&
    projection.paths.every(studentAlternativePath) &&
    transfer(projection.transfer) &&
    stringArray(projection.excluded_fields, 1)
  );
}

function responseSurfaceBoundary(response: Record<string, unknown>): boolean {
  const surface = response.surface;
  const hasTeacherProjection = response.teacher_projection !== undefined;
  const hasStudentProjection = response.student_projection !== undefined;
  const hasAdminProjection = response.admin_projection !== undefined;

  if (surface === "teacher") {
    return (
      projectionHasSurface(response.teacher_projection, "teacher") &&
      !hasStudentProjection &&
      !hasAdminProjection
    );
  }
  if (surface === "student") {
    return (
      studentProjection(response.student_projection) && !hasTeacherProjection && !hasAdminProjection
    );
  }
  if (surface === "admin") {
    return (
      projectionHasSurface(response.admin_projection, "admin") &&
      !hasTeacherProjection &&
      !hasStudentProjection
    );
  }
  return false;
}

function responsePathsMatchSurface(response: Record<string, unknown>): boolean {
  if (!Array.isArray(response.paths)) return false;
  if (response.surface === "student") {
    return response.paths.every(studentAlternativePath);
  }
  return response.paths.every((path) => {
    if (!path || typeof path !== "object" || Array.isArray(path)) return false;
    const item = path as Record<string, unknown>;
    const commonPath =
      exactId(item.path_id) &&
      item.officiality === "NON_OFFICIAL" &&
      typeof item.path_digest === "string" &&
      /^[a-f0-9]{64}$/.test(item.path_digest) &&
      Boolean(item.finance_feasibility) &&
      (item.finance_feasibility as Record<string, unknown>).official === false;
    if (!commonPath) return false;
    return Array.isArray(item.decision_ids) && Array.isArray(item.mechanism_ids);
  });
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
    responseSurfaceBoundary(response) &&
    responsePathsMatchSurface(response) &&
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
