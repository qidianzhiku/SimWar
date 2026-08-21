import { expect, test, type Page } from "@playwright/test";
import { M2P3_RUN_ID } from "./m2-p3-project-aware-launch-fixture";
import { cleanupPlaywrightStore } from "./store-isolation";

const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;

test.afterEach(() => cleanupPlaywrightStore());

async function signIn(page: Page, username: string, label: "教师登录" | "学员登录" | "管理员登录") {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(username);
  await page.getByLabel("password").fill(username);
  await page.getByRole("button", { name: label }).click();
  await expect(page.getByText("not signed in", { exact: true })).toHaveCount(0);
}

test("@m2-p3-real completes exact project-aware readiness, launch and safe student entry", async ({
  browser,
  page
}) => {
  test.skip(
    process.env.SIMWAR_PLAYWRIGHT_M2_PROJECT_AWARE !== "true",
    "M2-P3 dedicated real-BFF fixture is enabled only for the explicit mocks=0 run"
  );

  await page.goto(teacherBaseUrl);
  await signIn(page, "teacher", "教师登录");
  const teacherPanel = page.getByRole("region", { name: "Project-aware Course launch" });
  await expect(teacherPanel).toContainText("BLOCKED");
  await expect(teacherPanel).toContainText("MISSING_ASSIGNMENT");

  const projectLibrary = page.getByRole("region", { name: "Project Library and assignment" });
  await projectLibrary.getByLabel("Assignment 队伍").selectOption("team_beta");
  await projectLibrary.getByRole("button", { name: "分配到当前 Run / Team" }).click();
  await expect(projectLibrary).toContainText("VALIDATED");

  await page.reload();
  await signIn(page, "teacher", "教师登录");
  const readyPanel = page.getByRole("region", { name: "Project-aware Course launch" });
  await expect(readyPanel).toContainText("READY");
  await expect(readyPanel).toContainText("team_alpha");
  await expect(readyPanel).toContainText("team_beta");
  await expect(readyPanel).toContainText("shanghai-project-m2-p3-browser");
  await readyPanel.getByRole("button", { name: "Launch project-aware Course" }).click();
  await expect(readyPanel).toContainText("ACCEPTED");

  await page.goto(studentBaseUrl);
  await signIn(page, "student", "学员登录");
  const studentPanel = page.getByRole("region", { name: "Student project-aware context" });
  await expect(studentPanel).toContainText("team_alpha");
  await expect(studentPanel).toContainText("CEO");
  await expect(studentPanel).toContainText("M2-P3 Matched Arena");
  await expect(studentPanel).not.toContainText(
    /state_true|score|rank|settlement_result|other_team_data/i
  );

  const betaContext = await browser.newContext();
  const betaPage = await betaContext.newPage();
  try {
    await betaPage.goto(studentBaseUrl);
    await signIn(betaPage, "student_beta", "学员登录");
    const betaPanel = betaPage.getByRole("region", { name: "Student project-aware context" });
    await expect(betaPanel).toContainText("team_beta");
    await expect(betaPanel).toContainText("M2-P3 Matched Arena");
  } finally {
    await betaContext.close();
  }

  const directStudentLogin = await page.request.post(`${apiBaseUrl}/api/v1/auth/login`, {
    data: { password: "student", username: "student" },
    headers: { "x-tenant-id": "tenant_demo" }
  });
  expect(directStudentLogin.status()).toBe(200);
  const directStudentSession = (await directStudentLogin.json()) as {
    data: { access_token: string };
  };
  const crossTeamResponse = await page.request.get(
    `${apiBaseUrl}/api/v1/bff/student/project-aware-context?course_id=course_demo&run_id=${M2P3_RUN_ID}&team_id=team_beta`,
    {
      headers: {
        authorization: `Bearer ${directStudentSession.data.access_token}`,
        "x-tenant-id": "tenant_demo"
      }
    }
  );
  expect(crossTeamResponse.status()).toBe(403);

  await page.goto(adminBaseUrl);
  await signIn(page, "admin", "管理员登录");
  const auditPanel = page.getByRole("region", { name: "Project-aware launch audit" });
  await expect(auditPanel).toContainText("READY");
  await expect(auditPanel).toContainText("Launch receipts");
  await expect(auditPanel).toContainText("ACCEPTED");
  expect(M2P3_RUN_ID).toBe("run_m2_p3_project_aware_browser");
});
