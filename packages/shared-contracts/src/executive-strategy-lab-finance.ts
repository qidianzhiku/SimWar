import type { W4CapitalAction, W4EnterpriseStateData, W4StateRef } from "./w4-enterprise-state.js";

export type ESLFinanceValueStatus = "KNOWN" | "UNKNOWN";
export type ESLFinanceFeasibility = "FEASIBLE" | "INFEASIBLE" | "UNKNOWN";
export type ESLFinanceCovenantStatus = "WITHIN_LIMIT" | "BREACHED" | "UNKNOWN";
export type ESLFinanceTimePeriod = "ROUND" | "HORIZON";
export type ESLFinanceUnit = "SIMWAR_CURRENCY" | "RATIO" | "BASIS_POINTS" | "ROUNDS" | "COUNT";

export interface ESLFinanceBasis {
  amount: number | null;
  status: ESLFinanceValueStatus;
  unit: ESLFinanceUnit;
  currency: "SIMWAR_UNITS" | "NOT_APPLICABLE" | "UNKNOWN";
  time_period: ESLFinanceTimePeriod;
  source_refs: string[];
  unknown_reason?: string;
}

export interface ESLFinanceDisplayValue {
  amount: number | null;
  status: ESLFinanceValueStatus;
  unit: ESLFinanceUnit;
  unknown_reason?: string;
}

export type ESLFinanceStateScope = Pick<
  W4StateRef,
  "tenant_id" | "course_id" | "run_id" | "team_id" | "round_id"
>;

export interface ESLFinanceModelIdentity {
  model_version_id: string;
  model_version: string;
  model_artifact_id: string;
  model_artifact_version: string;
  engine_id: string;
  parameter_set_id: string;
  parameter_set_version: string;
  source_kind: "BUILT_IN_DETERMINISTIC_CALCULATOR";
  source_ref: string;
}

export interface ESLFinanceAccountingBasis {
  source_ref: string;
  path_id: string;
  source_scope: ESLFinanceStateScope;
  source_digest: string;
  currency: "SIMWAR_UNITS";
  time_period: ESLFinanceTimePeriod;
  capex: number;
  opex: number;
  operating_cash_flow: number;
  amortization: number;
  capital_budget: number;
}

export interface ESLFinanceProjectionInput {
  path_id: string;
  path_digest: string;
  source_state_ref: W4StateRef;
  source_state_scope: ESLFinanceStateScope;
  source_state: W4EnterpriseStateData;
  terminal_state_ref: W4StateRef | null;
  terminal_state_scope: ESLFinanceStateScope | null;
  terminal_state: W4EnterpriseStateData | null;
  path_cash_delta: number;
  capital_actions: W4CapitalAction[];
  accounting_basis?: ESLFinanceAccountingBasis;
}

export interface ESLFinanceDebtBasis {
  principal: ESLFinanceBasis;
  interest_paid: ESLFinanceBasis;
  amortization: ESLFinanceBasis;
  debt_service: ESLFinanceBasis;
}

export interface ESLFinanceDscrBasis {
  ratio: number | null;
  status: ESLFinanceValueStatus;
  numerator: ESLFinanceBasis;
  denominator: ESLFinanceBasis;
  source_refs: string[];
  unknown_reason?: string;
}

export interface ESLFinanceStressRegime {
  regime_id: "DEMAND_PRICE_DOWNSIDE" | "WORKFORCE_CAPACITY_PRESSURE" | "FUNDING_COVENANT_PRESSURE";
  shock: string;
  cash_flow: ESLFinanceBasis;
  liquidity_headroom: ESLFinanceBasis;
  covenant_status: ESLFinanceCovenantStatus;
  feasibility: ESLFinanceFeasibility;
  binding_constraints: string[];
  why_not_feasible: string[];
}

export interface ESLFinanceStudentProjection {
  official: false;
  role_safe: true;
  feasibility: ESLFinanceFeasibility;
  cash_flow: ESLFinanceDisplayValue;
  liquidity_headroom: ESLFinanceDisplayValue;
  capital_tradeoff_summary: string;
  stress_regimes: Array<{
    regime_id: ESLFinanceStressRegime["regime_id"];
    covenant_status: ESLFinanceCovenantStatus;
    feasibility: ESLFinanceFeasibility;
  }>;
  excluded_fields: string[];
}

export interface ESLFinanceProjection {
  official: false;
  validation: { status: "VALID" | "UNKNOWN"; reasons: string[] };
  no_write: {
    enterprise_state: false;
    settlement_result: false;
    score: false;
    rank: false;
    replay_truth: false;
    canonical_decision: false;
    official_parameter_set: false;
    formal_writer: false;
    provider_invoked: false;
  };
  model: ESLFinanceModelIdentity;
  input_digest: string;
  source_refs: string[];
  capex: ESLFinanceBasis;
  opex: ESLFinanceBasis;
  capital: {
    debt_principal: ESLFinanceBasis;
    equity_proceeds: ESLFinanceBasis;
    working_capital: ESLFinanceBasis;
  };
  debt: ESLFinanceDebtBasis;
  cash_flow: ESLFinanceBasis;
  liquidity_headroom: ESLFinanceBasis;
  dscr: ESLFinanceDscrBasis;
  capital_budget_utilization: ESLFinanceBasis;
  covenant_status: ESLFinanceCovenantStatus;
  feasibility: ESLFinanceFeasibility;
  binding_constraints: string[];
  why_not_feasible: string[];
  stress_regimes: ESLFinanceStressRegime[];
  assumptions: string[];
  uncertainty: string[];
  known_limits: string[];
  student_view: ESLFinanceStudentProjection;
}
