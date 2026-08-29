import { describe, expect, it } from "vitest";
import type {
  ESLFinanceAccountingBasis,
  ESLFinanceProjectionInput,
  W4CapitalPosition,
  W4EnterpriseStateData,
  W4StateRef
} from "@simwar/shared-contracts";
import {
  ESL_FINANCE_MODEL_IDENTITY,
  projectESLFinance
} from "../../services/simulation-core/src/index.js";

const STATE_OPEN_DIGEST = "a".repeat(64);
const STATE_CLOSE_DIGEST = "b".repeat(64);
const PATH_DIGEST = "c".repeat(64);

function stateRef(id: string, digest: string): W4StateRef {
  return {
    tenant_id: "tenant-esl",
    course_id: "course-esl",
    run_id: "run-esl",
    team_id: "team-esl",
    round_id: "round-esl",
    enterprise_state_id: id,
    version: 1,
    state_digest: digest
  };
}

function capital(overrides: Partial<W4CapitalPosition> = {}): W4CapitalPosition {
  return {
    debt_principal: 400,
    equity_proceeds: 800,
    working_capital_available: 500,
    interest_paid: 20,
    fees_paid: 10,
    covenant_min_cash: 600,
    covenant_breach_action_ids: [],
    active_capital_action_ids: ["capital-action-1"],
    ...overrides
  };
}

function state(cash: number, withCapital = true): W4EnterpriseStateData {
  return {
    cash,
    capacity: 100,
    ...(withCapital ? { capital: capital() } : {}),
    product_lines: ["baseline"],
    positioning: "balanced",
    organization: { team_size: 5 },
    operating_units: [],
    portfolio: { projects: [], facilities: [] }
  };
}

function accounting(overrides: Partial<ESLFinanceAccountingBasis> = {}): ESLFinanceAccountingBasis {
  return {
    source_ref: "accounting-basis-esl-1",
    currency: "SIMWAR_UNITS",
    time_period: "HORIZON",
    capex: 100,
    opex: 50,
    operating_cash_flow: 180,
    amortization: 40,
    capital_budget: 250,
    ...overrides
  };
}

function input(overrides: Partial<ESLFinanceProjectionInput> = {}): ESLFinanceProjectionInput {
  return {
    path_id: "path-capital",
    path_digest: PATH_DIGEST,
    source_state_ref: stateRef("state-open", STATE_OPEN_DIGEST),
    source_state: state(1000),
    terminal_state_ref: stateRef("state-close", STATE_CLOSE_DIGEST),
    terminal_state: state(1250, false),
    path_cash_delta: 250,
    capital_actions: [],
    accounting_basis: accounting(),
    ...overrides
  };
}

describe("projectESLFinance", () => {
  it("exposes deterministic capital arithmetic, DSCR identities, units, and no-write flags", () => {
    const result = projectESLFinance(input());

    expect(result.official).toBe(false);
    expect(result.no_write).toMatchObject({
      enterprise_state: false,
      settlement_result: false,
      score: false,
      rank: false,
      replay_truth: false,
      canonical_decision: false,
      official_parameter_set: false,
      formal_writer: false,
      provider_invoked: false
    });
    expect(result.model).toEqual(ESL_FINANCE_MODEL_IDENTITY);
    expect(result.input_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.cash_flow).toMatchObject({
      amount: 250,
      status: "KNOWN",
      unit: "SIMWAR_CURRENCY",
      currency: "SIMWAR_UNITS",
      time_period: "HORIZON"
    });
    expect(result.capital.debt_principal).toMatchObject({ amount: 400, status: "KNOWN" });
    expect(result.capital.equity_proceeds).toMatchObject({ amount: 800, status: "KNOWN" });
    expect(result.capital.working_capital).toMatchObject({ amount: 500, status: "KNOWN" });
    expect(result.capex).toMatchObject({ amount: 100, status: "KNOWN" });
    expect(result.opex).toMatchObject({ amount: 50, status: "KNOWN" });
    expect(result.debt.amortization).toMatchObject({ amount: 40, status: "KNOWN" });
    expect(result.debt.debt_service).toMatchObject({ amount: 60, status: "KNOWN" });
    expect(result.dscr).toMatchObject({
      ratio: 3,
      status: "KNOWN",
      numerator: { amount: 180, status: "KNOWN" },
      denominator: { amount: 60, status: "KNOWN" }
    });
    expect(result.capital_budget_utilization).toMatchObject({
      amount: 0.4,
      status: "KNOWN",
      unit: "RATIO",
      currency: "NOT_APPLICABLE",
      time_period: "HORIZON"
    });
    expect(result.liquidity_headroom).toMatchObject({ amount: 650, status: "KNOWN" });
    expect(result.covenant_status).toBe("WITHIN_LIMIT");
    expect(result.feasibility).toBe("FEASIBLE");
    expect(result.binding_constraints).toEqual([]);
    expect(result.student_view.official).toBe(false);
    expect(result.student_view.role_safe).toBe(true);
    expect(result.student_view.excluded_fields).toEqual(
      expect.arrayContaining(["source_refs", "model", "debt_schedule"])
    );
  });

  it("keeps unavailable accounting bases UNKNOWN instead of substituting zero or defaults", () => {
    const withoutAccounting = input();
    delete (withoutAccounting as { accounting_basis?: ESLFinanceAccountingBasis }).accounting_basis;

    const result = projectESLFinance(withoutAccounting);

    expect(result.capital.debt_principal).toMatchObject({ amount: 400, status: "KNOWN" });
    expect(result.cash_flow).toMatchObject({ amount: 250, status: "KNOWN" });
    expect(result.liquidity_headroom).toMatchObject({ amount: 650, status: "KNOWN" });
    expect(result.capex).toMatchObject({ amount: null, status: "UNKNOWN" });
    expect(result.opex).toMatchObject({ amount: null, status: "UNKNOWN" });
    expect(result.debt.amortization).toMatchObject({ amount: null, status: "UNKNOWN" });
    expect(result.debt.debt_service).toMatchObject({ amount: null, status: "UNKNOWN" });
    expect(result.dscr).toMatchObject({
      ratio: null,
      status: "UNKNOWN",
      numerator: { amount: null, status: "UNKNOWN" },
      denominator: { amount: null, status: "UNKNOWN" }
    });
    expect(result.capital_budget_utilization).toMatchObject({ amount: null, status: "UNKNOWN" });
    expect(result.dscr.numerator.unknown_reason).toEqual(expect.any(String));
    expect(result.dscr.denominator.unknown_reason).toEqual(expect.any(String));
    expect(result.feasibility).toBe("UNKNOWN");
  });

  it("fails closed for a nonfinite observed M4 path cash delta", () => {
    const result = projectESLFinance(input({ path_cash_delta: Number.NaN }));

    expect(result.validation.status).toBe("UNKNOWN");
    expect(result.cash_flow).toMatchObject({ amount: null, status: "UNKNOWN" });
    expect(result.capital.debt_principal).toMatchObject({ amount: null, status: "UNKNOWN" });
    expect(result.liquidity_headroom).toMatchObject({ amount: null, status: "UNKNOWN" });
    expect(result.feasibility).toBe("UNKNOWN");
    expect(result.known_limits.join(" ")).toContain("NONFINITE");
    expect(result.stress_regimes.every((regime) => regime.cash_flow.status === "UNKNOWN")).toBe(
      true
    );
  });

  it("fails closed for an invalid exact state reference", () => {
    const invalid = input({
      source_state_ref: stateRef("state-open", "not-a-sha256-digest")
    });

    const result = projectESLFinance(invalid);

    expect(result.validation.status).toBe("UNKNOWN");
    expect(result.validation.reasons).toEqual(expect.arrayContaining(["INVALID_EXACT_BINDING"]));
    expect(result.capex.status).toBe("UNKNOWN");
    expect(result.dscr.status).toBe("UNKNOWN");
    expect(result.feasibility).toBe("UNKNOWN");
  });

  it("reports only the verified built-in calculator identity", () => {
    const result = projectESLFinance(input());

    expect(result.model).toEqual({
      ...ESL_FINANCE_MODEL_IDENTITY,
      source_kind: "BUILT_IN_DETERMINISTIC_CALCULATOR",
      source_ref: "services/simulation-core/src/executive-capital-feasibility.ts"
    });
  });

  it("produces three deterministic bounded stress regimes without mutating the input", () => {
    const original = input();
    const snapshot = structuredClone(original);

    const first = projectESLFinance(original);
    const second = projectESLFinance(original);

    expect(original).toEqual(snapshot);
    expect(first).toEqual(second);
    expect(first.stress_regimes.map((regime) => regime.regime_id)).toEqual([
      "DEMAND_PRICE_DOWNSIDE",
      "WORKFORCE_CAPACITY_PRESSURE",
      "FUNDING_COVENANT_PRESSURE"
    ]);
    expect(first.stress_regimes.map((regime) => regime.cash_flow.amount)).toEqual([200, 225, 242]);
    expect(first.stress_regimes.map((regime) => regime.liquidity_headroom.amount)).toEqual([
      600, 625, 642
    ]);
    expect(first.stress_regimes.every((regime) => regime.feasibility === "FEASIBLE")).toBe(true);
  });

  it("makes downside shocks worsen a negative observed cash delta", () => {
    const result = projectESLFinance(input({ path_cash_delta: -100 }));

    expect(result.stress_regimes.map((regime) => regime.cash_flow.amount)).toEqual([
      -120, -110, -108
    ]);
  });

  it("preserves base capital-budget infeasibility in every stress regime", () => {
    const result = projectESLFinance(
      input({
        accounting_basis: accounting({ capex: 300, capital_budget: 250 })
      })
    );

    expect(result.feasibility).toBe("INFEASIBLE");
    expect(result.binding_constraints).toContain("CAPITAL_BUDGET_EXCEEDED");
    expect(result.why_not_feasible.length).toBeGreaterThan(0);
    expect(result.stress_regimes.every((regime) => regime.feasibility === "INFEASIBLE")).toBe(true);
    expect(
      result.stress_regimes.every((regime) =>
        regime.binding_constraints.includes("CAPITAL_BUDGET_EXCEEDED")
      )
    ).toBe(true);
    expect(result.stress_regimes.every((regime) => regime.why_not_feasible.length > 0)).toBe(true);
  });

  it("marks a known minimum-cash covenant breach infeasible", () => {
    const result = projectESLFinance(input({ terminal_state: state(500, false) }));

    expect(result.liquidity_headroom).toMatchObject({ amount: -100, status: "KNOWN" });
    expect(result.covenant_status).toBe("BREACHED");
    expect(result.feasibility).toBe("INFEASIBLE");
    expect(result.binding_constraints).toContain("COVENANT_MIN_CASH_BREACH");
    expect(result.why_not_feasible.length).toBeGreaterThan(0);
    expect(result.stress_regimes.every((regime) => regime.covenant_status === "BREACHED")).toBe(
      true
    );
  });
});
