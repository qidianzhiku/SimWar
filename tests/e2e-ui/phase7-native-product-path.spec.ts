import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type TestInfo
} from "@playwright/test";
import type {
  ApiEnvelope,
  AuditLog,
  AuthSession,
  P0DemoState,
  PublicResultView,
  StudentBffCockpitDTO,
  SyntheticRunLifecycleControlDTO,
  TeacherBffWorkspaceDTO,
  TenantAdminSummaryDTO
} from "../../packages/shared-contracts/src";
import {
  LEGACY_PLAYWRIGHT_STORE_FILE,
  assertPlaywrightStoreFile,
  cleanupPlaywrightStore,
  resolvePlaywrightStoreFile
} from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;
const sourcePath = fileURLToPath(import.meta.url);
const privateMarkers = [
  "state_true",
  "ReplayManifest",
  "canonical_evidence_digest",
  "decision_batch_hash",
  "json_runtime_source_digest",
  "private ParameterSet",
  "private Replay"
];

type Credentials = {
  password: string;
  username: string;
};

test.describe.configure({ mode: "serial" });

test.afterAll(() => {
  cleanupPlaywrightStore();
});

test("@foundation preserves the legacy Store when no override is configured", () => {
  expect(resolvePlaywrightStoreFile({ environment: {} })).toBe(LEGACY_PLAYWRIGHT_STORE_FILE);
});

test("@foundation accepts the exact legacy Store override", () => {
  expect(
    resolvePlaywrightStoreFile({
      environment: { SIMWAR_PLAYWRIGHT_STORE_FILE: LEGACY_PLAYWRIGHT_STORE_FILE }
    })
  ).toBe(LEGACY_PLAYWRIGHT_STORE_FILE);
});

test("@foundation accepts one controlled external Store path and removes only its file", () => {
  const missionId = `phase7-native-validation-${process.pid}-${Date.now()}`;
  const controlledRoot = resolve(tmpdir(), "simwar-playwright");
  const missionDirectory = resolve(controlledRoot, missionId);
  const storeFile = resolve(missionDirectory, "playwright-store.json");

  try {
    expect(
      resolvePlaywrightStoreFile({
        environment: { SIMWAR_PLAYWRIGHT_STORE_FILE: storeFile }
      })
    ).toBe(storeFile);

    mkdirSync(dirname(storeFile), { recursive: true });
    cleanupPlaywrightStore(storeFile);

    expect(existsSync(storeFile)).toBe(false);
    expect(existsSync(missionDirectory)).toBe(false);
    expect(existsSync(controlledRoot)).toBe(true);
  } finally {
    cleanupPlaywrightStore(storeFile);
  }
});

test("@foundation rejects unsafe Store paths before cleanup", () => {
  const isolatedTemp = mkdtempSync(join(tmpdir(), "simwar-playwright-test-"));
  const controlledRoot = resolve(isolatedTemp, "simwar-playwright");
  const validMissionDirectory = resolve(controlledRoot, "phase7-native-validation");
  const validStoreFile = resolve(validMissionDirectory, "playwright-store.json");
  const outsideFile = resolve(isolatedTemp, "outside-store.json");

  try {
    mkdirSync(validMissionDirectory, { recursive: true });
    for (const storeFile of [
      "playwright-store.json",
      `${validMissionDirectory}\\..\\escaped\\playwright-store.json`,
      resolve(isolatedTemp, "playwright-store.json"),
      resolve(validMissionDirectory, "unexpected.json")
    ]) {
      expect(() =>
        resolvePlaywrightStoreFile({
          environment: { SIMWAR_PLAYWRIGHT_STORE_FILE: storeFile },
          tempDirectory: isolatedTemp
        })
      ).toThrow();
    }

    expect(() => assertPlaywrightStoreFile(outsideFile)).toThrow();
    expect(
      resolvePlaywrightStoreFile({
        environment: { SIMWAR_PLAYWRIGHT_STORE_FILE: validStoreFile },
        tempDirectory: isolatedTemp
      })
    ).toBe(validStoreFile);
  } finally {
    rmSync(isolatedTemp, { force: true, recursive: true });
  }
});

test("@foundation rejects a symbolic-link mission directory", () => {
  const isolatedTemp = mkdtempSync(join(tmpdir(), "simwar-playwright-test-"));
  const controlledRoot = resolve(isolatedTemp, "simwar-playwright");
  const outsideDirectory = resolve(isolatedTemp, "outside");
  const linkedMissionDirectory = resolve(controlledRoot, "phase7-native-validation");

  try {
    mkdirSync(controlledRoot, { recursive: true });
    mkdirSync(outsideDirectory, { recursive: true });
    symlinkSync(outsideDirectory, linkedMissionDirectory, "junction");

    expect(lstatSync(linkedMissionDirectory).isSymbolicLink()).toBe(true);
    expect(() =>
      resolvePlaywrightStoreFile({
        environment: {
          SIMWAR_PLAYWRIGHT_STORE_FILE: resolve(linkedMissionDirectory, "playwright-store.json")
        },
        tempDirectory: isolatedTemp
      })
    ).toThrow("symbolic link");
  } finally {
    rmSync(isolatedTemp, { force: true, recursive: true });
  }
});

test("@foundation keeps API host opt-in and the native spec free of forbidden paths", async () => {
  const { resolveApiHost } = await import("../../services/api/src/server");

  expect(resolveApiHost(undefined)).toBeUndefined();
  expect(resolveApiHost(" 127.0.0.1 ")).toBe("127.0.0.1");
  expect(resolveApiHost("0.0.0.0")).toBe("0.0.0.0");

  const source = readFileSync(sourcePath, "utf8");
  const directStoreMarker = ["services", "api", "tmp"].join("/");
  const internalRouteMarker = ["/", "internal", "/v1"].join("");
  const tempOrchestratorMarker = ["phase7", "formal", "orchestrator"].join("-");
  const tempAdapterMarker = ["browser", "adapter", "r4"].join("-");

  expect(source).not.toContain(directStoreMarker);
  expect(source).not.toContain(internalRouteMarker);
  expect(source).not.toContain(tempOrchestratorMarker);
  expect(source).not.toContain(tempAdapterMarker);
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

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, canonicalize(record[key])])
  );
}

function safeJsonDigest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

async function attachSafeJson(testInfo: TestInfo, name: string, value: unknown): Promise<void> {
  await testInfo.attach(name, {
    body: Buffer.from(`${JSON.stringify(canonicalize(value), null, 2)}\n`),
    contentType: "application/json"
  });
}

function auditDelta(baseline: AuditLog[], current: AuditLog[]): AuditLog[] {
  const baselineIds = new Set(baseline.map((entry) => entry.audit_id));
  return current.filter((entry) => !baselineIds.has(entry.audit_id));
}

function auditActionCounts(logs: AuditLog[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const log of logs) counts.set(log.action, (counts.get(log.action) ?? 0) + 1);
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))
  );
}

function safeOfficialResultSnapshot(result: PublicResultView) {
  return {
    result_label: result.result_label,
    round_no: result.round_no,
    run_id: result.run_id,
    runtime_boundary: result.runtime_boundary,
    status: result.status,
    teams: result.results
      .map((team) => ({
        state_est: team.state_est,
        state_obs: team.state_obs,
        team_id: team.team_id,
        team_name: team.team_name
      }))
      .sort((left, right) => left.team_id.localeCompare(right.team_id))
  };
}

function safeReplaySummarySnapshot(workspace: TeacherBffWorkspaceDTO) {
  const summary = workspace.teacher_replay_summary;
  return {
    formal_truth_write_allowed: summary.formal_truth_write_allowed,
    replay_hash: summary.replay_hash,
    replay_status: summary.replay_status,
    replay_writes_formal_results: summary.replay_writes_formal_results,
    result_count: summary.visible_state.result_count,
    round_id: summary.round_id,
    round_no: summary.round_no,
    run_id: summary.run_id,
    runtime_boundary: summary.visible_state.runtime_boundary
  };
}

async function login(request: APIRequestContext, credentials: Credentials): Promise<string> {
  const envelope = await apiPost<AuthSession>(
    request,
    "/api/v1/auth/login",
    undefined,
    credentials
  );
  return envelope.data.access_token;
}

async function signIn(
  page: Page,
  role: "管理员登录" | "教师登录" | "学员登录",
  credentials: Credentials
): Promise<void> {
  const scope = role === "管理员登录" ? page.locator('section[aria-label="admin login"]') : page;
  await scope.getByLabel("tenant").fill("tenant_demo");
  await scope.getByLabel("username").fill(credentials.username);
  await scope.getByLabel("password").fill(credentials.password);
  await scope.getByRole("button", { name: role }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

async function createStudentBThroughAdminUi(page: Page, credentials: Credentials): Promise<string> {
  const form = page.locator("article", { has: page.getByRole("heading", { name: "创建用户" }) });
  await form.getByLabel("用户名").fill(credentials.username);
  await form.getByLabel("邮箱").fill(`${credentials.username}@demo.simwar.local`);
  await form.getByLabel("显示名").fill("Phase 7 Student B");
  await form.getByLabel("初始密码").fill(credentials.password);
  await form.getByLabel("角色").selectOption("learner");
  await form.getByRole("button", { name: "创建用户" }).click();

  const notice = page.locator(".notice");
  await expect(notice).toContainText("user created:");
  const created = await notice.innerText();
  const userId = created.replace("user created:", "").trim();
  expect(userId).toMatch(/^usr_/);
  return userId;
}

function watchPublicRequests(context: BrowserContext, requests: string[]): void {
  context.on("request", (request) => {
    if (request.url().startsWith(apiBaseUrl)) {
      requests.push(request.url());
    }
  });
}

async function closeContexts(contexts: BrowserContext[]): Promise<void> {
  await Promise.all(contexts.map((context) => context.close()));
}

test("@phase7 executes the serial two-Run product path only under its exact gate", async ({
  browser,
  request
}, testInfo) => {
  test.skip(
    process.env.SIMWAR_PHASE7_NATIVE_VALIDATION !== "true",
    "full Phase 7 product validation requires a separate explicit authorization"
  );

  const suffix = `${testInfo.workerIndex}-${Date.now()}`;
  const teacherCredentials = { username: "teacher", password: "teacher" };
  const adminCredentials = { username: "admin", password: "admin" };
  const studentACredentials = { username: "student", password: "student" };
  const studentBCredentials = {
    username: `phase7-student-b-${suffix}`,
    password: `phase7-${suffix}-synthetic`
  };
  const contexts: BrowserContext[] = [];
  const observedRequests: string[] = [];
  let adminToken = "";
  let teacherToken = "";
  let studentAToken = "";
  let studentBToken = "";
  let runAId = "";
  let runBId = "";
  let settlementOutcome = "";
  let businessAttemptCount = 0;
  let settlementAttemptCount = 0;
  let preflightAudits: AuditLog[] = [];
  let teamA = { name: "", team_id: "" };
  let teamB = { name: "", team_id: "" };
  let studentIsolationPassed = false;
  let runAFreeze:
    | {
        auditLogs: AuditLog[];
        officialResult: PublicResultView;
        safeOfficialResult: ReturnType<typeof safeOfficialResultSnapshot>;
        safeReplaySummary: ReturnType<typeof safeReplaySummarySnapshot>;
        teacherWorkspace: TeacherBffWorkspaceDTO;
      }
    | undefined;

  try {
    const teacherContext = await browser.newContext();
    const studentAContext = await browser.newContext();
    const studentBContext = await browser.newContext();
    const adminContext = await browser.newContext();
    contexts.push(teacherContext, studentAContext, studentBContext, adminContext);
    for (const context of contexts) watchPublicRequests(context, observedRequests);

    const teacherPage = await teacherContext.newPage();
    const studentAPage = await studentAContext.newPage();
    const studentBPage = await studentBContext.newPage();
    const adminPage = await adminContext.newPage();

    await test.step("baseline and allowlisted public fixture setup", async () => {
      await adminPage.goto(adminBaseUrl);
      await signIn(adminPage, "管理员登录", adminCredentials);
      adminToken = await login(request, adminCredentials);
      teacherToken = await login(request, teacherCredentials);
      studentAToken = await login(request, studentACredentials);

      const baselineStateEnvelope = await apiGet<P0DemoState>(
        request,
        "/api/v1/demo-state",
        adminToken
      );
      const baselineAuditsEnvelope = await apiGet<AuditLog[]>(
        request,
        "/api/v1/audit/logs",
        adminToken
      );
      const baselineState = baselineStateEnvelope.data;
      const baselineAudits = baselineAuditsEnvelope.data;
      const baselineUsers = baselineState.users ?? [];
      const studentAUser = baselineUsers.find((user) => user.username === "student");
      expect(studentAUser?.team_id).toBeTruthy();
      const baselineTeamA = baselineState.teams.find(
        (team) => team.team_id === studentAUser?.team_id
      );
      expect(baselineTeamA).toBeTruthy();

      const studentBUserId = await createStudentBThroughAdminUi(adminPage, studentBCredentials);
      const teamEnvelope = await apiPost<P0DemoState["teams"][number]>(
        request,
        "/api/v1/courses/course_demo/teams",
        teacherToken,
        { captain_user_id: studentBUserId, name: "Phase 7 Team B" }
      );
      expect(teamEnvelope.data.team_id).toMatch(/^team_/);
      studentBToken = await login(request, studentBCredentials);

      const currentStateEnvelope = await apiGet<P0DemoState>(
        request,
        "/api/v1/demo-state",
        adminToken
      );
      const currentAuditsEnvelope = await apiGet<AuditLog[]>(
        request,
        "/api/v1/audit/logs",
        adminToken
      );
      const currentState = currentStateEnvelope.data;
      const currentUsers = currentState.users ?? [];
      const baselineUserIds = new Set(baselineUsers.map((user) => user.user_id));
      const baselineTeamIds = new Set(baselineState.teams.map((team) => team.team_id));
      const addedUsers = currentUsers.filter((user) => !baselineUserIds.has(user.user_id));
      const addedTeams = currentState.teams.filter((team) => !baselineTeamIds.has(team.team_id));
      const fixtureAuditDelta = auditDelta(baselineAudits, currentAuditsEnvelope.data);
      const fixtureAuditCounts = auditActionCounts(fixtureAuditDelta);

      expect(addedUsers).toHaveLength(1);
      expect(addedUsers[0]?.user_id).toBe(studentBUserId);
      expect(addedUsers[0]?.team_id).toBe(teamEnvelope.data.team_id);
      expect(addedTeams).toHaveLength(1);
      expect(addedTeams[0]?.team_id).toBe(teamEnvelope.data.team_id);
      expect(addedTeams[0]?.captain_user_id).toBe(studentBUserId);
      expect(addedTeams[0]?.members.map((member) => member.user_id)).toEqual([studentBUserId]);
      expect(fixtureAuditCounts).toEqual({
        "auth.login": 1,
        "team.create": 1,
        "user.create": 1
      });
      expect(currentState.runs).toEqual(baselineState.runs);
      expect(currentState.rounds).toEqual(baselineState.rounds);
      expect(currentState.decisions).toEqual(baselineState.decisions);
      expect(
        fixtureAuditDelta.filter((log) =>
          /^(run\.create|round\.|decision\.|run\.lifecycle\.|replay\.)/.test(log.action)
        )
      ).toEqual([]);
      expect(businessAttemptCount).toBe(0);

      teamA = { name: baselineTeamA!.name, team_id: baselineTeamA!.team_id };
      teamB = { name: addedTeams[0]!.name, team_id: addedTeams[0]!.team_id };
      preflightAudits = currentAuditsEnvelope.data;
      await attachSafeJson(testInfo, "phase7-preflight-delta", {
        audit_action_counts: fixtureAuditCounts,
        baseline: {
          audit_count: baselineAudits.length,
          decision_count: baselineState.decisions.length,
          round_count: baselineState.rounds.length,
          run_count: baselineState.runs.length,
          team_count: baselineState.teams.length,
          user_count: baselineUsers.length
        },
        business_mutations_before_gate: 0,
        delta: {
          added_membership_count: addedTeams[0]!.members.length,
          added_team_count: addedTeams.length,
          added_team_id: teamB.team_id,
          added_user_count: addedUsers.length,
          captain_matches_created_user: true,
          decision_count: 0,
          round_count: 0,
          run_count: 0
        },
        fixture_allowlist: ["auth.login", "team.create", "user.create"],
        public_surfaces_only: true
      });
    });

    await test.step("Run A is created and opened through the Teacher product surface", async () => {
      expect(preflightAudits.length).toBeGreaterThan(0);
      expect(businessAttemptCount).toBe(0);
      await teacherPage.goto(teacherBaseUrl);
      await signIn(teacherPage, "教师登录", teacherCredentials);
      const createRunResponsePromise = teacherPage.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/api/v1/courses/course_demo/runs" &&
          response.status() === 201
      );
      await teacherPage.getByRole("button", { name: "创建 Run" }).click();
      const createRunResponse = await createRunResponsePromise;
      const created = (await createRunResponse.json()) as ApiEnvelope<{
        round: P0DemoState["rounds"][number];
        run: P0DemoState["runs"][number];
      }>;
      runAId = created.data.run.run_id;
      expect(runAId).toMatch(/^run_/);
      await expect(teacherPage.getByText("run created")).toBeVisible();
      await expect(teacherPage.getByLabel("run selector")).toHaveValue(runAId);
      businessAttemptCount += 1;
      expect(businessAttemptCount).toBe(1);
      await attachSafeJson(testInfo, "phase7-business-attempt", {
        allowlisted_fixture_gate_passed: true,
        business_attempt_after: businessAttemptCount,
        business_attempt_before: 0,
        consumption_event: "teacher_product_run_created_with_server_run_id",
        run_id: runAId,
        server_response_status: createRunResponse.status()
      });

      await teacherPage.getByRole("button", { name: "开启回合" }).click();
      await expect(teacherPage.getByText("round opened")).toBeVisible();
    });

    await test.step("two Student product surfaces submit their assigned team decisions", async () => {
      await studentAPage.goto(studentBaseUrl);
      await signIn(studentAPage, "学员登录", studentACredentials);
      await studentAPage.getByRole("button", { name: "提交决策" }).click();
      await expect(studentAPage.getByText("decision submitted")).toBeVisible();

      await studentBPage.goto(studentBaseUrl);
      await signIn(studentBPage, "学员登录", studentBCredentials);
      await studentBPage.getByRole("button", { name: "提交决策" }).click();
      await expect(studentBPage.getByText("decision submitted")).toBeVisible();
    });

    await test.step("Teacher locks, settles, and publishes Run A once", async () => {
      await teacherPage.reload();
      await signIn(teacherPage, "教师登录", teacherCredentials);
      await expect(teacherPage.getByLabel("run selector")).toHaveValue(runAId);
      await teacherPage.getByRole("button", { name: "锁定回合" }).click();
      await expect(teacherPage.getByText("round locked")).toBeVisible();

      const settlementResponsePromise = teacherPage.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === `/api/v1/runs/${runAId}/rounds/1/settle`
      );
      await teacherPage.getByRole("button", { name: "请求结算" }).click();
      const settlementResponse = await settlementResponsePromise;
      settlementAttemptCount += 1;
      settlementOutcome =
        (await settlementResponse.headerValue("x-simwar-settlement-outcome")) ?? "";
      expect(settlementResponse.status()).toBe(200);
      expect(settlementAttemptCount).toBe(1);
      expect(settlementOutcome).toBe("committed");
      await expect(teacherPage.getByText("settlement completed")).toBeVisible();

      await teacherPage.getByRole("button", { name: "发布结果" }).click();
      await expect(teacherPage.getByText("result published")).toBeVisible();
      await expect(teacherPage.getByRole("heading", { name: "BFF Replay 摘要" })).toBeVisible();
    });

    await test.step("results, feedback, learning evidence, and tenant scope stay product-safe", async () => {
      const studentEvidence: Array<Record<string, unknown>> = [];
      for (const student of [
        {
          credentials: studentACredentials,
          otherTeam: teamB,
          ownTeam: teamA,
          page: studentAPage,
          token: studentAToken
        },
        {
          credentials: studentBCredentials,
          otherTeam: teamA,
          ownTeam: teamB,
          page: studentBPage,
          token: studentBToken
        }
      ]) {
        await student.page.reload();
        await signIn(student.page, "学员登录", student.credentials);
        await expect(student.page.getByRole("heading", { name: "BFF 发布结果" })).toBeVisible();
        await expect(student.page.getByRole("heading", { name: "三段式反馈" })).toBeVisible();
        await expect(student.page.getByRole("heading", { name: "Learning Report" })).toBeVisible();

        const cockpitEnvelope = await apiGet<StudentBffCockpitDTO>(
          request,
          `/api/v1/bff/student/runs/${runAId}/rounds/1/cockpit`,
          student.token
        );
        const cockpit = cockpitEnvelope.data;
        const redactedResult = cockpit.published_result.redacted_result;
        expect(cockpit.student_cockpit.run_id).toBe(runAId);
        expect(cockpit.student_cockpit.team_id).toBe(student.ownTeam.team_id);
        expect(cockpit.student_cockpit.visible_state.team_name).toBe(student.ownTeam.name);
        expect(cockpit.student_cockpit.visible_state.round_status).toBe("published");
        expect(redactedResult?.team_id).toBe(student.ownTeam.team_id);
        expect(Object.prototype.hasOwnProperty.call(redactedResult ?? {}, "state_true")).toBe(
          false
        );
        expect(cockpit.three_part_feedback.feedback.what_happened).toBeDefined();
        expect(cockpit.three_part_feedback.feedback.why_it_happened).toBeTruthy();
        expect(cockpit.learning_report.learning_evidence.advisory_only).toBe(true);
        expect(cockpit.learning_report.learning_evidence.formal_grade).toBe(false);

        const text = await student.page.locator("body").innerText();
        expect(text).not.toContain(student.otherTeam.team_id);
        expect(text).not.toContain(student.otherTeam.name);
        expect(text).not.toContain("Other Tenant");
        expect(text).not.toContain("tenant_other");
        for (const marker of privateMarkers) expect(text).not.toContain(marker);

        studentEvidence.push({
          learning_report: {
            advisory_only: cockpit.learning_report.learning_evidence.advisory_only,
            formal_grade: cockpit.learning_report.learning_evidence.formal_grade,
            prompt_count: cockpit.learning_report.learning_evidence.prompts.length
          },
          own_team_id: student.ownTeam.team_id,
          own_team_name: student.ownTeam.name,
          redacted_result_digest: safeJsonDigest(redactedResult),
          run_id: cockpit.student_cockpit.run_id,
          three_part_feedback: {
            next_step_risk: Boolean(cockpit.three_part_feedback.feedback.next_step_risk),
            what_happened: Boolean(cockpit.three_part_feedback.feedback.what_happened),
            why_it_happened: Boolean(cockpit.three_part_feedback.feedback.why_it_happened)
          }
        });
      }
      studentIsolationPassed = true;

      await expect(teacherPage.getByText("formal_truth_write_allowed: false")).toBeVisible();
      await expect(teacherPage.getByRole("heading", { name: "课堂复盘材料" })).toBeVisible();
      await adminPage.reload();
      await signIn(adminPage, "管理员登录", adminCredentials);
      await expect(adminPage.getByLabel("tenant admin scoped summary")).toBeVisible();
      await expect(adminPage.getByText("Other Tenant")).toHaveCount(0);

      const teacherWorkspaceEnvelope = await apiGet<TeacherBffWorkspaceDTO>(
        request,
        `/api/v1/bff/teacher/runs/${runAId}/rounds/1/workspace`,
        teacherToken
      );
      const officialResultEnvelope = await apiGet<PublicResultView>(
        request,
        `/api/v1/runs/${runAId}/rounds/1/results`,
        teacherToken
      );
      const tenantSummaryEnvelope = await apiGet<TenantAdminSummaryDTO>(
        request,
        "/api/v1/bff/admin/tenant-summary",
        adminToken
      );
      const currentAuditsEnvelope = await apiGet<AuditLog[]>(
        request,
        "/api/v1/audit/logs",
        adminToken
      );
      const teacherWorkspace = teacherWorkspaceEnvelope.data;
      const officialResult = officialResultEnvelope.data;
      const tenantSummary = tenantSummaryEnvelope.data;
      const businessAuditCounts = auditActionCounts(
        auditDelta(preflightAudits, currentAuditsEnvelope.data)
      );
      const monitoredTeams = teacherWorkspace.team_monitor.teams.filter((team) =>
        [teamA.team_id, teamB.team_id].includes(team.team_id)
      );

      expect(monitoredTeams).toHaveLength(2);
      expect(monitoredTeams.every((team) => team.decision_submitted)).toBe(true);
      expect(teacherWorkspace.round_control.status).toBe("published");
      expect(teacherWorkspace.round_control.visible_state.decision_count).toBe(2);
      expect(teacherWorkspace.teacher_replay_summary.formal_truth_write_allowed).toBe(false);
      expect(teacherWorkspace.teacher_replay_summary.replay_hash).toBeTruthy();
      expect(teacherWorkspace.teacher_replay_summary.replay_writes_formal_results).toBe(false);
      expect(officialResult.run_id).toBe(runAId);
      expect(officialResult.status).toBe("published");
      expect(tenantSummary.visible_tenant_ids).toEqual(["tenant_demo"]);
      expect(businessAuditCounts["run.create"]).toBe(1);
      expect(businessAuditCounts["round.start"]).toBe(1);
      expect(businessAuditCounts["decision.submit"]).toBe(2);
      expect(businessAuditCounts["round.lock"]).toBe(1);
      expect(businessAuditCounts["round.settle_requested"]).toBe(1);
      expect(businessAuditCounts["round.publish"]).toBe(1);
      expect(settlementAttemptCount).toBe(1);
      expect(businessAttemptCount).toBe(1);

      const safeOfficialResult = safeOfficialResultSnapshot(officialResult);
      const safeReplaySummary = safeReplaySummarySnapshot(teacherWorkspace);
      runAFreeze = {
        auditLogs: structuredClone(currentAuditsEnvelope.data),
        officialResult: structuredClone(officialResult),
        safeOfficialResult,
        safeReplaySummary,
        teacherWorkspace: structuredClone(teacherWorkspace)
      };
      await attachSafeJson(testInfo, "phase7-run-a-product-evidence", {
        audit_action_counts: businessAuditCounts,
        decision_submitted_team_ids: monitoredTeams.map((team) => team.team_id).sort(),
        published_status: officialResult.status,
        run_id: runAId,
        settlement_attempt_count: settlementAttemptCount,
        settlement_outcome_header: settlementOutcome,
        students: studentEvidence,
        tenant_admin_summary: {
          tenant_id: tenantSummary.tenant_id,
          visible_state: tenantSummary.visible_state,
          visible_tenant_ids: tenantSummary.visible_tenant_ids
        },
        teacher_replay_summary: safeReplaySummary
      });
      await attachSafeJson(testInfo, "phase7-run-a-evidence-freeze", {
        frozen_before_run_b: true,
        official_result_safe_digest: safeJsonDigest(safeOfficialResult),
        replay_summary_safe_digest: safeJsonDigest(safeReplaySummary),
        run_id: runAId,
        team_ids: [teamA.team_id, teamB.team_id].sort()
      });
    });

    await test.step("Run B uses the separate pre-settlement lifecycle product path", async () => {
      expect(runAFreeze).toBeDefined();
      const createRunResponsePromise = teacherPage.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/api/v1/courses/course_demo/runs" &&
          response.status() === 201
      );
      await teacherPage.getByRole("button", { name: "Create Next Run" }).click();
      const createRunResponse = await createRunResponsePromise;
      const created = (await createRunResponse.json()) as ApiEnvelope<{
        round: P0DemoState["rounds"][number];
        run: P0DemoState["runs"][number];
      }>;
      await expect(teacherPage.getByText("run created")).toBeVisible();
      runBId = await teacherPage.getByLabel("run selector").inputValue();
      expect(runBId).toBe(created.data.run.run_id);
      expect(runBId).toMatch(/^run_/);
      expect(runBId).not.toBe(runAId);
      expect(businessAttemptCount).toBe(1);

      await adminPage.reload();
      await signIn(adminPage, "管理员登录", adminCredentials);
      const lifecycleSurface = adminPage.getByLabel("synthetic run lifecycle controls");
      const runB = lifecycleSurface.locator("article", { hasText: runBId });
      await expect(runB.getByText("ACTIVE", { exact: true })).toBeVisible();
      adminPage.on("dialog", (dialog) => dialog.accept());

      await runB.getByRole("button", { name: "ABORT" }).click();
      await expect(runB.getByText("ABORTED", { exact: true })).toBeVisible();
      await runB.getByRole("button", { name: "RESET" }).click();
      await expect(runB.getByText("RESET_READY", { exact: true })).toBeVisible();
      await runB.getByRole("button", { name: "ABORT" }).click();
      await expect(runB.getByText("ABORTED", { exact: true })).toBeVisible();
      await runB.getByRole("button", { name: "CLEANUP" }).click();
      await expect(runB.getByText("CLEANED", { exact: true })).toBeVisible();

      const lifecycleEnvelope = await apiGet<SyntheticRunLifecycleControlDTO[]>(
        request,
        "/api/v1/bff/admin/run-lifecycle-controls",
        adminToken
      );
      const currentStateEnvelope = await apiGet<P0DemoState>(
        request,
        "/api/v1/demo-state",
        adminToken
      );
      const currentAuditsEnvelope = await apiGet<AuditLog[]>(
        request,
        "/api/v1/audit/logs",
        adminToken
      );
      const runBControl = lifecycleEnvelope.data.find((control) => control.run_id === runBId);
      const runBRounds = currentStateEnvelope.data.rounds.filter(
        (round) => round.run_id === runBId
      );
      const runBDecisions = currentStateEnvelope.data.decisions.filter(
        (decision) => decision.run_id === runBId
      );
      const runBDeltaAudits = auditDelta(runAFreeze!.auditLogs, currentAuditsEnvelope.data);
      const runBLifecycleAudits = runBDeltaAudits.filter(
        (log) => log.resource_id === runBId && log.action.startsWith("run.lifecycle.")
      );
      const runBLifecycleCounts = auditActionCounts(runBLifecycleAudits);
      const settlementActionCount = runBDeltaAudits.filter((log) =>
        ["round.settle", "round.settle_requested"].includes(log.action)
      ).length;
      const publishActionCount = runBDeltaAudits.filter(
        (log) => log.action === "round.publish"
      ).length;
      const replayActionCount = runBDeltaAudits.filter((log) =>
        log.action.toLowerCase().includes("replay")
      ).length;

      expect(runBControl).toMatchObject({
        evidence_frozen: true,
        lifecycle_state: "CLEANED",
        pre_publication: true,
        pre_settlement: true,
        run_id: runBId,
        runtime_boundary: "JSON_INTERNAL_ONLY",
        synthetic_marker: true,
        tenant_id: "tenant_demo"
      });
      expect(runBRounds).toHaveLength(1);
      expect(runBRounds[0]?.status).toBe("draft");
      expect(runBRounds[0]?.replay_hash).toBeUndefined();
      expect(runBDecisions).toEqual([]);
      expect(settlementActionCount).toBe(0);
      expect(publishActionCount).toBe(0);
      expect(replayActionCount).toBe(0);
      expect(runBLifecycleCounts).toEqual({
        "run.lifecycle.abort": 2,
        "run.lifecycle.cleanup": 1,
        "run.lifecycle.reset": 1
      });

      await attachSafeJson(testInfo, "phase7-run-b-lifecycle", {
        audit_action_counts: runBLifecycleCounts,
        lifecycle_state: runBControl!.lifecycle_state,
        pre_publication: runBControl!.pre_publication,
        pre_settlement: runBControl!.pre_settlement,
        publish_action_count: publishActionCount,
        replay_action_count: replayActionCount,
        replay_reference_count: runBRounds.filter((round) => Boolean(round.replay_hash)).length,
        run_id: runBId,
        settlement_action_count: settlementActionCount
      });
    });

    await test.step("Run A remains historical and official evidence is not overwritten", async () => {
      expect(runAFreeze).toBeDefined();
      await teacherPage.getByLabel("run selector").selectOption(runAId);
      await expect(teacherPage.getByText("Historical Run · read-only")).toBeVisible();
      await expect(teacherPage.getByRole("button", { name: "已发布" })).toBeDisabled();
      await expect(teacherPage.getByText(`Run context: ${runAId}`)).toBeVisible();

      const teacherWorkspaceEnvelope = await apiGet<TeacherBffWorkspaceDTO>(
        request,
        `/api/v1/bff/teacher/runs/${runAId}/rounds/1/workspace`,
        teacherToken
      );
      const officialResultEnvelope = await apiGet<PublicResultView>(
        request,
        `/api/v1/runs/${runAId}/rounds/1/results`,
        teacherToken
      );
      const currentAuditsEnvelope = await apiGet<AuditLog[]>(
        request,
        "/api/v1/audit/logs",
        adminToken
      );
      const currentSafeOfficialResult = safeOfficialResultSnapshot(officialResultEnvelope.data);
      const currentSafeReplaySummary = safeReplaySummarySnapshot(teacherWorkspaceEnvelope.data);
      const frozenAuditCounts = auditActionCounts(runAFreeze!.auditLogs);
      const currentAuditCounts = auditActionCounts(currentAuditsEnvelope.data);

      expect(officialResultEnvelope.data).toEqual(runAFreeze!.officialResult);
      expect(currentSafeOfficialResult).toEqual(runAFreeze!.safeOfficialResult);
      expect(currentSafeReplaySummary).toEqual(runAFreeze!.safeReplaySummary);
      expect(teacherWorkspaceEnvelope.data.teacher_replay_summary).toEqual(
        runAFreeze!.teacherWorkspace.teacher_replay_summary
      );
      expect(currentAuditCounts["round.settle_requested"]).toBe(
        frozenAuditCounts["round.settle_requested"]
      );
      expect(currentAuditCounts["round.settle"]).toBe(frozenAuditCounts["round.settle"]);
      expect(currentAuditCounts["round.publish"]).toBe(frozenAuditCounts["round.publish"]);
      expect(teacherWorkspaceEnvelope.data.teacher_replay_summary.formal_truth_write_allowed).toBe(
        false
      );
      expect(observedRequests.some((url) => url.includes("/internal/"))).toBe(false);

      await attachSafeJson(testInfo, "phase7-boundary-evidence", {
        business_attempt_count: businessAttemptCount,
        cross_team_exposure_count: studentIsolationPassed ? 0 : 1,
        cross_tenant_exposure_count: 0,
        frontend_internal_request_count: observedRequests.filter((url) =>
          url.includes("/internal/")
        ).length,
        run_a_historical_read_only: true,
        run_a_official_result_safe_digest_unchanged:
          safeJsonDigest(currentSafeOfficialResult) ===
          safeJsonDigest(runAFreeze!.safeOfficialResult),
        run_a_replay_summary_safe_digest_unchanged:
          safeJsonDigest(currentSafeReplaySummary) ===
          safeJsonDigest(runAFreeze!.safeReplaySummary),
        settlement_attempt_count: settlementAttemptCount,
        student_private_marker_count: 0,
        teacher_formal_truth_write_allowed: false
      });
    });

    expect(observedRequests.some((url) => url.includes("/internal/"))).toBe(false);
  } finally {
    await closeContexts(contexts);
  }
});
