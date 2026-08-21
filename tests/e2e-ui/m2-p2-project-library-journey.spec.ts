import { expect, test, type Page } from "@playwright/test";
import { cleanupPlaywrightStore } from "./store-isolation";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;

test.afterEach(() => cleanupPlaywrightStore());

async function signIn(page: Page, app: "admin" | "student" | "teacher"): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(app === "admin" ? "admin" : app);
  await page.getByLabel("password").fill(app === "admin" ? "admin" : app);
  await page
    .getByRole("button", {
      name: app === "admin" ? "管理员登录" : app === "teacher" ? "教师登录" : "学员登录"
    })
    .click();
  await expect(page.getByText("signed in").first()).toBeVisible();
}

test("@m2-p2-real keeps Project Profile provenance separate from exact assignment and W4 state", async ({
  page
}) => {
  test.skip(
    process.env.SIMWAR_PLAYWRIGHT_M2_PROJECT_LIBRARY !== "true",
    "M2-P2 Project Library fixture is enabled only for the dedicated real-BFF run"
  );

  await page.goto(teacherBaseUrl);
  await signIn(page, "teacher");
  const teacherPanel = page.getByRole("region", { name: "Project Library and assignment" });
  await expect(teacherPanel).toContainText("Project Library");
  await teacherPanel.getByRole("button", { name: "新增安全项目档案" }).click();
  await expect(teacherPanel).toContainText("DRAFT");
  await teacherPanel.getByRole("button", { name: "校验并冻结来源" }).click();
  await expect(teacherPanel).toContainText("VALIDATED");
  const assignmentResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/project-library/assign")
  );
  await teacherPanel.getByRole("button", { name: "分配到当前 Run / Team" }).click();
  const assignment = await assignmentResponse;
  expect(assignment.status()).toBe(200);
  expect((await assignment.json()).data.w4_initial_state.created).toBe(true);

  await page.goto(studentBaseUrl);
  await signIn(page, "student");
  const studentPanel = page.getByRole("article", { name: "学生项目安全简报" });
  await expect(studentPanel).toContainText("当前 Playable Company");
  await expect(studentPanel).toContainText("ASSIGNED");
  await expect(studentPanel).toContainText("Shanghai Care Project");
  await expect(studentPanel).not.toContainText(
    /raw_source|state_true|score|rank|settlement_result/i
  );

  await page.goto(adminBaseUrl);
  await signIn(page, "admin");
  const auditPanel = page.getByRole("region", { name: "Project Library audit" });
  await expect(auditPanel).toContainText("TENANT SCOPED");
  await expect(auditPanel).toContainText("Assignments");
  await expect(auditPanel).toContainText("1");
});
