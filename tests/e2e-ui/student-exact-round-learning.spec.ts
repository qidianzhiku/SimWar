import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type {
  AuthSession,
  P0DemoState,
  TeacherRoleWorkflowWorkspaceDTO,
  RoundContinuationResult,
  StudentLearningReportPublicListDto,
  W3OfficialConsequenceResponse
} from "@simwar/shared-contracts";
import { cleanupPlaywrightStore } from "./store-isolation";

const api = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const student = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const scope = {
  tenant_id: "tenant_demo",
  course_id: "course_demo",
  run_id: "run_w3_browser",
  team_id: "team_alpha",
  round_id: "round_w3_browser_1",
  round_no: "1",
  role_key: "CEO",
  activity_id: "activity_consequence"
};
const entry = new URLSearchParams({ w3: "true", ...scope });
let r2: string;
let user: string;
async function requestData<T>(
  request: APIRequestContext,
  path: string,
  token?: string,
  method = "GET",
  data?: unknown
): Promise<T> {
  const response = await request.fetch(api + path, {
    method,
    data,
    headers: {
      "x-tenant-id": scope.tenant_id,
      ...(token ? { authorization: `Bearer ${token}` } : {})
    }
  });
  expect(response.status(), path).toBeGreaterThanOrEqual(200);
  expect(response.status(), path).toBeLessThan(300);
  return ((await response.json()) as { data: T }).data;
}
test.beforeAll(async ({ request }) => {
  const teacher = await requestData<AuthSession>(request, "/api/v1/auth/login", undefined, "POST", {
    username: "teacher",
    password: "teacher"
  });
  const learner = await requestData<AuthSession>(request, "/api/v1/auth/login", undefined, "POST", {
    username: "student",
    password: "student"
  });
  user = learner.user.user_id;
  const workspacePath = `/api/v1/bff/teacher/role-workflows?${new URLSearchParams({ round_id: scope.round_id, run_id: scope.run_id, team_id: scope.team_id })}`;
  const workspace = await requestData<TeacherRoleWorkflowWorkspaceDTO>(
    request,
    workspacePath,
    teacher.access_token
  );
  expect(workspace.tenant_id).toBe(scope.tenant_id);
  expect(workspace.run_id).toBe(scope.run_id);
  expect(workspace.round_id).toBe(scope.round_id);
  expect(workspace.team_id).toBe(scope.team_id);
  const exactAssignment = (a: TeacherRoleWorkflowWorkspaceDTO["assignments"][number]) =>
    a.status === "active" &&
    a.tenant_id === scope.tenant_id &&
    a.course_id === scope.course_id &&
    a.run_id === scope.run_id &&
    a.team_id === scope.team_id &&
    a.user_id === user &&
    a.role_key === scope.role_key;
  if (!workspace.assignments.some(exactAssignment)) {
    expect(
      workspace.assignments.filter((a) => a.user_id === user || a.role_key === scope.role_key)
    ).toEqual([]);
    await requestData(
      request,
      "/api/v1/bff/teacher/role-workflows/assignments",
      teacher.access_token,
      "PUT",
      {
        course_id: scope.course_id,
        run_id: scope.run_id,
        team_id: scope.team_id,
        role_key: scope.role_key,
        user_id: user
      }
    );
    const assigned = await requestData<TeacherRoleWorkflowWorkspaceDTO>(
      request,
      workspacePath,
      teacher.access_token
    );
    expect(assigned.assignments.filter(exactAssignment)).toHaveLength(1);
  }
  let before = await requestData<P0DemoState>(request, "/api/v1/demo-state", teacher.access_token);
  expect(before.rounds.find((r) => r.round_id === scope.round_id)).toMatchObject({
    tenant_id: scope.tenant_id,
    run_id: scope.run_id,
    round_no: 1,
    status: "published"
  });
  const successors = before.rounds.filter(
    (r) => r.tenant_id === scope.tenant_id && r.run_id === scope.run_id && r.round_no === 2
  );
  expect(successors.length).toBeLessThanOrEqual(1);
  if (successors.length === 0) {
    const created = await requestData<RoundContinuationResult>(
      request,
      `/api/v1/runs/${scope.run_id}/rounds/1/continue`,
      teacher.access_token,
      "POST"
    );
    expect(created.receipt).toMatchObject({
      outcome: "created",
      tenant_id: scope.tenant_id,
      run_id: scope.run_id,
      round_no: 2,
      predecessor_round_id: scope.round_id
    });
  }
  before = await requestData<P0DemoState>(request, "/api/v1/demo-state", teacher.access_token);
  const second = before.rounds.filter(
    (r) => r.tenant_id === scope.tenant_id && r.run_id === scope.run_id && r.round_no === 2
  );
  expect(second).toHaveLength(1);
  expect(["draft", "open"]).toContain(second[0]!.status);
  if (second[0]!.status === "draft")
    await requestData(
      request,
      `/api/v1/runs/${scope.run_id}/rounds/2/start`,
      teacher.access_token,
      "POST"
    );
  const state = await requestData<P0DemoState>(request, "/api/v1/demo-state", learner.access_token);
  const round = state.rounds.find((r) => r.run_id === scope.run_id && r.round_no === 2);
  expect(round?.status).toBe("open");
  expect(round?.round_id).toBe(second[0]!.round_id);
  expect(state.rounds.find((r) => r.round_id === scope.round_id)?.status).toBe("published");
  r2 = round!.round_id;
});
test.afterAll(() => cleanupPlaywrightStore());

async function signIn(page: Page) {
  const authenticated = page.waitForResponse(
    (r) => r.url().endsWith("/api/v1/auth/login") && r.request().method() === "POST"
  );
  await page.getByLabel("tenant").fill(scope.tenant_id);
  await page.getByLabel("username").fill("student");
  await page.getByLabel("password").fill("student");
  await page.getByRole("button", { name: "学员登录" }).click();
  expect((await authenticated).status()).toBe(200);
}
async function preserveR2Recovery(page: Page) {
  // Only non-secret browser navigation state is seeded. Business responses and
  // the DOM are never mocked, substituted or injected.
  await page.addInitScript(
    ({ id, uid }) =>
      window.sessionStorage.setItem(
        "simwar.reauth-context.v1",
        JSON.stringify({
          schema_version: 1,
          tenant_id: "tenant_demo",
          course_id: "course_demo",
          run_id: "run_w3_browser",
          team_id: "team_alpha",
          round_id: id,
          round_no: 2,
          user_id: uid,
          role: "CEO",
          route: "/student",
          view: "student-cockpit"
        })
      ),
    { id: r2, uid: user }
  );
}

test("exact published R1 overrides saved unpublished R2 across cockpit, W3 and DDT", async ({
  page
}) => {
  await preserveR2Recovery(page);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "GET" && request.url().startsWith(api)) requests.push(request.url());
  });
  await page.goto(`${student}?${entry}`);
  const cockpit = page.waitForResponse((r) =>
    r.url().endsWith(`/runs/${scope.run_id}/rounds/1/cockpit`)
  );
  const spine = page.waitForResponse((r) =>
    r.url().includes("/student/decision-thread/evidence-spine")
  );
  const consequence = page.waitForResponse((r) => r.url().includes("/student/w3/consequence"));
  await signIn(page);
  expect((await cockpit).status()).toBe(200);
  expect((await spine).status()).toBe(200);
  const actualConsequence = await consequence;
  expect(actualConsequence.status()).toBe(200);
  const actual = ((await actualConsequence.json()) as { data: W3OfficialConsequenceResponse }).data;
  expect(actual.visibility).toBe("student_safe");
  expect(actual.record.context).toEqual({ ...scope, round_no: 1 });
  expect(actual.record.source.round_ref.resource_id).toBe(scope.round_id);
  await expect(page.getByTestId("student-p2b-result")).toBeVisible();
  await expect(
    page.locator(".w3-consequence-panel").getByText("PUBLISHED", { exact: true })
  ).toBeVisible();
  expect(requests.filter((u) => /\/cockpit$/.test(u))).toEqual([
    `${api}/api/v1/bff/student/runs/${scope.run_id}/rounds/1/cockpit`
  ]);
  for (const url of requests.filter((u) => u.includes("/student/decision-thread/evidence-spine"))) {
    const q = new URL(url).searchParams;
    expect([...q.keys()].sort()).toEqual([
      "activity_id",
      "course_id",
      "role_key",
      "round_id",
      "round_no",
      "run_id",
      "team_id"
    ]);
    expect(q.get("round_id")).toBe(scope.round_id);
    expect(q.get("round_no")).toBe("1");
    expect(q.get("role_key")).toBe("CEO");
  }
  await page
    .getByLabel("我原本的判断")
    .fill("Read the exact published round, not the saved next round.");
  const reflectionText = "Reflection on the authenticated exact published round one.";
  await page.locator(".w3-consequence-panel textarea").fill(reflectionText);
  const saved = page.waitForResponse(
    (r) => r.url().endsWith("/student/w3/reflection") && r.request().method() === "POST"
  );
  await page.locator(".w3-consequence-panel").getByRole("button", { name: "提交反思" }).click();
  const receipt = await saved;
  expect(receipt.status()).toBe(201);
  const projection = ((await receipt.json()) as { data: W3OfficialConsequenceResponse }).data;
  expect(projection.record.context).toEqual({ ...scope, round_no: 1 });
  expect(projection.record.reflection).toMatchObject({
    response: reflectionText,
    ai_used: false,
    advisory_only: true,
    status: "SUBMITTED"
  });
  await expect(
    page.locator(".w3-consequence-panel").getByText("反思已记录，等待教师确认学习证据")
  ).toBeVisible();
  const reports = page.waitForResponse((r) => r.url().endsWith("/student/learning-reports"));
  await page.reload();
  await signIn(page);
  await expect(page.getByTestId("student-p2b-result")).toBeVisible();
  const reportResponse = await reports;
  expect(reportResponse.status()).toBe(200);
  const reportData = ((await reportResponse.json()) as { data: StudentLearningReportPublicListDto })
    .data;
  expect(reportData.scope).toBe("student_team");
  if (
    reportData.reports.filter(
      (r) => r.context.round_id === scope.round_id && r.context.role_key === scope.role_key
    ).length === 0
  )
    await expect(page.locator(".d4-report-panel").getByText("暂无可用报告")).toBeVisible();
  await expect(page.locator(".d4-report-card").filter({ hasText: r2 })).toHaveCount(0);
});

test("invalid exact URL cannot be repaired using saved R2 and valid navigation recovers", async ({
  page
}) => {
  await preserveR2Recovery(page);
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "GET") requests.push(r.url());
  });
  const invalid = new URLSearchParams(entry);
  invalid.delete("round_id");
  await page.goto(`${student}?${invalid}`);
  await signIn(page);
  await expect(page.getByText("EXACT_CONTEXT_INVALID", { exact: false }).first()).toBeVisible();
  expect(
    requests.some((u) => u.endsWith("/cockpit") || u.includes("/student/w3/consequence"))
  ).toBe(false);
  await expect(page.getByTestId("student-p2b-result")).toHaveCount(0);
  await expect(page.locator(".d4-report-card")).toHaveCount(0);
  await page.goto(`${student}?${entry}`);
  await signIn(page);
  await expect(page.getByTestId("student-p2b-result")).toBeVisible();
});

test("unpublished R2 remains waiting and wrong role remains denied", async ({ page }) => {
  const next = new URLSearchParams({ w3: "true", ...scope, round_id: r2, round_no: "2" });
  await page.goto(`${student}?${next}`);
  await signIn(page);
  await expect(page.getByTestId("student-p2b-blocked")).toBeVisible();
  await expect(page.getByTestId("student-p2b-result")).toHaveCount(0);
  await expect(page.getByTestId("student-learning-report-blocked")).toBeVisible();
  const wrong = new URLSearchParams({ w3: "true", ...scope, role_key: "CFO" });
  await page.goto(`${student}?${wrong}`);
  await signIn(page);
  await expect(page.getByText("CONTEXT_UNAUTHORIZED", { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId("student-p2b-result")).toHaveCount(0);
  await expect(page.locator(".d4-report-card")).toHaveCount(0);
  for (const denied of [{ team_id: "team_beta" }, { tenant_id: "foreign_tenant" }]) {
    const deniedEntry = new URLSearchParams({ w3: "true", ...scope, ...denied });
    await page.goto(`${student}?${deniedEntry}`);
    await signIn(page);
    await expect(page.getByText("CONTEXT_UNAUTHORIZED", { exact: false }).first()).toBeVisible();
    await expect(page.getByTestId("student-p2b-result")).toHaveCount(0);
    await expect(page.locator(".d4-report-card")).toHaveCount(0);
  }
});
