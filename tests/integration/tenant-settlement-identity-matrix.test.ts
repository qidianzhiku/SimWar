import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it, vi } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  DecisionPayload,
  Round,
  Run,
  SettlementResult
} from "../../packages/shared-contracts/src";
import { createJsonRepositoryProvider } from "../../services/api/src/repository-provider";
import { createApiServer } from "../../services/api/src/server";
import { createP0Store, type SimWarStore } from "../../services/api/src/store";

const LOW_DEMAND_DECISION_PAYLOAD = {
  pricing: { base_price: 30000 },
  marketing_budget: 0,
  service_quality_budget: 10000,
  capacity_plan: "contract",
  cash_buffer_target: 0.5,
  strategy_statement: "High price and low demand strategy for identity characterization."
} as const satisfies DecisionPayload;

const HIGH_DEMAND_DECISION_PAYLOAD = {
  pricing: { base_price: 8000 },
  marketing_budget: 600000,
  service_quality_budget: 500000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "Low price and high demand strategy for identity characterization."
} as const satisfies DecisionPayload;

async function startServer(): Promise<{
  baseUrl: string;
  provider: ReturnType<typeof createJsonRepositoryProvider>;
  server: Server;
  store: SimWarStore;
}> {
  const store = createP0Store();
  const provider = createJsonRepositoryProvider({ store });
  const server = createApiServer(store, { repositoryProvider: provider });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    provider,
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
    body?: unknown;
    method?: string;
    tenantId?: string;
    token?: string;
  } = {}
): Promise<{ body: ApiEnvelope<TData>; headers: Headers; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": options.tenantId ?? "tenant_demo"
  });

  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    method: options.method ?? "GET"
  });

  return {
    body: (await response.json()) as ApiEnvelope<TData>,
    headers: response.headers,
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

async function createRun(baseUrl: string, teacherToken: string): Promise<Run> {
  const response = await request<{ round: Round; run: Run }>(
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
    body: {
      decision_payload: payload,
      team_id: "team_alpha"
    },
    method: "POST",
    token: studentToken
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

async function createLockedRunWithDecision(
  baseUrl: string,
  teacherToken: string,
  studentToken: string,
  payload: DecisionPayload
): Promise<{ decision: Decision; round: Round; run: Run }> {
  const run = await createRun(baseUrl, teacherToken);
  await startRound(baseUrl, teacherToken, run.run_id);
  const decision = await submitDecision(baseUrl, studentToken, run.run_id, payload);
  const round = await lockRound(baseUrl, teacherToken, run.run_id);

  return { decision, round, run };
}

async function settleRoundViaApi(
  baseUrl: string,
  teacherToken: string,
  runId: string
): Promise<{ body: ApiEnvelope<SettlementResult>; headers: Headers; status: number }> {
  return request<SettlementResult>(baseUrl, `/api/v1/runs/${runId}/rounds/1/settle`, {
    method: "POST",
    token: teacherToken
  });
}

function appendDecisionDecoys(store: SimWarStore, decision: Decision, round: Round): void {
  const decoys: Decision[] = [
    {
      ...decision,
      decision_id: `${decision.decision_id}_other_tenant`,
      payload: HIGH_DEMAND_DECISION_PAYLOAD,
      tenant_id: "tenant_other",
      version: decision.version + 10
    },
    {
      ...decision,
      decision_id: `${decision.decision_id}_other_run`,
      payload: HIGH_DEMAND_DECISION_PAYLOAD,
      run_id: "run_identity_decoy",
      version: decision.version + 11
    },
    {
      ...decision,
      decision_id: `${decision.decision_id}_other_round`,
      payload: HIGH_DEMAND_DECISION_PAYLOAD,
      round_id: `${round.round_id}_decoy`,
      version: decision.version + 12
    }
  ];

  store.decisions.push(...decoys);
}

function prependOtherTenantSettlementCollision(
  store: SimWarStore,
  run: Run,
  round: Round,
  settlement: SettlementResult
): SettlementResult {
  const otherTenantRound: Round = {
    ...round,
    round_id: `${round.round_id}_tenant_other`,
    tenant_id: "tenant_other"
  };
  const otherTenantSettlement: SettlementResult = {
    ...settlement,
    replay_hash: `${settlement.replay_hash}_tenant_other`,
    round_id: otherTenantRound.round_id,
    settlement_result_id: `${settlement.settlement_result_id}_tenant_other`,
    tenant_id: "tenant_other"
  };

  store.runs.push({ ...run, tenant_id: "tenant_other" });
  store.rounds.push(otherTenantRound);
  store.settlementResults.unshift(otherTenantSettlement);

  return otherTenantSettlement;
}

describe("tenant settlement identity matrix", () => {
  it("threads tenant, run, and round identity through active Facade settlement reads", async () => {
    const { baseUrl, provider, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const { round, run } = await createLockedRunWithDecision(
        baseUrl,
        teacherToken,
        studentToken,
        LOW_DEMAND_DECISION_PAYLOAD
      );
      const getRunSpy = vi.spyOn(provider.facade.runs, "getRun");
      const listRoundsSpy = vi.spyOn(provider.facade.rounds, "listRoundsForRun");
      const listTeamsSpy = vi.spyOn(provider.facade.teams, "listTeamsForRun");
      const listDecisionsSpy = vi.spyOn(provider.facade.decisions, "listDecisionsForRound");
      const commitSpy = vi.spyOn(provider.facade, "commitSettlementOutcome");

      const first = await settleRoundViaApi(baseUrl, teacherToken, run.run_id);
      const second = await settleRoundViaApi(baseUrl, teacherToken, run.run_id);
      const conflictDecision = store.decisions.find(
        (decision) =>
          decision.tenant_id === "tenant_demo" &&
          decision.run_id === run.run_id &&
          decision.round_id === round.round_id &&
          decision.team_id === "team_alpha"
      );

      if (!conflictDecision) {
        throw new Error("missing committed decision for conflict characterization");
      }

      store.decisions.push({
        ...conflictDecision,
        decision_id: `${conflictDecision.decision_id}_conflict`,
        payload: HIGH_DEMAND_DECISION_PAYLOAD,
        version: conflictDecision.version + 1
      });
      const conflict = await settleRoundViaApi(baseUrl, teacherToken, run.run_id);
      const successAudits = store.auditLogs.filter(
        (log) =>
          log.action === "round.settle_requested" && log.resource_type === "settlement_result"
      );

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(conflict.status).toBe(409);
      expect(conflict.body.code).toBe("SETTLE-409-002");
      expect(first.headers.get("x-simwar-settlement-outcome")).toBe("committed");
      expect(second.headers.get("x-simwar-settlement-outcome")).toBe("reused");
      expect(first.body.data).toMatchObject({
        round_id: round.round_id,
        round_no: round.round_no,
        run_id: run.run_id,
        tenant_id: "tenant_demo"
      });
      expect(second.body.data).toEqual(first.body.data);
      expect(getRunSpy).toHaveBeenCalledWith("tenant_demo", run.run_id);
      expect(listRoundsSpy).toHaveBeenCalledWith("tenant_demo", run.run_id);
      expect(listTeamsSpy).toHaveBeenCalledWith("tenant_demo", run.run_id);
      expect(listDecisionsSpy).toHaveBeenCalledWith("tenant_demo", run.run_id, round.round_id);
      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(commitSpy).toHaveBeenCalledWith({
        round_id: round.round_id,
        settlement_result: expect.objectContaining({
          round_id: round.round_id,
          round_no: round.round_no,
          run_id: run.run_id,
          tenant_id: "tenant_demo"
        }),
        tenant_id: "tenant_demo"
      });
      expect(store.settlementResults).toHaveLength(1);
      expect(
        store.settlementResults.map(
          (settlement) => `${settlement.tenant_id}:${settlement.run_id}:${settlement.round_no}`
        )
      ).toEqual([`tenant_demo:${run.run_id}:1`]);
      expect(successAudits).toHaveLength(1);
      expect(successAudits[0]?.resource_id).toBe(first.body.data.settlement_result_id);
    } finally {
      await stopServer(server);
    }
  });

  it("reuses the current tenant canonical outcome when another tenant collides on run and round", async () => {
    const { baseUrl, provider, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const { round, run } = await createLockedRunWithDecision(
        baseUrl,
        teacherToken,
        studentToken,
        LOW_DEMAND_DECISION_PAYLOAD
      );
      const commitSpy = vi.spyOn(provider.facade, "commitSettlementOutcome");
      const first = await settleRoundViaApi(baseUrl, teacherToken, run.run_id);

      expect(first.status).toBe(200);

      const otherTenantSettlement = prependOtherTenantSettlementCollision(
        store,
        run,
        round,
        first.body.data
      );
      const auditCountBeforeRetry = store.auditLogs.filter(
        (log) =>
          log.action === "round.settle_requested" && log.resource_type === "settlement_result"
      ).length;
      const second = await settleRoundViaApi(baseUrl, teacherToken, run.run_id);

      expect(second.status).toBe(200);
      expect(second.headers.get("x-simwar-settlement-outcome")).toBe("reused");
      expect(second.body.data).toEqual(first.body.data);
      expect(second.body.data.tenant_id).toBe("tenant_demo");
      expect(second.body.data.settlement_result_id).not.toBe(
        otherTenantSettlement.settlement_result_id
      );
      expect(second.body.data.round_id).not.toBe(otherTenantSettlement.round_id);
      expect(second.body.data.replay_hash).not.toBe(otherTenantSettlement.replay_hash);
      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(store.settlementResults).toHaveLength(2);
      expect(
        store.auditLogs.filter(
          (log) => log.action === "round.settle_requested" && log.resource_type === "settlement_result"
        )
      ).toHaveLength(auditCountBeforeRetry);
    } finally {
      await stopServer(server);
    }
  });

  it("keeps tenant, run, and round decoy decisions out of settlement input", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const lowControl = await createLockedRunWithDecision(
        baseUrl,
        teacherToken,
        studentToken,
        LOW_DEMAND_DECISION_PAYLOAD
      );
      const lowControlSettlement = await settleRoundViaApi(
        baseUrl,
        teacherToken,
        lowControl.run.run_id
      );
      const highControl = await createLockedRunWithDecision(
        baseUrl,
        teacherToken,
        studentToken,
        HIGH_DEMAND_DECISION_PAYLOAD
      );
      const highControlSettlement = await settleRoundViaApi(
        baseUrl,
        teacherToken,
        highControl.run.run_id
      );
      const target = await createLockedRunWithDecision(
        baseUrl,
        teacherToken,
        studentToken,
        LOW_DEMAND_DECISION_PAYLOAD
      );

      appendDecisionDecoys(store, target.decision, target.round);
      const targetSettlement = await settleRoundViaApi(baseUrl, teacherToken, target.run.run_id);
      const targetSettlements = store.settlementResults.filter(
        (settlement) => settlement.run_id === target.run.run_id
      );

      expect(lowControlSettlement.status).toBe(200);
      expect(highControlSettlement.status).toBe(200);
      expect(targetSettlement.status).toBe(200);
      expect(targetSettlement.body.data).toMatchObject({
        round_id: target.round.round_id,
        round_no: target.round.round_no,
        run_id: target.run.run_id,
        tenant_id: "tenant_demo"
      });
      expect(targetSettlement.body.data.team_results).toEqual(
        lowControlSettlement.body.data.team_results
      );
      expect(targetSettlement.body.data.team_results).not.toEqual(
        highControlSettlement.body.data.team_results
      );
      expect(targetSettlements).toHaveLength(1);
      expect(targetSettlements[0]?.team_results).toEqual(targetSettlement.body.data.team_results);
    } finally {
      await stopServer(server);
    }
  });

  it("rejects a cross-tenant settlement request before committing an outcome", async () => {
    const { baseUrl, provider, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const { run } = await createLockedRunWithDecision(
        baseUrl,
        teacherToken,
        studentToken,
        LOW_DEMAND_DECISION_PAYLOAD
      );
      const commitSpy = vi.spyOn(provider.facade, "commitSettlementOutcome");

      const crossTenant = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          tenantId: "tenant_other",
          token: teacherToken
        }
      );

      expect(crossTenant.status).toBe(403);
      expect(crossTenant.body.code).toBe("TENANT-403-001");
      expect(commitSpy).not.toHaveBeenCalled();
      expect(store.settlementResults).toHaveLength(0);
      expect(
        store.auditLogs.some(
          (log) => log.action === "round.settle_requested" && log.resource_type === "settlement_result"
        )
      ).toBe(false);
    } finally {
      await stopServer(server);
    }
  });
});
