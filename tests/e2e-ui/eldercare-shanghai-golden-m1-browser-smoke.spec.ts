import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type {
  ApiEnvelope,
  AuthSession,
  CourseBlueprintReference,
  CoursePackageVersion,
  ParameterSetReference,
  ScenarioPackageReference
} from "@simwar/shared-contracts";
import { compileShanghaiEldercareScenarioAsset } from "@simwar/simulation-core";
import {
  createEldercareGoldenM1BlueprintDraft,
  createEldercareGoldenM1CoursePackageDraft,
  calculateEldercareGoldenM1AssetHash,
  createEldercareGoldenM1ParameterDraft,
  createEldercareGoldenM1PluginDraft,
  createEldercareGoldenM1ScenarioDraft,
  ELDERCARE_GOLDEN_M1_SYNTHETIC_LABELS,
  type EldercareGoldenM1AdapterInput
} from "../../services/api/src/eldercare-golden-m1";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const adminBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_ADMIN_PORT ?? 3103}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const studentBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_STUDENT_PORT ?? 3102}`;

const SOURCE_TENANT_ID = "tenant_r7a_synthetic_browser";
let sourceTenantId = SOURCE_TENANT_ID;
let TARGET_TENANT_ID = "tenant_demo";
let TARGET_ADMIN_USERNAME = "admin";
let TARGET_ADMIN_PASSWORD = "admin";
let TARGET_TEACHER_USERNAME = "teacher";
let TARGET_TEACHER_PASSWORD = "teacher";
let TARGET_STUDENT_USERNAME = "student";
let TARGET_STUDENT_PASSWORD = "student";
const VERSION = "1.0.0";
const PLUGIN_PACKAGE_ID = "plugin_wellness_eldercare_v1";
const SOURCE_PARAMETER_ID = "eldercare_shanghai_browser_source_parameter";
const SOURCE_SCENARIO_ID = "eldercare_shanghai_browser_source_scenario";
const E4_PARTIAL_ONLY = "E4_PARTIAL_ONLY" as const;
const E4_PARTIAL_ONLY_REASON =
  "The generic Student shell is validated against the canonical demo-team path; a fresh formal Course team cannot be assigned to the seeded demo learner by the current UI contract, so this browser evidence does not claim a full formal Student run.";

type Ref = {
  content_digest: string;
  parameter_set_id?: string;
  scenario_package_id?: string;
  plugin_package_id?: string;
  course_blueprint_id?: string;
  version: string;
  tenant_id?: string;
};

type BaselineResult = {
  outcome: string;
  parameter_set: { reference: ParameterSetReference };
  scenario_package: { reference: ScenarioPackageReference };
};

type FormalSeed = {
  baseline: BaselineResult;
  blueprint: CourseBlueprintReference;
  coursePackage: CoursePackageVersion;
  packageDraft: ReturnType<typeof createEldercareGoldenM1CoursePackageDraft>;
};

function adapterInput(overrides: Partial<EldercareGoldenM1AdapterInput> = {}) {
  const compiledAsset = compileShanghaiEldercareScenarioAsset();
  const asset = {
    ...compiledAsset,
    parameter_set: { ...compiledAsset.parameter_set, tenant_id: sourceTenantId },
    scenario_package: { ...compiledAsset.scenario_package, tenant_id: sourceTenantId }
  };
  asset.asset_hash = calculateEldercareGoldenM1AssetHash(asset);
  return {
    artifact_ids: {
      parameter_set_id: SOURCE_PARAMETER_ID,
      scenario_package_id: SOURCE_SCENARIO_ID,
      plugin_package_id: PLUGIN_PACKAGE_ID,
      course_blueprint_id: "eldercare_shanghai_golden_m1_browser_blueprint",
      course_package_id: "eldercare_shanghai_golden_m1_browser_package",
      version: VERSION,
      ...overrides.artifact_ids
    },
    source_tenant_id: sourceTenantId,
    target_tenant_id: TARGET_TENANT_ID,
    asset,
    provenance: { asset_hash: asset.asset_hash },
    ...overrides
  } satisfies EldercareGoldenM1AdapterInput;
}

async function apiRequest<TData>(
  request: APIRequestContext,
  path: string,
  options: {
    body?: unknown;
    method?: "GET" | "POST";
    tenantId: string;
    token?: string;
  }
): Promise<{ body: ApiEnvelope<TData>; status: number }> {
  const response = await request.fetch(`${apiBaseUrl}${path}`, {
    data: options.body,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": options.tenantId,
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {})
    },
    method: options.method ?? (options.body === undefined ? "GET" : "POST")
  });
  const body = (await response.json()) as ApiEnvelope<TData>;
  return { body, status: response.status() };
}

async function checkedApiRequest<TData>(
  request: APIRequestContext,
  path: string,
  options: {
    body?: unknown;
    method?: "GET" | "POST";
    tenantId: string;
    token?: string;
  },
  expectedStatus: number | readonly number[] = [200, 201]
): Promise<TData> {
  const result = await apiRequest<TData>(request, path, options);
  const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  expect(
    expected,
    `${options.method ?? (options.body === undefined ? "GET" : "POST")} ${path}: ${JSON.stringify(result.body)}`
  ).toContain(result.status);
  return result.body.data;
}

async function loginApi(
  request: APIRequestContext,
  tenantId: string,
  username: string,
  password: string
): Promise<string> {
  const session = await checkedApiRequest<AuthSession>(
    request,
    "/api/v1/auth/login",
    { body: { password, username }, tenantId },
    200
  );
  return session.access_token;
}

async function transition(
  request: APIRequestContext,
  path: string,
  body: unknown,
  token: string,
  tenantId: string
): Promise<void> {
  await checkedApiRequest(request, path, { body, tenantId, token }, 200);
}

async function ensureSourceTenant(
  request: APIRequestContext,
  platformToken: string
): Promise<string> {
  const existing = await apiRequest<unknown[]>(request, "/api/v1/admin/tenants", {
    tenantId: "tenant_platform",
    token: platformToken
  });
  if (existing.status !== 200) {
    throw new Error(`source tenant preflight failed: ${JSON.stringify(existing.body)}`);
  }
  if (
    existing.body.data.some((tenant) => {
      if (!tenant || typeof tenant !== "object") return false;
      return (tenant as { tenant_id?: unknown }).domain === `${SOURCE_TENANT_ID}.simwar.local`;
    })
  ) {
    const existingTenant = existing.body.data.find(
      (tenant) =>
        tenant &&
        typeof tenant === "object" &&
        (tenant as { domain?: unknown }).domain === `${SOURCE_TENANT_ID}.simwar.local`
    ) as { tenant_id?: string } | undefined;
    if (!existingTenant?.tenant_id) {
      throw new Error(
        `source tenant preflight returned an invalid tenant: ${JSON.stringify(existing.body)}`
      );
    }
    sourceTenantId = existingTenant.tenant_id;
    return sourceTenantId;
  }

  const created = await checkedApiRequest<{ tenant_id: string }>(
    request,
    "/api/v1/admin/tenants",
    {
      body: {
        domain: `${SOURCE_TENANT_ID}.simwar.local`,
        name: "R7-A Shanghai Eldercare Synthetic Source (Browser)"
      },
      tenantId: "tenant_platform",
      token: platformToken
    },
    201
  );
  expect(created.tenant_id).toBeTruthy();
  sourceTenantId = created.tenant_id;
  return sourceTenantId;
}

async function createTenant(
  request: APIRequestContext,
  platformToken: string,
  name: string
): Promise<{ tenant_id: string }> {
  return checkedApiRequest<{ tenant_id: string }>(
    request,
    "/api/v1/admin/tenants",
    {
      body: { domain: `${name}.eldercare-golden.browser.test`, name },
      tenantId: "tenant_platform",
      token: platformToken
    },
    201
  );
}

async function createUser(
  request: APIRequestContext,
  platformToken: string,
  input: { tenant_id: string; username: string; password: string; roles: string[] }
): Promise<{ user_id: string }> {
  return checkedApiRequest<{ user_id: string }>(
    request,
    "/api/v1/admin/users",
    {
      body: {
        display_name: input.username,
        email: `${input.username}@eldercare-golden.browser.test`,
        password: input.password,
        roles: input.roles,
        tenant_id: input.tenant_id,
        username: input.username
      },
      tenantId: "tenant_platform",
      token: platformToken
    },
    201
  );
}

async function createAvailablePlugin(
  request: APIRequestContext,
  platformToken: string,
  input: EldercareGoldenM1AdapterInput
): Promise<void> {
  const created = await checkedApiRequest<{ reference: Ref }>(
    request,
    "/api/v1/formal-authority/plugin-releases",
    {
      body: createEldercareGoldenM1PluginDraft(input),
      tenantId: "tenant_platform",
      token: platformToken
    },
    201
  );
  const reference = created.reference;
  const path = (action: string) =>
    `/api/v1/formal-authority/plugin-releases/${PLUGIN_PACKAGE_ID}/versions/${VERSION}/${action}`;
  await transition(request, path("validate"), reference, platformToken, "tenant_platform");
  await transition(
    request,
    path("approve"),
    { ...reference, owner_decision_id: "eldercare-browser-plugin-approval" },
    platformToken,
    "tenant_platform"
  );
  await transition(
    request,
    path("make-available"),
    { ...reference, availability_decision_id: "eldercare-browser-plugin-availability" },
    platformToken,
    "tenant_platform"
  );
}

async function createApprovedSourceAuthorities(
  request: APIRequestContext,
  platformToken: string,
  input: EldercareGoldenM1AdapterInput
): Promise<{ parameter: ParameterSetReference; scenario: ScenarioPackageReference }> {
  const parameterDraft = createEldercareGoldenM1ParameterDraft(input);
  const parameterCreated = await checkedApiRequest<{ reference: ParameterSetReference }>(
    request,
    "/api/v1/formal-authority/parameter-sets",
    {
      body: {
        ...parameterDraft,
        tenant_id: sourceTenantId
      },
      tenantId: sourceTenantId,
      token: platformToken
    },
    201
  );
  const parameter = parameterCreated.reference;
  const parameterPath = (action: string) =>
    `/api/v1/formal-authority/parameter-sets/${SOURCE_PARAMETER_ID}/versions/${VERSION}/${action}`;
  await transition(
    request,
    parameterPath("validate"),
    { ...parameter, tenant_id: sourceTenantId },
    platformToken,
    sourceTenantId
  );
  await transition(
    request,
    parameterPath("freeze"),
    { ...parameter, tenant_id: sourceTenantId },
    platformToken,
    sourceTenantId
  );
  await transition(
    request,
    parameterPath("approve"),
    {
      ...parameter,
      approval_id: "eldercare-browser-source-parameter-approval",
      tenant_id: sourceTenantId
    },
    platformToken,
    sourceTenantId
  );

  const scenarioDraft = createEldercareGoldenM1ScenarioDraft({
    ...input,
    parameter_set_reference: parameter
  });
  const scenarioCreated = await checkedApiRequest<{ reference: ScenarioPackageReference }>(
    request,
    "/api/v1/formal-authority/scenario-packages",
    {
      body: {
        ...scenarioDraft,
        parameter_set_reference: parameter,
        tenant_id: sourceTenantId
      },
      tenantId: sourceTenantId,
      token: platformToken
    },
    201
  );
  const scenario = scenarioCreated.reference;
  const scenarioPath = (action: string) =>
    `/api/v1/formal-authority/scenario-packages/${SOURCE_SCENARIO_ID}/versions/${VERSION}/${action}`;
  await transition(
    request,
    scenarioPath("validate"),
    { ...scenario, tenant_id: sourceTenantId },
    platformToken,
    sourceTenantId
  );
  await transition(
    request,
    scenarioPath("freeze"),
    { ...scenario, tenant_id: sourceTenantId },
    platformToken,
    sourceTenantId
  );
  await transition(
    request,
    scenarioPath("approve"),
    {
      ...scenario,
      approval_id: "eldercare-browser-source-scenario-approval",
      tenant_id: sourceTenantId
    },
    platformToken,
    sourceTenantId
  );
  return { parameter, scenario };
}

async function seedFormalCoursePackage(
  request: APIRequestContext,
  platformToken: string,
  adminToken: string
): Promise<FormalSeed> {
  await ensureSourceTenant(request, platformToken);
  const input = adapterInput();
  await createAvailablePlugin(request, platformToken, input);
  const source = await createApprovedSourceAuthorities(request, platformToken, input);
  const baseline = await checkedApiRequest<BaselineResult>(
    request,
    "/api/v1/admin/tenant-baselines/provision",
    {
      body: {
        idempotency_key: "eldercare-browser-baseline",
        source_parameter_set: { ...source.parameter, source_tenant_id: sourceTenantId },
        source_scenario_package: {
          ...source.scenario,
          source_tenant_id: sourceTenantId,
          tenant_id: sourceTenantId
        },
        target_tenant_id: TARGET_TENANT_ID
      },
      tenantId: "tenant_platform",
      token: platformToken
    },
    201
  );
  expect(baseline.outcome).toBe("CREATED");

  const suffix = Date.now().toString(36);
  const targetInput = adapterInput({
    artifact_ids: {
      parameter_set_id: baseline.parameter_set.reference.parameter_set_id,
      scenario_package_id: baseline.scenario_package.reference.scenario_package_id,
      course_blueprint_id: `eldercare_shanghai_golden_m1_browser_blueprint_${suffix}`,
      course_package_id: `eldercare_shanghai_golden_m1_browser_package_${suffix}`
    },
    parameter_set_reference: baseline.parameter_set.reference,
    scenario_package_reference: baseline.scenario_package.reference
  });
  const blueprintDraft = createEldercareGoldenM1BlueprintDraft(targetInput);
  const blueprintCreated = await checkedApiRequest<{ reference: CourseBlueprintReference }>(
    request,
    "/api/v1/formal-authority/course-blueprints",
    {
      body: {
        ...blueprintDraft,
        required_product_capabilities: ["course:create", "decision_submit", "round_publish"],
        scenario_compatibility_constraints: blueprintDraft.scenario_compatibility_constraints
      },
      tenantId: TARGET_TENANT_ID,
      token: platformToken
    },
    201
  );
  const blueprint = blueprintCreated.reference;
  const blueprintPath = (action: string) =>
    `/api/v1/formal-authority/course-blueprints/${blueprint.course_blueprint_id}/versions/${VERSION}/${action}`;
  await transition(request, blueprintPath("validate"), blueprint, platformToken, TARGET_TENANT_ID);
  await transition(request, blueprintPath("freeze"), blueprint, platformToken, TARGET_TENANT_ID);
  await transition(
    request,
    blueprintPath("approve"),
    { ...blueprint, approval_id: "eldercare-browser-blueprint-approval" },
    platformToken,
    TARGET_TENANT_ID
  );

  const packageDraft = createEldercareGoldenM1CoursePackageDraft({
    ...targetInput,
    course_blueprint_reference: blueprint
  });
  const packageCreated = await checkedApiRequest<CoursePackageVersion>(
    request,
    "/api/v1/admin/course-package-versions/drafts",
    { body: packageDraft, tenantId: TARGET_TENANT_ID, token: adminToken },
    201
  );
  const packageReference = {
    content_digest: packageCreated.content_digest,
    course_package_id: packageCreated.course_package_id,
    version: packageCreated.version
  };
  await transition(
    request,
    `/api/v1/admin/course-package-versions/${packageReference.course_package_id}/versions/${VERSION}/validate`,
    packageReference,
    adminToken,
    TARGET_TENANT_ID
  );
  const coursePackage = await checkedApiRequest<CoursePackageVersion>(
    request,
    `/api/v1/admin/course-package-versions/${packageReference.course_package_id}/versions/${VERSION}/make-available`,
    { body: packageReference, tenantId: TARGET_TENANT_ID, token: adminToken },
    200
  );
  expect(coursePackage.status).toBe("AVAILABLE");
  return { baseline, blueprint, coursePackage, packageDraft };
}

async function createFormalCourseRound(
  request: APIRequestContext,
  teacherToken: string,
  studentUserId: string,
  blueprint: CourseBlueprintReference,
  scenario: ScenarioPackageReference
): Promise<{ runId: string }> {
  const course = await checkedApiRequest<{ course: { course_id: string } }>(
    request,
    "/api/v1/bff/teacher/course-blueprint-courses",
    {
      body: {
        course_blueprint_reference: blueprint,
        scenario_package_reference: scenario,
        title: "Shanghai Eldercare Golden M1 Browser Course"
      },
      tenantId: TARGET_TENANT_ID,
      token: teacherToken
    },
    201
  );
  const courseId = course.course.course_id;
  await checkedApiRequest(
    request,
    `/api/v1/courses/${courseId}/publish`,
    { body: {}, tenantId: TARGET_TENANT_ID, token: teacherToken },
    200
  );
  const team = await checkedApiRequest<{ team_id: string }>(
    request,
    `/api/v1/courses/${courseId}/teams`,
    {
      body: { captain_user_id: studentUserId, name: "Shanghai Eldercare Golden M1 Browser Team" },
      tenantId: TARGET_TENANT_ID,
      token: teacherToken
    },
    201
  );
  expect(team.team_id).toBeTruthy();
  const created = await checkedApiRequest<{ run: { run_id: string } }>(
    request,
    `/api/v1/courses/${courseId}/runs`,
    {
      body: { formal_runtime_seed: 20260809 },
      tenantId: TARGET_TENANT_ID,
      token: teacherToken
    },
    201
  );
  await checkedApiRequest(
    request,
    `/api/v1/runs/${created.run.run_id}/rounds/1/start`,
    { body: {}, tenantId: TARGET_TENANT_ID, token: teacherToken },
    200
  );
  return { runId: created.run.run_id };
}

async function signInAdminPage(page: Page): Promise<void> {
  const login = page.locator('section[aria-label="admin login"]');
  await login.getByLabel("tenant").fill(TARGET_TENANT_ID);
  await login.getByLabel("username").fill(TARGET_ADMIN_USERNAME);
  await login.getByLabel("password").fill(TARGET_ADMIN_PASSWORD);
  await login.getByRole("button", { name: "管理员登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

async function signInTeacherPage(page: Page): Promise<void> {
  await page.getByLabel("tenant").fill(TARGET_TENANT_ID);
  await page.getByLabel("username").fill(TARGET_TEACHER_USERNAME);
  await page.getByLabel("password").fill(TARGET_TEACHER_PASSWORD);
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(
    page.getByRole("status", { name: "教师操作通知" }).getByLabel("技术兼容标签")
  ).toContainText("signed in");
}

async function signInStudentPage(page: Page): Promise<void> {
  await page.getByLabel("tenant").fill(TARGET_TENANT_ID);
  await page.getByLabel("username").fill(TARGET_STUDENT_USERNAME);
  await page.getByLabel("password").fill(TARGET_STUDENT_PASSWORD);
  await page.getByRole("button", { name: "学员登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

function captureBrowserWrites(page: Page): string[] {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  return writes;
}

// This spec seeds the shared Playwright JSON store. Clean it immediately after
// the test so later browser specs cannot observe the synthetic package/tenant
// and become order-dependent when the full browser-smoke suite runs.
test.afterEach(() => {
  cleanupPlaywrightStore();
});

test("E4_PARTIAL_ONLY: renders approved Shanghai Eldercare Golden M1 on generic role surfaces", async ({
  page,
  request
}) => {
  test.info().annotations.push({ type: E4_PARTIAL_ONLY, description: E4_PARTIAL_ONLY_REASON });

  const platformToken = await loginApi(request, "tenant_platform", "platform", "platform");
  const targetTenant = await createTenant(
    request,
    platformToken,
    `eldercare-browser-target-${Date.now().toString(36)}`
  );
  TARGET_TENANT_ID = targetTenant.tenant_id;
  const suffix = Date.now().toString(36);
  TARGET_ADMIN_USERNAME = `eldercare-admin-${suffix}`;
  TARGET_ADMIN_PASSWORD = `admin-${suffix}`;
  TARGET_TEACHER_USERNAME = `eldercare-teacher-${suffix}`;
  TARGET_TEACHER_PASSWORD = `teacher-${suffix}`;
  TARGET_STUDENT_USERNAME = `eldercare-student-${suffix}`;
  TARGET_STUDENT_PASSWORD = `student-${suffix}`;
  await createUser(request, platformToken, {
    tenant_id: TARGET_TENANT_ID,
    username: TARGET_ADMIN_USERNAME,
    password: TARGET_ADMIN_PASSWORD,
    roles: ["tenant_admin"]
  });
  const studentUser = await createUser(request, platformToken, {
    tenant_id: TARGET_TENANT_ID,
    username: TARGET_STUDENT_USERNAME,
    password: TARGET_STUDENT_PASSWORD,
    roles: ["learner", "team_captain"]
  });
  await createUser(request, platformToken, {
    tenant_id: TARGET_TENANT_ID,
    username: TARGET_TEACHER_USERNAME,
    password: TARGET_TEACHER_PASSWORD,
    roles: ["teacher"]
  });
  const adminToken = await loginApi(
    request,
    TARGET_TENANT_ID,
    TARGET_ADMIN_USERNAME,
    TARGET_ADMIN_PASSWORD
  );
  const teacherToken = await loginApi(
    request,
    TARGET_TENANT_ID,
    TARGET_TEACHER_USERNAME,
    TARGET_TEACHER_PASSWORD
  );
  const seed = await seedFormalCoursePackage(request, platformToken, adminToken);
  expect(seed.packageDraft.title).toBe(
    "Shanghai Eldercare Golden M1 · Synthetic Teaching Baseline"
  );
  for (const label of ELDERCARE_GOLDEN_M1_SYNTHETIC_LABELS) {
    expect(seed.packageDraft.description).toContain(label);
  }

  const demoRound = await createFormalCourseRound(
    request,
    teacherToken,
    studentUser.user_id,
    seed.blueprint,
    seed.baseline.scenario_package.reference
  );
  const browserWrites = captureBrowserWrites(page);

  await page.goto(adminBaseUrl);
  await signInAdminPage(page);
  const adminPackage = page
    .locator(".course-package-card")
    .filter({ hasText: seed.coursePackage.title });
  await expect(adminPackage).toBeVisible();
  await expect(adminPackage.getByText("AVAILABLE", { exact: true })).toBeVisible();
  await expect(adminPackage.getByText(ELDERCARE_GOLDEN_M1_SYNTHETIC_LABELS[0])).toBeVisible();
  await expect(page.getByLabel("tenant admin scoped summary")).toContainText(TARGET_TENANT_ID);

  await page.goto(teacherBaseUrl);
  await signInTeacherPage(page);
  const teacherPackage = page
    .locator('[aria-label="Teacher CoursePackageVersion catalog"] .candidate-card')
    .filter({ hasText: seed.coursePackage.title });
  await expect(teacherPackage).toBeVisible();
  await expect(teacherPackage.getByText("AVAILABLE", { exact: true })).toBeVisible();
  await expect(teacherPackage).toContainText(ELDERCARE_GOLDEN_M1_SYNTHETIC_LABELS[1]);
  await expect(page.getByRole("heading", { name: "M1 教学正式结果" })).toBeVisible();
  await expect(page.getByLabel("Instructor intelligence")).toBeVisible();
  await expect(page.getByRole("button", { name: "创建草稿" })).toBeVisible();
  await expect(teacherPackage).toContainText("Shanghai Eldercare Golden M1");

  await page.goto(studentBaseUrl);
  await signInStudentPage(page);
  await expect(page.getByRole("button", { name: "提交正式决策" })).toBeEnabled();
  const studentDecisionRequest = page.waitForRequest(
    (candidate) =>
      candidate.method() === "POST" &&
      new URL(candidate.url()).pathname === `/api/v1/runs/${demoRound.runId}/rounds/1/decisions`
  );
  await page.getByRole("button", { name: "提交正式决策" }).click();
  await studentDecisionRequest;
  const submittedReceipt = page
    .getByRole("article", { name: "最终提交" })
    .getByText("正式决策已提交", { exact: true });
  await expect(submittedReceipt).toHaveCount(1);
  await expect(submittedReceipt).toBeVisible();

  const settlement = await checkedApiRequest(
    request,
    `/api/v1/runs/${demoRound.runId}/rounds/1/lock`,
    { body: {}, tenantId: TARGET_TENANT_ID, token: teacherToken },
    200
  );
  expect(settlement).toBeDefined();
  await checkedApiRequest(
    request,
    `/api/v1/runs/${demoRound.runId}/rounds/1/settle`,
    { body: {}, tenantId: TARGET_TENANT_ID, token: teacherToken },
    200
  );
  await checkedApiRequest(
    request,
    `/api/v1/runs/${demoRound.runId}/rounds/1/publish`,
    { body: {}, tenantId: TARGET_TENANT_ID, token: teacherToken },
    200
  );
  await page.reload();
  await signInStudentPage(page);
  await expect(page.getByText("published", { exact: true }).last()).toBeVisible();
  const studentText = await page.locator("body").innerText();
  for (const marker of ["state_true", "replay_hash", sourceTenantId]) {
    expect(studentText.toLowerCase()).not.toContain(marker.toLowerCase());
  }

  const nonLoginWrites = browserWrites.filter((entry) => !entry.endsWith("/api/v1/auth/login"));
  expect(nonLoginWrites).toEqual([`POST /api/v1/runs/${demoRound.runId}/rounds/1/decisions`]);
  await test.info().attach("eldercare-shanghai-golden-m1-e4-partial.json", {
    body: JSON.stringify(
      {
        browser_write_allowlist: [
          "POST /api/v1/auth/login",
          `POST /api/v1/runs/${demoRound.runId}/rounds/1/decisions`
        ],
        e4_status: E4_PARTIAL_ONLY,
        formal_course_package_status: seed.coursePackage.status,
        formal_title: seed.coursePackage.title,
        source_tenant_id_hidden_from_student: !studentText.includes(sourceTenantId),
        synthetic_labels: ELDERCARE_GOLDEN_M1_SYNTHETIC_LABELS,
        target_tenant_id: TARGET_TENANT_ID,
        limitation: E4_PARTIAL_ONLY_REASON
      },
      null,
      2
    ),
    contentType: "application/json"
  });
});
