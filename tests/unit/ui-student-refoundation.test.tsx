/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  App,
  getStudentAuthority,
  getStudentNoticeCopy,
  isCurrentStudentRequest,
  isLegacyStudentSubmitAllowed,
  isStudentFieldEditable,
  isStudentSessionAllowed,
  projectStudentBootstrapState,
  STUDENT_NAVIGATION_ITEMS
} from "../../apps/student/src/App";
import type { P0DemoState, StudentRoleWorkflowWorkspaceDTO } from "@simwar/shared-contracts";
import {
  canReadStudentRoleWorkspace,
  requiredResolutionRoleKeys,
  isCurrentRoleWorkflowRequest,
  getRoleWorkflowNoticeCopy,
  roleWorkflowStatusCopy,
  studentDecisionTraceCurrentStageCopy,
  StudentRoleWorkflowPanel
} from "../../apps/student/src/StudentRoleWorkflowPanel";
import {
  goldenJourneyCopy,
  GoldenJourneyWorkbench
} from "../../apps/student/src/GoldenJourneyWorkbench";
import {
  learningReportCopy,
  StudentLearningReportPanel
} from "../../apps/student/src/StudentLearningReport";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const expectedLocations = [
  ["student-role-mission", "角色任务"],
  ["student-cockpit", "经营驾驶舱"],
  ["student-evidence", "信息与证据"],
  ["student-enterprise-state", "企业状态与战略演进"],
  ["student-private-draft", "个人草稿"],
  ["student-collaboration", "团队协作"],
  ["student-divergence", "分歧冲突"],
  ["student-confirmation", "团队确认"],
  ["student-submission", "最终提交"],
  ["student-results", "结果与因果链"],
  ["student-debrief", "复盘"],
  ["student-learning-report", "学习报告"],
  ["student-learning-path", "学习路径"]
] as const;
describe("Student executive workspace refoundation", () => {
  it("derives divergence acknowledgement roles from the active team instead of assuming CHRO", () => {
    const workspace = {
      assignment: { role_key: "CEO" },
      divergence_set: {
        divergences: [
          {
            candidates: [
              { role_key: "CEO" },
              { role_key: "CFO" },
              { role_key: "CMO" },
              { role_key: "COO" }
            ]
          }
        ]
      },
      resolution_acknowledgements: [
        { role_key: "CEO" },
        { role_key: "CFO" },
        { role_key: "CMO" },
        { role_key: "COO" }
      ]
    } as unknown as StudentRoleWorkflowWorkspaceDTO;

    expect(requiredResolutionRoleKeys(workspace)).toEqual(["CEO", "CFO", "CMO", "COO"]);
  });

  it("keeps CHRO in the acknowledgement gate only when the server projection includes it", () => {
    const workspace = {
      assignment: { role_key: "CEO" },
      divergence_set: {
        divergences: [{ candidates: [{ role_key: "CHRO" }] }]
      },
      resolution_acknowledgements: [{ role_key: "CHRO" }]
    } as unknown as StudentRoleWorkflowWorkspaceDTO;

    expect(requiredResolutionRoleKeys(workspace)).toEqual(["CEO", "CHRO"]);
    expect(requiredResolutionRoleKeys(workspace)).not.toContain("Quality & Risk");
  });

  it("freezes thirteen stable student logical locations", () => {
    expect(STUDENT_NAVIGATION_ITEMS).toHaveLength(expectedLocations.length);
    expect(STUDENT_NAVIGATION_ITEMS.map(({ id, label }) => [id, label])).toEqual(expectedLocations);
  });

  it("renders the real Student app shell with semantic navigation and safe initial state", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("SimWar M1 学员执行环境");
    expect(markup).toContain('aria-label="角色导航"');
    expect(markup).toContain('aria-label="student login"');
    expect(markup).toContain('href="#student-role-mission"');
    expect(markup).toContain("角色任务");
    expect(markup).not.toContain('href="#student-cockpit"');
    expect(markup).not.toContain('id="student-cockpit"');
    expect(markup).not.toContain("state_true");
    expect(markup).not.toContain("replay_hash");
    expect(markup).not.toContain("private peer drafts");
    expect(markup).not.toContain("服务端正式结果");
  });

  it("guards role workflow writes against a stale session or round", () => {
    expect(isCurrentStudentRequest(2, 2)).toBe(true);
    expect(isCurrentStudentRequest(1, 2)).toBe(false);
    expect(isCurrentRoleWorkflowRequest(2, 2)).toBe(true);
    expect(isCurrentRoleWorkflowRequest(2, 2, true)).toBe(false);
  });

  it("maps server role and editable-field authority without client inference", () => {
    expect(isStudentSessionAllowed(["teacher"])).toBe(false);
    expect(isStudentSessionAllowed(["learner"])).toBe(true);
    expect(isStudentFieldEditable(null, "pricing.base_price")).toBe(false);
    expect(
      isStudentFieldEditable(
        {
          decision_form: { editable_fields: ["pricing.base_price"] }
        } as never,
        "pricing.base_price"
      )
    ).toBe(true);
    expect(
      isStudentFieldEditable(
        {
          decision_form: { editable_fields: ["pricing.base_price"] }
        } as never,
        "marketing_budget"
      )
    ).toBe(false);
    expect(getStudentAuthority(false, null)).toBe("unknown");
    expect(getStudentAuthority(true, null)).toBe("unknown");
    expect(getStudentAuthority(true, {} as never)).toBe("unknown");
    expect(
      getStudentAuthority(true, {
        decision_form: { decision_schema_version: "m1-decision-form.v1" },
        student_cockpit: { evidence_label: "STUDENT_PROJECTION_EVIDENCE" }
      } as never)
    ).toBe("official");
    expect(isLegacyStudentSubmitAllowed("checking", true)).toBe(false);
    expect(isLegacyStudentSubmitAllowed("error", true)).toBe(false);
    expect(isLegacyStudentSubmitAllowed("active", true)).toBe(false);
    expect(isLegacyStudentSubmitAllowed("inactive", true)).toBe(true);
    expect(isLegacyStudentSubmitAllowed("inactive", false)).toBe(false);
  });

  it("keeps Chinese primary copy with subordinate technical compatibility labels", () => {
    const journeyMarkup = renderToStaticMarkup(
      <GoldenJourneyWorkbench tenantId="tenant-a" token="student-token" />
    );
    const reportMarkup = renderToStaticMarkup(
      <StudentLearningReportPanel tenantId="tenant-a" token="student-token" />
    );

    expect(journeyMarkup).toContain(goldenJourneyCopy.title);
    expect(journeyMarkup).toContain(goldenJourneyCopy.titleCompatibility);
    expect(reportMarkup).toContain(learningReportCopy.eyebrow);
    expect(reportMarkup).toContain(learningReportCopy.eyebrowCompatibility);
    expect(roleWorkflowStatusCopy("draft")).toEqual({
      primary: "草稿",
      compatibility: "draft"
    });
    expect(roleWorkflowStatusCopy("pending")).toEqual({
      primary: "待确认",
      compatibility: "pending"
    });
    expect(getStudentNoticeCopy("AUTH-401-002: invalid credentials")).toEqual({
      compatibility: "AUTH-401-002: invalid credentials",
      primary: "登录失败，请检查租户、用户名和密码。"
    });
    expect(getRoleWorkflowNoticeCopy("ROLE_WORKFLOW_STALE_SECTION: conflict")).toEqual({
      compatibility: "ROLE_WORKFLOW_STALE_SECTION: conflict",
      primary: "角色草稿已被更新，请刷新后重试。"
    });
    expect(
      canReadStudentRoleWorkspace({
        context: { permissions: { can_read_role_workspace: false } }
      } as never)
    ).toBe(false);
    expect(studentDecisionTraceCurrentStageCopy(null)).toBe("尚未开始记录");
    expect(
      studentDecisionTraceCurrentStageCopy({
        trace_stages: [
          {
            occurred_at: "2026-08-01T01:00:00.000Z",
            safe_evidence_reference: "role_assignment",
            safe_label: "角色已分配",
            stage_key: "ROLE_ASSIGNED",
            status: "completed"
          }
        ]
      } as never)
    ).toBe("角色已分配");
  });

  it("clears Student busy state when an edited login context invalidates a pending sign-in", async () => {
    const pendingLogin = new Promise<Response>(() => undefined);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => pendingLogin);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    const setInputValue = (label: string, value: string) => {
      const input = [...container.querySelectorAll("input")].find(
        (candidate) => candidate.getAttribute("aria-label") === label
      );
      expect(input).toBeDefined();
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, value);
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    };

    await act(async () => {
      setInputValue("tenant", "tenant-a");
      setInputValue("username", "student-a");
      setInputValue("password", "password-a");
    });
    const loginButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("学员登录")
    );
    expect(loginButton).toBeDefined();
    await act(async () => {
      loginButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(loginButton?.disabled).toBe(true);

    await act(async () => {
      setInputValue("tenant", "tenant-b");
    });
    expect(loginButton?.disabled).toBe(false);

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("renders a recoverable root error when the Student workspace projection fails", async () => {
    const session = {
      access_token: "student-token",
      session_id: "session-a",
      user: {
        display_name: "Student A",
        roles: ["learner"],
        tenant_id: "tenant-a",
        user_id: "student-a"
      }
    };
    const response = (ok: boolean, data: unknown): Response =>
      ({
        ok,
        json: async () => (ok ? { data } : { code: "STUDENT_BFF_UNAVAILABLE", message: "failed" })
      }) as Response;
    let demoStateRequests = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/login")) return response(true, session);
      if (url.includes("/api/v1/demo-state")) {
        demoStateRequests += 1;
        return response(false, null);
      }
      return response(false, null);
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    const setInputValue = (label: string, value: string) => {
      const input = [...container.querySelectorAll("input")].find(
        (candidate) => candidate.getAttribute("aria-label") === label
      );
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, value);
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    };
    await act(async () => {
      setInputValue("tenant", "tenant-a");
      setInputValue("username", "student-a");
      setInputValue("password", "password-a");
    });
    const loginButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("学员登录")
    );
    await act(async () => {
      loginButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      await vi.waitFor(() => expect(demoStateRequests).toBe(1));
    });
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-state="error"]')).not.toBeNull();
    expect(container.textContent).toContain("重新加载学员工作区");

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("preserves an edited legacy draft when a committed decision refresh fails in the same context", async () => {
    const session = {
      access_token: "student-token",
      session_id: "session-a",
      user: {
        display_name: "Student A",
        roles: ["learner"],
        tenant_id: "tenant-a",
        user_id: "student-a"
      }
    };
    const state = {
      current_user: {
        user_id: "student-a",
        tenant_id: "tenant-a",
        display_name: "Student A",
        roles: ["learner"],
        team_id: "team-a"
      },
      courses: [
        {
          course_id: "course-a",
          tenant_id: "tenant-a",
          title: "Course A",
          status: "published",
          scenario_package_id: "scenario-a",
          parameter_set_id: "parameter-a",
          created_by: "teacher-a"
        }
      ],
      teams: [
        {
          team_id: "team-a",
          tenant_id: "tenant-a",
          course_id: "course-a",
          name: "Team A",
          captain_user_id: "student-a",
          members: []
        }
      ],
      runs: [
        {
          run_id: "run-a",
          tenant_id: "tenant-a",
          course_id: "course-a",
          scenario_package_id: "scenario-a",
          parameter_set_id: "parameter-a",
          seed: 1,
          status: "active"
        }
      ],
      rounds: [
        {
          round_id: "round-a",
          tenant_id: "tenant-a",
          run_id: "run-a",
          round_no: 1,
          status: "open"
        }
      ],
      decisions: [],
      audit_logs: []
    } as unknown as P0DemoState;
    const cockpit = {
      student_cockpit: {
        actor_role: "student",
        advisory_slots: [],
        allowed_actions: ["decision:submit"],
        course_id: "course-a",
        explicit_non_proof: [],
        forbidden_fields: ["state_true"],
        round_id: "round-a",
        round_no: 1,
        run_id: "run-a",
        source_runtime_path: ["student_bff"],
        team_id: "team-a",
        tenant_id: "tenant-a",
        evidence_label: "STUDENT_PROJECTION_EVIDENCE",
        visible_state: { course_status: "published", round_status: "open", team_name: "Team A" }
      },
      decision_form: {
        actor_role: "student",
        advisory_slots: [],
        allowed_actions: ["decision:submit"],
        course_id: "course-a",
        explicit_non_proof: [],
        forbidden_fields: [],
        round_id: "round-a",
        round_no: 1,
        run_id: "run-a",
        source_runtime_path: ["student_bff"],
        team_id: "team-a",
        tenant_id: "tenant-a",
        evidence_label: "STUDENT_PROJECTION_EVIDENCE",
        decision_schema_version: "m1-decision-form.v1",
        editable_fields: [
          "pricing.base_price",
          "marketing_budget",
          "service_quality_budget",
          "capacity_plan",
          "cash_buffer_target",
          "strategy_statement"
        ]
      },
      published_result: {
        actor_role: "student",
        advisory_slots: [],
        allowed_actions: [],
        course_id: "course-a",
        explicit_non_proof: [],
        forbidden_fields: [],
        round_id: "round-a",
        round_no: 1,
        run_id: "run-a",
        source_runtime_path: ["student_bff"],
        team_id: "team-a",
        tenant_id: "tenant-a",
        evidence_label: "STUDENT_PROJECTION_EVIDENCE",
        result_label: "M1 official result"
      },
      three_part_feedback: {
        actor_role: "student",
        advisory_slots: [],
        allowed_actions: [],
        course_id: "course-a",
        explicit_non_proof: [],
        forbidden_fields: [],
        round_id: "round-a",
        round_no: 1,
        run_id: "run-a",
        source_runtime_path: ["student_bff"],
        team_id: "team-a",
        tenant_id: "tenant-a",
        evidence_label: "STUDENT_PROJECTION_EVIDENCE",
        feedback: {}
      },
      learning_report: {
        actor_role: "student",
        advisory_slots: [],
        allowed_actions: [],
        course_id: "course-a",
        explicit_non_proof: [],
        forbidden_fields: [],
        round_id: "round-a",
        round_no: 1,
        run_id: "run-a",
        source_runtime_path: ["student_bff"],
        team_id: "team-a",
        tenant_id: "tenant-a",
        evidence_label: "STUDENT_PROJECTION_EVIDENCE",
        learning_evidence: { advisory_only: true, formal_grade: false, prompts: [] }
      }
    } as never;
    const response = (ok: boolean, data: unknown): Response =>
      ({
        ok,
        json: async () =>
          ok
            ? { data }
            : { code: "STUDENT_BFF_UNAVAILABLE", message: "failed current-context refresh" }
      }) as Response;
    let demoStateRequests = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/login")) return response(true, session);
      if (url.includes("/api/v1/demo-state")) {
        demoStateRequests += 1;
        return demoStateRequests === 1 ? response(true, state) : response(false, null);
      }
      if (url.includes("/api/v1/bff/student/runs/")) return response(true, cockpit);
      if (url.includes("/api/v1/bff/student/role-workspace")) {
        return {
          ok: false,
          json: async () => ({
            code: "ROLE_WORKFLOW_ASSIGNMENT_NOT_FOUND",
            message: "ROLE_WORKFLOW_ASSIGNMENT_NOT_FOUND: legacy decision path"
          })
        } as Response;
      }
      if (url.includes("/api/v1/runs/") && init?.method === "POST") {
        return response(true, { decision_id: "decision-a" });
      }
      return response(false, null);
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    const setInputValue = (label: string, value: string) => {
      const input = [...container.querySelectorAll("input")].find(
        (candidate) => candidate.getAttribute("aria-label") === label
      );
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, value);
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    };
    await act(async () => {
      setInputValue("tenant", "tenant-a");
      setInputValue("username", "student-a");
      setInputValue("password", "password-a");
    });
    const loginButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("学员登录")
    );
    await act(async () => {
      loginButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      await vi.waitFor(() => {
        expect(demoStateRequests).toBe(1);
        expect(container.querySelector("#student-submission")).not.toBeNull();
      });
    });

    const pricing = container.querySelector<HTMLInputElement>("#student-submission input");
    expect(pricing).not.toBeNull();
    const pricingSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    pricingSetter?.call(pricing, "17000");
    pricing?.dispatchEvent(new Event("input", { bubbles: true }));
    expect(pricing?.value).toBe("17000");

    const submitButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("提交正式决策")
    );
    expect(submitButton).toBeDefined();
    await act(async () => {
      await vi.waitFor(() => expect(submitButton?.disabled).toBe(false));
      submitButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      await vi.waitFor(() =>
        expect(container.textContent).toContain("正式决策已提交；最新工作区刷新失败，请重新加载。")
      );
    });
    expect(pricing?.value).toBe("17000");

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("clears role workflow busy state after the command refresh completes", async () => {
    const workspace = {
      schema_version: "student-role-workflow-workspace.v1",
      context: {
        role_key: "CEO",
        permissions: {
          editable_fields: ["strategy_statement"],
          can_read_role_workspace: true,
          can_save_section: true,
          can_mark_ready: true,
          can_create_merge_commit: true,
          can_confirm_team_decision: true,
          can_submit_canonical_decision: true
        }
      },
      assignment: { role_key: "CEO", status: "active", team_id: "team-a", user_id: "student-a" },
      section: {
        status: "draft",
        version: 1,
        payload: {
          pricing: { base_price: 12800 },
          marketing_budget: 0,
          service_quality_budget: 0,
          capacity_plan: "hold",
          cash_buffer_target: 0.1,
          strategy_statement: ""
        }
      }
    } as unknown as StudentRoleWorkflowWorkspaceDTO;
    const response = (data: unknown): Response =>
      ({ ok: true, json: async () => ({ data }) }) as Response;
    const deferred = <T,>() => {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
      });
      return { promise, resolve };
    };
    const initial = deferred<Response>();
    const trace = deferred<Response>();
    const command = deferred<Response>();
    const refreshed = deferred<Response>();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(async () => initial.promise)
      .mockImplementationOnce(async () => trace.promise)
      .mockImplementationOnce(async () => command.promise)
      .mockImplementationOnce(async () => refreshed.promise);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <StudentRoleWorkflowPanel
          active
          roundId="round-a"
          runId="run-a"
          teamId="team-a"
          tenantId="tenant-a"
          token="student-token"
        />
      );
    });

    await act(async () => {
      initial.resolve(response(workspace));
      await initial.promise;
    });
    await act(async () => {
      trace.resolve(
        response({
          schema_version: "student-decision-trace.v1",
          trace_stages: [],
          current_stage: "NOT_STARTED",
          trace_completeness: "empty"
        })
      );
      await trace.promise;
    });
    const saveButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("保存角色草稿")
    );
    expect(saveButton).toBeDefined();
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(saveButton?.disabled).toBe(true);

    await act(async () => {
      command.resolve(response(workspace.section));
      await Promise.resolve();
    });
    await act(async () => {
      refreshed.resolve(response(workspace));
      await refreshed.promise;
    });
    expect(saveButton?.disabled).toBe(false);
    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("keeps ready role fields frozen and honors every server command permission", async () => {
    const workspace = {
      schema_version: "student-role-workflow-workspace.v1",
      context: {
        role_key: "CEO",
        permissions: {
          editable_fields: ["strategy_statement", "pricing.base_price", "capacity_plan"],
          can_read_role_workspace: true,
          can_save_section: false,
          can_mark_ready: false,
          can_create_merge_commit: false,
          can_confirm_team_decision: true,
          can_submit_canonical_decision: false
        }
      },
      assignment: { role_key: "CEO", status: "active", team_id: "team-a", user_id: "student-a" },
      section: {
        status: "ready",
        version: 1,
        payload: {
          pricing: { base_price: 12800 },
          marketing_budget: 0,
          service_quality_budget: 0,
          capacity_plan: "hold",
          cash_buffer_target: 0.1,
          strategy_statement: "ready"
        }
      },
      merge_candidate: { merge_commit_id: "merge-a", status: "validated" }
    } as unknown as StudentRoleWorkflowWorkspaceDTO;
    let resolveWorkspace!: (response: Response) => void;
    const pendingWorkspace = new Promise<Response>((resolve) => {
      resolveWorkspace = resolve;
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => pendingWorkspace);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <StudentRoleWorkflowPanel
          active
          roundId="round-a"
          runId="run-a"
          teamId="team-a"
          tenantId="tenant-a"
          token="student-token"
        />
      );
    });
    await act(async () => {
      resolveWorkspace({
        ok: true,
        json: async () => ({ data: workspace })
      } as unknown as Response);
      await pendingWorkspace;
    });

    for (const field of container.querySelectorAll("input, select, textarea")) {
      expect((field as HTMLInputElement).disabled).toBe(true);
    }
    const action = (label: string) =>
      [...container.querySelectorAll("button")].find((button) => button.textContent === label);
    expect(action("保存角色草稿")?.disabled).toBe(true);
    expect(action("提交角色草稿")?.disabled).toBe(true);
    expect(action("确认团队决策")).toBeUndefined();

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("clears role workflow busy state when the server round context changes mid-command", async () => {
    const workspace = {
      schema_version: "student-role-workflow-workspace.v1",
      context: {
        role_key: "CEO",
        permissions: {
          editable_fields: ["strategy_statement"],
          can_read_role_workspace: true,
          can_save_section: true,
          can_mark_ready: true,
          can_create_merge_commit: false,
          can_confirm_team_decision: false,
          can_submit_canonical_decision: false
        }
      },
      assignment: { role_key: "CEO", status: "active", team_id: "team-a", user_id: "student-a" },
      section: {
        status: "draft",
        version: 1,
        payload: {
          pricing: { base_price: 12800 },
          marketing_budget: 0,
          service_quality_budget: 0,
          capacity_plan: "hold",
          cash_buffer_target: 0.1,
          strategy_statement: ""
        }
      }
    } as unknown as StudentRoleWorkflowWorkspaceDTO;
    const response = (data: unknown): Response =>
      ({ ok: true, json: async () => ({ data }) }) as Response;
    let resolveInitial!: (value: Response) => void;
    let resolveNext!: (value: Response) => void;
    const initial = new Promise<Response>((resolve) => (resolveInitial = resolve));
    const staleCommand = new Promise<Response>(() => undefined);
    const next = new Promise<Response>((resolve) => (resolveNext = resolve));
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(async () => initial)
      .mockImplementationOnce(async () => staleCommand)
      .mockImplementationOnce(async () => next);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const renderRound = (roundId: string) => (
      <StudentRoleWorkflowPanel
        active
        roundId={roundId}
        runId="run-a"
        teamId="team-a"
        tenantId="tenant-a"
        token="student-token"
      />
    );
    act(() => root.render(renderRound("round-a")));
    await act(async () => {
      resolveInitial(response(workspace));
      await initial;
    });
    const saveButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("保存角色草稿")
    );
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(saveButton?.disabled).toBe(true);

    act(() => root.render(renderRound("round-b")));
    expect(
      [...container.querySelectorAll("button")].some(
        (button) => button.textContent?.includes("保存角色草稿") && button.disabled
      )
    ).toBe(false);
    await act(async () => {
      resolveNext(response(workspace));
      await next;
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("renders a retryable role-workflow error when the initial projection fails", async () => {
    const errorResponse = {
      ok: false,
      json: async () => ({ code: "ROLE_WORKFLOW_TEMPORARY", message: "temporary" })
    } as unknown as Response;
    let allowSuccess = false;
    const successWorkspace = {
      schema_version: "student-role-workflow-workspace.v1",
      context: { permissions: { can_read_role_workspace: true } },
      assignment: { role_key: "CEO" },
      section: { status: "draft", version: 1, payload: {} }
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (!allowSuccess) return errorResponse;
      return {
        ok: true,
        json: async () => ({
          data: String(input).includes("decision-trace")
            ? {
                schema_version: "student-decision-trace.v1",
                trace_stages: [],
                current_stage: "NOT_STARTED",
                trace_completeness: "empty"
              }
            : successWorkspace
        })
      } as unknown as Response;
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <StudentRoleWorkflowPanel
          active
          roundId="round-a"
          runId="run-a"
          teamId="team-a"
          tenantId="tenant-a"
          token="student-token"
        />
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(container.querySelector('[data-state="error"]')).not.toBeNull();
    expect(container.textContent).toContain("角色工作区请求失败，请刷新后重试");
    const retry = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("重新加载角色工作区")
    );
    expect(retry).toBeDefined();

    await act(async () => {
      allowSuccess = true;
      retry?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(container.textContent).toContain("当前角色工作区已就绪");

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("fails closed when a role-workflow command has no receipt data", async () => {
    const workspace = {
      schema_version: "student-role-workflow-workspace.v1",
      context: {
        role_key: "CEO",
        permissions: {
          editable_fields: ["strategy_statement"],
          can_read_role_workspace: true,
          can_save_section: true,
          can_mark_ready: true,
          can_create_merge_commit: false,
          can_confirm_team_decision: false,
          can_submit_canonical_decision: false
        }
      },
      assignment: { role_key: "CEO", status: "active", team_id: "team-a", user_id: "student-a" },
      section: {
        status: "draft",
        version: 1,
        payload: {
          pricing: { base_price: 12800 },
          marketing_budget: 0,
          service_quality_budget: 0,
          capacity_plan: "hold",
          cash_buffer_target: 0.1,
          strategy_statement: ""
        }
      }
    } as unknown as StudentRoleWorkflowWorkspaceDTO;
    const trace = {
      schema_version: "student-decision-trace.v1",
      trace_stages: [],
      current_stage: "NOT_STARTED",
      trace_completeness: "empty"
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("decision-trace")) {
        return { ok: true, json: async () => ({ data: trace }) } as Response;
      }
      if (url.includes("/role-workspace/section")) {
        return { ok: true, json: async () => ({}) } as Response;
      }
      return { ok: true, json: async () => ({ data: workspace }) } as Response;
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <StudentRoleWorkflowPanel
          active
          roundId="round-a"
          runId="run-a"
          teamId="team-a"
          tenantId="tenant-a"
          token="student-token"
        />
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(container.textContent).toContain("当前角色工作区已就绪");
    const save = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("保存角色草稿")
    );
    expect(save).toBeDefined();
    await act(async () => {
      save?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(container.textContent).toContain("未知回执");
    expect(container.textContent).not.toContain("角色草稿已保存");

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("clears the previous role workspace while a new context is loading", async () => {
    const workspace = {
      schema_version: "student-role-workflow-workspace.v1",
      context: {
        role_key: "CEO",
        permissions: {
          editable_fields: ["strategy_statement"],
          can_read_role_workspace: true,
          can_save_section: true,
          can_mark_ready: true,
          can_create_merge_commit: false,
          can_confirm_team_decision: false,
          can_submit_canonical_decision: false
        }
      },
      assignment: { role_key: "CEO", status: "active", team_id: "team-a", user_id: "student-a" },
      section: {
        status: "draft",
        version: 1,
        payload: {
          pricing: { base_price: 12800 },
          marketing_budget: 0,
          service_quality_budget: 0,
          capacity_plan: "hold",
          cash_buffer_target: 0.1,
          strategy_statement: "旧上下文私有草稿"
        }
      }
    } as unknown as StudentRoleWorkflowWorkspaceDTO;
    let resolveNext!: (response: Response) => void;
    const next = new Promise<Response>((resolve) => (resolveNext = resolve));
    const trace = {
      schema_version: "student-decision-trace.v1",
      trace_stages: [],
      current_stage: "NOT_STARTED",
      trace_completeness: "empty"
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("round_id=round-b")) return next;
      if (url.includes("decision-trace")) {
        return { ok: true, json: async () => ({ data: trace }) } as Response;
      }
      return { ok: true, json: async () => ({ data: workspace }) } as Response;
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const render = (roundId: string) => (
      <StudentRoleWorkflowPanel
        active
        roundId={roundId}
        runId="run-a"
        teamId="team-a"
        tenantId="tenant-a"
        token="student-token"
      />
    );
    act(() => root.render(render("round-a")));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(container.textContent).toContain("旧上下文私有草稿");
    act(() => root.render(render("round-b")));
    expect(container.textContent).not.toContain("旧上下文私有草稿");
    expect(container.textContent).toContain("正在读取当前角色工作区");
    await act(async () => {
      resolveNext({ ok: true, json: async () => ({ data: workspace }) } as Response);
      await next;
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
  });

  it("keeps the legacy bootstrap projection bounded to the signed-in team", () => {
    const source = {
      current_user: {
        user_id: "student-a",
        tenant_id: "tenant-a",
        display_name: "学员 A",
        roles: ["learner"],
        team_id: "team-a"
      },
      courses: [
        {
          course_id: "course-a",
          tenant_id: "tenant-a",
          title: "课程 A",
          status: "active",
          scenario_package_id: "scenario-a",
          parameter_set_id: "parameter-a",
          created_by: "teacher-a"
        }
      ],
      teams: [
        {
          team_id: "team-a",
          tenant_id: "tenant-a",
          course_id: "course-a",
          name: "队伍 A",
          captain_user_id: "student-a",
          members: []
        },
        {
          team_id: "team-b",
          tenant_id: "tenant-a",
          course_id: "course-a",
          name: "队伍 B",
          captain_user_id: "student-b",
          members: []
        }
      ],
      runs: [
        {
          run_id: "run-a",
          tenant_id: "tenant-a",
          course_id: "course-a",
          scenario_package_id: "scenario-a",
          parameter_set_id: "parameter-a",
          seed: 1,
          status: "active"
        }
      ],
      rounds: [
        {
          round_id: "round-a",
          tenant_id: "tenant-a",
          run_id: "run-a",
          round_no: 1,
          status: "open",
          opened_at: "2026-08-13T00:00:00Z"
        }
      ],
      decisions: [
        {
          decision_id: "decision-a",
          tenant_id: "tenant-a",
          run_id: "run-a",
          round_id: "round-a",
          round_no: 1,
          team_id: "team-a",
          status: "draft",
          version: 1,
          payload: {
            pricing: { base_price: 1 },
            marketing_budget: 0,
            service_quality_budget: 0,
            capacity_plan: "hold",
            cash_buffer_target: 0,
            strategy_statement: ""
          },
          validation_report: [],
          submitted_by: "student-a"
        },
        {
          decision_id: "decision-b",
          tenant_id: "tenant-a",
          run_id: "run-a",
          round_id: "round-a",
          round_no: 1,
          team_id: "team-b",
          status: "draft",
          version: 1,
          payload: {
            pricing: { base_price: 2 },
            marketing_budget: 0,
            service_quality_budget: 0,
            capacity_plan: "hold",
            cash_buffer_target: 0,
            strategy_statement: ""
          },
          validation_report: [],
          submitted_by: "student-b"
        }
      ],
      audit_logs: []
    } as unknown as P0DemoState;

    const projected = projectStudentBootstrapState(source);
    expect(projected.teams.map(({ team_id }) => team_id)).toEqual(["team-a"]);
    expect(projected.decisions.map(({ team_id }) => team_id)).toEqual(["team-a"]);
    expect(projected).not.toHaveProperty("tenants");
    expect(projected).not.toHaveProperty("latest_result");

    const decisionBoundSource = structuredClone(source);
    decisionBoundSource.courses.push({
      ...decisionBoundSource.courses[0]!,
      course_id: "course-b",
      title: "课程 B"
    });
    decisionBoundSource.runs.push({
      ...decisionBoundSource.runs[0]!,
      course_id: "course-b",
      run_id: "run-b"
    });
    decisionBoundSource.rounds.push({
      ...decisionBoundSource.rounds[0]!,
      round_id: "round-b",
      run_id: "run-b"
    });
    decisionBoundSource.decisions.push({
      ...decisionBoundSource.decisions[0]!,
      decision_id: "decision-c",
      round_id: "round-b",
      run_id: "run-b"
    });
    const decisionBoundProjection = projectStudentBootstrapState(decisionBoundSource);
    expect(decisionBoundProjection.runs.map(({ run_id }) => run_id)).toEqual(["run-b"]);
    expect(decisionBoundProjection.decisions.map(({ decision_id }) => decision_id)).toEqual([
      "decision-c"
    ]);

    const laterRoundSource = structuredClone(source);
    laterRoundSource.rounds[0]!.status = "closed";
    laterRoundSource.rounds.push({
      ...laterRoundSource.rounds[0]!,
      round_id: "round-a-2",
      round_no: 2,
      status: "open"
    });
    laterRoundSource.decisions.push({
      ...laterRoundSource.decisions[0]!,
      decision_id: "decision-a-2",
      round_id: "round-a-2",
      round_no: 2
    });
    const laterRoundProjection = projectStudentBootstrapState(laterRoundSource);
    expect(laterRoundProjection.rounds.map(({ round_no }) => round_no)).toEqual([2]);
    expect(laterRoundProjection.decisions.map(({ decision_id }) => decision_id)).toEqual([
      "decision-a-2"
    ]);
  });
});
