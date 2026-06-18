import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it, vi } from "vitest";
import type {
  ApiEnvelope,
  AuditLog,
  AuthSession,
  Decision,
  DecisionPayload,
  ReplayDiffReport,
  ReplayInputManifest,
  ReplayReport,
  ReplayRun,
  Round,
  Run,
  SettlementResult
} from "../../packages/shared-contracts/src";
import { createJsonRepositoryPorts } from "../../services/api/src/json-repository-adapter";
import {
  createJsonRepositoryProvider,
  type RepositoryProvider
} from "../../services/api/src/repository-provider";
import type { CommitSettlementOutcomeCommand } from "../../services/api/src/repository-ports";
import { createApiServer } from "../../services/api/src/server";
import {
  settleRoundWithSettlementWriter,
  type SettlementResultWriter,
  type SettlementRoundInput
} from "../../services/api/src/simulation";
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

async function startServer(): Promise<{
  baseUrl: string;
  provider: RepositoryProvider;
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

function cloneJson<TValue>(value: TValue): TValue {
  return JSON.parse(JSON.stringify(value)) as TValue;
}

function requireStoredRound(store: SimWarStore, runId: string): Round {
  const round = store.rounds.find(
    (candidate) => candidate.run_id === runId && candidate.round_no === 1
  );

  if (!round) {
    throw new Error(`missing round for run ${runId}`);
  }

  return round;
}

function createSettlementInput(store: SimWarStore, run: Run): SettlementRoundInput {
  const round = requireStoredRound(store, run.run_id);
  const scenario = store.scenarios.find(
    (candidate) =>
      candidate.tenant_id === run.tenant_id &&
      candidate.scenario_package_id === run.scenario_package_id
  );
  const parameterSet = store.parameterSets.find(
    (candidate) =>
      candidate.tenant_id === run.tenant_id && candidate.parameter_set_id === run.parameter_set_id
  );
  const teams = store.teams.filter(
    (team) => team.tenant_id === run.tenant_id && team.course_id === run.course_id
  );
  const decisions = teams.map((team) => {
    const versions = store.decisions.filter(
      (decision) =>
        decision.tenant_id === run.tenant_id &&
        decision.run_id === run.run_id &&
        decision.round_no === round.round_no &&
        decision.team_id === team.team_id
    );
    const latest = versions.at(-1);

    if (!latest) {
      throw new Error(`missing decision for team ${team.team_id}`);
    }

    return latest;
  });

  if (!scenario || !parameterSet) {
    throw new Error(`missing settlement fixtures for run ${run.run_id}`);
  }

  return {
    decisions,
    parameterSet,
    round,
    run,
    scenario,
    teams
  };
}

function appendNonTruthAuditLog(store: SimWarStore, runId: string): AuditLog {
  const log: AuditLog = {
    action: "analytics.only",
    actor_id: "usr_teacher",
    actor_role: "teacher",
    audit_id: `audit_non_truth_${runId}`,
    created_at: "2026-06-10T00:00:00.000Z",
    request_id: "req_non_truth",
    resource_id: runId,
    resource_type: "analytics",
    tenant_id: "tenant_demo",
    after: {
      ai_advice: "excluded advisory context",
      analytics: { viewed: true },
      learning_evidence: "excluded learning context",
      role_draft: "excluded draft context"
    }
  };

  store.auditLogs.push(log);
  return log;
}

function createReplayInputManifestForRun(
  run: Run,
  round: Round,
  sourceResultId: string
): ReplayInputManifest {
  return {
    created_at: "2026-06-10T00:00:01.000Z",
    excluded_from_truth_hash: {
      ai_advice: "excluded",
      analytics: "excluded",
      learning_evidence: "excluded",
      role_drafts: "excluded"
    },
    included_sources: ["canonical_decisions", "scenario", "parameter_set"],
    input_hash: "input-hash-replay-repository-isolation",
    manifest_hash: "manifest-hash-replay-repository-isolation",
    manifest_id: `manifest_${run.run_id}`,
    round_id: round.round_id,
    run_id: run.run_id,
    source_result_id: sourceResultId,
    tenant_id: run.tenant_id
  };
}

function createReplayRunForManifest(manifest: ReplayInputManifest): ReplayRun {
  return {
    completed_at: "2026-06-10T00:00:03.000Z",
    manifest_id: manifest.manifest_id,
    replay_mode: "official_replay",
    replay_run_id: `replay_run_${manifest.run_id}`,
    round_id: manifest.round_id,
    run_id: manifest.run_id,
    started_at: "2026-06-10T00:00:02.000Z",
    status: "completed",
    tenant_id: manifest.tenant_id
  };
}

function createReplayReportForRun(run: ReplayRun, settlement: SettlementResult): ReplayReport {
  return {
    created_at: "2026-06-10T00:00:04.000Z",
    matched: true,
    replay_report_id: `replay_report_${settlement.run_id}`,
    replay_result_hash: settlement.replay_hash,
    replay_run_id: run.replay_run_id,
    round_id: settlement.round_id,
    run_id: settlement.run_id,
    source_result_id: settlement.settlement_result_id,
    status: "matched",
    tenant_id: settlement.tenant_id
  };
}

function createReplayDiffReportForReport(report: ReplayReport): ReplayDiffReport {
  return {
    created_at: "2026-06-10T00:00:05.000Z",
    diff_report_id: `diff_report_${report.run_id}`,
    differences: [],
    replay_report_id: report.replay_report_id,
    round_id: report.round_id,
    run_id: report.run_id,
    severity: "none",
    tenant_id: report.tenant_id
  };
}

describe("settlement result write and replay hash characterization", () => {
  it("settlement writer failure leaves the calculated Round mutation observable", async () => {
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
      const input = createSettlementInput(store, run);
      const round = input.round;
      const roundIdentityBefore = cloneJson({
        decision_batch_id: round.decision_batch_id,
        round_id: round.round_id,
        round_no: round.round_no,
        run_id: round.run_id,
        tenant_id: round.tenant_id
      });
      const persistenceError = new Error("forced settlement persistence failure");
      const attemptedResults: SettlementResult[] = [];
      const writer: SettlementResultWriter = {
        saveSettlementResult: vi.fn(async (result) => {
          attemptedResults.push(result);
          throw persistenceError;
        })
      };

      await expect(settleRoundWithSettlementWriter(store, input, writer)).rejects.toThrow(
        "forced settlement persistence failure"
      );

      expect(writer.saveSettlementResult).toHaveBeenCalledTimes(1);
      expect(attemptedResults).toHaveLength(1);
      const attemptedSettlement = attemptedResults[0]!;
      expect(round.status).toBe("settled");
      expect(round.replay_hash).toBe(attemptedSettlement.replay_hash);
      expect(round).toMatchObject(roundIdentityBefore);
      expect(store.settlementResults).toHaveLength(0);
      expect(store.settlementResults).not.toContainEqual(attemptedSettlement);
      expect(
        store.auditLogs.some(
          (log) =>
            log.action === "round.settle_requested" &&
            log.resource_id === attemptedSettlement.settlement_result_id
        )
      ).toBe(false);
    } finally {
      await stopServer(server);
    }
  });

  it("settlement retries invoke the writer again after persistence failure", async () => {
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
      const input = createSettlementInput(store, run);
      const round = input.round;
      const persistenceError = new Error("forced settlement persistence failure");
      const attemptedResults: SettlementResult[] = [];
      const writer: SettlementResultWriter = {
        saveSettlementResult: vi.fn(async (result) => {
          attemptedResults.push(result);

          if (attemptedResults.length === 1) {
            throw persistenceError;
          }

          store.settlementResults.push(result);
        })
      };

      await expect(settleRoundWithSettlementWriter(store, input, writer)).rejects.toThrow(
        "forced settlement persistence failure"
      );

      expect(writer.saveSettlementResult).toHaveBeenCalledTimes(1);
      expect(store.settlementResults).toHaveLength(0);
      expect(round.status).toBe("settled");
      expect(round.replay_hash).toBe(attemptedResults[0]?.replay_hash);

      const retryResult = await settleRoundWithSettlementWriter(store, input, writer);

      expect(writer.saveSettlementResult).toHaveBeenCalledTimes(2);
      expect(attemptedResults).toHaveLength(2);
      expect(attemptedResults[0]?.replay_hash).toBe(attemptedResults[1]?.replay_hash);
      expect(retryResult).toBe(attemptedResults[1]);
      expect(store.settlementResults).toEqual([attemptedResults[1]]);
      expect(round.status).toBe("settled");
      expect(round.replay_hash).toBe(retryResult.replay_hash);

      const postSuccessRetry = await settleRoundWithSettlementWriter(store, input, writer);

      expect(postSuccessRetry).toBe(store.settlementResults[0]);
      expect(writer.saveSettlementResult).toHaveBeenCalledTimes(2);
      expect(store.settlementResults).toHaveLength(1);
      expect(round.replay_hash).toBe(retryResult.replay_hash);
    } finally {
      await stopServer(server);
    }
  });

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

  it("settlement route commits through the atomic facade and no longer calls the ordinary writer", async () => {
    const { baseUrl, provider, server, store } = await startServer();

    try {
      const events: string[] = [];
      const originalCommit = provider.facade.commitSettlementOutcome.bind(provider.facade);
      const commitSpy = vi.spyOn(provider.facade, "commitSettlementOutcome");
      commitSpy.mockImplementation(async (command) => {
        const originalCommand = cloneJson(command);

        events.push("commit:start");
        await originalCommit(command);
        events.push("commit:done");

        expect(command).toEqual(originalCommand);
      });
      const legacySaveSpy = vi.spyOn(provider.facade.settlements, "saveSettlementResult");
      const originalAppendAudit = provider.facade.auditLogs.appendAuditLog.bind(
        provider.facade.auditLogs
      );
      vi.spyOn(provider.facade.auditLogs, "appendAuditLog").mockImplementation(async (auditLog) => {
        if (auditLog.action === "round.settle_requested") {
          events.push("audit:success");
        }

        await originalAppendAudit(auditLog);
      });

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
      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(legacySaveSpy).not.toHaveBeenCalled();

      const command = commitSpy.mock.calls[0]?.[0] as CommitSettlementOutcomeCommand | undefined;
      expect(command).toBeDefined();
      expect(command).toMatchObject({
        tenant_id: "tenant_demo",
        round_id: response.body.data.round_id,
        settlement_result: response.body.data
      });
      expect(command?.settlement_result.replay_hash).toBe(response.body.data.replay_hash);
      expect(store.settlementResults).toEqual([response.body.data]);
      expect(events).toEqual(["commit:start", "commit:done", "audit:success"]);
    } finally {
      await stopServer(server);
    }
  });

  it("settlement route leaves authoritative state unchanged when atomic commit fails", async () => {
    const { baseUrl, provider, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const run = await createLockedRunWithDecision(
        baseUrl,
        teacherToken,
        studentToken,
        BALANCED_DECISION_PAYLOAD
      );
      const roundBefore = cloneJson(requireStoredRound(store, run.run_id));
      const settlementResultsBefore = cloneJson(store.settlementResults);
      const attemptedCommands: CommitSettlementOutcomeCommand[] = [];
      const persistenceError = new Error("forced atomic persistence failure");
      const commitSpy = vi.spyOn(provider.facade, "commitSettlementOutcome");
      commitSpy.mockImplementation(async (command) => {
        attemptedCommands.push(cloneJson(command));
        throw persistenceError;
      });
      const legacySaveSpy = vi.spyOn(provider.facade.settlements, "saveSettlementResult");

      const response = await settleRoundViaApi(baseUrl, teacherToken, run.run_id);

      expect(response.status).toBe(500);
      expect(response.body.code).toBe("API-500-001");
      expect(JSON.stringify(response.body)).not.toContain("forced atomic persistence failure");
      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(legacySaveSpy).not.toHaveBeenCalled();
      expect(requireStoredRound(store, run.run_id)).toEqual(roundBefore);
      expect(store.settlementResults).toEqual(settlementResultsBefore);
      expect(
        store.auditLogs.some(
          (log) =>
            log.action === "round.settle_requested" &&
            log.resource_id === attemptedCommands[0]?.settlement_result.settlement_result_id
        )
      ).toBe(false);
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
      const firstStoredRound = requireStoredRound(store, run.run_id);
      const firstSnapshot = cloneJson({
        result: first.body.data,
        resultCount: store.settlementResults.length,
        roundReplayHash: firstStoredRound.replay_hash,
        roundStatus: firstStoredRound.status,
        storedResult: store.settlementResults[0],
        teamResults: first.body.data.team_results
      });
      const second = await settleRoundViaApi(baseUrl, teacherToken, run.run_id);
      const secondStoredRound = requireStoredRound(store, run.run_id);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.data).toEqual(first.body.data);
      expect(second.body.data.settlement_result_id).toBe(first.body.data.settlement_result_id);
      expect(second.body.data.replay_hash).toBe(first.body.data.replay_hash);
      expect(second.body.data.team_results).toEqual(first.body.data.team_results);
      expect(store.settlementResults).toHaveLength(firstSnapshot.resultCount);
      expect(store.settlementResults[0]).toEqual(firstSnapshot.storedResult);
      expect(secondStoredRound.status).toBe(firstSnapshot.roundStatus);
      expect(secondStoredRound.replay_hash).toBe(firstSnapshot.roundReplayHash);
      expect(secondStoredRound.replay_hash).toBe(first.body.data.replay_hash);
      expect(secondStoredRound.replay_hash).toBe(store.settlementResults[0]?.replay_hash);
      expect(firstSnapshot.result.replay_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(firstSnapshot.teamResults).toEqual(second.body.data.team_results);

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

  it("keeps non-truth audit data out of repeated settlement replay hashes", async () => {
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
      const firstRound = requireStoredRound(store, run.run_id);
      const firstResultSnapshot = cloneJson(first.body.data);
      const firstStoredResultSnapshot = cloneJson(store.settlementResults[0]);
      const firstRoundSnapshot = cloneJson({
        replay_hash: firstRound.replay_hash,
        status: firstRound.status
      });
      const nonTruthAudit = appendNonTruthAuditLog(store, run.run_id);

      const second = await settleRoundViaApi(baseUrl, teacherToken, run.run_id);
      const secondRound = requireStoredRound(store, run.run_id);

      expect(nonTruthAudit.after).toMatchObject({
        ai_advice: "excluded advisory context",
        learning_evidence: "excluded learning context",
        role_draft: "excluded draft context"
      });
      expect(second.status).toBe(200);
      expect(second.body.data).toEqual(firstResultSnapshot);
      expect(store.settlementResults).toHaveLength(1);
      expect(store.settlementResults[0]).toEqual(firstStoredResultSnapshot);
      expect(secondRound.status).toBe(firstRoundSnapshot.status);
      expect(secondRound.replay_hash).toBe(firstRoundSnapshot.replay_hash);
      expect(secondRound.replay_hash).toBe(second.body.data.replay_hash);
    } finally {
      await stopServer(server);
    }
  });

  it("keeps replay repository saves isolated from settlement truth and idempotency", async () => {
    const { baseUrl, server, store } = await startServer();
    const replayInputManifests: ReplayInputManifest[] = [];
    const replayRuns: ReplayRun[] = [];
    const replayReports: ReplayReport[] = [];
    const replayDiffReports: ReplayDiffReport[] = [];
    const replayPorts = createJsonRepositoryPorts(store, {
      replayDiffReports,
      replayInputManifests,
      replayReports,
      replayRuns
    });

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const run = await createLockedRunWithDecision(
        baseUrl,
        teacherToken,
        studentToken,
        BALANCED_DECISION_PAYLOAD
      );
      const lockedRound = requireStoredRound(store, run.run_id);
      const preSettlementManifest = createReplayInputManifestForRun(
        run,
        lockedRound,
        "pre-settlement-source"
      );

      await replayPorts.replay.saveReplayInputManifest(preSettlementManifest);
      expect(replayInputManifests).toEqual([preSettlementManifest]);
      expect(store.settlementResults).toHaveLength(0);
      expect(lockedRound.replay_hash).toBeUndefined();

      const first = await settleRoundViaApi(baseUrl, teacherToken, run.run_id);
      const settledRound = requireStoredRound(store, run.run_id);
      const firstResultSnapshot = cloneJson(first.body.data);
      const firstStoredResultSnapshot = cloneJson(store.settlementResults[0]);
      const firstRoundSnapshot = cloneJson({
        replay_hash: settledRound.replay_hash,
        status: settledRound.status
      });
      const firstDecisionSnapshot = cloneJson(
        store.decisions.filter((decision) => decision.run_id === run.run_id)
      );
      const replayRun = createReplayRunForManifest(preSettlementManifest);
      const replayReport = createReplayReportForRun(replayRun, first.body.data);
      const replayDiffReport = createReplayDiffReportForReport(replayReport);

      await replayPorts.replay.saveReplayRun(replayRun);
      await replayPorts.replay.saveReplayReport(replayReport);
      await replayPorts.replay.saveReplayDiffReport(replayDiffReport);
      await expect(
        replayPorts.replay.getReplayInputManifest(run.tenant_id, preSettlementManifest.manifest_id)
      ).resolves.toBe(preSettlementManifest);
      await expect(
        replayPorts.replay.getReplayReport(run.tenant_id, replayReport.replay_report_id)
      ).resolves.toBe(replayReport);

      const second = await settleRoundViaApi(baseUrl, teacherToken, run.run_id);
      const secondRound = requireStoredRound(store, run.run_id);

      expect(second.status).toBe(200);
      expect(second.body.data).toEqual(firstResultSnapshot);
      expect(store.settlementResults).toHaveLength(1);
      expect(store.settlementResults[0]).toEqual(firstStoredResultSnapshot);
      expect(secondRound.status).toBe(firstRoundSnapshot.status);
      expect(secondRound.replay_hash).toBe(firstRoundSnapshot.replay_hash);
      expect(secondRound.replay_hash).toBe(first.body.data.replay_hash);
      expect(store.decisions.filter((decision) => decision.run_id === run.run_id)).toEqual(
        firstDecisionSnapshot
      );
      expect(replayInputManifests).toHaveLength(1);
      expect(replayRuns).toEqual([replayRun]);
      expect(replayReports).toEqual([replayReport]);
      expect(replayDiffReports).toEqual([replayDiffReport]);
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
      expect(twoVersionSettlement.body.data.replay_hash).toMatch(/^[a-f0-9]{64}$/);

      const storedSettlement = store.settlementResults.find(
        (settlement) => settlement.run_id === twoVersionRun.run_id
      );
      const storedRound = requireStoredRound(store, twoVersionRun.run_id);
      expect(storedSettlement?.replay_hash).toBe(twoVersionSettlement.body.data.replay_hash);
      expect(storedSettlement?.team_results).toEqual(twoVersionSettlement.body.data.team_results);
      expect(storedRound.replay_hash).toBe(twoVersionSettlement.body.data.replay_hash);
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
      expect(
        store.auditLogs.some(
          (log) => log.action === "round.settle_requested" && log.resource_id.startsWith("result_")
        )
      ).toBe(false);
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
