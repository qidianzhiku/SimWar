import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  Round,
  Run,
  StudentBffCockpitDTO
} from "../../packages/shared-contracts/src";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;

test.afterAll(() => {
  cleanupPlaywrightStore();
});

async function apiRequest<TData>(
  request: APIRequestContext,
  method: "GET" | "POST",
  path: string,
  token?: string,
  body?: unknown,
  servicePrincipal?: string
): Promise<{ status: number; data?: TData; error?: { code: string } }> {
  const response = await request.fetch(`${apiBaseUrl}${path}`, {
    data: body,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant_demo",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(servicePrincipal ? { "x-service-principal": servicePrincipal } : {})
    },
    method
  });
  const payload = (await response.json()) as ApiEnvelope<TData> & { code: string };
  return response.ok()
    ? { data: payload.data, status: response.status() }
    : { error: { code: payload.code }, status: response.status() };
}

async function login(
  request: APIRequestContext,
  username: "student" | "teacher",
  password: string
): Promise<string> {
  const response = await apiRequest<AuthSession>(request, "POST", "/api/v1/auth/login", undefined, {
    password,
    username
  });
  expect(response.status).toBe(200);
  return response.data!.access_token;
}

async function prepareSettledRun(
  request: APIRequestContext,
  teacherToken: string,
  studentToken: string
): Promise<Run> {
  const run = await apiRequest<{ run: Run; round: Round }>(
    request,
    "POST",
    "/api/v1/courses/course_demo/runs",
    teacherToken
  );
  expect(run.status).toBe(201);

  const started = await apiRequest<Round>(
    request,
    "POST",
    `/api/v1/runs/${run.data!.run.run_id}/rounds/1/start`,
    teacherToken
  );
  expect(started.status).toBe(200);

  const decision = await apiRequest<Decision>(
    request,
    "POST",
    `/api/v1/runs/${run.data!.run.run_id}/rounds/1/decisions`,
    studentToken,
    {
      decision_payload: {
        capacity_plan: "expand",
        cash_buffer_target: 0.16,
        marketing_budget: 180000,
        pricing: { base_price: 12800 },
        service_quality_budget: 160000,
        strategy_statement: "Browser publication gate safety journey"
      },
      team_id: "team_alpha"
    }
  );
  expect(decision.status).toBe(201);

  const locked = await apiRequest<Round>(
    request,
    "POST",
    `/api/v1/runs/${run.data!.run.run_id}/rounds/1/lock`,
    teacherToken
  );
  expect(locked.status).toBe(200);

  const settled = await apiRequest<unknown>(
    request,
    "POST",
    `/internal/v1/runs/${run.data!.run.run_id}/rounds/1/settle`,
    "playwright-internal-service-token",
    undefined,
    "service_kernel"
  );
  expect(settled.status).toBe(200);
  return run.data!.run;
}

async function signInStudentPage(page: Page): Promise<void> {
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill("student");
  await page.getByLabel("password").fill("student");
  await page.getByRole("button", { name: "学员登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

test("Student sees no result before publish and the same result after Teacher Publish", async ({
  page,
  request
}) => {
  const teacherToken = await login(request, "teacher", "teacher");
  const studentToken = await login(request, "student", "student");
  const run = await prepareSettledRun(request, teacherToken, studentToken);

  const blockedDirect = await apiRequest<unknown>(
    request,
    "GET",
    `/api/v1/runs/${run.run_id}/rounds/1/results`,
    studentToken
  );
  expect(blockedDirect.status).toBe(409);
  expect(blockedDirect.error?.code).toBe("RESULT-409-001");

  await page.goto("/");
  await signInStudentPage(page);
  await expect(page.getByRole("heading", { name: "BFF 学员驾驶舱" })).toBeVisible();
  const bffSection = page.getByLabel("信息与证据补充");
  await expect(bffSection.getByText("结果发布后显示可见反馈。")).toBeVisible();
  await expect(bffSection.getByText("排名（服务端投影）")).toHaveCount(0);

  const publish = await apiRequest<Round>(
    request,
    "POST",
    `/api/v1/runs/${run.run_id}/rounds/1/publish`,
    teacherToken
  );
  expect(publish.status).toBe(200);

  const publishedCockpit = await apiRequest<StudentBffCockpitDTO>(
    request,
    "GET",
    `/api/v1/bff/student/runs/${run.run_id}/rounds/1/cockpit`,
    studentToken
  );
  expect(publishedCockpit.status).toBe(200);
  expect(publishedCockpit.data?.published_result.redacted_result).toBeDefined();

  await page.reload();
  await signInStudentPage(page);
  await expect(bffSection.getByText("排名（服务端投影）")).toBeVisible();
  await expect(bffSection.getByText("结果发布后显示可见反馈。")).toHaveCount(0);
});
