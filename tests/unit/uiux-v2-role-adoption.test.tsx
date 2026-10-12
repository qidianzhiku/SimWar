import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudentDecisionDesktop } from "../../apps/student/src/StudentDecisionDesktop";

describe("UI/UX V2 role adoption", () => {
  it("uses the shared context grammar on the Student decision surface", () => {
    const markup = renderToStaticMarkup(
      <StudentDecisionDesktop
        desktopState="ready"
        context={
          {
            tenant_id: "tenant_demo",
            course_id: "course_demo",
            course_title: "示例课程",
            run_id: "run_demo",
            round_id: "round_demo",
            round_no: 1,
            team_id: "team_demo"
          } as never
        }
        cockpit={null}
        decision={
          {
            pricing: { base_price: 100 },
            marketing_budget: 10,
            service_quality_budget: 10,
            capacity_plan: "hold",
            cash_buffer_target: 0.1,
            strategy_statement: ""
          } as never
        }
        busy={false}
        canSubmit={false}
        roleWorkflowActive={false}
        roleWorkflowAvailability="inactive"
        notice="等待服务端状态"
        onDecisionChange={() => undefined}
        onSubmit={() => undefined}
      />
    );

    expect(markup).toContain('class="panel sdd sw-ui"');
    expect(markup).toContain('aria-label="当前上下文"');
    expect(markup).toContain("tenant_demo");
    expect(markup).toContain("run_demo");
  });

  it("preserves shared WorkbenchFrame classes when a role supplies a custom class", async () => {
    const { WorkbenchFrame } = await import("../../packages/ui/src/workbenches/WorkbenchFrame");
    const markup = renderToStaticMarkup(
      <WorkbenchFrame
        ariaLabel="Teacher Scenario Studio"
        title="受控教师场景工作室"
        className="candidate-surface teacher-scenario-studio"
      />
    );

    expect(markup).toContain(
      'class="sw-ui sw-workbench-frame candidate-surface teacher-scenario-studio"'
    );
  });
});
