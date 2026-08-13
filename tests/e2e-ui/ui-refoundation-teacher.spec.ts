import { expect, test, type Page } from "@playwright/test";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;

const state = {
  courses: [
    {
      course_id: "course_demo",
      status: "published",
      tenant_id: "tenant_demo",
      title: "教师课程"
    }
  ],
  teams: [
    {
      course_id: "course_demo",
      members: [],
      name: "示例队伍",
      team_id: "team_alpha"
    }
  ],
  runs: [
    {
      course_id: "course_demo",
      run_id: "run_teacher_test",
      status: "active"
    }
  ],
  rounds: [
    {
      round_id: "round_teacher_test",
      round_no: 1,
      run_id: "run_teacher_test",
      status: "draft"
    }
  ],
  decisions: [],
  latest_result: null,
  audit_logs: []
};

const raceState = {
  ...state,
  runs: [
    { ...state.runs[0], run_id: "run_new" },
    { ...state.runs[0], run_id: "run_old" }
  ],
  rounds: [
    { ...state.rounds[0], round_id: "round_old", run_id: "run_old", status: "draft" },
    { ...state.rounds[0], round_id: "round_new", run_id: "run_new", status: "draft" }
  ]
};

const teacherResult = {
  state_est: {
    explanation: "结果解释",
    next_round_risk: "balanced",
    recommended_focus: "下一轮聚焦现金缓冲"
  },
  state_obs: {
    demand_band: "medium",
    profit_band: "healthy",
    rank: 1,
    revenue: 120,
    score: 88,
    served_demand: 20
  },
  state_true: {
    cash_flow: 999999,
    cost: 2,
    demand: 20,
    market_share: 0.5,
    profit: 118,
    rank: 1,
    revenue: 120,
    score: 88,
    served_demand: 20,
    settlement_status: "settled",
    internal_marker: "PRIVATE_TRUTH_SENTINEL"
  },
  team_id: "team_alpha",
  team_name: "示例队伍"
};

const blockedReadiness = {
  calibration_status: "DRAFT_REGISTER_ONLY",
  compatibility_status: "INCOMPATIBLE",
  course_id: "course_demo",
  eligible: false,
  evidence_freshness: { collected_at: null, expires_at: null, is_expired: false },
  explicit_non_proofs: ["不会激活运行时"],
  license_status: "UNVERIFIED",
  no_go_reasons: ["SCENARIO_PACKAGE_NOT_PUBLISHED"],
  operation_id: "R7_TEACHER_SCENARIO_SELECTION_READINESS_GET_V1",
  parameter_set_id: "parameter_demo",
  provenance_status: "MISSING",
  qa_status: "DRAFT_REVIEW_REQUIRED",
  readiness_status: "BLOCKED",
  run_id: "run_teacher_test",
  runtime_adapter_status: "NOT_REGISTERED",
  scenario_package_id: "scenario_demo",
  tenant_id: "tenant_demo"
};

const copyCourseBlueprint = {
  compatibility_constraints: {},
  course_blueprint_reference: {
    content_digest: "b".repeat(64),
    course_blueprint_id: "blueprint_copy",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  duration_minutes: 60,
  objectives_summary: ["练习课堂决策"],
  phases_summary: [],
  status: "APPROVED",
  title: "中文课程蓝图"
};

const copyFormalScenario = {
  parameter_set_reference: {
    content_digest: "c".repeat(64),
    parameter_set_id: "parameter_copy",
    version: "1.0.0"
  },
  scenario_package_reference: {
    content_digest: "d".repeat(64),
    scenario_package_id: "scenario_copy",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  schema_version: "scenario-package.v1",
  status: "APPROVED"
};

const copyFormalBindingPreview = {
  engine_profile: {
    engine_id: "toy_logit_wellness_v1",
    runtime_authority: "simulation-core",
    version: "1.0.0"
  },
  formal_course_binding: {
    course_blueprint_reference: copyCourseBlueprint.course_blueprint_reference,
    scenario_package_reference: copyFormalScenario.scenario_package_reference
  }
};

function teacherSession(roles: string[], identity: { tenantId?: string; username?: string } = {}) {
  const username = identity.username ?? (roles.includes("teacher") ? "teacher" : "student");
  const tenantId = identity.tenantId ?? "tenant_demo";
  return {
    access_token: `${username}-ui-token`,
    expires_at: "2099-01-01T00:00:00.000Z",
    user: {
      display_name: identity.username ? username : roles.includes("teacher") ? "教师" : "学员",
      roles,
      tenant_id: tenantId,
      user_id: `${username}-001`
    }
  };
}

function teacherWorkspace(
  allowedActions: string[],
  runId = "run_teacher_test",
  roundId = "round_teacher_test",
  resultRows: readonly unknown[] = []
) {
  const evidence = "RUNTIME_ENTRYPOINT_EVIDENCE";
  const shared = {
    actor_role: "teacher",
    allowed_actions: allowedActions,
    audit_reference: [],
    course_id: "course_demo",
    explicit_non_proof: [],
    evidence_label: evidence,
    redacted_fields: [],
    run_id: runId,
    source_runtime_path: ["/api/v1/bff/teacher"],
    tenant_id: "tenant_demo"
  };
  return {
    course_workspace: {
      ...shared,
      scenario_reference: {
        parameter_set_id: "parameter_demo",
        plugin_package_id: "wellness",
        run_seed: 1,
        scenario_package_id: "scenario_demo"
      },
      visible_state: { course_title: "教师课程", run_status: "active" }
    },
    round_control: {
      ...shared,
      round_id: roundId,
      round_no: 1,
      status: "draft",
      visible_state: { decision_count: 0, settlement_available: false, team_count: 1 }
    },
    teacher_dashboard: {
      ...shared,
      visible_state: { course_status: "published", round_status: "draft", team_count: 1 }
    },
    teacher_replay_summary: {
      ...shared,
      authorized_result_snapshot: resultRows,
      formal_truth_write_allowed: false,
      round_id: roundId,
      round_no: 1,
      visible_state: {
        result_count: resultRows.length,
        runtime_boundary: "current_json_active_runtime"
      }
    },
    team_monitor: {
      ...shared,
      teams: [],
      visible_state: { decision_count: 0, team_count: 1 }
    }
  };
}

async function mockTeacherApi(
  page: Page,
  roles: string[],
  options: {
    coursePackages?: readonly unknown[];
    resultRows?: readonly unknown[];
    scenarioReadinessResponse?: unknown;
    stateData?: typeof state;
    workspaceAllowedActionsByRun?: Record<string, readonly string[]>;
    workspaceDeferredRuns?: readonly string[];
    workspaceUnavailable?: boolean;
    loginDeferredUsers?: readonly string[];
    demoDeferredTokens?: readonly string[];
    demoRejectedTokens?: readonly string[];
    courseBlueprintCatalogResponse?: unknown;
    formalScenarioCatalogResponse?: unknown;
    formalBindingPreviewResponse?: unknown;
  } = {}
) {
  let allowedActions: string[] = [];
  let startRequests = 0;
  const deferredWorkspaceResolvers = new Map<string, () => void>();
  const deferredLoginResolvers = new Map<string, () => void>();
  const deferredDemoResolvers = new Map<string, () => void>();
  const loginRequests = new Set<string>();
  const demoRequests = new Set<string>();
  const completedLoginResponses = new Set<string>();
  const completedDemoResponses = new Set<string>();
  const workspaceRequests = new Set<string>();
  const workspaceAuthRequests: Array<{ tenantId: string; token: string }> = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/v1/auth/login" && request.method() === "POST") {
      const body = request.postDataJSON() as { username?: string };
      const username = body.username ?? "teacher";
      const tenantId = request.headers()["x-tenant-id"] ?? "tenant_demo";
      loginRequests.add(username);
      if (options.loginDeferredUsers?.includes(username)) {
        await new Promise<void>((resolve) => deferredLoginResolvers.set(username, resolve));
      }
      await route.fulfill({
        json: {
          code: "OK",
          data: teacherSession(roles, { tenantId, username }),
          message: "success"
        }
      });
      completedLoginResponses.add(username);
      return;
    }
    if (path === "/api/v1/demo-state") {
      const token = request.headers().authorization?.replace(/^Bearer\s+/u, "") ?? "";
      demoRequests.add(token);
      if (options.demoDeferredTokens?.includes(token)) {
        await new Promise<void>((resolve) => deferredDemoResolvers.set(token, resolve));
      }
      if (options.demoRejectedTokens?.includes(token)) {
        await route.fulfill({
          status: 503,
          json: { code: "SERVICE_UNAVAILABLE", data: null, message: "stale demo response" }
        });
        completedDemoResponses.add(token);
        return;
      }
      await route.fulfill({
        json: { code: "OK", data: options.stateData ?? state, message: "success" }
      });
      completedDemoResponses.add(token);
      return;
    }
    if (path.endsWith("/workspace")) {
      if (options.workspaceUnavailable) {
        await route.fulfill({
          status: 403,
          json: { code: "FORBIDDEN", data: null, message: "Teacher workspace unavailable" }
        });
        return;
      }
      const runId = path.match(/\/runs\/([^/]+)\/rounds\//)?.[1] ?? "run_teacher_test";
      workspaceRequests.add(runId);
      workspaceAuthRequests.push({
        tenantId: request.headers()["x-tenant-id"] ?? "",
        token: request.headers().authorization?.replace(/^Bearer\s+/u, "") ?? ""
      });
      if (options.workspaceDeferredRuns?.includes(runId)) {
        await new Promise<void>((resolve) => deferredWorkspaceResolvers.set(runId, resolve));
      }
      const runRoundId =
        runId === "run_teacher_test" ? "round_teacher_test" : `round_${runId.slice(4)}`;
      const runAllowedActions = options.workspaceAllowedActionsByRun?.[runId] ?? allowedActions;
      await route.fulfill({
        json: {
          code: "OK",
          data: teacherWorkspace([...runAllowedActions], runId, runRoundId, options.resultRows),
          message: "success"
        }
      });
      return;
    }
    if (path.includes("golden-journey/status")) {
      await route.fulfill({
        status: 403,
        json: { code: "FORBIDDEN", data: null, message: "Teacher scope denied" }
      });
      return;
    }
    if (path.includes("learning-reports") || path.includes("learning-exports")) {
      await route.fulfill({
        status: 403,
        json: { code: "FORBIDDEN", data: null, message: "Teacher scope denied" }
      });
      return;
    }
    if (path.includes("transfer-research-designs")) {
      await route.fulfill({
        status: 403,
        json: { code: "FORBIDDEN", data: null, message: "Teacher scope denied" }
      });
      return;
    }
    if (path.includes("fresh-learner-admission")) {
      await route.fulfill({
        status: 403,
        json: { code: "FORBIDDEN", data: null, message: "Teacher scope denied" }
      });
      return;
    }
    if (path.endsWith("/rounds/1/start") && request.method() === "POST") {
      startRequests += 1;
      await route.fulfill({ json: { code: "OK", data: state.rounds[0], message: "success" } });
      return;
    }
    if (path.includes("course-package-versions")) {
      await route.fulfill({
        json: {
          code: "OK",
          data: { course_package_versions: options.coursePackages ?? [] },
          message: "success"
        }
      });
      return;
    }
    if (path.includes("scenario-package-candidates")) {
      await route.fulfill({ json: { candidates: [] } });
      return;
    }
    if (path.includes("scenario-selection-readiness")) {
      if (options.scenarioReadinessResponse !== undefined) {
        await route.fulfill({ json: options.scenarioReadinessResponse });
      } else {
        await route.fulfill({
          status: 403,
          json: { error: { message: "Teacher scope denied" } }
        });
      }
      return;
    }
    if (path.includes("formal-scenario-package-catalog")) {
      await route.fulfill({
        json: options.formalScenarioCatalogResponse ?? { candidates: [], explicit_non_proofs: [] }
      });
      return;
    }
    if (path.endsWith("/course-blueprints")) {
      await route.fulfill({
        json: {
          data: options.courseBlueprintCatalogResponse ?? { candidates: [] }
        }
      });
      return;
    }
    if (path.includes("formal-course-bindings/preview")) {
      if (options.formalBindingPreviewResponse !== undefined) {
        await route.fulfill({
          json: { data: options.formalBindingPreviewResponse }
        });
      } else {
        await route.fulfill({
          status: 403,
          json: { code: "FORBIDDEN", data: null, message: "Teacher scope denied" }
        });
      }
      return;
    }
    await route.fulfill({
      status: 403,
      json: { code: "FORBIDDEN", data: null, message: "Teacher scope denied" }
    });
  });

  return {
    allowStart: () => {
      allowedActions = ["round:start"];
    },
    getStartRequests: () => startRequests,
    hasLoginRequest: (username: string) => loginRequests.has(username),
    hasCompletedLoginResponse: (username: string) => completedLoginResponses.has(username),
    releaseLogin: (username: string) => deferredLoginResolvers.get(username)?.(),
    getDemoRequests: () => [...demoRequests],
    hasCompletedDemoResponse: (token: string) => completedDemoResponses.has(token),
    releaseDemo: (token: string) => deferredDemoResolvers.get(token)?.(),
    getWorkspaceAuthRequests: () => [...workspaceAuthRequests],
    hasWorkspaceRequest: (runId: string) => workspaceRequests.has(runId),
    releaseWorkspace: (runId: string) => deferredWorkspaceResolvers.get(runId)?.()
  };
}

async function signIn(page: Page, username: string) {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(username);
  await page.getByLabel("password").fill(username);
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(page.getByLabel("教师操作通知")).toContainText("已登录");
  await expect(page.getByText("signed in", { exact: true }).first()).toBeVisible();
}

async function expectClosestLocation(page: Page, selector: string, locationId: string) {
  const target = page.locator(selector).first();
  await expect(target).toBeVisible();
  await expect
    .poll(() =>
      target.evaluate((element, expectedId) => element.closest(`#${expectedId}`)?.id, locationId)
    )
    .toBe(locationId);
}

test("Teacher Course OS exposes literal locations and gates the primary command by BFF action", async ({
  page
}) => {
  const api = await mockTeacherApi(page, ["teacher"]);
  await page.goto(teacherBaseUrl);
  await signIn(page, "teacher");

  await expect(page.getByRole("navigation", { name: "角色导航" })).toBeVisible();
  await expect(page.getByRole("link", { name: "今日工作" })).toHaveAttribute(
    "href",
    "#teacher-today"
  );
  await expect(page.getByRole("link", { name: "即将阻断" })).toHaveAttribute(
    "href",
    "#teacher-blockers"
  );
  await expect(page.getByRole("link", { name: "课程与班级" })).toHaveAttribute(
    "href",
    "#teacher-courses"
  );
  await expect(page.getByRole("link", { name: "开课准备" })).toHaveAttribute(
    "href",
    "#teacher-readiness"
  );
  await expect(page.getByRole("link", { name: "团队与角色" })).toHaveAttribute(
    "href",
    "#teacher-teams-roles"
  );
  await expect(page.getByRole("link", { name: "轮次控制" })).toHaveAttribute(
    "href",
    "#teacher-round-control"
  );
  await expect(page.getByRole("link", { name: "结果发布" })).toHaveAttribute(
    "href",
    "#teacher-results"
  );
  await expect(page.getByRole("link", { name: "复盘工作室" })).toHaveAttribute(
    "href",
    "#teacher-debrief"
  );
  await expect(page.getByRole("link", { name: "学习证据确认" })).toHaveAttribute(
    "href",
    "#teacher-evidence"
  );
  await expect(page.getByRole("link", { name: "报告生成" })).toHaveAttribute(
    "href",
    "#teacher-reports"
  );
  await expect(page.getByRole("link", { name: "验证会话" })).toHaveAttribute(
    "href",
    "#teacher-validation"
  );
  await expect(page.getByRole("link", { name: "收尾与清理" })).toHaveAttribute(
    "href",
    "#teacher-close-cleanup"
  );

  await expect(page.locator("#teacher-today > .teacher-location-heading > h2")).toHaveText(
    "今日工作"
  );
  await expect(page.locator("#teacher-blockers > .teacher-location-heading > h2")).toHaveText(
    "即将阻断"
  );
  await expect(page.locator("#teacher-courses > .teacher-location-heading > h2")).toHaveText(
    "课程与班级"
  );
  await expect(page.locator("#teacher-readiness > .teacher-location-heading > h2")).toHaveText(
    "开课准备"
  );
  await expect(page.locator("#teacher-teams-roles > .teacher-location-heading > h2")).toHaveText(
    "团队与角色"
  );
  await expect(page.locator("#teacher-round-control > .teacher-location-heading > h2")).toHaveText(
    "轮次控制"
  );
  await expect(page.locator("#teacher-results > .teacher-location-heading > h2")).toHaveText(
    "结果发布"
  );
  await expect(page.locator("#teacher-debrief > .teacher-location-heading > h2")).toHaveText(
    "复盘工作室"
  );
  await expect(page.locator("#teacher-evidence > .teacher-location-heading > h2")).toHaveText(
    "学习证据确认"
  );
  await expect(page.locator("#teacher-reports > .teacher-location-heading > h2")).toHaveText(
    "报告生成"
  );
  await expect(page.locator("#teacher-validation > .teacher-location-heading > h2")).toHaveText(
    "验证会话"
  );
  await expect(page.locator("#teacher-close-cleanup > .teacher-location-heading > h2")).toHaveText(
    "收尾与清理"
  );
  await expect(page.locator("#teacher-blockers .sw-state-panel")).toContainText("服务端未授权");
  await expect(page.locator("#teacher-courses h2").first()).toHaveText("课程与班级");
  await expect(page.locator("#teacher-readiness h2").first()).toHaveText("开课准备");
  await expect(page.locator("#teacher-results h2").first()).toHaveText("结果发布");

  const loginControlHeights = await page
    .locator('[aria-label="teacher login"] input, [aria-label="teacher login"] button')
    .evaluateAll((elements) =>
      elements.map((element) => Number.parseFloat(getComputedStyle(element).minHeight))
    );
  expect(loginControlHeights).toHaveLength(4);
  expect(loginControlHeights.every((height) => height >= 44)).toBe(true);

  const structuralCopy = await page.locator("body").evaluate((body) => {
    const clone = body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".technical-compatibility").forEach((element) => element.remove());
    return clone.innerText;
  });
  await expect(page.locator('[aria-label="技术兼容标签"]').first()).toBeVisible();
  for (const forbiddenEnglishHeading of [
    "Teacher Console",
    "Historical Run · read-only",
    "Internal Use Boundary",
    "Learning Goals & Rubrics",
    "Available CoursePackageVersions",
    "Scenario Readiness",
    "Scenario Candidates",
    "Known limits",
    "Non-overwrite",
    "state_true",
    "PRIVATE_TRUTH_SENTINEL"
  ]) {
    expect(structuralCopy).not.toContain(forbiddenEnglishHeading);
  }
  await expect(page.locator("#teacher-results")).not.toContainText("state_true");
  await expect(page.locator("#teacher-results")).not.toContainText("PRIVATE_TRUTH_SENTINEL");

  const primary = page.getByRole("button", { name: "开启回合" });
  await expect(primary).toBeDisabled();
  await expect(page.getByText("服务端未授权此操作", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "开启回合" })).toHaveCount(1);
  await expect(page.locator("section.teacher-location-target")).toHaveCount(12);
  expect(await page.locator("main > section.teacher-location-target").count()).toBe(12);
  expect(
    await page.locator("section.teacher-location-target section.teacher-location-target").count()
  ).toBe(0);
  await expect(page.getByText("相关工作台将在服务端上下文就绪后显示。")).toHaveCount(0);
  await expect(page.getByText("服务端未授权此操作：round:start")).toBeVisible();
  await expect(page.locator('main > .sw-state-panel[data-state="ready"]')).toHaveCount(1);
  for (const [selector, locationId] of [
    [".topbar", "teacher-today"],
    ['[aria-label="known limits product disclosure"]', "teacher-blockers"],
    ['[aria-label="Teacher CoursePackageVersion catalog"]', "teacher-courses"],
    ['[aria-label="formal CourseBlueprint catalog"]', "teacher-courses"],
    ['[aria-label="formal ScenarioPackage catalog"]', "teacher-courses"],
    ['[aria-label="R3 Golden Teaching Journey"]', "teacher-readiness"],
    ['[aria-label="Fresh learner E4 admission readiness"]', "teacher-teams-roles"],
    ['[aria-label="BFF 回合控制"]', "teacher-round-control"],
    ['[aria-label="BFF Replay 摘要"]', "teacher-results"],
    ['[aria-label="Instructor intelligence"]', "teacher-debrief"],
    ['[aria-label="Teacher D2 Evidence Workbench"]', "teacher-evidence"],
    ['[aria-label="D5 teacher evidence export workbench"]', "teacher-reports"],
    ['[aria-label="W023 Validation Session Control Plane"]', "teacher-validation"],
    ['[aria-label="W019 Teaching Closure Workspace"]', "teacher-close-cleanup"]
  ] as const) {
    await expectClosestLocation(page, selector, locationId);
  }

  await primary.evaluate((button) => {
    button.removeAttribute("disabled");
    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
    );
  });
  await expect(page.getByText("服务端未授权此操作：round:start", { exact: true })).toBeVisible();
  await expect.poll(api.getStartRequests).toBe(0);

  api.allowStart();
  await page.reload();
  await signIn(page, "teacher");
  await expect(page.getByRole("button", { name: "开启回合" })).toBeEnabled();
  const primaryStyle = await page
    .getByRole("button", { name: "开启回合" })
    .evaluate((element) => getComputedStyle(element).minHeight);
  expect(Number.parseFloat(primaryStyle)).toBeGreaterThanOrEqual(44);
  const navigationLink = page.getByRole("link", { name: "今日工作" });
  await navigationLink.focus();
  await expect(navigationLink).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotionDuration = await navigationLink.evaluate(
    (element) => getComputedStyle(element).transitionDuration
  );
  expect(reducedMotionDuration).toContain("0.001s");
  for (const viewport of [
    { height: 900, width: 1440 },
    { height: 800, width: 1280 },
    { height: 768, width: 1024 },
    { height: 844, width: 390 }
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
  }
  await page.getByRole("button", { name: "开启回合" }).click();
  await expect.poll(api.getStartRequests).toBe(1);
});

test("Teacher keeps the command disabled when the BFF workspace is unavailable", async ({
  page
}) => {
  const api = await mockTeacherApi(page, ["teacher"], { workspaceUnavailable: true });
  await page.goto(teacherBaseUrl);
  await signIn(page, "teacher");

  const primary = page.getByRole("button", { name: "开启回合" });
  await expect(primary).toBeDisabled();
  const unavailableReason = page.getByText("服务端回合权限加载失败，正式操作已关闭", {
    exact: true
  });
  await expect(unavailableReason).toHaveCount(3);
  await expect(unavailableReason.first()).toBeVisible();
  await expect(page.locator('[data-authority="unknown"]')).toBeVisible();
  await expect(page.locator('main > .sw-state-panel[data-state="error"]')).toHaveCount(1);
  await expect.poll(api.getStartRequests).toBe(0);
});

test("Teacher ignores a stale workspace response after switching runs", async ({ page }) => {
  const api = await mockTeacherApi(page, ["teacher"], {
    stateData: raceState,
    workspaceAllowedActionsByRun: {
      run_old: ["round:start"],
      run_new: []
    },
    workspaceDeferredRuns: ["run_old"]
  });
  await page.goto(teacherBaseUrl);
  await signIn(page, "teacher");
  const runSelector = page.getByLabel("run selector");
  await expect(runSelector).toHaveValue("run_old");
  await expect.poll(() => api.hasWorkspaceRequest("run_old")).toBe(true);

  await runSelector.selectOption("run_new");
  await expect(runSelector).toHaveValue("run_new");
  await expect(page.getByRole("button", { name: "开启回合" })).toBeDisabled();

  api.releaseWorkspace("run_old");
  await expect(runSelector).toHaveValue("run_new");
  await expect(page.getByRole("button", { name: "开启回合" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "开启回合" })).toHaveCount(1);
  await expect(page.getByLabel("run selector")).toHaveValue("run_new");
  await page.getByRole("button", { name: "开启回合" }).evaluate((button) => {
    button.removeAttribute("disabled");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await expect.poll(api.getStartRequests).toBe(0);
});

test("Teacher exposes Chinese clone/readiness copy and native 44px form targets", async ({
  page
}) => {
  const api = await mockTeacherApi(page, ["teacher"], {
    coursePackages: [
      {
        course_blueprint_reference: {
          content_digest: "b".repeat(64),
          course_blueprint_id: "blueprint_demo",
          tenant_id: "tenant_demo",
          version: "1.0.0"
        },
        course_package_reference: {
          content_digest: "a".repeat(64),
          course_package_id: "course_package_demo",
          tenant_id: "tenant_demo",
          version: "1.0.0"
        },
        description: "教学包说明",
        parameter_set_reference: {
          content_digest: "c".repeat(64),
          parameter_set_id: "parameter_demo",
          version: "1.0.0"
        },
        scenario_package_reference: {
          content_digest: "d".repeat(64),
          scenario_package_id: "scenario_demo",
          tenant_id: "tenant_demo",
          version: "1.0.0"
        },
        title: "示例课程包"
      }
    ],
    resultRows: [teacherResult],
    scenarioReadinessResponse: blockedReadiness,
    courseBlueprintCatalogResponse: { candidates: [copyCourseBlueprint] },
    formalScenarioCatalogResponse: {
      candidates: [copyFormalScenario],
      explicit_non_proofs: []
    },
    formalBindingPreviewResponse: copyFormalBindingPreview
  });
  await page.goto(teacherBaseUrl);
  await signIn(page, "teacher");

  const primary = page.getByRole("button", { name: "开启回合" });
  const secondary = page.getByRole("button", { name: "Refresh CoursePackageVersions" });
  const runSelector = page.getByLabel("run selector");
  const nativeHeights = await page
    .locator(".primary, .secondary, .run-selector select")
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(nativeHeights.length).toBeGreaterThan(2);
  expect(nativeHeights.every((height) => height >= 44)).toBe(true);
  await expect(primary).toBeVisible();
  await expect(secondary).toBeVisible();
  await expect(runSelector).toBeVisible();

  const packagePanel = page.getByLabel("Teacher CoursePackageVersion catalog");
  await expect(packagePanel.getByText("示例课程包")).toBeVisible();
  await packagePanel.getByRole("button", { name: /Clone course_package_demo/ }).click();
  const cloneForm = packagePanel.getByLabel("Teacher CoursePackageVersion clone");
  await expect(cloneForm).toContainText("创建课程包新版本");
  const cloneHeights = await cloneForm
    .locator("input, button")
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(cloneHeights.every((height) => height >= 44)).toBe(true);

  await page.getByLabel("scenario package id").fill("scenario_demo");
  await page.getByLabel("parameter set id").fill("parameter_demo");
  await page.getByRole("button", { name: "Check readiness" }).click();
  const readinessResult = page.locator(".readiness-result");
  await expect(readinessResult.getByText("不可开课", { exact: true })).toBeVisible();
  await expect(readinessResult.getByText("待质量复核", { exact: true })).toBeVisible();
  await expect(page.getByText("服务端状态已记录", { exact: true })).toHaveCount(0);

  const blueprintPanel = page.getByLabel("formal CourseBlueprint catalog");
  await expect(blueprintPanel).toContainText("60 分钟");
  await expect(blueprintPanel).not.toContainText("minutes");
  const formalPanel = page.getByLabel("formal ScenarioPackage catalog");
  await formalPanel.getByRole("button", { name: "Prepare formal Course" }).click();
  await expect(formalPanel).toContainText("场景摘要：");
  await expect(formalPanel).toContainText("参数集摘要：");
  await expect(formalPanel).toContainText("引擎：");
  await expect(formalPanel).toContainText("已选择正式课程：");
  const formalPrimaryCopy = await formalPanel.evaluate((panel) => {
    const clone = panel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".technical-compatibility").forEach((element) => element.remove());
    return clone.innerText;
  });
  expect(formalPrimaryCopy).not.toContain("Scenario digest");
  expect(formalPrimaryCopy).not.toContain("ParameterSet digest");
  expect(formalPrimaryCopy).not.toContain("Engine ");
  expect(formalPrimaryCopy).not.toContain("Selected formal Course");

  const results = page.locator("#teacher-results");
  await expect(results).toContainText("88");
  await expect(results).toContainText("下一轮聚焦现金缓冲");
  await expect(results).not.toContainText("state_true");
  await expect(results).not.toContainText("PRIVATE_TRUTH_SENTINEL");
  await expect.poll(api.getStartRequests).toBe(0);
});

test("non-Teacher sessions receive a truthful permission-denied surface", async ({ page }) => {
  await mockTeacherApi(page, ["student"]);
  await page.goto(teacherBaseUrl);
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("student");
  await page.getByLabel("password").fill("student");
  await page.getByRole("button", { name: "教师登录" }).click();

  await expect(page.getByRole("heading", { name: "当前会话没有教师工作区权限" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "角色导航" })).toHaveCount(0);
  await expect(page.getByText("今日工作", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "开启回合" })).toHaveCount(0);
});

test("Teacher ignores a stale login response after tenant and user switch", async ({ page }) => {
  const api = await mockTeacherApi(page, ["teacher"], {
    loginDeferredUsers: ["teacher-old"]
  });
  await page.goto(teacherBaseUrl);

  await page.getByLabel("tenant").fill("tenant_old");
  await page.getByLabel("username").fill("teacher-old");
  await page.getByLabel("password").fill("teacher-old");
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect.poll(() => api.hasLoginRequest("teacher-old")).toBe(true);

  await page.getByLabel("tenant").fill("tenant_new");
  await page.getByLabel("username").fill("teacher-new");
  await page.getByLabel("password").fill("teacher-new");
  await expect(page.getByRole("button", { name: "教师登录" })).toBeEnabled();
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(page.getByLabel("教师操作通知")).toContainText("已登录");
  await expect(page.getByLabel("当前上下文")).toContainText("tenant_new");
  await expect(page.getByLabel("当前上下文")).toContainText("teacher-new-001");

  api.releaseLogin("teacher-old");
  await expect.poll(() => api.hasCompletedLoginResponse("teacher-old")).toBe(true);
  await expect(page.getByLabel("当前上下文")).not.toContainText("tenant_old");
  await expect(page.getByLabel("当前上下文")).not.toContainText("teacher-old-001");
  await expect(page.getByLabel("教师操作通知")).toContainText("已登录");
  expect(
    api
      .getWorkspaceAuthRequests()
      .every(({ tenantId, token }) => tenantId === "tenant_new" && token === "teacher-new-ui-token")
  ).toBe(true);
});

test("Teacher ignores a stale rejected demo-state response after context switch", async ({
  page
}) => {
  const api = await mockTeacherApi(page, ["teacher"], {
    demoDeferredTokens: ["teacher-old-ui-token"],
    demoRejectedTokens: ["teacher-old-ui-token"]
  });
  await page.goto(teacherBaseUrl);

  await page.getByLabel("tenant").fill("tenant_old");
  await page.getByLabel("username").fill("teacher-old");
  await page.getByLabel("password").fill("teacher-old");
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect.poll(() => api.getDemoRequests()).toContain("teacher-old-ui-token");

  await page.getByLabel("tenant").fill("tenant_new");
  await page.getByLabel("username").fill("teacher-new");
  await page.getByLabel("password").fill("teacher-new");
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(page.getByLabel("当前上下文")).toContainText("tenant_new");
  await expect(page.locator('main > .sw-state-panel[data-state="ready"]')).toHaveCount(1);
  await expect(page.getByLabel("教师操作通知")).toContainText("已登录");

  api.releaseDemo("teacher-old-ui-token");
  await expect.poll(() => api.hasCompletedDemoResponse("teacher-old-ui-token")).toBe(true);
  await expect(page.getByLabel("当前上下文")).toContainText("tenant_new");
  await expect(page.locator('main > .sw-state-panel[data-state="ready"]')).toHaveCount(1);
  await expect(page.getByLabel("教师操作通知")).toContainText("已登录");
  expect(api.getStartRequests()).toBe(0);
  expect(
    api
      .getWorkspaceAuthRequests()
      .every(({ tenantId, token }) => tenantId === "tenant_new" && token === "teacher-new-ui-token")
  ).toBe(true);
});
