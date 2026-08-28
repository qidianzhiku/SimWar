import { describe, expect, it } from "vitest";
import {
  resolveGSIProposal,
  GSIStakeholderShadowPlaneError
} from "../../services/api/src/gsi-stakeholder-shadow-plane-service.js";

const proposals = [
  {
    proposal_id: "proposal_regulator_1",
    stakeholder_type: "regulator" as const,
    intent: "reduce_regulatory_risk" as const,
    priority: 0.6,
    influence: -0.2,
    summary: "Regulatory review may slow expansion."
  },
  {
    proposal_id: "proposal_customer_1",
    stakeholder_type: "customer" as const,
    intent: "protect_demand" as const,
    priority: 0.8,
    influence: 0.4,
    summary: "Customers value predictable service."
  }
];

describe("GSI deterministic resolver", () => {
  it("orders proposals and produces bounded reproducible signals", () => {
    const first = resolveGSIProposal(proposals);
    const second = resolveGSIProposal([...proposals].reverse());

    expect(first).toEqual(second);
    expect(first.accepted_proposal_ids).toEqual(["proposal_customer_1", "proposal_regulator_1"]);
    expect(first.signals).toEqual([
      {
        signal_id: "signal_customer_1",
        stakeholder_type: "customer",
        intent: "protect_demand",
        bounded_value: 0.32,
        source_proposal_count: 1
      },
      {
        signal_id: "signal_regulator_1",
        stakeholder_type: "regulator",
        intent: "reduce_regulatory_risk",
        bounded_value: -0.12,
        source_proposal_count: 1
      }
    ]);
    expect(first.candidate_value).toBe(0.2);
    expect(first.outside_option).toBe(0.2);
    expect(first.abstentions).toEqual([]);
    expect(first.candidate_digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("abstains duplicated stakeholder intent and clamps malformed input", () => {
    const malformed = [
      ...proposals,
      { ...proposals[0], proposal_id: "proposal_regulator_2" },
      { ...proposals[1], proposal_id: "proposal_nan", influence: Number.NaN },
      { ...proposals[1], proposal_id: "proposal_over", influence: 2 }
    ];

    const result = resolveGSIProposal(malformed);
    expect(result.signals).toHaveLength(2);
    expect(result.abstentions).toEqual([
      { proposal_id: "proposal_nan", reason: "non_finite" },
      { proposal_id: "proposal_over", reason: "out_of_bounds" },
      { proposal_id: "proposal_regulator_2", reason: "duplicate" }
    ]);
    expect(result.candidate_value).toBe(0.2);
  });

  it("rejects an empty proposal set before creating a candidate", () => {
    expect(() => resolveGSIProposal([])).toThrowError(
      new GSIStakeholderShadowPlaneError("GSI_INPUT_INVALID")
    );
  });

  it("orders proposal identifiers without depending on the runtime locale", () => {
    const result = resolveGSIProposal([
      {
        proposal_id: "ä",
        stakeholder_type: "customer",
        intent: "protect_demand",
        priority: 0.8,
        influence: 0.4,
        summary: "Customers value predictable service."
      },
      {
        proposal_id: "z",
        stakeholder_type: "regulator",
        intent: "reduce_regulatory_risk",
        priority: 0.6,
        influence: -0.2,
        summary: "Regulatory review may slow expansion."
      }
    ]);

    expect(result.accepted_proposal_ids).toEqual(["z", "ä"]);
  });
});
