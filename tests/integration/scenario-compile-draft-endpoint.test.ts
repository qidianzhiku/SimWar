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

const COMPILE_DRAFT_PATH = "/api/v1/formal-authority/scenario-packages/compile-draft";
const SCENARIO_PACKAGE_ID = "scenario_compile_draft_001";
const VERSION = "1.0.0";

interface FormalScenarioPackageVersion {
  content_digest: string;
  reference: {
    content_digest: string;
    scenario_package_id: string;
    tenant_id: string;
    version: string;
  };
  status: "DRAFT" | "VALIDATED" | "FROZEN" | "APPROVED" | "RETIRED";
}

interface CompileDraftResult {
  draft: FormalScenarioPackageVersion | null;
  report: {
    candidate_content_digest: string | null;
    compiler_version: string;
    errors: string[];
    input_digest: string;
    status: "INVALID" | "VALID";
    warnings: string[];
  };
}

interface CatalogResponse {
  candidates: Array<{
    scenario_package_reference: { scenario_package_id: string; version: string };
    status: "APPROVED";
  }>;
}

async function requestJson<T>(
  url: string,
  options: { body?: unknown; headers?: Record<string, string>; method?: string } = {}
): Promise<{ body: T; status: number }> {
  return new Promise((resolve, reject) => {
    const request = nodeRequest(
      url,
      {
        headers: options.headers,
        method: options.method ?? "GET"
      },
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

async function login(baseUrl: string, username: string, tenantId = DEFAULT_TENANT_ID) {
  const response = await requestJson<ApiEnvelope<AuthSession>>(`${baseUrl}/api/v1/auth/login`, {
    body: { password: username, username },
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data;
}

async function createApprovedParameterSet(store: SimWarStore) {
  const runtime = createJsonFormalScenarioAuthorityRuntime(
    createJsonFormalScenarioAuthorityPersistence(store)
  );
  const actor = {
    actor_id: "usr_platform",
    capabilities: ["parameter_set:manage"] as const,
    correlation_id: "scenario_compile_draft_seed",
    tenant_id: DEFAULT_TENANT_ID
  };
  const draft = await runtime.parameterSets.createDraft(actor, {
    compatibility_metadata: { engine_family: "toy_logit" },
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: "parameter_set_compile_draft_001",
    parameter_values: { base_capacity: 120, base_market_size: 240 },
    schema_version: "parameter-set.v1",
    tenant_id: DEFAULT_TENANT_ID,
    version: VERSION
  });
  const validated = await runtime.parameterSets.validate(actor, draft.reference);
  const frozen = await runtime.parameterSets.freeze(actor, validated.reference);
  return runtime.parameterSets.approve(actor, frozen.reference, "parameter_compile_draft_approval");
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

function compileDraftBody(parameterSetReference: object, sourceStatus = "REGISTERED") {
  return {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { engine: "simulation-core.v1", plugin_api: "plugin-api.v1" },
    metadata: {
      license_provenance_id: "internal-synthetic-v1",
      privacy_classification: "synthetic_internal",
      title: "Compiled scenario"
    },
    parameter_set_reference: parameterSetReference,
    plugin_dependencies: [{ plugin_package_id: "generic-plugin", version: "1.0.0" }],
    scenario_package_id: SCENARIO_PACKAGE_ID,
    schema_version: "scenario-package.v1",
    source_reference: {
      license_provenance_id: "internal-synthetic-v1",
      source_digest: "b".repeat(64),
      source_id: "synthetic-source-001",
      source_kind: "SYNTHETIC_INTERNAL",
      source_version: "1.0.0",
      status: sourceStatus,
      tenant_id: DEFAULT_TENANT_ID
    },
    template: {
      content: { objectives: ["operate", "learn"], rounds: [{ label: "baseline", round_no: 1 }] },
      template_id: "scenario-template-generic-001",
      template_version: "1.0.0"
    },
    tenant_id: DEFAULT_TENANT_ID,
    version: VERSION
  };
}

describe("generic Scenario compile-to-draft endpoint", () => {
  it("persists only a valid compiler candidate as DRAFT before the explicit lifecycle exposes it to teachers", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const platform = await login(baseUrl, "platform", PLATFORM_TENANT_ID);
      const teacher = await login(baseUrl, "teacher");
      const headers = {
        authorization: `Bearer ${platform.access_token}`,
        "content-type": "application/json",
        "x-tenant-id": DEFAULT_TENANT_ID
      };
      const parameterSetReference = store.formalParameterSetLifecycleSnapshots.at(-1)?.reference;
      if (!parameterSetReference) {
        throw new Error("approved parameter set reference was not seeded");
      }

      const compiled = await requestJson<ApiEnvelope<CompileDraftResult>>(
        `${baseUrl}${COMPILE_DRAFT_PATH}`,
        {
          body: compileDraftBody(parameterSetReference),
          headers,
          method: "POST"
        }
      );

      expect(compiled.status).toBe(201);
      expect(compiled.body.data.report.status).toBe("VALID");
      expect(compiled.body.data.draft).toMatchObject({
        scenario_package_id: SCENARIO_PACKAGE_ID,
        status: "DRAFT",
        version: VERSION
      });
      expect(compiled.body.data.draft?.content_digest).toBe(
        compiled.body.data.report.candidate_content_digest
      );

      const catalogBeforeApproval = await requestJson<CatalogResponse>(
        `${baseUrl}/api/v1/bff/teacher/formal-scenario-package-catalog`,
        { headers: { authorization: `Bearer ${teacher.access_token}` } }
      );
      expect(catalogBeforeApproval.body.candidates).toEqual([]);

      const reference = compiled.body.data.draft?.reference;
      if (!reference) {
        throw new Error("compile-to-draft did not return an exact reference");
      }
      const lifecycleUrl = (action: string) =>
        `${baseUrl}/api/v1/formal-authority/scenario-packages/${SCENARIO_PACKAGE_ID}/versions/${VERSION}/${action}`;
      await requestJson(lifecycleUrl("validate"), { body: reference, headers, method: "POST" });
      await requestJson(lifecycleUrl("freeze"), { body: reference, headers, method: "POST" });
      await requestJson(lifecycleUrl("approve"), {
        body: { ...reference, approval_id: "compiled_scenario_approval" },
        headers,
        method: "POST"
      });

      const catalogAfterApproval = await requestJson<CatalogResponse>(
        `${baseUrl}/api/v1/bff/teacher/formal-scenario-package-catalog`,
        { headers: { authorization: `Bearer ${teacher.access_token}` } }
      );
      expect(catalogAfterApproval.body.candidates).toEqual([
        expect.objectContaining({
          scenario_package_reference: expect.objectContaining({
            scenario_package_id: SCENARIO_PACKAGE_ID,
            version: VERSION
          }),
          status: "APPROVED"
        })
      ]);

      await requestJson(lifecycleUrl("retire"), { body: reference, headers, method: "POST" });
      const catalogAfterRetire = await requestJson<CatalogResponse>(
        `${baseUrl}/api/v1/bff/teacher/formal-scenario-package-catalog`,
        { headers: { authorization: `Bearer ${teacher.access_token}` } }
      );
      expect(catalogAfterRetire.body.candidates).toEqual([]);
      expect(store.formalScenarioPackageLifecycleSnapshots).toHaveLength(5);
      expect(store.formalScenarioPackageApprovalRecords).toHaveLength(1);
    } finally {
      await stopServer(server);
    }
  });

  it("returns a machine-readable invalid report without writing a lifecycle snapshot", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const platform = await login(baseUrl, "platform", PLATFORM_TENANT_ID);
      const parameterSetReference = store.formalParameterSetLifecycleSnapshots.at(-1)?.reference;
      if (!parameterSetReference) {
        throw new Error("approved parameter set reference was not seeded");
      }
      const before = store.formalScenarioPackageLifecycleSnapshots.length;

      const response = await requestJson<ApiEnvelope<CompileDraftResult>>(
        `${baseUrl}${COMPILE_DRAFT_PATH}`,
        {
          body: compileDraftBody(parameterSetReference, "RETIRED"),
          headers: {
            authorization: `Bearer ${platform.access_token}`,
            "content-type": "application/json",
            "x-tenant-id": DEFAULT_TENANT_ID
          },
          method: "POST"
        }
      );

      expect(response.status).toBe(422);
      expect(response.body.data).toMatchObject({
        draft: null,
        report: { errors: ["SCENARIO_SOURCE_RETIRED"], status: "INVALID" }
      });
      expect(store.formalScenarioPackageLifecycleSnapshots).toHaveLength(before);
    } finally {
      await stopServer(server);
    }
  });

  it("does not persist a compiler-valid candidate when its exact ParameterSet reference is not bindable", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const platform = await login(baseUrl, "platform", PLATFORM_TENANT_ID);
      const parameterSetReference = store.formalParameterSetLifecycleSnapshots.at(-1)?.reference;
      if (!parameterSetReference) {
        throw new Error("approved parameter set reference was not seeded");
      }
      const before = store.formalScenarioPackageLifecycleSnapshots.length;

      const response = await requestJson<{ code: string }>(`${baseUrl}${COMPILE_DRAFT_PATH}`, {
        body: compileDraftBody({ ...parameterSetReference, content_digest: "c".repeat(64) }),
        headers: {
          authorization: `Bearer ${platform.access_token}`,
          "content-type": "application/json",
          "x-tenant-id": DEFAULT_TENANT_ID
        },
        method: "POST"
      });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("SCENARIO_PACKAGE-409-001");
      expect(store.formalScenarioPackageLifecycleSnapshots).toHaveLength(before);
    } finally {
      await stopServer(server);
    }
  });
});
