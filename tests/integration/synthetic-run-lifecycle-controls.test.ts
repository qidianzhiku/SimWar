import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  DecisionPayload,
  Round,
  Run,
  SettlementResult,
  SyntheticRunLifecycleControlDTO,
  SyntheticRunLifecycleOperation,
  SyntheticRunLifecycleOperationResultDTO
} from "../../packages/shared-contracts/src";
import { createApiServer, type CreateApiServerOptions } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const VALID_DECISION_PAYLOAD = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "Synthetic lifecycle control evidence."
} as const satisfies DecisionPayload;

type BaseUrlProbe = (baseUrl: string) => Promise<void>;

const MAX_LISTEN_ATTEMPTS = 8;

async function probeBaseUrl(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/healthz`);

  if (response.status !== 200) {
    throw new Error("test server health contract mismatch");
  }

  const envelope = (await response.json()) as ApiEnvelope<{
    service: string;
    status: string;
    truthBoundary: string;
  }>;

  if (
    envelope.data.service !== "@simwar/api" ||
    envelope.data.status !== "ok" ||
    envelope.data.truthBoundary !== "structured-core-only"
  ) {
    throw new Error("test server health contract mismatch");
  }
}

function isNodeFetchBadPortError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    error.message === "fetch failed" &&
    error.cause instanceof Error &&
    error.cause.message === "bad port"
  );
}

async function startServer(
  options: CreateApiServerOptions = {},
  probe: BaseUrlProbe = probeBaseUrl
): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  const server = createApiServer(store, options);

  for (let attempt = 1; attempt <= MAX_LISTEN_ATTEMPTS; attempt += 1) {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();

    if (!address || typeof address === "string" || address.port <= 0) {
      await stopServer(server);
      throw new Error("test server did not bind to a TCP port");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      await probe(baseUrl);
      return { baseUrl, server, store };
    } catch (error) {
      await stopServer(server);

      if (server.listening) {
        throw new Error("test server failed to close after probe failure");
      }

      if (!isNodeFetchBadPortError(error)) {
        throw error;
      }
    }
  }

  throw new Error("unable to allocate a Node-fetch-usable ephemeral port");
}

async function stopServer(server: Server): Promise<void> {
  if (!server.listening) return;
  const closeEvent = once(server, "close");
  server.close();
  await closeEvent;
}

async function request<TData>(
  baseUrl: string,
  path: string,
  options: {
    body?: unknown;
    method?: string;
    requestId?: string;
    tenantId?: string;
    token?: string;
  } = {}
): Promise<{ body: ApiEnvelope<TData>; status: number }> {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.requestId) headers.set("x-request-id", options.requestId);
  if (options.tenantId) headers.set("x-tenant-id", options.tenantId);
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);

  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? "GET"
  });

  return {
    body: (await response.json()) as ApiEnvelope<TData>,
    status: response.status
  };
}

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

async function createRun(
  baseUrl: string,
  teacherToken: string,
  options: { start?: boolean } = {}
): Promise<Run> {
  const response = await request<{ round: Round; run: Run }>(
    baseUrl,
    "/api/v1/courses/course_demo/runs",
    { method: "POST", token: teacherToken }
  );
  expect(response.status).toBe(201);
  const run = response.body.data.run;

  if (options.start) {
    const start = await request<Round>(baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/start`, {
      method: "POST",
      token: teacherToken
    });
    expect(start.status).toBe(200);
    expect(start.body.data.status).toBe("open");
  }

  return run;
}

async function submitDecision(
  baseUrl: string,
  studentToken: string,
  runId: string,
  statement = VALID_DECISION_PAYLOAD.strategy_statement
): Promise<{ body: ApiEnvelope<Decision>; status: number }> {
  return request<Decision>(baseUrl, `/api/v1/runs/${runId}/rounds/1/decisions`, {
    body: {
      decision_payload: { ...VALID_DECISION_PAYLOAD, strategy_statement: statement },
      team_id: "team_alpha"
    },
    method: "POST",
    token: studentToken
  });
}

function lifecyclePath(
  runId: string,
  operation: SyntheticRunLifecycleOperation,
  courseId = "course_demo"
): string {
  return `/api/v1/bff/admin/courses/${courseId}/runs/${runId}/lifecycle/${operation}`;
}

async function lifecycleOperation(
  baseUrl: string,
  adminToken: string,
  runId: string,
  operation: SyntheticRunLifecycleOperation,
  options: { body?: unknown; courseId?: string; tenantId?: string } = {}
): Promise<{ body: ApiEnvelope<SyntheticRunLifecycleOperationResultDTO>; status: number }> {
  return request<SyntheticRunLifecycleOperationResultDTO>(
    baseUrl,
    lifecyclePath(runId, operation, options.courseId),
    {
      body: options.body ?? { confirmation: `${operation.toUpperCase()} ${runId}` },
      method: "POST",
      tenantId: options.tenantId,
      token: adminToken
    }
  );
}

describe("synthetic pre-settlement lifecycle controls", () => {
  it("rejects a health endpoint with the wrong contract", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          data: {
            service: "@simwar/api",
            status: "degraded",
            truthBoundary: "structured-core-only"
          }
        })
      );
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();

    if (!address || typeof address === "string") {
      await stopServer(server);
      throw new Error("invalid health test server address");
    }

    try {
      await expect(probeBaseUrl(`http://127.0.0.1:${address.port}`)).rejects.toThrow(
        "test server health contract mismatch"
      );
    } finally {
      await stopServer(server);
    }
  });

  it("retries after an explicit Node fetch bad-port rejection", async () => {
    let probeCount = 0;
    const probedBaseUrls: string[] = [];
    const started = await startServer({}, async (baseUrl) => {
      probeCount += 1;
      probedBaseUrls.push(baseUrl);

      if (probeCount === 1) {
        throw new TypeError("fetch failed", { cause: new Error("bad port") });
      }
    });

    try {
      expect(probeCount).toBe(2);
      expect(probedBaseUrls).toHaveLength(2);
      expect(started.server.listening).toBe(true);
      expect(started.baseUrl).toBe(probedBaseUrls[1]);
    } finally {
      await stopServer(started.server);
    }

    expect(started.server.listening).toBe(false);
  });

  it("classifies only the exact Node fetch bad-port error", () => {
    expect(
      isNodeFetchBadPortError(new TypeError("fetch failed", { cause: new Error("bad port") }))
    ).toBe(true);
    expect(
      isNodeFetchBadPortError(new TypeError("different failure", { cause: new Error("bad port") }))
    ).toBe(false);
    expect(
      isNodeFetchBadPortError(new TypeError("fetch failed", { cause: new Error("other cause") }))
    ).toBe(false);
    expect(isNodeFetchBadPortError(new Error("bad port"))).toBe(false);
  });

  it("rethrows unrelated probe failures without retrying", async () => {
    const failure = new TypeError("unrelated probe failure");
    let probeCount = 0;
    let probedBaseUrl = "";

    await expect(
      startServer({}, async (baseUrl) => {
        probeCount += 1;
        probedBaseUrl = baseUrl;
        throw failure;
      })
    ).rejects.toBe(failure);

    expect(probeCount).toBe(1);
    await expect(fetch(`${probedBaseUrl}/healthz`)).rejects.toThrow();
  });

  it("fails closed after eight explicit bad-port errors", async () => {
    let probeCount = 0;

    await expect(
      startServer({}, async () => {
        probeCount += 1;
        throw new TypeError("fetch failed", { cause: new Error("bad port") });
      })
    ).rejects.toThrow("unable to allocate a Node-fetch-usable ephemeral port");

    expect(probeCount).toBe(8);
  });

  it("accepts the real API health contract before returning", async () => {
    const started = await startServer();

    try {
      const response = await fetch(`${started.baseUrl}/healthz`);
      const body = (await response.json()) as ApiEnvelope<{
        service: string;
        status: string;
        truthBoundary: string;
      }>;

      expect(response.status).toBe(200);
      expect(body.data).toMatchObject({
        service: "@simwar/api",
        status: "ok",
        truthBoundary: "structured-core-only"
      });
    } finally {
      await stopServer(started.server);
    }

    expect(started.server.listening).toBe(false);
  });

  it("exposes only authenticated tenant-admin controls from server-owned tenant scope", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const adminToken = await login(baseUrl, "admin", "admin");
      const run = await createRun(baseUrl, teacherToken);
      const controls = await request<SyntheticRunLifecycleControlDTO[]>(
        baseUrl,
        "/api/v1/bff/admin/run-lifecycle-controls",
        { token: adminToken }
      );

      expect(controls.status).toBe(200);
      expect(controls.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            allowed_operations: ["abort"],
            course_id: "course_demo",
            lifecycle_state: "ACTIVE",
            pre_publication: true,
            pre_settlement: true,
            run_id: run.run_id,
            runtime_boundary: "JSON_INTERNAL_ONLY",
            synthetic_marker: true,
            tenant_id: "tenant_demo"
          })
        ])
      );
      expect(JSON.stringify(controls.body)).not.toMatch(
        /state_true|ReplayManifest|canonical_evidence_digest|decision_batch_hash/
      );

      for (const token of [teacherToken, studentToken]) {
        const denied = await request(baseUrl, "/api/v1/bff/admin/run-lifecycle-controls", {
          token
        });
        expect(denied.status).toBe(403);
      }

      const unauthenticated = await request(baseUrl, "/api/v1/bff/admin/run-lifecycle-controls");
      expect(unauthenticated.status).toBe(401);

      const crossTenant = await request(baseUrl, "/api/v1/bff/admin/run-lifecycle-controls", {
        tenantId: "tenant_other",
        token: adminToken
      });
      expect(crossTenant.status).toBe(403);
    } finally {
      await stopServer(server);
    }
  });

  it("aborts idempotently and blocks submit, lock, settlement, and publish", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const adminToken = await login(baseUrl, "admin", "admin");
      const run = await createRun(baseUrl, teacherToken, { start: true });
      const firstDecision = await submitDecision(baseUrl, studentToken, run.run_id);
      expect(firstDecision.status).toBe(201);
      const decisionSnapshot = structuredClone(store.decisions);
      const settlementSnapshot = structuredClone(store.settlementResults);

      const badConfirmation = await lifecycleOperation(baseUrl, adminToken, run.run_id, "abort", {
        body: { confirmation: "ABORT wrong-run" }
      });
      expect(badConfirmation.status).toBe(422);

      const abort = await lifecycleOperation(baseUrl, adminToken, run.run_id, "abort", {
        body: { confirmation: `ABORT ${run.run_id}`, tenant_id: "tenant_other" }
      });
      expect(abort.status).toBe(200);
      expect(abort.body.data).toMatchObject({
        idempotent: false,
        operation: "abort",
        control: {
          allowed_operations: ["reset", "cleanup"],
          evidence_frozen: true,
          lifecycle_state: "ABORTED"
        }
      });
      expect(store.decisions).toEqual(decisionSnapshot);
      expect(store.settlementResults).toEqual(settlementSnapshot);

      const auditCount = store.auditLogs.length;
      const repeatedAbort = await lifecycleOperation(baseUrl, adminToken, run.run_id, "abort");
      expect(repeatedAbort.status).toBe(200);
      expect(repeatedAbort.body.data.idempotent).toBe(true);
      expect(store.auditLogs).toHaveLength(auditCount);

      const blockedRequests = [
        await submitDecision(baseUrl, studentToken, run.run_id, "Blocked after abort."),
        await request<Round>(baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/lock`, {
          method: "POST",
          token: teacherToken
        }),
        await request<SettlementResult>(baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/settle`, {
          method: "POST",
          token: teacherToken
        }),
        await request<Round>(baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/publish`, {
          method: "POST",
          token: teacherToken
        })
      ];

      for (const blocked of blockedRequests) {
        expect(blocked.status).toBe(409);
        expect(blocked.body.code).toBe("LIFECYCLE-409-006");
      }

      const unstartedRun = await createRun(baseUrl, teacherToken);
      expect(
        (await lifecycleOperation(baseUrl, adminToken, unstartedRun.run_id, "abort")).status
      ).toBe(200);
      const blockedStart = await request<Round>(
        baseUrl,
        `/api/v1/runs/${unstartedRun.run_id}/rounds/1/start`,
        { method: "POST", token: teacherToken }
      );
      expect(blockedStart.status).toBe(409);
      expect(blockedStart.body.code).toBe("LIFECYCLE-409-006");
    } finally {
      await stopServer(server);
    }
  });

  it("resets only the lock control and preserves submitted and audit evidence", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const adminToken = await login(baseUrl, "admin", "admin");
      const run = await createRun(baseUrl, teacherToken, { start: true });
      const decision = await submitDecision(baseUrl, studentToken, run.run_id);
      expect(decision.status).toBe(201);
      const lock = await request<Round>(baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/lock`, {
        method: "POST",
        token: teacherToken
      });
      expect(lock.body.data.status).toBe("locked");
      expect(lock.body.data.decision_batch_id).toBeTruthy();

      await lifecycleOperation(baseUrl, adminToken, run.run_id, "abort");
      const decisionsBeforeReset = structuredClone(store.decisions);
      const settlementsBeforeReset = structuredClone(store.settlementResults);
      const reset = await lifecycleOperation(baseUrl, adminToken, run.run_id, "reset");

      expect(reset.status).toBe(200);
      expect(reset.body.data).toMatchObject({
        ephemeral_artifacts_changed: ["round_lock_control"],
        idempotent: false,
        operation: "reset",
        control: {
          allowed_operations: ["abort", "cleanup"],
          lifecycle_state: "RESET_READY"
        }
      });
      expect(store.rounds.find((round) => round.run_id === run.run_id)).toMatchObject({
        status: "open"
      });
      expect(store.rounds.find((round) => round.run_id === run.run_id)).not.toHaveProperty(
        "decision_batch_id"
      );
      expect(store.decisions).toEqual(decisionsBeforeReset);
      expect(store.settlementResults).toEqual(settlementsBeforeReset);

      const auditCount = store.auditLogs.length;
      const repeatedReset = await lifecycleOperation(baseUrl, adminToken, run.run_id, "reset");
      expect(repeatedReset.body.data.idempotent).toBe(true);
      expect(store.auditLogs).toHaveLength(auditCount);

      const secondDecision = await submitDecision(
        baseUrl,
        studentToken,
        run.run_id,
        "New rehearsal attempt after bounded reset."
      );
      expect(secondDecision.status).toBe(201);
      expect(secondDecision.body.data.version).toBe(2);
    } finally {
      await stopServer(server);
    }
  });

  it("cleans up as an evidence-sealed zero-delete tombstone", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const adminToken = await login(baseUrl, "admin", "admin");
      const run = await createRun(baseUrl, teacherToken, { start: true });
      expect((await submitDecision(baseUrl, studentToken, run.run_id)).status).toBe(201);

      const premature = await lifecycleOperation(baseUrl, adminToken, run.run_id, "cleanup");
      expect(premature.status).toBe(409);

      await lifecycleOperation(baseUrl, adminToken, run.run_id, "abort");
      const runSnapshot = structuredClone(store.runs);
      const roundSnapshot = structuredClone(store.rounds);
      const decisionSnapshot = structuredClone(store.decisions);
      const settlementSnapshot = structuredClone(store.settlementResults);
      const auditCountBeforeCleanup = store.auditLogs.length;
      const cleanup = await lifecycleOperation(baseUrl, adminToken, run.run_id, "cleanup");

      expect(cleanup.status).toBe(200);
      expect(cleanup.body.data).toMatchObject({
        ephemeral_artifacts_changed: [],
        idempotent: false,
        operation: "cleanup",
        control: {
          allowed_operations: [],
          lifecycle_state: "CLEANED",
          preserved_state: expect.arrayContaining([
            "decision_evidence",
            "audit_and_security_history",
            "settlement_and_official_result",
            "replay_evidence_and_references"
          ])
        }
      });
      expect(store.runs).toEqual(runSnapshot);
      expect(store.rounds).toEqual(roundSnapshot);
      expect(store.decisions).toEqual(decisionSnapshot);
      expect(store.settlementResults).toEqual(settlementSnapshot);
      expect(store.auditLogs).toHaveLength(auditCountBeforeCleanup + 1);
      expect(store.auditLogs.at(-1)).toMatchObject({
        action: "run.lifecycle.cleanup",
        resource_id: run.run_id,
        resource_type: "synthetic_run_lifecycle",
        tenant_id: "tenant_demo"
      });

      const auditCount = store.auditLogs.length;
      const repeatedCleanup = await lifecycleOperation(baseUrl, adminToken, run.run_id, "cleanup");
      expect(repeatedCleanup.body.data.idempotent).toBe(true);
      expect(store.auditLogs).toHaveLength(auditCount);
    } finally {
      await stopServer(server);
    }
  });

  it("fails closed for wrong scope, non-synthetic, settled, published, and unfrozen runs", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const adminToken = await login(baseUrl, "admin", "admin");
      const settledRun = await createRun(baseUrl, teacherToken, { start: true });

      expect(
        (
          await lifecycleOperation(baseUrl, adminToken, settledRun.run_id, "abort", {
            courseId: "course_missing"
          })
        ).status
      ).toBe(404);
      expect((await lifecycleOperation(baseUrl, adminToken, "run_missing", "abort")).status).toBe(
        404
      );
      expect(
        (
          await lifecycleOperation(baseUrl, adminToken, settledRun.run_id, "abort", {
            tenantId: "tenant_other"
          })
        ).status
      ).toBe(403);

      store.runs.push({
        course_id: "course_demo",
        parameter_set_id: "param_toy_approved_1",
        run_id: "run_unmarked",
        scenario_package_id: "scenario_eldercare_demo",
        seed: 42,
        status: "active",
        tenant_id: "tenant_demo"
      });
      store.rounds.push({
        round_id: "round_unmarked",
        round_no: 1,
        run_id: "run_unmarked",
        status: "open",
        tenant_id: "tenant_demo"
      });
      expect((await lifecycleOperation(baseUrl, adminToken, "run_unmarked", "abort")).status).toBe(
        409
      );

      expect((await submitDecision(baseUrl, studentToken, settledRun.run_id)).status).toBe(201);
      expect(
        (
          await request<Round>(baseUrl, `/api/v1/runs/${settledRun.run_id}/rounds/1/lock`, {
            method: "POST",
            token: teacherToken
          })
        ).status
      ).toBe(200);
      expect(
        (
          await request<SettlementResult>(
            baseUrl,
            `/api/v1/runs/${settledRun.run_id}/rounds/1/settle`,
            { method: "POST", token: teacherToken }
          )
        ).status
      ).toBe(200);
      const settlements = structuredClone(store.settlementResults);
      expect(
        (await lifecycleOperation(baseUrl, adminToken, settledRun.run_id, "abort")).status
      ).toBe(409);
      expect(store.settlementResults).toEqual(settlements);

      expect(
        (
          await request<Round>(baseUrl, `/api/v1/runs/${settledRun.run_id}/rounds/1/publish`, {
            method: "POST",
            token: teacherToken
          })
        ).status
      ).toBe(200);
      expect(
        (await lifecycleOperation(baseUrl, adminToken, settledRun.run_id, "cleanup")).status
      ).toBe(409);

      const unfrozenRun = await createRun(baseUrl, teacherToken);
      store.auditLogs.push({
        action: "run.lifecycle.abort",
        actor_id: "usr_admin",
        actor_role: "tenant_admin",
        after: { evidence_frozen: false, lifecycle_state: "ABORTED" },
        audit_id: "audit_unfrozen_abort",
        created_at: "2026-07-19T00:00:00.000Z",
        request_id: "req_unfrozen_abort",
        resource_id: unfrozenRun.run_id,
        resource_type: "synthetic_run_lifecycle",
        tenant_id: "tenant_demo"
      });
      expect(
        (await lifecycleOperation(baseUrl, adminToken, unfrozenRun.run_id, "cleanup")).status
      ).toBe(409);
    } finally {
      await stopServer(server);
    }
  });
});
