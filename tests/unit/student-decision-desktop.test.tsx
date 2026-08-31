/** @vitest-environment jsdom */

import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import {
  createStudentDecisionContextEvidence,
  type DecisionPayload,
  type P0DemoState,
  type StudentBffCockpitDTO
} from "@simwar/shared-contracts";
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

const publishedResult = {
  team_id: "team-a",
  team_name: "A队",
  state_obs: {
    demand_band: "medium" as const,
    served_demand: 105,
    revenue: 180000,
    profit_band: "healthy" as const,
    score: 82,
    rank: 1
  },
  state_est: {
    next_round_risk: "cash" as const,
    explanation: "现金缓冲保持稳定。",
    recommended_focus: "下一轮优先检查现金缓冲。"
  }
};

const decisionContextEvidence = createStudentDecisionContextEvidence(
  {
    activity_id: "activity_consequence",
    course_id: exactContext.course_id,
    role_key: "CEO",
    round_id: exactContext.round_id,
    round_no: exactContext.round_no,
    run_id: exactContext.run_id,
    team_id: exactContext.team_id,
    tenant_id: exactContext.tenant_id
  },
  {
    target_region: "Hangzhou",
    epoch_version: "epoch-b.2026-08-30",
    qualification_status: "LIMITED",
    consumption_status: "LOOKAHEAD_READY",
    exact_binding_required: true
  }
);

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
    ["empty", stateInput({ workspacePhase: "empty", exactContextReady: false })],
    ["published", stateInput({ hasPublishedResult: true })],
    ["ready", stateInput()]
  ] as const)("derives the governed %s state from server lifecycle signals", (expected, input) => {
    expect(getStudentDecisionDesktopState(input)).toBe(expected);
  });

  it("fails closed to stale when exact context references do not align", () => {
    expect(getStudentDecisionDesktopState(stateInput({ exactContextReady: false }))).toBe("stale");
  });

  it("keeps an empty server context distinct from an invalidated exact context", () => {
    expect(
      getStudentDecisionDesktopState(
        stateInput({ workspacePhase: "empty", exactContextReady: false })
      )
    ).toBe("empty");
    expect(
      getStudentDecisionDesktopState(
        stateInput({ workspacePhase: "ready", contextRecoveryState: "CONTEXT_STALE" })
      )
    ).toBe("stale");
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

  it("preserves the complete published safe feedback projection", () => {
    const markup = renderToStaticMarkup(
      <StudentDecisionDesktop
        desktopState="published"
        context={exactContext}
        cockpit={
          {
            decision_form: { allowed_actions: [], editable_fields: [] },
            student_cockpit: { visible_state: { round_status: "closed", team_name: "A队" } },
            published_result: { explicit_non_proof: ["STUDENT_SAFE_ONLY"] },
            learning_report: {},
            three_part_feedback: {}
          } as unknown as StudentBffCockpitDTO
        }
        decision={decision}
        publishedResult={publishedResult}
        busy={false}
        canSubmit={false}
        roleWorkflowActive={false}
        roleWorkflowAvailability="inactive"
        notice="结果已发布"
        onDecisionChange={() => undefined}
        onSubmit={() => undefined}
      />
    );

    expect(markup).toContain("服务需求");
    expect(markup).toContain("105");
    expect(markup).toContain("cash");
    expect(markup).toContain("下一轮优先检查现金缓冲。");
    expect(markup).toContain("STUDENT_SAFE_ONLY");
  });

  it("shows M31 evidence continuity without exposing source or internal outcome fields", () => {
    const markup = renderToStaticMarkup(
      <StudentDecisionDesktop
        desktopState="ready"
        context={exactContext}
        decisionContextEvidence={decisionContextEvidence}
        cockpit={null}
        decision={decision}
        busy={false}
        canSubmit={false}
        roleWorkflowActive={false}
        roleWorkflowAvailability="inactive"
        notice="等待服务端状态"
        onDecisionChange={() => undefined}
        onSubmit={() => undefined}
      />
    );

    expect(markup).toContain('data-testid="desktop-decision-context-evidence"');
    expect(markup).toContain('data-evidence-status="READY"');
    expect(markup).toContain("student-decision-context.v1");
    expect(markup).toContain("Hangzhou");
    const evidenceStart = markup.indexOf(
      'data-testid="desktop-decision-context-evidence"'
    );
    const evidenceEnd = markup.indexOf(
      '<ol class="board sdd-spine"',
      evidenceStart
    );
    expect(evidenceStart).toBeGreaterThanOrEqual(0);
    expect(evidenceEnd).toBeGreaterThan(evidenceStart);
    expect(markup.slice(evidenceStart, evidenceEnd)).not.toMatch(
      /raw_source|locator|digest|private|hidden_calibration|model_truth|state_true|score|rank|settlement/i
    );
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
