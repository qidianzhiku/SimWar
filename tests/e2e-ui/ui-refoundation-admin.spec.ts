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

  await navigation.getByRole("link", { name: "权限与安全投影" }).click();
  await expect(page).toHaveURL(/#admin-security-projection$/);
  await expect(page.getByRole("heading", { name: "权限与安全投影" })).toBeVisible();

  const disabledActions = page.locator(".sw-allowed-action:disabled");
  if ((await disabledActions.count()) > 0) {
    await expect(disabledActions.first().locator("xpath=..")).toContainText("授权");
  }

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
  await page.setViewportSize({ width: 1024, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await testInfo.attach("admin-delivery-trust-desktop", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
});
