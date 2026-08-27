/** @vitest-environment jsdom */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { W5GovernedDemandCandidateProjection } from "@simwar/shared-contracts";
import {
  W5DemandCandidatePanel,
  formatW5DemandCandidate
} from "../../apps/student/src/W5DemandCandidatePanel";

const candidate: W5GovernedDemandCandidateProjection = {
  authority_flags: {
    official_truth_write: false,
    provider_calls: 0,
    settlement_write: false
  },
  candidate_digest: "candidate-digest",
  consumer_binding_digest: "consumer-digest",
  exact_binding: true,
  feature_ownership: ["ideal_lancaster_fit", "huff_spatial_weight"],
  market_count: 2,
  market_ids: ["market-a", "market-b"],
  markets: [
    {
      market_id: "market-a",
      outside_option_share: 0.125,
      products: []
    },
    {
      market_id: "market-b",
      outside_option_share: 0.25,
      products: []
    }
  ],
  model_family: "IDEAL_POINT_LANCASTER_HUFF_SPATIAL",
  model_version_id: "model-version:o3",
  source_plane: "GOVERNED_DEMAND_CANDIDATE",
  status: "PASS"
};

describe("Student governed demand candidate panel", () => {
  it("preserves bounded candidate facts and the non-write safety boundary", () => {
    expect(formatW5DemandCandidate(candidate)).toBe(
      "受控需求候选：PASS · 市场数=2 · market-a outside=0.1250 · market-b outside=0.2500 · 该候选不写入正式真值，REALIZED 仍由 Simulation Core 负责。"
    );

    const markup = renderToStaticMarkup(<W5DemandCandidatePanel candidate={candidate} />);
    expect(markup).toContain('data-testid="student-governed-demand-candidate"');
    expect(markup).toContain("market-a outside=0.1250");
    expect(markup).toContain("REALIZED");
    expect(markup).not.toContain(candidate.candidate_digest);
    expect(markup).not.toContain(candidate.consumer_binding_digest);
  });
});
