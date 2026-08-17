import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  P0DemoState,
  Round,
  Run
} from "../../packages/shared-contracts/src";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;

test.afterAll(() => cleanupPlaywrightStore());

async function apiPost<TData>(
  request: APIRequestContext,
  path: string,
  token: string | undefined,
  body: unknown = {}
): Promise<ApiEnvelope<TData>> {
  const response = await request.post(`${apiBaseUrl}${path}`, {
    data: body,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant_demo",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    }
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as ApiEnvelope<TData>;
}

async function apiGet<TData>(
  request: APIRequestContext,
  path: string,
  token: string
): Promise<ApiEnvelope<TData>> {
  const response = await request.get(`${apiBaseUrl}${path}`, {
    headers: { authorization: `Bearer ${token}`, "x-tenant-id": "tenant_demo" }
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as ApiEnvelope<TData>;
}

async function login(request: APIRequestContext, username: "teacher" | "student"): Promise<string> {
  const envelope = await apiPost<AuthSession>(request, "/api/v1/auth/login", undefined, {
    password: username,
    username
  });
  return envelope.data.access_token;
}

async function publishRoundOne(
  request: APIRequestContext,
  teacherToken: string,
  studentToken: string,
  runId: string
): Promise<void> {
  await apiPost<Round>(request, `/api/v1/runs/${runId}/rounds/1/start`, teacherToken);
  await apiPost<Decision>(request, `/api/v1/runs/${runId}/rounds/1/decisions`, studentToken, {
    decision_payload: {
      capacity_plan: "expand",
      cash_buffer_target: 0.16,
      marketing_budget: 180000,
      pricing: { base_price: 12800 },
      service_quality_budget: 160000,
      strategy_statement: "complete the first round before continuing the same Run"
    },
    team_id: "team_alpha"
  });
  await apiPost<Round>(request, `/api/v1/runs/${runId}/rounds/1/lock`, teacherToken);
  await apiPost<unknown>(request, `/api/v1/runs/${runId}/rounds/1/settle`, teacherToken);
  await apiPost<Round>(request, `/api/v1/runs/${runId}/rounds/1/publish`, teacherToken);
}

async function signInTeacherPage(page: Page): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(page.getByRole("status", { name: "教师操作通知" })).toContainText("signed in");
}

async function signInStudentPage(page: Page): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("student");
  await page.getByLabel("password").fill("student");
  await page.getByRole("button", { name: "学员登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

test("MW4 Teacher publishes Round 1, continues the same Run, and resolves Round 2", async ({
  page,
  request
}) => {
  const teacherToken = await login(request, "teacher");
  const studentToken = await login(request, "student");
  const created = await apiPost<{ run: Run; round: Round }>(
    request,
    "/api/v1/courses/course_demo/runs",
    teacherToken
  );
  const runId = created.data.run.run_id;
  await publishRoundOne(request, teacherToken, studentToken, runId);
  const before = await apiGet<P0DemoState>(request, "/api/v1/demo-state", teacherToken);
  const beforeRunCount = before.data.runs.length;
  const beforeRoundOne = before.data.rounds.find(
    (round) => round.run_id === runId && round.round_no === 1
  );
  expect(beforeRoundOne?.status).toBe("published");

  await page.goto(teacherBaseUrl);
  await signInTeacherPage(page);
  await page.getByLabel("run selector").selectOption(runId);
  await expect(page.getByText("Historical Run · read-only")).toBeVisible();
  await expect(page.getByRole("button", { name: "创建下一回合" })).toBeEnabled();
  await page.getByRole("button", { name: "创建下一回合" }).click();
  await expect(page.getByRole("status", { name: "教师操作通知" })).toContainText(
    "下一回合已创建并切换到新回合"
  );
  await expect(page.getByLabel("M1 回合状态").getByText("第 2 轮 · 待开启")).toBeVisible();
  await expect(page.getByRole("button", { name: "开启回合" })).toBeEnabled();

  const after = await apiGet<P0DemoState>(request, "/api/v1/demo-state", teacherToken);
  expect(after.data.runs).toHaveLength(beforeRunCount);
  expect(after.data.rounds.filter((round) => round.run_id === runId)).toHaveLength(2);
  expect(after.data.rounds.find((round) => round.run_id === runId && round.round_no === 1)).toEqual(
    beforeRoundOne
  );
  expect(
    after.data.rounds.find((round) => round.run_id === runId && round.round_no === 2)
  ).toMatchObject({
    run_id: runId,
    round_no: 2,
    status: "draft"
  });

  const studentCockpit = await apiGet<unknown>(
    request,
    `/api/v1/bff/student/runs/${runId}/rounds/2/cockpit`,
    studentToken
  );
  expect(JSON.stringify(studentCockpit.data)).toContain('"round_no":2');
  expect(JSON.stringify(studentCockpit.data)).not.toContain(
    "previous round decision remains immutable"
  );

  const studentPage = await page.context().newPage();
  await studentPage.goto(studentBaseUrl);
  await signInStudentPage(studentPage);
  await expect(studentPage.getByRole("heading", { name: "SimWar M1 学员驾驶舱" })).toBeVisible();
  await expect(studentPage.getByRole("heading", { name: "BFF 学员驾驶舱" })).toBeVisible();
  await expect(studentPage.getByLabel("learner status")).toContainText("草稿");
  await studentPage.close();
});
