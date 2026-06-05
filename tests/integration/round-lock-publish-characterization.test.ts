import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  Round,
  Run,
  SettlementResult
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP0Store, type SimWarStore } from "../../services/api/src/store";

const VALID_DECISION_PAYLOAD = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "Characterize round lock and publish command behavior."
} as const;

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP0Store();
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
    store
  };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function request<TData>(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    token?: string;
    tenantId?: string;
    servicePrincipal?: string;
    body?: unknown;
  } = {}
): Promise<{ status: number; body: ApiEnvelope<TData> }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": options.tenantId ?? "tenant_demo"
  });

  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  if (options.servicePrincipal) {
    headers.set("x-service-principal", options.servicePrincipal);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  return {
    status: response.status,
    body: (await response.json()) as ApiEnvelope<TData>
  };
}

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    method: "POST",
    body: { username, password }
  });

  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

async function createRun(baseUrl: string, teacherToken: string): Promise<Run> {
  const response = await request<{ run: Run; round: Round }>(
    baseUrl,
    "/api/v1/courses/course_demo/runs",
    {
      method: "POST",
      token: teacherToken
    }
  );

  expect(response.status).toBe(201);
  return response.body.data.run;
}

async function startRound(baseUrl: string, teacherToken: string, runId: string): Promise<Round> {
  const response = await request<Round>(baseUrl, `/api/v1/runs/${runId}/rounds/1/start`, {
    method: "POST",
    token: teacherToken
  });

  expect(response.status).toBe(200);
  expect(response.body.data.status).toBe("open");
  return response.body.data;
}

async function submitDecision(
  baseUrl: string,
  studentToken: string,
  runId: string
): Promise<Decision> {
  const response = await request<Decision>(baseUrl, `/api/v1/runs/${runId}/rounds/1/decisions`, {
    method: "POST",
    token: studentToken,
    body: {
      team_id: "team_alpha",
      decision_payload: VALID_DECISION_PAYLOAD
    }
  });

  expect(response.status).toBe(201);
  return response.body.data;
}

async function settleRound(
  baseUrl: string,
  runId: string
): Promise<{ status: number; body: ApiEnvelope<SettlementResult> }> {
  return request<SettlementResult>(baseUrl, `/internal/v1/runs/${runId}/rounds/1/settle`, {
    method: "POST",
    token: "service-kernel-token",
    servicePrincipal: "service_kernel"
  });
}

describe("round lock and publish characterization", () => {
  it("characterizes successful lock response, store mutation, and audit side effect", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const run = await createRun(baseUrl, teacherToken);
      await startRound(baseUrl, teacherToken, run.run_id);
      await submitDecision(baseUrl, studentToken, run.run_id);

      const response = await request<Round>(baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/lock`, {
        method: "POST",
        token: teacherToken
      });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe("OK");
      expect(response.body.message).toBe("success");
      expect(response.body.data).toMatchObject({
        tenant_id: "tenant_demo",
        run_id: run.run_id,
        round_no: 1,
        status: "locked",
        decision_batch_id: `batch_${run.run_id}_1`
      });
      expect(response.body.data.round_id).toBeTruthy();

      const storedRound = store.rounds.find(
        (round) => round.run_id === run.run_id && round.round_no === 1
      );
      expect(storedRound).toEqual(response.body.data);

      const lockAudit = store.auditLogs.find(
        (log) => log.action === "round.lock" && log.resource_id === response.body.data.round_id
      );
      expect(lockAudit).toMatchObject({
        tenant_id: "tenant_demo",
        actor_id: "usr_teacher",
        actor_role: "teacher",
        action: "round.lock",
        resource_type: "round",
        resource_id: response.body.data.round_id
      });
      expect(lockAudit?.before).toMatchObject({ status: "open" });
      expect(lockAudit?.after).toMatchObject({
        status: "locked",
        decision_batch_id: `batch_${run.run_id}_1`
      });
    } finally {
      await stopServer(server);
    }
  });

  it("characterizes successful publish response, store mutation, and audit side effect", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const run = await createRun(baseUrl, teacherToken);
      await startRound(baseUrl, teacherToken, run.run_id);
      await submitDecision(baseUrl, studentToken, run.run_id);

      const lockResponse = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(lockResponse.status).toBe(200);

      const settlement = await settleRound(baseUrl, run.run_id);
      expect(settlement.status).toBe(200);
      expect(settlement.body.data.replay_hash).toHaveLength(64);

      const response = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST",
          token: teacherToken
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.code).toBe("OK");
      expect(response.body.message).toBe("success");
      expect(response.body.data).toMatchObject({
        tenant_id: "tenant_demo",
        run_id: run.run_id,
        round_no: 1,
        status: "published",
        decision_batch_id: `batch_${run.run_id}_1`,
        replay_hash: settlement.body.data.replay_hash
      });

      const storedRound = store.rounds.find(
        (round) => round.run_id === run.run_id && round.round_no === 1
      );
      expect(storedRound).toEqual(response.body.data);

      const publishAudit = store.auditLogs.find(
        (log) => log.action === "round.publish" && log.resource_id === response.body.data.round_id
      );
      expect(publishAudit).toMatchObject({
        tenant_id: "tenant_demo",
        actor_id: "usr_teacher",
        actor_role: "teacher",
        action: "round.publish",
        resource_type: "round",
        resource_id: response.body.data.round_id
      });
      expect(publishAudit?.before).toMatchObject({
        status: "settled",
        replay_hash: settlement.body.data.replay_hash
      });
      expect(publishAudit?.after).toMatchObject({
        status: "published",
        replay_hash: settlement.body.data.replay_hash
      });
    } finally {
      await stopServer(server);
    }
  });

  it("characterizes authentication and authorization failures for lock and publish", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const run = await createRun(baseUrl, teacherToken);
      await startRound(baseUrl, teacherToken, run.run_id);

      const unauthenticatedLock = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        {
          method: "POST"
        }
      );
      expect(unauthenticatedLock.status).toBe(401);
      expect(unauthenticatedLock.body.code).toBe("AUTH-401-001");

      const forbiddenLock = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        {
          method: "POST",
          token: studentToken
        }
      );
      expect(forbiddenLock.status).toBe(403);
      expect(forbiddenLock.body.code).toBe("AUTHZ-403-001");

      const unauthenticatedPublish = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST"
        }
      );
      expect(unauthenticatedPublish.status).toBe(401);
      expect(unauthenticatedPublish.body.code).toBe("AUTH-401-001");

      const forbiddenPublish = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST",
          token: studentToken
        }
      );
      expect(forbiddenPublish.status).toBe(403);
      expect(forbiddenPublish.body.code).toBe("AUTHZ-403-001");
    } finally {
      await stopServer(server);
    }
  });

  it("characterizes missing run and missing round failures for lock and publish", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const run = await createRun(baseUrl, teacherToken);

      const lockMissingRun = await request<unknown>(
        baseUrl,
        "/api/v1/runs/run_missing/rounds/1/lock",
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(lockMissingRun.status).toBe(404);
      expect(lockMissingRun.body.code).toBe("RUN-404-001");

      const publishMissingRun = await request<unknown>(
        baseUrl,
        "/api/v1/runs/run_missing/rounds/1/publish",
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(publishMissingRun.status).toBe(404);
      expect(publishMissingRun.body.code).toBe("RUN-404-001");

      const lockMissingRound = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/2/lock`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(lockMissingRound.status).toBe(404);
      expect(lockMissingRound.body.code).toBe("ROUND-404-001");

      const publishMissingRound = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/2/publish`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(publishMissingRound.status).toBe(404);
      expect(publishMissingRound.body.code).toBe("ROUND-404-001");
    } finally {
      await stopServer(server);
    }
  });

  it("characterizes current round-state restrictions and decision submit interaction", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const draftRun = await createRun(baseUrl, teacherToken);

      const draftLock = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${draftRun.run_id}/rounds/1/lock`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(draftLock.status).toBe(409);
      expect(draftLock.body.code).toBe("ROUND-409-003");

      const draftPublish = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${draftRun.run_id}/rounds/1/publish`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(draftPublish.status).toBe(409);
      expect(draftPublish.body.code).toBe("ROUND-409-005");

      const run = await createRun(baseUrl, teacherToken);
      await startRound(baseUrl, teacherToken, run.run_id);

      const openPublish = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(openPublish.status).toBe(409);
      expect(openPublish.body.code).toBe("ROUND-409-005");

      await submitDecision(baseUrl, studentToken, run.run_id);
      const lockResponse = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(lockResponse.status).toBe(200);
      expect(lockResponse.body.data.status).toBe("locked");

      const lateDecision = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          method: "POST",
          token: studentToken,
          body: {
            team_id: "team_alpha",
            decision_payload: {
              ...VALID_DECISION_PAYLOAD,
              strategy_statement: "Attempting to submit after lock characterizes current behavior."
            }
          }
        }
      );
      expect(lateDecision.status).toBe(409);
      expect(lateDecision.body.code).toBe("ROUND-409-002");
    } finally {
      await stopServer(server);
    }
  });
});
