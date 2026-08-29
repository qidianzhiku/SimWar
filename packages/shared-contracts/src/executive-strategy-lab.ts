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

interface ESLResponseBase {
  schema_version: typeof ESL_SCHEMA_VERSION;
  candidate_id: string;
  exact_binding: ESLExactBinding;
  official_baseline: ESLOfficialBaseline;
  mechanisms: ESLMechanism[];
  transfer: ESLTransferHypothesis;
  source_refs: ESLSourceRefs;
  authority: ESLAuthority;
  known_limits: string[];
}

export interface ESLTeacherResponse extends ESLResponseBase {
  surface: "teacher";
  paths: ESLAlternativePath[];
  teacher_projection: ESLTeacherProjection;
  student_projection?: never;
  admin_projection?: never;
}

export interface ESLStudentResponse extends ESLResponseBase {
  surface: "student";
  paths: ESLStudentAlternativePath[];
  teacher_projection?: never;
  student_projection: ESLStudentProjection;
  admin_projection?: never;
}

export interface ESLAdminResponse extends ESLResponseBase {
  surface: "admin";
  paths: ESLAlternativePath[];
  teacher_projection?: never;
  student_projection?: never;
  admin_projection: ESLAdminProjection;
}

export type ESLResponse = ESLTeacherResponse | ESLStudentResponse | ESLAdminResponse;

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

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
    .join(",")}}`;
}

function financeUnit(value: unknown): boolean {
  return ["SIMWAR_CURRENCY", "RATIO", "BASIS_POINTS", "ROUNDS", "COUNT"].includes(String(value));
}

function financeCurrency(unit: unknown, status: unknown, currency: unknown): boolean {
  if (unit === "SIMWAR_CURRENCY") {
    return status === "KNOWN" ? currency === "SIMWAR_UNITS" : currency === "UNKNOWN";
  }
  return currency === "NOT_APPLICABLE";
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
  if (
    display === null ||
    !hasExactKeys(display, ["amount", "status", "unit"], ["unknown_reason"]) ||
    !financeStatus(display.status) ||
    !financeUnit(display.unit)
  ) {
    return false;
  }
  if (display.status === "KNOWN") return finiteNumber(display.amount);
  return display.amount === null && nonEmptyString(display.unknown_reason);
}

function unknownFinanceDisplayValue(value: unknown): boolean {
  const display = record(value);
  return (
    display !== null &&
    financeDisplayValue(display) &&
    display.status === "UNKNOWN" &&
    display.amount === null &&
    nonEmptyString(display.unknown_reason)
  );
}

function financeDisplayMirrorsBasis(displayValue: unknown, basisValue: unknown): boolean {
  const display = record(displayValue);
  const basis = record(basisValue);
  return (
    display !== null &&
    basis !== null &&
    display.amount === basis.amount &&
    display.status === basis.status &&
    display.unit === basis.unit &&
    (basis.status === "UNKNOWN"
      ? display.unknown_reason === basis.unknown_reason
      : !Object.hasOwn(display, "unknown_reason"))
  );
}

function financeBasis(value: unknown): boolean {
  const basis = record(value);
  if (
    basis === null ||
    !hasExactKeys(
      basis,
      ["amount", "status", "unit", "currency", "time_period", "source_refs"],
      ["unknown_reason"]
    ) ||
    !financeStatus(basis.status) ||
    !financeUnit(basis.unit) ||
    !["SIMWAR_UNITS", "NOT_APPLICABLE", "UNKNOWN"].includes(String(basis.currency)) ||
    !financeCurrency(basis.unit, basis.status, basis.currency) ||
    !["ROUND", "HORIZON"].includes(String(basis.time_period)) ||
    !stringArray(basis.source_refs, 1)
  ) {
    return false;
  }
  if (basis.status === "KNOWN") return finiteNumber(basis.amount);
  return basis.amount === null && nonEmptyString(basis.unknown_reason);
}

function financeModel(value: unknown): boolean {
  const model = record(value);
  return (
    model !== null &&
    hasExactKeys(model, [
      "source_kind",
      "source_ref",
      "model_version_id",
      "model_version",
      "model_artifact_id",
      "model_artifact_version",
      "engine_id",
      "parameter_set_id",
      "parameter_set_version"
    ]) &&
    model.source_kind === "BUILT_IN_DETERMINISTIC_CALCULATOR" &&
    nonEmptyString(model.source_ref) &&
    exactId(model.model_version_id) &&
    exactId(model.model_version) &&
    exactId(model.model_artifact_id) &&
    exactId(model.model_artifact_version) &&
    exactId(model.engine_id) &&
    exactId(model.parameter_set_id) &&
    exactId(model.parameter_set_version)
  );
}

function financeValidation(value: unknown): boolean {
  const validation = record(value);
  return (
    validation !== null &&
    hasExactKeys(validation, ["status", "reasons"]) &&
    (validation.status === "VALID" || validation.status === "UNKNOWN") &&
    stringArray(validation.reasons) &&
    (validation.status === "VALID" || validation.reasons.length > 0)
  );
}

function financeNoWrite(value: unknown): boolean {
  const noWrite = record(value);
  const fields = [
    "enterprise_state",
    "settlement_result",
    "score",
    "rank",
    "replay_truth",
    "canonical_decision",
    "official_parameter_set",
    "formal_writer",
    "provider_invoked"
  ];
  return (
    noWrite !== null &&
    hasExactKeys(noWrite, fields) &&
    fields.every((field) => noWrite[field] === false)
  );
}

function financeDebt(value: unknown): boolean {
  const debt = record(value);
  return (
    debt !== null &&
    hasExactKeys(debt, ["principal", "interest_paid", "amortization", "debt_service"]) &&
    financeBasis(debt.principal) &&
    financeBasis(debt.interest_paid) &&
    financeBasis(debt.amortization) &&
    financeBasis(debt.debt_service)
  );
}

function unknownFinanceBasis(value: unknown): boolean {
  const basis = record(value);
  return (
    basis !== null &&
    financeBasis(basis) &&
    basis.status === "UNKNOWN" &&
    basis.amount === null &&
    nonEmptyString(basis.unknown_reason)
  );
}

function financeDscr(value: unknown): boolean {
  const dscr = record(value);
  const numerator = record(dscr?.numerator);
  const denominator = record(dscr?.denominator);
  const knownBasesMatchRatio =
    dscr?.status !== "KNOWN" ||
    (numerator !== null &&
      denominator !== null &&
      numerator.status === "KNOWN" &&
      denominator.status === "KNOWN" &&
      finiteNumber(numerator.amount) &&
      finiteNumber(denominator.amount) &&
      numerator.time_period === denominator.time_period &&
      Number(denominator.amount) > 0 &&
      finiteNumber(dscr.ratio) &&
      Math.abs(Number(dscr.ratio) - Number(numerator.amount) / Number(denominator.amount)) <=
        Math.max(1, Math.abs(Number(dscr.ratio))) * 1e-9);
  return (
    dscr !== null &&
    hasExactKeys(
      dscr,
      ["ratio", "status", "numerator", "denominator", "source_refs"],
      ["unknown_reason"]
    ) &&
    (dscr.ratio === null || finiteNumber(dscr.ratio)) &&
    financeStatus(dscr.status) &&
    financeBasis(dscr.numerator) &&
    financeBasis(dscr.denominator) &&
    stringArray(dscr.source_refs, 1) &&
    knownBasesMatchRatio &&
    (dscr.status === "KNOWN"
      ? finiteNumber(dscr.ratio)
      : dscr.ratio === null && nonEmptyString(dscr.unknown_reason))
  );
}

function unknownFinanceDscr(value: unknown): boolean {
  const dscr = record(value);
  return (
    dscr !== null &&
    financeDscr(dscr) &&
    dscr.status === "UNKNOWN" &&
    dscr.ratio === null &&
    nonEmptyString(dscr.unknown_reason)
  );
}

function financeStressRegime(value: unknown): boolean {
  const regime = record(value);
  return (
    regime !== null &&
    hasExactKeys(regime, [
      "regime_id",
      "shock",
      "cash_flow",
      "liquidity_headroom",
      "covenant_status",
      "feasibility",
      "binding_constraints",
      "why_not_feasible"
    ]) &&
    ["DEMAND_PRICE_DOWNSIDE", "WORKFORCE_CAPACITY_PRESSURE", "FUNDING_COVENANT_PRESSURE"].includes(
      String(regime.regime_id)
    ) &&
    nonEmptyString(regime.shock) &&
    financeBasis(regime.cash_flow) &&
    financeBasis(regime.liquidity_headroom) &&
    financeCovenantStatus(regime.covenant_status) &&
    financeFeasibility(regime.feasibility) &&
    stringArray(regime.binding_constraints) &&
    stringArray(regime.why_not_feasible)
  );
}

function unknownFinanceStressRegime(value: unknown): boolean {
  const regime = record(value);
  return (
    regime !== null &&
    financeStressRegime(regime) &&
    unknownFinanceBasis(regime.cash_flow) &&
    unknownFinanceBasis(regime.liquidity_headroom) &&
    regime.covenant_status === "UNKNOWN" &&
    regime.feasibility === "UNKNOWN"
  );
}

function hasFinanceConstraint(value: unknown, constraint: string): boolean {
  return Array.isArray(value) && value.includes(constraint);
}

function knownFinanceBasisValue(value: unknown): boolean {
  const basis = record(value);
  return basis !== null && financeBasis(basis) && basis.status === "KNOWN";
}

function financeFeasibleEvidenceIsComplete(projection: Record<string, unknown>): boolean {
  const debt = record(projection.debt);
  const dscr = record(projection.dscr);
  if (debt === null || dscr === null) return false;
  const knownBaseEvidence = [
    projection.capex,
    projection.opex,
    projection.cash_flow,
    projection.liquidity_headroom,
    projection.capital_budget_utilization,
    debt.debt_service
  ].every(knownFinanceBasisValue);
  const dscrIsKnownOrNotApplicable =
    dscr.status === "KNOWN" ||
    (dscr.status === "UNKNOWN" &&
      dscr.unknown_reason === "NO_DEBT_SERVICE" &&
      knownFinanceBasisValue(dscr.denominator) &&
      (dscr.denominator as Record<string, unknown>).amount === 0);
  return knownBaseEvidence && dscrIsKnownOrNotApplicable;
}

function financeStressConclusionIdentities(value: unknown): boolean {
  const regime = record(value);
  const liquidity = record(regime?.liquidity_headroom);
  const bindingConstraints = regime?.binding_constraints;
  const whyNotFeasible = regime?.why_not_feasible;
  if (regime === null || liquidity === null) return false;
  if (liquidity.status === "KNOWN") {
    if (!finiteNumber(liquidity.amount)) return false;
    if (liquidity.amount < 0 && regime.covenant_status !== "BREACHED") return false;
  } else if (liquidity.status === "UNKNOWN" && regime.covenant_status === "WITHIN_LIMIT") {
    return false;
  }
  if (regime.feasibility === "FEASIBLE") {
    return (
      regime.covenant_status === "WITHIN_LIMIT" &&
      stringArray(bindingConstraints) &&
      bindingConstraints.length === 0 &&
      stringArray(whyNotFeasible) &&
      whyNotFeasible.length === 0
    );
  }
  if (regime.feasibility === "INFEASIBLE") {
    return stringArray(bindingConstraints, 1) && stringArray(whyNotFeasible, 1);
  }
  return stringArray(whyNotFeasible, 1);
}

function financeConclusionIdentities(projection: Record<string, unknown>): boolean {
  const liquidity = record(projection.liquidity_headroom);
  const budget = record(projection.capital_budget_utilization);
  const dscr = record(projection.dscr);
  const bindingConstraints = projection.binding_constraints;
  const whyNotFeasible = projection.why_not_feasible;
  if (liquidity === null || budget === null || dscr === null) return false;

  if (liquidity.status === "KNOWN") {
    if (!finiteNumber(liquidity.amount)) return false;
    if (liquidity.amount < 0 && projection.covenant_status !== "BREACHED") return false;
  } else if (liquidity.status === "UNKNOWN" && projection.covenant_status === "WITHIN_LIMIT") {
    return false;
  }
  if (
    projection.covenant_status === "BREACHED" &&
    (!hasFinanceConstraint(bindingConstraints, "COVENANT_MIN_CASH_BREACH") ||
      projection.feasibility !== "INFEASIBLE")
  ) {
    return false;
  }
  if (budget.status === "KNOWN") {
    if (!finiteNumber(budget.amount) || budget.amount < 0) return false;
    const overBudget = budget.amount > 1;
    if (
      overBudget !== hasFinanceConstraint(bindingConstraints, "CAPITAL_BUDGET_EXCEEDED") ||
      (overBudget && projection.feasibility !== "INFEASIBLE")
    ) {
      return false;
    }
  }
  if (dscr.status === "KNOWN") {
    if (!finiteNumber(dscr.ratio)) return false;
    const undercovered = dscr.ratio < 1;
    if (
      undercovered !== hasFinanceConstraint(bindingConstraints, "DSCR_BELOW_MINIMUM_COVERAGE") ||
      (undercovered && projection.feasibility !== "INFEASIBLE")
    ) {
      return false;
    }
  }
  if (projection.feasibility === "FEASIBLE") {
    if (!financeFeasibleEvidenceIsComplete(projection)) return false;
    return (
      projection.covenant_status === "WITHIN_LIMIT" &&
      stringArray(bindingConstraints) &&
      bindingConstraints.length === 0 &&
      stringArray(whyNotFeasible) &&
      whyNotFeasible.length === 0
    );
  }
  return stringArray(bindingConstraints, 1) && stringArray(whyNotFeasible, 1);
}

function financeStudentProjectionMirrorsParent(
  projection: Record<string, unknown>,
  studentView: Record<string, unknown>
): boolean {
  const fullStressRegimes = projection.stress_regimes;
  const studentStressRegimes = studentView.stress_regimes;
  if (!Array.isArray(fullStressRegimes) || !Array.isArray(studentStressRegimes)) return false;
  if (
    studentView.feasibility !== projection.feasibility ||
    !financeDisplayMirrorsBasis(studentView.cash_flow, projection.cash_flow) ||
    !financeDisplayMirrorsBasis(studentView.liquidity_headroom, projection.liquidity_headroom) ||
    fullStressRegimes.length !== studentStressRegimes.length
  ) {
    return false;
  }
  return fullStressRegimes.every((fullValue, index) => {
    const full = record(fullValue);
    const student = record(studentStressRegimes[index]);
    return (
      full !== null &&
      student !== null &&
      student.regime_id === full.regime_id &&
      student.covenant_status === full.covenant_status &&
      student.feasibility === full.feasibility
    );
  });
}

function financeProjection(value: unknown): boolean {
  const projection = record(value);
  if (
    projection === null ||
    !hasExactKeys(projection, [
      "official",
      "validation",
      "no_write",
      "model",
      "input_digest",
      "source_refs",
      "capex",
      "opex",
      "capital",
      "debt",
      "cash_flow",
      "liquidity_headroom",
      "dscr",
      "capital_budget_utilization",
      "covenant_status",
      "feasibility",
      "binding_constraints",
      "why_not_feasible",
      "stress_regimes",
      "assumptions",
      "uncertainty",
      "known_limits",
      "student_view"
    ])
  ) {
    return false;
  }
  const capital = record(projection.capital);
  const stressRegimes = projection.stress_regimes;
  const structurallyValid = (
    projection.official === false &&
    financeValidation(projection.validation) &&
    financeNoWrite(projection.no_write) &&
    financeModel(projection.model) &&
    digest(projection.input_digest) &&
    stringArray(projection.source_refs, 1) &&
    financeBasis(projection.capex) &&
    financeBasis(projection.opex) &&
    capital !== null &&
    hasExactKeys(capital, ["debt_principal", "equity_proceeds", "working_capital"]) &&
    financeBasis(capital.debt_principal) &&
    financeBasis(capital.equity_proceeds) &&
    financeBasis(capital.working_capital) &&
    financeDebt(projection.debt) &&
    financeBasis(projection.cash_flow) &&
    financeBasis(projection.liquidity_headroom) &&
    financeDscr(projection.dscr) &&
    financeBasis(projection.capital_budget_utilization) &&
    financeCovenantStatus(projection.covenant_status) &&
    financeFeasibility(projection.feasibility) &&
    stringArray(projection.binding_constraints) &&
    stringArray(projection.why_not_feasible) &&
    Array.isArray(stressRegimes) &&
    stressRegimes.length === 3 &&
    stressRegimes.every(financeStressRegime) &&
    new Set(stressRegimes.map((regime) => (record(regime) as Record<string, unknown>).regime_id))
      .size === stressRegimes.length &&
    stringArray(projection.assumptions, 1) &&
    stringArray(projection.uncertainty, 1) &&
    stringArray(projection.known_limits, 1) &&
    financeStudentProjection(projection.student_view)
  );
  if (!structurallyValid) return false;
  if (!financeConclusionIdentities(projection)) return false;
  if (!stressRegimes.every(financeStressConclusionIdentities)) return false;
  const studentView = projection.student_view as Record<string, unknown>;
  if (!financeStudentProjectionMirrorsParent(projection, studentView)) return false;
  const validation = projection.validation as Record<string, unknown>;
  if (validation.status === "VALID") return true;
  const debt = record(projection.debt);
  const unknownStudentView = record(projection.student_view);
  return (
    validation.status === "UNKNOWN" &&
    stringArray(validation.reasons, 1) &&
    projection.feasibility === "UNKNOWN" &&
    projection.covenant_status === "UNKNOWN" &&
    stringArray(projection.binding_constraints, 1) &&
    unknownFinanceBasis(projection.capex) &&
    unknownFinanceBasis(projection.opex) &&
    unknownFinanceBasis(capital.debt_principal) &&
    unknownFinanceBasis(capital.equity_proceeds) &&
    unknownFinanceBasis(capital.working_capital) &&
    debt !== null &&
    unknownFinanceBasis(debt.principal) &&
    unknownFinanceBasis(debt.interest_paid) &&
    unknownFinanceBasis(debt.amortization) &&
    unknownFinanceBasis(debt.debt_service) &&
    unknownFinanceBasis(projection.cash_flow) &&
    unknownFinanceBasis(projection.liquidity_headroom) &&
    unknownFinanceDscr(projection.dscr) &&
    unknownFinanceBasis(projection.capital_budget_utilization) &&
    Array.isArray(stressRegimes) &&
    stressRegimes.every(unknownFinanceStressRegime) &&
    unknownStudentView !== null &&
    unknownStudentView.feasibility === "UNKNOWN" &&
    unknownFinanceDisplayValue(unknownStudentView.cash_flow) &&
    unknownFinanceDisplayValue(unknownStudentView.liquidity_headroom) &&
    Array.isArray(unknownStudentView.stress_regimes) &&
    unknownStudentView.stress_regimes.every(unknownFinanceStudentStressRegime)
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

function unknownFinanceStudentStressRegime(value: unknown): boolean {
  const regime = record(value);
  return (
    regime !== null &&
    financeStudentStressRegime(regime) &&
    regime.covenant_status === "UNKNOWN" &&
    regime.feasibility === "UNKNOWN"
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

function officialBaseline(value: unknown): boolean {
  const baseline = record(value);
  if (
    baseline !== null &&
    hasExactKeys(
      baseline,
      ["officiality", "outcome_id", "state_ref", "summary"],
      ["state_summary", "changed_paths"]
    ) &&
    baseline.officiality === "OFFICIAL" &&
    (baseline.outcome_id === null || exactId(baseline.outcome_id)) &&
    (baseline.state_ref === null || stateRef(baseline.state_ref)) &&
    nonEmptyString(baseline.summary) &&
    (baseline.changed_paths === undefined || stringArray(baseline.changed_paths))
  ) {
    if (baseline.state_summary === undefined) return true;
    const summary = record(baseline.state_summary);
    return (
      summary !== null &&
      hasExactKeys(summary, [
        "cash",
        "capacity",
        "product_line_count",
        "operating_unit_count",
        "project_count"
      ]) &&
      finiteNumber(summary.cash) &&
      finiteNumber(summary.capacity) &&
      Number.isSafeInteger(summary.product_line_count) &&
      Number(summary.product_line_count) >= 0 &&
      Number.isSafeInteger(summary.operating_unit_count) &&
      Number(summary.operating_unit_count) >= 0 &&
      Number.isSafeInteger(summary.project_count) &&
      Number(summary.project_count) >= 0
    );
  }
  return false;
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

function alternativePath(value: unknown): boolean {
  const path = record(value);
  const outcome = record(path?.outcome);
  return (
    path !== null &&
    hasExactKeys(path, [
      "path_id",
      "label",
      "officiality",
      "decision_ids",
      "path_digest",
      "changed_paths",
      "outcome",
      "mechanism_ids",
      "finance_feasibility"
    ]) &&
    exactId(path.path_id) &&
    nonEmptyString(path.label) &&
    path.officiality === "NON_OFFICIAL" &&
    stringArray(path.decision_ids) &&
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
    stringArray(path.mechanism_ids) &&
    financeProjection(path.finance_feasibility)
  );
}

function mechanism(value: unknown): boolean {
  const item = record(value);
  return (
    item !== null &&
    hasExactKeys(item, [
      "mechanism_id",
      "label",
      "explanation",
      "evidence_path_ids",
      "uncertainty"
    ]) &&
    exactId(item.mechanism_id) &&
    nonEmptyString(item.label) &&
    nonEmptyString(item.explanation) &&
    stringArray(item.evidence_path_ids) &&
    item.uncertainty === "OBSERVED_DIFFERENTIAL_ONLY"
  );
}

function sourceRefs(value: unknown): boolean {
  const refs = record(value);
  return (
    refs !== null &&
    hasExactKeys(refs, ["official_outcome_id", "o4_candidate_digest", "m4_candidate_digests"]) &&
    (refs.official_outcome_id === null || exactId(refs.official_outcome_id)) &&
    (refs.o4_candidate_digest === null || digest(refs.o4_candidate_digest)) &&
    Array.isArray(refs.m4_candidate_digests) &&
    refs.m4_candidate_digests.every((item) => digest(item))
  );
}

function authority(value: unknown): boolean {
  const authorityValue = record(value);
  return (
    authorityValue !== null &&
    hasExactKeys(authorityValue, [
      "runtime_authority",
      "official_realized_source",
      "writer_authority",
      "formal_truth_write",
      "settlement_write",
      "replay_truth_write",
      "provider"
    ]) &&
    authorityValue.runtime_authority === "JSON_INTERNAL_ONLY" &&
    authorityValue.official_realized_source === "SIMULATION_CORE" &&
    authorityValue.writer_authority === "SOLE_W4_ENTERPRISE_STATE_SERVICE" &&
    authorityValue.formal_truth_write === false &&
    authorityValue.settlement_write === false &&
    authorityValue.replay_truth_write === false &&
    authorityValue.provider === "OFF"
  );
}

function teacherProjection(value: unknown): boolean {
  const projection = record(value);
  return (
    projection !== null &&
    hasExactKeys(projection, [
      "surface",
      "available_actions",
      "official_baseline",
      "paths",
      "mechanisms",
      "transfer"
    ]) &&
    projection.surface === "teacher" &&
    stringArray(projection.available_actions) &&
    officialBaseline(projection.official_baseline) &&
    Array.isArray(projection.paths) &&
    projection.paths.every(alternativePath) &&
    Array.isArray(projection.mechanisms) &&
    projection.mechanisms.every(mechanism) &&
    transfer(projection.transfer)
  );
}

function adminProjection(value: unknown): boolean {
  const projection = record(value);
  if (
    projection === null ||
    !hasExactKeys(projection, [
      "surface",
      "tenant_id",
      "exact_binding",
      "source_refs",
      "officiality_counts",
      "audit",
      "finance_models"
    ])
  ) {
    return false;
  }
  const counts = record(projection.officiality_counts);
  const audit = record(projection.audit);
  const financeModels = projection.finance_models;
  const auditedPathIds = Array.isArray(financeModels)
    ? financeModels.map((item) => record(item)?.path_id)
    : [];
  return (
    projection.surface === "admin" &&
    exactId(projection.tenant_id) &&
    exactBinding(projection.exact_binding) &&
    sourceRefs(projection.source_refs) &&
    counts !== null &&
    hasExactKeys(counts, ["official", "non_official"]) &&
    counts.official === 1 &&
    Number.isSafeInteger(counts.non_official) &&
    Number(counts.non_official) >= 0 &&
    Number(counts.non_official) <= 3 &&
    audit !== null &&
    hasExactKeys(audit, ["candidate_id", "generated_by", "no_write", "recovery"]) &&
    exactId(audit.candidate_id) &&
    exactId(audit.generated_by) &&
    audit.no_write === true &&
    audit.recovery === "REPLAY_REQUEST_WITH_EXACT_BINDING" &&
    Array.isArray(financeModels) &&
    financeModels.length <= 3 &&
    financeModels.length === Number(counts?.non_official) &&
    new Set(auditedPathIds).size === auditedPathIds.length &&
    financeModels.every((item) => {
      const modelAudit = record(item);
      return (
        modelAudit !== null &&
        hasExactKeys(modelAudit, ["path_id", "model", "input_digest", "source_refs"]) &&
        exactId(modelAudit.path_id) &&
        financeModel(modelAudit.model) &&
        digest(modelAudit.input_digest) &&
        stringArray(modelAudit.source_refs, 1)
      );
    })
  );
}

function responseSurfaceBoundary(response: Record<string, unknown>): boolean {
  const surface = response.surface;
  const hasTeacherProjection = response.teacher_projection !== undefined;
  const hasStudentProjection = response.student_projection !== undefined;
  const hasAdminProjection = response.admin_projection !== undefined;

  if (surface === "teacher") {
    return (
      teacherProjection(response.teacher_projection) && !hasStudentProjection && !hasAdminProjection
    );
  }
  if (surface === "student") {
    return (
      studentProjection(response.student_projection) && !hasTeacherProjection && !hasAdminProjection
    );
  }
  if (surface === "admin") {
    return (
      adminProjection(response.admin_projection) && !hasTeacherProjection && !hasStudentProjection
    );
  }
  return false;
}

function responsePathsMatchSurface(response: Record<string, unknown>): boolean {
  if (!Array.isArray(response.paths)) return false;
  if (response.surface === "student") {
    return response.paths.every(studentAlternativePath);
  }
  return response.paths.every(alternativePath);
}

function responsePathsMatchProjection(response: Record<string, unknown>): boolean {
  if (response.surface === "admin") {
    return Array.isArray(response.paths) && response.paths.length === 0;
  }
  const projection =
    response.surface === "teacher"
      ? record(response.teacher_projection)
      : response.surface === "student"
        ? record(response.student_projection)
        : null;
  return projection !== null && canonical(response.paths) === canonical(projection.paths);
}

export function isESLResponse(value: unknown): value is ESLResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const response = value as Record<string, unknown>;
  return (
    response.schema_version === ESL_SCHEMA_VERSION &&
    exactId(response.candidate_id) &&
    ["teacher", "student", "admin"].includes(String(response.surface)) &&
    exactBinding(response.exact_binding) &&
    officialBaseline(response.official_baseline) &&
    responseSurfaceBoundary(response) &&
    responsePathsMatchSurface(response) &&
    responsePathsMatchProjection(response) &&
    Array.isArray(response.mechanisms) &&
    response.mechanisms.every(mechanism) &&
    transfer(response.transfer) &&
    sourceRefs(response.source_refs) &&
    authority(response.authority) &&
    Array.isArray(response.known_limits) &&
    response.known_limits.every((limit) => typeof limit === "string")
  );
}
