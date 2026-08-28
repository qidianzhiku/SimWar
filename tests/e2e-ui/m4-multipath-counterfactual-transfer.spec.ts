import { expect, test } from "@playwright/test";
import { M4_BROWSER_RUN_ID } from "./m4-multipath-counterfactual-transfer-fixture";

const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;

test.skip(
  process.env.SIMWAR_PLAYWRIGHT_M4 !== "true",
  "M4 requires the isolated real fixture and is enabled explicitly for H2/L5."
);

test("M4 real BFF presents bounded teacher detail and student-safe transfer", async ({ page }) => {
  await page.goto(studentBaseUrl);
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("student");
  await page.getByLabel("password").fill("student");
  await page.getByRole("button", { name: "学员登录" }).click();

  const studentPanel = page.getByLabel("M4 多路径学员迁移");
  await expect(studentPanel).toBeVisible();
  await studentPanel.getByTestId("m4-student-load").click();
  await expect(studentPanel.getByTestId("m4-student-summary")).toBeVisible();
  await expect(studentPanel.getByText("保持不变", { exact: true })).toBeVisible();
  await expect(studentPanel.getByText("2 条 NON_OFFICIAL", { exact: true })).toBeVisible();
  await expect(studentPanel.getByText("已隐藏原始 rounds", { exact: false }).first()).toBeVisible();
  await expect(studentPanel.getByText(M4_BROWSER_RUN_ID, { exact: false })).toHaveCount(0);

  await page.goto(teacherBaseUrl);
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();

  const teacherPanel = page.getByLabel("M4 多路径教师复盘");
  await expect(teacherPanel).toBeVisible();
  await teacherPanel.getByTestId("m4-teacher-load").click();
  await expect(teacherPanel.getByTestId("m4-teacher-summary")).toBeVisible();
  await expect(teacherPanel.getByText("保持不变", { exact: true })).toBeVisible();
  await expect(teacherPanel.getByText("2 条 NON_OFFICIAL", { exact: true })).toBeVisible();
  await expect(teacherPanel.getByText("1 round(s)", { exact: false }).first()).toBeVisible();
});
