import { describe, expect, it } from "vitest";
import type { GSIExactBinding } from "../../packages/shared-contracts/src/index.js";
import {
  compareGSICandidates,
  GSICrossRoundComparisonError,
  type GSIComparisonCandidate
} from "../../services/api/src/gsi-cross-round-comparison.js";

const baseBinding: GSIExactBinding = {
  tenant_id: "tenant_demo",
  course_id: "course_demo",
  run_id: "run_demo",
  round_id: "round_1",
  team_id: "team_demo",
  scenario_package_id: "scenario_demo",
  scenario_version: "1.0.0",
  parameter_set_id: "parameter_demo",
  parameter_set_version: "1.0.0",
  model_version_id: "model_demo",
  model_version: "1.0.0",
  model_artifact_id: "artifact_demo",
  model_artifact_version: "1.0.0"
};

function candidate(
  candidateId: string,
  roundId: string,
  roundNo: number,
  signals: GSIComparisonCandidate["signals"],
  digest = "a".repeat(64)
): GSIComparisonCandidate {
  return {
    candidate_id: candidateId,
    binding: { ...baseBinding, round_id: roundId },
    round_no: roundNo,
    candidate_digest: digest,
    signals
  };
}

describe("GSI cross-round comparator", () => {
  it("compares exact same-scope distinct rounds with deterministic movement", () => {
    const from = candidate("candidate_a", "round_1", 1, [
      { stakeholder_type: "customer", intent: "protect_demand", bounded_value: 0.2 },
      { stakeholder_type: "bank", intent: "preserve_liquidity", bounded_value: 0.4 },
      { stakeholder_type: "media", intent: "protect_reputation", bounded_value: -0.2 }
    ]);
    const to = candidate("candidate_b", "round_2", 2, [
      { stakeholder_type: "customer", intent: "protect_demand", bounded_value: 0.7 },
      { stakeholder_type: "regulator", intent: "reduce_regulatory_risk", bounded_value: 0.1 },
      { stakeholder_type: "media", intent: "protect_reputation", bounded_value: -0.2 }
    ]);
    const result = compareGSICandidates({ from, to });
    expect(result.movements).toEqual([
      {
        signal_key: "bank:preserve_liquidity",
        stakeholder_type: "bank",
        intent: "preserve_liquidity",
        from_value: 0.4,
        direction: "REMOVED"
      },
      {
        signal_key: "customer:protect_demand",
        stakeholder_type: "customer",
        intent: "protect_demand",
        from_value: 0.2,
        to_value: 0.7,
        delta: 0.5,
        direction: "INCREASED"
      },
      {
        signal_key: "media:protect_reputation",
        stakeholder_type: "media",
        intent: "protect_reputation",
        from_value: -0.2,
        to_value: -0.2,
        delta: 0,
        direction: "STABLE"
      },
      {
        signal_key: "regulator:reduce_regulatory_risk",
        stakeholder_type: "regulator",
        intent: "reduce_regulatory_risk",
        to_value: 0.1,
        direction: "NEW"
      }
    ]);
    expect(result.non_causal).toBe(true);
    expect(result.causal_proof).toBe(false);
    expect(result.comparison_digest).toBe(compareGSICandidates({ from, to }).comparison_digest);
  });

  it.each([
    [
      "same round",
      candidate("candidate_a", "round_1", 1, []),
      candidate("candidate_b", "round_1", 1, [])
    ],
    [
      "cross tenant",
      candidate("candidate_a", "round_1", 1, []),
      {
        ...candidate("candidate_b", "round_2", 2, []),
        binding: { ...baseBinding, tenant_id: "tenant_other", round_id: "round_2" }
      }
    ],
    [
      "incompatible lineage",
      candidate("candidate_a", "round_1", 1, []),
      {
        ...candidate("candidate_b", "round_2", 2, []),
        binding: { ...baseBinding, model_version: "2.0.0", round_id: "round_2" }
      }
    ]
  ])("rejects %s pair", (_name, from, to) => {
    expect(() => compareGSICandidates({ from, to })).toThrowError(
      new GSICrossRoundComparisonError("GSI_COMPARISON_INVALID")
    );
  });

  it("requires rebase when a previously observed comparison digest moved", () => {
    const from = candidate("candidate_a", "round_1", 1, []);
    const to = candidate("candidate_b", "round_2", 2, []);
    expect(() =>
      compareGSICandidates({ from, to, expected_comparison_digest: "f".repeat(64) })
    ).toThrowError(new GSICrossRoundComparisonError("GSI_REBASE_REQUIRED"));
  });
});
