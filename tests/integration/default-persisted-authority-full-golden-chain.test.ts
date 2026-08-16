import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  Round,
  Run,
  SettlementResult
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createFormalCanonicalDecision } from "./formal-canonical-admission-helper";
import {
  DEFAULT_TENANT_ID,
  PLATFORM_TENANT_ID,
  createP1Store,
  type SimWarStore
} from "../../services/api/src/store";

const PARAMETER_SET_ID = "parameter_b01_default_http";
const PLUGIN_PACKAGE_ID = "plugin_wellness_v1";
const SCENARIO_PACKAGE_ID = "scenario_b01_default_http";
const VERSION = "1.0.0";

interface ParameterVersion {
  reference: { content_digest: string; parameter_set_id: string; version: string };
  status: "DRAFT" | "VALIDATED" | "FROZEN" | "APPROVED" | "RETIRED";
}

interface PluginVersion {
  reference: { content_digest: string; plugin_package_id: string; version: string };
  status: "DRAFT" | "VALIDATED" | "APPROVED" | "AVAILABLE" | "RETIRED";
}

interface ScenarioVersion {
  reference: {
    content_digest: string;
    scenario_package_id: string;
    tenant_id: string;
    version: string;
  };
  status: "DRAFT" | "VALIDATED" | "FROZEN" | "APPROVED" | "RETIRED";
}

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
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

async function request<TData>(
  baseUrl: string,
  path: string,
  options: { body?: unknown; method?: string; tenantId?: string; token?: string } = {}
): Promise<{ body: ApiEnvelope<TData>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": options.tenantId ?? DEFAULT_TENANT_ID
  });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);

  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? "GET"
  });
  return { body: (await response.json()) as ApiEnvelope<TData>, status: response.status };
}

async function login(
  baseUrl: string,
  username: string,
  password: string,
  tenantId = DEFAULT_TENANT_ID
): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    method: "POST",
    tenantId
  });
  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

function formalHeaders(token: string) {
  return { token, tenantId: DEFAULT_TENANT_ID };
}

describe("default persisted authority full Golden chain", () => {
  it("uses one default JSON server HTTP path from formal lifecycles to safe published replay evidence", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const platformToken = await login(baseUrl, "platform", "platform", PLATFORM_TENANT_ID);
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const platform = formalHeaders(platformToken);

      const parameterDraft = await request<ParameterVersion>(
        baseUrl,
        "/api/v1/formal-authority/parameter-sets",
        {
          ...platform,
          body: {
            compatibility_metadata: { engine_family: "toy_logit" },
            model_version_ref: "toy_logit_wellness_v1@0.1.0",
            parameter_set_id: PARAMETER_SET_ID,
            parameter_values: {
              runtime_parameter_set: {
                base_capacity: 120,
                base_market_size: 240,
                fixed_cost: 120000,
                model_family: "toy_logit",
                unit_cost: 4200
              }
            },
            schema_version: "parameter-set.v1",
            tenant_id: DEFAULT_TENANT_ID,
            version: VERSION
          },
          method: "POST"
        }
      );
      expect(parameterDraft.status).toBe(201);
      const parameterReference = parameterDraft.body.data.reference;
      const parameterTransition = (action: "validate" | "freeze" | "approve", body: object) =>
        request<{ version?: ParameterVersion } | ParameterVersion>(
          baseUrl,
          `/api/v1/formal-authority/parameter-sets/${PARAMETER_SET_ID}/versions/${VERSION}/${action}`,
          { ...platform, body, method: "POST" }
        );
      expect(
        (
          await parameterTransition("validate", {
            ...parameterReference,
            tenant_id: DEFAULT_TENANT_ID
          })
        ).status
      ).toBe(200);
      expect(
        (
          await parameterTransition("freeze", {
            ...parameterReference,
            tenant_id: DEFAULT_TENANT_ID
          })
        ).status
      ).toBe(200);
      const parameterApproved = await parameterTransition("approve", {
        ...parameterReference,
        approval_id: "approval_b01_parameter",
        tenant_id: DEFAULT_TENANT_ID
      });
      expect(parameterApproved.status).toBe(200);

      const pluginDraft = await request<PluginVersion>(
        baseUrl,
        "/api/v1/formal-authority/plugin-releases",
        {
          ...platform,
          body: {
            compatibility_metadata: { engine_family: "toy_logit" },
            official_commit_permissions: [],
            plugin_manifest: {
              adapter_ref: "@simwar/simulation-core/wellnessPluginV1",
              industry: "wellness",
              manifest_version: "1.0.0",
              name: "B01 default persisted runtime plugin",
              parameter_schema_ref: "contracts/schemas/wellness-parameters.v1.json",
              parameter_schema_version: "wellness.parameters.v1",
              plugin_id: PLUGIN_PACKAGE_ID,
              settlement_hook_refs: ["adjustDemand:wellness.v1"],
              status: "approved",
              supported_hooks: ["adjustDemand"],
              version: VERSION
            },
            plugin_package_id: PLUGIN_PACKAGE_ID,
            schema_version: "plugin-release.v1",
            version: VERSION
          },
          method: "POST"
        }
      );
      expect(pluginDraft.status).toBe(201);
      const pluginReference = pluginDraft.body.data.reference;
      const pluginTransition = (action: "validate" | "approve" | "make-available", body: object) =>
        request<{ version?: PluginVersion } | PluginVersion>(
          baseUrl,
          `/api/v1/formal-authority/plugin-releases/${PLUGIN_PACKAGE_ID}/versions/${VERSION}/${action}`,
          { ...platform, body, method: "POST" }
        );
      expect((await pluginTransition("validate", pluginReference)).status).toBe(200);
      expect(
        (
          await pluginTransition("approve", {
            ...pluginReference,
            owner_decision_id: "approval_b01_plugin"
          })
        ).status
      ).toBe(200);
      expect(
        (
          await pluginTransition("make-available", {
            ...pluginReference,
            availability_decision_id: "availability_b01_plugin"
          })
        ).status
      ).toBe(200);

      const scenarioDraft = await request<ScenarioVersion>(
        baseUrl,
        "/api/v1/formal-authority/scenario-packages",
        {
          ...platform,
          body: {
            artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
            compatibility_metadata: { engine: "simulation-core.v1", plugin_api: "plugin-api.v1" },
            content: {
              runtime_scenario_package: {
                name: "B01 default persisted authority scenario",
                plugin_package_ids: [PLUGIN_PACKAGE_ID]
              }
            },
            metadata: { privacy_classification: "synthetic_internal", title: "B01 HTTP scenario" },
            parameter_set_reference: parameterReference,
            plugin_dependencies: [{ plugin_package_id: PLUGIN_PACKAGE_ID, version: VERSION }],
            scenario_package_id: SCENARIO_PACKAGE_ID,
            schema_version: "scenario-package.v1",
            tenant_id: DEFAULT_TENANT_ID,
            version: VERSION
          },
          method: "POST"
        }
      );
      expect(scenarioDraft.status).toBe(201);
      const scenarioReference = scenarioDraft.body.data.reference;
      const scenarioTransition = (action: "validate" | "freeze" | "approve", body: object) =>
        request<{ version?: ScenarioVersion } | ScenarioVersion>(
          baseUrl,
          `/api/v1/formal-authority/scenario-packages/${SCENARIO_PACKAGE_ID}/versions/${VERSION}/${action}`,
          { ...platform, body, method: "POST" }
        );
      expect((await scenarioTransition("validate", scenarioReference)).status).toBe(200);
      expect((await scenarioTransition("freeze", scenarioReference)).status).toBe(200);
      expect(
        (
          await scenarioTransition("approve", {
            ...scenarioReference,
            approval_id: "approval_b01_scenario",
            tenant_id: DEFAULT_TENANT_ID
          })
        ).status
      ).toBe(200);

      const course = await request<{ course_id: string }>(baseUrl, "/api/v1/courses", {
        body: {
          formal_authority_binding: {
            engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
            parameter_set_reference: parameterReference,
            scenario_package_reference: scenarioReference
          },
          title: "B01 default persisted authority course"
        },
        method: "POST",
        token: teacherToken
      });
      expect(course.status).toBe(201);
      const courseId = course.body.data.course_id;
      expect(store.formalCourseAuthorityBindings).toHaveLength(1);
      expect(
        (
          await request(baseUrl, `/api/v1/courses/${courseId}/publish`, {
            method: "POST",
            token: teacherToken
          })
        ).status
      ).toBe(200);
      const team = await request<{ team_id: string }>(
        baseUrl,
        `/api/v1/courses/${courseId}/teams`,
        {
          body: { captain_user_id: "usr_student", name: "B01 Student Team" },
          method: "POST",
          token: teacherToken
        }
      );
      expect(team.status).toBe(201);

      const runResponse = await request<{ round: Round; run: Run }>(
        baseUrl,
        `/api/v1/courses/${courseId}/runs`,
        { body: { formal_runtime_seed: 20260728 }, method: "POST", token: teacherToken }
      );
      expect(runResponse.status, JSON.stringify(runResponse.body)).toBe(201);
      const run = runResponse.body.data.run;
      expect(store.formalRunRuntimeBindings).toHaveLength(1);
      expect(
        (
          await request(baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/start`, {
            method: "POST",
            token: teacherToken
          })
        ).status
      ).toBe(200);
      await createFormalCanonicalDecision(store, run.run_id, team.body.data.team_id, "usr_student");
      expect(
        (
          await request(baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/lock`, {
            method: "POST",
            token: teacherToken
          })
        ).status
      ).toBe(200);
      const settlement = await request<SettlementResult>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(settlement.status).toBe(200);
      expect(
        (
          await request(baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/publish`, {
            method: "POST",
            token: teacherToken
          })
        ).status
      ).toBe(200);

      const officialResults = structuredClone(store.settlementResults);
      const teacherResults = await request<{ replay_evidence?: unknown; results: unknown[] }>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        { token: teacherToken }
      );
      expect(teacherResults.status).toBe(200);
      expect(teacherResults.body.data.replay_evidence).toBeDefined();
      const studentResults = await request<{ replay_evidence?: unknown; results: unknown[] }>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        { token: studentToken }
      );
      expect(studentResults.status).toBe(200);
      expect(studentResults.body.data.replay_evidence).toBeUndefined();
      expect(JSON.stringify(studentResults.body.data)).not.toContain("state_true");
      expect(store.settlementResults).toEqual(officialResults);
    } finally {
      await stopServer(server);
    }
  });
});
