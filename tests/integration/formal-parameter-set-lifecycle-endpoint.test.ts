import { once } from "node:events";
import { request as nodeRequest, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import {
  DEFAULT_TENANT_ID,
  PLATFORM_TENANT_ID,
  createP1Store,
  type SimWarStore
} from "../../services/api/src/store";

const PARAMETER_SET_ID = "parameter_api_lifecycle";
const VERSION = "1.0.0";
const BASE_PATH = "/api/v1/formal-authority/parameter-sets";

interface FormalParameterSetVersionResponse {
  content_digest: string;
  parameter_set_id: string;
  reference: {
    content_digest: string;
    parameter_set_id: string;
    version: string;
  };
  status: "DRAFT" | "VALIDATED" | "FROZEN" | "APPROVED" | "RETIRED";
  tenant_id: string;
  version: string;
}

interface FormalParameterSetApprovalResponse {
  approval_record: {
    approval_id: string;
    tenant_id: string;
  };
  version: FormalParameterSetVersionResponse;
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

function lifecycleHeaders(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    "x-tenant-id": DEFAULT_TENANT_ID
  };
}

describe("formal ParameterSet lifecycle endpoint", () => {
  it("persists a platform-admin lifecycle with exact references and audit records", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const platform = await login(baseUrl, "platform", "platform", PLATFORM_TENANT_ID);
      const headers = lifecycleHeaders(platform.access_token);
      const draft = await requestJson<ApiEnvelope<FormalParameterSetVersionResponse>>(
        `${baseUrl}${BASE_PATH}`,
        {
          body: {
            compatibility_metadata: { engine_family: "toy_logit" },
            model_version_ref: "toy_logit_wellness_v1@0.1.0",
            parameter_set_id: PARAMETER_SET_ID,
            parameter_values: { base_capacity: 120, base_market_size: 240 },
            schema_version: "parameter-set.v1",
            tenant_id: DEFAULT_TENANT_ID,
            version: VERSION
          },
          headers,
          method: "POST"
        }
      );

      expect(draft.status).toBe(201);
      expect(draft.body.data).toMatchObject({
        parameter_set_id: PARAMETER_SET_ID,
        status: "DRAFT",
        tenant_id: DEFAULT_TENANT_ID,
        version: VERSION
      });

      const reference = draft.body.data.reference;
      const transitionUrl = (action: string) =>
        `${baseUrl}${BASE_PATH}/${PARAMETER_SET_ID}/versions/${VERSION}/${action}`;
      const validated = await requestJson<ApiEnvelope<FormalParameterSetVersionResponse>>(
        transitionUrl("validate"),
        { body: { ...reference, tenant_id: DEFAULT_TENANT_ID }, headers, method: "POST" }
      );
      const frozen = await requestJson<ApiEnvelope<FormalParameterSetVersionResponse>>(
        transitionUrl("freeze"),
        { body: { ...reference, tenant_id: DEFAULT_TENANT_ID }, headers, method: "POST" }
      );
      const approved = await requestJson<ApiEnvelope<FormalParameterSetApprovalResponse>>(
        transitionUrl("approve"),
        {
          body: {
            ...reference,
            approval_id: "approval_parameter_api_lifecycle",
            tenant_id: DEFAULT_TENANT_ID
          },
          headers,
          method: "POST"
        }
      );
      const retired = await requestJson<ApiEnvelope<FormalParameterSetVersionResponse>>(
        transitionUrl("retire"),
        { body: { ...reference, tenant_id: DEFAULT_TENANT_ID }, headers, method: "POST" }
      );

      expect(validated.status).toBe(200);
      expect(validated.body.data.status).toBe("VALIDATED");
      expect(frozen.body.data.status).toBe("FROZEN");
      expect(approved.body.data).toMatchObject({
        approval_record: {
          approval_id: "approval_parameter_api_lifecycle",
          tenant_id: DEFAULT_TENANT_ID
        },
        version: { status: "APPROVED" }
      });
      expect(retired.body.data.status).toBe("RETIRED");
      expect(store.formalParameterSetLifecycleSnapshots).toHaveLength(5);
      expect(store.formalParameterSetApprovalRecords).toEqual([
        expect.objectContaining({
          approval_id: "approval_parameter_api_lifecycle",
          tenant_id: DEFAULT_TENANT_ID
        })
      ]);
      const lifecycleAudits = store.auditLogs.filter((entry) =>
        entry.action.startsWith("parameter_set.")
      );
      expect(lifecycleAudits.map((entry) => entry.action)).toEqual([
        "parameter_set.create",
        "parameter_set.validate",
        "parameter_set.freeze",
        "parameter_set.approve",
        "parameter_set.retire"
      ]);
      expect(lifecycleAudits.every((entry) => entry.actor_id === "usr_platform")).toBe(true);
      expect(lifecycleAudits.every((entry) => entry.tenant_id === DEFAULT_TENANT_ID)).toBe(true);
    } finally {
      await stopServer(server);
    }
  });

  it("rejects non-platform actors and invalid lifecycle transitions", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const platform = await login(baseUrl, "platform", "platform", PLATFORM_TENANT_ID);
      const tenantAdmin = await login(baseUrl, "admin", "admin", DEFAULT_TENANT_ID);
      const body = {
        compatibility_metadata: { engine_family: "toy_logit" },
        model_version_ref: "toy_logit_wellness_v1@0.1.0",
        parameter_set_id: "parameter_api_rejected",
        parameter_values: { base_capacity: 120 },
        schema_version: "parameter-set.v1",
        tenant_id: DEFAULT_TENANT_ID,
        version: VERSION
      };
      const tenantAdminCreate = await requestJson<ApiEnvelope<FormalParameterSetVersionResponse>>(
        `${baseUrl}${BASE_PATH}`,
        { body, headers: lifecycleHeaders(tenantAdmin.access_token), method: "POST" }
      );
      const platformCreate = await requestJson<ApiEnvelope<FormalParameterSetVersionResponse>>(
        `${baseUrl}${BASE_PATH}`,
        { body, headers: lifecycleHeaders(platform.access_token), method: "POST" }
      );
      const crossTenantBody = await requestJson<ApiEnvelope<FormalParameterSetVersionResponse>>(
        `${baseUrl}${BASE_PATH}`,
        {
          body: {
            ...body,
            parameter_set_id: "parameter_api_cross_tenant",
            tenant_id: "tenant_other"
          },
          headers: lifecycleHeaders(platform.access_token),
          method: "POST"
        }
      );
      const invalidApproval = await requestJson<ApiEnvelope<FormalParameterSetApprovalResponse>>(
        `${baseUrl}${BASE_PATH}/parameter_api_rejected/versions/${VERSION}/approve`,
        {
          body: {
            ...platformCreate.body.data.reference,
            approval_id: "approval_rejected_draft",
            tenant_id: DEFAULT_TENANT_ID
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
