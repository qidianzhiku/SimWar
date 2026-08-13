import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;

test.afterAll(() => {
  cleanupPlaywrightStore();
});

async function signInAdmin(page: Page): Promise<void> {
  const login = page.locator('section[aria-label="admin login"]');
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByLabel("username").fill("admin");
  await login.getByLabel("password").fill("admin");
  await login.getByRole("button", { name: "管理员登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

test("authenticated Admin exposes the task shell, server context, legacy landmarks, and closed W025 limit", async ({
  page
}, testInfo) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(adminBaseUrl);
  await signInAdmin(page);

  const labels = [
    "交付总览",
    "租户与权益",
    "用户、角色与范围",
    "课程、场景与模型资产",
    "权限与安全投影",
    "审计与回执",
    "运行与支持",
    "已知限制与信任边界",
    "环境启动与恢复"
  ];
  const navigation = page.getByRole("navigation", { name: "角色导航" });
  for (const label of labels) {
    await expect(navigation.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "SimWar 管理交付与信任" })).toBeVisible();
  await expect(
    page.getByLabel("当前上下文").getByText("tenant_demo", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("平台范围", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "环境启动与恢复" })).toBeVisible();
  await expect(page.getByText("W025 环境启动与恢复尚未获授权", { exact: false })).toBeVisible();
  expect(requests.some((url) => /W025|w025/.test(url))).toBe(false);
  expect(requests.some((url) => url.includes("/internal/v1"))).toBe(false);

  const requiredTargets = [
    "admin-delivery-overview",
    "admin-tenants-entitlements",
    "admin-users-roles",
    "admin-assets",
    "admin-security-projection",
    "admin-audit-receipts",
    "admin-runtime-support",
    "admin-known-limits",
    "admin-environment-recovery"
  ] as const;
  for (const target of requiredTargets) {
    await expect(page.locator(`#${target}`)).toHaveCount(1);
    await navigation.getByRole("link", { name: labels[requiredTargets.indexOf(target)] }).click();
    await expect(page).toHaveURL(new RegExp(`#${target}$`));
  }
  const renderedNavigationTargets = await navigation.locator("a").evaluateAll((links) =>
    links.map((link) => {
      const href = link.getAttribute("href") ?? "";
      const target = href.startsWith("#") ? document.querySelector(href) : null;
      return { href, targetExists: Boolean(target) };
    })
  );
  expect(renderedNavigationTargets.length).toBe(9);
  expect(renderedNavigationTargets.every(({ targetExists }) => targetExists)).toBe(true);

  await expect(
    page.locator("#admin-assets").getByLabel("CoursePackageVersion administration")
  ).toBeVisible();
  await expect(
    page.locator("#admin-runtime-support").getByLabel("synthetic run lifecycle controls")
  ).toBeVisible();
  await expect(page.locator("#admin-users-roles").locator(".table")).toHaveCount(2);

  const visibleCopy = await page.locator("body").innerText();
  for (const englishPhrase of [
    "Loading Admin summary...",
    "Synthetic JSON Internal Only",
    "Blocked:",
    "JSON Internal Only",
    "Immutable export ready",
    "admin-controlled JSON",
    "Course package export JSON",
    "Use export as import payload",
    "Create immutable DRAFT",
    "server validates all references",
    "Import immutable export",
    "server verifies digest",
    "tenant scoped"
  ]) {
    expect(visibleCopy).not.toContain(englishPhrase);
  }

  await navigation.getByRole("link", { name: "权限与安全投影" }).click();
  await expect(page).toHaveURL(/#admin-security-projection$/);
  await expect(page.getByRole("heading", { name: "权限与安全投影" })).toBeVisible();

  const lifecycleRun = page.locator("#admin-runtime-support .lifecycle-run");
  const lifecycleRunCount = await lifecycleRun.count();
  if (lifecycleRunCount === 0) {
    const lifecycleEmptyState = page.locator(
      '#admin-runtime-support .lifecycle-status:has-text("没有可显示")'
    );
    await expect(lifecycleEmptyState).toHaveCount(1);
  } else {
    await expect(lifecycleRun).toHaveCount(1);
    const disabledLifecycleAbort = lifecycleRun.locator(
      '.lifecycle-actions button.sw-allowed-action[data-action="abort"]:disabled'
    );
    await expect(disabledLifecycleAbort).toHaveCount(1);
    await expect(disabledLifecycleAbort.locator("xpath=..")).toContainText("授权");
  }

  const targetMetrics = await page.evaluate(() => {
    const link = document.querySelector<HTMLElement>('nav[aria-label="角色导航"] a');
    const input = document.querySelector<HTMLElement>('section[aria-label="admin login"] input');
    const action = document.querySelector<HTMLElement>("button");
    const userCreate = document.querySelector<HTMLElement>("#admin-users-roles button.primary");
    return {
      actionHeight: action?.getBoundingClientRect().height ?? 0,
      inputHeight: input?.getBoundingClientRect().height ?? 0,
      linkHeight: link?.getBoundingClientRect().height ?? 0,
      userCreateHeight: userCreate?.getBoundingClientRect().height ?? 0
    };
  });
  expect(targetMetrics.linkHeight).toBeGreaterThanOrEqual(44);
  expect(targetMetrics.inputHeight).toBeGreaterThanOrEqual(44);
  expect(targetMetrics.actionHeight).toBeGreaterThanOrEqual(44);
  expect(targetMetrics.userCreateHeight).toBeGreaterThanOrEqual(44);

  const sharedControlHeights = await page
    .locator(
      ".course-report-surface input, .course-report-surface select, .course-report-surface button, .d5-export-workbench input, .d5-export-workbench button"
    )
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(sharedControlHeights.length).toBeGreaterThan(0);
  expect(sharedControlHeights.every((height) => height >= 44)).toBe(true);
  const keyRightEdges = await page
    .locator(
      ".sw-app-shell__header, .sw-app-shell__body, #admin-assets .course-report-surface, #admin-audit-receipts .d5-export-workbench"
    )
    .evaluateAll((elements) =>
      elements.map((element) => ({
        right: element.getBoundingClientRect().right,
        width: element.getBoundingClientRect().width
      }))
    );
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(keyRightEdges.every(({ right }) => right <= viewportWidth + 1)).toBe(true);

  await page.keyboard.press("Tab");
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.tagName.toLowerCase()))
    .toMatch(/a|input|button/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("heading", { name: "权限与安全投影" })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await testInfo.attach("admin-delivery-trust-mobile", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
});

test("Admin delivery shell remains usable at desktop and tablet widths", async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(adminBaseUrl);
  await signInAdmin(page);
  await expect(page.getByRole("navigation", { name: "角色导航" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "交付总览" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.setViewportSize({ width: 1024, height: 768 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await testInfo.attach("admin-delivery-trust-desktop", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
});

test("Teacher and Student receive a truthful denial without an Admin shell or navigation landmark", async ({
  page
}) => {
  for (const actor of [
    { password: "teacher", username: "teacher" },
    { password: "student", username: "student" }
  ]) {
    await page.goto(adminBaseUrl);
    const login = page.locator('section[aria-label="admin login"]');
    await login.getByLabel("tenant").fill("tenant_demo");
    await login.getByLabel("username").fill(actor.username);
    await login.getByLabel("password").fill(actor.password);
    await login.getByRole("button", { name: "管理员登录" }).click();
    await expect(page.getByText("signed in")).toBeVisible();
    await expect(page.getByRole("heading", { name: "SimWar 管理交付与信任" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "角色导航" })).toHaveCount(0);
    await expect(page.locator("#admin-delivery-overview")).toHaveCount(0);
    await expect(page.getByRole("alert", { name: "管理权限" })).toContainText("当前角色无管理权限");
  }
});

test("Platform Admin navigation omits tenant-only locations and exposes only real targets", async ({
  page
}) => {
  await page.goto(adminBaseUrl);
  const login = page.locator('section[aria-label="admin login"]');
  await login.getByLabel("tenant").fill("tenant_platform");
  await login.getByLabel("username").fill("platform");
  await login.getByLabel("password").fill("platform");
  await login.getByRole("button", { name: "管理员登录" }).click();
  await expect(page.getByText("signed in", { exact: true })).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "角色导航" });
  await expect(navigation.getByRole("link", { name: "用户、角色与范围" })).toHaveCount(0);
  await expect(navigation.getByRole("link")).toHaveCount(8);
  const renderedTargets = await navigation.locator("a").evaluateAll((links) =>
    links.map((link) => {
      const href = link.getAttribute("href") ?? "";
      return { href, targetExists: href.startsWith("#") && Boolean(document.querySelector(href)) };
    })
  );
  expect(renderedTargets.every(({ targetExists }) => targetExists)).toBe(true);
  expect(renderedTargets.some(({ href }) => href === "#admin-users-roles")).toBe(false);
  await expect(page.locator("#admin-users-roles")).toHaveCount(0);
  await expect(page.locator('a[href="#admin-audit-events"]')).toHaveCount(0);
  await expect(page.getByText("当前角色无法查看租户审计事件。", { exact: true })).toBeVisible();
});

test("Unauthenticated Admin navigation is empty-state, unknown-authority, and target-complete", async ({
  page
}) => {
  await page.goto(adminBaseUrl);
  await expect(page.locator('main > .sw-state-panel[data-state="empty"]')).toHaveCount(1);
  await expect(page.locator('[data-authority="unknown"]')).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "角色导航" });
  await expect(navigation.getByRole("link")).toHaveCount(3);
  const renderedTargets = await navigation.locator("a").evaluateAll((links) =>
    links.map((link) => {
      const href = link.getAttribute("href") ?? "";
      return { href, targetExists: href.startsWith("#") && Boolean(document.querySelector(href)) };
    })
  );
  expect(renderedTargets.every(({ targetExists }) => targetExists)).toBe(true);
  await expect(page.locator('a[href="#admin-audit-events"]')).toHaveCount(0);
});

test("Admin demo login replaces dirty credentials with the authenticated demo identity", async ({
  page
}) => {
  test.skip(
    process.env.VITE_SIMWAR_DEMO_MODE !== "true",
    "demo shortcut E2E requires VITE_SIMWAR_DEMO_MODE=true"
  );
  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill({
      json: {
        code: "OK",
        data: {
          access_token: "demo-ui-token",
          expires_at: "2099-01-01T00:00:00.000Z",
          user: {
            display_name: "演示管理员",
            roles: ["tenant_admin"],
            tenant_id: "tenant_demo",
            user_id: "demo-001"
          }
        },
        message: "success"
      }
    });
  });
  await page.goto(adminBaseUrl);
  const login = page.locator('section[aria-label="admin login"]');
  await login.getByLabel("tenant").fill("tenant_dirty");
  await login.getByLabel("username").fill("old-user");
  await login.getByLabel("password").fill("old-password");
  await expect(login.getByRole("button", { name: "演示登录" })).toHaveCount(1);
  await login.getByRole("button", { name: "演示登录" }).click();
  await expect(login.getByLabel("tenant")).toHaveValue("tenant_demo");
  await expect(login.getByLabel("username")).toHaveValue("demo");
  await expect(login.getByLabel("password")).toHaveValue("demo");
  await expect(page.getByLabel("当前上下文")).toContainText("tenant_demo");
  await expect(page.getByLabel("当前上下文")).not.toContainText("tenant_dirty");
  await expect(login).toContainText("演示管理员");
});

test("Admin CoursePackage surface uses Chinese visible copy while retaining only evidenced compatibility contracts", async ({
  page
}) => {
  await page.route("**/api/v1/admin/course-package-versions", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: { course_package_versions: [] },
        message: "success",
        request_id: "req_ui_refoundation_course_package_copy"
      })
    });
  });

  await page.goto(adminBaseUrl);
  await signInAdmin(page);

  const panel = page.getByLabel("CoursePackageVersion administration");
  await expect(
    panel.getByText("当前仅展示服务端拥有的不可变教学与配置快照。", { exact: false })
  ).toBeVisible();
  await expect(panel.getByText("当前没有可用的课程包版本。", { exact: false })).toBeVisible();
  for (const label of [
    "课程包 ID",
    "版本",
    "标题",
    "描述",
    "源租户 ID",
    "课程蓝图 ID",
    "课程蓝图版本",
    "课程蓝图摘要",
    "场景包 ID",
    "场景包版本",
    "场景包摘要",
    "参数集 ID",
    "参数集版本",
    "参数集摘要"
  ]) {
    await expect(panel.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(panel.getByRole("button", { name: "创建 CoursePackageVersion 草稿" })).toBeVisible();
  await expect(panel.getByText("导入 CoursePackageVersion", { exact: true })).toBeVisible();

  const visibleCopy = await panel.innerText();
  for (const englishPhrase of [
    "Server-owned immutable teaching/configuration snapshots only.",
    "This surface never evaluates dependency compatibility",
    "computes digests",
    "or changes a Course, Run",
    "Course package ID",
    "Source tenant ID",
    "CourseBlueprint ID",
    "CourseBlueprint version",
    "CourseBlueprint digest",
    "ScenarioPackage ID",
    "ScenarioPackage version",
    "ScenarioPackage digest",
    "ParameterSet ID",
    "ParameterSet version",
    "ParameterSet digest"
  ]) {
    expect(visibleCopy).not.toContain(englishPhrase);
  }
});

test("Admin ignores a delayed A response after the tenant and login context switch to B", async ({
  page
}) => {
  let releaseOldLogin: (() => void) | undefined;
  const loginRequests = new Set<string>();
  const completedLogins = new Set<string>();

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/auth/login" && request.method() === "POST") {
      const body = request.postDataJSON() as { username?: string };
      const username = body.username ?? "admin";
      const tenantId = request.headers()["x-tenant-id"] ?? "tenant_demo";
      loginRequests.add(username);
      if (username === "admin-a") {
        await new Promise<void>((resolve) => {
          releaseOldLogin = resolve;
        });
      }
      await route.fulfill({
        json: {
          code: "OK",
          data: {
            access_token: `${username}-ui-token`,
            expires_at: "2099-01-01T00:00:00.000Z",
            user: {
              display_name: username,
              roles: ["tenant_admin"],
              tenant_id: tenantId,
              user_id: `${username}-001`
            }
          },
          message: "success"
        }
      });
      completedLogins.add(username);
      return;
    }
    await route.fulfill({
      status: 403,
      json: { code: "FORBIDDEN", data: null, message: "Admin scope denied" }
    });
  });

  await page.goto(adminBaseUrl);
  const login = page.locator('section[aria-label="admin login"]');
  await login.getByLabel("tenant").fill("tenant_a");
  await login.getByLabel("username").fill("admin-a");
  await login.getByLabel("password").fill("admin-a");
  await login.getByRole("button", { name: "管理员登录" }).click();
  await expect.poll(() => loginRequests.has("admin-a")).toBe(true);

  await login.getByLabel("tenant").fill("tenant_b");
  await login.getByLabel("username").fill("admin-b");
  await login.getByLabel("password").fill("admin-b");
  await login.getByRole("button", { name: "管理员登录" }).click();
  await expect(page.getByText("signed in", { exact: true })).toBeVisible();
  await expect(page.getByLabel("当前上下文")).toContainText("tenant_b");
  await expect(page.getByLabel("当前上下文")).toContainText("admin-b-001");
  await expect.poll(() => completedLogins.has("admin-b")).toBe(true);

  releaseOldLogin?.();
  await expect.poll(() => completedLogins.has("admin-a")).toBe(true);
  await expect(page.getByLabel("当前上下文")).toContainText("tenant_b");
  await expect(page.getByLabel("当前上下文")).toContainText("admin-b-001");
});
