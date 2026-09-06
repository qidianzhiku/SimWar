import { describe, expect, it } from "vitest";
import {
  evaluateStrategicPortfolioDivergenceTransferPolicy,
  StrategicPortfolioDivergenceTransferPolicyError
} from "../../services/api/src/strategic-portfolio-divergence-transfer-policy";

const base = {
  portfolio_state_digest: "portfolio_digest_1",
  expected_portfolio_state_digest: "portfolio_digest_1",
  divergence_policy_digest: "policy_1",
  paths: [
    { path_id: "path_a", path_digest: "digest_a", officiality: "NON_OFFICIAL" as const },
    { path_id: "path_b", path_digest: "digest_b", officiality: "NON_OFFICIAL" as const }
  ]
};

describe("SP-O3 divergence transfer policy leaf", () => {
  it("keeps transfer as reflection-only and never selects a path", () => {
    const decision = evaluateStrategicPortfolioDivergenceTransferPolicy(base);
    expect(decision.status).toBe("REFLECTION_ONLY");
    expect(decision.selected_path_id).toBeNull();
    expect(decision.applies_to_next_round).toBe(false);
    expect(decision.official_write).toBe(false);
    expect(decision.settlement_write).toBe(false);
  });

  it("requires rebase when the exact portfolio epoch is stale", () => {
    const decision = evaluateStrategicPortfolioDivergenceTransferPolicy({
      ...base,
      expected_portfolio_state_digest: "stale_digest"
    });
    expect(decision.status).toBe("REBASE_REQUIRED");
    expect(decision.selected_path_id).toBeNull();
  });

  it("rejects duplicate paths instead of falling back to first/last", () => {
    expect(() =>
      evaluateStrategicPortfolioDivergenceTransferPolicy({
        ...base,
        paths: [base.paths[0], base.paths[0]]
      })
    ).toThrowError(
      new StrategicPortfolioDivergenceTransferPolicyError("SP_O3_TRANSFER_DUPLICATE_PATH")
    );
  });
});
