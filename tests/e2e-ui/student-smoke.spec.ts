import { expect, test, type APIRequestContext } from "@playwright/test";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  P0DemoState,
  Round
} from "../../packages/shared-contracts/src";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const m1ResultLabel = "M1 Teaching-Official Result under Current JSON Active Runtime";

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

test("loads the seeded student dashboard through real API login", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SimWar M1 学员驾驶舱" })).toBeVisible();
  await expect(page.getByText(m1ResultLabel)).toBeVisible();
  await expect(page.getByText("learner / team_captain · tenant_demo")).toBeVisible();
  await expect(page.getByText("M1 康养教学闭环课程")).toBeVisible();
  await expect(page.getByText("Alpha 康养队")).toBeVisible();
  await expect(page.getByText("学员试讲导入")).toBeVisible();
  await expect(page.getByText("提交前检查")).toBeVisible();
  await expect(page.getByText("反馈怎么读")).toBeVisible();
});

test("rejects seeded student login with an invalid password", async ({ request }) => {
  const response = await request.post(`${apiBaseUrl}/api/v1/auth/login`, {
    data: {
      password: "not-the-seeded-password",
      username: "student"
    },
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant_demo"
    }
  });

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({ code: "AUTH-401-002" });
});

test("lets the teacher browser publish the M1 JSON-runtime classroom result", async ({
  page,
  request
}) => {
  await page.goto(teacherBaseUrl);

  await expect(page.getByRole("heading", { name: "SimWar M1 教师控制台" })).toBeVisible();
  await expect(page.getByText(m1ResultLabel)).toBeVisible();
  await expect(page.getByText("30-60 分钟试讲流程")).toBeVisible();
  await expect(page.getByText("教师操作清单")).toBeVisible();
  await expect(page.getByText("最小学习证据 Rubric")).toBeVisible();

  await page.getByRole("button", { name: "创建 Run" }).click();
  await expect(page.getByText("run created")).toBeVisible();

  await page.getByRole("button", { name: "开启回合" }).click();
  await expect(page.getByText("round opened")).toBeVisible();

  const teacherToken = await login(request, "teacher", "teacher");
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
  await expect(page.getByRole("button", { name: "锁定回合" })).toBeVisible();
  await page.getByRole("button", { name: "锁定回合" }).click();
  await expect(page.getByText("round locked")).toBeVisible();

  await page.getByRole("button", { name: "请求结算" }).click();
  await expect(page.getByText("settlement completed")).toBeVisible();

  await page.getByRole("button", { name: "发布结果" }).click();
  await expect(page.getByText("result published")).toBeVisible();
  await expect(page.getByText("M1 教学正式结果")).toBeVisible();
  await expect(page.getByRole("heading", { name: "课堂复盘材料" })).toBeVisible();
  await expect(page.getByText("Rank 1")).toBeVisible();

  const finalState = await apiGet<P0DemoState>(request, "/api/v1/demo-state", teacherToken);
  const publishedRound = finalState.data.rounds.find((round: Round) => round.run_id === runId);
  expect(publishedRound?.status).toBe("published");
  expect(finalState.data.latest_result?.result_label).toBe(m1ResultLabel);
});
