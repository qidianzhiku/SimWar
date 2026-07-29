import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { PLATFORM_TENANT_ID } from "../../services/api/src/store";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;
const teacherBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_TEACHER_PORT ?? 3101}`;
const tenantId = "tenant_demo";
const parameterSetId = "parameter_browser_compile_draft_001";
const scenarioPackageId = "scenario_browser_compile_draft_001";
const version = "1.0.0";

test.afterAll(() => {
  cleanupPlaywrightStore();
});

async function postJson<T>(
  request: APIRequestContext,
  path: string,
  input: { data: unknown; headers: Record<string, string> }
): Promise<{ body: T; status: number }> {
  const response = await request.post(`${apiBaseUrl}${path}`, input);
  return { body: (await response.json()) as T, status: response.status() };
}

async function login(request: APIRequestContext, username: string, requestTenant: string) {
  const response = await postJson<{ data: { access_token: string } }>(
    request,
    "/api/v1/auth/login",
    {
      data: { password: username, username },
      headers: { "content-type": "application/json", "x-tenant-id": requestTenant }
    }
  );
  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

function formalHeaders(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    "x-tenant-id": tenantId
  };
}

async function approveParameterSet(request: APIRequestContext, accessToken: string) {
  const headers = formalHeaders(accessToken);
  const draft = await postJson<{ data: { reference: object } }>(
    request,
    "/api/v1/formal-authority/parameter-sets",
    {
      data: {
        compatibility_metadata: { engine_family: "toy_logit" },
        model_version_ref: "toy_logit_wellness_v1@0.1.0",
        parameter_set_id: parameterSetId,
        parameter_values: { base_capacity: 120, base_market_size: 240 },
        schema_version: "parameter-set.v1",
        tenant_id: tenantId,
        version
      },
      headers
    }
  );
  expect(draft.status).toBe(201);
  const transition = async (action: string, data: object) =>
    postJson<{ data: { version?: { reference: object }; reference?: object } }>(
      request,
      `/api/v1/formal-authority/parameter-sets/${parameterSetId}/versions/${version}/${action}`,
      { data, headers }
    );
  const lifecycleReference = { ...draft.body.data.reference, tenant_id: tenantId };
  const validated = await transition("validate", lifecycleReference);
  expect(validated.status).toBe(200);
  const frozen = await transition("freeze", lifecycleReference);
  expect(frozen.status).toBe(200);
  const approved = await transition("approve", {
    ...lifecycleReference,
    approval_id: "browser_compile_draft_parameter_approval"
  });
  expect(approved.status).toBe(200);
  return approved.body.data.version?.reference ?? draft.body.data.reference;
}

async function signInTeacher(page: Page): Promise<void> {
  await page.getByLabel("tenant").fill(tenantId);
  await page.getByLabel("username").fill("teacher");
  await page.getByLabel("password").fill("teacher");
  await page.getByRole("button", { name: "教师登录" }).click();
  await expect(page.getByText("signed in")).toBeVisible();
}

async function openScenarioReadinessPanel(page: Page) {
  const initialState = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/demo-state") &&
      response.request().method() === "GET" &&
      response.status() === 200
  );
  await page.goto(teacherBaseUrl);
  await signInTeacher(page);
  await initialState;

  const primaryAction = page.locator("header.topbar > button.primary");
  if ((await primaryAction.textContent())?.trim() === "创建 Run") {
    const createdState = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/demo-state") &&
        response.request().method() === "GET" &&
        response.status() === 200
    );
    await primaryAction.click();
    await expect(page.getByText("run created")).toBeVisible();
    await createdState;
  }

  return page.getByLabel("scenario readiness");
}

test("Teacher sees an explicitly approved compiled ScenarioPackage and never receives a Run-binding control", async ({
  page,
  request
}) => {
  const platformToken = await login(request, "platform", PLATFORM_TENANT_ID);
  const parameterSetReference = await approveParameterSet(request, platformToken);
  const headers = formalHeaders(platformToken);
  const compiled = await postJson<{
    data: {
      draft: { reference: object; status: string };
      report: { candidate_content_digest: string };
    };
  }>(request, "/api/v1/formal-authority/scenario-packages/compile-draft", {
    data: {
      artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
      compatibility_metadata: { engine: "simulation-core.v1", plugin_api: "plugin-api.v1" },
      metadata: {
        license_provenance_id: "internal-synthetic-v1",
        privacy_classification: "synthetic_internal",
        title: "Browser compiled scenario"
      },
      parameter_set_reference: parameterSetReference,
      plugin_dependencies: [{ plugin_package_id: "generic-plugin", version: "1.0.0" }],
      scenario_package_id: scenarioPackageId,
      schema_version: "scenario-package.v1",
      source_reference: {
        license_provenance_id: "internal-synthetic-v1",
        source_digest: "d".repeat(64),
        source_id: "browser-synthetic-source-001",
        source_kind: "SYNTHETIC_INTERNAL",
        source_version: "1.0.0",
        status: "REGISTERED",
        tenant_id: tenantId
      },
      template: {
        content: { objectives: ["operate", "learn"], rounds: [{ label: "baseline", round_no: 1 }] },
        template_id: "browser-scenario-template-001",
        template_version: "1.0.0"
      },
      tenant_id: tenantId,
      version
    },
    headers
  });
  expect(compiled.status).toBe(201);
  expect(compiled.body.data.draft.status).toBe("DRAFT");
  expect(compiled.body.data.report.candidate_content_digest).toMatch(/^[a-f0-9]{64}$/);

  const transition = async (action: string, data: object) =>
    postJson<{ data: { reference?: object; version?: { reference: object } } }>(
      request,
      `/api/v1/formal-authority/scenario-packages/${scenarioPackageId}/versions/${version}/${action}`,
      { data, headers }
    );
  const validated = await transition("validate", compiled.body.data.draft.reference);
  expect(validated.status).toBe(200);
  const frozen = await transition(
    "freeze",
    validated.body.data.reference ?? compiled.body.data.draft.reference
  );
  expect(frozen.status).toBe(200);
  const approved = await transition("approve", {
    ...(frozen.body.data.reference ?? compiled.body.data.draft.reference),
    approval_id: "browser_compile_draft_scenario_approval"
  });
  expect(approved.status).toBe(200);

  const teacherToken = await login(request, "teacher", tenantId);
  const catalogReadback = await request.get(
    `${apiBaseUrl}/api/v1/bff/teacher/formal-scenario-package-catalog`,
    { headers: { authorization: `Bearer ${teacherToken}` } }
  );
  expect(catalogReadback.status()).toBe(200);
  expect(JSON.stringify(await catalogReadback.json())).toContain(scenarioPackageId);

  const readinessPanel = await openScenarioReadinessPanel(page);
  const catalog = readinessPanel.getByLabel("formal ScenarioPackage catalog");
  await expect(catalog.getByText(scenarioPackageId)).toBeVisible();
  await expect(catalog.getByText("APPROVED")).toBeVisible();
  await expect(
    catalog.getByRole("button", { name: /Activate|Bind|Launch|Replay|Publish|Settlement/i })
  ).toHaveCount(0);

  await transition("retire", frozen.body.data.reference ?? compiled.body.data.draft.reference);
  const reloadedPanel = await openScenarioReadinessPanel(page);
  await expect(
    reloadedPanel.getByLabel("formal ScenarioPackage catalog").getByText(scenarioPackageId)
  ).toHaveCount(0);
});
