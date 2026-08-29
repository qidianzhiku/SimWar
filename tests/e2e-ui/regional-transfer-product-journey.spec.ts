import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;

test.afterAll(() => cleanupPlaywrightStore());

async function login(
  page: Page,
  baseUrl: string,
  username: "teacher" | "student" | "admin",
  label: string
) {
  await page.goto(baseUrl);
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(username);
  await page.getByLabel("password").fill(username);
  await page.getByRole("button", { name: label }).click();
}

test("RT-O1 completes a real-BFF Teacher to Student to Admin journey", async ({ page }) => {
  await login(page, teacherBaseUrl, "teacher", "教师登录");
  const teacherPanel = page.getByRole("region", {
    name: "Teacher governed regional transfer workbench"
  });
  await expect(teacherPanel).toBeVisible();
  await teacherPanel.getByRole("button", { name: "读取精确来源" }).click();
  await expect(teacherPanel.getByText("Shanghai → Suzhou", { exact: true })).toBeVisible();
  await expect(teacherPanel.getByText("状态：READY", { exact: true })).toBeVisible();

  await teacherPanel.getByRole("button", { name: "预览候选" }).click();
  await expect(teacherPanel.getByText("PREVIEWED", { exact: true })).toBeVisible();
  await teacherPanel.getByRole("button", { name: "校验候选" }).click();
  await expect(teacherPanel.getByText("VALIDATED", { exact: true })).toBeVisible();
  await teacherPanel.getByRole("button", { name: "冻结候选" }).click();
  await expect(teacherPanel.getByText("FROZEN", { exact: true })).toBeVisible();

  const candidateText = await teacherPanel
    .locator("span")
    .filter({ hasText: /rt_candidate_[a-f0-9]{16}/u })
    .first()
    .textContent();
  const candidateId = candidateText?.match(/rt_candidate_[a-f0-9]{16}/u)?.[0];
  expect(candidateId).toBeTruthy();
  await teacherPanel.getByRole("button", { name: "发布给 Student" }).click();
  await expect(teacherPanel.getByText("ACTIVATED", { exact: true })).toBeVisible();
  await expect(teacherPanel.getByText(/shared governed scenario · 2 teams/u)).toBeVisible();

  await login(
    page,
    `${studentBaseUrl}?regionalTransferCandidateId=${encodeURIComponent(candidateId!)}`,
    "student",
    "学员登录"
  );
  const studentPanel = page.getByRole("region", { name: "Student regional transfer projection" });
  await expect(studentPanel).toBeVisible();
  await expect(studentPanel.getByText("状态：ACTIVATED", { exact: true })).toBeVisible();
  await expect(studentPanel.getByText("目标区域：Suzhou", { exact: true })).toBeVisible();
  await expect(studentPanel.getByText("published · role-safe", { exact: true })).toBeVisible();

  await login(page, adminBaseUrl, "admin", "管理员登录");
  const adminPanel = page.getByRole("region", { name: "Admin regional transfer audit" });
  await expect(adminPanel).toBeVisible();
  await adminPanel.getByLabel("Candidate ID").fill(candidateId!);
  await adminPanel.getByRole("button", { name: "读取审计投影" }).click();
  await expect(adminPanel.getByText("ACTIVATED", { exact: true })).toBeVisible();
  await expect(adminPanel.getByText(/PREVIEWED → VALIDATED → FROZEN → ACTIVATED/u)).toBeVisible();
  await expect(adminPanel.getByText(/SAFE_DRY_RUN_CANDIDATE/u)).toBeVisible();
});
