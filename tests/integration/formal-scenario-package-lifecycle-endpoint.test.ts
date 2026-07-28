import { once } from "node:events";
import { request as nodeRequest, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession } from "../../packages/shared-contracts/src";
import { createJsonFormalScenarioAuthorityRuntime } from "../../services/api/src/formal-scenario-authority-runtime";
import { createJsonFormalScenarioAuthorityPersistence } from "../../services/api/src/json-repository-adapter";
import { createApiServer } from "../../services/api/src/server";
import {
  DEFAULT_TENANT_ID,
  PLATFORM_TENANT_ID,
  createP1Store,
  type SimWarStore
} from "../../services/api/src/store";

const PARAMETER_SET_ID = "parameter_scenario_api_lifecycle";
const SCENARIO_PACKAGE_ID = "scenario_api_lifecycle";
const VERSION = "1.0.0";
const BASE_PATH = "/api/v1/formal-authority/scenario-packages";

interface FormalParameterSetVersion {
  reference: {
    content_digest: string;
    parameter_set_id: string;
    version: string;
  };
}

interface FormalScenarioPackageVersionResponse {
  content_digest: string;
  reference: {
    content_digest: string;
    scenario_package_id: string;
    tenant_id: string;
    version: string;
  };
  scenario_package_id: string;
  status: "DRAFT" | "VALIDATED" | "FROZEN" | "APPROVED" | "RETIRED";
  tenant_id: string;
  version: string;
}

interface FormalScenarioPackageApprovalResponse {
  approval_record: {
    approval_id: string;
    tenant_id: string;
  };
  version: FormalScenarioPackageVersionResponse;
}

async function requestJson<T>(
  url: string,
  options: { body?: unknown; headers?: Record<string, string>; method?: string } = {}
): Promise<{ body: T; status: number }> {
  return new Promise((resolve, reject) => {
    const request = nodeRequest(
      url,
      { headers: options.headers, method: options.method ?? "GET" },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          try {
            resolve({
              body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as T,
              status: response.statusCode ?? 0
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("error", reject);
    if (options.body !== undefined) {
      request.write(JSON.stringify(options.body));
    }
    request.end();
  });
}

async function login(
  baseUrl: string,
  username: string,
  password: string,
  tenantId: string
): Promise<AuthSession> {
  const response = await requestJson<ApiEnvelope<AuthSession>>(`${baseUrl}/api/v1/auth/login`, {
    body: { password, username },
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data;
}

async function createApprovedParameterSet(store: SimWarStore): Promise<FormalParameterSetVersion> {
  const runtime = createJsonFormalScenarioAuthorityRuntime(
    createJsonFormalScenarioAuthorityPersistence(store)
  );
  const actor = {
    actor_id: "usr_platform",
    capabilities: ["parameter_set:manage"],
    correlation_id: "parameter_scenario_api_seed",
    tenant_id: DEFAULT_TENANT_ID
  };
  const draft = await runtime.parameterSets.createDraft(actor, {
    compatibility_metadata: { engine_family: "toy_logit" },
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: PARAMETER_SET_ID,
    parameter_values: { base_capacity: 120, base_market_size: 240 },
    schema_version: "parameter-set.v1",
    tenant_id: DEFAULT_TENANT_ID,
    version: VERSION
  });
  const validated = await runtime.parameterSets.validate(actor, draft.reference);
  const frozen = await runtime.parameterSets.freeze(actor, validated.reference);
  return runtime.parameterSets.approve(actor, frozen.reference, "parameter_scenario_api_approval");
}

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  await createApprovedParameterSet(store);
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

function lifecycleHeaders(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    "x-tenant-id": DEFAULT_TENANT_ID
  };
}

function draftBody(parameterSetReference: FormalParameterSetVersion["reference"]) {
  return {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { engine: "simulation-core.v1", plugin_api: "plugin-api.v1" },
    content: { objectives: ["operate", "learn"], rounds: [{ index: 1, label: "baseline" }] },
    metadata: { privacy_classification: "synthetic_internal", title: "Lifecycle scenario" },
    parameter_set_reference: parameterSetReference,
    plugin_dependencies: [{ plugin_package_id: "wellness", version: "1.0.0" }],
    scenario_package_id: SCENARIO_PACKAGE_ID,
    schema_version: "scenario-package.v1",
    tenant_id: DEFAULT_TENANT_ID,
    version: VERSION
  };
}

describe("formal ScenarioPackage lifecycle endpoint", () => {
  it("persists a platform-admin lifecycle with an approved exact ParameterSet reference and audit records", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const platform = await login(baseUrl, "platform", "platform", PLATFORM_TENANT_ID);
      const headers = lifecycleHeaders(platform.access_token);
      const parameterSetReference = store.formalParameterSetLifecycleSnapshots.at(-1)?.reference;
      if (!parameterSetReference) {
        throw new Error("approved parameter set reference was not seeded");
      }
      const draft = await requestJson<ApiEnvelope<FormalScenarioPackageVersionResponse>>(
        `${baseUrl}${BASE_PATH}`,
        { body: draftBody(parameterSetReference), headers, method: "POST" }
      );

      expect(draft.status).toBe(201);
      expect(draft.body.data).toMatchObject({
        scenario_package_id: SCENARIO_PACKAGE_ID,
        status: "DRAFT",
        tenant_id: DEFAULT_TENANT_ID,
        version: VERSION
      });

      const reference = draft.body.data.reference;
      const transitionUrl = (action: string) =>
        `${baseUrl}${BASE_PATH}/${SCENARIO_PACKAGE_ID}/versions/${VERSION}/${action}`;
      const validated = await requestJson<ApiEnvelope<FormalScenarioPackageVersionResponse>>(
        transitionUrl("validate"),
        { body: reference, headers, method: "POST" }
      );
      const frozen = await requestJson<ApiEnvelope<FormalScenarioPackageVersionResponse>>(
        transitionUrl("freeze"),
        { body: reference, headers, method: "POST" }
      );
      const approved = await requestJson<ApiEnvelope<FormalScenarioPackageApprovalResponse>>(
        transitionUrl("approve"),
        {
          body: { ...reference, approval_id: "scenario_api_lifecycle_approval" },
          headers,
          method: "POST"
        }
      );
      const retired = await requestJson<ApiEnvelope<FormalScenarioPackageVersionResponse>>(
        transitionUrl("retire"),
        { body: reference, headers, method: "POST" }
      );

      expect(validated.body.data.status).toBe("VALIDATED");
      expect(frozen.body.data.status).toBe("FROZEN");
      expect(approved.body.data).toMatchObject({
        approval_record: {
          approval_id: "scenario_api_lifecycle_approval",
          tenant_id: DEFAULT_TENANT_ID
        },
        version: { status: "APPROVED" }
      });
      expect(retired.body.data.status).toBe("RETIRED");
      expect(store.formalScenarioPackageLifecycleSnapshots).toHaveLength(5);
      expect(store.formalScenarioPackageApprovalRecords).toEqual([
        expect.objectContaining({
          approval_id: "scenario_api_lifecycle_approval",
          tenant_id: DEFAULT_TENANT_ID
        })
      ]);
      const lifecycleAudits = store.auditLogs.filter((entry) =>
        entry.action.startsWith("scenario_package.")
      );
      expect(lifecycleAudits.map((entry) => entry.action)).toEqual([
        "scenario_package.create",
        "scenario_package.validate",
        "scenario_package.freeze",
        "scenario_package.approve",
        "scenario_package.retire"
      ]);
      expect(lifecycleAudits.every((entry) => entry.actor_id === "usr_platform")).toBe(true);
      expect(lifecycleAudits.every((entry) => entry.tenant_id === DEFAULT_TENANT_ID)).toBe(true);
    } finally {
      await stopServer(server);
    }
  });

  it("rejects non-platform actors, cross-tenant drafts, and skipped lifecycle transitions", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const platform = await login(baseUrl, "platform", "platform", PLATFORM_TENANT_ID);
      const tenantAdmin = await login(baseUrl, "admin", "admin", DEFAULT_TENANT_ID);
      const parameterSetReference = store.formalParameterSetLifecycleSnapshots.at(-1)?.reference;
      if (!parameterSetReference) {
        throw new Error("approved parameter set reference was not seeded");
      }
      const body = draftBody(parameterSetReference);
      const tenantAdminCreate = await requestJson<
        ApiEnvelope<FormalScenarioPackageVersionResponse>
      >(`${baseUrl}${BASE_PATH}`, {
        body,
        headers: lifecycleHeaders(tenantAdmin.access_token),
        method: "POST"
      });
      const platformCreate = await requestJson<ApiEnvelope<FormalScenarioPackageVersionResponse>>(
        `${baseUrl}${BASE_PATH}`,
        { body, headers: lifecycleHeaders(platform.access_token), method: "POST" }
      );
      const crossTenantBody = await requestJson<ApiEnvelope<FormalScenarioPackageVersionResponse>>(
        `${baseUrl}${BASE_PATH}`,
        {
          body: {
            ...body,
            scenario_package_id: "scenario_api_cross_tenant",
            tenant_id: "tenant_other"
          },
          headers: lifecycleHeaders(platform.access_token),
          method: "POST"
        }
      );
      const invalidApproval = await requestJson<ApiEnvelope<FormalScenarioPackageApprovalResponse>>(
        `${baseUrl}${BASE_PATH}/${SCENARIO_PACKAGE_ID}/versions/${VERSION}/approve`,
        {
          body: {
            ...platformCreate.body.data.reference,
            approval_id: "scenario_api_rejected_approval"
          },
          headers: lifecycleHeaders(platform.access_token),
          method: "POST"
        }
      );

      expect(tenantAdminCreate.status).toBe(403);
      expect(platformCreate.status).toBe(201);
      expect(crossTenantBody.status).toBe(422);
      expect(invalidApproval.status).toBe(409);
    } finally {
      await stopServer(server);
    }
  });
});
