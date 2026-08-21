import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const w3Query =
  "w3=true&activity_id=activity_consequence&course_id=course_demo&role_key=CEO&round_id=round_w3_browser_1&round_no=1&run_id=run_w3_browser&team_id=team_alpha&tenant_id=tenant_demo";
const invalidW3Query =
  "w3=true&activity_id=activity_consequence&course_id=course_demo&role_key=CEO&round_id=round_missing&round_no=1&run_id=run_w3_browser&team_id=team_alpha&tenant_id=tenant_demo";

test.afterAll(() => cleanupPlaywrightStore());

async function signIn(page: Page, app: "student" | "teacher"): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(app === "student" ? "student" : "teacher");
  await page.getByLabel("password").fill(app === "student" ? "student" : "teacher");
  await page.getByRole("button", { name: app === "student" ? "学员登录" : "教师登录" }).click();
  await expect(page.getByText("signed in").first()).toBeVisible();
}

test("real BFF renders the complete Student and Teacher P2B journeys without client writers", async ({
  page
}) => {
  await page.goto(`${studentBaseUrl}?${w3Query}`);
  const studentBff = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/bff/student/w3/consequence") &&
      response.request().method() === "GET"
  );
  await signIn(page, "student");

  const studentJourney = page.getByLabel("学员决策学习旅程");
  await expect(studentJourney).toBeVisible();
  expect((await studentBff).status()).toBe(200);
  await expect(studentJourney.getByTestId("student-p2b-result")).toBeVisible();
  for (const stage of ["story", "mechanism", "what_if", "reflection", "transfer"]) {
    await expect(studentJourney.getByTestId(`student-p2b-${stage}`)).toBeVisible();
  }

  await studentJourney.getByTestId("student-p2b-result-story-cta").click();
  await expect(studentJourney.getByTestId("student-p2b-story")).toBeInViewport();
  await studentJourney
    .getByLabel("我原本的判断")
    .fill("我原本判断价格变化会先影响需求，再影响利润区间。");
  await studentJourney
    .getByLabel("结果让我学到")
    .fill("我学到需要把行动、中间机制和正式结果分开阅读。");
  await studentJourney
    .getByLabel("下一轮我会检查")
    .fill("下一轮我会检查一个受控变量，并记录结果边界。");
  const reflectionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/bff/student/w3/reflection") &&
      response.request().method() === "POST"
  );
  await studentJourney.getByRole("button", { name: "保存学习草稿" }).click();
  expect((await reflectionResponse).status()).toBe(201);
  await expect(studentJourney).toContainText("学习草稿已保存；它不会进入正式结算。");

  const teacherPage = await page.context().newPage();
  try {
    await teacherPage.goto(`${teacherBaseUrl}?${w3Query}`);
    const teacherBff = teacherPage.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/bff/teacher/w3/consequence") &&
        response.request().method() === "GET"
    );
    await signIn(teacherPage, "teacher");
    const teacherJourney = teacherPage.getByLabel("教师复盘工作台");
    await expect(teacherJourney).toBeVisible();
    expect((await teacherBff).status()).toBe(200);
    for (const stage of [
      "today",
      "highest_blocker",
      "cohort_progress",
      "teachable_moment",
      "debrief_prep"
    ]) {
      await expect(teacherJourney.getByTestId(`teacher-p2b-${stage}`)).toBeVisible();
    }
    await expect(teacherJourney.getByText(/不展示学生私有判断正文/)).toBeVisible();
    await teacherJourney.getByTestId("teacher-p2b-teachable-show").click();
    await expect(teacherJourney.getByRole("status").filter({ hasText: "展示机制" })).toBeVisible();
    await teacherJourney.getByLabel("课堂笔记草稿（本地）").fill("先问中间机制，再展示边界。");
    await expect(teacherJourney).toContainText("不写入 canonical Decision 或正式结算");
    await expect(
      teacherPage.locator("[data-testid^='teacher-p2b'] button").filter({ hasText: "保存" })
    ).toHaveCount(0);
  } finally {
    await teacherPage.close();
  }
});

test("real BFF error recovers to the published Student journey and no-context access stays blocked", async ({
  page
}) => {
  await page.goto(`${studentBaseUrl}?w3=true`);
  await signIn(page, "student");
  const studentJourney = page.getByLabel("学员决策学习旅程");
  await expect(studentJourney.getByTestId("student-p2b-blocked")).toBeVisible();

  await page.goto(`${studentBaseUrl}?${invalidW3Query}`);
  const invalidBff = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/bff/student/w3/consequence") &&
      response.request().method() === "GET"
  );
  await signIn(page, "student");
  expect((await invalidBff).status()).toBe(422);
  await expect(page.getByTestId("student-p2b-error")).toBeVisible();
  await expect(page.getByTestId("student-p2b-retry")).toBeVisible();

  await page.goto(`${studentBaseUrl}?${w3Query}`);
  const recoveryBff = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/bff/student/w3/consequence") &&
      response.request().method() === "GET"
  );
  await signIn(page, "student");
  expect((await recoveryBff).status()).toBe(200);
  await expect(page.getByTestId("student-p2b-result")).toBeVisible();
});
