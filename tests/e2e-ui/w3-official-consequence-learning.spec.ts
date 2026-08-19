import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;

test.afterAll(() => cleanupPlaywrightStore());

async function signIn(page: Page, app: "student" | "teacher"): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(app === "student" ? "student" : "teacher");
  await page.getByLabel("password").fill(app === "student" ? "student" : "teacher");
  await page.getByRole("button", { name: app === "student" ? "学员登录" : "教师登录" }).click();
  if (app === "teacher") {
    await expect(
      page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
    ).toContainText("signed in");
  } else {
    await expect(page.getByText("signed in").first()).toBeVisible();
  }
}

test("real W3 BFF journey keeps publication, reflection and counterfactual boundaries", async ({
  page
}) => {
  await page.goto(studentBaseUrl);
  const studentConsequenceResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/bff/student/w3/consequence") &&
      response.request().method() === "GET"
  );
  await signIn(page, "student");
  const studentPanel = page.getByLabel("W3 官方结果与决策学习");
  await expect(studentPanel).toBeVisible();
  expect((await studentConsequenceResponse).status()).toBe(200);
  await expect(studentPanel.getByText("PUBLISHED", { exact: true })).toBeVisible();
  await expect(studentPanel.getByText("Decision Story", { exact: true })).toBeVisible();

  await studentPanel
    .getByLabel("我的反思（AI-off）")
    .fill("我观察到一次受控的价格变化与官方结果之间的模型关联。");
  const reflectionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/bff/student/w3/reflection") &&
      response.request().method() === "POST"
  );
  await studentPanel.getByRole("button", { name: "提交反思" }).click();
  expect((await reflectionResponse).status()).toBe(201);
  await expect(studentPanel.getByText("反思已记录，等待教师确认学习证据")).toBeVisible();

  const teacherPage = await page.context().newPage();
  try {
    const teacherConsequenceResponse = teacherPage.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/bff/teacher/w3/consequence") &&
        response.request().method() === "GET"
    );
    await teacherPage.goto(teacherBaseUrl);
    await signIn(teacherPage, "teacher");
    const teacherPanel = teacherPage.getByLabel("W3 官方后果与决策学习工作台");
    await expect(teacherPanel).toBeVisible();
    expect((await teacherConsequenceResponse).status()).toBe(200);
    await expect(teacherPanel.getByText("PUBLISHED", { exact: true })).toBeVisible();

    const counterfactualResponse = teacherPage.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/bff/teacher/w3/counterfactual") &&
        response.request().method() === "POST"
    );
    await teacherPanel.getByRole("button", { name: "运行隔离预览" }).click();
    expect((await counterfactualResponse).status()).toBe(200);
    await expect(teacherPanel.getByText(/已生成非官方比较/)).toBeVisible();
    await expect(teacherPanel.getByText(/不构成因果证明/)).toBeVisible();
  } finally {
    await teacherPage.close();
  }
});
