import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { ApiEnvelope, AuthSession, GSIReceipt } from "@simwar/shared-contracts";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const tenantId = "tenant_demo";

async function api<T>(
  request: APIRequestContext,
  path: string,
  options: { body?: unknown; method?: "GET" | "POST" | "PUT"; token?: string } = {}
): Promise<T> {
  const response = await request.fetch(`${apiBaseUrl}${path}`, {
    data: options.body,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": tenantId,
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {})
    },
    method: options.method ?? (options.body === undefined ? "GET" : "POST")
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  expect(response.status(), `${path}: ${JSON.stringify(envelope)}`).toBeGreaterThanOrEqual(200);
  expect(response.status(), `${path}: ${JSON.stringify(envelope)}`).toBeLessThan(300);
  return envelope.data;
}

async function loginApi(
  request: APIRequestContext,
  username: string,
  password = username
): Promise<string> {
  const session = await api<AuthSession>(request, "/api/v1/auth/login", {
    body: { password, username },
    method: "POST"
  });
  return session.access_token;
}

async function signIn(page: Page, label: "教师登录" | "学员登录" | "管理员登录", username: string) {
  await page.getByLabel("tenant").fill(tenantId);
  await page.getByLabel("username").fill(username);
  await page.getByLabel("password").fill(username);
  await page.getByRole("button", { name: label }).click();
  if (label === "教师登录") {
    await expect(
      page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
    ).toContainText("signed in");
  } else {
    await expect(page.getByText("signed in").first()).toBeVisible();
  }
}

async function publishRoundOne(
  request: APIRequestContext,
  teacherToken: string,
  studentToken: string,
  runId: string
): Promise<void> {
  await api(request, `/api/v1/runs/${runId}/rounds/1/start`, {
    method: "POST",
    token: teacherToken
  });
  await api(request, `/api/v1/runs/${runId}/rounds/1/decisions`, {
    body: {
      decision_payload: {
        capacity_plan: "expand",
        cash_buffer_target: 0.16,
        marketing_budget: 180000,
        pricing: { base_price: 12800 },
        service_quality_budget: 160000,
        strategy_statement: "complete the first round before comparing the next one"
      },
      team_id: "team_alpha"
    },
    method: "POST",
    token: studentToken
  });
  await api(request, `/api/v1/runs/${runId}/rounds/1/lock`, {
    method: "POST",
    token: teacherToken
  });
  await api(request, `/api/v1/runs/${runId}/rounds/1/settle`, {
    method: "POST",
    token: teacherToken
  });
  await api(request, `/api/v1/runs/${runId}/rounds/1/publish`, {
    method: "POST",
    token: teacherToken
  });
}

async function captureResponsiveEvidence(page: Page, role: string): Promise<void> {
  for (const width of [390, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: `tmp/playwright/gsi-xr-${role}-${width}.png`,
      fullPage: true
    });
  }
}

function candidateRequest(runId: string, roundId: string, key: string, influence: number) {
  return {
    discriminator: "gsi_stakeholder_shadow_request",
    binding: {
      tenant_id: tenantId,
      course_id: "course_demo",
      run_id: runId,
      round_id: roundId,
      team_id: "team_alpha",
      scenario_package_id: "scenario_eldercare_demo",
      scenario_version: "1.0.0",
      parameter_set_id: "param_toy_approved_1",
      parameter_set_version: "1.0.0",
      model_version_id: "gsi-stakeholder-resolver-v1",
      model_version: "1.0.0",
      model_artifact_id: "artifact:gsi-stakeholder-resolver-v1:1.0.0",
      model_artifact_version: "1.0.0"
    },
    plane_mode: "OFF",
    publication_status: "PUBLISHED",
    proposals: [
      {
        proposal_id: `${key}_customer`,
        stakeholder_type: "customer",
        intent: "protect_demand",
        priority: 0.8,
        influence,
        summary: "Customers value predictable service."
      }
    ],
    idempotency_key: key
  };
}

test.afterEach(() => {
  cleanupPlaywrightStore();
});

test("GSI-XR role journey resolves an explicit pair through the real BFF", async ({
  page,
  request
}) => {
  const teacherToken = await loginApi(request, "teacher", "teacher");
  const studentToken = await loginApi(request, "student", "student");
  const created = await api<{ run: { run_id: string }; round: { round_id: string } }>(
    request,
    "/api/v1/courses/course_demo/runs",
    { method: "POST", token: teacherToken }
  );
  const roundOneId = created.round.round_id;

  await publishRoundOne(request, teacherToken, studentToken, created.run.run_id);
  const continued = await api<{ round: { round_id: string; round_no: number } }>(
    request,
    `/api/v1/runs/${created.run.run_id}/rounds/1/continue`,
    { method: "POST", token: teacherToken }
  );
  expect(continued.round.round_no).toBe(2);
  const roundTwoId = continued.round.round_id;
  await api(request, "/api/v1/bff/teacher/role-workflows/assignments", {
    body: {
      course_id: "course_demo",
      role_key: "CEO",
      run_id: created.run.run_id,
      team_id: "team_alpha",
      user_id: "usr_student"
    },
    method: "PUT",
    token: teacherToken
  });

  await api<GSIReceipt>(request, "/api/v1/bff/teacher/gsi/candidates", {
    body: candidateRequest(created.run.run_id, roundOneId, "browser_pair_from", 0.2),
    method: "POST",
    token: teacherToken
  });
  await api<GSIReceipt>(request, "/api/v1/bff/teacher/gsi/candidates", {
    body: candidateRequest(created.run.run_id, roundTwoId, "browser_pair_to", 0.8),
    method: "POST",
    token: teacherToken
  });

  const gsiRequests: string[] = [];
  page.on("request", (outgoing) => {
    if (outgoing.url().includes("/api/v1/bff/") && outgoing.url().includes("/gsi/")) {
      gsiRequests.push(outgoing.url());
    }
  });

  await page.goto(teacherBaseUrl);
  await signIn(page, "教师登录", "teacher");
  await page.getByRole("button", { name: "开启回合" }).click();
  await expect(page.getByRole("button", { name: "锁定回合" })).toBeVisible();
  await page.getByLabel("角色流程队伍").selectOption("team_alpha");
  const teacherPanel = page.getByRole("region", { name: "GSI-XR cross-round workspace" });
  await expect(teacherPanel).toBeVisible();
  await expect(teacherPanel.getByLabel("GSI from round")).toBeEnabled();
  await teacherPanel.getByLabel("GSI from round").selectOption(roundOneId);
  await teacherPanel.getByLabel("GSI to round").selectOption(roundTwoId);
  await teacherPanel.getByRole("button", { name: "读取回合变化" }).click();
  await expect(teacherPanel.getByText("INCREASED")).toBeVisible();
  await expect(teacherPanel).toContainText("Round 1 ↔ Round 2");
  await expect(teacherPanel).toContainText("CONTEXT_UNAVAILABLE");
  await captureResponsiveEvidence(page, "teacher");

  await page.goto(
    `${studentBaseUrl}/?gsi_course_id=course_demo&gsi_run_id=${encodeURIComponent(
      created.run.run_id
    )}&gsi_team_id=team_alpha&gsi_activity_id=activity_gsi&gsi_role_key=CEO`
  );
  await signIn(page, "学员登录", "student");
  const studentPanel = page.getByRole("region", {
    name: "Student cross-round stakeholder reflection"
  });
  await expect(studentPanel).toBeVisible();
  await expect(studentPanel.getByLabel("Student from round")).toBeEnabled();
  await studentPanel.getByLabel("Student from round").selectOption(roundOneId);
  await studentPanel.getByLabel("Student to round").selectOption(roundTwoId);
  await studentPanel.getByRole("button", { name: "查看变化" }).click();
  await expect(studentPanel.getByText("INCREASED")).toBeVisible();
  await expect(studentPanel.getByText("哪些压力变了，它会怎样影响你的下一步判断？")).toBeVisible();
  await expect(studentPanel.getByLabel("GSI candidate ID")).toHaveCount(0);
  await expect(studentPanel).not.toContainText("candidate_digest");
  await expect(studentPanel).not.toContainText("comparison_digest");
  await expect(studentPanel).not.toContainText("signal_key");
  await expect(studentPanel).not.toContainText("Customers value predictable service");
  await captureResponsiveEvidence(page, "student");

  await page.goto(adminBaseUrl);
  await signIn(page, "管理员登录", "admin");
  const adminPanel = page.getByRole("region", { name: "GSI-XR admin audit workspace" });
  await expect(adminPanel).toBeVisible();
  await adminPanel.getByLabel("GSI admin course context").fill("course_demo");
  await adminPanel.getByLabel("GSI admin run context").fill(created.run.run_id);
  await adminPanel.getByLabel("GSI admin team context").fill("team_alpha");
  await adminPanel.getByRole("button", { name: "加载可比较回合" }).click();
  await expect(adminPanel.getByLabel("GSI admin from round")).toBeEnabled();
  await adminPanel.getByLabel("GSI admin from round").selectOption(roundOneId);
  await adminPanel.getByLabel("GSI admin to round").selectOption(roundTwoId);
  await adminPanel.getByRole("button", { name: "读取审计变化" }).click();
  await expect(adminPanel.getByText("上升")).toBeVisible();
  await expect(adminPanel).toContainText("context_binding");
  await expect(adminPanel).toContainText("false");
  await captureResponsiveEvidence(page, "admin");

  expect(gsiRequests.filter((url) => url.includes("/teacher/gsi/")).length).toBeGreaterThan(0);
  expect(gsiRequests.filter((url) => url.includes("/student/gsi/")).length).toBeGreaterThan(0);
  expect(gsiRequests.filter((url) => url.includes("/admin/gsi/")).length).toBeGreaterThan(0);
});
