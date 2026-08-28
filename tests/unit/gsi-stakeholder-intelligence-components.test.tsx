/** @vitest-environment jsdom */

import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import type { GSIExactBinding, GSIStudentProjection } from "@simwar/shared-contracts";
import { GovernedStakeholderIntelligenceWorkspace } from "../../apps/teacher/src/GovernedStakeholderIntelligenceWorkspace";
import { GovernedStakeholderIntelligenceAuditPanel } from "../../apps/admin/src/GovernedStakeholderIntelligenceAuditPanel";
import { GovernedStakeholderIntelligenceProjection } from "../../apps/student/src/GovernedStakeholderIntelligenceProjection";

const binding: GSIExactBinding = {
  tenant_id: "tenant_demo",
  course_id: "course_demo",
  run_id: "run_gsi",
  round_id: "round_gsi_1",
  team_id: "team_alpha",
  scenario_package_id: "scenario_eldercare_demo",
  scenario_version: "1.0.0",
  parameter_set_id: "param_toy_approved_1",
  parameter_set_version: "1.0.0",
  model_version_id: "gsi-stakeholder-resolver-v1",
  model_version: "1.0.0",
  model_artifact_id: "artifact:gsi-stakeholder-resolver-v1:1.0.0",
  model_artifact_version: "1.0.0"
};

const projection: GSIStudentProjection = {
  surface: "student",
  role_key: "CEO",
  summary: "Published role-safe stakeholder signal summary.",
  signals: [{ stakeholder_type: "customer", intent: "protect_demand", bounded_value: 0.32 }],
  abstentions: [],
  known_limits: ["Provider OFF; candidate only."]
};

describe("GSI stakeholder intelligence product components", () => {
  it("gives Teacher a freeze action and shows exact binding plus shadow limits", () => {
    const markup = renderToStaticMarkup(
      <GovernedStakeholderIntelligenceWorkspace
        apiBase="http://api.test"
        binding={binding}
        tenantId="tenant_demo"
        token="token"
      />
    );
    expect(markup).toContain("Governed Stakeholder Intelligence");
    expect(markup).toContain("冻结受控利益相关方候选");
    expect(markup).toContain("run_gsi");
    expect(markup).toContain("Provider OFF");
    expect(markup).toContain("不会写入正式状态、结算、评分或回放真值");
  });

  it("keeps Student projection free of raw proposal content", () => {
    const markup = renderToStaticMarkup(
      <GovernedStakeholderIntelligenceProjection
        apiBase="http://api.test"
        initialProjection={projection}
        tenantId="tenant_demo"
        token="token"
      />
    );
    expect(markup).toContain("利益相关方信号学习投影");
    expect(markup).toContain("CEO");
    expect(markup).toContain("customer");
    expect(markup).not.toContain("proposal_id");
    expect(markup).not.toContain("raw");
  });

  it("gives Admin an exact candidate audit lookup without exposing a write action", () => {
    const markup = renderToStaticMarkup(
      <GovernedStakeholderIntelligenceAuditPanel
        apiBase="http://api.test"
        tenantId="tenant_demo"
        token="token"
      />
    );
    expect(markup).toContain("利益相关方候选审计");
    expect(markup).toContain("查询候选审计");
    expect(markup).toContain("writes_official_truth");
    expect(markup).not.toContain("创建候选");
  });
});
