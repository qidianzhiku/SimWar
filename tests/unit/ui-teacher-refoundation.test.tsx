import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  TEACHER_NAVIGATION_ITEMS,
  TeacherCourseWorkspace,
  TeacherLocation,
  TeacherPermissionDenied,
  TeacherNextStepButton,
  getTeacherRoundAction,
  getTeacherNoticeLabel,
  getTeacherWorkspaceState,
  isTeacherRoundActionAllowed
} from "../../apps/teacher/src/TeacherCourseWorkspace";

describe("Teacher Course OS workspace", () => {
  it("requires real content inside every course OS location without empty placeholders", () => {
    const requiredLocations = [
      "teacher-today",
      "teacher-blockers",
      "teacher-courses",
      "teacher-readiness",
      "teacher-teams-roles",
      "teacher-round-control",
      "teacher-results",
      "teacher-debrief",
      "teacher-evidence",
      "teacher-reports",
      "teacher-validation",
      "teacher-close-cleanup"
    ] as const;
    const markup = renderToStaticMarkup(
      <TeacherCourseWorkspace context={{ tenant: "tenant_demo", role: "教师" }}>
        {requiredLocations.map((id) => (
          <TeacherLocation id={id} key={id}>
            <article data-location-content={id}>{id} content</article>
          </TeacherLocation>
        ))}
      </TeacherCourseWorkspace>
    );

    expect(markup).not.toContain("相关工作台将在服务端上下文就绪后显示。");
    for (const id of requiredLocations) {
      expect(markup).toContain(`id="${id}"`);
      expect(markup).toContain(`data-location-content="${id}"`);
    }
  });

  it("exposes the twelve required logical locations with independently named Chinese navigation", () => {
    const markup = renderToStaticMarkup(
      <TeacherCourseWorkspace context={{ tenant: "tenant_demo", role: "教师" }}>
        <p>今日工作内容</p>
      </TeacherCourseWorkspace>
    );

    expect(markup).toContain('href="#teacher-today"');
    expect(markup).toContain("今日工作");
    expect(markup).toContain('href="#teacher-blockers"');
    expect(markup).toContain("即将阻断");
    expect(markup).toContain('href="#teacher-courses"');
    expect(markup).toContain("课程与班级");
    expect(markup).toContain('href="#teacher-readiness"');
    expect(markup).toContain("开课准备");
    expect(markup).toContain('href="#teacher-teams-roles"');
    expect(markup).toContain("团队与角色");
    expect(markup).toContain('href="#teacher-round-control"');
    expect(markup).toContain("轮次控制");
    expect(markup).toContain('href="#teacher-results"');
    expect(markup).toContain("结果发布");
    expect(markup).toContain('href="#teacher-debrief"');
    expect(markup).toContain("复盘工作室");
    expect(markup).toContain('href="#teacher-evidence"');
    expect(markup).toContain("学习证据确认");
    expect(markup).toContain('href="#teacher-reports"');
    expect(markup).toContain("报告生成");
    expect(markup).toContain('href="#teacher-validation"');
    expect(markup).toContain("验证会话");
    expect(markup).toContain('href="#teacher-close-cleanup"');
    expect(markup).toContain("收尾与清理");
  });

  it("renders every navigation target as a real section landmark", () => {
    const requiredLocations = [
      "teacher-today",
      "teacher-blockers",
      "teacher-courses",
      "teacher-readiness",
      "teacher-teams-roles",
      "teacher-round-control",
      "teacher-results",
      "teacher-debrief",
      "teacher-evidence",
      "teacher-reports",
      "teacher-validation",
      "teacher-close-cleanup"
    ] as const;
    const markup = renderToStaticMarkup(
      <TeacherCourseWorkspace context={{ tenant: "tenant_demo", role: "教师" }}>
        {requiredLocations.map((id) => (
          <TeacherLocation id={id} key={id}>
            <p>{id} content</p>
          </TeacherLocation>
        ))}
      </TeacherCourseWorkspace>
    );

    for (const id of requiredLocations) {
      expect(markup).toContain(`id="${id}"`);
    }
  });

  it("keeps ContextBar limited to supplied session values", () => {
    const markup = renderToStaticMarkup(
      <TeacherCourseWorkspace context={{ tenant: "华东试点", role: "教师" }}>
        <p>今日工作内容</p>
      </TeacherCourseWorkspace>
    );

    expect(markup).toContain("华东试点");
    expect(markup).toContain("教师");
    expect(markup).not.toContain("默认租户");
    expect(markup).not.toContain("session-001");
    expect(markup).not.toContain("run-001");
    expect(markup).not.toContain("round-1");
    expect(markup).not.toContain("team-001");
  });

  it("does not render Teacher shell, navigation, Today, or commands for another role", () => {
    const markup = renderToStaticMarkup(<TeacherPermissionDenied role="学员" />);

    expect(markup).toContain("当前会话没有教师工作区权限");
    expect(markup).toContain("请使用已获服务端授权的教师会话");
    expect(markup).not.toContain('aria-label="角色导航"');
    expect(markup).not.toContain("今日工作");
    expect(markup).not.toContain("开启回合");
    expect(markup).not.toContain("round:start");
  });

  it("maps each formal round status to the exact server action", () => {
    expect(getTeacherRoundAction("draft")).toBe("round:start");
    expect(getTeacherRoundAction("open")).toBe("round:lock");
    expect(getTeacherRoundAction("locked")).toBe("settlement:settle");
    expect(getTeacherRoundAction("settled")).toBe("round:publish");
    expect(getTeacherRoundAction("published")).toBeNull();
  });

  it("requires the exact BFF server action before enabling a formal command", () => {
    expect(isTeacherRoundActionAllowed("draft", ["round:lock"])).toBe(false);
    expect(isTeacherRoundActionAllowed("draft", ["round:start"])).toBe(true);
    expect(isTeacherRoundActionAllowed("open", ["round:start"])).toBe(false);
    expect(isTeacherRoundActionAllowed("open", ["round:lock"])).toBe(true);
    expect(isTeacherRoundActionAllowed("locked", ["settlement:settle"])).toBe(true);
    expect(isTeacherRoundActionAllowed("settled", ["round:publish"])).toBe(true);
  });

  it("shows a truthful disabled reason when BFF omits the formal action", () => {
    const markup = renderToStaticMarkup(
      <TeacherNextStepButton roundStatus="draft" allowedActions={[]} onClick={vi.fn()}>
        开启回合
      </TeacherNextStepButton>
    );

    expect(markup).toContain('data-action="round:start"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("服务端未授权此操作");
    expect(markup).toContain("开启回合");
  });

  it("keeps the primary command enabled only for the matching BFF action", () => {
    const markup = renderToStaticMarkup(
      <TeacherNextStepButton
        roundStatus="locked"
        allowedActions={["settlement:settle"]}
        onClick={vi.fn()}
      >
        请求结算
      </TeacherNextStepButton>
    );

    expect(markup).not.toContain("disabled");
    expect(markup).toContain('data-action="settlement:settle"');
  });

  it("keeps busy state truthful and does not relabel processing as unauthorized", () => {
    const markup = renderToStaticMarkup(
      <TeacherNextStepButton
        roundStatus="settled"
        allowedActions={["round:publish"]}
        loading
        onClick={vi.fn()}
      >
        发布结果
      </TeacherNextStepButton>
    );

    expect(markup).toContain("处理中…");
    expect(markup).toContain("正在处理中");
    expect(markup).not.toContain("服务端未授权此操作");
  });

  it("prioritizes authorization over an unrelated disabled condition", () => {
    const unauthorized = renderToStaticMarkup(
      <TeacherNextStepButton roundStatus="open" allowedActions={[]} disabled onClick={vi.fn()}>
        锁定回合
      </TeacherNextStepButton>
    );
    const authorizedButDisabled = renderToStaticMarkup(
      <TeacherNextStepButton
        roundStatus="open"
        allowedActions={["round:lock"]}
        disabled
        onClick={vi.fn()}
      >
        锁定回合
      </TeacherNextStepButton>
    );

    expect(unauthorized).toContain("服务端未授权此操作");
    expect(authorizedButDisabled).toContain("当前操作暂不可用");
    expect(authorizedButDisabled).not.toContain("服务端未授权此操作");
  });

  it("explains that a published round is read-only and has no next command", () => {
    const markup = renderToStaticMarkup(
      <TeacherNextStepButton
        roundStatus="published"
        allowedActions={["round:start"]}
        onClick={vi.fn()}
      >
        已发布
      </TeacherNextStepButton>
    );

    expect(markup).toContain('aria-label="已发布"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("回合已发布，当前没有下一项正式命令");
  });

  it("uses Chinese headings for the shell and Today surface", () => {
    const markup = renderToStaticMarkup(
      <TeacherCourseWorkspace context={{ tenant: "tenant_demo", role: "教师" }}>
        <p>下一项任务：检查开课准备</p>
      </TeacherCourseWorkspace>
    );

    expect(markup).toContain("SimWar 教师课程工作区");
    expect(markup).toContain("今日工作");
    expect(markup).toContain("下一项任务：检查开课准备");
  });

  it("projects shell state from session, demo state, selected run, and BFF load state", () => {
    expect(
      getTeacherWorkspaceState({
        hasSession: false,
        hasState: false,
        hasRun: false,
        hasRound: false,
        hasWorkspace: false,
        workspaceLoadState: "idle"
      })
    ).toEqual({ status: "empty", message: "请先登录教师会话" });
    expect(
      getTeacherWorkspaceState({
        hasSession: true,
        hasState: true,
        hasRun: true,
        hasRound: true,
        hasWorkspace: false,
        workspaceLoadState: "loading"
      })
    ).toEqual({ status: "loading", message: "正在加载服务端回合权限，请稍候再试" });
    expect(
      getTeacherWorkspaceState({
        hasSession: true,
        hasState: true,
        hasRun: true,
        hasRound: true,
        hasWorkspace: false,
        workspaceLoadState: "error"
      })
    ).toEqual({ status: "error", message: "服务端回合权限加载失败，正式操作已关闭" });
    expect(
      getTeacherWorkspaceState({
        hasSession: true,
        hasState: true,
        hasRun: false,
        hasRound: false,
        hasWorkspace: false,
        workspaceLoadState: "idle"
      })
    ).toEqual({ status: "empty", message: "当前会话暂无可用 Run" });
    expect(
      getTeacherWorkspaceState({
        hasSession: true,
        hasState: true,
        hasRun: true,
        hasRound: false,
        hasWorkspace: false,
        workspaceLoadState: "idle"
      })
    ).toEqual({ status: "partial", message: "当前 Run 尚未提供回合上下文" });
    expect(
      getTeacherWorkspaceState({
        hasSession: true,
        hasState: true,
        hasRun: true,
        hasRound: true,
        hasWorkspace: true,
        workspaceLoadState: "ready"
      })
    ).toEqual({
      status: "ready",
      message: "仅展示服务端提供的课程、回合和权限上下文，不在前端计算正式结果。"
    });
  });

  it("maps known operational notices to Chinese while preserving unknown server text", () => {
    expect(getTeacherNoticeLabel("signed in")).toBe("已登录");
    expect(getTeacherNoticeLabel("run created")).toBe("运行批次已创建");
    expect(getTeacherNoticeLabel("round opened")).toBe("回合已开启");
    expect(getTeacherNoticeLabel("round locked")).toBe("回合已锁定");
    expect(getTeacherNoticeLabel("settlement completed")).toBe("结算已完成");
    expect(getTeacherNoticeLabel("result published")).toBe("正式结果已发布");
    expect(getTeacherNoticeLabel("not signed in")).toBe("尚未登录");
    expect(getTeacherNoticeLabel("backend says no")).toBe("服务端返回未本地化状态，请查看技术详情");
  });

  it("keeps internal settlement truth out of the Teacher result projection", () => {
    const appSource = readFileSync("apps/teacher/src/App.tsx", "utf8");
    expect(appSource).not.toContain("state_true");
    expect(appSource).not.toContain("利润");
  });

  it("keeps the navigation contract as the twelve named hashes", () => {
    expect(TEACHER_NAVIGATION_ITEMS).toHaveLength(12);
    expect(TEACHER_NAVIGATION_ITEMS[0]).toMatchObject({ id: "teacher-today", label: "今日工作" });
    expect(TEACHER_NAVIGATION_ITEMS[11]).toMatchObject({
      id: "teacher-close-cleanup",
      label: "收尾与清理"
    });
  });
});
