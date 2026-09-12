import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { ApiEnvelope, AuthSession, Round, Run } from "@simwar/shared-contracts";
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
  runId: string,
  roundId: string
): Promise<void> {
  await api<Round>(request, `/api/v1/runs/${runId}/rounds/1/start`, {
    method: "POST",
    token: teacherToken
  });

  const roleParticipants = [
    {
      password: "student",
      payload: { strategy_statement: "complete the first round before continuing the same Run" },
      roleKey: "CEO",
      userId: "usr_student",
      username: "student"
    },
    {
      password: "default_cfo",
      payload: { cash_buffer_target: 0.16, service_quality_budget: 160000 },
      roleKey: "CFO",
      userId: "usr_default_cfo",
      username: "default_cfo"
    },
    {
      password: "default_cmo",
      payload: { marketing_budget: 180000, pricing: { base_price: 12800 } },
      roleKey: "CMO",
      userId: "usr_default_cmo",
      username: "default_cmo"
    },
    {
      password: "default_coo",
      payload: { capacity_plan: "expand" },
      roleKey: "COO",
      userId: "usr_default_coo",
      username: "default_coo"
    }
  ] as const;

  for (const participant of roleParticipants) {
    await api(request, "/api/v1/bff/teacher/role-workflows/assignments", {
      body: {
        course_id: "course_demo",
        role_key: participant.roleKey,
        run_id: runId,
        team_id: "team_alpha",
        user_id: participant.userId
      },
      method: "PUT",
      token: teacherToken
    });
    const participantToken = await loginApi(request, participant.username, participant.password);
    const section = await api<{ version: number }>(
      request,
      "/api/v1/bff/student/role-workspace/section",
      {
        body: {
          expected_version: 0,
          payload: participant.payload,
          round_id: roundId,
          run_id: runId,
          team_id: "team_alpha"
        },
        method: "PUT",
        token: participantToken
      }
    );
    await api<unknown>(request, "/api/v1/bff/student/role-workspace/ready", {
      body: {
        expected_version: section.version,
        round_id: roundId,
        run_id: runId,
        team_id: "team_alpha"
      },
      method: "POST",
      token: participantToken
    });
  }

  const ceoToken = await loginApi(request, "student", "student");
  const merge = await api<{ merge_commit_id: string }>(
    request,
    "/api/v1/bff/student/role-workspace/merge",
    {
      body: { round_id: roundId, run_id: runId, team_id: "team_alpha" },
      method: "POST",
      token: ceoToken
    }
  );
  await api<unknown>(request, "/api/v1/bff/student/role-workspace/confirm", {
    body: {
      merge_commit_id: merge.merge_commit_id,
      round_id: roundId,
      run_id: runId,
      team_id: "team_alpha"
    },
    method: "POST",
    token: ceoToken
  });
  await api<Round>(request, `/api/v1/runs/${runId}/rounds/1/lock`, {
    method: "POST",
    token: teacherToken
  });
  await api(request, `/api/v1/runs/${runId}/rounds/1/settle`, {
    method: "POST",
    token: teacherToken
  });
  await api<Round>(request, `/api/v1/runs/${runId}/rounds/1/publish`, {
    method: "POST",
    token: teacherToken
  });
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

test("GSI-O3B reaches exact cross-round compare through Teacher selection and Student handoff", async ({
  page,
  request
}) => {
  const teacherToken = await loginApi(request, "teacher", "teacher");
  const created = await api<{ run: Run; round: Round }>(
    request,
    "/api/v1/courses/course_demo/runs",
    {
      method: "POST",
      token: teacherToken
    }
  );
  const run = created.run;
  await publishRoundOne(request, teacherToken, run.run_id, created.round.round_id);

  await page.goto(teacherBaseUrl);
  await signIn(page, "教师登录", "teacher");
  await page.getByLabel("run selector").selectOption(run.run_id);
  await expect(page.getByText("Historical Run · read-only")).toBeVisible();

  const teacherCandidatePanel = page.getByRole("region", {
    name: "Governed Stakeholder Intelligence"
  });
  await expect(teacherCandidatePanel).toBeVisible();
  await teacherCandidatePanel.getByRole("button", { name: "冻结受控利益相关方候选" }).click();
  await expect(teacherCandidatePanel.getByText("候选已冻结并可供角色投影")).toBeVisible();
  const fromCandidateId = await teacherCandidatePanel.locator("code").first().textContent();
  expect(fromCandidateId).toMatch(/^gsi_candidate_[a-f0-9]{16}$/);

  await page.getByRole("button", { name: "创建下一回合" }).click();
  await expect(page.getByRole("status", { name: "教师操作通知" })).toContainText(
    "下一回合已创建并切换到新回合"
  );

  await expect(
    teacherCandidatePanel.getByRole("button", { name: "冻结受控利益相关方候选" })
  ).toBeVisible();
  await teacherCandidatePanel.getByRole("button", { name: "冻结受控利益相关方候选" }).click();
  await expect(teacherCandidatePanel.getByText("候选已冻结并可供角色投影")).toBeVisible();
  const toCandidateId = await teacherCandidatePanel.locator("code").first().textContent();
  expect(toCandidateId).toMatch(/^gsi_candidate_[a-f0-9]{16}$/);
  expect(toCandidateId).not.toBe(fromCandidateId);
  const teacherPanel = page.getByRole("region", { name: "Teacher GSI cross-round insight" });
  await expect(teacherPanel).toBeVisible();
  await teacherPanel.getByLabel("from candidate selector").selectOption(fromCandidateId!);
  await teacherPanel.getByLabel("to candidate selector").selectOption(toCandidateId!);
  await teacherPanel.getByLabel("activity selector").selectOption("activity_gsi_o3");
  await teacherPanel.getByLabel("role selector").selectOption("CEO");
  await teacherPanel.getByRole("button", { name: "查看精确跨轮比较" }).click();
  await expect(teacherPanel).toHaveAttribute("data-state", /^(SUCCESS|CONTEXT_UNAVAILABLE)$/);
  await expect(teacherPanel.getByTestId("gsi-o3-teacher-summary")).toBeVisible();
  await expect(teacherPanel.getByTestId("gsi-o3-movements")).toContainText(
    "customer / protect_demand"
  );

  const studentHandoff = teacherPanel.getByTestId("gsi-o3-student-handoff").getByRole("link");
  await expect(studentHandoff).toBeVisible();
  const handoffHref = await studentHandoff.getAttribute("href");
  expect(handoffHref).toContain(`gsiFromCandidateId=${encodeURIComponent(fromCandidateId!)}`);
  expect(handoffHref).toContain(`gsiToCandidateId=${encodeURIComponent(toCandidateId!)}`);
  expect(handoffHref).toContain("gsiActivityId=activity_gsi_o3");
  expect(handoffHref).toContain("gsiRoleKey=CEO");
  await studentHandoff.click();
  await signIn(page, "学员登录", "student");
  const studentPanel = page.getByRole("region", { name: "Student GSI cross-round insight" });
  await expect(studentPanel).toBeVisible();
  await expect(studentPanel).toHaveAttribute("data-state", /^(SUCCESS|CONTEXT_UNAVAILABLE)$/);
  await expect(studentPanel.getByTestId("gsi-o3-student-summary")).toBeVisible();
  await expect(studentPanel.getByTestId("gsi-o3-movements")).toContainText(
    "customer / protect_demand"
  );
  await expect(studentPanel).not.toContainText(fromCandidateId!);
  await expect(studentPanel).not.toContainText(toCandidateId!);
  await expect(studentPanel).not.toContainText("comparison_digest");
});
