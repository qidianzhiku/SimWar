/** @vitest-environment jsdom */
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import { ShanghaiC0ConversionAuditPanel } from "../../apps/admin/src/ShanghaiC0ConversionAuditPanel";
import { ShanghaiC0ConversionProjection } from "../../apps/student/src/ShanghaiC0ConversionProjection";
import { ShanghaiC0ConversionWorkspace } from "../../apps/teacher/src/ShanghaiC0ConversionWorkspace";

describe("Shanghai C0 role panels", () => {
  it("exposes Teacher C0 consumption only with exact context", () => {
    const markup = renderToStaticMarkup(
      <ShanghaiC0ConversionWorkspace
        apiBase="http://localhost:3000"
        courseId="course_demo"
        macroId="M13"
        parameterSetId="param_demo"
        roundId="round_demo"
        roundNo={1}
        runId="run_demo"
        scenarioPackageId="scenario_demo"
        teamId="team_alpha"
        tenantId="tenant_demo"
        token="teacher-token"
      />
    );
    expect(markup).toContain("上海经营与资本决策工作台");
    expect(markup).toContain("加载当前 C0 消费证据");
    expect(markup).toContain("当前产品消费者");
  });

  it("keeps Student and Admin panels dormant without an exact receipt", () => {
    const student = renderToStaticMarkup(
      <ShanghaiC0ConversionProjection
        apiBase="http://localhost:3000"
        tenantId="tenant_demo"
        token="student-token"
      />
    );
    const admin = renderToStaticMarkup(
      <ShanghaiC0ConversionAuditPanel
        apiBase="http://localhost:3000"
        tenantId="tenant_demo"
        token="admin-token"
      />
    );
    expect(student).toContain("需要通过 Teacher 生成的 exact C0 receipt");
    expect(student).not.toContain("parameter_set_id");
    expect(admin).toContain("需要 exact C0 receipt 上下文");
    expect(admin).toContain("只读");
  });
});
