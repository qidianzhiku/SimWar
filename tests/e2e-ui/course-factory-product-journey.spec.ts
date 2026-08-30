import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const adminBaseUrl = "http://127.0.0.1:" + (process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103);
const teacherBaseUrl = "http://127.0.0.1:" + (process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101);

async function signInAdmin(page: Page): Promise<void> {
  const login = page.getByLabel("admin login");
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByLabel("username").fill("admin");
  await login.getByLabel("password").fill("admin");
  await login.getByRole("button", { name: "管理员登录" }).click();
  await expect(page.getByText("signed in", { exact: true }).first()).toBeVisible();
}

async function signInTeacher(page: Page): Promise<void> {
  const login = page.getByLabel("teacher login");
  await login.getByLabel("tenant").fill("tenant_demo");
  await login.getByLabel("username").fill("teacher");
  await login.getByLabel("password").fill("teacher");
  await login.getByRole("button", { name: "教师登录" }).click();
  await expect(
    page.getByRole("status", { name: "教师操作通知" }).getByText("signed in", { exact: true })
  ).toBeVisible();
}

function blockingAxeViolations(results: Awaited<ReturnType<AxeBuilder["analyze"]>>) {
  return results.violations.filter(
    (violation) =>
      violation.impact === "serious" ||
      violation.impact === "critical" ||
      (violation.impact === "moderate" &&
        violation.tags.some((tag) => tag.toLowerCase().startsWith("wcag")))
  );
}

test.afterEach(() => {
  cleanupPlaywrightStore();
});

test("Admin and Teacher consume the governed Course Factory through real BFF routes", async ({
  page
}) => {
  const courseFactoryResponses: number[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/v1/") && response.url().includes("course-factory")) {
      courseFactoryResponses.push(response.status());
    }
  });

  await page.goto(adminBaseUrl);
  await signInAdmin(page);
  const adminPanel = page.locator("#admin-enterprise-course-factory");
  await expect(adminPanel).toBeVisible();
  await expect(adminPanel.getByRole("heading", { name: "Governed Course Catalog" })).toBeVisible();
  await expect(
    adminPanel
      .getByRole("region", { name: "Sponsor-safe delivery" })
      .getByRole("heading", { name: "Sponsor-safe delivery" })
  ).toBeVisible();
  await expect(adminPanel.getByText("private data included: 否")).toBeVisible();
  await expect(adminPanel.getByText("当前会话没有可见的课程工厂版本。")).toBeVisible();
  await expect.poll(() => courseFactoryResponses.length).toBeGreaterThanOrEqual(2);
  expect(courseFactoryResponses.every((status) => status === 200)).toBe(true);

  const adminAxe = await new AxeBuilder({ page })
    .include("#admin-enterprise-course-factory")
    .analyze();
  expect(blockingAxeViolations(adminAxe)).toEqual([]);

  await page.goto(teacherBaseUrl);
  await signInTeacher(page);
  const teacherPanel = page.getByRole("heading", { name: "Governed Course Catalog" });
  await expect(teacherPanel).toBeVisible();
  await expect(page.getByText("Teacher-safe · published only")).toBeVisible();
  await expect(page.getByText("当前没有已发布的 governed course version。")).toBeVisible();
  await expect.poll(() => courseFactoryResponses.length).toBeGreaterThanOrEqual(3);
  expect(courseFactoryResponses.every((status) => status === 200)).toBe(true);
});
