/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { W027StudentDecisionExperienceDTO } from "@simwar/shared-contracts";
import {
  draftForKind,
  W027DecisionExperiencePanel
} from "../../apps/student/src/W027DecisionExperiencePanel";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const fixture: W027StudentDecisionExperienceDTO = {
  schema_version: "w027-student-decision-experience.v1",
  context: {
    schema_version: "w027-role-context.v1",
    tenant_id: "tenant-a",
    course_id: "course-a",
    run_id: "run-a",
    round_id: "round-a",
    team_id: "team-a",
    user_id: "student-a",
    role_key: "CFO",
    source: "resolved_from_w027_assignment",
    permissions: {
      schema_version: "w027-decision-right-policy.v1",
      policy_id: "policy-cfo",
      role_key: "CFO",
      can_read_role_workspace: true,
      can_write_private_judgment: true,
      can_publish_role_position: true,
      can_propose_resolution: false,
      can_acknowledge_resolution: true,
      can_merge_team_decision: false,
      can_confirm_team_decision: false,
      private_judgment_kinds: ["value", "assumption", "evidence", "risk", "tradeoff"],
      operational_capabilities: ["finance"],
      known_limits: ["PRIVATE_JUDGMENT_NOT_CANONICAL_TRUTH"]
    }
  },
  roster: {
    schema_version: "w027-role-roster.v1",
    roster_id: "roster-a",
    tenant_id: "tenant-a",
    course_id: "course-a",
    run_id: "run-a",
    team_id: "team-a",
    role_keys: ["CEO", "CFO", "CMO", "COO", "CHRO"],
    compatibility_map: { risk: "COO", "Quality & Risk": "COO" },
    decision_right_policies: [],
    version: 1,
    configured_at: "2026-08-20T00:00:00.000Z",
    configured_by: "teacher-a"
  },
  private_judgments: [
    {
      schema_version: "w027-private-judgment.v1",
      judgment_id: "judgment-a",
      tenant_id: "tenant-a",
      course_id: "course-a",
      run_id: "run-a",
      round_id: "round-a",
      team_id: "team-a",
      role_key: "CFO",
      kind: "risk",
      problem_frame: "现金流缓冲不足",
      assumptions: ["需求保持稳定"],
      options_considered: ["降低库存", "延后扩张"],
      trade_offs: ["增长速度换取现金安全"],
      prediction: "短期现金压力下降",
      confidence: 0.7,
      rationale: "先保留安全边界",
      statement: "先保护现金缓冲，再扩大投入。",
      evidence_refs: ["cash-flow-brief"],
      status: "draft",
      version: 2,
      visibility: "role_private",
      created_by: "student-a",
      created_at: "2026-08-20T00:00:00.000Z"
    }
  ],
  own_role_position: {
    position_id: "position-cfo",
    tenant_id: "tenant-a",
    course_id: "course-a",
    run_id: "run-a",
    round_id: "round-a",
    team_id: "team-a",
    role_key: "CFO",
    summary: "现金安全优先",
    assumptions: ["需求稳定"],
    evidence_refs: ["cash-flow-brief"],
    risk_flags: ["现金压力"],
    tradeoffs: ["增长速度"],
    status: "ready",
    version: 1,
    visibility: "team_safe",
    created_at: "2026-08-20T00:00:00.000Z"
  },
  team_safe_positions: [
    {
      position_id: "position-cfo",
      tenant_id: "tenant-a",
      course_id: "course-a",
      run_id: "run-a",
      round_id: "round-a",
      team_id: "team-a",
      role_key: "CFO",
      summary: "现金安全优先",
      assumptions: ["需求稳定"],
      evidence_refs: ["cash-flow-brief"],
      risk_flags: ["现金压力"],
      tradeoffs: ["增长速度"],
      status: "ready",
      version: 1,
      visibility: "team_safe",
      created_at: "2026-08-20T00:00:00.000Z"
    }
  ],
  divergence: {
    schema_version: "w027-team-divergence.v2",
    tenant_id: "tenant-a",
    course_id: "course-a",
    run_id: "run-a",
    round_id: "round-a",
    team_id: "team-a",
    source_position_ids: ["position-cfo"],
    source_digest: "digest-a",
    status: "OPEN",
    divergences: [
      {
        divergence_id: "divergence-a",
        dimension: "risk",
        status: "OPEN",
        candidates: [{ role_key: "CFO", position_id: "position-cfo", value: "现金安全优先" }]
      }
    ],
    known_limits: ["仅显示 role-safe position"]
  },
  resolution: undefined,
  trace: {
    schema_version: "w027-decision-trace.v2",
    tenant_id: "tenant-a",
    run_id: "run-a",
    round_id: "round-a",
    team_id: "team-a",
    role_key: "CFO",
    current_stage: "PRIVATE_JUDGMENT_CAPTURED",
    stages: [],
    known_limits: []
  },
  known_limits: ["完整私有判断仅本角色可见", "正式确认由角色工作区唯一负责"]
};

function response(ok: boolean, data: unknown = fixture): Response {
  return {
    ok,
    json: async () => (ok ? { data } : { code: "W027_TEST_ERROR", message: "服务暂不可用" })
  } as Response;
}

function renderPanel(active = true) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <W027DecisionExperiencePanel
        active={active}
        courseId="course-a"
        roundId="round-a"
        runId="run-a"
        teamId="team-a"
        tenantId="tenant-a"
        token="student-token"
      />
    );
  });
  return { container, root };
}

describe("Student team decision journey", () => {
  it("keeps private readiness and settlement readback distinct from canonical milestones", async () => {
    const readyPrivateFixture: W027StudentDecisionExperienceDTO = {
      ...fixture,
      private_judgments: fixture.private_judgments.map((judgment) => ({
        ...judgment,
        status: "ready"
      })),
      trace: {
        ...fixture.trace,
        stages: [
          {
            stage_key: "CANONICAL_DECISION_MILESTONE",
            occurred_at: "2026-08-20T00:00:00.000Z",
            safe_evidence_reference: "w027_canonical_decision",
            safe_label: "正式 Decision 已由既有 RoleWorkflow 提交"
          }
        ],
        current_stage: "CANONICAL_DECISION_MILESTONE"
      }
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(response(true, readyPrivateFixture));
    const { container, root } = renderPanel();

    await act(async () => {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(container.textContent).toContain("Role READY");
    expect(container.textContent).toContain("未准备");
    expect(container.textContent).toContain("Settlement");
    expect(container.textContent).toContain("等待正式结果投影");
    expect(container.textContent).not.toContain("服务端已读回");

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("loads a closed round as read-only so the team readback remains visible", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(true));
    const { container, root } = renderPanel(false);

    await act(async () => {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(container.textContent).toContain("团队安全立场");
    expect(container.textContent).toContain("团队草案、确认与正式结果");
    const save = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("保存私有判断")
    );
    expect(save).toBeDefined();
    expect(save).toHaveProperty("disabled", true);

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("hydrates the selected judgment kind instead of carrying another kind's private text", async () => {
    const selected = draftForKind(fixture, "evidence");

    expect(selected.kind).toBe("evidence");
    expect(selected.problemFrame).toBe("");
    expect(selected.statement).toBe("");
    expect(selected.status).toBe("draft");
  });

  it("renders the full private-to-safe journey without a second merge or confirm writer", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(true));
    const { container, root } = renderPanel();

    await act(async () => {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(container.textContent).toContain("现金流缓冲不足");
    expect(container.textContent).toContain("仅本角色可见的完整判断");
    expect(container.textContent).toContain("团队安全立场");
    expect(container.textContent).toContain("关键分歧");
    expect(container.textContent).toContain("Team Confirm");
    expect(container.textContent).toContain("Round Lock");
    expect(container.textContent).toContain("Settlement");
    expect(container.textContent).not.toContain("创建团队合并候选");
    expect(container.textContent).not.toContain("确认团队决策");
    expect(container.querySelector('[role="status"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("fails closed when the server denies role-workspace read access", async () => {
    const deniedFixture: W027StudentDecisionExperienceDTO = {
      ...fixture,
      context: {
        ...fixture.context,
        permissions: { ...fixture.context.permissions, can_read_role_workspace: false }
      }
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(response(true, deniedFixture));
    const { container, root } = renderPanel();

    await act(async () => {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(container.querySelector('[data-state="denied"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="问题框架"]')).toBeNull();
    expect(container.textContent).toContain("当前角色无法读取该工作区");

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("renders a server-bounded role mission before private judgment", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(true));
    const { container, root } = renderPanel();

    await act(async () => {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(container.textContent).toContain("角色任务");
    expect(container.textContent).toContain("情境");
    expect(container.textContent).toContain("张力");
    expect(container.textContent).toContain("决策问题");
    expect(container.textContent).toContain("角色视角");
    expect(container.textContent).toContain("决策权");
    expect(container.textContent).toContain("当前队伍角色");
    expect(container.textContent).toContain("CFO");
    expect(container.textContent).toContain("角色任务信息由当前服务端投影提供");
    expect(container.textContent).toContain("60–90 秒");
    const startJudgment = container.querySelector('a[href="#w027-private-judgment"]');
    expect(startJudgment?.textContent).toContain("开始我的判断");

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("saves the complete private judgment as draft and keeps the editor after readback", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      calls.push({ url: String(input), init });
      return response(true);
    });
    const { container, root } = renderPanel();
    await act(async () => {
      await vi.waitFor(() => expect(calls.length).toBeGreaterThan(0));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(container.textContent).toContain("现金流缓冲不足");

    const frame = container.querySelector('[aria-label="问题框架"]') as HTMLTextAreaElement;
    const save = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("保存私有判断")
    );
    expect(save).toBeDefined();
    await act(async () => {
      save?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.waitFor(() =>
        expect(calls.some((call) => call.url.includes("private-judgment"))).toBe(true)
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const bodyCall = calls.find((call) => call.url.includes("private-judgment"));
    expect(JSON.parse(String(bodyCall?.init?.body))).toMatchObject({
      problem_frame: "现金流缓冲不足",
      status: "draft",
      kind: "risk",
      statement: "先保护现金缓冲，再扩大投入。"
    });
    expect(container.textContent).toContain("私有判断已保存");
    expect(frame.value).toBe("现金流缓冲不足");

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("shows a recoverable error and preserves a same-context local draft when refresh fails", async () => {
    let getCount = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("decision-experience")) {
        getCount += 1;
        return response(getCount === 1);
      }
      return response(true);
    });
    const { container, root } = renderPanel();
    await act(async () => {
      await vi.waitFor(() => expect(getCount).toBe(1));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(container.textContent).toContain("现金流缓冲不足");
    const frame = container.querySelector('[aria-label="问题框架"]') as HTMLTextAreaElement;
    expect(frame.value).toBe("现金流缓冲不足");
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setValue?.call(frame, "本地修改但尚未同步");
      frame.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.waitFor(() => expect(container.textContent).toContain("本地编辑尚未保存"));
    });
    expect(container.textContent).toContain("本地编辑尚未保存");

    await act(async () => {
      const refresh = [...container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("刷新 W027 工作区")
      );
      expect(refresh).toBeDefined();
      expect(refresh).not.toHaveProperty("disabled", true);
      refresh?.click();
      await vi.waitFor(() => expect(getCount).toBe(2));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(container.textContent).toContain("W027 工作区暂时不可用");
    expect(container.querySelector('[data-testid="w027-local-draft-recovery"]')).not.toBeNull();
    expect(container.textContent).toContain("本地私有编辑已保留");

    const retry = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("重新加载")
    );
    expect(retry).toBeDefined();
    expect(container.querySelector('[data-state="error"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("keeps the committed receipt visible when the post-save refresh fails", async () => {
    let getCount = 0;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      calls.push({ url: String(input), init });
      if (String(input).includes("decision-experience")) {
        getCount += 1;
        return response(getCount === 1);
      }
      return response(true);
    });
    const { container, root } = renderPanel();
    await act(async () => {
      await vi.waitFor(() => expect(getCount).toBe(1));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    const save = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("保存私有判断")
    );
    expect(save).toBeDefined();
    await act(async () => {
      save?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.waitFor(() =>
        expect(calls.some((call) => call.url.includes("private-judgment"))).toBe(true)
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(container.textContent).toContain("工作区刷新失败，请重试");
    expect(container.querySelector('[data-state="error"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("does not treat an unknown private-judgment receipt as a successful save", async () => {
    const calls: string[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("private-judgment")) {
        return { ok: true, json: async () => ({}) } as Response;
      }
      return response(true);
    });
    const { container, root } = renderPanel();

    await act(async () => {
      await vi.waitFor(() =>
        expect(calls.some((url) => url.includes("decision-experience"))).toBe(true)
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    const save = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("保存私有判断")
    );
    expect(save).toBeDefined();
    await act(async () => {
      save?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.waitFor(() =>
        expect(calls.some((url) => url.includes("private-judgment"))).toBe(true)
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(container.textContent).toContain("工作区暂时不可用，可以重试");
    expect(container.textContent).toContain("FAILED_RETRYABLE");

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });
});
