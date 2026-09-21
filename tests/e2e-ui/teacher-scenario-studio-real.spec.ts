import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const requiresFixture = process.env.SIMWAR_PLAYWRIGHT_TSS === "true";

test.afterEach(() => {
  cleanupPlaywrightStore();
});

async function signIn(page: Page, buttonName: "教师登录" | "学员登录", username: string) {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(username);
  await page.getByLabel("password").fill(username);
  await page.getByRole("button", { name: buttonName }).click();
  if (buttonName === "教师登录") {
    await expect(
      page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
    ).toContainText("signed in");
  } else {
    await expect(page.getByText("signed in").first()).toBeVisible();
  }
}

test("Teacher completes the real-BFF Scenario Studio product journey", async ({ page }) => {
  test.skip(!requiresFixture, "run with SIMWAR_PLAYWRIGHT_TSS=true for the real fixture");
  await page.goto(teacherBaseUrl);
  await signIn(page, "教师登录", "teacher");
  const studio = page.getByRole("region", { name: "Teacher Scenario Studio" });
  await expect(studio).toBeVisible();
  const modelSelect = studio.getByLabel("Teacher Scenario Studio ModelVersion");
  await expect(modelSelect).toBeVisible();

  await modelSelect.selectOption("toy_logit_wellness_v1@0.1.0");
  await studio.getByLabel("Teacher Scenario Studio version").fill("1.0.1");
  const primary = studio.getByTestId("tss-primary-action");
  await expect(primary).toHaveText("创建 DRAFT");
  await primary.click();
  await expect(studio.getByText(/候选状态：DRAFT/)).toBeVisible();
  await expect(primary).toHaveText("下一步：验证兼容性");
  await primary.click();
  await expect(studio.getByText(/exact refs PASS/)).toBeVisible();
  await expect(primary).toHaveText("下一步：冻结候选");
  await primary.click();
  await expect(studio.getByText(/候选状态：FROZEN/)).toBeVisible();
  await expect(primary).toHaveText("下一步：Teacher 预览");
  await primary.click();
  await expect(studio.getByText(/Teacher-only coupled preview/)).toBeVisible();
  await expect(primary).toHaveText("下一步：激活到 Course");
  await primary.click();
  await expect(studio.getByTestId("tss-course-receipt")).toBeVisible();
  await expect(studio.getByText(/Course ID：/)).toBeVisible();
  await expect(
    studio.getByText(/Activation writer：EXISTING_COURSE_AND_FORMAL_AUTHORITY_BINDING_WRITERS/)
  ).toBeVisible();
  await expect(studio.getByText(/Run activation：DEFERRED_TO_EXISTING_RUN_WRITER/)).toBeVisible();
  await expect(
    studio.getByText(/Run 创建与激活继续交由现有 server-owned Run writer/)
  ).toBeVisible();
  await expect(primary).toHaveText("Course 已交接，Run 未激活");
});
test("Student has no Scenario Studio entry point", async ({ page }) => {
  test.skip(!requiresFixture, "run with SIMWAR_PLAYWRIGHT_TSS=true for the real fixture");
  await page.goto(studentBaseUrl);
  await signIn(page, "学员登录", "student");
  await expect(page.getByRole("region", { name: "Teacher Scenario Studio" })).toHaveCount(0);
});
