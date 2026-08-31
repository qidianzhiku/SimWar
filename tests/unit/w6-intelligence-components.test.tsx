/** @vitest-environment jsdom */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GovernedIntelligenceAuditPanel } from "../../apps/admin/src/GovernedIntelligenceAuditPanel";
import {
  GovernedIntelligenceWorkspace,
  resolveGovernedIntelligenceTeamId
} from "../../apps/teacher/src/GovernedIntelligenceWorkspace";
import {
  buildStudentCoachIdempotencyKey,
  StudentCoachPanel
} from "../../apps/student/src/StudentCoachPanel";

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

  it("preserves the formal CHRO role and rotates coach generations", () => {
    const markup = renderToStaticMarkup(
      <StudentCoachPanel
        apiBase="http://api.test"
        roleKey="CHRO"
        roundId="round_001"
        runId="run_001"
        teamId="team_001"
        tenantId="tenant_demo"
        token="token"
      />
    );
    expect(markup).toContain("Role scope: CHRO");
    expect(buildStudentCoachIdempotencyKey("run_001", "round_001", "team_001", "CHRO", 1)).toBe(
      "w6:student_coach:run_001:round_001:team_001:CHRO:1"
    );
    expect(buildStudentCoachIdempotencyKey("run_001", "round_001", "team_001", "CHRO", 1)).not.toBe(
      buildStudentCoachIdempotencyKey("run_001", "round_001", "team_001", "CHRO", 2)
    );
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

  it("resolves asynchronous and changed-run team context without losing an explicit selection", () => {
    expect(resolveGovernedIntelligenceTeamId(undefined, undefined, "", true)).toBe("");
    expect(resolveGovernedIntelligenceTeamId(undefined, ["team_001", "team_002"], "", true)).toBe(
      "team_001"
    );
    expect(
      resolveGovernedIntelligenceTeamId("team_002", ["team_001", "team_002"], "team_001", true)
    ).toBe("team_002");
    expect(
      resolveGovernedIntelligenceTeamId("team_001", ["team_001", "team_002"], "team_002", false)
    ).toBe("team_002");
    expect(resolveGovernedIntelligenceTeamId(undefined, ["team_001"], "team_old", false)).toBe(
      "team_001"
    );
  });
});
