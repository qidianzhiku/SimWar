import { expect, test, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { ApiEnvelope, AuthSession, Run } from "../../packages/shared-contracts/src";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
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

async function login(request: APIRequestContext, username: "teacher" | "student" | "admin") {
  const result = await apiPost<AuthSession>(request, "/api/v1/auth/login", undefined, {
    password: username,
    username
  });
  expect(result.response.ok()).toBe(true);
  return result.body.data.access_token;
}

test("Shanghai full vertical is reproducible across real Teacher, Student and Admin BFF surfaces", async ({
  page,
  request
}) => {
  const teacherToken = await login(request, "teacher");
  const createdRun = await apiPost<{ run: Run }>(
    request,
    "/api/v1/courses/course_demo/runs",
    teacherToken
  );
  expect(createdRun.response.ok()).toBe(true);
  const runId = createdRun.body.data.run.run_id;
  const started = await apiPost<{ round_id: string }>(
    request,
    `/api/v1/runs/${runId}/rounds/1/start`,
    teacherToken
  );
  expect(started.response.ok()).toBe(true);

  const created = await apiPost<{ draft: { draft_id: string } }>(
    request,
    "/api/v1/bff/teacher/w5/scenario-studio/drafts",
    teacherToken,
    { course_id: "course_demo", title: "Shanghai O1 browser journey" }
  );
  expect(created.response.status()).toBe(201);
  const draftId = created.body.data.draft.draft_id;
  for (const action of ["validate", "freeze"] as const) {
    const result = await apiPost(
      request,
      `/api/v1/bff/teacher/w5/scenario-studio/drafts/${draftId}/${action}`,
      teacherToken
    );
    expect(result.response.ok()).toBe(true);
  }
  const bound = await apiPost(
    request,
    `/api/v1/bff/teacher/w5/scenario-studio/drafts/${draftId}/bind`,
    teacherToken,
    { round_no: 1, run_id: runId }
  );
  expect(bound.response.ok()).toBe(true);
  const evaluated = await apiPost(
    request,
    `/api/v1/bff/teacher/w5/scenario-studio/drafts/${draftId}/evaluate`,
    teacherToken,
    { experience_profile: "STANDARD", round_no: 1, run_id: runId }
  );
  expect(evaluated.response.ok()).toBe(true);

  await page.goto(`${teacherBaseUrl}?shanghaiDraftId=${encodeURIComponent(draftId)}`);
  await page.getByLabel("tenant").fill(tenantId);
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();
  const teacherPanel = page.getByRole("region", {
    name: "Shanghai full vertical Teacher projection"
  });
  await expect(teacherPanel).toBeVisible();
  await expect(teacherPanel.getByText("READY_WITH_LIMITS", { exact: false })).toBeVisible();
  await expect(teacherPanel.getByText("Simulation Core", { exact: false })).toBeVisible();
  const teacherCanPanel = page.getByTestId("r1-can-teacher");
  await expect(teacherCanPanel).toBeVisible();
  await expect(teacherCanPanel.getByText("Simulation Core", { exact: false })).toBeVisible();
  const teacherCanAxe = await new AxeBuilder({ page })
    .include('[data-testid="r1-can-teacher"]')
    .analyze();
  expect(teacherCanAxe.violations).toEqual([]);

  const studentToken = await login(request, "student");
  const studentProjection = await request.get(
    `${apiBaseUrl}/api/v1/bff/student/shanghai/full-vertical?draftId=${draftId}&runId=${runId}&roundNo=1`,
    { headers: { authorization: `Bearer ${studentToken}`, "x-tenant-id": tenantId } }
  );
  expect(studentProjection.ok()).toBe(true);
  const studentBody = (await studentProjection.json()) as ApiEnvelope<Record<string, unknown>>;
  expect(JSON.stringify(studentBody)).not.toContain("parameter_values");
  expect(JSON.stringify(studentBody)).not.toContain("content_digest");

  await page.goto(`${studentBaseUrl}?w5DraftId=${encodeURIComponent(draftId)}`);
  await page.getByLabel("tenant").fill(tenantId);
  await page.getByLabel("username").fill("student");
  await page.getByLabel("password").fill("student");
  await page.getByRole("button", { name: "学员登录" }).click();
  const studentPanel = page.getByRole("region", {
    name: "Shanghai full vertical Student projection"
  });
  await expect(studentPanel).toBeVisible();
  await expect(studentPanel.getByText("ROLE_SAFE_STUDENT", { exact: false })).toBeVisible();
  await expect(studentPanel.getByText("SIMULATION_CORE", { exact: true }).first()).toBeVisible();
  const studentCanPanel = page.getByTestId("r1-can-student");
  await expect(studentCanPanel).toBeVisible();
  await expect(studentCanPanel.getByText("ROLE-SAFE", { exact: true })).toBeVisible();
  const studentCanAxe = await new AxeBuilder({ page })
    .include('[data-testid="r1-can-student"]')
    .analyze();
  expect(studentCanAxe.violations).toEqual([]);

  await page.goto(
    `${adminBaseUrl}?courseId=course_demo&shanghaiDraftId=${encodeURIComponent(draftId)}&runId=${encodeURIComponent(runId)}&roundId=${encodeURIComponent(started.body.data.round_id)}&roundNo=1`
  );
  await page.getByLabel("tenant").fill(tenantId);
  await page.getByLabel("username").fill("admin");
  await page.getByLabel("password").fill("admin");
  await page.getByRole("button", { name: "管理员登录" }).click();
  const adminPanel = page.getByRole("region", {
    name: "Shanghai full vertical Admin projection"
  });
  await expect(adminPanel).toBeVisible();
  await expect(adminPanel.getByText("BOUND", { exact: true }).first()).toBeVisible();
  await expect(adminPanel.getByText("只读", { exact: true }).first()).toBeVisible();
  const adminCanPanel = page.getByTestId("r1-can-admin");
  await expect(adminCanPanel).toBeVisible();
  await expect(adminCanPanel.getByText("Simulation Core", { exact: false })).toBeVisible();
  const adminCanAxe = await new AxeBuilder({ page })
    .include('[data-testid="r1-can-admin"]')
    .analyze();
  expect(adminCanAxe.violations).toEqual([]);
});
