import { once } from "node:events";
import { request as nodeRequest, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession } from "../../packages/shared-contracts/src";
import { createJsonFormalScenarioAuthorityRuntime } from "../../services/api/src/formal-scenario-authority-runtime";
import { createJsonFormalScenarioAuthorityPersistence } from "../../services/api/src/json-repository-adapter";
import { createApiServer } from "../../services/api/src/server";
import {
  DEFAULT_TENANT_ID,
  OTHER_TENANT_ID,
  createP1Store,
  type SimWarStore
} from "../../services/api/src/store";

const CATALOG_PATH = "/api/v1/bff/teacher/formal-scenario-package-catalog";

interface CatalogError {
  error: {
    code: string;
    correlation_id: string | null;
    message: string;
  };
}

interface CatalogResponse {
  candidates: Array<{
    compatibility_metadata: Record<string, string>;
    parameter_set_reference: {
      content_digest: string;
      parameter_set_id: string;
      version: string;
    };
    plugin_dependencies: Array<{ plugin_package_id: string; version: string }>;
    scenario_package_reference: {
      content_digest: string;
      scenario_package_id: string;
      tenant_id: string;
      version: string;
    };
    schema_version: string;
    status: "APPROVED";
  }>;
  explicit_non_proofs: string[];
  operation_id: "TEACHER_FORMAL_SCENARIO_PACKAGE_CATALOG_GET_V1";
}

async function requestJson<T>(
  url: string,
  options: { body?: string; headers?: Record<string, string>; method?: string } = {}
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
    if (options.body) {
      request.write(options.body);
    }
    request.end();
  });
}

async function login(baseUrl: string, username: string, tenantId = DEFAULT_TENANT_ID) {
  const response = await requestJson<ApiEnvelope<AuthSession>>(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({
      password: username === "other_teacher" ? "teacher" : username,
      username
    }),
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data;
}

async function seedApprovedScenario(
  store: SimWarStore,
  input: { scenarioPackageId: string; tenantId: string; version: string; retire?: boolean }
) {
  const runtime = createJsonFormalScenarioAuthorityRuntime(
    createJsonFormalScenarioAuthorityPersistence(store)
  );
  const actor = {
    actor_id: `authority_${input.tenantId}`,
    capabilities: ["parameter_set:manage", "scenario_package:manage"] as const,
    correlation_id: `corr_${input.scenarioPackageId}`,
    tenant_id: input.tenantId
  };
  const parameterDraft = await runtime.parameterSets.createDraft(actor, {
    compatibility_metadata: { engine: "simulation-core.v1" },
    model_version_ref: "simulation-core.v1",
    parameter_set_id: `parameter_${input.scenarioPackageId}`,
    parameter_values: { base_capacity: 120 },
    schema_version: "parameters.v1",
    tenant_id: input.tenantId,
    version: input.version
  });
  const parameterValidated = await runtime.parameterSets.validate(actor, parameterDraft.reference);
  const parameterFrozen = await runtime.parameterSets.freeze(actor, parameterValidated.reference);
  const parameterApproved = await runtime.parameterSets.approve(
    actor,
    parameterFrozen.reference,
    `approval_parameter_${input.scenarioPackageId}`
  );
  const scenarioDraft = await runtime.scenarioPackages.createDraft(actor, {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { engine: "simulation-core.v1" },
    content: { rounds: [{ index: 1, label: "baseline" }] },
    metadata: { title: input.scenarioPackageId },
    parameter_set_reference: parameterApproved.version.reference,
    plugin_dependencies: [{ plugin_package_id: "wellness", version: "1.0.0" }],
    scenario_package_id: input.scenarioPackageId,
    schema_version: "scenario-package.v1",
    tenant_id: input.tenantId,
    version: input.version
  });
  const scenarioValidated = await runtime.scenarioPackages.validate(actor, scenarioDraft.reference);
  const scenarioFrozen = await runtime.scenarioPackages.freeze(actor, scenarioValidated.reference);
  const scenarioApproved = await runtime.scenarioPackages.approve(
    actor,
    scenarioFrozen.reference,
    `approval_scenario_${input.scenarioPackageId}`
  );

  if (input.retire) {
    await runtime.scenarioPackages.retire(actor, scenarioApproved.version.reference);
  }

  return scenarioApproved.version.reference;
}

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  await seedApprovedScenario(store, {
    scenarioPackageId: "scenario_catalog_retired",
    tenantId: DEFAULT_TENANT_ID,
    version: "1.0.0",
    retire: true
  });
  const activeReference = await seedApprovedScenario(store, {
    scenarioPackageId: "scenario_catalog_current",
    tenantId: DEFAULT_TENANT_ID,
    version: "2.0.0"
  });
  await seedApprovedScenario(store, {
    scenarioPackageId: "scenario_catalog_other_tenant",
    tenantId: OTHER_TENANT_ID,
    version: "1.0.0"
  });
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }
  expect(activeReference.scenario_package_id).toBe("scenario_catalog_current");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

describe("Teacher formal ScenarioPackage catalog endpoint", () => {
  it("returns only current approved tenant-scoped authority projections without persistence writes", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacher = await login(baseUrl, "teacher");
      const before = JSON.stringify(store);
      const response = await requestJson<CatalogResponse>(`${baseUrl}${CATALOG_PATH}`, {
        headers: { authorization: `Bearer ${teacher.access_token}` }
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        operation_id: "TEACHER_FORMAL_SCENARIO_PACKAGE_CATALOG_GET_V1",
        candidates: [
          {
            scenario_package_reference: {
              scenario_package_id: "scenario_catalog_current",
              tenant_id: DEFAULT_TENANT_ID,
              version: "2.0.0"
            },
            parameter_set_reference: { parameter_set_id: "parameter_scenario_catalog_current" },
            status: "APPROVED"
          }
        ]
      });
      expect(response.body.candidates).toHaveLength(1);
      expect(JSON.stringify(response.body)).not.toMatch(
        /state_true|SettlementResult|ReplayManifest|artifact_reference|parameter_values|"metadata":|"content":/i
      );
      expect(JSON.stringify(store)).toBe(before);
    } finally {
      await stopServer(server);
    }
  });

  it("requires an authenticated teacher and never reveals another tenant catalog", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacher = await login(baseUrl, "teacher");
      const student = await login(baseUrl, "student");
      const otherTeacher = await login(baseUrl, "other_teacher", OTHER_TENANT_ID);

      const unauthenticated = await requestJson<CatalogError>(`${baseUrl}${CATALOG_PATH}`);
      const studentDenied = await requestJson<CatalogError>(`${baseUrl}${CATALOG_PATH}`, {
        headers: { authorization: `Bearer ${student.access_token}` }
      });
      const primaryTenant = await requestJson<CatalogResponse>(`${baseUrl}${CATALOG_PATH}`, {
        headers: { authorization: `Bearer ${teacher.access_token}` }
      });
      const otherTenant = await requestJson<CatalogResponse>(`${baseUrl}${CATALOG_PATH}`, {
        headers: { authorization: `Bearer ${otherTeacher.access_token}` }
      });

      expect(unauthenticated.status).toBe(401);
      expect(studentDenied.status).toBe(403);
      expect(
        primaryTenant.body.candidates.map(
          (candidate) => candidate.scenario_package_reference.tenant_id
        )
      ).toEqual([DEFAULT_TENANT_ID]);
      expect(
        otherTenant.body.candidates.map(
          (candidate) => candidate.scenario_package_reference.tenant_id
        )
      ).toEqual([OTHER_TENANT_ID]);
    } finally {
      await stopServer(server);
    }
  });
});
