import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { ApiEnvelope, AuthSession } from "../../packages/shared-contracts/src/index.js";
import { cleanupPlaywrightStore } from "./store-isolation.js";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const tenantId = "tenant_demo";

test.afterAll(() => cleanupPlaywrightStore());

async function login(request: APIRequestContext, username: "teacher" | "student" | "admin") {
  const response = await request.post(`${apiBaseUrl}/api/v1/auth/login`, {
    data: { password: username, username },
    headers: { "content-type": "application/json", "x-tenant-id": tenantId }
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data.access_token;
}

async function signIn(
  page: Page,
  baseUrl: string,
  username: "teacher" | "student" | "admin",
  button: string
) {
  await page.goto(baseUrl);
  await page.getByLabel("tenant").fill(tenantId);
  await page.getByLabel("username").fill(username);
  await page.getByLabel("password").fill(username);
  await page.getByRole("button", { name: button }).click();
}

test("W6 real-BFF journey exposes governed assistance across Teacher, Student and Admin", async ({
  page,
  request
}) => {
  const teacherToken = await login(request, "teacher");
  const runResponse = await request.post(`${apiBaseUrl}/api/v1/courses/course_demo/runs`, {
    data: {},
    headers: {
      authorization: `Bearer ${teacherToken}`,
      "content-type": "application/json",
      "x-tenant-id": tenantId
    }
  });
  expect(runResponse.status()).toBe(201);
  const runId = ((await runResponse.json()) as ApiEnvelope<{ run: { run_id: string } }>).data.run
    .run_id;
  const roundResponse = await request.post(`${apiBaseUrl}/api/v1/runs/${runId}/rounds/1/start`, {
    headers: { authorization: `Bearer ${teacherToken}`, "x-tenant-id": tenantId }
  });
  expect(roundResponse.ok()).toBe(true);
  const roundId = ((await roundResponse.json()) as ApiEnvelope<{ round_id: string }>).data.round_id;

  const assignmentResponse = await request.put(
    `${apiBaseUrl}/api/v1/bff/teacher/role-workflows/assignments`,
    {
      data: {
        course_id: "course_demo",
        role_key: "CEO",
        run_id: runId,
        team_id: "team_alpha",
        user_id: "usr_student"
      },
      headers: {
        authorization: `Bearer ${teacherToken}`,
        "content-type": "application/json",
        "x-tenant-id": tenantId
      }
    }
  );
  expect(assignmentResponse.status()).toBe(201);
  const studentToken = await login(request, "student");
  const sectionResponse = await request.put(
    `${apiBaseUrl}/api/v1/bff/student/role-workspace/section`,
    {
      data: {
        expected_version: 0,
        payload: { strategy_statement: "A bounded evidence-backed team plan." },
        round_id: roundId,
        run_id: runId,
        team_id: "team_alpha"
      },
      headers: {
        authorization: `Bearer ${studentToken}`,
        "content-type": "application/json",
        "x-tenant-id": tenantId
      }
    }
  );
  expect(sectionResponse.status()).toBe(200);

  await signIn(page, teacherBaseUrl, "teacher", "教师登录");
  const teacherPanel = page.getByRole("region", { name: "Governed Intelligence Workspace" });
  await expect(teacherPanel).toBeVisible();
  await expect(teacherPanel).toContainText(runId);
  await teacherPanel.getByRole("button", { name: "请求 Teacher Copilot" }).click();
  await expect(teacherPanel).toContainText("Teacher Copilot");
  await expect(teacherPanel).toContainText("evaluation: passed");
  await expect(teacherPanel).toContainText("Provider OFF");
  await expect(teacherPanel).toContainText("section_saved");

  await signIn(page, studentBaseUrl, "student", "学员登录");
  const studentPanel = page.getByRole("region", { name: "Student Coach" });
  await expect(studentPanel).toBeVisible();
  await expect(studentPanel).toContainText(runId);
  await studentPanel.getByRole("button", { name: "请求 Student Coach" }).click();
  await expect(studentPanel).toContainText("Student Coach");
  await expect(studentPanel).toContainText("evidence citation");
  await expect(studentPanel).toContainText("formal_truth_write: false");

  await signIn(page, adminBaseUrl, "admin", "管理员登录");
  const adminPanel = page.getByRole("region", { name: "Governed Intelligence Audit" });
  await expect(adminPanel).toBeVisible();
  await expect(adminPanel).toContainText("审计投影已加载");
  await expect(adminPanel).toContainText("teacher_copilot");
  await expect(adminPanel).toContainText("student_coach");
  await expect(adminPanel).toContainText("read-only");
});
