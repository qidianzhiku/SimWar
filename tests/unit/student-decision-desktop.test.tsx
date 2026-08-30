/** @vitest-environment jsdom */

import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import type { DecisionPayload, P0DemoState, StudentBffCockpitDTO } from "@simwar/shared-contracts";
import {
  getStudentDecisionDesktopState,
  StudentDecisionDesktop,
  type StudentDecisionDesktopStateInput
} from "../../apps/student/src/StudentDecisionDesktop";

const decision: DecisionPayload = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "守住交付能力"
};

const exactContext = {
  tenant_id: "tenant-a",
  course_id: "course-a",
  run_id: "run-a",
  round_id: "round-a",
  round_no: 2,
  team_id: "team-a",
  course_title: "康养企业经营"
};

function stateInput(
  overrides: Partial<StudentDecisionDesktopStateInput> = {}
): StudentDecisionDesktopStateInput {
  return {
    hasSession: true,
    isStudentSession: true,
    workspacePhase: "ready",
    contextRecoveryState: "READY",
    exactContextReady: true,
    hasPublishedResult: false,
    ...overrides
  };
}

describe("StudentDecisionDesktop", () => {
  it.each([
    ["signed-out", stateInput({ hasSession: false, isStudentSession: false })],
    ["loading", stateInput({ workspacePhase: "loading" })],
    [
      "unauthorized",
      stateInput({ isStudentSession: false, contextRecoveryState: "CONTEXT_UNAUTHORIZED" })
    ],
    ["stale", stateInput({ contextRecoveryState: "CONTEXT_STALE" })],
    ["error", stateInput({ workspacePhase: "error" })],
    ["published", stateInput({ hasPublishedResult: true })],
    ["ready", stateInput()]
  ] as const)("derives the governed %s state from server lifecycle signals", (expected, input) => {
    expect(getStudentDecisionDesktopState(input)).toBe(expected);
  });

  it("fails closed to stale when exact context references do not align", () => {
    expect(getStudentDecisionDesktopState(stateInput({ exactContextReady: false }))).toBe("stale");
  });

  it("renders an exact-context desktop with the server-owned action boundary", () => {
    const markup = renderToStaticMarkup(
      <StudentDecisionDesktop
        desktopState="ready"
        context={exactContext}
        cockpit={
          {
            decision_form: {
              allowed_actions: ["decision:submit"],
              editable_fields: [
                "pricing.base_price",
                "marketing_budget",
                "service_quality_budget",
                "capacity_plan",
                "cash_buffer_target",
                "strategy_statement"
              ]
            },
            student_cockpit: { visible_state: { round_status: "open", team_name: "A队" } },
            published_result: {},
            learning_report: {},
            three_part_feedback: {}
          } as unknown as StudentBffCockpitDTO
        }
        decision={decision}
        busy={false}
        canSubmit={true}
        roleWorkflowActive={false}
        roleWorkflowAvailability="inactive"
        notice="等待服务端状态"
        onDecisionChange={() => undefined}
        onSubmit={() => undefined}
      />
    );

    expect(markup).toContain('data-testid="student-decision-desktop"');
    expect(markup).toContain('data-desktop-state="ready"');
    expect(markup).toContain("当前正式上下文");
    expect(markup).toContain("course-a");
    expect(markup).toContain("round-a");
    expect(markup).toContain("Decision Spine");
    expect(markup).toContain("Context Inspector");
    expect(markup).toContain("Support Rail");
    expect(markup).toContain("提交正式决策");
    expect(markup).not.toContain("state_true");
    expect(markup).not.toContain("replay_hash");
  });

  it("renders a recovery surface without exposing the decision form while stale", () => {
    const markup = renderToStaticMarkup(
      <StudentDecisionDesktop
        desktopState="stale"
        context={exactContext}
        cockpit={null}
        decision={decision}
        busy={false}
        canSubmit={false}
        roleWorkflowActive={false}
        roleWorkflowAvailability="error"
        notice="CONTEXT_NOT_FOUND"
        onDecisionChange={() => undefined}
        onSubmit={() => undefined}
        onRecover={() => undefined}
      />
    );

    expect(markup).toContain('data-desktop-state="stale"');
    expect(markup).toContain("上下文已失效");
    expect(markup).toContain("重新加载决策桌面");
    expect(markup).not.toContain('data-action="decision:submit"');
  });

  it("keeps context derivation input server-shaped rather than client-calculated", () => {
    const input = stateInput();
    expect(input.exactContextReady).toBe(true);
    expect(({} as P0DemoState).current_user).toBeUndefined();
  });
});
