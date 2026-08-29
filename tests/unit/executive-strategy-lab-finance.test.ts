import { createHash } from "node:crypto";
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
const PATH_DIGEST = "c".repeat(64);

function stateRef(id: string, digest: string, parent?: W4StateRef | null): W4StateRef {
  return {
    tenant_id: "tenant-esl",
    course_id: "course-esl",
    run_id: "run-esl",
    team_id: "team-esl",
    round_id: "round-esl",
    enterprise_state_id: id,
    version: 1,
    state_digest: digest,
    ...(parent === undefined ? {} : { parent_state_ref: parent })
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

function stateDigest(value: W4EnterpriseStateData): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function stateScope(
  ref: W4StateRef
): Pick<W4StateRef, "tenant_id" | "course_id" | "run_id" | "team_id" | "round_id"> {
  return {
    tenant_id: ref.tenant_id,
    course_id: ref.course_id,
    run_id: ref.run_id,
    team_id: ref.team_id,
    round_id: ref.round_id
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
  const sourceState = state(1000);
  const terminalState = state(1250);
  const sourceStateRef = stateRef("state-open", stateDigest(sourceState));
  const terminalStateRef = stateRef("state-close", stateDigest(terminalState), sourceStateRef);
  return {
    path_id: "path-capital",
    path_digest: PATH_DIGEST,
    source_state_ref: sourceStateRef,
    source_state_scope: stateScope(sourceStateRef),
    source_state: sourceState,
    terminal_state_ref: terminalStateRef,
    terminal_state_scope: stateScope(terminalStateRef),
    terminal_state: terminalState,
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
    expect(result.debt.interest_paid).toMatchObject({ amount: 0, status: "KNOWN" });
    expect(result.debt.debt_service).toMatchObject({ amount: 40, status: "KNOWN" });
    expect(result.dscr).toMatchObject({
      ratio: 4.5,
      status: "KNOWN",
      numerator: { amount: 180, status: "KNOWN" },
      denominator: { amount: 40, status: "KNOWN" }
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

  it("derives horizon interest from the bound cumulative state delta", () => {
    const source = state(1000);
    source.capital = capital({ interest_paid: 50 });
    const sourceStateRef = stateRef("state-open", stateDigest(source));
    const terminal = state(1250);
    terminal.capital = capital({ interest_paid: 65 });
    const terminalStateRef = stateRef(
      "state-close",
      stateDigest(terminal),
      sourceStateRef
    );
    const result = projectESLFinance(
      input({
        source_state: source,
        source_state_ref: sourceStateRef,
        source_state_scope: stateScope(sourceStateRef),
        terminal_state: terminal,
        terminal_state_ref: terminalStateRef,
        terminal_state_scope: stateScope(terminalStateRef)
      })
    );

    expect(result.debt.interest_paid).toMatchObject({ amount: 15, status: "KNOWN" });
    expect(result.debt.debt_service).toMatchObject({ amount: 55, status: "KNOWN" });
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

  it("fails closed when state data does not match its exact reference", () => {
    const result = projectESLFinance(input({ source_state: state(999) }));

    expect(result.validation.status).toBe("UNKNOWN");
    expect(result.validation.reasons).toContain("SOURCE_STATE_REF_MISMATCH");
    expect(result.feasibility).toBe("UNKNOWN");
  });

  it("fails closed when terminal state data and reference presence diverge", () => {
    const result = projectESLFinance(input({ terminal_state: null }));

    expect(result.validation.status).toBe("UNKNOWN");
    expect(result.validation.reasons).toContain("TERMINAL_STATE_BINDING_MISMATCH");
    expect(result.feasibility).toBe("UNKNOWN");
  });

  it("fails closed when terminal state data does not match its exact reference", () => {
    const result = projectESLFinance(input({ terminal_state: state(1300, false) }));

    expect(result.validation.status).toBe("UNKNOWN");
    expect(result.validation.reasons).toContain("TERMINAL_STATE_REF_MISMATCH");
    expect(result.feasibility).toBe("UNKNOWN");
  });

  it("does not reuse source capital when the exact terminal state omits capital", () => {
    const base = input();
    const terminalState = state(1250, false);
    const terminalStateRef = stateRef(
      "state-close",
      stateDigest(terminalState),
      base.source_state_ref
    );
    const result = projectESLFinance(
      {
        ...base,
        terminal_state: terminalState,
        terminal_state_ref: terminalStateRef,
        terminal_state_scope: stateScope(terminalStateRef)
      }
    );

    expect(result.capital.debt_principal).toMatchObject({ amount: null, status: "UNKNOWN" });
    expect(result.liquidity_headroom).toMatchObject({ amount: null, status: "UNKNOWN" });
    expect(result.feasibility).toBe("UNKNOWN");
  });

  it("rejects known debt-service coverage below the governed minimum", () => {
    const base = input();
    const terminalState = state(1250);
    terminalState.capital = capital({ interest_paid: 40 });
    const terminalStateRef = stateRef(
      "state-close",
      stateDigest(terminalState),
      base.source_state_ref
    );
    const result = projectESLFinance(
      {
        ...base,
        terminal_state: terminalState,
        terminal_state_ref: terminalStateRef,
        terminal_state_scope: stateScope(terminalStateRef),
        accounting_basis: accounting({ operating_cash_flow: 40, amortization: 40 })
      }
    );

    expect(result.dscr).toMatchObject({ ratio: 2 / 3, status: "KNOWN" });
    expect(result.liquidity_headroom).toMatchObject({ amount: 650, status: "KNOWN" });
    expect(result.feasibility).toBe("INFEASIBLE");
    expect(result.binding_constraints).toContain("DSCR_BELOW_MINIMUM_COVERAGE");
    expect(result.why_not_feasible).toContain("债务服务覆盖率低于最低 1.0x 约束。");
    expect(result.stress_regimes.every((regime) => regime.feasibility === "INFEASIBLE")).toBe(true);
    expect(
      result.stress_regimes.every((regime) =>
        regime.binding_constraints.includes("DSCR_BELOW_MINIMUM_COVERAGE")
      )
    ).toBe(true);
  });

  it("does not treat financing proceeds as demand cash-flow performance", () => {
    const result = projectESLFinance(
      input({
        capital_actions: [
          {
            capital_action_id: "capital-action-demand-shock",
            decision_id: "decision-demand-shock",
            decision_payload_digest: "1".repeat(64),
            tenant_id: "tenant-esl",
            course_id: "course-esl",
            run_id: "run-esl",
            team_id: "team-esl",
            kind: "debt",
            status: "active",
            principal: 1_000,
            term_rounds: 3,
            rate_or_cost_bps: 500,
            cost_source: "test",
            covenant_min_cash: 600,
            fees: 10,
            obligation: "term_debt",
            project_entry_id: null,
            initiative_id: null,
            policy_seam_id: null,
            created_round_no: 2,
            effective_round_no: 2,
            maturity_round_no: 5
          }
        ],
        path_cash_delta: 250
      })
    );

    const demand = result.stress_regimes[0]!;
    expect(demand.cash_flow).toMatchObject({
      amount: null,
      status: "UNKNOWN",
      unknown_reason: "DEMAND_SHOCK_OPERATING_BASIS_UNAVAILABLE"
    });
    expect(demand.liquidity_headroom).toMatchObject({ amount: null, status: "UNKNOWN" });
    expect(demand.feasibility).toBe("UNKNOWN");
    expect(demand.binding_constraints).toContain("DEMAND_SHOCK_OPERATING_BASIS_UNKNOWN");
    expect(demand.why_not_feasible).toContain("需求冲击无法与融资现金流区分，压力情景不可判定。");
    const workforce = result.stress_regimes[1]!;
    expect(workforce.cash_flow).toMatchObject({
      amount: null,
      status: "UNKNOWN",
      unknown_reason: "WORKFORCE_SHOCK_OPERATING_BASIS_UNAVAILABLE"
    });
    expect(workforce.liquidity_headroom).toMatchObject({ amount: null, status: "UNKNOWN" });
    expect(workforce.feasibility).toBe("UNKNOWN");
    expect(workforce.binding_constraints).toContain("WORKFORCE_SHOCK_OPERATING_BASIS_UNKNOWN");
    expect(workforce.why_not_feasible).toContain(
      "劳动力压力无法与融资现金流区分，压力情景不可判定。"
    );
  });

  it("fails closed when a capital action belongs to another state scope", () => {
    const result = projectESLFinance(
      input({
        capital_actions: [
          {
            capital_action_id: "capital-action-foreign-scope",
            decision_id: "decision-foreign-scope",
            decision_payload_digest: "1".repeat(64),
            tenant_id: "tenant-other",
            course_id: "course-esl",
            run_id: "run-esl",
            team_id: "team-esl",
            kind: "debt",
            status: "active",
            principal: 1_000,
            term_rounds: 3,
            rate_or_cost_bps: 500,
            cost_source: "test",
            covenant_min_cash: 600,
            fees: 10,
            obligation: "term_debt",
            project_entry_id: null,
            initiative_id: null,
            policy_seam_id: null,
            created_round_no: 2,
            effective_round_no: 2,
            maturity_round_no: 5
          }
        ]
      })
    );

    expect(result.validation.status).toBe("UNKNOWN");
    expect(result.validation.reasons).toContain("CAPITAL_ACTION_SCOPE_MISMATCH");
    expect(result.feasibility).toBe("UNKNOWN");
  });

  it("fails closed when path cash delta does not match the bound terminal state", () => {
    const result = projectESLFinance(input({ path_cash_delta: 249 }));

    expect(result.validation.status).toBe("UNKNOWN");
    expect(result.validation.reasons).toContain("PATH_CASH_DELTA_MISMATCH");
    expect(result.cash_flow).toMatchObject({
      amount: null,
      status: "UNKNOWN",
      unknown_reason: "FINANCE_INPUT_VALIDATION_FAILED"
    });
    expect(result.feasibility).toBe("UNKNOWN");
  });

  it("fails closed when a state scope does not match its exact reference", () => {
    const result = projectESLFinance(
      input({
        source_state_scope: {
          ...stateScope(stateRef("state-open", STATE_OPEN_DIGEST)),
          round_id: "other-round"
        }
      })
    );

    expect(result.validation.status).toBe("UNKNOWN");
    expect(result.validation.reasons).toContain("SOURCE_STATE_REF_MISMATCH");
    expect(result.feasibility).toBe("UNKNOWN");
  });

  it("fails closed when terminal evidence crosses the source invariant scope", () => {
    const base = input();
    const terminalStateRef = {
      ...base.terminal_state_ref!,
      tenant_id: "tenant-other"
    };
    const result = projectESLFinance(
      input({
        terminal_state_ref: terminalStateRef,
        terminal_state_scope: stateScope(terminalStateRef)
      })
    );

    expect(result.validation.status).toBe("UNKNOWN");
    expect(result.validation.reasons).toContain("SOURCE_TERMINAL_SCOPE_MISMATCH");
    expect(result.feasibility).toBe("UNKNOWN");
  });

  it("fails closed when a supplied terminal lineage does not reach the source state", () => {
    const base = input();
    const terminalStateRef = {
      ...base.terminal_state_ref!,
      parent_state_ref: stateRef("unrelated-parent", "d".repeat(64))
    };
    const result = projectESLFinance(
      input({
        terminal_state_ref: terminalStateRef,
        terminal_state_scope: stateScope(terminalStateRef)
      })
    );

    expect(result.validation.status).toBe("UNKNOWN");
    expect(result.validation.reasons).toContain("TERMINAL_STATE_LINEAGE_MISMATCH");
    expect(result.feasibility).toBe("UNKNOWN");
  });

  it("fails closed when terminal evidence has no source lineage", () => {
    const base = input();
    const terminalStateRef = {
      ...base.terminal_state_ref!,
      parent_state_ref: null
    };
    const result = projectESLFinance(
      input({
        terminal_state_ref: terminalStateRef,
        terminal_state_scope: stateScope(terminalStateRef)
      })
    );

    expect(result.validation.status).toBe("UNKNOWN");
    expect(result.validation.reasons).toContain("TERMINAL_STATE_LINEAGE_MISMATCH");
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
    const result = projectESLFinance(
      input({
        path_cash_delta: -100,
        terminal_state_ref: null,
        terminal_state_scope: null,
        terminal_state: null
      })
    );

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

  it("treats positive capex against a zero budget as a known infeasibility", () => {
    const result = projectESLFinance(
      input({ accounting_basis: accounting({ capex: 1, capital_budget: 0 }) })
    );

    expect(result.capital_budget_utilization.status).toBe("UNKNOWN");
    expect(result.feasibility).toBe("INFEASIBLE");
    expect(result.binding_constraints).toContain("CAPITAL_BUDGET_EXCEEDED");
    expect(result.binding_constraints).not.toContain("CAPITAL_BUDGET_BASIS_UNKNOWN");
  });

  it("preserves the accounting time period on accounting-derived values", () => {
    const result = projectESLFinance(
      input({ accounting_basis: accounting({ time_period: "ROUND" }) })
    );

    expect(result.capex.time_period).toBe("ROUND");
    expect(result.opex.time_period).toBe("ROUND");
    expect(result.debt.interest_paid.time_period).toBe("HORIZON");
    expect(result.debt.amortization.time_period).toBe("ROUND");
    expect(result.debt.debt_service).toMatchObject({
      amount: null,
      status: "UNKNOWN",
      time_period: "HORIZON",
      unknown_reason: "INTEREST_OR_AMORTIZATION_PERIOD_MISMATCH"
    });
    expect(result.dscr.numerator.time_period).toBe("ROUND");
    expect(result.dscr.denominator).toMatchObject({ amount: null, status: "UNKNOWN" });
    expect(result.feasibility).toBe("UNKNOWN");
    expect(result.binding_constraints).toContain("DEBT_SERVICE_BASIS_UNKNOWN");
    expect(result.capital_budget_utilization.time_period).toBe("ROUND");
  });

  it("does not treat zero debt service as missing feasibility evidence", () => {
    const source = state(1000);
    source.capital = capital({ debt_principal: 0, interest_paid: 0 });
    const sourceStateRef = stateRef("state-open", stateDigest(source));
    const terminalState = state(1250);
    terminalState.capital = capital({ debt_principal: 0, interest_paid: 0 });
    const terminalStateRef = stateRef("state-close", stateDigest(terminalState), sourceStateRef);
    const result = projectESLFinance(
      input({
        source_state: source,
        source_state_ref: sourceStateRef,
        source_state_scope: stateScope(sourceStateRef),
        terminal_state_ref: terminalStateRef,
        terminal_state_scope: stateScope(terminalStateRef),
        terminal_state: terminalState,
        accounting_basis: accounting({ amortization: 0 })
      })
    );

    expect(result.debt.debt_service).toMatchObject({ amount: 0, status: "KNOWN" });
    expect(result.dscr).toMatchObject({ ratio: null, status: "UNKNOWN" });
    expect(result.dscr.unknown_reason).toBe("NO_DEBT_SERVICE");
    expect(result.feasibility).toBe("FEASIBLE");
    expect(result.binding_constraints).not.toContain("DSCR_BASIS_UNKNOWN");
  });

  it("keeps cumulative source interest unknown without terminal evidence", () => {
    const source = state(1000);
    source.capital = capital({ debt_principal: 100, interest_paid: 55 });
    const sourceStateRef = stateRef("state-open", stateDigest(source));
    const result = projectESLFinance(
      input({
        source_state: source,
        source_state_ref: sourceStateRef,
        source_state_scope: stateScope(sourceStateRef),
        terminal_state_ref: null,
        terminal_state_scope: null,
        terminal_state: null,
        accounting_basis: accounting({ amortization: 10, operating_cash_flow: 100 })
      })
    );

    expect(result.debt.interest_paid).toMatchObject({
      amount: null,
      status: "UNKNOWN",
      unknown_reason: "INTEREST_PAID_NOT_PRESENT"
    });
    expect(result.debt.debt_service.status).toBe("UNKNOWN");
    expect(result.dscr).toMatchObject({ ratio: null, status: "UNKNOWN" });
    expect(result.feasibility).toBe("UNKNOWN");
  });

  it("keeps known zero payments feasible across a round-scoped accounting basis", () => {
    const source = state(1000);
    source.capital = capital({ debt_principal: 100, interest_paid: 0 });
    const sourceStateRef = stateRef("state-open", stateDigest(source));
    const terminalState = state(1250);
    terminalState.capital = capital({ debt_principal: 100, interest_paid: 0 });
    const terminalStateRef = stateRef("state-close", stateDigest(terminalState), sourceStateRef);
    const result = projectESLFinance(
      input({
        source_state: source,
        source_state_ref: sourceStateRef,
        source_state_scope: stateScope(sourceStateRef),
        terminal_state_ref: terminalStateRef,
        terminal_state_scope: stateScope(terminalStateRef),
        terminal_state: terminalState,
        accounting_basis: accounting({ time_period: "ROUND", amortization: 0 })
      })
    );

    expect(result.debt.debt_service).toMatchObject({
      amount: 0,
      status: "KNOWN",
      time_period: "ROUND"
    });
    expect(result.dscr.unknown_reason).toBe("NO_DEBT_SERVICE");
    expect(result.feasibility).toBe("FEASIBLE");
    expect(result.binding_constraints).not.toContain("DEBT_SERVICE_BASIS_UNKNOWN");
    expect(result.binding_constraints).not.toContain("DSCR_BASIS_UNKNOWN");
  });

  it("preserves a recorded covenant breach in every stress status", () => {
    const source = state(1000);
    source.capital = capital({ covenant_breach_action_ids: ["recorded-breach"] });
    const sourceStateRef = stateRef("state-open", stateDigest(source));
    const result = projectESLFinance(
      input({
        source_state: source,
        source_state_ref: sourceStateRef,
        source_state_scope: stateScope(sourceStateRef),
        terminal_state_ref: null,
        terminal_state_scope: null,
        terminal_state: null
      })
    );

    expect(result.covenant_status).toBe("BREACHED");
    expect(result.stress_regimes.every((regime) => regime.covenant_status === "BREACHED")).toBe(
      true
    );
    expect(result.stress_regimes.every((regime) => regime.feasibility === "INFEASIBLE")).toBe(true);
    expect(
      result.stress_regimes.every(
        (regime) => !regime.binding_constraints.includes("STRESSED_MINIMUM_CASH_BREACH")
      )
    ).toBe(true);
    expect(
      result.stress_regimes.every((regime) =>
        regime.why_not_feasible.every((reason) => reason !== "压力情景下最低现金约束被突破。")
      )
    ).toBe(true);
  });

  it("marks a known minimum-cash covenant breach infeasible", () => {
    const base = input();
    const terminalState = state(500);
    const terminalStateRef = stateRef(
      "state-close",
      stateDigest(terminalState),
      base.source_state_ref
    );
    const result = projectESLFinance(
      {
        ...base,
        terminal_state: terminalState,
        terminal_state_ref: terminalStateRef,
        terminal_state_scope: stateScope(terminalStateRef),
        path_cash_delta: -500
      }
    );

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
