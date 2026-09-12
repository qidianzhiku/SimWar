import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { ApiEnvelope, AuthSession, GSIReceipt } from "@simwar/shared-contracts";
import { cleanupPlaywrightStore } from "./store-isolation";
import {
  M2P5_ROUND_1_ID,
  M2P5_ROUND_2_ID,
  M2P5_RUN_ID
} from "./m2-p5-decision-learning-crossround-fixture";

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

function gsiCandidateRequest(roundId: string, idempotencyKey: string, influence: number) {
  return {
    discriminator: "gsi_stakeholder_shadow_request",
    binding: {
      tenant_id: tenantId,
      course_id: "course_demo",
      run_id: M2P5_RUN_ID,
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
        proposal_id: `${idempotencyKey}_customer`,
        stakeholder_type: "customer",
        intent: "protect_demand",
        priority: 0.8,
        influence,
        summary: "O3 browser candidate"
      }
    ],
    idempotency_key: idempotencyKey
  };
}

test.afterEach(() => {
  cleanupPlaywrightStore();
});

test("GSI product journey uses real BFF across Teacher, Student and Admin", async ({
  page,
  request
}) => {
  const teacherToken = await loginApi(request, "teacher", "teacher");
  await api(request, "/api/v1/courses/course_demo/runs", {
    method: "POST",
    token: teacherToken
  });
  const state = await api<{
    runs: Array<{ run_id: string; course_id: string }>;
    rounds: Array<{ round_id: string; run_id: string; round_no: number }>;
  }>(request, "/api/v1/demo-state", { token: teacherToken });
  const run = state.runs.at(-1)!;
  const round = state.rounds.find((candidate) => candidate.run_id === run.run_id)!;
  await api(request, "/api/v1/bff/teacher/role-workflows/assignments", {
    body: {
      course_id: "course_demo",
      role_key: "CEO",
      run_id: run.run_id,
      team_id: "team_alpha",
      user_id: "usr_student"
    },
    method: "PUT",
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
  const teacherPanel = page.getByRole("region", { name: "Governed Stakeholder Intelligence" });
  await expect(teacherPanel).toBeVisible();
  await teacherPanel.getByRole("button", { name: "冻结受控利益相关方候选" }).click();
  await expect(teacherPanel.getByText("候选已冻结并可供角色投影")).toBeVisible();
  const candidateId = await teacherPanel.locator("code").first().textContent();
  expect(candidateId).toMatch(/^gsi_candidate_[a-f0-9]{16}$/);

  await page.goto(`${studentBaseUrl}/?gsiCandidateId=${encodeURIComponent(candidateId!)}`);
  await signIn(page, "学员登录", "student");
  const studentPanel = page.getByRole("region", {
    name: "Student governed stakeholder projection"
  });
  await expect(studentPanel).toBeVisible();
  await studentPanel.getByRole("button", { name: "查看我的学习投影" }).click();
  await expect(studentPanel.getByText("角色：CEO")).toBeVisible();
  await expect(studentPanel).not.toContainText("proposal_customer_1");
  await expect(studentPanel).not.toContainText("Customers value predictable service");

  await page.goto(adminBaseUrl);
  await signIn(page, "管理员登录", "admin");
  const adminPanel = page.getByRole("region", { name: "Governed stakeholder intelligence audit" });
  await expect(adminPanel).toBeVisible();
  await adminPanel.getByLabel("GSI audit candidate ID").fill(candidateId!);
  await adminPanel.getByRole("button", { name: "查询候选审计" }).click();
  await expect(adminPanel.getByText("候选审计摘要")).toBeVisible();
  await expect(adminPanel).toContainText("writes_official_truth");
  await expect(adminPanel).toContainText("false");
  expect(gsiRequests.filter((url) => url.includes("/teacher/gsi/")).length).toBeGreaterThan(0);
  expect(gsiRequests.filter((url) => url.includes("/student/gsi/")).length).toBeGreaterThan(0);
  expect(gsiRequests.filter((url) => url.includes("/admin/gsi/")).length).toBeGreaterThan(0);
  expect(round.round_no).toBe(1);
});

test("GSI-O3 exposes the existing cross-round compare BFF in Teacher and Student debriefs", async ({
  page,
  request
}) => {
  const teacherToken = await loginApi(request, "teacher", "teacher");
  const from = await api<GSIReceipt>(request, "/api/v1/bff/teacher/gsi/candidates", {
    body: gsiCandidateRequest(M2P5_ROUND_1_ID, "gsi_o3_browser_from", 0.25),
    method: "POST",
    token: teacherToken
  });
  const to = await api<GSIReceipt>(request, "/api/v1/bff/teacher/gsi/candidates", {
    body: gsiCandidateRequest(M2P5_ROUND_2_ID, "gsi_o3_browser_to", 0.75),
    method: "POST",
    token: teacherToken
  });
  const query = new URLSearchParams({
    gsiFromCandidateId: from.candidate_id,
    gsiToCandidateId: to.candidate_id,
    gsiActivityId: "activity_gsi_o3",
    gsiRoleKey: "CEO"
  }).toString();

  await page.goto(`${teacherBaseUrl}/?${query}#teacher-debrief`);
  await signIn(page, "教师登录", "teacher");
  const teacherPanel = page.getByRole("region", { name: "Teacher GSI cross-round insight" });
  await expect(teacherPanel).toBeVisible();
  await expect(teacherPanel).toHaveAttribute("data-state", /^(SUCCESS|CONTEXT_UNAVAILABLE)$/);
  await expect(teacherPanel.getByTestId("gsi-o3-teacher-summary")).toBeVisible();
  await expect(teacherPanel.getByTestId("gsi-o3-movements")).toContainText(
    "customer / protect_demand"
  );

  await page.goto(`${studentBaseUrl}/?${query}#student-debrief`);
  await signIn(page, "学员登录", "student");
  const studentPanel = page.getByRole("region", { name: "Student GSI cross-round insight" });
  await expect(studentPanel).toBeVisible();
  await expect(studentPanel).toHaveAttribute("data-state", /^(SUCCESS|CONTEXT_UNAVAILABLE)$/);
  await expect(studentPanel.getByTestId("gsi-o3-student-summary")).toBeVisible();
  await expect(studentPanel.getByTestId("gsi-o3-movements")).toContainText(
    "customer / protect_demand"
  );
  await expect(studentPanel).not.toContainText(from.candidate_id);
  await expect(studentPanel).not.toContainText(to.candidate_id);
  await expect(studentPanel).not.toContainText("comparison_digest");
});
