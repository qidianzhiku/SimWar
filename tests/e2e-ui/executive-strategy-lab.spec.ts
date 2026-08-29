import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ESL_ADMIN_PORT ?? 3113}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ESL_TEACHER_PORT ?? 3111}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ESL_STUDENT_PORT ?? 3112}`;

async function signIn(
  page: Page,
  username: "teacher" | "student" | "admin",
  buttonName: "教师登录" | "学员登录" | "管理员登录"
): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(username);
  await page.getByLabel("password").fill(username);
  await page.getByRole("button", { name: buttonName }).click();
}

async function expectNoBlockingA11yViolations(page: Page, selector: string): Promise<void> {
  const results = await new AxeBuilder({ page }).include(selector).analyze();
  const blocking = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? "")
  );
  expect(blocking, `${selector} has serious or critical accessibility violations`).toEqual([]);
}

test("ESL real-BFF journey preserves exact context and role-safe projections", async ({ page }) => {
  await page.goto(teacherBaseUrl);
  await signIn(page, "teacher", "教师登录");

  const teacherPanel = page.getByRole("region", { name: "Executive Strategy Lab" });
  await expect(teacherPanel).toBeVisible();
  await teacherPanel.getByRole("button", { name: "打开 Executive Strategy Lab" }).click();
  const teacherResult = teacherPanel.getByTestId("esl-teacher-result");
  await expect(teacherResult).toBeVisible();
  await expect(teacherResult.getByText("OFFICIAL", { exact: true })).toBeVisible();
  await expect(
    teacherResult.getByText("2 条 bounded NON_OFFICIAL 路径", { exact: true })
  ).toBeVisible();
  await expectNoBlockingA11yViolations(page, ".esl-workspace");
  const candidateId = (await teacherResult.locator("code").innerText()).trim();
  expect(candidateId).toMatch(/^esl_candidate_[a-f0-9]{16}$/);

  await page.goto(`${studentBaseUrl}/?eslCandidateId=${encodeURIComponent(candidateId)}`);
  await signIn(page, "student", "学员登录");
  const studentPanel = page.getByRole("region", {
    name: "Student Executive Strategy Lab projection"
  });
  await expect(studentPanel).toBeVisible();
  await expect(studentPanel.getByTestId("esl-student-result")).toBeVisible();
  await expect(studentPanel.getByText("角色：CEO", { exact: true })).toBeVisible();
  await expect(studentPanel.getByText("role-safe · Provider OFF", { exact: true })).toBeVisible();
  await expectNoBlockingA11yViolations(page, ".esl-workspace");

  await page.goto(adminBaseUrl);
  await signIn(page, "admin", "管理员登录");
  const adminPanel = page.getByRole("region", { name: "Executive Strategy Lab audit" });
  await expect(adminPanel).toBeVisible();
  await adminPanel.getByLabel("ESL audit candidate ID").fill(candidateId);
  await adminPanel.getByRole("button", { name: "查询策略实验室审计" }).click();
  await expect(adminPanel.getByTestId("esl-admin-result")).toBeVisible();
  await expect(adminPanel.getByText("true", { exact: true })).toBeVisible();
  await expectNoBlockingA11yViolations(page, ".esl-workspace");
});
