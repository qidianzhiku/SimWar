import { expect, test, type APIRequestContext } from "@playwright/test";
import type { ApiEnvelope, AuthSession, Run } from "../../packages/shared-contracts/src";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const tenantId = "tenant_demo";

test.afterAll(() => cleanupPlaywrightStore());

async function apiPost<T>(
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
  return { response, body: (await response.json()) as ApiEnvelope<T> };
}

async function login(request: APIRequestContext, username: "teacher" | "student"): Promise<string> {
  const { response, body } = await apiPost<AuthSession>(request, "/api/v1/auth/login", undefined, {
    username,
    password: username
  });
  expect(response.ok()).toBe(true);
  return body.data.access_token;
}

test("W4 Student journey exposes New Project, Commitment, lead time, and safe Opening State", async ({
  page,
  request
}) => {
  const teacher = await login(request, "teacher");
  const student = await login(request, "student");
  const created = await apiPost<{ run: Run }>(request, "/api/v1/courses/course_demo/runs", teacher);
  expect(created.response.ok()).toBe(true);
  const runId = created.body.data.run.run_id;
  const roundId = `round_${runId}_1`;

  const state = await apiPost(request, `/api/v1/w4/runs/${runId}/rounds/1/states`, teacher, {
    course_id: "course_demo",
    team_id: "team_alpha",
    state: {
      cash: 1000,
      capacity: 100,
      product_lines: ["core-care"],
      positioning: "trusted-care",
      organization: { team_size: 4 },
      portfolio: { projects: [], facilities: [] }
    }
  });
  expect(state.response.status()).toBe(201);
  const decision = await apiPost(
    request,
    `/api/v1/w4/runs/${runId}/rounds/1/strategic-decisions`,
    student,
    {
      course_id: "course_demo",
      team_id: "team_alpha",
      decision: {
        decision_id: `w4-browser-decision-${runId}`,
        tenant_id: tenantId,
        course_id: "course_demo",
        run_id: runId,
        round_id: roundId,
        round_no: 1,
        team_id: "team_alpha",
        kind: "new_project",
        version: 1,
        status: "canonical",
        payload: {
          project_name: "浏览器新区项目",
          cost: 300,
          cycle_rounds: 3,
          area: 12000,
          beds: 120,
          bed_mix: { standard: 72, memory_care: 36, premium: 12 },
          ramp: 0.4,
          lead_time_rounds: 2
        }
      }
    }
  );
  expect(decision.response.status()).toBe(201);

  await page.goto(studentBaseUrl);
  await page.getByLabel("tenant").fill(tenantId);
  await page.getByLabel("username").fill("student");
  await page.getByLabel("password").fill("student");
  await page.getByRole("button", { name: "学员登录" }).click();
  await expect(page.getByRole("heading", { name: "Enterprise State · New Project" })).toBeVisible();
  await expect(page.getByText("Commitment", { exact: false })).toBeVisible();
  await expect(page.getByText("浏览器新区项目", { exact: false })).toBeVisible();
});
