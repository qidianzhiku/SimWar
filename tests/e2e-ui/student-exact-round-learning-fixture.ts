import { createHash } from "node:crypto";
import {
  closeSync,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import type { Server } from "node:http";
import type { ViteDevServer } from "vite";
import { expect, type APIRequestContext } from "@playwright/test";
import type {
  AuthSession,
  CourseBlueprintReference,
  CoursePackageVersion,
  D2CaptureReceipt,
  D2ExactRef,
  D2EvidenceListDto,
  LearningGoalVersion,
  P0DemoState,
  ParameterSetReference,
  RoundContinuationResult,
  RubricVersion,
  ScenarioPackageReference,
  StudentLearningReportPublicListDto,
  StudentRoleWorkflowMergeDTO,
  TeacherConfirmationContext,
  TeacherConfirmationWorkClaim,
  TeacherRoleWorkflowWorkspaceDTO,
  W3OfficialConsequenceResponse
} from "@simwar/shared-contracts";
import { compileShanghaiEldercareScenarioAsset } from "@simwar/simulation-core";
import {
  calculateEldercareGoldenM1AssetHash,
  createEldercareGoldenM1BlueprintDraft,
  createEldercareGoldenM1CoursePackageDraft,
  createEldercareGoldenM1ParameterDraft,
  createEldercareGoldenM1PluginDraft,
  createEldercareGoldenM1ScenarioDraft,
  type EldercareGoldenM1AdapterInput
} from "../../services/api/src/eldercare-golden-m1";

export const tenantId = "tenant_demo";
export const fixturePassword = "mlearn_d4_synthetic_fixture_only";

export type ExactScope = {
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  round_id: string;
  round_no: string;
  role_key: "CEO";
  activity_id: string;
};

// An exclusive creator owns one descriptor through STARTED and READY. Reopen
// never writes and never replays a partial business write epoch.
export function writeOwnedFixtureReceipt(fd: number, path: string, value: unknown) {
  const owned = fstatSync(fd);
  const named = lstatSync(path);
  if (
    !owned.isFile() ||
    !named.isFile() ||
    named.isSymbolicLink() ||
    owned.dev !== named.dev ||
    owned.ino !== named.ino ||
    owned.nlink !== 1
  )
    throw new Error("FIXTURE_RECEIPT_OWNERSHIP_LOST");
  const bytes = Buffer.from(JSON.stringify(value));
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(fd, bytes, offset, bytes.length - offset, offset);
    if (written <= 0) throw new Error("FIXTURE_RECEIPT_WRITE_INCOMPLETE");
    offset += written;
  }
  ftruncateSync(fd, bytes.length);
  fsyncSync(fd);
}

export function acquireFixtureReceipt(path: string, specHash: string) {
  mkdirSync(dirname(path), { recursive: true });
  let writer: number;
  try {
    writer = openSync(path, "wx+", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const reader = openSync(path, "r");
    try {
      const opened = fstatSync(reader);
      const named = lstatSync(path);
      if (
        !opened.isFile() ||
        !named.isFile() ||
        named.isSymbolicLink() ||
        opened.dev !== named.dev ||
        opened.ino !== named.ino ||
        opened.nlink !== 1
      )
        throw new Error("FIXTURE_RECEIPT_OWNERSHIP_LOST");
      const previous = JSON.parse(readFileSync(reader, "utf8")) as {
        state: string;
        spec_hash: string;
        scope: ExactScope;
        r2: string;
        user: string;
        ceo_username: string;
      };
      if (
        previous.state !== "READY" ||
        previous.spec_hash !== specHash ||
        !previous.scope ||
        !previous.r2 ||
        !previous.user ||
        !previous.ceo_username
      )
        throw new Error("FIXTURE_PARTIAL_OR_CHANGED_NO_AUTOMATIC_WRITE_REPLAY");
      return { writer: null, previous };
    } finally {
      closeSync(reader);
    }
  }
  try {
    writeOwnedFixtureReceipt(writer, path, { state: "STARTED", spec_hash: specHash });
    return { writer, previous: null };
  } catch (error) {
    closeSync(writer);
    throw error;
  }
}

// No test registration or producer work occurs on import. Each explicit call
// owns its state, store, receipt and live product surfaces.
export async function createExactRoundLearningFixture(
  request: APIRequestContext,
  options: { receiptPath: string; sourceHash: string }
) {
  let api = "";
  let student = "";
  let ownedApi: Server | undefined;
  let ownedStudent: ViteDevServer | undefined;

  const sourceTenantName = "mlearn-d4-exact-source";
  const version = "1.0.0";
  const pluginPackageId = "plugin_wellness_eldercare_v1";
  const sourceParameterId = "mlearn_d4_exact_source_parameter";
  const sourceScenarioId = "mlearn_d4_exact_source_scenario";
  const ownerDecisionId = "SIMWAR-MAIN-M-LEARN-D2-EXACT-D4-PRODUCER-RECOVERY-OWNER-20261009-01";

  type AuthorityRef = {
    content_digest: string;
    version: string;
    tenant_id?: string;
    [key: string]: string | undefined;
  };

  type BaselineResult = {
    outcome: string;
    parameter_set: { reference: ParameterSetReference };
    scenario_package: { reference: ScenarioPackageReference };
  };

  type FormalSeed = {
    blueprint: CourseBlueprintReference;
    coursePackage: CoursePackageVersion;
    suffix: string;
  };

  type LearningDesignRefs = {
    coursePackage: D2ExactRef;
    goal: D2ExactRef;
    rubric: D2ExactRef;
  };

  const initialScope: ExactScope = {
    tenant_id: tenantId,
    course_id: "",
    run_id: "",
    team_id: "",
    round_id: "",
    round_no: "1",
    role_key: "CEO",
    activity_id: "activity_consequence"
  };
  let scope = initialScope;
  let r2 = "";
  let user = "";
  let ceoUsername = "";

  function sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  function exactRef(
    resourceType: D2ExactRef["resource_type"],
    resourceId: string,
    resourceVersion: string,
    contentDigest: string
  ): D2ExactRef {
    return {
      content_digest: contentDigest,
      discriminator: "exact_ref",
      resource_id: resourceId,
      resource_type: resourceType,
      tenant_id: tenantId,
      version: resourceVersion
    };
  }

  function exactEntry(): URLSearchParams {
    return new URLSearchParams({ w3: "true", ...scope });
  }

  type EvidenceSetRef = {
    readonly content_digest: string;
    readonly resource_id: string;
    readonly resource_type: string;
    readonly tenant_id: string;
    readonly version: string;
  };

  function evidenceSetDigest(refs: readonly EvidenceSetRef[]): string {
    const normalized = refs
      .map((ref) => ({
        content_digest: ref.content_digest,
        resource_id: ref.resource_id,
        resource_type: ref.resource_type,
        tenant_id: ref.tenant_id,
        version: ref.version
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    return sha256(JSON.stringify(normalized));
  }

  async function requestData<T>(
    request: APIRequestContext,
    path: string,
    token?: string,
    method = "GET",
    data?: unknown,
    requestTenantId = tenantId
  ): Promise<T> {
    const response = await request.fetch(api + path, {
      method,
      data,
      headers: {
        "x-tenant-id": requestTenantId,
        ...(token ? { authorization: `Bearer ${token}` } : {})
      }
    });
    expect(response.status(), path).toBeGreaterThanOrEqual(200);
    expect(response.status(), path).toBeLessThan(300);
    return ((await response.json()) as { data: T }).data;
  }

  async function loginApi(
    request: APIRequestContext,
    requestTenantId: string,
    username: string,
    password = username
  ): Promise<AuthSession> {
    return requestData<AuthSession>(
      request,
      "/api/v1/auth/login",
      undefined,
      "POST",
      { username, password },
      requestTenantId
    );
  }

  async function createFixtureLearner(
    request: APIRequestContext,
    adminToken: string,
    suffix: string,
    role: string
  ): Promise<AuthSession> {
    const username = `mlearn_${suffix}_${role.toLowerCase()}`;
    const created = await requestData<{ user_id: string }>(
      request,
      "/api/v1/admin/users",
      adminToken,
      "POST",
      {
        username,
        email: `${username}@example.invalid`,
        password: fixturePassword,
        display_name: `Synthetic M-Learn ${role}`,
        roles: role === "CEO" ? ["learner", "team_captain"] : ["learner"]
      }
    );
    const session = await loginApi(request, tenantId, username, fixturePassword);
    expect(session.user.user_id).toBe(created.user_id);
    if (role === "CEO") ceoUsername = username;
    return session;
  }

  async function startOwnedProductSurface(root: string): Promise<void> {
    // This is the real repository API and Student app, not a route mock or a
    // response substitute. A per-spec store prevents global immutable-fixture
    // collisions when the normal CI browser suite runs earlier producer specs.
    const storePath = resolve(root, "runtime", "simwar-store.json");
    mkdirSync(dirname(storePath), { recursive: true });
    const previousStore = process.env.SIMWAR_STORE_FILE;
    process.env.SIMWAR_STORE_FILE = storePath;
    try {
      const { createP1Store } = await import("../../services/api/src/store");
      const { createApiServer } = await import("../../services/api/src/server");
      const { createJsonRepositoryProvider } =
        await import("../../services/api/src/repository-provider");
      const store = createP1Store({ persistenceFile: storePath });
      ownedApi = createApiServer(store, {
        repositoryProvider: createJsonRepositoryProvider({ store }),
        env: {
          APP_ENV: "test",
          JWT_SECRET: "test-mlearn-fixture-jwt-with-sufficient-length",
          INTERNAL_SERVICE_TOKEN: "test-mlearn-fixture-internal-token"
        }
      });
      await new Promise<void>((yes, no) => {
        ownedApi!.once("error", no);
        ownedApi!.listen(0, "127.0.0.1", () => {
          ownedApi!.off("error", no);
          yes();
        });
      });
      const address = ownedApi.address();
      if (!address || typeof address === "string") throw new Error("OWNED_API_ADDRESS_UNAVAILABLE");
      api = `http://127.0.0.1:${address.port}`;
    } finally {
      if (previousStore === undefined) delete process.env.SIMWAR_STORE_FILE;
      else process.env.SIMWAR_STORE_FILE = previousStore;
    }
    const { createServer } = await import("vite");
    const previousBase = process.env.VITE_API_BASE_URL;
    process.env.VITE_API_BASE_URL = api;
    try {
      ownedStudent = await createServer({
        root: resolve(process.cwd(), "apps/student"),
        cacheDir: resolve(root, "vite-cache"),
        server: { host: "127.0.0.1", port: 0, strictPort: true }
      });
      await ownedStudent.listen();
      const address = ownedStudent.httpServer?.address();
      if (!address || typeof address === "string")
        throw new Error("OWNED_STUDENT_ADDRESS_UNAVAILABLE");
      student = `http://127.0.0.1:${address.port}`;
    } finally {
      if (previousBase === undefined) delete process.env.VITE_API_BASE_URL;
      else process.env.VITE_API_BASE_URL = previousBase;
    }
  }

  async function transition(
    request: APIRequestContext,
    path: string,
    body: unknown,
    token: string,
    requestTenantId: string
  ): Promise<void> {
    await requestData(request, path, token, "POST", body, requestTenantId);
  }

  function adapterInput(
    targetTenantId: string,
    sourceTenantId: string,
    overrides: Partial<EldercareGoldenM1AdapterInput> = {}
  ): EldercareGoldenM1AdapterInput {
    const compiledAsset = compileShanghaiEldercareScenarioAsset();
    const asset = {
      ...compiledAsset,
      parameter_set: { ...compiledAsset.parameter_set, tenant_id: sourceTenantId },
      scenario_package: { ...compiledAsset.scenario_package, tenant_id: sourceTenantId }
    };
    asset.asset_hash = calculateEldercareGoldenM1AssetHash(asset);
    return {
      artifact_ids: {
        parameter_set_id: sourceParameterId,
        scenario_package_id: sourceScenarioId,
        plugin_package_id: pluginPackageId,
        course_blueprint_id: "mlearn_d4_exact_blueprint",
        course_package_id: "mlearn_d4_exact_package",
        version,
        ...overrides.artifact_ids
      },
      source_tenant_id: sourceTenantId,
      target_tenant_id: targetTenantId,
      asset,
      provenance: { asset_hash: asset.asset_hash },
      ...overrides
    } satisfies EldercareGoldenM1AdapterInput;
  }

  async function ensureSourceTenant(
    request: APIRequestContext,
    platformToken: string
  ): Promise<string> {
    const existing = await requestData<Array<{ domain?: string; tenant_id?: string }>>(
      request,
      "/api/v1/admin/tenants",
      platformToken,
      "GET",
      undefined,
      "tenant_platform"
    );
    const domain = `${sourceTenantName}.simwar.local`;
    const found = existing.find((tenant) => tenant.domain === domain);
    if (found?.tenant_id) return found.tenant_id;
    const created = await requestData<{ tenant_id: string }>(
      request,
      "/api/v1/admin/tenants",
      platformToken,
      "POST",
      { domain, name: "M-Learn D4 exact-round synthetic source" },
      "tenant_platform"
    );
    expect(created.tenant_id).toBeTruthy();
    return created.tenant_id;
  }

  async function createAvailablePlugin(
    request: APIRequestContext,
    platformToken: string,
    input: EldercareGoldenM1AdapterInput
  ): Promise<void> {
    const created = await requestData<{ reference: AuthorityRef }>(
      request,
      "/api/v1/formal-authority/plugin-releases",
      platformToken,
      "POST",
      createEldercareGoldenM1PluginDraft(input),
      "tenant_platform"
    );
    const reference = created.reference;
    const path = (action: string) =>
      `/api/v1/formal-authority/plugin-releases/${pluginPackageId}/versions/${version}/${action}`;
    await transition(request, path("validate"), reference, platformToken, "tenant_platform");
    await transition(
      request,
      path("approve"),
      { ...reference, owner_decision_id: ownerDecisionId },
      platformToken,
      "tenant_platform"
    );
    await transition(
      request,
      path("make-available"),
      { ...reference, availability_decision_id: ownerDecisionId },
      platformToken,
      "tenant_platform"
    );
  }

  async function createApprovedSourceAuthorities(
    request: APIRequestContext,
    platformToken: string,
    input: EldercareGoldenM1AdapterInput,
    sourceTenantId: string
  ): Promise<{ parameter: ParameterSetReference; scenario: ScenarioPackageReference }> {
    const parameterCreated = await requestData<{ reference: ParameterSetReference }>(
      request,
      "/api/v1/formal-authority/parameter-sets",
      platformToken,
      "POST",
      { ...createEldercareGoldenM1ParameterDraft(input), tenant_id: sourceTenantId },
      sourceTenantId
    );
    const parameter = parameterCreated.reference;
    const parameterPath = (action: string) =>
      `/api/v1/formal-authority/parameter-sets/${sourceParameterId}/versions/${version}/${action}`;
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
        approval_id: "mlearn-d4-source-parameter-approval",
        tenant_id: sourceTenantId
      },
      platformToken,
      sourceTenantId
    );

    const scenarioCreated = await requestData<{ reference: ScenarioPackageReference }>(
      request,
      "/api/v1/formal-authority/scenario-packages",
      platformToken,
      "POST",
      {
        ...createEldercareGoldenM1ScenarioDraft({
          ...input,
          parameter_set_reference: parameter
        }),
        parameter_set_reference: parameter,
        tenant_id: sourceTenantId
      },
      sourceTenantId
    );
    const scenario = scenarioCreated.reference;
    const scenarioPath = (action: string) =>
      `/api/v1/formal-authority/scenario-packages/${sourceScenarioId}/versions/${version}/${action}`;
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
      { ...scenario, approval_id: "mlearn-d4-source-scenario-approval", tenant_id: sourceTenantId },
      platformToken,
      sourceTenantId
    );
    return { parameter, scenario };
  }

  async function seedFormalCoursePackage(
    request: APIRequestContext,
    platformToken: string,
    adminToken: string,
    sourceTenantId: string
  ): Promise<FormalSeed> {
    const suffix = Date.now().toString(36);
    const input = adapterInput(tenantId, sourceTenantId);
    await createAvailablePlugin(request, platformToken, input);
    const source = await createApprovedSourceAuthorities(
      request,
      platformToken,
      input,
      sourceTenantId
    );
    const baseline = await requestData<BaselineResult>(
      request,
      "/api/v1/admin/tenant-baselines/provision",
      platformToken,
      "POST",
      {
        idempotency_key: `mlearn_d4_baseline_${suffix}`,
        source_parameter_set: { ...source.parameter, source_tenant_id: sourceTenantId },
        source_scenario_package: {
          ...source.scenario,
          source_tenant_id: sourceTenantId,
          tenant_id: sourceTenantId
        },
        target_tenant_id: tenantId
      },
      "tenant_platform"
    );
    expect(baseline.outcome).toBe("CREATED");

    const targetInput = adapterInput(tenantId, sourceTenantId, {
      artifact_ids: {
        parameter_set_id: baseline.parameter_set.reference.parameter_set_id,
        scenario_package_id: baseline.scenario_package.reference.scenario_package_id,
        course_blueprint_id: `mlearn_d4_exact_blueprint_${suffix}`,
        course_package_id: `mlearn_d4_exact_package_${suffix}`
      },
      parameter_set_reference: baseline.parameter_set.reference,
      scenario_package_reference: baseline.scenario_package.reference
    });
    const blueprintDraft = createEldercareGoldenM1BlueprintDraft(targetInput);
    const blueprintCreated = await requestData<{ reference: CourseBlueprintReference }>(
      request,
      "/api/v1/formal-authority/course-blueprints",
      platformToken,
      "POST",
      {
        ...blueprintDraft,
        required_product_capabilities: ["course:create", "decision_submit", "round_publish"],
        scenario_compatibility_constraints: blueprintDraft.scenario_compatibility_constraints
      },
      tenantId
    );
    const blueprint = blueprintCreated.reference;
    const blueprintPath = (action: string) =>
      `/api/v1/formal-authority/course-blueprints/${blueprint.course_blueprint_id}/versions/${version}/${action}`;
    await transition(request, blueprintPath("validate"), blueprint, platformToken, tenantId);
    await transition(request, blueprintPath("freeze"), blueprint, platformToken, tenantId);
    await transition(
      request,
      blueprintPath("approve"),
      { ...blueprint, approval_id: "mlearn-d4-blueprint-approval" },
      platformToken,
      tenantId
    );

    const packageDraft = createEldercareGoldenM1CoursePackageDraft({
      ...targetInput,
      course_blueprint_reference: blueprint
    });
    const packageCreated = await requestData<CoursePackageVersion>(
      request,
      "/api/v1/admin/course-package-versions/drafts",
      adminToken,
      "POST",
      packageDraft,
      tenantId
    );
    const packageReference = {
      content_digest: packageCreated.content_digest,
      course_package_id: packageCreated.course_package_id,
      version: packageCreated.version
    };
    await transition(
      request,
      `/api/v1/admin/course-package-versions/${packageReference.course_package_id}/versions/${version}/validate`,
      packageReference,
      adminToken,
      tenantId
    );
    const coursePackage = await requestData<CoursePackageVersion>(
      request,
      `/api/v1/admin/course-package-versions/${packageReference.course_package_id}/versions/${version}/make-available`,
      adminToken,
      "POST",
      packageReference,
      tenantId
    );
    expect(coursePackage.status).toBe("AVAILABLE");
    return { blueprint, coursePackage, suffix };
  }

  async function publishLearningDesign(
    request: APIRequestContext,
    teacherToken: string,
    packageVersion: CoursePackageVersion,
    suffix: string
  ): Promise<LearningDesignRefs> {
    const packageReference = {
      content_digest: packageVersion.content_digest,
      course_package_id: packageVersion.course_package_id,
      tenant_id: tenantId,
      version: packageVersion.version
    };
    const activityReference = {
      activity_id: "activity_consequence",
      content_digest: sha256(`mlearn-d4-activity:${suffix}`),
      version
    };
    const goal = await requestData<LearningGoalVersion>(
      request,
      "/api/v1/bff/teacher/learning-goals/drafts",
      teacherToken,
      "POST",
      {
        activity_refs: [activityReference],
        course_package_reference: packageReference,
        expected_evidence_classes: ["reflection"],
        goal_id: `mlearn_d4_goal_${suffix}`,
        observable_behaviors: ["Connect one exact published round to one bounded reflection."],
        role_scope: ["CEO"],
        statement: "The learner explains the decision consequence from the exact round context.",
        title: "M-Learn exact-round consequence reflection",
        version
      },
      tenantId
    );
    const goalPlainReference = {
      content_digest: goal.content_digest,
      goal_id: goal.goal_id,
      tenant_id: tenantId,
      version: goal.version
    };
    await transition(
      request,
      `/api/v1/bff/teacher/learning-goals/${goal.goal_id}/versions/${goal.version}/validate`,
      { content_digest: goal.content_digest },
      teacherToken,
      tenantId
    );
    await transition(
      request,
      `/api/v1/bff/teacher/learning-goals/${goal.goal_id}/versions/${goal.version}/publish`,
      { content_digest: goal.content_digest },
      teacherToken,
      tenantId
    );

    const rubric = await requestData<RubricVersion>(
      request,
      "/api/v1/bff/teacher/rubrics/drafts",
      teacherToken,
      "POST",
      {
        course_package_reference: packageReference,
        criteria: [
          {
            criterion_id: `mlearn_d4_criterion_${suffix}`,
            levels: [
              {
                description: "The explanation is present but not tied to the exact round.",
                label: "Emerging",
                ordinal: 1
              },
              {
                description: "The explanation names the exact round and bounded consequence.",
                label: "Exact",
                ordinal: 2
              }
            ],
            prompt: "Does the reflection use the exact published round evidence?"
          }
        ],
        learning_goal_references: [goalPlainReference],
        rubric_id: `mlearn_d4_rubric_${suffix}`,
        title: "M-Learn exact-round consequence rubric",
        version
      },
      tenantId
    );
    await transition(
      request,
      `/api/v1/bff/teacher/rubrics/${rubric.rubric_id}/versions/${rubric.version}/validate`,
      { content_digest: rubric.content_digest },
      teacherToken,
      tenantId
    );
    await transition(
      request,
      `/api/v1/bff/teacher/rubrics/${rubric.rubric_id}/versions/${rubric.version}/publish`,
      { content_digest: rubric.content_digest },
      teacherToken,
      tenantId
    );
    return {
      coursePackage: exactRef(
        "course_package_version",
        packageVersion.course_package_id,
        packageVersion.version,
        packageVersion.content_digest
      ),
      goal: exactRef("learning_goal_version", goal.goal_id, goal.version, goal.content_digest),
      rubric: exactRef("rubric_version", rubric.rubric_id, rubric.version, rubric.content_digest)
    };
  }

  async function createFormalCourseAndRun(
    request: APIRequestContext,
    teacherToken: string,
    studentUserId: string,
    cfoUserId: string,
    cmoUserId: string,
    cooUserId: string,
    blueprint: CourseBlueprintReference,
    scenario: ScenarioPackageReference,
    suffix: string
  ): Promise<{ courseId: string; teamId: string; runId: string; roundId: string }> {
    const course = await requestData<{ course: { course_id: string } }>(
      request,
      "/api/v1/bff/teacher/course-blueprint-courses",
      teacherToken,
      "POST",
      {
        course_blueprint_reference: blueprint,
        scenario_package_reference: scenario,
        title: `M-Learn exact-round course ${suffix}`
      },
      tenantId
    );
    const courseId = course.course.course_id;
    await requestData(
      request,
      `/api/v1/courses/${courseId}/publish`,
      teacherToken,
      "POST",
      {},
      tenantId
    );
    const team = await requestData<{ team_id: string }>(
      request,
      `/api/v1/courses/${courseId}/teams`,
      teacherToken,
      "POST",
      { captain_user_id: studentUserId, name: `M-Learn exact-round team ${suffix}` },
      tenantId
    );
    for (const member of [
      { role_slot: "CFO", user_id: cfoUserId },
      { role_slot: "CMO", user_id: cmoUserId },
      { role_slot: "COO", user_id: cooUserId }
    ]) {
      await requestData(
        request,
        `/api/v1/courses/${courseId}/teams/${team.team_id}/members`,
        teacherToken,
        "POST",
        member,
        tenantId
      );
    }
    const created = await requestData<{
      round: { round_id: string; round_no: number };
      run: { run_id: string };
    }>(
      request,
      `/api/v1/courses/${courseId}/runs`,
      teacherToken,
      "POST",
      { formal_runtime_seed: 20261010 },
      tenantId
    );
    const started = await requestData<{ round_id: string; round_no: number }>(
      request,
      `/api/v1/runs/${created.run.run_id}/rounds/1/start`,
      teacherToken,
      "POST",
      {},
      tenantId
    );
    expect(started.round_no).toBe(1);
    return {
      courseId,
      teamId: team.team_id,
      runId: created.run.run_id,
      roundId: started.round_id
    };
  }

  async function dispose(): Promise<void> {
    try {
      await ownedStudent?.close();
    } finally {
      if (ownedApi?.listening) {
        ownedApi.closeAllConnections();
        await new Promise<void>((yes, no) =>
          ownedApi!.close((error) => (error ? no(error) : yes()))
        );
      }
    }
  }
  function result() {
    return {
      api,
      student,
      scope,
      r2,
      user,
      ceoUsername,
      tenantId,
      fixturePassword,
      requestData,
      loginApi,
      exactEntry,
      dispose
    };
  }

  try {
    const { receiptPath, sourceHash: specHash } = options;
    const acquired = acquireFixtureReceipt(receiptPath, specHash);
    if (acquired.previous) {
      const previous = acquired.previous;
      await startOwnedProductSurface(dirname(receiptPath));
      scope = previous.scope;
      r2 = previous.r2;
      user = previous.user;
      ceoUsername = previous.ceo_username;
      const session = await loginApi(request, tenantId, ceoUsername, fixturePassword);
      expect(session.user.user_id).toBe(user);
      const state = await requestData<P0DemoState>(
        request,
        "/api/v1/demo-state",
        session.access_token
      );
      expect(state.current_user.team_id).toBe(scope.team_id);
      expect(state.rounds.find((round) => round.round_id === scope.round_id)).toMatchObject({
        run_id: scope.run_id,
        round_no: 1,
        status: "published"
      });
      expect(state.rounds.find((round) => round.round_id === r2)).toMatchObject({
        run_id: scope.run_id,
        round_no: 2,
        status: "open"
      });
      const reports = await requestData<StudentLearningReportPublicListDto>(
        request,
        "/api/v1/bff/student/learning-reports",
        session.access_token
      );
      expect(
        reports.reports.some(
          (report) =>
            report.context.round_id === scope.round_id &&
            report.context.team_id === scope.team_id &&
            report.context.role_key === scope.role_key
        )
      ).toBe(true);
      return result();
    }
    const receiptWriter = acquired.writer!;
    try {
      await startOwnedProductSurface(dirname(receiptPath));
      const platform = await loginApi(request, "tenant_platform", "platform");
      const teacher = await loginApi(request, tenantId, "teacher");
      const admin = await loginApi(request, tenantId, "admin");
      const sourceTenantId = await ensureSourceTenant(request, platform.access_token);
      const seed = await seedFormalCoursePackage(
        request,
        platform.access_token,
        admin.access_token,
        sourceTenantId
      );
      // Existing demo users already belong to team_alpha; do not transfer or reuse
      // their memberships. Create synthetic identities through the real admin API.
      const ceo = await createFixtureLearner(request, admin.access_token, seed.suffix, "CEO");
      const cfo = await createFixtureLearner(request, admin.access_token, seed.suffix, "CFO");
      const cmo = await createFixtureLearner(request, admin.access_token, seed.suffix, "CMO");
      const coo = await createFixtureLearner(request, admin.access_token, seed.suffix, "COO");
      user = ceo.user.user_id;
      const design = await publishLearningDesign(
        request,
        teacher.access_token,
        seed.coursePackage,
        seed.suffix
      );
      const created = await createFormalCourseAndRun(
        request,
        teacher.access_token,
        ceo.user.user_id,
        cfo.user.user_id,
        cmo.user.user_id,
        coo.user.user_id,
        seed.blueprint,
        {
          content_digest: seed.coursePackage.scenario_package_reference.content_digest,
          scenario_package_id: seed.coursePackage.scenario_package_reference.scenario_package_id,
          tenant_id: tenantId,
          version: seed.coursePackage.scenario_package_reference.version
        },
        seed.suffix
      );
      scope = {
        tenant_id: tenantId,
        course_id: created.courseId,
        run_id: created.runId,
        team_id: created.teamId,
        round_id: created.roundId,
        round_no: "1",
        role_key: "CEO",
        activity_id: "activity_consequence"
      };
      const roleScope = {
        round_id: scope.round_id,
        run_id: scope.run_id,
        team_id: scope.team_id
      };
      const roleUsers = [
        { role_key: "CEO", session: ceo },
        { role_key: "CFO", session: cfo },
        { role_key: "CMO", session: cmo },
        { role_key: "COO", session: coo }
      ] as const;
      for (const role of roleUsers) {
        await requestData(
          request,
          "/api/v1/bff/teacher/role-workflows/assignments",
          teacher.access_token,
          "PUT",
          {
            course_id: scope.course_id,
            role_key: role.role_key,
            run_id: scope.run_id,
            team_id: scope.team_id,
            user_id: role.session.user.user_id
          },
          tenantId
        );
      }
      const workspacePath = `/api/v1/bff/teacher/role-workflows?${new URLSearchParams(roleScope)}`;
      const workspace = await requestData<TeacherRoleWorkflowWorkspaceDTO>(
        request,
        workspacePath,
        teacher.access_token
      );
      for (const role of roleUsers) {
        expect(
          workspace.assignments.filter(
            (assignment) =>
              assignment.tenant_id === tenantId &&
              assignment.course_id === scope.course_id &&
              assignment.run_id === scope.run_id &&
              assignment.team_id === scope.team_id &&
              assignment.role_key === role.role_key &&
              assignment.user_id === role.session.user.user_id &&
              assignment.status === "active"
          )
        ).toHaveLength(1);
      }

      const rolePayloads = [
        {
          role_key: "CEO",
          payload: { strategy_statement: "Read the exact R1 consequence." },
          session: ceo
        },
        {
          role_key: "CFO",
          payload: { cash_buffer_target: 0.2, service_quality_budget: 125000 },
          session: cfo
        },
        {
          role_key: "CMO",
          payload: { marketing_budget: 150000, pricing: { base_price: 12800 } },
          session: cmo
        },
        { role_key: "COO", payload: { capacity_plan: "expand" }, session: coo }
      ] as const;
      for (const role of rolePayloads) {
        const saved = await requestData<{ version: number; status: string }>(
          request,
          "/api/v1/bff/student/role-workspace/section",
          role.session.access_token,
          "PUT",
          { ...roleScope, expected_version: 0, payload: role.payload },
          tenantId
        );
        expect(saved.status).toBe("draft");
        const ready = await requestData<{ version: number; status: string }>(
          request,
          "/api/v1/bff/student/role-workspace/ready",
          role.session.access_token,
          "POST",
          { ...roleScope, expected_version: saved.version },
          tenantId
        );
        expect(ready.status).toBe("ready");
      }

      const query = new URLSearchParams({
        activity_id: scope.activity_id,
        course_id: scope.course_id,
        role_key: scope.role_key,
        round_id: scope.round_id,
        round_no: scope.round_no,
        run_id: scope.run_id,
        team_id: scope.team_id
      });
      const evidence = await requestData<D2EvidenceListDto>(
        request,
        `/api/v1/bff/teacher/evidence?${query}`,
        teacher.access_token
      );
      const sourceEvent = evidence.eligible_events.find(
        (event) => event.event_type === "section_ready" && event.scope.role_key === scope.role_key
      );
      if (!sourceEvent) throw new Error("real exact-R1 section_ready event was not returned");
      const capture = await requestData<D2CaptureReceipt>(
        request,
        "/api/v1/bff/teacher/evidence-artifacts/capture",
        teacher.access_token,
        "POST",
        {
          activity_id: scope.activity_id,
          course_id: scope.course_id,
          course_package_ref: design.coursePackage,
          learning_goal_ref: design.goal,
          role_key: scope.role_key,
          round_id: scope.round_id,
          round_no: 1,
          rubric_ref: design.rubric,
          run_id: scope.run_id,
          source_event_id: sourceEvent.event_id,
          team_id: scope.team_id
        },
        tenantId
      );
      expect(capture.data.status).toBe("generated");
      expect(capture.data.artifact.context).toEqual({
        activity_id: scope.activity_id,
        course_id: scope.course_id,
        run_id: scope.run_id,
        team_id: scope.team_id,
        role_key: scope.role_key,
        round_id: scope.round_id,
        round_no: 1
      });
      const evidenceRef = capture.data.artifact.artifact_ref;
      expect(evidenceRef.resource_type).toBe("evidence_artifact");
      expect(evidenceRef.tenant_id).toBe(scope.tenant_id);
      expect(evidenceRef.content_digest).toBe(capture.data.artifact.artifact_digest);

      const confirmationContext: TeacherConfirmationContext = {
        course_id: scope.course_id,
        role_key: scope.role_key,
        round_id: scope.round_id,
        round_no: 1,
        run_id: scope.run_id,
        team_id: scope.team_id
      };
      const claim = await requestData<{ claim: TeacherConfirmationWorkClaim }>(
        request,
        "/api/v1/bff/teacher/confirmations/claims",
        teacher.access_token,
        "POST",
        {
          context: confirmationContext,
          evidence_set_digest: evidenceSetDigest([evidenceRef]),
          ttl_seconds: 600
        },
        tenantId
      );
      const confirmationId = `mlearn_d4_confirmation_${seed.suffix}`;
      const draft = await requestData<{
        data: { confirmation: { status: string; context: TeacherConfirmationContext } };
      }>(
        request,
        "/api/v1/bff/teacher/confirmations/drafts",
        teacher.access_token,
        "POST",
        {
          claim_id: claim.claim.claim_id,
          confirmation_id: confirmationId,
          course_package_ref: design.coursePackage,
          learning_goal_ref: design.goal,
          rubric_ref: design.rubric,
          evidence_refs: [evidenceRef],
          context: confirmationContext,
          criterion_decisions: [
            { criterion_id: `mlearn_d4_criterion_${seed.suffix}`, level_ordinal: 2 }
          ],
          teacher_feedback:
            "Confirmed against exact R1 evidence; official outcome remains unavailable until publication.",
          idempotency_key: `mlearn_d4_confirmation_write_${seed.suffix}`
        },
        tenantId
      );
      expect(draft.data.confirmation.status).toBe("DRAFT");
      const confirmed = await requestData<{
        data: { confirmation: { status: string; context: TeacherConfirmationContext } };
      }>(
        request,
        `/api/v1/bff/teacher/confirmations/${confirmationId}/confirm`,
        teacher.access_token,
        "POST",
        { claim_id: claim.claim.claim_id },
        tenantId
      );
      expect(confirmed.data.confirmation.status).toBe("CONFIRMED");
      expect(confirmed.data.confirmation.context).toEqual(confirmationContext);

      const merge = await requestData<StudentRoleWorkflowMergeDTO>(
        request,
        "/api/v1/bff/student/role-workspace/merge",
        ceo.access_token,
        "POST",
        roleScope,
        tenantId
      );
      expect(merge.merge_commit_id).toBeTruthy();
      const teamConfirmation = await requestData<{ team_confirmation_id: string }>(
        request,
        "/api/v1/bff/student/role-workspace/confirm",
        ceo.access_token,
        "POST",
        { ...roleScope, merge_commit_id: merge.merge_commit_id },
        tenantId
      );
      expect(teamConfirmation.team_confirmation_id).toBeTruthy();
      const locked = await requestData<{ status: string }>(
        request,
        `/api/v1/runs/${scope.run_id}/rounds/1/lock`,
        teacher.access_token,
        "POST",
        {},
        tenantId
      );
      expect(locked.status).toBe("locked");
      const settlement = await requestData<{ replay_hash: string }>(
        request,
        `/api/v1/runs/${scope.run_id}/rounds/1/settle`,
        teacher.access_token,
        "POST",
        {},
        tenantId
      );
      expect(settlement.replay_hash).toMatch(/^[a-f0-9]{64}$/);
      const published = await requestData<{ status: string }>(
        request,
        `/api/v1/runs/${scope.run_id}/rounds/1/publish`,
        teacher.access_token,
        "POST",
        {},
        tenantId
      );
      expect(published.status).toBe("published");
      const selectedEvidence = await requestData<W3OfficialConsequenceResponse>(
        request,
        "/api/v1/bff/teacher/w3/evidence-selection",
        teacher.access_token,
        "POST",
        {
          context: { ...scope, round_no: 1 },
          evidence_refs: [evidenceRef],
          idempotency_key: `mlearn_d4_selection_${seed.suffix}`
        }
      );
      expect(selectedEvidence.record.learning.evidence_selection_status).toBe("SELECTED");

      const continued = await requestData<RoundContinuationResult>(
        request,
        `/api/v1/runs/${scope.run_id}/rounds/1/continue`,
        teacher.access_token,
        "POST",
        {},
        tenantId
      );
      expect(continued.receipt).toMatchObject({
        outcome: "created",
        predecessor_round_id: scope.round_id,
        round_no: 2,
        run_id: scope.run_id,
        tenant_id: tenantId
      });
      let state = await requestData<P0DemoState>(
        request,
        "/api/v1/demo-state",
        teacher.access_token
      );
      const nextRound = state.rounds.find(
        (round) => round.run_id === scope.run_id && round.round_no === 2
      );
      expect(nextRound?.status).toBe("draft");
      if (!nextRound) throw new Error("real R2 continuation did not return a round");
      await requestData(
        request,
        `/api/v1/runs/${scope.run_id}/rounds/2/start`,
        teacher.access_token,
        "POST",
        {},
        tenantId
      );
      state = await requestData<P0DemoState>(request, "/api/v1/demo-state", ceo.access_token);
      const openR2 = state.rounds.find(
        (round) => round.run_id === scope.run_id && round.round_no === 2
      );
      expect(openR2?.status).toBe("open");
      r2 = openR2!.round_id;
      expect(state.current_user.team_id).toBe(scope.team_id);
      writeOwnedFixtureReceipt(receiptWriter, receiptPath, {
        state: "READY",
        spec_hash: specHash,
        scope,
        r2,
        user,
        ceo_username: ceoUsername
      });
    } finally {
      closeSync(receiptWriter);
    }
    return result();
  } catch (error) {
    await dispose();
    throw error;
  }
}

export type ExactRoundLearningFixture = Awaited<ReturnType<typeof createExactRoundLearningFixture>>;
