/** @vitest-environment jsdom */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GSICrossRoundStudentProjection } from "@simwar/shared-contracts";
import { GovernedStakeholderIntelligenceProjection } from "../../apps/student/src/GovernedStakeholderIntelligenceProjection";

const comparison = {
  surface: "student",
  movements: [
    {
      stakeholder_type: "customer",
      intent: "protect_demand",
      from_value: 0.2,
      to_value: 0.7,
      delta: 0.5,
      direction: "INCREASED"
    }
  ],
  context_status: "AVAILABLE",
  non_causal: true,
  causal_proof: false,
  provider: "OFF",
  official_truth_write: false,
  known_limits: ["descriptive only"],
  recovery: "RELOAD_EXACT_CONTEXT"
} satisfies GSICrossRoundStudentProjection;

describe("GSI-XR Student experience", () => {
  it("renders an allowlisted decision-learning timeline without private provenance", () => {
    const markup = renderToStaticMarkup(
      <GovernedStakeholderIntelligenceProjection
        apiBase="http://api.test"
        tenantId="tenant_demo"
        token="token"
        initialComparison={comparison}
      />
    );
    expect(markup).toContain("查看本轮变化");
    expect(markup).toContain("INCREASED");
    expect(markup).toContain("哪些压力变了，它会怎样影响你的下一步判断？");
    expect(markup).toContain("NON-CAUSAL");
    expect(markup).not.toContain("candidate_id");
    expect(markup).not.toContain("comparison_digest");
    expect(markup).not.toContain("signal_key");
    expect(markup).not.toContain("producer_id");
  });

  it("truthfully shows pair-selection unavailable instead of an empty or ready state", () => {
    const markup = renderToStaticMarkup(
      <GovernedStakeholderIntelligenceProjection
        apiBase="http://api.test"
        tenantId="tenant_demo"
        token="token"
      />
    );
    expect(markup).toContain("PAIR_SELECTION_UNAVAILABLE");
    expect(markup).toContain("当前还没有可比较的已发布回合");
    expect(markup).not.toContain("候选 ID");
    expect(markup).not.toContain("candidate");
  });
});
