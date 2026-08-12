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

function teacherSession(roles: string[]) {
  return {
    access_token: roles.includes("teacher") ? "teacher-ui-token" : "student-ui-token",
    expires_at: "2099-01-01T00:00:00.000Z",
    user: {
      display_name: roles.includes("teacher") ? "教师" : "学员",
      roles,
      tenant_id: "tenant_demo",
      user_id: roles.includes("teacher") ? "teacher-001" : "student-001"
    }
  };
}

function teacherWorkspace(allowedActions: string[]) {
  const evidence = "RUNTIME_ENTRYPOINT_EVIDENCE";
  const shared = {
    actor_role: "teacher",
    allowed_actions: allowedActions,
    audit_reference: [],
    course_id: "course_demo",
    explicit_non_proof: [],
    evidence_label: evidence,
    redacted_fields: [],
    run_id: "run_teacher_test",
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
      round_id: "round_teacher_test",
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
      authorized_result_snapshot: [],
      formal_truth_write_allowed: false,
      round_id: "round_teacher_test",
      round_no: 1,
      visible_state: { result_count: 0, runtime_boundary: "current_json_active_runtime" }
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
  options: { workspaceUnavailable?: boolean } = {}
) {
  let allowedActions: string[] = [];
  let startRequests = 0;

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/v1/auth/login" && request.method() === "POST") {
      await route.fulfill({
        json: { code: "OK", data: teacherSession(roles), message: "success" }
      });
      return;
    }
    if (path === "/api/v1/demo-state") {
      await route.fulfill({ json: { code: "OK", data: state, message: "success" } });
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
      await route.fulfill({
        json: { code: "OK", data: teacherWorkspace(allowedActions), message: "success" }
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
        json: { code: "OK", data: { course_package_versions: [] }, message: "success" }
      });
      return;
    }
    if (path.includes("scenario-package-candidates")) {
      await route.fulfill({ json: { candidates: [] } });
      return;
    }
    if (path.includes("formal-scenario-package-catalog")) {
      await route.fulfill({ json: { candidates: [], explicit_non_proofs: [] } });
      return;
    }
    if (path.endsWith("/course-blueprints")) {
      await route.fulfill({ json: { data: { candidates: [] } } });
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
    getStartRequests: () => startRequests
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
    "state_true"
  ]) {
    expect(structuralCopy).not.toContain(forbiddenEnglishHeading);
  }
  await expect(page.locator("#teacher-results")).not.toContainText("state_true");
  await expect(page.locator("#teacher-results")).not.toContainText("利润");

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
