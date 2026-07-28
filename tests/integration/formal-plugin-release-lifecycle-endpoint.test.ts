import { once } from "node:events";
import { request as nodeRequest, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession, PluginManifest } from "../../packages/shared-contracts/src";
import { ELDERCARE_WELLNESS_PLUGIN_MANIFEST } from "../../plugins/wellness/eldercare-plugin-v1";
import { createApiServer } from "../../services/api/src/server";
import {
  DEFAULT_TENANT_ID,
  PLATFORM_TENANT_ID,
  createP1Store,
  type SimWarStore
} from "../../services/api/src/store";

const PLUGIN_PACKAGE_ID = "plugin_release_api_lifecycle";
const VERSION = "1.0.0";
const BASE_PATH = "/api/v1/formal-authority/plugin-releases";

interface PluginReleaseVersionResponse {
  reference: { content_digest: string; plugin_package_id: string; version: string };
  status: "DRAFT" | "VALIDATED" | "APPROVED" | "AVAILABLE" | "RETIRED";
}

async function requestJson<T>(
  url: string,
  options: { body?: unknown; headers?: Record<string, string>; method?: string } = {}
) {
  return new Promise<{ body: T; status: number }>((resolve, reject) => {
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
    if (options.body !== undefined) request.write(JSON.stringify(options.body));
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
  if (!address || typeof address === "string")
    throw new Error("test server did not bind to a TCP port");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

function releaseBody() {
  const plugin_manifest: PluginManifest = {
    ...ELDERCARE_WELLNESS_PLUGIN_MANIFEST,
    plugin_id: PLUGIN_PACKAGE_ID,
    status: "approved",
    version: VERSION
  };
  return {
    compatibility_metadata: { engine_family: "eldercare-core.v1" },
    official_commit_permissions: [],
    plugin_manifest,
    plugin_package_id: PLUGIN_PACKAGE_ID,
    schema_version: "plugin-release.v1",
    version: VERSION
  };
}

function headers(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    "x-tenant-id": DEFAULT_TENANT_ID
  };
}

describe("formal PluginRelease lifecycle endpoint", () => {
  it("persists platform-governed DRAFT through AVAILABLE and RETIRED records without runtime activation", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const platform = await login(baseUrl, "platform", "platform", PLATFORM_TENANT_ID);
      const authHeaders = headers(platform.access_token);
      const draft = await requestJson<ApiEnvelope<PluginReleaseVersionResponse>>(
        `${baseUrl}${BASE_PATH}`,
        { body: releaseBody(), headers: authHeaders, method: "POST" }
      );
      expect(draft.status).toBe(201);
      const reference = draft.body.data.reference;
      const transition = (action: string, body: object = reference) =>
        requestJson<
          ApiEnvelope<{ version: PluginReleaseVersionResponse } | PluginReleaseVersionResponse>
        >(`${baseUrl}${BASE_PATH}/${PLUGIN_PACKAGE_ID}/versions/${VERSION}/${action}`, {
          body,
          headers: authHeaders,
          method: "POST"
        });
      const validated = await transition("validate");
      const approved = await transition("approve", {
        ...reference,
        owner_decision_id: "owner-plugin-api-001"
      });
      const available = await transition("make-available", {
        ...reference,
        availability_decision_id: "availability-plugin-api-001"
      });
      const retired = await transition("retire");
      expect(validated.body.data).toMatchObject({ status: "VALIDATED" });
      expect(approved.body.data).toMatchObject({ version: { status: "APPROVED" } });
      expect(available.body.data).toMatchObject({ version: { status: "AVAILABLE" } });
      expect(retired.body.data).toMatchObject({ status: "RETIRED" });
      expect(store.formalPluginReleaseLifecycleSnapshots).toHaveLength(5);
      expect(store.formalPluginReleaseApprovalRecords).toHaveLength(1);
      expect(store.formalPluginReleaseAvailabilityRecords).toHaveLength(1);
      expect(
        store.auditLogs
          .filter((entry) => entry.action.startsWith("plugin_release."))
          .map((entry) => entry.action)
      ).toEqual([
        "plugin_release.create",
        "plugin_release.validate",
        "plugin_release.approve",
        "plugin_release.make_available",
        "plugin_release.retire"
      ]);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("rejects tenant-admin ingress and skipped approval", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const platform = await login(baseUrl, "platform", "platform", PLATFORM_TENANT_ID);
      const admin = await login(baseUrl, "admin", "admin", DEFAULT_TENANT_ID);
      const denied = await requestJson<ApiEnvelope<PluginReleaseVersionResponse>>(
        `${baseUrl}${BASE_PATH}`,
        { body: releaseBody(), headers: headers(admin.access_token), method: "POST" }
      );
      const created = await requestJson<ApiEnvelope<PluginReleaseVersionResponse>>(
        `${baseUrl}${BASE_PATH}`,
        { body: releaseBody(), headers: headers(platform.access_token), method: "POST" }
      );
      const skipped = await requestJson<ApiEnvelope<PluginReleaseVersionResponse>>(
        `${baseUrl}${BASE_PATH}/${PLUGIN_PACKAGE_ID}/versions/${VERSION}/approve`,
        {
          body: { ...created.body.data.reference, owner_decision_id: "owner-skipped" },
          headers: headers(platform.access_token),
          method: "POST"
        }
      );
      expect(denied.status).toBe(403);
      expect(created.status).toBe(201);
      expect(skipped.status).toBe(409);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
