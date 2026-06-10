import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  DecisionPayload,
  Round,
  Run,
  SettlementResult
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP0Store, type SimWarStore } from "../../services/api/src/store";

const BALANCED_DECISION_PAYLOAD = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "Characterize settlement write and replay hash behavior."
} as const satisfies DecisionPayload;

const LOW_DEMAND_DECISION_PAYLOAD = {
  pricing: { base_price: 30000 },
  marketing_budget: 0,
  service_quality_budget: 10000,
  capacity_plan: "contract",
  cash_buffer_target: 0.5,
  strategy_statement: "High price and low demand strategy for characterization."
} as const satisfies DecisionPayload;

const HIGH_DEMAND_DECISION_PAYLOAD = {
  pricing: { base_price: 8000 },
  marketing_budget: 600000,
  service_quality_budget: 500000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "Low price and high demand strategy for characterization."
} as const satisfies DecisionPayload;

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
  runId: string,
  payload: DecisionPayload
): Promise<Decision> {
  const response = await request<Decision>(baseUrl, `/api/v1/runs/${runId}/rounds/1/decisions`, {
    method: "POST",
    token: studentToken,
    body: {
      team_id: "team_alpha",
      decision_payload: payload
    }
  });

  expect(response.status).toBe(201);
  return response.body.data;
}

async function lockRound(baseUrl: string, teacherToken: string, runId: string): Promise<Round> {
  const response = await request<Round>(baseUrl, `/api/v1/runs/${runId}/rounds/1/lock`, {
    method: "POST",
    token: teacherToken
  });

  expect(response.status).toBe(200);
  expect(response.body.data.status).toBe("locked");
  return response.body.data;
}

async function settleRoundViaApi(
  baseUrl: string,
  teacherToken: string,
  runId: string
): Promise<{ status: number; body: ApiEnvelope<SettlementResult> }> {
  return request<SettlementResult>(baseUrl, `/api/v1/runs/${runId}/rounds/1/settle`, {
    method: "POST",
    token: teacherToken
  });
}

async function createLockedRunWithDecision(
  baseUrl: string,
  teacherToken: string,
  studentToken: string,
  payload: DecisionPayload
): Promise<Run> {
  const run = await createRun(baseUrl, teacherToken);
  await startRound(baseUrl, teacherToken, run.run_id);
  await submitDecision(baseUrl, studentToken, run.run_id, payload);
  await lockRound(baseUrl, teacherToken, run.run_id);
  return run;
}

describe("settlement result write and replay hash characterization", () => {
  it("characterizes successful settlement write, round mutation, replay hash relationship, and audit side effect", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const run = await createLockedRunWithDecision(
        baseUrl,
        teacherToken,
        studentToken,
        BALANCED_DECISION_PAYLOAD
      );

      const response = await settleRoundViaApi(baseUrl, teacherToken, run.run_id);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe("OK");
      expect(response.body.message).toBe("success");
      expect(response.body.data).toMatchObject({
        tenant_id: "tenant_demo",
        run_id: run.run_id,
        round_no: 1,
        parameter_set_id: run.parameter_set_id,
        scenario_package_id: run.scenario_package_id
      });
      expect(response.body.data.settlement_result_id).toMatch(/^result_\d+$/);
      expect(response.body.data.round_id).toBeTruthy();
      expect(response.body.data.replay_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(response.body.data.team_results).toHaveLength(1);
      expect(response.body.data.team_results[0]?.state_true.settlement_status).toBe("settled");

      expect(store.settlementResults).toHaveLength(1);
      expect(store.settlementResults[0]).toEqual(response.body.data);

      const storedRound = store.rounds.find(
        (round) => round.run_id === run.run_id && round.round_no === 1
      );
      expect(storedRound).toMatchObject({
        status: "settled",
        replay_hash: response.body.data.replay_hash
      });
      expect(response.body.data.replay_hash).toBe(storedRound?.replay_hash);

      const settleAudit = store.auditLogs.find(
        (log) =>
          log.action === "round.settle_requested" &&
          log.resource_id === response.body.data.settlement_result_id
      );
      expect(settleAudit).toMatchObject({
        tenant_id: "tenant_demo",
        actor_id: "usr_teacher",
        actor_role: "teacher",
        action: "round.settle_requested",
        resource_type: "settlement_result",
        resource_id: response.body.data.settlement_result_id
      });
      expect(settleAudit?.after).toEqual({ replay_hash: response.body.data.replay_hash });
    } finally {
      await stopServer(server);
    }
  });

  it("characterizes repeated settlement as reusing the existing settlement result and replay hash", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const run = await createLockedRunWithDecision(
        baseUrl,
        teacherToken,
        studentToken,
        BALANCED_DECISION_PAYLOAD
      );

      const first = await settleRoundViaApi(baseUrl, teacherToken, run.run_id);
      const second = await settleRoundViaApi(baseUrl, teacherToken, run.run_id);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.data).toEqual(first.body.data);
      expect(store.settlementResults).toHaveLength(1);
      expect(store.settlementResults[0]).toEqual(first.body.data);

      const settleAudits = store.auditLogs.filter(
        (log) =>
          log.action === "round.settle_requested" &&
          log.resource_id === first.body.data.settlement_result_id
      );
      expect(settleAudits).toHaveLength(2);
      expect(settleAudits.map((log) => log.after)).toEqual([
        { replay_hash: first.body.data.replay_hash },
        { replay_hash: first.body.data.replay_hash }
      ]);
    } finally {
      await stopServer(server);
    }
  });

  it("characterizes settlement as using the latest submitted decision version for the team", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");

      const twoVersionRun = await createRun(baseUrl, teacherToken);
      await startRound(baseUrl, teacherToken, twoVersionRun.run_id);
      const firstDecision = await submitDecision(
        baseUrl,
        studentToken,
        twoVersionRun.run_id,
        LOW_DEMAND_DECISION_PAYLOAD
      );
      const latestDecision = await submitDecision(
        baseUrl,
        studentToken,
        twoVersionRun.run_id,
        HIGH_DEMAND_DECISION_PAYLOAD
      );
      expect(firstDecision.version).toBe(1);
      expect(latestDecision.version).toBe(2);
      expect(firstDecision.status).toBe("validated");
      expect(latestDecision.status).toBe("validated");

      const storedVersions = store.decisions.filter(
        (decision) =>
          decision.run_id === twoVersionRun.run_id &&
          decision.round_no === 1 &&
          decision.team_id === "team_alpha" &&
          decision.tenant_id === "tenant_demo"
      );
      expect(storedVersions.map((decision) => decision.version)).toEqual([1, 2]);
      expect(storedVersions.at(-1)).toEqual(latestDecision);

      await lockRound(baseUrl, teacherToken, twoVersionRun.run_id);
      const twoVersionSettlement = await settleRoundViaApi(
        baseUrl,
        teacherToken,
        twoVersionRun.run_id
      );

      const latestOnlyRun = await createLockedRunWithDecision(
        baseUrl,
        teacherToken,
        studentToken,
        HIGH_DEMAND_DECISION_PAYLOAD
      );
      const latestOnlySettlement = await settleRoundViaApi(
        baseUrl,
        teacherToken,
        latestOnlyRun.run_id
      );

      const firstOnlyRun = await createLockedRunWithDecision(
        baseUrl,
        teacherToken,
        studentToken,
        LOW_DEMAND_DECISION_PAYLOAD
      );
      const firstOnlySettlement = await settleRoundViaApi(
        baseUrl,
        teacherToken,
        firstOnlyRun.run_id
      );

      expect(twoVersionSettlement.status).toBe(200);
      expect(latestOnlySettlement.status).toBe(200);
      expect(firstOnlySettlement.status).toBe(200);
      expect(twoVersionSettlement.body.data.team_results).toEqual(
        latestOnlySettlement.body.data.team_results
      );
      expect(twoVersionSettlement.body.data.team_results).not.toEqual(
        firstOnlySettlement.body.data.team_results
      );

      const storedSettlement = store.settlementResults.find(
        (settlement) => settlement.run_id === twoVersionRun.run_id
      );
      expect(storedSettlement?.replay_hash).toBe(twoVersionSettlement.body.data.replay_hash);
      expect(storedSettlement?.team_results).toEqual(twoVersionSettlement.body.data.team_results);
    } finally {
      await stopServer(server);
    }
  });

  it("characterizes missing decision failure after a round is locked", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const run = await createRun(baseUrl, teacherToken);
      await startRound(baseUrl, teacherToken, run.run_id);
      await lockRound(baseUrl, teacherToken, run.run_id);

      const response = await settleRoundViaApi(baseUrl, teacherToken, run.run_id);

      expect(response.status).toBe(422);
      expect(response.body.code).toBe("SETTLE-422-001");
      expect(response.body.message).toBe("scenario, parameter set and team decisions are required");
      expect(store.settlementResults).toHaveLength(0);

      const storedRound = store.rounds.find(
        (round) => round.run_id === run.run_id && round.round_no === 1
      );
      expect(storedRound).toMatchObject({
        status: "locked"
      });
      expect(storedRound?.replay_hash).toBeUndefined();
    } finally {
      await stopServer(server);
    }
  });

  it("characterizes authentication and authorization failures for settlement", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const run = await createLockedRunWithDecision(
        baseUrl,
        teacherToken,
        studentToken,
        BALANCED_DECISION_PAYLOAD
      );

      const unauthenticated = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST"
        }
      );
      expect(unauthenticated.status).toBe(401);
      expect(unauthenticated.body.code).toBe("AUTH-401-001");

      const forbiddenStudent = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          token: studentToken
        }
      );
      expect(forbiddenStudent.status).toBe(403);
      expect(forbiddenStudent.body.code).toBe("AUTHZ-403-001");
    } finally {
      await stopServer(server);
    }
  });
});
