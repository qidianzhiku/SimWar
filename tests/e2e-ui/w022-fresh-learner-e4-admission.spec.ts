import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type {
  ApiEnvelope,
  AuthSession,
  Course,
  FreshLearnerAdmissionReadiness,
  Run,
  Team,
  User
} from "@simwar/shared-contracts";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const tenantId = "tenant_demo";

type TeamSlice = {
  team: Team;
  users: User[];
};

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
  password: string
): Promise<string> {
  const session = await api<AuthSession>(request, "/api/v1/auth/login", {
    body: { password, username }
  });
  return session.access_token;
}

async function signIn(page: Page, username: string): Promise<void> {
  await page.getByLabel("tenant").fill(tenantId);
  await page.getByLabel("username").fill(username);
  await page.getByLabel("password").fill(username);
  await page.getByRole("button", { name: "学员登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

async function signInTeacher(page: Page): Promise<void> {
  await page.getByLabel("tenant").fill(tenantId);
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

async function createFreshUser(
  request: APIRequestContext,
  adminToken: string,
  username: string
): Promise<User> {
  return api<User>(request, "/api/v1/admin/users", {
    body: {
      display_name: `W022 ${username}`,
      email: `${username}@w022.test`,
      password: username,
      roles: ["learner"],
      tenant_id: tenantId,
      username
    },
    token: adminToken
  });
}

async function createTeam(
  request: APIRequestContext,
  teacherToken: string,
  courseId: string,
  captain: User,
  name: string
): Promise<Team> {
  return api<Team>(request, `/api/v1/courses/${courseId}/teams`, {
    body: { captain_user_id: captain.user_id, name },
    token: teacherToken
  });
}

async function addMember(
  request: APIRequestContext,
  teacherToken: string,
  courseId: string,
  teamId: string,
  user: User,
  roleSlot: "CFO" | "CMO" | "COO"
): Promise<void> {
  await api<Team>(request, `/api/v1/courses/${courseId}/teams/${teamId}/members`, {
    body: { role_slot: roleSlot, user_id: user.user_id },
    token: teacherToken
  });
}

async function assignRole(
  request: APIRequestContext,
  teacherToken: string,
  courseId: string,
  runId: string,
  teamId: string,
  user: User,
  roleKey: "CEO" | "CFO" | "CMO" | "COO"
): Promise<void> {
  await api(request, "/api/v1/bff/teacher/role-workflows/assignments", {
    body: {
      course_id: courseId,
      role_key: roleKey,
      run_id: runId,
      team_id: teamId,
      user_id: user.user_id
    },
    method: "PUT",
    token: teacherToken
  });
}

async function completeRole(page: Page, role: "CEO" | "CFO" | "CMO" | "COO"): Promise<void> {
  const workflow = page.getByLabel("Student role workflow");
  await expect(workflow.getByRole("heading", { name: "角色工作区" })).toBeVisible();
  await expect(workflow.getByText(role, { exact: true })).toBeVisible();
  if (role === "CEO") {
    await workflow.getByLabel("策略说明").fill("Fresh learner team strategy.");
  } else if (role === "CFO") {
    await workflow.getByLabel("角色现金缓冲").fill("0.2");
    await workflow.getByLabel("角色服务质量预算").fill("160000");
  } else if (role === "CMO") {
    await workflow.getByLabel("角色定价").fill("12800");
    await workflow.getByLabel("角色营销预算").fill("180000");
  } else {
    await workflow.getByLabel("角色产能计划").selectOption("expand");
    await workflow.getByLabel("角色服务质量预算").fill("160000");
  }
  await workflow.getByRole("button", { name: "保存角色草稿" }).click();
  await expect(workflow.getByText("draft · v1")).toBeVisible();
  await workflow.getByRole("button", { name: "提交角色草稿" }).click();
  await expect(workflow.getByText("ready · v2")).toBeVisible();
}

test.afterEach(() => {
  cleanupPlaywrightStore();
});

test("W022 fresh learner cohort completes the machine E4 admission journey", async ({
  page,
  request
}) => {
  const suffix = `${Date.now()}_${test.info().workerIndex}`;
  const adminToken = await loginApi(request, "admin", "admin");
  const teacherToken = await loginApi(request, "teacher", "teacher");
  const course = await api<Course>(request, "/api/v1/courses", {
    body: { title: `Shanghai ElderCare W022 Fresh Cohort ${suffix}` },
    token: teacherToken
  });
  await api<Course>(request, `/api/v1/courses/${course.course_id}/publish`, {
    method: "POST",
    token: teacherToken
  });

  const users = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      createFreshUser(request, adminToken, `w022_e4_${suffix}_${index}`)
    )
  );
  const teams: TeamSlice[] = [];
  for (const [teamIndex, start] of [
    [0, 0],
    [1, 4]
  ] as const) {
    const team = await createTeam(
      request,
      teacherToken,
      course.course_id,
      users[start]!,
      `W022 Fresh Team ${teamIndex === 0 ? "Alpha" : "Beta"}`
    );
    for (const [offset, roleSlot] of [
      [0, "CFO"],
      [1, "CMO"],
      [2, "COO"]
    ] as const) {
      await addMember(
        request,
        teacherToken,
        course.course_id,
        team.team_id,
        users[start + offset + 1]!,
        roleSlot
      );
    }
    teams.push({ team, users: users.slice(start, start + 4) });
  }

  const runEnvelope = await api<{ run: Run }>(request, `/api/v1/courses/${course.course_id}/runs`, {
    method: "POST",
    token: teacherToken
  });
  const run = runEnvelope.run;
  await api(request, `/api/v1/runs/${run.run_id}/rounds/1/start`, {
    body: {},
    token: teacherToken
  });
  for (const { team, users: teamUsers } of teams) {
    for (const [index, roleKey] of [
      [0, "CEO"],
      [1, "CFO"],
      [2, "CMO"],
      [3, "COO"]
    ] as const) {
      await assignRole(
        request,
        teacherToken,
        course.course_id,
        run.run_id,
        team.team_id,
        teamUsers[index]!,
        roleKey
      );
    }
  }

  const readiness = await api<FreshLearnerAdmissionReadiness>(
    request,
    `/api/v1/bff/teacher/fresh-learner-admission?course_id=${course.course_id}&run_id=${run.run_id}&team_ids=${teams.map(({ team }) => team.team_id).join(",")}`,
    { token: teacherToken }
  );
  expect(readiness.admission_status).toBe("READY_FOR_MACHINE_E4");
  expect(readiness.fresh_learner_count).toBe(8);
  expect(readiness.assigned_roster_count).toBe(8);

  await page.goto(teacherBaseUrl);
  await signInTeacher(page);
  const admission = page.getByLabel("Fresh learner E4 admission readiness");
  await expect(admission.getByText("READY_FOR_MACHINE_E4")).toBeVisible();
  await expect(admission.getByText("8").first()).toBeVisible();

  for (const { users: teamUsers } of teams) {
    for (const [index, role] of [
      [1, "CFO"],
      [2, "CMO"],
      [3, "COO"],
      [0, "CEO"]
    ] as const) {
      await page.goto(studentBaseUrl);
      await signIn(page, teamUsers[index]!.username);
      await completeRole(page, role);
      if (role === "CEO") {
        const workflow = page.getByLabel("Student role workflow");
        await workflow.getByRole("button", { name: "创建团队合并" }).click();
        await expect(workflow.getByText("validated")).toBeVisible();
        await workflow.getByRole("button", { name: "确认团队决策" }).click();
        await expect(workflow.getByText("confirmed")).toBeVisible();
      }
      const visibleText = await page.locator("body").innerText();
      expect(visibleText).not.toMatch(
        /state_true|replay_hash|full_manifest|canonical_evidence_digest/
      );
    }
  }

  for (const operation of ["lock", "settle", "publish"] as const) {
    await api(request, `/api/v1/runs/${run.run_id}/rounds/1/${operation}`, {
      body: {},
      token: teacherToken
    });
  }
  for (const user of users) {
    const studentToken = await loginApi(request, user.username, user.username);
    const result = await api<Record<string, unknown>>(
      request,
      `/api/v1/runs/${run.run_id}/rounds/1/results`,
      { token: studentToken }
    );
    expect(JSON.stringify(result)).not.toMatch(/state_true|replay_hash/);
  }

  const cleanupRun = (
    await api<{ run: Run }>(request, `/api/v1/courses/${course.course_id}/runs`, {
      method: "POST",
      token: teacherToken
    })
  ).run;
  await api(
    request,
    `/api/v1/bff/admin/courses/${course.course_id}/runs/${cleanupRun.run_id}/lifecycle/abort`,
    {
      body: { confirmation: `ABORT ${cleanupRun.run_id}` },
      token: adminToken
    }
  );
  const cleanup = await api<{ control: { lifecycle_state: string } }>(
    request,
    `/api/v1/bff/admin/courses/${course.course_id}/runs/${cleanupRun.run_id}/lifecycle/cleanup`,
    {
      body: { confirmation: `CLEANUP ${cleanupRun.run_id}` },
      token: adminToken
    }
  );
  expect(cleanup.control.lifecycle_state).toBe("CLEANED");
});
