import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  P0DemoState
} from "../../packages/shared-contracts/src";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const internalMarkers = [
  "Manifest",
  "state_true",
  "decision_batch_hash",
  "json_runtime_source_digest",
  "canonical_evidence_digest",
  "private_replay",
  "private trace",
  "Other Teacher",
  "tenant_other"
];

test.afterAll(() => {
  cleanupPlaywrightStore();
});

async function apiPost<TData>(
  request: APIRequestContext,
  path: string,
  token: string | undefined,
  body: unknown
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
    headers: {
      authorization: `Bearer ${token}`,
      "x-tenant-id": "tenant_demo"
    }
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as ApiEnvelope<TData>;
}

async function login(
  request: APIRequestContext,
  username: "student" | "teacher",
  password: string
): Promise<string> {
  const envelope = await apiPost<AuthSession>(request, "/api/v1/auth/login", undefined, {
    password,
    username
  });
  return envelope.data.access_token;
}

async function signInTeacherPage(page: Page): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

async function signInStudentPage(page: Page): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("student");
  await page.getByLabel("password").fill("student");
  await page.getByRole("button", { name: "学员登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

async function publishSeededRunThroughTeacherUi(
  page: Page,
  request: APIRequestContext
): Promise<void> {
  await page.goto(teacherBaseUrl);
  await signInTeacherPage(page);

  const teacherToken = await login(request, "teacher", "teacher");
  const initialState = await apiGet<P0DemoState>(request, "/api/v1/demo-state", teacherToken);
  const latestRound = initialState.data.rounds.at(-1);
  if (initialState.data.latest_result && latestRound?.status === "published") {
    await expect(page.getByRole("heading", { name: "BFF Replay 摘要" })).toBeVisible();
    return;
  }

  await page.getByRole("button", { name: "创建 Run" }).click();
  await expect(page.getByText("run created")).toBeVisible();

  await page.getByRole("button", { name: "开启回合" }).click();
  await expect(page.getByText("round opened")).toBeVisible();

  const studentToken = await login(request, "student", "student");
  const demoState = await apiGet<P0DemoState>(request, "/api/v1/demo-state", teacherToken);
  const runId = demoState.data.runs.at(-1)?.run_id;
  expect(runId).toBeTruthy();

  await apiPost<Decision>(request, `/api/v1/runs/${runId}/rounds/1/decisions`, studentToken, {
    decision_payload: {
      capacity_plan: "expand",
      cash_buffer_target: 0.16,
      marketing_budget: 180000,
      pricing: { base_price: 12800 },
      service_quality_budget: 160000,
      strategy_statement: "守住中高端康养客群并优先保证交付能力"
    },
    team_id: "team_alpha"
  });

  await page.reload();
  await signInTeacherPage(page);
  await page.getByRole("button", { name: "锁定回合" }).click();
  await expect(page.getByText("round locked")).toBeVisible();

  await page.getByRole("button", { name: "请求结算" }).click();
  await expect(page.getByText("settlement completed")).toBeVisible();

  await page.getByRole("button", { name: "发布结果" }).click();
  await expect(page.getByText("result published")).toBeVisible();
}

test("Teacher and Student frontends consume BFF DTOs without exposing protected internals", async ({
  page,
  request
}) => {
  await publishSeededRunThroughTeacherUi(page, request);

  await expect(page.getByRole("heading", { name: "BFF 教师工作台" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "BFF 回合控制" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "BFF 队伍监控" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "BFF Replay 摘要" })).toBeVisible();
  const teacherBffSurface = page.getByLabel("teacher bff dto surface");
  await expect(teacherBffSurface.getByText("BFF_DTO_PRODUCTIZATION")).toBeVisible();
  await expect(teacherBffSurface.getByText("TEACHER_PROJECTION_EVIDENCE")).toBeVisible();
  await expect(page.getByText("formal_truth_write_allowed: false")).toBeVisible();

  const teacherText = await page.locator("body").innerText();
  for (const marker of internalMarkers) {
    expect(teacherText).not.toContain(marker);
  }

  await page.goto("/");
  await signInStudentPage(page);

  await expect(page.getByRole("heading", { name: "BFF 学员驾驶舱" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "BFF 决策表单" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "BFF 发布结果" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "三段式反馈" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Learning Report" })).toBeVisible();
  const studentBffSurface = page.getByLabel("student bff dto surface");
  await expect(studentBffSurface.getByText("STUDENT_PROJECTION_EVIDENCE").first()).toBeVisible();
  await expect(studentBffSurface.getByText("advisory_only: true")).toBeVisible();

  const studentText = await page.locator("body").innerText();
  for (const marker of internalMarkers) {
    expect(studentText).not.toContain(marker);
  }
});
