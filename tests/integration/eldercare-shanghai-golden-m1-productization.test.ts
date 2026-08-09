import { once } from "node:events";
import { createHash } from "node:crypto";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import { registerSettlementPlugin, wellnessPluginV1 } from "@simwar/simulation-core";
import type {
  ApiEnvelope,
  AuthSession,
  CoursePackageVersion,
  Decision,
  SettlementResult,
  Tenant,
  TenantBaselineProvisioningResult,
  User
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";
import {
  createEldercareGoldenM1BlueprintDraft,
  createEldercareGoldenM1CoursePackageDraft,
  createEldercareGoldenM1ParameterDraft,
  createEldercareGoldenM1PluginDraft,
  createEldercareGoldenM1ScenarioDraft,
  ELDERCARE_GOLDEN_M1_SYNTHETIC_LABELS,
  type EldercareGoldenM1AdapterInput
} from "../../services/api/src/eldercare-golden-m1";

const SOURCE_TENANT_ID = "tenant_r7a_synthetic";
const VERSION = "1.0.0";
const SEED = 20260809;
const PLUGIN_PACKAGE_ID = "plugin_wellness_eldercare_v1";
const SOURCE_PARAMETER_ID = "eldercare_shanghai_source_parameter";
const SOURCE_SCENARIO_ID = "eldercare_shanghai_source_scenario";

function registerEldercareRuntimePlugin(): void {
  // The formal adapter names the R7-A plugin package while the current JSON
  // runtime registry ships the equivalent wellness implementation. Keep this
  // alias in-memory so the HTTP test exercises the formal path without any
  // production or kernel-state writes.
  registerSettlementPlugin({
    ...wellnessPluginV1,
    manifest: {
      ...wellnessPluginV1.manifest,
      adapter_ref: "@simwar/simulation-core/eldercareWellnessPluginV1",
      plugin_id: PLUGIN_PACKAGE_ID
    },
    plugin_id: PLUGIN_PACKAGE_ID
  });
}

type ParameterReference = {
  content_digest: string;
  parameter_set_id: string;
  version: string;
};

type ScenarioReference = {
  content_digest: string;
  scenario_package_id: string;
  tenant_id: string;
  version: string;
};

type BlueprintReference = {
  content_digest: string;
  course_blueprint_id: string;
  tenant_id: string;
  version: string;
};

type ErrorPayload = { code: string; message: string; request_id?: string };

type TenantJourney = {
  tenant: Tenant;
  adminToken: string;
  teacherToken: string;
  studentToken: string;
  studentUserId: string;
};

type JourneyReceipt = {
  courseId: string;
  runId: string;
  teamId: string;
  settlement: SettlementResult;
  studentResult: Record<string, unknown>;
  teacherResult: Record<string, unknown>;
  artifact: Record<string, unknown>;
  exportText: string;
};

async function startServer(
  store: SimWarStore = createP1Store()
): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: { body?: unknown; method?: string; tenantId?: string; token?: string } = {}
): Promise<{ body: T; status: number; headers: Headers }> {
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers: {
      authorization: options.token ? `Bearer ${options.token}` : "",
      "content-type": "application/json",
      "x-tenant-id": options.tenantId ?? "tenant_platform"
    },
    method: options.method ?? (options.body === undefined ? "GET" : "POST")
  });
  const body = (await response.json()) as T;
  return { body, headers: response.headers, status: response.status };
}

async function login(
  baseUrl: string,
  username: string,
  password: string,
  tenantId: string
): Promise<string> {
  const result = await request<ApiEnvelope<AuthSession>>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    tenantId
  });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body.data.access_token;
}

async function createTenant(baseUrl: string, platformToken: string, name: string): Promise<Tenant> {
  const result = await request<ApiEnvelope<Tenant>>(baseUrl, "/api/v1/admin/tenants", {
    body: { domain: `${name}.eldercare-golden.test`, name },
    tenantId: "tenant_platform",
    token: platformToken
  });
  expect(result.status, JSON.stringify(result.body)).toBe(201);
  return result.body.data;
}

async function createUser(
  baseUrl: string,
  platformToken: string,
  input: { tenant_id: string; username: string; password: string; roles: string[] }
): Promise<User> {
  const result = await request<ApiEnvelope<User>>(baseUrl, "/api/v1/admin/users", {
    body: {
      display_name: input.username,
      email: `${input.username}@eldercare-golden.test`,
      password: input.password,
      roles: input.roles,
      tenant_id: input.tenant_id,
      username: input.username
    },
    tenantId: "tenant_platform",
    token: platformToken
  });
  expect(result.status, JSON.stringify(result.body)).toBe(201);
  return result.body.data;
}

async function transition(
  baseUrl: string,
  path: string,
  body: unknown,
  token: string,
  tenantId: string
): Promise<void> {
  const response = await request<ApiEnvelope<unknown>>(baseUrl, path, {
    body,
    method: "POST",
    tenantId,
    token
  });
  expect(response.status, `${path} ${JSON.stringify(response.body)}`).toBe(200);
}

function formalStateDigest(store: SimWarStore): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        parameterApprovals: store.formalParameterSetApprovalRecords,
        parameterSnapshots: store.formalParameterSetLifecycleSnapshots,
        pluginApprovals: store.formalPluginReleaseApprovalRecords,
        pluginAvailability: store.formalPluginReleaseAvailabilityRecords,
        pluginSnapshots: store.formalPluginReleaseLifecycleSnapshots,
        scenarioApprovals: store.formalScenarioPackageApprovalRecords,
        scenarioSnapshots: store.formalScenarioPackageLifecycleSnapshots,
        blueprintApprovals: store.formalCourseBlueprintApprovalRecords,
        blueprintSnapshots: store.formalCourseBlueprintLifecycleSnapshots,
        packageSnapshots: store.coursePackageLifecycleSnapshots
      }),
      "utf8"
    )
    .digest("hex");
}

function formalCounts(store: SimWarStore): Record<string, number> {
  return {
    parameterApprovals: store.formalParameterSetApprovalRecords.length,
    parameterSnapshots: store.formalParameterSetLifecycleSnapshots.length,
    pluginApprovals: store.formalPluginReleaseApprovalRecords.length,
    pluginAvailability: store.formalPluginReleaseAvailabilityRecords.length,
    pluginSnapshots: store.formalPluginReleaseLifecycleSnapshots.length,
    scenarioApprovals: store.formalScenarioPackageApprovalRecords.length,
    scenarioSnapshots: store.formalScenarioPackageLifecycleSnapshots.length,
    blueprintApprovals: store.formalCourseBlueprintApprovalRecords.length,
    blueprintSnapshots: store.formalCourseBlueprintLifecycleSnapshots.length,
    packageSnapshots: store.coursePackageLifecycleSnapshots.length
  };
}

function expectNoFormalWrite(
  store: SimWarStore,
  beforeDigest: string,
  beforeCounts: Record<string, number>
): void {
  expect(formalStateDigest(store)).toBe(beforeDigest);
  expect(formalCounts(store)).toEqual(beforeCounts);
}

function adapterInput(
  targetTenantId: string,
  overrides: Partial<EldercareGoldenM1AdapterInput> = {}
): EldercareGoldenM1AdapterInput {
  return {
    ...overrides,
    artifact_ids: {
      parameter_set_id: SOURCE_PARAMETER_ID,
      scenario_package_id: SOURCE_SCENARIO_ID,
      plugin_package_id: PLUGIN_PACKAGE_ID,
      course_blueprint_id: "eldercare_source_blueprint_unused",
      course_package_id: "eldercare_source_package_unused",
      version: VERSION,
      ...overrides.artifact_ids
    },
    source_tenant_id: overrides.source_tenant_id ?? SOURCE_TENANT_ID,
    target_tenant_id: overrides.target_tenant_id ?? targetTenantId
  };
}

async function createAvailablePlugin(
  baseUrl: string,
  platformToken: string,
  targetTenantId: string
): Promise<void> {
  const draft = createEldercareGoldenM1PluginDraft(adapterInput(targetTenantId));
  const created = await request<ApiEnvelope<{ reference: { content_digest: string } }>>(
    baseUrl,
    "/api/v1/formal-authority/plugin-releases",
    {
      body: draft,
      tenantId: "tenant_platform",
      token: platformToken
    }
  );
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const reference = created.body.data.reference;
  const path = (action: string) =>
    `/api/v1/formal-authority/plugin-releases/${PLUGIN_PACKAGE_ID}/versions/${VERSION}/${action}`;
  await transition(baseUrl, path("validate"), reference, platformToken, "tenant_platform");
  await transition(
    baseUrl,
    path("approve"),
    { ...reference, owner_decision_id: "eldercare-golden-plugin-approval" },
    platformToken,
    "tenant_platform"
  );
  await transition(
    baseUrl,
    path("make-available"),
    { ...reference, availability_decision_id: "eldercare-golden-plugin-availability" },
    platformToken,
    "tenant_platform"
  );
}

async function createApprovedSourceAuthorities(
  baseUrl: string,
  platformToken: string,
  targetTenantId: string
): Promise<{ parameter: ParameterReference; scenario: ScenarioReference }> {
  const input = adapterInput(targetTenantId);
  const parameterDraft = createEldercareGoldenM1ParameterDraft(input);
  const parameterValues = parameterDraft.parameter_values as Record<string, unknown>;
  const runtimeParameterSet = {
    base_capacity: parameterValues.base_capacity,
    base_market_size: parameterValues.base_market_size,
    fixed_cost: parameterValues.fixed_cost,
    model_family: parameterValues.model_family,
    unit_cost: parameterValues.unit_cost
  };
  const sourceParameterDraft = {
    ...parameterDraft,
    parameter_values: {
      ...parameterValues,
      runtime_parameter_set: runtimeParameterSet
    },
    tenant_id: SOURCE_TENANT_ID
  };
  const parameterCreated = await request<ApiEnvelope<{ reference: ParameterReference }>>(
    baseUrl,
    "/api/v1/formal-authority/parameter-sets",
    {
      body: sourceParameterDraft,
      tenantId: SOURCE_TENANT_ID,
      token: platformToken
    }
  );
  expect(parameterCreated.status, JSON.stringify(parameterCreated.body)).toBe(201);
  const parameter = parameterCreated.body.data.reference;
  const parameterPath = (action: string) =>
    `/api/v1/formal-authority/parameter-sets/${SOURCE_PARAMETER_ID}/versions/${VERSION}/${action}`;
  await transition(
    baseUrl,
    parameterPath("validate"),
    { ...parameter, tenant_id: SOURCE_TENANT_ID },
    platformToken,
    SOURCE_TENANT_ID
  );
  await transition(
    baseUrl,
    parameterPath("freeze"),
    { ...parameter, tenant_id: SOURCE_TENANT_ID },
    platformToken,
    SOURCE_TENANT_ID
  );
  await transition(
    baseUrl,
    parameterPath("approve"),
    {
      ...parameter,
      approval_id: "eldercare-golden-source-parameter-approval",
      tenant_id: SOURCE_TENANT_ID
    },
    platformToken,
    SOURCE_TENANT_ID
  );

  const scenarioDraft = createEldercareGoldenM1ScenarioDraft({
    ...input,
    parameter_set_reference: parameter
  });
  const scenarioContent = scenarioDraft.content as Record<string, unknown>;
  const sourceScenarioDraft = {
    ...scenarioDraft,
    content: {
      ...scenarioContent,
      runtime_scenario_package: {
        name: scenarioContent.name,
        plugin_package_ids: [PLUGIN_PACKAGE_ID]
      }
    },
    parameter_set_reference: parameter,
    tenant_id: SOURCE_TENANT_ID
  };
  const scenarioCreated = await request<ApiEnvelope<{ reference: ScenarioReference }>>(
    baseUrl,
    "/api/v1/formal-authority/scenario-packages",
    {
      body: sourceScenarioDraft,
      tenantId: SOURCE_TENANT_ID,
      token: platformToken
    }
  );
  expect(scenarioCreated.status, JSON.stringify(scenarioCreated.body)).toBe(201);
  const scenario = scenarioCreated.body.data.reference;
  const scenarioPath = (action: string) =>
    `/api/v1/formal-authority/scenario-packages/${SOURCE_SCENARIO_ID}/versions/${VERSION}/${action}`;
  await transition(
    baseUrl,
    scenarioPath("validate"),
    { ...scenario, tenant_id: SOURCE_TENANT_ID },
    platformToken,
    SOURCE_TENANT_ID
  );
  await transition(
    baseUrl,
    scenarioPath("freeze"),
    { ...scenario, tenant_id: SOURCE_TENANT_ID },
    platformToken,
    SOURCE_TENANT_ID
  );
  await transition(
    baseUrl,
    scenarioPath("approve"),
    {
      ...scenario,
      approval_id: "eldercare-golden-source-scenario-approval",
      tenant_id: SOURCE_TENANT_ID
    },
    platformToken,
    SOURCE_TENANT_ID
  );
  return { parameter, scenario };
}

async function provisionBaseline(
  baseUrl: string,
  platformToken: string,
  targetTenantId: string,
  source: { parameter: ParameterReference; scenario: ScenarioReference },
  idempotencyKey: string
): Promise<{ status: number; body: ApiEnvelope<TenantBaselineProvisioningResult> | ErrorPayload }> {
  return request<ApiEnvelope<TenantBaselineProvisioningResult> | ErrorPayload>(
    baseUrl,
    "/api/v1/admin/tenant-baselines/provision",
    {
      body: {
        idempotency_key: idempotencyKey,
        source_parameter_set: { ...source.parameter, source_tenant_id: SOURCE_TENANT_ID },
        source_scenario_package: {
          ...source.scenario,
          source_tenant_id: SOURCE_TENANT_ID,
          tenant_id: SOURCE_TENANT_ID
        },
        target_tenant_id: targetTenantId
      },
      tenantId: "tenant_platform",
      token: platformToken
    }
  );
}

async function materializeTargetFormalArtifacts(
  baseUrl: string,
  platformToken: string,
  adminToken: string,
  target: Tenant,
  baseline: TenantBaselineProvisioningResult,
  suffix: string
): Promise<{ blueprint: BlueprintReference; coursePackage: CoursePackageVersion }> {
  const input = adapterInput(target.tenant_id, {
    artifact_ids: {
      parameter_set_id: baseline.parameter_set.reference.parameter_set_id,
      scenario_package_id: baseline.scenario_package.reference.scenario_package_id,
      plugin_package_id: PLUGIN_PACKAGE_ID,
      course_blueprint_id: `eldercare_shanghai_golden_m1_blueprint_${suffix}`,
      course_package_id: `eldercare_shanghai_golden_m1_package_${suffix}`,
      version: VERSION
    },
    parameter_set_reference: baseline.parameter_set.reference,
    scenario_package_reference: baseline.scenario_package.reference
  });
  const generatedBlueprintDraft = createEldercareGoldenM1BlueprintDraft(input);
  // CoursePackage validates constraints against the formal ScenarioPackage
  // compatibility metadata. The baseline copier deliberately preserves the
  // source metadata while assigning tenant-local IDs, so bind only the shared
  // synthetic classification emitted by the adapter here.
  const blueprintDraft = {
    ...generatedBlueprintDraft,
    required_product_capabilities: ["course:create", "decision_submit", "round_publish"],
    scenario_compatibility_constraints: {
      synthetic_data_classification:
        generatedBlueprintDraft.scenario_compatibility_constraints.synthetic_data_classification
    }
  };
  const blueprintCreated = await request<ApiEnvelope<{ reference: BlueprintReference }>>(
    baseUrl,
    "/api/v1/formal-authority/course-blueprints",
    {
      body: blueprintDraft,
      tenantId: target.tenant_id,
      token: platformToken
    }
  );
  expect(blueprintCreated.status, JSON.stringify(blueprintCreated.body)).toBe(201);
  const blueprint = blueprintCreated.body.data.reference;
  const blueprintPath = (action: string) =>
    `/api/v1/formal-authority/course-blueprints/${blueprint.course_blueprint_id}/versions/${VERSION}/${action}`;
  await transition(baseUrl, blueprintPath("validate"), blueprint, platformToken, target.tenant_id);
  await transition(baseUrl, blueprintPath("freeze"), blueprint, platformToken, target.tenant_id);
  await transition(
    baseUrl,
    blueprintPath("approve"),
    { ...blueprint, approval_id: `eldercare-golden-blueprint-${suffix}-approval` },
    platformToken,
    target.tenant_id
  );

  const coursePackageDraft = createEldercareGoldenM1CoursePackageDraft({
    ...input,
    course_blueprint_reference: blueprint
  });
  const packageCreated = await request<ApiEnvelope<CoursePackageVersion>>(
    baseUrl,
    "/api/v1/admin/course-package-versions/drafts",
    {
      body: coursePackageDraft,
      tenantId: target.tenant_id,
      token: adminToken
    }
  );
  expect(packageCreated.status, JSON.stringify(packageCreated.body)).toBe(201);
  const packageDraft = packageCreated.body.data;
  expect(packageDraft.title).toBe("Shanghai Eldercare Golden M1 · Synthetic Teaching Baseline");
  for (const label of ELDERCARE_GOLDEN_M1_SYNTHETIC_LABELS) {
    expect(packageDraft.description).toContain(label);
  }
  const packageReference = {
    content_digest: packageDraft.content_digest,
    course_package_id: packageDraft.course_package_id,
    version: packageDraft.version
  };
  await transition(
    baseUrl,
    `/api/v1/admin/course-package-versions/${packageReference.course_package_id}/versions/${VERSION}/validate`,
    packageReference,
    adminToken,
    target.tenant_id
  );
  const available = await request<ApiEnvelope<CoursePackageVersion>>(
    baseUrl,
    `/api/v1/admin/course-package-versions/${packageReference.course_package_id}/versions/${VERSION}/make-available`,
    {
      body: packageReference,
      method: "POST",
      tenantId: target.tenant_id,
      token: adminToken
    }
  );
  expect(available.status, JSON.stringify(available.body)).toBe(200);
  expect(available.body.data.status).toBe("AVAILABLE");
  return { blueprint, coursePackage: available.body.data };
}

function deterministicResultDigest(settlement: SettlementResult): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        settlement.team_results.map((result) => ({
          state_est: result.state_est,
          state_obs: result.state_obs,
          state_true: result.state_true
        }))
      ),
      "utf8"
    )
    .digest("hex");
}

async function completeJourney(
  baseUrl: string,
  journey: TenantJourney,
  blueprint: BlueprintReference,
  scenario: ScenarioReference
): Promise<JourneyReceipt> {
  const courseResponse = await request<ApiEnvelope<{ course: { course_id: string } }>>(
    baseUrl,
    "/api/v1/bff/teacher/course-blueprint-courses",
    {
      body: {
        course_blueprint_reference: blueprint,
        scenario_package_reference: scenario,
        title: `Shanghai Eldercare Golden M1 ${journey.tenant.tenant_id}`
      },
      tenantId: journey.tenant.tenant_id,
      token: journey.teacherToken
    }
  );
  expect(courseResponse.status, JSON.stringify(courseResponse.body)).toBe(201);
  const courseId = courseResponse.body.data.course.course_id;
  const publishCourse = await request<ApiEnvelope<unknown>>(
    baseUrl,
    `/api/v1/courses/${courseId}/publish`,
    { method: "POST", tenantId: journey.tenant.tenant_id, token: journey.teacherToken }
  );
  expect(publishCourse.status, JSON.stringify(publishCourse.body)).toBe(200);

  const teamResponse = await request<ApiEnvelope<{ team_id: string }>>(
    baseUrl,
    `/api/v1/courses/${courseId}/teams`,
    {
      body: { captain_user_id: journey.studentUserId, name: "Shanghai Eldercare Golden M1 Team" },
      tenantId: journey.tenant.tenant_id,
      token: journey.teacherToken
    }
  );
  expect(teamResponse.status, JSON.stringify(teamResponse.body)).toBe(201);
  const teamId = teamResponse.body.data.team_id;
  const runResponse = await request<ApiEnvelope<{ run: { run_id: string } }>>(
    baseUrl,
    `/api/v1/courses/${courseId}/runs`,
    {
      body: { formal_runtime_seed: SEED },
      tenantId: journey.tenant.tenant_id,
      token: journey.teacherToken
    }
  );
  expect(runResponse.status, JSON.stringify(runResponse.body)).toBe(201);
  const runId = runResponse.body.data.run.run_id;
  const startRound = await request<ApiEnvelope<unknown>>(
    baseUrl,
    `/api/v1/runs/${runId}/rounds/1/start`,
    { method: "POST", tenantId: journey.tenant.tenant_id, token: journey.teacherToken }
  );
  expect(startRound.status, JSON.stringify(startRound.body)).toBe(200);
  const decision = await request<ApiEnvelope<Decision>>(
    baseUrl,
    `/api/v1/runs/${runId}/rounds/1/decisions`,
    {
      body: {
        decision_payload: {
          cash_buffer_target: 0.16,
          capacity_plan: "expand",
          marketing_budget: 180000,
          pricing: { base_price: 12800 },
          service_quality_budget: 160000,
          strategy_statement: "Shanghai eldercare Golden M1 deterministic teaching decision."
        },
        decision_request_id: `eldercare-golden-${journey.tenant.tenant_id}`,
        team_id: teamId
      },
      tenantId: journey.tenant.tenant_id,
      token: journey.studentToken
    }
  );
  expect(decision.status, JSON.stringify(decision.body)).toBe(201);
  expect(decision.body.data.status).toBe("validated");
  const lock = await request<ApiEnvelope<unknown>>(baseUrl, `/api/v1/runs/${runId}/rounds/1/lock`, {
    method: "POST",
    tenantId: journey.tenant.tenant_id,
    token: journey.teacherToken
  });
  expect(lock.status, JSON.stringify(lock.body)).toBe(200);
  const settlement = await request<ApiEnvelope<SettlementResult>>(
    baseUrl,
    `/api/v1/runs/${runId}/rounds/1/settle`,
    { method: "POST", tenantId: journey.tenant.tenant_id, token: journey.teacherToken }
  );
  expect(settlement.status, JSON.stringify(settlement.body)).toBe(200);
  expect(settlement.body.data.replay_hash).toMatch(/^[a-f0-9]{64}$/);
  const publishRound = await request<ApiEnvelope<unknown>>(
    baseUrl,
    `/api/v1/runs/${runId}/rounds/1/publish`,
    { method: "POST", tenantId: journey.tenant.tenant_id, token: journey.teacherToken }
  );
  expect(publishRound.status, JSON.stringify(publishRound.body)).toBe(200);

  const studentResult = await request<ApiEnvelope<Record<string, unknown>>>(
    baseUrl,
    `/api/v1/runs/${runId}/rounds/1/results`,
    { tenantId: journey.tenant.tenant_id, token: journey.studentToken }
  );
  expect(studentResult.status, JSON.stringify(studentResult.body)).toBe(200);
  const studentSerialized = JSON.stringify(studentResult.body.data).toLowerCase();
  for (const forbidden of ["state_true", "replay_hash", "private", SOURCE_TENANT_ID]) {
    expect(studentSerialized).not.toContain(forbidden.toLowerCase());
  }
  expect(studentResult.body.data).not.toHaveProperty("replay_evidence");

  const teacherResult = await request<ApiEnvelope<Record<string, unknown>>>(
    baseUrl,
    `/api/v1/runs/${runId}/rounds/1/results`,
    { tenantId: journey.tenant.tenant_id, token: journey.teacherToken }
  );
  expect(teacherResult.status, JSON.stringify(teacherResult.body)).toBe(200);
  expect(teacherResult.body.data).toHaveProperty("replay_hash");
  expect(teacherResult.body.data).toHaveProperty("replay_evidence");

  const asset = await request<ApiEnvelope<{ asset_id: string }>>(
    baseUrl,
    "/api/v1/bff/teacher/instructor-assets/drafts",
    {
      body: { course_id: courseId, title: "Shanghai Eldercare Golden M1 Debrief" },
      tenantId: journey.tenant.tenant_id,
      token: journey.teacherToken
    }
  );
  expect(asset.status, JSON.stringify(asset.body)).toBe(201);
  const assetId = asset.body.data.asset_id;
  const publishAsset = await request<ApiEnvelope<unknown>>(
    baseUrl,
    `/api/v1/bff/teacher/instructor-assets/${assetId}/publish`,
    {
      body: {},
      method: "POST",
      tenantId: journey.tenant.tenant_id,
      token: journey.teacherToken
    }
  );
  expect(publishAsset.status, JSON.stringify(publishAsset.body)).toBe(200);
  const artifact = await request<ApiEnvelope<Record<string, unknown>>>(
    baseUrl,
    `/api/v1/bff/teacher/instructor-debrief-artifact?asset_id=${assetId}&run_id=${runId}&round_no=1`,
    { tenantId: journey.tenant.tenant_id, token: journey.teacherToken }
  );
  expect(artifact.status, JSON.stringify(artifact.body)).toBe(200);
  expect(artifact.body.data).toHaveProperty("artifact_digest");
  const exportResponse = await fetch(
    `${baseUrl}/api/v1/bff/teacher/instructor-debrief-artifact/export?asset_id=${assetId}&run_id=${runId}&round_no=1&format=markdown`,
    {
      headers: {
        authorization: `Bearer ${journey.teacherToken}`,
        "x-tenant-id": journey.tenant.tenant_id
      }
    }
  );
  expect(exportResponse.status).toBe(200);
  const exportText = await exportResponse.text();
  expect(exportText).toContain(String(artifact.body.data.artifact_digest));
  return {
    artifact: artifact.body.data,
    courseId,
    exportText,
    runId,
    settlement: settlement.body.data,
    studentResult: studentResult.body.data,
    teamId,
    teacherResult: teacherResult.body.data
  };
}

describe("Shanghai Eldercare Golden M1 HTTP productization", () => {
  it("materializes two fresh tenants through the formal chain and preserves safe deterministic evidence", async () => {
    const store = createP1Store();
    registerEldercareRuntimePlugin();
    store.tenants.push({
      created_at: "2026-08-09T00:00:00.000Z",
      domain: "r7a-synthetic.simwar.local",
      name: "R7-A Shanghai Eldercare Synthetic Source",
      status: "active",
      tenant_id: SOURCE_TENANT_ID,
      updated_at: "2026-08-09T00:00:00.000Z"
    });
    const { baseUrl, server } = await startServer(store);
    try {
      const platformToken = await login(baseUrl, "platform", "platform", "tenant_platform");
      const tenantA = await createTenant(baseUrl, platformToken, "eldercare-golden-a");
      const tenantB = await createTenant(baseUrl, platformToken, "eldercare-golden-b");
      const partialTenant = await createTenant(baseUrl, platformToken, "eldercare-golden-partial");
      const journeyInputs = await Promise.all(
        [tenantA, tenantB].map(async (tenant, index): Promise<TenantJourney> => {
          const suffix = index === 0 ? "a" : "b";
          const admin = await createUser(baseUrl, platformToken, {
            password: `eldercare-admin-${suffix}`,
            roles: ["tenant_admin"],
            tenant_id: tenant.tenant_id,
            username: `eldercare_golden_admin_${suffix}`
          });
          const teacher = await createUser(baseUrl, platformToken, {
            password: `eldercare-teacher-${suffix}`,
            roles: ["teacher"],
            tenant_id: tenant.tenant_id,
            username: `eldercare_golden_teacher_${suffix}`
          });
          const student = await createUser(baseUrl, platformToken, {
            password: `eldercare-student-${suffix}`,
            roles: ["learner", "team_captain"],
            tenant_id: tenant.tenant_id,
            username: `eldercare_golden_student_${suffix}`
          });
          return {
            adminToken: await login(
              baseUrl,
              admin.username,
              `eldercare-admin-${suffix}`,
              tenant.tenant_id
            ),
            studentToken: await login(
              baseUrl,
              student.username,
              `eldercare-student-${suffix}`,
              tenant.tenant_id
            ),
            studentUserId: student.user_id,
            teacherToken: await login(
              baseUrl,
              teacher.username,
              `eldercare-teacher-${suffix}`,
              tenant.tenant_id
            ),
            tenant
          };
        })
      );

      await createAvailablePlugin(baseUrl, platformToken, tenantA.tenant_id);
      const source = await createApprovedSourceAuthorities(
        baseUrl,
        platformToken,
        tenantA.tenant_id
      );
      const initialTruth = structuredClone({
        decisions: store.decisions,
        rounds: store.rounds,
        runs: store.runs,
        settlements: store.settlementResults
      });

      const invalidDigest = formalStateDigest(store);
      const invalidCounts = formalCounts(store);
      const missingSource = await provisionBaseline(
        baseUrl,
        platformToken,
        tenantA.tenant_id,
        {
          parameter: { ...source.parameter, content_digest: "f".repeat(64) },
          scenario: source.scenario
        },
        "eldercare-golden-missing-source"
      );
      expect(missingSource.status).toBe(404);
      expect((missingSource.body as ErrorPayload).code).toBe("TENANT_BASELINE-404-001");
      expectNoFormalWrite(store, invalidDigest, invalidCounts);
      const mixedSource = await request<ErrorPayload>(
        baseUrl,
        "/api/v1/admin/tenant-baselines/provision",
        {
          body: {
            idempotency_key: "eldercare-golden-mixed-source",
            source_parameter_set: { ...source.parameter, source_tenant_id: tenantA.tenant_id },
            source_scenario_package: {
              ...source.scenario,
              source_tenant_id: SOURCE_TENANT_ID,
              tenant_id: SOURCE_TENANT_ID
            },
            target_tenant_id: tenantA.tenant_id
          },
          tenantId: "tenant_platform",
          token: platformToken
        }
      );
      expect(mixedSource.status).toBe(403);
      expect(mixedSource.body.code).toBe("TENANT_BASELINE-403-001");
      expectNoFormalWrite(store, invalidDigest, invalidCounts);

      const unapprovedInput = adapterInput(tenantA.tenant_id, {
        artifact_ids: { scenario_package_id: "eldercare_shanghai_unapproved_scenario" },
        parameter_set_reference: source.parameter
      });
      const unapprovedDraft = createEldercareGoldenM1ScenarioDraft(unapprovedInput);
      const unapprovedContent = unapprovedDraft.content as Record<string, unknown>;
      const unapprovedCreated = await request<ApiEnvelope<{ reference: ScenarioReference }>>(
        baseUrl,
        "/api/v1/formal-authority/scenario-packages",
        {
          body: {
            ...unapprovedDraft,
            content: {
              ...unapprovedContent,
              runtime_scenario_package: {
                name: unapprovedContent.name,
                plugin_package_ids: [PLUGIN_PACKAGE_ID]
              }
            },
            parameter_set_reference: source.parameter,
            scenario_package_id: "eldercare_shanghai_unapproved_scenario",
            tenant_id: SOURCE_TENANT_ID
          },
          tenantId: SOURCE_TENANT_ID,
          token: platformToken
        }
      );
      expect(unapprovedCreated.status).toBe(201);
      const beforeUnapprovedRetryDigest = formalStateDigest(store);
      const beforeUnapprovedRetryCounts = formalCounts(store);
      const unapproved = await provisionBaseline(
        baseUrl,
        platformToken,
        tenantA.tenant_id,
        {
          parameter: source.parameter,
          scenario: {
            ...unapprovedCreated.body.data.reference,
            tenant_id: SOURCE_TENANT_ID
          }
        },
        "eldercare-golden-unapproved-source"
      );
      expect(unapproved.status).toBe(422);
      expect((unapproved.body as ErrorPayload).code).toBe("TENANT_BASELINE-422-001");
      expectNoFormalWrite(store, beforeUnapprovedRetryDigest, beforeUnapprovedRetryCounts);

      const baselines = await Promise.all(
        journeyInputs.map((journey, index) =>
          provisionBaseline(
            baseUrl,
            platformToken,
            journey.tenant.tenant_id,
            source,
            `eldercare-golden-baseline-${index === 0 ? "a" : "b"}`
          )
        )
      );
      for (const baseline of baselines) {
        expect(baseline.status, JSON.stringify(baseline.body)).toBe(201);
        expect((baseline.body as ApiEnvelope<TenantBaselineProvisioningResult>).data.outcome).toBe(
          "CREATED"
        );
      }
      const baselineA = (baselines[0]!.body as ApiEnvelope<TenantBaselineProvisioningResult>).data;
      const baselineB = (baselines[1]!.body as ApiEnvelope<TenantBaselineProvisioningResult>).data;
      expect(baselineA.parameter_set.reference.parameter_set_id).not.toBe(
        baselineB.parameter_set.reference.parameter_set_id
      );
      expect(baselineA.scenario_package.reference.scenario_package_id).not.toBe(
        baselineB.scenario_package.reference.scenario_package_id
      );
      expect(baselineA.provenance.source_parameter_set.tenant_id).toBe(SOURCE_TENANT_ID);
      expect(baselineB.provenance.source_scenario_package.tenant_id).toBe(SOURCE_TENANT_ID);
      expect(JSON.stringify(baselines)).not.toContain("state_true");
      expect(JSON.stringify(baselines)).not.toContain("replay_hash");

      const partialBaseline = await provisionBaseline(
        baseUrl,
        platformToken,
        partialTenant.tenant_id,
        source,
        "eldercare-golden-partial"
      );
      expect(partialBaseline.status).toBe(201);
      const partialResult = (partialBaseline.body as ApiEnvelope<TenantBaselineProvisioningResult>)
        .data;
      store.formalParameterSetApprovalRecords.splice(
        0,
        store.formalParameterSetApprovalRecords.length,
        ...store.formalParameterSetApprovalRecords.filter(
          (record) =>
            !(
              record.tenant_id === partialTenant.tenant_id &&
              record.parameter_set_reference.parameter_set_id ===
                partialResult.parameter_set.reference.parameter_set_id
            )
        )
      );
      const partialRetryDigest = formalStateDigest(store);
      const partialRetryCounts = formalCounts(store);
      const incompleteApproval = await provisionBaseline(
        baseUrl,
        platformToken,
        partialTenant.tenant_id,
        source,
        "eldercare-golden-partial"
      );
      expect(incompleteApproval.status).toBe(409);
      expect((incompleteApproval.body as ErrorPayload).code).toBe("TENANT_BASELINE-409-001");
      expectNoFormalWrite(store, partialRetryDigest, partialRetryCounts);

      const formalArtifacts = await Promise.all(
        [
          { baseline: baselineA, journey: journeyInputs[0]!, suffix: "a" },
          { baseline: baselineB, journey: journeyInputs[1]!, suffix: "b" }
        ].map(async ({ baseline, journey, suffix }) => ({
          journey,
          baseline,
          artifacts: await materializeTargetFormalArtifacts(
            baseUrl,
            platformToken,
            journey.adminToken,
            journey.tenant,
            baseline,
            suffix
          )
        }))
      );
      for (const { artifacts } of formalArtifacts) {
        const serializedPackage = JSON.stringify(artifacts.coursePackage);
        for (const label of ELDERCARE_GOLDEN_M1_SYNTHETIC_LABELS) {
          expect(serializedPackage).toContain(label);
        }
        for (const forbidden of ["state_true", "SettlementResult", "replay_hash", "private"]) {
          expect(serializedPackage.toLowerCase()).not.toContain(forbidden.toLowerCase());
        }
      }
      expect(store.decisions).toEqual(initialTruth.decisions);
      expect(store.rounds).toEqual(initialTruth.rounds);
      expect(store.runs).toEqual(initialTruth.runs);
      expect(store.settlementResults).toEqual(initialTruth.settlements);

      const journeys = await Promise.all(
        formalArtifacts.map(({ journey, baseline, artifacts }) =>
          completeJourney(
            baseUrl,
            journey,
            artifacts.blueprint,
            baseline.scenario_package.reference
          )
        )
      );
      expect(journeys[0]!.courseId).not.toBe(journeys[1]!.courseId);
      expect(journeys[0]!.runId).not.toBe(journeys[1]!.runId);
      expect(journeys[0]!.teamId).not.toBe(journeys[1]!.teamId);
      const normalizedResults = journeys.map((journey) =>
        journey.settlement.team_results.map(({ state_est, state_obs, state_true }) => ({
          state_est,
          state_obs,
          state_true
        }))
      );
      expect(normalizedResults[0]).toEqual(normalizedResults[1]);
      expect(deterministicResultDigest(journeys[0]!.settlement)).toBe(
        deterministicResultDigest(journeys[1]!.settlement)
      );
      expect(JSON.stringify(journeys[0]!.studentResult)).not.toContain(tenantB.tenant_id);
      expect(JSON.stringify(journeys[1]!.studentResult)).not.toContain(tenantA.tenant_id);
      expect(journeys[0]!.settlement.replay_hash).not.toBe(journeys[1]!.settlement.replay_hash);
      expect(JSON.stringify(journeys[0]!.teacherResult)).toContain("replay_evidence");
      expect(JSON.stringify(journeys[1]!.teacherResult)).toContain("replay_evidence");

      const crossTenant = await request<ErrorPayload>(
        baseUrl,
        `/api/v1/runs/${journeys[1]!.runId}/rounds/1/results`,
        { tenantId: journeyInputs[0]!.tenant.tenant_id, token: journeyInputs[0]!.studentToken }
      );
      expect([403, 404]).toContain(crossTenant.status);
      expect(JSON.stringify(crossTenant.body)).not.toContain(journeyInputs[1]!.tenant.tenant_id);
    } finally {
      await stopServer(server);
    }
  }, 60_000);
});
