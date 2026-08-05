import { describe, expect, it } from "vitest";
import type { SettlementResult } from "@simwar/shared-contracts";
import {
  createSettlementBusinessKey,
  createSettlementFingerprint
} from "../../services/api/src/settlement-idempotency.js";

function createResult(overrides: Partial<SettlementResult> = {}): SettlementResult {
  return {
    tenant_id: "tenant-1",
    settlement_result_id: "settlement-1",
    run_id: "run-1",
    round_id: "round-1",
    round_no: 1,
    parameter_set_id: "parameter-set-1",
    scenario_package_id: "scenario-package-1",
    replay_hash: "replay-hash-1",
    team_results: [
      {
        team_id: "team-1",
        team_name: "Team One",
        state_true: {
          market_share: 0.4,
          demand: 100,
          served_demand: 95,
          revenue: 1000,
          cost: 600,
          profit: 400,
          cash_flow: 300,
          score: 80,
          rank: 1,
          settlement_status: "settled"
        },
        state_obs: {
          demand_band: "high",
          served_demand: 95,
          revenue: 1000,
          profit_band: "healthy",
          score: 80,
          rank: 1
        },
        state_est: {
          next_round_risk: "balanced",
          explanation: "stable",
          recommended_focus: "maintain"
        }
      }
    ],
    ...overrides
  };
}

describe("settlement idempotency identity", () => {
  it("uses tenant, run, and round number as the business key", () => {
    expect(createSettlementBusinessKey(createResult())).toBe("tenant-1:run-1:1");
  });

  it("changes the fingerprint when replay-relevant outcome content changes", () => {
    const baseline = createSettlementFingerprint(createResult());
    const changed = createSettlementFingerprint(
      createResult({
        team_results: createResult().team_results.map((team) => ({
          ...team,
          state_true: { ...team.state_true, profit: 401 }
        }))
      })
    );

    expect(baseline).toMatch(/^[a-f0-9]{64}$/);
    expect(changed).toMatch(/^[a-f0-9]{64}$/);
    expect(changed).not.toBe(baseline);
  });

  it("ignores technical result id and request metadata in the fingerprint", () => {
    expect(
      createSettlementFingerprint(createResult({ settlement_result_id: "settlement-2" }))
    ).toBe(createSettlementFingerprint(createResult()));
  });
});
