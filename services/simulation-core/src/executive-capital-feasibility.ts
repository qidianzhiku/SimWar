import { createHash } from "node:crypto";
import type {
  ESLFinanceAccountingBasis,
  ESLFinanceBasis,
  ESLFinanceCovenantStatus,
  ESLFinanceDisplayValue,
  ESLFinanceFeasibility,
  ESLFinanceModelIdentity,
  ESLFinanceProjection,
  ESLFinanceProjectionInput,
  ESLFinanceStateScope,
  ESLFinanceStressRegime,
  W4CapitalAction,
  W4CapitalPosition,
  W4StateRef
} from "@simwar/shared-contracts";
import type { W4EnterpriseStateData } from "@simwar/shared-contracts";

const CURRENCY_UNIT = "SIMWAR_CURRENCY" as const;
const CURRENCY = "SIMWAR_UNITS" as const;
const NO_WRITE = {
  enterprise_state: false,
  settlement_result: false,
  score: false,
  rank: false,
  replay_truth: false,
  canonical_decision: false,
  official_parameter_set: false,
  formal_writer: false,
  provider_invoked: false
} as const;
const EXACT_ID = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/;
const BANNED_ID =
  /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i;
const DIGEST = /^[a-f0-9]{64}$/;

export const ESL_FINANCE_MODEL_IDENTITY: ESLFinanceModelIdentity = Object.freeze({
  source_kind: "BUILT_IN_DETERMINISTIC_CALCULATOR",
  source_ref: "services/simulation-core/src/executive-capital-feasibility.ts",
  model_version_id: "esl-finance-projector",
  model_version: "1.0.0",
  model_artifact_id: "esl-finance-projector",
  model_artifact_version: "1.0.0",
  engine_id: "simulation-core-esl-finance-projector",
  parameter_set_id: "esl-finance-projector-parameters",
  parameter_set_version: "1.0.0"
}) as ESLFinanceModelIdentity;

function stable(value: unknown): string {
  if (value === undefined) return "null";
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
    .join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value), "utf8").digest("hex");
}

function exactId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    EXACT_ID.test(value) &&
    !BANNED_ID.test(value)
  );
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function scaled(amount: number, factor: number): number {
  return Number((amount * factor).toFixed(12));
}

function validStateRef(value: unknown): value is W4StateRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const ref = value as Record<string, unknown>;
  return (
    ["tenant_id", "course_id", "run_id", "team_id", "round_id", "enterprise_state_id"].every(
      (field) => exactId(ref[field])
    ) &&
    Number.isSafeInteger(ref.version) &&
    Number(ref.version) >= 1 &&
    typeof ref.state_digest === "string" &&
    DIGEST.test(ref.state_digest)
  );
}

function validStateScope(value: unknown): value is ESLFinanceStateScope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const scope = value as Record<string, unknown>;
  const fields = ["tenant_id", "course_id", "run_id", "team_id", "round_id"] as const;
  return (
    Object.keys(scope).length === fields.length && fields.every((field) => exactId(scope[field]))
  );
}

function stateScopeMatches(ref: W4StateRef, scope: ESLFinanceStateScope): boolean {
  return (
    ref.tenant_id === scope.tenant_id &&
    ref.course_id === scope.course_id &&
    ref.run_id === scope.run_id &&
    ref.team_id === scope.team_id &&
    ref.round_id === scope.round_id
  );
}

function stateDataDigest(state: W4EnterpriseStateData): string {
  return createHash("sha256").update(JSON.stringify(state), "utf8").digest("hex");
}

function validAccountingBasis(value: ESLFinanceAccountingBasis | undefined): boolean {
  return (
    value === undefined ||
    (exactId(value.source_ref) &&
      value.currency === CURRENCY &&
      (value.time_period === "ROUND" || value.time_period === "HORIZON") &&
      [value.capex, value.opex, value.amortization, value.capital_budget].every(
        (amount) => finite(amount) && amount >= 0
      ) &&
      finite(value.operating_cash_flow))
  );
}

function validCapitalPosition(capital: W4CapitalPosition | undefined): boolean {
  if (!capital) return true;
  return (
    [
      capital.debt_principal,
      capital.equity_proceeds,
      capital.working_capital_available,
      capital.interest_paid,
      capital.fees_paid,
      capital.covenant_min_cash
    ].every((amount) => finite(amount) && amount >= 0) &&
    capital.covenant_breach_action_ids.every(exactId) &&
    capital.active_capital_action_ids.every(exactId)
  );
}

function validState(state: W4EnterpriseStateData): boolean {
  return finite(state.cash) && finite(state.capacity) && validCapitalPosition(state.capital);
}

function validCapitalActions(actions: W4CapitalAction[]): boolean {
  return actions.every(
    (action) =>
      exactId(action.capital_action_id) &&
      exactId(action.decision_id) &&
      DIGEST.test(action.decision_payload_digest) &&
      exactId(action.tenant_id) &&
      exactId(action.course_id) &&
      exactId(action.run_id) &&
      exactId(action.team_id) &&
      finite(action.principal) &&
      action.principal >= 0 &&
      Number.isSafeInteger(action.term_rounds) &&
      action.term_rounds >= 1 &&
      finite(action.rate_or_cost_bps) &&
      action.rate_or_cost_bps >= 0 &&
      finite(action.covenant_min_cash) &&
      action.covenant_min_cash >= 0 &&
      finite(action.fees) &&
      action.fees >= 0
  );
}

function sourceRef(ref: W4StateRef): string {
  return `w4_state:${ref.enterprise_state_id}@${ref.state_digest}`;
}

function inputSourceRefs(input: ESLFinanceProjectionInput): string[] {
  const refs = [sourceRef(input.source_state_ref), `m4_path:${input.path_id}@${input.path_digest}`];
  if (input.terminal_state_ref) refs.push(sourceRef(input.terminal_state_ref));
  if (input.accounting_basis) refs.push(`accounting:${input.accounting_basis.source_ref}`);
  refs.push(
    ...input.capital_actions.map(
      (action) => `w4_capital_action:${action.capital_action_id}@${action.decision_payload_digest}`
    )
  );
  return [...new Set(refs)].sort();
}

function basis(
  amount: number | null,
  unit: ESLFinanceBasis["unit"],
  sourceRefs: string[],
  timePeriod: ESLFinanceBasis["time_period"],
  unknownReason?: string
): ESLFinanceBasis {
  const refs = [...new Set(sourceRefs)].sort();
  if (amount !== null && finite(amount)) {
    return {
      amount,
      status: "KNOWN",
      unit,
      currency: unit === CURRENCY_UNIT ? CURRENCY : "NOT_APPLICABLE",
      time_period: timePeriod,
      source_refs: refs
    };
  }
  return {
    amount: null,
    status: "UNKNOWN",
    unit,
    currency: unit === CURRENCY_UNIT ? "UNKNOWN" : "NOT_APPLICABLE",
    time_period: timePeriod,
    source_refs: refs,
    unknown_reason: unknownReason ?? "SOURCE_BASIS_UNAVAILABLE"
  };
}

function display(value: ESLFinanceBasis): ESLFinanceDisplayValue {
  return {
    amount: value.amount,
    status: value.status,
    unit: value.unit,
    ...(value.unknown_reason ? { unknown_reason: value.unknown_reason } : {})
  };
}

function capitalNumber(
  capital: W4CapitalPosition | undefined,
  key: keyof W4CapitalPosition
): number | null {
  const value = capital?.[key];
  return finite(value) ? value : null;
}

function unknownProjection(
  input: ESLFinanceProjectionInput,
  sourceRefs: string[],
  reasons: string[]
): ESLFinanceProjection {
  const unknown = (
    unit: ESLFinanceBasis["unit"],
    period: ESLFinanceBasis["time_period"],
    reason: string
  ) => basis(null, unit, sourceRefs, period, reason);
  const unknownCash = unknown(CURRENCY_UNIT, "HORIZON", "FINANCE_INPUT_VALIDATION_FAILED");
  const unknownRatio = unknown("RATIO", "HORIZON", "FINANCE_INPUT_VALIDATION_FAILED");
  const dscr = {
    ratio: null,
    status: "UNKNOWN" as const,
    numerator: unknown(CURRENCY_UNIT, "HORIZON", "FINANCE_INPUT_VALIDATION_FAILED"),
    denominator: unknown(CURRENCY_UNIT, "HORIZON", "FINANCE_INPUT_VALIDATION_FAILED"),
    source_refs: sourceRefs,
    unknown_reason: "FINANCE_INPUT_VALIDATION_FAILED"
  };
  const stressRegimes = createStressRegimes("UNKNOWN", [], unknownCash, unknownCash, sourceRefs);
  const studentView = studentProjection("UNKNOWN", unknownCash, unknownCash, stressRegimes, [
    "FINANCE_INPUT_VALIDATION_FAILED"
  ]);
  return {
    official: false,
    validation: { status: "UNKNOWN", reasons: [...new Set(reasons)].sort() },
    no_write: NO_WRITE,
    model: ESL_FINANCE_MODEL_IDENTITY,
    input_digest: digest(input),
    source_refs: sourceRefs,
    capex: unknown(CURRENCY_UNIT, "HORIZON", "FINANCE_INPUT_VALIDATION_FAILED"),
    opex: unknown(CURRENCY_UNIT, "HORIZON", "FINANCE_INPUT_VALIDATION_FAILED"),
    capital: {
      debt_principal: unknown(CURRENCY_UNIT, "HORIZON", "FINANCE_INPUT_VALIDATION_FAILED"),
      equity_proceeds: unknown(CURRENCY_UNIT, "HORIZON", "FINANCE_INPUT_VALIDATION_FAILED"),
      working_capital: unknown(CURRENCY_UNIT, "ROUND", "FINANCE_INPUT_VALIDATION_FAILED")
    },
    debt: {
      principal: unknown(CURRENCY_UNIT, "HORIZON", "FINANCE_INPUT_VALIDATION_FAILED"),
      interest_paid: unknown(CURRENCY_UNIT, "HORIZON", "FINANCE_INPUT_VALIDATION_FAILED"),
      amortization: unknown(CURRENCY_UNIT, "HORIZON", "FINANCE_INPUT_VALIDATION_FAILED"),
      debt_service: unknown(CURRENCY_UNIT, "HORIZON", "FINANCE_INPUT_VALIDATION_FAILED")
    },
    cash_flow: unknownCash,
    liquidity_headroom: unknown(CURRENCY_UNIT, "ROUND", "FINANCE_INPUT_VALIDATION_FAILED"),
    dscr,
    capital_budget_utilization: unknownRatio,
    covenant_status: "UNKNOWN",
    feasibility: "UNKNOWN",
    binding_constraints: ["FINANCE_INPUT_VALIDATION_FAILED"],
    why_not_feasible: ["财务输入精确性校验失败，未生成可行性结论。"],
    stress_regimes: stressRegimes,
    assumptions: ["无效输入不会被零值、默认值或最新值替代。"],
    uncertainty: ["该候选输入未通过 exact binding/model/finite 校验。"],
    known_limits: [...new Set(["FINANCE_INPUT_VALIDATION_FAILED", ...reasons])].sort(),
    student_view: studentView
  };
}

function covenantStatus(
  headroom: ESLFinanceBasis,
  capital: W4CapitalPosition | undefined
): ESLFinanceCovenantStatus {
  if ((capital?.covenant_breach_action_ids ?? []).length > 0) return "BREACHED";
  if (headroom.status !== "KNOWN" || headroom.amount === null) return "UNKNOWN";
  return headroom.amount < 0 ? "BREACHED" : "WITHIN_LIMIT";
}

function stressCovenant(
  headroom: ESLFinanceBasis,
  baseCovenant: ESLFinanceCovenantStatus
): ESLFinanceCovenantStatus {
  if (baseCovenant === "BREACHED") return "BREACHED";
  if (headroom.status !== "KNOWN" || headroom.amount === null) return "UNKNOWN";
  return headroom.amount < 0 ? "BREACHED" : "WITHIN_LIMIT";
}

function stressFeasibility(
  base: ESLFinanceFeasibility,
  covenant: ESLFinanceCovenantStatus,
  cashFlowKnown = true
): ESLFinanceFeasibility {
  if (covenant === "BREACHED") return "INFEASIBLE";
  if (base === "INFEASIBLE") return "INFEASIBLE";
  if (!cashFlowKnown) return "UNKNOWN";
  return base === "FEASIBLE" ? "FEASIBLE" : "UNKNOWN";
}

function createStressRegimes(
  baseFeasibility: ESLFinanceFeasibility,
  baseConstraints: string[],
  baseCashFlow: ESLFinanceBasis,
  baseLiquidity: ESLFinanceBasis,
  sourceRefs: string[],
  debtPrincipal: number | null = null,
  baseCovenant: ESLFinanceCovenantStatus = "UNKNOWN",
  demandShockBasisAvailable = true
): ESLFinanceStressRegime[] {
  const stressedCash = (amount: number | null, reason: string) =>
    basis(amount, CURRENCY_UNIT, sourceRefs, "HORIZON", reason);
  const stressedLiquidity = (cash: ESLFinanceBasis) => {
    if (
      baseCashFlow.status !== "KNOWN" ||
      baseCashFlow.amount === null ||
      baseLiquidity.status !== "KNOWN" ||
      baseLiquidity.amount === null ||
      cash.status !== "KNOWN" ||
      cash.amount === null
    ) {
      return basis(null, CURRENCY_UNIT, sourceRefs, "ROUND", "BASE_CASH_FLOW_OR_LIQUIDITY_UNKNOWN");
    }
    return basis(
      baseLiquidity.amount + cash.amount - baseCashFlow.amount,
      CURRENCY_UNIT,
      sourceRefs,
      "ROUND"
    );
  };
  const demandCash =
    demandShockBasisAvailable && baseCashFlow.status === "KNOWN" && baseCashFlow.amount !== null
      ? stressedCash(
          scaled(baseCashFlow.amount, baseCashFlow.amount < 0 ? 1.2 : 0.8),
          "DEMAND_PRICE_DOWNSIDE_SHOCK"
        )
      : stressedCash(
          null,
          demandShockBasisAvailable
            ? "BASE_CASH_FLOW_UNKNOWN"
            : "DEMAND_SHOCK_OPERATING_BASIS_UNAVAILABLE"
        );
  const workforceCash =
    demandShockBasisAvailable && baseCashFlow.status === "KNOWN" && baseCashFlow.amount !== null
      ? stressedCash(
          scaled(baseCashFlow.amount, baseCashFlow.amount < 0 ? 1.1 : 0.9),
          "WORKFORCE_CAPACITY_PRESSURE_SHOCK"
        )
      : stressedCash(
          null,
          demandShockBasisAvailable
            ? "BASE_CASH_FLOW_UNKNOWN"
            : "WORKFORCE_SHOCK_OPERATING_BASIS_UNAVAILABLE"
        );
  const fundingAdjustment = debtPrincipal !== null ? debtPrincipal * 0.02 : null;
  const fundingCash =
    baseCashFlow.status === "KNOWN" && baseCashFlow.amount !== null && fundingAdjustment !== null
      ? stressedCash(baseCashFlow.amount - fundingAdjustment, "FUNDING_COVENANT_PRESSURE_SHOCK")
      : stressedCash(null, "DEBT_PRINCIPAL_OR_BASE_CASH_FLOW_UNKNOWN");
  return [
    {
      id: "DEMAND_PRICE_DOWNSIDE" as const,
      shock: "需求与价格现金流下行 20%；确定性诊断，不代表概率。",
      cash: demandCash
    },
    {
      id: "WORKFORCE_CAPACITY_PRESSURE" as const,
      shock: "劳动力成本/产能压力使观察现金流下调 10%；确定性诊断。",
      cash: workforceCash
    },
    {
      id: "FUNDING_COVENANT_PRESSURE" as const,
      shock: "资金成本上升 200 bps；仅在已知债务本金时计算。",
      cash: fundingCash
    }
  ].map(({ id, shock, cash }) => {
    const operatingShockBasisUnknown =
      (id === "DEMAND_PRICE_DOWNSIDE" || id === "WORKFORCE_CAPACITY_PRESSURE") &&
      !demandShockBasisAvailable;
    const liquidity = operatingShockBasisUnknown
      ? basis(
          null,
          CURRENCY_UNIT,
          sourceRefs,
          "ROUND",
          id === "DEMAND_PRICE_DOWNSIDE"
            ? "DEMAND_SHOCK_OPERATING_BASIS_UNAVAILABLE"
            : "WORKFORCE_SHOCK_OPERATING_BASIS_UNAVAILABLE"
        )
      : stressedLiquidity(cash);
    const covenant = stressCovenant(liquidity, baseCovenant);
    const constraints = [...baseConstraints];
    const stressedLiquidityBreach =
      liquidity.status === "KNOWN" && liquidity.amount !== null && liquidity.amount < 0;
    if (stressedLiquidityBreach) constraints.push("STRESSED_MINIMUM_CASH_BREACH");
    if (operatingShockBasisUnknown) {
      constraints.push(
        id === "DEMAND_PRICE_DOWNSIDE"
          ? "DEMAND_SHOCK_OPERATING_BASIS_UNKNOWN"
          : "WORKFORCE_SHOCK_OPERATING_BASIS_UNKNOWN"
      );
    }
    const whyNotFeasible: string[] = [];
    if (stressedLiquidityBreach) whyNotFeasible.push("压力情景下最低现金约束被突破。");
    if (operatingShockBasisUnknown) {
      whyNotFeasible.push(
        id === "DEMAND_PRICE_DOWNSIDE"
          ? "需求冲击无法与融资现金流区分，压力情景不可判定。"
          : "劳动力压力无法与融资现金流区分，压力情景不可判定。"
      );
    }
    if (!whyNotFeasible.length && baseFeasibility === "INFEASIBLE") {
      whyNotFeasible.push("基础情景已触发资本或现金约束，压力情景不得恢复为可行。");
    }
    if (!whyNotFeasible.length && baseFeasibility === "UNKNOWN") {
      whyNotFeasible.push("基础资本/债务服务输入不足，压力情景不可判定。");
    }
    return {
      regime_id: id,
      shock,
      cash_flow: cash,
      liquidity_headroom: liquidity,
      covenant_status: covenant,
      feasibility: stressFeasibility(baseFeasibility, covenant, cash.status === "KNOWN"),
      binding_constraints: [...new Set(constraints)].sort(),
      why_not_feasible: whyNotFeasible
    };
  });
}

function studentProjection(
  feasibility: ESLFinanceFeasibility,
  cashFlow: ESLFinanceBasis,
  liquidity: ESLFinanceBasis,
  stressRegimes: ESLFinanceStressRegime[],
  constraints: string[]
): ESLFinanceProjection["student_view"] {
  const summary =
    feasibility === "INFEASIBLE"
      ? "该候选路径触发了资本或现金约束，不能作为正式结算结果。"
      : feasibility === "FEASIBLE"
        ? "在当前已知输入下，该候选路径通过资本可行性检查；仍需遵循官方路径。"
        : liquidity.status === "KNOWN"
          ? `该候选路径预计可用现金余量为 ${liquidity.amount}；部分资本基础尚未提供，因此可行性暂不能确认。`
          : `该候选路径的资本取舍已被消费，但因 ${constraints.join("、")}，可行性暂不能确认。`;
  return {
    official: false,
    role_safe: true,
    feasibility,
    cash_flow: display(cashFlow),
    liquidity_headroom: display(liquidity),
    capital_tradeoff_summary: summary,
    stress_regimes: stressRegimes.map(({ regime_id, covenant_status, feasibility: status }) => ({
      regime_id,
      covenant_status,
      feasibility: status
    })),
    excluded_fields: ["source_refs", "model", "debt_schedule", "private_capital_provenance"]
  };
}

export function projectESLFinance(input: ESLFinanceProjectionInput): ESLFinanceProjection {
  const sourceRefs = inputSourceRefs(input);
  const reasons: string[] = [];
  if (
    !exactId(input.path_id) ||
    !DIGEST.test(input.path_digest) ||
    !validStateRef(input.source_state_ref) ||
    (input.terminal_state_ref !== null && !validStateRef(input.terminal_state_ref))
  ) {
    reasons.push("INVALID_EXACT_BINDING");
  }
  if (validStateRef(input.source_state_ref)) {
    if (
      !validStateScope(input.source_state_scope) ||
      !stateScopeMatches(input.source_state_ref, input.source_state_scope) ||
      stateDataDigest(input.source_state) !== input.source_state_ref.state_digest
    ) {
      reasons.push("SOURCE_STATE_REF_MISMATCH");
    }
  }
  const hasTerminalRef = input.terminal_state_ref !== null;
  const hasTerminalState = input.terminal_state !== null;
  const hasTerminalScope = input.terminal_state_scope !== null;
  if (hasTerminalRef !== hasTerminalState || hasTerminalRef !== hasTerminalScope) {
    reasons.push("TERMINAL_STATE_BINDING_MISMATCH");
  } else if (hasTerminalRef && validStateRef(input.terminal_state_ref)) {
    if (
      !validStateScope(input.terminal_state_scope) ||
      !stateScopeMatches(input.terminal_state_ref, input.terminal_state_scope) ||
      stateDataDigest(input.terminal_state!) !== input.terminal_state_ref.state_digest
    ) {
      reasons.push("TERMINAL_STATE_REF_MISMATCH");
    }
  }
  if (!finite(input.path_cash_delta)) reasons.push("NONFINITE_PATH_CASH_DELTA");
  if (
    input.terminal_state !== null &&
    finite(input.source_state.cash) &&
    finite(input.terminal_state.cash) &&
    finite(input.path_cash_delta) &&
    input.path_cash_delta !== input.terminal_state.cash - input.source_state.cash
  ) {
    reasons.push("PATH_CASH_DELTA_MISMATCH");
  }
  if (!validAccountingBasis(input.accounting_basis)) reasons.push("INVALID_ACCOUNTING_BASIS");
  if (
    !validState(input.source_state) ||
    (input.terminal_state !== null && !validState(input.terminal_state))
  ) {
    reasons.push("INVALID_STATE_DATA");
  }
  if (!validCapitalActions(input.capital_actions)) reasons.push("INVALID_CAPITAL_ACTION_REFERENCE");
  if (reasons.length > 0) return unknownProjection(input, sourceRefs, reasons);

  const capital =
    input.terminal_state === null ? input.source_state.capital : input.terminal_state.capital;
  const cashFlow = basis(
    input.path_cash_delta,
    CURRENCY_UNIT,
    sourceRefs,
    "HORIZON",
    "NONFINITE_PATH_CASH_DELTA"
  );
  const accountingRefs = input.accounting_basis
    ? [...sourceRefs, `accounting:${input.accounting_basis.source_ref}`]
    : sourceRefs;
  const accountingTimePeriod = input.accounting_basis?.time_period ?? "HORIZON";
  const capex = basis(
    input.accounting_basis?.capex ?? null,
    CURRENCY_UNIT,
    accountingRefs,
    accountingTimePeriod,
    "CAPEX_BASIS_NOT_PRESENT_IN_CURRENT_W4_CONTRACT"
  );
  const opex = basis(
    input.accounting_basis?.opex ?? null,
    CURRENCY_UNIT,
    accountingRefs,
    accountingTimePeriod,
    "OPEX_BASIS_NOT_PRESENT_IN_CURRENT_W4_CONTRACT"
  );
  const debtPrincipal = basis(
    capitalNumber(capital, "debt_principal"),
    CURRENCY_UNIT,
    sourceRefs,
    "HORIZON",
    "DEBT_PRINCIPAL_NOT_PRESENT"
  );
  const equityProceeds = basis(
    capitalNumber(capital, "equity_proceeds"),
    CURRENCY_UNIT,
    sourceRefs,
    "HORIZON",
    "EQUITY_PROCEEDS_NOT_PRESENT"
  );
  const workingCapital = basis(
    capitalNumber(capital, "working_capital_available"),
    CURRENCY_UNIT,
    sourceRefs,
    "ROUND",
    "WORKING_CAPITAL_NOT_PRESENT"
  );
  const interestPaid = basis(
    capitalNumber(capital, "interest_paid"),
    CURRENCY_UNIT,
    sourceRefs,
    "HORIZON",
    "INTEREST_PAID_NOT_PRESENT"
  );
  const amortization = basis(
    input.accounting_basis?.amortization ?? null,
    CURRENCY_UNIT,
    accountingRefs,
    accountingTimePeriod,
    "AMORTIZATION_SCHEDULE_NOT_PRESENT_IN_CURRENT_W4_CONTRACT"
  );
  const knownZeroDebtService =
    interestPaid.status === "KNOWN" &&
    interestPaid.amount === 0 &&
    amortization.status === "KNOWN" &&
    amortization.amount === 0;
  const matchingDebtServicePeriod = interestPaid.time_period === amortization.time_period;
  const debtService =
    interestPaid.status === "KNOWN" &&
    interestPaid.amount !== null &&
    amortization.status === "KNOWN" &&
    amortization.amount !== null &&
    (matchingDebtServicePeriod || knownZeroDebtService)
      ? basis(
          interestPaid.amount + amortization.amount,
          CURRENCY_UNIT,
          [...interestPaid.source_refs, ...amortization.source_refs],
          knownZeroDebtService ? accountingTimePeriod : interestPaid.time_period
        )
      : basis(
          null,
          CURRENCY_UNIT,
          [...interestPaid.source_refs, ...amortization.source_refs],
          interestPaid.time_period,
          interestPaid.status === "KNOWN" &&
            interestPaid.amount !== null &&
            amortization.status === "KNOWN" &&
            amortization.amount !== null &&
            interestPaid.time_period !== amortization.time_period
            ? "INTEREST_OR_AMORTIZATION_PERIOD_MISMATCH"
            : "INTEREST_OR_AMORTIZATION_BASIS_UNAVAILABLE"
        );
  const operatingCashFlow = basis(
    input.accounting_basis?.operating_cash_flow ?? null,
    CURRENCY_UNIT,
    accountingRefs,
    accountingTimePeriod,
    "OPERATING_CASH_FLOW_BASIS_NOT_PRESENT_IN_CURRENT_W4_CONTRACT"
  );
  const dscr =
    operatingCashFlow.status === "KNOWN" &&
    operatingCashFlow.amount !== null &&
    debtService.status === "KNOWN" &&
    debtService.amount !== null &&
    debtService.amount > 0
      ? {
          ratio: operatingCashFlow.amount / debtService.amount,
          status: "KNOWN" as const,
          numerator: operatingCashFlow,
          denominator: debtService,
          source_refs: [
            ...new Set([...operatingCashFlow.source_refs, ...debtService.source_refs])
          ].sort()
        }
      : {
          ratio: null,
          status: "UNKNOWN" as const,
          numerator: operatingCashFlow,
          denominator: debtService,
          source_refs: [
            ...new Set([...operatingCashFlow.source_refs, ...debtService.source_refs])
          ].sort(),
          unknown_reason:
            debtService.status === "KNOWN" && debtService.amount === 0
              ? "NO_DEBT_SERVICE"
              : "DSCR_NUMERATOR_OR_DEBT_SERVICE_BASIS_UNAVAILABLE"
        };
  const capitalBudgetExceeded =
    input.accounting_basis !== undefined &&
    capex.status === "KNOWN" &&
    capex.amount !== null &&
    (input.accounting_basis.capital_budget === 0
      ? capex.amount > 0
      : capex.amount / input.accounting_basis.capital_budget > 1);
  const capitalBudgetUtilization =
    capex.status === "KNOWN" &&
    capex.amount !== null &&
    input.accounting_basis &&
    input.accounting_basis.capital_budget > 0
      ? basis(
          capex.amount / input.accounting_basis.capital_budget,
          "RATIO",
          accountingRefs,
          accountingTimePeriod
        )
      : basis(
          null,
          "RATIO",
          accountingRefs,
          accountingTimePeriod,
          capitalBudgetExceeded
            ? "CAPITAL_BUDGET_EXCEEDED"
            : "CAPITAL_BUDGET_AND_CAPEX_BASIS_UNAVAILABLE"
        );
  const terminalCash = finite(input.terminal_state?.cash) ? input.terminal_state.cash : null;
  const covenantMinimumCash = capitalNumber(capital, "covenant_min_cash");
  const liquidity = basis(
    terminalCash !== null && covenantMinimumCash !== null
      ? terminalCash - covenantMinimumCash
      : null,
    CURRENCY_UNIT,
    sourceRefs,
    "ROUND",
    "TERMINAL_CASH_OR_COVENANT_MINIMUM_NOT_PRESENT"
  );
  const covenant = covenantStatus(liquidity, capital);
  const constraints = [
    capex.status === "UNKNOWN" ? "CAPEX_BASIS_UNKNOWN" : null,
    opex.status === "UNKNOWN" ? "OPEX_BASIS_UNKNOWN" : null,
    debtService.status === "UNKNOWN" ? "DEBT_SERVICE_BASIS_UNKNOWN" : null,
    dscr.status === "UNKNOWN" && !(debtService.status === "KNOWN" && debtService.amount === 0)
      ? "DSCR_BASIS_UNKNOWN"
      : null,
    dscr.status === "KNOWN" && dscr.ratio !== null && dscr.ratio < 1
      ? "DSCR_BELOW_MINIMUM_COVERAGE"
      : null,
    capitalBudgetUtilization.status === "UNKNOWN" &&
    (input.accounting_basis === undefined || capex.status === "UNKNOWN")
      ? "CAPITAL_BUDGET_BASIS_UNKNOWN"
      : null,
    liquidity.status === "UNKNOWN" ? "LIQUIDITY_HEADROOM_UNKNOWN" : null,
    capitalBudgetExceeded ? "CAPITAL_BUDGET_EXCEEDED" : null
  ].filter((item): item is string => item !== null);
  if (covenant === "BREACHED") constraints.push("COVENANT_MIN_CASH_BREACH");
  const feasibility: ESLFinanceFeasibility =
    covenant === "BREACHED" ||
    constraints.includes("CAPITAL_BUDGET_EXCEEDED") ||
    constraints.includes("DSCR_BELOW_MINIMUM_COVERAGE")
      ? "INFEASIBLE"
      : constraints.length > 0
        ? "UNKNOWN"
        : "FEASIBLE";
  const stressRegimes = createStressRegimes(
    feasibility,
    constraints,
    cashFlow,
    liquidity,
    sourceRefs,
    debtPrincipal.amount,
    covenant,
    input.capital_actions.length === 0
  );
  const whyNotFeasible =
    covenant === "BREACHED"
      ? ["已知最低现金约束被突破。"]
      : constraints.includes("CAPITAL_BUDGET_EXCEEDED")
        ? ["资本支出超过已绑定的资本预算。"]
        : constraints.includes("DSCR_BELOW_MINIMUM_COVERAGE")
          ? ["债务服务覆盖率低于最低 1.0x 约束。"]
          : constraints.length > 0
            ? ["当前 W4/M4 契约没有提供完整的资本预算、经营成本或债务服务基础。"]
            : [];
  const knownLimits = [
    ...(input.accounting_basis
      ? []
      : [
          "CAPEX/OPEX/OPERATING_CASH_FLOW/AMORTIZATION/CAPITAL_BUDGET 基础在当前 W4/M4 契约中不完整。"
        ]),
    "该投影只消费一次 M4 path_cash_delta，不写入任何正式真值。",
    "压力情景为确定性诊断，不代表真实概率或正式结算。",
    ...(input.capital_actions.length > 0
      ? [
          "需求/劳动力压力无法从包含融资行动的 path_cash_delta 中隔离，相关压力现金流与流动性标记为 UNKNOWN。"
        ]
      : [])
  ];
  return {
    official: false,
    validation: { status: "VALID", reasons: [] },
    no_write: NO_WRITE,
    model: ESL_FINANCE_MODEL_IDENTITY,
    input_digest: digest(input),
    source_refs: sourceRefs,
    capex,
    opex,
    capital: {
      debt_principal: debtPrincipal,
      equity_proceeds: equityProceeds,
      working_capital: workingCapital
    },
    debt: {
      principal: debtPrincipal,
      interest_paid: interestPaid,
      amortization,
      debt_service: debtService
    },
    cash_flow: cashFlow,
    liquidity_headroom: liquidity,
    dscr,
    capital_budget_utilization: capitalBudgetUtilization,
    covenant_status: covenant,
    feasibility,
    binding_constraints: [...new Set(constraints)].sort(),
    why_not_feasible: whyNotFeasible,
    stress_regimes: stressRegimes,
    assumptions: [
      "路径 cash_delta 仅作为 M4 观察到的现金差异消费一次，不作为第二个现金写入。",
      "需求/价格、劳动力/产能、资金/契约压力是确定性诊断情景，不代表真实概率或正式结算。",
      "未提供的会计基础不以零、默认值或最新值替代。"
    ],
    uncertainty: [
      "该结果是 NON_OFFICIAL 候选投影，不能覆盖 W4 EnterpriseState 或 SettlementResult。",
      ...(input.accounting_basis
        ? []
        : [
            "当前契约未提供 CAPEX、OPEX、摊销、经营现金流和资本预算完整来源，因此可行性闭合为 UNKNOWN。"
          ])
    ],
    known_limits: [...new Set(knownLimits)].sort(),
    student_view: studentProjection(feasibility, cashFlow, liquidity, stressRegimes, constraints)
  };
}
