import { expect, test, type APIRequestContext } from "@playwright/test";
import type { ApiEnvelope, AuthSession, Run } from "../../packages/shared-contracts/src";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const tenantId = "tenant_demo";

test.afterAll(() => cleanupPlaywrightStore());

async function apiPost<TData>(
  request: APIRequestContext,
  path: string,
  token: string | undefined,
  body: unknown = {}
) {
  const response = await request.post(`${apiBaseUrl}${path}`, {
    data: body,
    headers: {
      authorization: token ? `Bearer ${token}` : "",
      "content-type": "application/json",
      "x-tenant-id": tenantId
    }
  });
  return { response, body: (await response.json()) as ApiEnvelope<TData> };
}

async function login(
  request: APIRequestContext,
  username: "teacher" | "student" | "admin"
): Promise<AuthSession> {
  const result = await apiPost<AuthSession>(request, "/api/v1/auth/login", undefined, {
    password: username,
    username
  });
  expect(result.response.ok()).toBe(true);
  return result.body.data;
}

test("SH-M3 Operating World real BFF journey uses Teacher/Student/Admin surfaces with no mocks", async ({
  page,
  request
}) => {
  const teacher = await login(request, "teacher");
  const run = await apiPost<{ run: Run }>(
    request,
    "/api/v1/courses/course_demo/runs",
    teacher.access_token
  );
  expect(run.response.ok()).toBe(true);
  const started = await apiPost<{ round_id: string }>(
    request,
    `/api/v1/runs/${run.body.data.run.run_id}/rounds/1/start`,
    teacher.access_token
  );
  expect(started.response.ok()).toBe(true);

  await page.goto(teacherBaseUrl);
  await page.getByLabel("tenant").fill(tenantId);
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();

  const studio = page.getByRole("region", { name: "SH-M3 Operating World Studio" });
  await expect(studio).toBeVisible();
  await studio.getByRole("button", { name: "创建 Operating World 草稿" }).click();
  await expect(studio.getByText(/Draft: operating_world_draft_/)).toBeVisible();
  await studio.getByRole("button", { name: "Validate" }).click();
  await studio.getByRole("button", { name: "BASE Preview" }).click();
  await expect(studio.getByText(/no_official_write=true/)).toBeVisible();
  await studio.getByRole("button", { name: "Freeze" }).click();
  await studio.getByRole("button", { name: "精确 Bind" }).click();
  await expect(studio.getByText(/Status: BOUND/)).toBeVisible();

  const teacherProjection = await request.get(
    `${apiBaseUrl}/api/v1/bff/teacher/operating-world/studio?courseId=course_demo`,
    { headers: { authorization: `Bearer ${teacher.access_token}`, "x-tenant-id": tenantId } }
  );
  const teacherBody = (await teacherProjection.json()) as ApiEnvelope<{
    drafts: Array<{ draft_id: string }>;
  }>;
  expect(teacherProjection.ok()).toBe(true);
  const draftId = teacherBody.data.drafts.at(-1)?.draft_id;
  expect(draftId).toMatch(/^operating_world_draft_/);

  const student = await login(request, "student");
  await page.goto(`${studentBaseUrl}?operatingWorldDraftId=${encodeURIComponent(draftId ?? "")}`);
  await page.getByLabel("tenant").fill(tenantId);
  await page.getByLabel("username").fill("student");
  await page.getByLabel("password").fill("student");
  await page.getByRole("button", { name: "学员登录" }).click();
  const brief = page.getByRole("region", { name: "Student Operating World Brief" });
  await expect(brief).toBeVisible();
  await expect(brief.getByText(/劳动力供给/)).toBeVisible();
  await expect(brief.getByText(/ROLE_SAFE_STUDENT/)).toBeVisible();

  const studentBrief = await request.get(
    `${apiBaseUrl}/api/v1/bff/student/operating-world/brief?courseId=course_demo&draftId=${draftId}&runId=${run.body.data.run.run_id}&roundNo=1`,
    { headers: { authorization: `Bearer ${student.access_token}`, "x-tenant-id": tenantId } }
  );
  const studentBody = (await studentBrief.json()) as ApiEnvelope<Record<string, unknown>>;
  expect(studentBrief.ok()).toBe(true);
  expect(JSON.stringify(studentBody)).not.toContain("source_ref");

  await page.goto(
    `${adminBaseUrl}?courseId=course_demo&operatingWorldDraftId=${encodeURIComponent(draftId ?? "")}&runId=${encodeURIComponent(run.body.data.run.run_id)}&roundNo=1`
  );
  await page.getByLabel("tenant").fill(tenantId);
  await page.getByLabel("username").fill("admin");
  await page.getByLabel("password").fill("admin");
  await page.getByRole("button", { name: "管理员登录" }).click();
  const audit = page.getByRole("region", { name: "Admin Operating World audit" });
  await expect(audit).toBeVisible();
  await expect(audit.getByText(/Readiness/)).toBeVisible();
  await expect(audit.getByText("BOUND", { exact: true })).toBeVisible();
  await expect(audit.getByTestId("operating-world-w4-replay-audit")).toContainText(
    /W4 Replay：(FOUND|NOT_FOUND|NOT_PROVEN)/
  );
});
