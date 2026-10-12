import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request as nodeRequest, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import {
  DEFAULT_TENANT_ID,
  PLATFORM_TENANT_ID,
  StoreSnapshotError,
  createP1Store,
  type SimWarStore
} from "../../services/api/src/store";

const tempDirs: string[] = [];
const TEST_SECURITY_CONFIG = {
  environment: "test" as const,
  internalServiceToken: "test-internal-service-token",
  jwtSecret: "test-jwt-secret-with-sufficient-length"
};

function createSnapshotPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "simwar-snapshot-startup-"));
  tempDirs.push(dir);
  return join(dir, "simwar-store.json");
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
    if (options.body !== undefined) request.write(JSON.stringify(options.body));
    request.end();
  });
}

async function login(baseUrl: string): Promise<AuthSession> {
  const response = await requestJson<ApiEnvelope<AuthSession>>(`${baseUrl}/api/v1/auth/login`, {
    body: { password: "platform", username: "platform" },
    headers: { "content-type": "application/json", "x-tenant-id": PLATFORM_TENANT_ID },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data;
}

async function startServer(store: SimWarStore): Promise<{ baseUrl: string; server: Server }> {
  const server = createApiServer(store, { securityConfig: TEST_SECURITY_CONFIG });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe("JSON snapshot startup behavior", () => {
  it("reopens an API-generated lifecycle audit without changing persisted bytes or canonical truth", async () => {
    const snapshotPath = createSnapshotPath();
    const store = createP1Store({ persistenceFile: snapshotPath });
    let server: Server | undefined;

    try {
      const started = await startServer(store);
      server = started.server;
      const platform = await login(started.baseUrl);
      const headers = {
        authorization: `Bearer ${platform.access_token}`,
        "content-type": "application/json",
        "x-tenant-id": DEFAULT_TENANT_ID
      };
      const parameterSetId = "parameter_snapshot_api_reopen";
      const version = "1.0.0";
      const created = await requestJson<
        ApiEnvelope<{ reference: Record<string, string>; status: string }>
      >(`${started.baseUrl}/api/v1/formal-authority/parameter-sets`, {
        body: {
          compatibility_metadata: { engine_family: "toy_logit" },
          model_version_ref: "toy_logit_wellness_v1@0.1.0",
          parameter_set_id: parameterSetId,
          parameter_values: { base_capacity: 120, base_market_size: 240 },
          schema_version: "parameter-set.v1",
          tenant_id: DEFAULT_TENANT_ID,
          version
        },
        headers,
        method: "POST"
      });
      expect(created.status).toBe(201);

      const reference = created.body.data.reference;
      const validated = await requestJson<ApiEnvelope<Record<string, unknown>>>(
        `${started.baseUrl}/api/v1/formal-authority/parameter-sets/${parameterSetId}/versions/${version}/validate`,
        { body: { ...reference, tenant_id: DEFAULT_TENANT_ID }, headers, method: "POST" }
      );
      expect(validated.status).toBe(200);
      expect(validated.body.data).toMatchObject({
        parameter_set_id: parameterSetId,
        status: "VALIDATED",
        tenant_id: DEFAULT_TENANT_ID,
        version
      });
      expect(
        store.auditLogs.some(
          (entry) =>
            entry.action === "parameter_set.validate" &&
            entry.resource_id === `${parameterSetId}@${version}:${reference.content_digest}`
        )
      ).toBe(true);

      const auditBeforeClose = structuredClone(store.auditLogs);
      const canonicalTruthBeforeClose = structuredClone({
        decisions: store.decisions,
        formalParameterSetLifecycleSnapshots: store.formalParameterSetLifecycleSnapshots,
        rounds: store.rounds,
        runs: store.runs,
        settlementResults: store.settlementResults
      });
      const rawBeforeClose = readFileSync(snapshotPath, "utf8");
      const snapshotBeforeClose = JSON.parse(rawBeforeClose) as Record<string, unknown>;

      await stopServer(started.server);
      server = undefined;

      const reopened = createP1Store({ persistenceFile: snapshotPath });
      const rawAfterReopen = readFileSync(snapshotPath, "utf8");
      expect(rawAfterReopen).toBe(rawBeforeClose);
      expect(JSON.parse(rawAfterReopen)).toEqual(snapshotBeforeClose);
      expect(reopened.auditLogs).toEqual(auditBeforeClose);
      expect({
        decisions: reopened.decisions,
        formalParameterSetLifecycleSnapshots: reopened.formalParameterSetLifecycleSnapshots,
        rounds: reopened.rounds,
        runs: reopened.runs,
        settlementResults: reopened.settlementResults
      }).toEqual(canonicalTruthBeforeClose);
    } finally {
      if (server?.listening) {
        await stopServer(server);
      }
    }
  });

  it("fails API startup when the configured JSON snapshot is corrupted", () => {
    const snapshotPath = createSnapshotPath();
    writeFileSync(snapshotPath, '{"users":', "utf8");

    expect(() =>
      createApiServer(createP1Store({ persistenceFile: snapshotPath }), {
        securityConfig: TEST_SECURITY_CONFIG
      })
    ).toThrow(StoreSnapshotError);

    expect(() =>
      createApiServer(createP1Store({ persistenceFile: snapshotPath }), {
        securityConfig: TEST_SECURITY_CONFIG
      })
    ).toThrow("store_snapshot_corrupted");
  });
});
