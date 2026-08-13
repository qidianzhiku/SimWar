import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;

test.afterAll(() => {
  cleanupPlaywrightStore();
});

async function signIn(
  page: Page,
  credentials: { tenant: string; username: string; password: string }
) {
  const login = page.locator('section[aria-label="admin login"]');
  await login.getByLabel("tenant").fill(credentials.tenant);
  await login.getByLabel("username").fill(credentials.username);
  await login.getByLabel("password").fill(credentials.password);
  await login.getByRole("button", { name: "管理员登录" }).click();
  await expect(page.getByText("signed in", { exact: true })).toBeVisible();
}

test("tenant Admin exposes truthful Enterprise Course Factory limits without new authority", async ({
  page
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(adminBaseUrl);
  await signIn(page, { tenant: "tenant_demo", username: "admin", password: "admin" });

  const navigation = page.getByRole("navigation", { name: "角色导航" });
  const enterpriseLink = navigation.getByRole("link", {
    name: "企业课程工厂与 Sponsor 投影"
  });
  await expect(enterpriseLink).toBeVisible();
  await expect(page.locator("#admin-enterprise-course-factory")).toHaveCount(1);
  await enterpriseLink.click();
  await expect(page).toHaveURL(/#admin-enterprise-course-factory$/);
  await expect(page.getByRole("heading", { name: "企业课程工厂与 Sponsor 投影" })).toBeVisible();
  await expect(
    page.getByText("当前没有独立 Enterprise app、BFF 或权威来源", { exact: false })
  ).toBeVisible();

  for (const title of [
    "Source Registry",
    "Canonical Mapping",
    "Scenario Draft",
    "Course Recipe",
    "Validation Suite",
    "Cross-functional Review",
    "Immutable Publication",
    "Sponsor View/Aggregation"
  ]) {
    const card = page.locator(".enterprise-course-factory-capability").filter({ hasText: title });
    await expect(card).toHaveCount(1);
    await expect(card.getByText("状态：关闭", { exact: true })).toBeVisible();
    await expect(card.getByText("当前限制", { exact: true })).toBeVisible();
    await expect(card.getByText("不受影响", { exact: true })).toBeVisible();
    await expect(card.getByText("尚未证明", { exact: true })).toBeVisible();
    await expect(card.getByText("范围", { exact: true })).toBeVisible();
  }

  for (const href of ["#admin-assets", "#admin-runtime-support", "#admin-audit-receipts"]) {
    const supportLink = page.locator(`.enterprise-course-factory-supported a[href="${href}"]`);
    await expect(supportLink).toHaveCount(1);
    await expect(page.locator(href)).toHaveCount(1);
  }

  await expect(
    page.getByText("CoursePackageVersion 仅表示不可变教学与配置快照。", { exact: true })
  ).toBeVisible();
  const enterpriseWorkspace = page.locator(".enterprise-course-factory-workspace");
  await expect(enterpriseWorkspace.getByRole("button")).toHaveCount(0);
  const visibleCopy = await enterpriseWorkspace.innerText();
  for (const forbiddenMarker of [
    "state_true",
    "replay_hash",
    "other_tenant_data",
    "other_team_data",
    "peer private draft",
    "score",
    "rank"
  ]) {
    expect(visibleCopy.toLowerCase()).not.toContain(forbiddenMarker.toLowerCase());
  }
  const businessRequests = requests.filter((url) => {
    const pathname = new URL(url).pathname;
    return pathname.startsWith("/api/") || pathname.startsWith("/internal/");
  });
  expect(
    businessRequests.some((url) =>
      /enterprise|sponsor|canonical-mapping|source-registry/i.test(new URL(url).pathname)
    )
  ).toBe(false);
  expect(businessRequests.some((url) => new URL(url).pathname.startsWith("/internal/v1"))).toBe(
    false
  );
});

test("platform Admin sees the same closed Enterprise projection without tenant-only navigation", async ({
  page
}) => {
  await page.goto(adminBaseUrl);
  await signIn(page, { tenant: "tenant_platform", username: "platform", password: "platform" });

  const navigation = page.getByRole("navigation", { name: "角色导航" });
  await expect(navigation.getByRole("link", { name: "企业课程工厂与 Sponsor 投影" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "用户、角色与范围" })).toHaveCount(0);
  await expect(page.locator("#admin-enterprise-course-factory")).toHaveCount(1);
  await expect(page.locator("#admin-enterprise-course-factory")).toContainText("平台范围");
});

test("unauthenticated and non-Admin sessions cannot discover the Enterprise workspace", async ({
  page
}) => {
  await page.goto(adminBaseUrl);
  await expect(
    page.getByRole("navigation", { name: "角色导航" }).getByRole("link", {
      name: "企业课程工厂与 Sponsor 投影"
    })
  ).toHaveCount(0);
  await expect(page.locator("#admin-enterprise-course-factory")).toHaveCount(0);

  await signIn(page, { tenant: "tenant_demo", username: "student", password: "student" });
  await expect(page.getByRole("heading", { name: "SimWar 管理交付与信任" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "角色导航" })).toHaveCount(0);
  await expect(page.locator("#admin-enterprise-course-factory")).toHaveCount(0);
});

test("Enterprise logical location remains responsive, keyboard-visible, and reduced-motion safe", async ({
  page
}) => {
  await page.goto(adminBaseUrl);
  await signIn(page, { tenant: "tenant_demo", username: "admin", password: "admin" });
  await page.getByRole("link", { name: "企业课程工厂与 Sponsor 投影" }).click();

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    const linkHeight = await page
      .locator('nav[aria-label="角色导航"] a[href="#admin-enterprise-course-factory"]')
      .evaluate((element) => element.getBoundingClientRect().height);
    expect(linkHeight).toBeGreaterThanOrEqual(44);
  }

  const enterpriseLink = page.locator(
    'nav[aria-label="角色导航"] a[href="#admin-enterprise-course-factory"]'
  );
  await page.keyboard.press("Tab");
  for (let index = 0; index < 50; index += 1) {
    if (await enterpriseLink.evaluate((element) => document.activeElement === element)) {
      break;
    }
    await page.keyboard.press("Tab");
  }
  await expect(enterpriseLink).toBeFocused();
  const focusStyle = await enterpriseLink.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(focusStyle.outlineWidth).not.toBe("0px");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotionStyle = await page.locator(".sw-skip-link").evaluate((element) => {
    const style = getComputedStyle(element);
    return style.transitionDuration;
  });
  expect(reducedMotionStyle).toBe("0.001s");
});
