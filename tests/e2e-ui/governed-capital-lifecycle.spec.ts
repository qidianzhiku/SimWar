import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { ApiEnvelope, AuthSession } from "../../packages/shared-contracts/src/index.js";
import { cleanupPlaywrightStore } from "./store-isolation.js";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const tenantId = "tenant_demo";

test.afterAll(() => cleanupPlaywrightStore());

async function apiPost<T>(
  request: APIRequestContext,
  path: string,
  token: string | undefined,
  body: unknown = {}
): Promise<{ response: Awaited<ReturnType<APIRequestContext["post"]>>; body: ApiEnvelope<T> }> {
  const response = await request.post(`${apiBaseUrl}${path}`, {
    data: body,
    headers: {
      authorization: token ? `Bearer ${token}` : "",
      "content-type": "application/json",
      "x-tenant-id": tenantId
    }
  });
  return { response, body: (await response.json()) as ApiEnvelope<T> };
}

async function login(
  request: APIRequestContext,
  username: "teacher" | "student" | "admin"
): Promise<string> {
  const { response, body } = await apiPost<AuthSession>(request, "/api/v1/auth/login", undefined, {
    username,
    password: username
  });
  expect(response.ok()).toBe(true);
  return body.data.access_token;
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

test("R1 real browser journey governs capital lifecycle across Teacher, Student, and Admin", async ({
  page,
  request
}) => {
  const teacher = await login(request, "teacher");
  const student = await login(request, "student");
  const created = await apiPost<{ run: { run_id: string } }>(
    request,
    "/api/v1/courses/course_demo/runs",
    teacher
  );
  expect(created.response.status()).toBe(201);
  const runId = created.body.data.run.run_id;
  const started = await apiPost<{ round_id: string }>(
    request,
    `/api/v1/runs/${runId}/rounds/1/start`,
    teacher
  );
  expect(started.response.ok()).toBe(true);
  const roundId = started.body.data.round_id;
  const initial = await apiPost(request, `/api/v1/w4/runs/${runId}/rounds/1/states`, teacher, {
    course_id: "course_demo",
    team_id: "team_alpha",
    round_id: roundId,
    state: {
      cash: 1000,
      capacity: 100,
      product_lines: ["core-care"],
      positioning: "trusted-care",
      organization: { team_size: 4 },
      operating_units: [],
      portfolio: { projects: [], facilities: [] }
    }
  });
  expect(initial.response.status()).toBe(201);
  const decision = await apiPost<{ decision: { decision_id: string } }>(
    request,
    `/api/v1/w4/runs/${runId}/rounds/1/strategic-decisions`,
    student,
    {
      course_id: "course_demo",
      team_id: "team_alpha",
      round_id: roundId,
      decision: {
        decision_id: `capital-browser-decision-${runId}`,
        tenant_id: tenantId,
        course_id: "course_demo",
        run_id: runId,
        round_id: roundId,
        round_no: 1,
        team_id: "team_alpha",
        kind: "capital_action",
        version: 1,
        status: "canonical",
        payload: {
          rationale: "protect browser-tested liquidity",
          lead_time_rounds: 0,
          reversible: true,
          dependencies: [],
          kpi_hypothesis: "keep liquidity above covenant",
          capital_action_kind: "debt",
          principal: 400,
          term_rounds: 2,
          rate_or_cost_bps: 250,
          cost_source: "scenario-capital-cost-v1",
          covenant_min_cash: 500,
          fees: 10,
          obligation: "term_debt"
        }
      }
    }
  );
  expect(decision.response.status()).toBe(201);

  await signIn(page, teacherBaseUrl, "teacher", "教师登录");
  const teacherPanel = page.getByLabel("治理资本生命周期工作台");
  await expect(teacherPanel).toBeVisible();
  await expect(teacherPanel.getByRole("button", { name: "创建治理资本提案" })).toBeVisible();
  await teacherPanel.getByRole("button", { name: "创建治理资本提案" }).click();
  await expect(teacherPanel.getByText("PROPOSED", { exact: false })).toBeVisible();
  await teacherPanel.getByRole("button", { name: "批准治理资本提案" }).click();
  await expect(teacherPanel.getByText("APPROVED", { exact: false })).toBeVisible();
  await teacherPanel.getByRole("button", { name: "进入资本执行状态" }).click();
  await expect(teacherPanel.getByText("EXECUTING", { exact: false })).toBeVisible();

  await signIn(page, studentBaseUrl, "student", "学员登录");
  const studentPanel = page.getByLabel("受治理资本生命周期");
  await expect(studentPanel).toBeVisible();
  await expect(studentPanel.getByText("loan", { exact: false })).toBeVisible();
  await expect(studentPanel.getByText("执行中", { exact: false })).toBeVisible();
  await expect(studentPanel.getByText("approval actors", { exact: false })).toHaveCount(0);

  await signIn(page, adminBaseUrl, "admin", "管理员登录");
  const adminPanel = page.getByLabel("治理资本生命周期审计");
  await expect(adminPanel).toBeVisible();
  await expect(adminPanel.getByText("EXECUTING", { exact: false })).toBeVisible();
});
