import { describe, expect, it } from "vitest";
import type { M4TeacherPathProjection, W4StrategicPortfolioProjection } from "@simwar/shared-contracts";
import {
  createStrategicPortfolioDivergenceAnalysis,
  StrategicPortfolioDivergenceAnalysisError
} from "../../services/api/src/strategic-portfolio-divergence-analysis";

const scope = {
  tenant_id: "tenant_demo",
  course_id: "course_demo",
  run_id: "run_demo",
  team_id: "team_demo",
  round_no: 2
};

const baseline: W4StrategicPortfolioProjection = {
  schema_version: "w4-strategic-portfolio.v1",
  candidate_status: "DERIVED",
  portfolio_id: "portfolio_demo",
  portfolio_ref: { ...scope, portfolio_digest: "portfolio_digest_1" },
  exact_scope: scope,
  members: [],
  allocations: [],
  constraints: {
    status: "WITHIN_LIMIT",
    cash_available: 1000,
    covenant_min_cash: 100,
    total_project_cost: 0,
    allocated_capital_principal: 0,
    unfunded_project_cost: 0,
    dependency_project_entry_ids: []
  },
  persistence: {
    official_state_authority: "W4_ENTERPRISE_STATE_SERVICE",
    opening_state_ref: null,
    closing_state_ref: null,
    next_opening_state_ref: null,
    historical_decision_reentry: false
  },
  writer_authority: "SOLE_W4_ENTERPRISE_STATE_SERVICE",
  known_limits: ["fixture baseline"]
};

function path(pathId: string, digest: string): M4TeacherPathProjection {
  return {
    path_id: pathId,
    label: pathId,
    officiality: "NON_OFFICIAL",
    decision_ids: [`decision_${pathId}`],
    decision_payload_bindings: [],
    path_digest: digest,
    rounds: [],
    mechanism_differential: {
      changed_paths: [`mechanism_${pathId}`],
      changed_path_count: 1,
      interpretation: "DETERMINISTIC_STATE_TRANSITION_DIFFERENTIAL"
    },
    outcome_differential: {
      baseline: "OFFICIAL_SOURCE_CLOSING_STATE",
      cash_delta: -10,
      capacity_delta: 2,
      project_count_delta: 1,
      terminal_state_ref: {
        tenant_id: scope.tenant_id,
        course_id: scope.course_id,
        run_id: scope.run_id,
        team_id: scope.team_id,
        round_id: "round_2",
        enterprise_state_id: `state_${pathId}`,
        version: 1,
        state_digest: "a".repeat(64)
      },
      terminal_state_digest: "a".repeat(64)
    }
  };
}

describe("SP-O3 divergence analysis leaf", () => {
  it("binds exact W4 baseline and bounded non-official paths without a winner", () => {
    const result = createStrategicPortfolioDivergenceAnalysis({
      baseline,
      paths: [path("path_a", "digest_a"), path("path_b", "digest_b")],
      divergence_policy_digest: "policy_1",
      expected_portfolio_state_digest: "portfolio_digest_1"
    });
    expect(result.exact_portfolio.portfolio_digest).toBe("portfolio_digest_1");
    expect(result.non_official_paths).toHaveLength(2);
    expect(result.policy.no_winner_selection).toBe(true);
    expect(result.dimension_evidence.find((item) => item.dimension === "cash")?.status).toBe("PROVEN");
    expect(result.dimension_evidence.find((item) => item.dimension === "path_members")?.status).toBe("NOT_PROVEN");
    expect(JSON.stringify(result)).not.toMatch(/"(winner|score|rank)"\s*:/i);
  });

  it("fails closed when the expected portfolio digest is stale", () => {
    expect(() =>
      createStrategicPortfolioDivergenceAnalysis({
        baseline,
        paths: [path("path_a", "digest_a"), path("path_b", "digest_b")],
        divergence_policy_digest: "policy_1",
        expected_portfolio_state_digest: "stale_digest"
      })
    ).toThrowError(
      new StrategicPortfolioDivergenceAnalysisError("SP_O3_REBASE_REQUIRED")
    );
  });

  it("rejects official path re-entry", () => {
    expect(() =>
      createStrategicPortfolioDivergenceAnalysis({
        baseline,
        paths: [{ ...path("path_a", "digest_a"), officiality: "OFFICIAL" }, path("path_b", "digest_b")],
        divergence_policy_digest: "policy_1"
      })
    ).toThrow("SP_O3_OFFICIAL_PATH_REENTRY");
  });
});
