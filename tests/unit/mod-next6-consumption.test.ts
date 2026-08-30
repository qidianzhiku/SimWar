import { describe, expect, it } from "vitest";
import {
  createExactRef,
  stableDigest,
  executeNext6Macro,
  type Next6EvidenceInput,
  type Next6Observation
} from "../../packages/mod-support/src/index.js";

function ref(resource_id: string) {
  return createExactRef({
    resource_id,
    resource_type: "mod_reference",
    version: "1.0.0",
    content_digest: stableDigest({ resource_id, resource_type: "mod_reference", version: "1.0.0" })
  });
}

function observation(id: string, key: string, value: number, unit = "ratio"): Next6Observation {
  return {
    observation_id: id,
    key,
    value,
    unit,
    time_scope: "round-1",
    geography: "SHANGHAI",
    confidence: "MEDIUM",
    quality: "OBSERVED",
    source_ref: "source-1"
  };
}

function baseInput(overrides: Partial<Next6EvidenceInput> = {}): Next6EvidenceInput {
  const observations = [
    observation("obs-1", "liquidity", 0.8),
    observation("obs-2", "budget_utilization", 0.4),
    observation("obs-3", "dscr", 1.4, "ratio"),
    observation("obs-4", "covenant_headroom", 0.2),
    observation("obs-5", "stress_cash", 0.1),
    observation("obs-6", "transaction_feasibility", 1, "boolean")
  ];
  const fixture = {
    fixture_id: "fixture-1",
    observations,
    expected_status: "FEASIBLE"
  };
  return {
    macro_key: "M1",
    mission_id: "MOD-NEXT6-TEST",
    consumer_id: "MAIN-ESL-CAPITAL",
    requested_at: "2026-08-29T00:00:00.000Z",
    model_version: {
      model_version_id: "mod-capital-v1",
      version: "1.0.0",
      content_digest: stableDigest({ model_version_id: "mod-capital-v1", version: "1.0.0" }),
      qualification_status: "REFERENCE_ONLY",
      calibrated: false
    },
    references: [ref("source-1"), ref("model-1")],
    observations,
    consumer: {
      status: "C1_SUPPORT",
      path: "MOD_SUPPORT_CANDIDATE_COMPILER",
      actual_product_consumption: false
    },
    role_visibility: {
      teacher_fields: ["candidate", "known_limits"],
      student_fields: ["bounded_mechanisms", "uncertainty", "why_not"],
      admin_fields: ["evidence", "method_delta", "authority"]
    },
    mjp_fixtures: [
      fixture,
      { ...fixture, fixture_id: "fixture-2" },
      { ...fixture, fixture_id: "fixture-3" }
    ],
    ...overrides
  };
}

describe("MOD Next6 consumption support", () => {
  it("moves M1 from exact State A to deterministic State B without official writes", () => {
    const result = executeNext6Macro(baseInput());

    expect(result.macro_key).toBe("M1");
    expect(result.state_transition).toEqual({ from: "STATE_A", to: "STATE_B" });
    expect(result.capability_status).toBe("C1_SUPPORT");
    expect(result.candidate.status).toBe("FEASIBLE");
    expect(result.candidate.metrics).toMatchObject({
      liquidity: 0.8,
      budget_utilization: 0.4,
      dscr: 1.4,
      covenant_headroom: 0.2
    });
    expect(result.authority).toMatchObject({
      official_truth_write: false,
      settlement_write: false,
      parameter_set_formal_write: false,
      provider: "OFF"
    });
    expect(result.consumer_receipt.actual_product_consumption).toBe(false);
    expect(result.consumer_receipt.integration_debt.length).toBeGreaterThan(0);
    expect(result.mjp.status).toBe("PASS");
    expect(result.mjp.fixture_count).toBe(3);
  });

  it("fails closed for missing units, stale/conflicting evidence and implicit latest", () => {
    expect(() =>
      executeNext6Macro(
        baseInput({
          references: [
            ref("source-1"),
            {
              resource_id: "model-1",
              resource_type: "mod_reference",
              version: "latest",
              content_digest: "a".repeat(64)
            }
          ],
          observations: [
            observation("obs-1", "liquidity", 0.8, ""),
            observation("obs-2", "budget_utilization", 0.4),
            { ...observation("obs-3", "dscr", 1.4), quality: "CONFLICT" }
          ]
        })
      )
    ).toThrow("NEXT6_EXACT_REFERENCE_INVALID");

    const result = executeNext6Macro(
      baseInput({
        observations: [
          observation("obs-1", "liquidity", 0.8, "ratio"),
          observation("obs-2", "budget_utilization", 0.4),
          { ...observation("obs-3", "dscr", 1.4), quality: "CONFLICT" },
          { ...observation("obs-4", "covenant_headroom", 0.2), quality: "STALE" }
        ]
      })
    );
    expect(result.candidate.status).toBe("UNKNOWN");
    expect(result.evidence.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ observation_id: "obs-3", reason: "CONFLICTING_EVIDENCE" }),
        expect.objectContaining({ observation_id: "obs-4", reason: "STALE_EVIDENCE" })
      ])
    );
    expect(result.known_limits).toEqual(expect.arrayContaining(["UNKNOWN_INPUTS_FAIL_CLOSED"]));
  });

  it("supports all six macro domains with role-safe candidate semantics", () => {
    const keys = ["M1", "M2", "M3", "M4", "M5", "M6"] as const;
    for (const macro_key of keys) {
      const input = baseInput({
        macro_key,
        observations: [
          observation("obs-a", "cohort_fit", 0.7),
          observation("obs-b", "outside_option", 0.3),
          observation("obs-c", "price_sensitivity", 0.5),
          observation("obs-d", "trust", 0.8),
          observation("obs-e", "service_capacity", 100, "units"),
          observation("obs-f", "demand", 80, "units"),
          observation("obs-g", "workforce_capacity", 100, "units"),
          observation("obs-h", "skill_coverage", 0.9),
          observation("obs-i", "quality_threshold", 0.8),
          observation("obs-j", "baseline_outcome", 0.6),
          observation("obs-k", "uncertainty_low", 0.5),
          observation("obs-l", "uncertainty_high", 0.7),
          observation("obs-m", "what_if_outcome", 0.65),
          observation("obs-n", "stock", 100, "units"),
          observation("obs-o", "flow", 20, "units_per_round"),
          observation("obs-p", "lag_rounds", 2, "rounds"),
          observation("obs-q", "feedback", 0.4),
          observation("obs-r", "freshness_days", 2, "days"),
          observation("obs-s", "holdout_error", 0.1),
          observation("obs-t", "reality_gap", 0.1),
          observation("obs-u", "ood_score", 0.1)
        ]
      });
      const result = executeNext6Macro(input);
      expect(result.macro_key).toBe(macro_key);
      expect(result.state_transition.to).toBe("STATE_B");
      expect(result.authority.official_truth_write).toBe(false);
      expect(result.role_visibility.student.fields).not.toContain("evidence");
      expect(result.model_version.calibrated).toBe(false);
    }
  });
});
