import { readFileSync } from "node:fs";
import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  ApiErrorEnvelope,
  AuthSession,
  Decision,
  DecisionPayload,
  PublicResultView,
  PublicRunReplayEvidence,
  Round,
  Run,
  SettlementResult,
  Team,
  User
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import {
  createM1RunReplayEvidence,
  selectM1RunReplayEvidenceGolden
} from "../../services/api/src/run-manifest-replay-evidence";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const VALID_DECISION_PAYLOAD = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "Shared Golden M1 synthetic scenario decision."
} as const satisfies DecisionPayload;

type ScenarioFixture = {
  scenario_id: "l1-shared-golden-m1-scenario";
  metadata: {
    g0_status: "EXCEPTION";
    g0_pass: "NOT_GRANTED";
    l1_status: "NOT_READY";
  };
  forbidden_student_fields: string[];
};

type M1ReplayEvidencePublicResult = PublicResultView & {
  replay_evidence?: PublicRunReplayEvidence;
};

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
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
    body?: unknown;
    method?: string;
    servicePrincipal?: string;
    tenantId?: string;
    token?: string;
  } = {}
): Promise<{ body: ApiEnvelope<TData>; status: number }> {
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
    body: options.body ? JSON.stringify(options.body) : undefined,
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

function loadScenarioFixture(): ScenarioFixture {
  return JSON.parse(
    readFileSync("contracts/fixtures/l1-shared-golden-m1-scenario.valid.json", "utf8")
  ) as ScenarioFixture;
}

function assertDoesNotContainAny(serialized: string, forbiddenFields: string[]): void {
  for (const forbidden of forbiddenFields) {
    expect(serialized).not.toContain(forbidden);
  }
}

async function createBetaStudentAndTeam(
  baseUrl: string,
  adminToken: string,
  teacherToken: string
): Promise<{ betaStudentToken: string; betaTeam: Team; betaUser: User }> {
  const betaUserResponse = await request<User>(baseUrl, "/api/v1/admin/users", {
    body: {
      username: "student_beta_golden",
      email: "student-beta-golden@demo.simwar.local",
      display_name: "Shared Golden Beta Student",
      password: "student_beta_golden",
      roles: ["learner"]
    },
    method: "POST",
    token: adminToken
  });
  expect(betaUserResponse.status).toBe(201);

  const betaTeamResponse = await request<Team>(baseUrl, "/api/v1/courses/course_demo/teams", {
    body: {
      name: "Beta Shared Golden Team",
      captain_user_id: betaUserResponse.body.data.user_id
    },
    method: "POST",
    token: teacherToken
  });
  expect(betaTeamResponse.status).toBe(201);

  const betaStudentToken = await login(baseUrl, "student_beta_golden", "student_beta_golden");

  return {
    betaStudentToken,
    betaTeam: betaTeamResponse.body.data,
    betaUser: betaUserResponse.body.data
  };
}

async function createRunAndOpenRound(baseUrl: string, teacherToken: string): Promise<Run> {
  const runResponse = await request<{ round: Round; run: Run }>(
    baseUrl,
    "/api/v1/courses/course_demo/runs",
    {
      method: "POST",
      token: teacherToken
    }
  );
  expect(runResponse.status).toBe(201);

  const run = runResponse.body.data.run;
  const startResponse = await request<Round>(baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/start`, {
    method: "POST",
    token: teacherToken
  });
  expect(startResponse.status).toBe(200);
  expect(startResponse.body.data.status).toBe("open");

  return run;
}

async function submitDecision(
  baseUrl: string,
  token: string,
  runId: string,
  teamId: string,
  strategyStatement: string
): Promise<Decision> {
  const response = await request<Decision>(baseUrl, `/api/v1/runs/${runId}/rounds/1/decisions`, {
    body: {
      decision_payload: {
        ...VALID_DECISION_PAYLOAD,
        strategy_statement: strategyStatement
      },
      team_id: teamId
    },
    method: "POST",
    token
  });
  expect(response.status).toBe(201);
  return response.body.data;
}

function buildReplayEvidenceFromStore(store: SimWarStore, run: Run, settlement: SettlementResult) {
  const round = store.rounds.find(
    (candidate) => candidate.run_id === run.run_id && candidate.round_no === settlement.round_no
  );
  const scenario = store.scenarios.find(
    (candidate) => candidate.scenario_package_id === run.scenario_package_id
  );
  const parameterSet = store.parameterSets.find(
    (candidate) => candidate.parameter_set_id === run.parameter_set_id
  );

  if (!round || !scenario || !parameterSet) {
    throw new Error("missing replay input setup");
  }

  return createM1RunReplayEvidence({
    decisions: store.decisions.filter(
      (decision) => decision.run_id === run.run_id && decision.round_id === round.round_id
    ),
    parameterSet,
    round,
    run,
    scenario,
    settlement,
    teams: store.teams.filter((team) => team.course_id === run.course_id)
  });
}

describe("L1 Shared Golden M1 formal integration guard", () => {
  it("runs the integrated M1 scenario without widening truth, replay, or role visibility", async () => {
    const fixture = loadScenarioFixture();
    const { baseUrl, server, store } = await startServer();
    const protectedFailureSentinel = "shared-golden-protected-truth-sentinel";

    try {
      expect(fixture.metadata.g0_status).toBe("EXCEPTION");
      expect(fixture.metadata.g0_pass).toBe("NOT_GRANTED");
      expect(fixture.metadata.l1_status).toBe("NOT_READY");

      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const adminToken = await login(baseUrl, "admin", "admin");
      const { betaStudentToken, betaTeam, betaUser } = await createBetaStudentAndTeam(
        baseUrl,
        adminToken,
        teacherToken
      );
      const run = await createRunAndOpenRound(baseUrl, teacherToken);

      const protectedFailure = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: {
              ...VALID_DECISION_PAYLOAD,
              state_true: {
                score: protectedFailureSentinel
              },
              strategy_statement: "Controlled failure must not echo protected values."
            },
            team_id: "team_alpha"
          },
          method: "POST",
          token: studentToken
        }
      );
      expect(protectedFailure.status).toBe(403);
      expect(protectedFailure.body.code).toBe("TRUTH-403-001");
      expect(JSON.stringify(protectedFailure.body)).not.toContain(protectedFailureSentinel);

      const alphaDecision = await submitDecision(
        baseUrl,
        studentToken,
        run.run_id,
        "team_alpha",
        "Alpha team preserves premium positioning."
      );
      const betaDecision = await submitDecision(
        baseUrl,
        betaStudentToken,
        run.run_id,
        betaTeam.team_id,
        "Beta team competes through service reliability."
      );

      const crossTeamAttempt = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: VALID_DECISION_PAYLOAD,
            team_id: betaTeam.team_id
          },
          method: "POST",
          token: studentToken
        }
      );
      expect(crossTeamAttempt.status).toBe(403);
      expect(crossTeamAttempt.body.code).toBe("TEAM-403-001");
      expect(JSON.stringify(crossTeamAttempt.body)).not.toContain(betaDecision.decision_id);

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

      const settlementResponse = await request<SettlementResult>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(settlementResponse.status).toBe(200);
      expect(
        settlementResponse.body.data.team_results.map((result) => result.team_id).sort()
      ).toEqual(["team_alpha", betaTeam.team_id].sort());

      const publishResponse = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(publishResponse.status).toBe(200);
      expect(publishResponse.body.data.status).toBe("published");

      const resultSnapshot = structuredClone(store.settlementResults);
      const roundSnapshot = structuredClone(store.rounds);
      const replayEvidence = buildReplayEvidenceFromStore(store, run, settlementResponse.body.data);
      expect(replayEvidence.replay_status).toBe("matched");
      expect(replayEvidence.replay_result_hash).toBe(settlementResponse.body.data.replay_hash);
      expect(replayEvidence.replay_writes_formal_results).toBe(false);
      expect(store.settlementResults).toEqual(resultSnapshot);
      expect(store.rounds).toEqual(roundSnapshot);
      expect(selectM1RunReplayEvidenceGolden(replayEvidence).replay.replay_status).toBe("matched");

      const studentResult = await request<M1ReplayEvidencePublicResult>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        {
          token: studentToken
        }
      );
      expect(studentResult.status).toBe(200);
      expect(studentResult.body.data.results).toHaveLength(1);
      expect(studentResult.body.data.results[0]?.team_id).toBe("team_alpha");
      expect(studentResult.body.data.results[0]?.state_true).toBeUndefined();
      expect(studentResult.body.data.replay_evidence).toBeUndefined();
      assertDoesNotContainAny(
        JSON.stringify(studentResult.body.data),
        fixture.forbidden_student_fields
      );
      expect(JSON.stringify(studentResult.body.data)).not.toContain(betaTeam.team_id);
      expect(JSON.stringify(studentResult.body.data)).not.toContain(betaUser.user_id);

      const teacherResult = await request<M1ReplayEvidencePublicResult>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        {
          token: teacherToken
        }
      );
      expect(teacherResult.status).toBe(200);
      expect(teacherResult.body.data.results).toHaveLength(2);
      expect(teacherResult.body.data.results.every((result) => result.state_true)).toBe(true);
      expect(teacherResult.body.data.replay_evidence).toMatchObject({
        evidence_kind: "m1_json_runtime_replay_evidence",
        replay_result_hash: settlementResponse.body.data.replay_hash,
        replay_status: "matched",
        replay_writes_formal_results: false
      });

      const tenantAdminResult = await request<M1ReplayEvidencePublicResult>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        {
          token: adminToken
        }
      );
      expect(tenantAdminResult.status).toBe(200);
      expect(tenantAdminResult.body.data.results).toHaveLength(2);
      expect(tenantAdminResult.body.data.replay_evidence?.replay_writes_formal_results).toBe(false);
      expect(JSON.stringify(tenantAdminResult.body.data)).not.toContain("tenant_other");

      const studentDemoState = await request<unknown>(baseUrl, "/api/v1/demo-state", {
        token: studentToken
      });
      expect(studentDemoState.status).toBe(200);
      expect(JSON.stringify(studentDemoState.body.data)).not.toContain(betaTeam.team_id);
      expect(JSON.stringify(studentDemoState.body.data)).not.toContain(betaUser.user_id);

      const tenantAdminState = await request<{ tenants?: Array<{ tenant_id: string }> }>(
        baseUrl,
        "/api/v1/demo-state",
        {
          token: adminToken
        }
      );
      expect(tenantAdminState.status).toBe(200);
      expect(tenantAdminState.body.data.tenants?.map((tenant) => tenant.tenant_id)).toEqual([
        "tenant_demo"
      ]);
      expect(JSON.stringify(tenantAdminState.body.data)).not.toContain("tenant_other");
      expect(JSON.stringify(tenantAdminState.body.data)).not.toContain("usr_other_teacher");

      const crossTenantRead = await request<unknown>(baseUrl, "/api/v1/courses", {
        tenantId: "tenant_other",
        token: teacherToken
      });
      expect(crossTenantRead.status).toBe(403);
      expect(crossTenantRead.body.code).toBe("TENANT-403-001");

      expect(alphaDecision.team_id).toBe("team_alpha");
      expect(betaDecision.team_id).toBe(betaTeam.team_id);
      expect(store.auditLogs.some((log) => log.action === "round.publish")).toBe(true);
    } finally {
      await stopServer(server);
    }
  });
});
