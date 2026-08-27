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
  await expect(studio.getByText(/Explicit model:/)).toBeVisible();
  await studio.getByRole("button", { name: "创建 DRAFT" }).click();
  await expect(studio.getByText(/候选状态：DRAFT/)).toBeVisible();
  await studio.getByRole("button", { name: "验证兼容性" }).click();
  await expect(studio.getByText(/exact refs PASS/)).toBeVisible();
  await studio.getByRole("button", { name: "冻结候选" }).click();
  await expect(studio.getByText(/候选状态：FROZEN/)).toBeVisible();
  await studio.getByRole("button", { name: "Teacher 预览" }).click();
  await expect(studio.getByText(/Teacher-only coupled preview/)).toBeVisible();
  await studio.getByRole("button", { name: "激活到 Course" }).click();
  await expect(
    studio.getByText(/已通过现有 Course\/formal binding writers 创建 Course/)
  ).toBeVisible();
  await expect(studio.getByText(/Run activation 仍交由现有 Run writer/)).toBeVisible();
});

test("Student has no Scenario Studio entry point", async ({ page }) => {
  test.skip(!requiresFixture, "run with SIMWAR_PLAYWRIGHT_TSS=true for the real fixture");
  await page.goto(studentBaseUrl);
  await signIn(page, "学员登录", "student");
  await expect(page.getByRole("region", { name: "Teacher Scenario Studio" })).toHaveCount(0);
});
