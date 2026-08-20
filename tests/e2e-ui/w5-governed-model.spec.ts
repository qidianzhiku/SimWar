import { expect, test, type APIRequestContext } from "@playwright/test";
import type { ApiEnvelope, AuthSession, Run } from "../../packages/shared-contracts/src";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
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

async function login(request: APIRequestContext, username: "teacher" | "student"): Promise<string> {
  const result = await apiPost<AuthSession>(request, "/api/v1/auth/login", undefined, {
    password: username,
    username
  });
  expect(result.response.ok()).toBe(true);
  return result.body.data.access_token;
}

test("W5 Teacher Studio binds one exact run and Student receives a role-safe projection", async ({
  page,
  request
}) => {
  const teacherToken = await login(request, "teacher");
  const run = await apiPost<{ run: Run }>(request, "/api/v1/courses/course_demo/runs", teacherToken);
  expect(run.response.ok()).toBe(true);
  const runId = run.body.data.run.run_id;
  const started = await apiPost<{ round_id: string }>(
    request,
    `/api/v1/runs/${runId}/rounds/1/start`,
    teacherToken
  );
  expect(started.response.ok()).toBe(true);

  await page.goto(teacherBaseUrl);
  await page.getByLabel("tenant").fill(tenantId);
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();

  const studio = page.getByRole("region", { name: "W5 Governed Model Studio" });
  await expect(studio).toBeVisible();
  await studio.getByRole("button", { name: "创建草稿" }).click();
  await expect(studio.getByText(/Draft: w5_draft_/)).toBeVisible();
  await studio.getByRole("button", { name: "验证草稿" }).click();
  await studio.getByRole("button", { name: "冻结草稿" }).click();
  await studio.getByRole("button", { name: "精确绑定当前 Run" }).click();
  await expect(studio.getByText("已精确绑定")).toBeVisible();
  await studio.getByRole("button", { name: "Standard 评估" }).click();
  await expect(studio.getByText(/SIMULATION_CORE/)).toBeVisible();

  const projection = await request.get(
    `${apiBaseUrl}/api/v1/bff/teacher/w5/governed-model?courseId=course_demo`,
    { headers: { authorization: `Bearer ${teacherToken}`, "x-tenant-id": tenantId } }
  );
  const projectionBody = (await projection.json()) as ApiEnvelope<{ drafts: Array<{ draft_id: string }> }>;
  expect(projection.ok()).toBe(true);
  const draftId = projectionBody.data.drafts.at(-1)?.draft_id;
  expect(draftId).toBeTruthy();

  const studentToken = await login(request, "student");
  const studentProjection = await request.get(
    `${apiBaseUrl}/api/v1/bff/student/w5/convergence?draftId=${draftId}&runId=${runId}&roundNo=1`,
    { headers: { authorization: `Bearer ${studentToken}`, "x-tenant-id": tenantId } }
  );
  const studentBody = (await studentProjection.json()) as ApiEnvelope<Record<string, unknown>>;
  expect(studentProjection.ok()).toBe(true);
  expect(JSON.stringify(studentBody)).not.toContain("parameter_values");
  expect(JSON.stringify(studentBody)).not.toContain("content_digest");

  await page.goto(`${studentBaseUrl}?w5DraftId=${encodeURIComponent(draftId ?? "")}`);
  await page.getByLabel("tenant").fill(tenantId);
  await page.getByLabel("username").fill("student");
  await page.getByLabel("password").fill("student");
  await page.getByRole("button", { name: "学员登录" }).click();
  const studentPanel = page.getByRole("region", { name: "W5 governed model convergence" });
  await expect(studentPanel).toBeVisible();
  await expect(studentPanel.getByText("SIMULATION_CORE", { exact: false })).toBeVisible();
  await expect(studentPanel.getByText("ROLE_SAFE_STUDENT", { exact: false })).toBeVisible();
});
