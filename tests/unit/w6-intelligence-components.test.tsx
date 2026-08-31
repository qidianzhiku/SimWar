/** @vitest-environment jsdom */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GovernedIntelligenceAuditPanel } from "../../apps/admin/src/GovernedIntelligenceAuditPanel";
import { GovernedIntelligenceWorkspace } from "../../apps/teacher/src/GovernedIntelligenceWorkspace";
import { StudentCoachPanel } from "../../apps/student/src/StudentCoachPanel";

describe("W6 governed intelligence product components", () => {
  it("renders the Teacher copilot, rubric and bounded challenge actions with exact context", () => {
    const markup = renderToStaticMarkup(
      <GovernedIntelligenceWorkspace
        apiBase="http://api.test"
        roundId="round_001"
        runId="run_001"
        teamId="team_001"
        tenantId="tenant_demo"
        token="token"
      />
    );
    expect(markup).toContain("Teacher Copilot");
    expect(markup).toContain("Debrief Rubric Assistant");
    expect(markup).toContain("Competitive Challenge");
    expect(markup).toContain("Stakeholder Challenge");
    expect(markup).toContain("run_001");
    expect(markup).toContain("advisory-only");
    expect(markup).toContain("Provider OFF");
    expect(markup).not.toContain("state_true");
    expect(markup).not.toContain("SettlementResult");
  });

  it("renders a Student Coach action with a visible human-authority boundary", () => {
    const markup = renderToStaticMarkup(
      <StudentCoachPanel
        apiBase="http://api.test"
        roleKey="CEO"
        roundId="round_001"
        runId="run_001"
        teamId="team_001"
        tenantId="tenant_demo"
        token="token"
      />
    );
    expect(markup).toContain("Student Coach");
    expect(markup).toContain("CEO");
    expect(markup).toContain("Human review remains the final authority");
    expect(markup).toContain("evidence citation");
    expect(markup).not.toContain("state_true");
    expect(markup).not.toContain("formal truth");
  });

  it("renders an Admin read-only audit projection without a mutation action", () => {
    const markup = renderToStaticMarkup(
      <GovernedIntelligenceAuditPanel
        apiBase="http://api.test"
        tenantId="tenant_demo"
        token="token"
      />
    );
    expect(markup).toContain("Governed Intelligence Audit");
    expect(markup).toContain("read-only");
    expect(markup).toContain("Provider OFF");
    expect(markup).not.toContain("生成建议");
    expect(markup).not.toContain("创建");
  });
});
