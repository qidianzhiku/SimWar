import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 }
];

async function signIn(page: Page, username: string, label: "教师登录" | "学员登录" | "管理员登录") {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(username);
  await page.getByLabel("password").fill(username);
  await page.getByRole("button", { name: label }).click();
  await expect(page.getByText("not signed in", { exact: true })).toHaveCount(0);
}

async function auditSurface(
  page: Page,
  url: string,
  username: string,
  loginLabel: "教师登录" | "学员登录" | "管理员登录",
  regionName: string
) {
  await page.goto(url);
  await signIn(page, username, loginLabel);
  const region = page.getByRole("region", { name: regionName });
  await expect(region).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await region.scrollIntoViewIfNeeded();
    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth
    }));
    expect(layout.documentWidth, `${regionName} overflow at ${viewport.width}`).toBeLessThanOrEqual(
      layout.viewportWidth + 1
    );
    const axeResults = await new AxeBuilder({ page })
      .include(`section[aria-label="${regionName}"]`)
      .analyze();
    const blocking = axeResults.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? "")
    );
    expect(blocking, `${regionName} accessibility violations at ${viewport.width}`).toEqual([]);
  }
}

test("Project-aware surfaces remain responsive and accessible across customer roles", async ({
  page
}) => {
  test.skip(
    process.env.SIMWAR_PLAYWRIGHT_M2_PROJECT_AWARE !== "true",
    "Dedicated Project-aware fixture is enabled only for the explicit visual run"
  );

  await auditSurface(page, teacherBaseUrl, "teacher", "教师登录", "项目开课准备");
  await auditSurface(page, studentBaseUrl, "student", "学员登录", "学生项目上下文");
  await auditSurface(page, adminBaseUrl, "admin", "管理员登录", "项目开课审计");
});
