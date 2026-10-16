import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type {
  ApiEnvelope,
  AuthSession,
  RoleDecisionSection,
  Round,
  Run,
  StudentBffCockpitDTO,
  StudentRoleAssignment,
  StudentRoleWorkflowMergeDTO,
  TeamConfirmation
} from "../../packages/shared-contracts/src";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;

type ExactStudentContext = {
  readonly activityId: string;
  readonly courseId: string;
  readonly roleKey: string;
  readonly roundId: string;
  readonly roundNo: number;
  readonly runId: string;
  readonly teamId: string;
  readonly tenantId: string;
};

function studentExactContextPath(context: ExactStudentContext): string {
  const query = new URLSearchParams({
    w3: "true",
    tenant_id: context.tenantId,
    course_id: context.courseId,
    run_id: context.runId,
    team_id: context.teamId,
    round_id: context.roundId,
    round_no: String(context.roundNo),
    role_key: context.roleKey,
    activity_id: context.activityId
  });
  return `/?${query.toString()}`;
}

test.afterAll(() => {
  cleanupPlaywrightStore();
});

async function apiRequest<TData>(
  request: APIRequestContext,
  method: "GET" | "POST" | "PUT",
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
  username: "student" | "teacher" | "default_cfo" | "default_cmo" | "default_coo",
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
): Promise<{ run: Run; round: Round }> {
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

  const studentContext: ExactStudentContext = {
    activityId: "activity_consequence",
    courseId: run.data!.run.course_id,
    roleKey: "CEO",
    roundId: started.data!.round_id,
    roundNo: started.data!.round_no,
    runId: run.data!.run.run_id,
    teamId: "team_alpha",
    tenantId: "tenant_demo"
  };
  const roleScope = {
    run_id: studentContext.runId,
    round_id: studentContext.roundId,
    team_id: studentContext.teamId
  };
  const contributors = [
    {
      roleKey: "CEO",
      userId: "usr_student",
      token: studentToken,
      payload: { strategy_statement: "Browser publication gate safety journey" }
    },
    {
      roleKey: "CFO",
      userId: "usr_default_cfo",
      token: await login(request, "default_cfo", "default_cfo"),
      payload: { cash_buffer_target: 0.16, service_quality_budget: 160000 }
    },
    {
      roleKey: "CMO",
      userId: "usr_default_cmo",
      token: await login(request, "default_cmo", "default_cmo"),
      payload: { marketing_budget: 180000, pricing: { base_price: 12800 } }
    },
    {
      roleKey: "COO",
      userId: "usr_default_coo",
      token: await login(request, "default_coo", "default_coo"),
      payload: { capacity_plan: "expand" }
    }
  ] as const;
  for (const contributor of contributors) {
    const assignment = await apiRequest<StudentRoleAssignment>(
      request,
      "PUT",
      "/api/v1/bff/teacher/role-workflows/assignments",
      teacherToken,
      {
        course_id: studentContext.courseId,
        role_key: contributor.roleKey,
        run_id: studentContext.runId,
        team_id: studentContext.teamId,
        user_id: contributor.userId
      }
    );
    expect(assignment.status).toBe(201);
    expect(assignment.data).toMatchObject({
      tenant_id: studentContext.tenantId,
      course_id: studentContext.courseId,
      run_id: studentContext.runId,
      team_id: studentContext.teamId,
      user_id: contributor.userId,
      role_key: contributor.roleKey,
      status: "active"
    });
    const saved = await apiRequest<RoleDecisionSection>(
      request,
      "PUT",
      "/api/v1/bff/student/role-workspace/section",
      contributor.token,
      { ...roleScope, expected_version: 0, payload: contributor.payload }
    );
    expect(saved.status).toBe(200);
    expect(saved.data).toMatchObject({
      ...roleScope,
      tenant_id: studentContext.tenantId,
      assignment_id: assignment.data!.assignment_id,
      role_key: contributor.roleKey,
      submitted_by: contributor.userId,
      payload: contributor.payload,
      status: "draft",
      version: 1
    });
    const ready = await apiRequest<RoleDecisionSection>(
      request,
      "POST",
      "/api/v1/bff/student/role-workspace/ready",
      contributor.token,
      { ...roleScope, expected_version: saved.data!.version }
    );
    expect(ready.status).toBe(200);
    expect(ready.data).toMatchObject({
      ...roleScope,
      tenant_id: studentContext.tenantId,
      assignment_id: assignment.data!.assignment_id,
      role_key: contributor.roleKey,
      submitted_by: contributor.userId,
      payload: contributor.payload,
      status: "ready",
      version: saved.data!.version + 1
    });
    // Ready appends a new section generation; the draft remains immutable.
    expect(ready.data!.section_id).toEqual(expect.any(String));
    expect(ready.data!.section_id).not.toBe("");
    expect(ready.data!.section_id).not.toBe(saved.data!.section_id);
  }
  const merge = await apiRequest<StudentRoleWorkflowMergeDTO>(
    request,
    "POST",
    "/api/v1/bff/student/role-workspace/merge",
    studentToken,
    roleScope
  );
  expect(merge.status).toBe(201);
  expect(merge.data!.status).toBe("validated");
  expect(merge.data!.merge_commit_id).toBeTruthy();
  // Native confirm atomically persists the team confirmation and submitted
  // canonical Decision; legacy direct submission remains forbidden.
  const confirmation = await apiRequest<TeamConfirmation>(
    request,
    "POST",
    "/api/v1/bff/student/role-workspace/confirm",
    studentToken,
    { ...roleScope, merge_commit_id: merge.data!.merge_commit_id }
  );
  expect(confirmation.status).toBe(201);
  expect(confirmation.data).toMatchObject({
    ...roleScope,
    tenant_id: studentContext.tenantId,
    merge_commit_id: merge.data!.merge_commit_id,
    confirmed_by: "usr_student",
    status: "confirmed"
  });
  expect(confirmation.data!.team_confirmation_id).toBeTruthy();

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
  return { round: started.data!, run: run.data!.run };
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
  const prepared = await prepareSettledRun(request, teacherToken, studentToken);
  const run = prepared.run;
  const studentContext: ExactStudentContext = {
    activityId: "activity_consequence",
    courseId: run.course_id,
    roleKey: "CEO",
    roundId: prepared.round.round_id,
    roundNo: prepared.round.round_no,
    runId: run.run_id,
    teamId: "team_alpha",
    tenantId: "tenant_demo"
  };

  const blockedDirect = await apiRequest<unknown>(
    request,
    "GET",
    `/api/v1/runs/${run.run_id}/rounds/1/results`,
    studentToken
  );
  expect(blockedDirect.status).toBe(409);
  expect(blockedDirect.error?.code).toBe("RESULT-409-001");

  await page.goto(studentExactContextPath(studentContext));
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
