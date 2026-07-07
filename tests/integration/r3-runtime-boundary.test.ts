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
  Tenant,
  User
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import type { RuntimeSecurityConfig } from "../../services/api/src/runtime-security-config";
import {
  createM1RunReplayEvidence,
  selectM1RunReplayEvidenceGolden
} from "../../services/api/src/run-manifest-replay-evidence";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const TEST_SECURITY_CONFIG: RuntimeSecurityConfig = {
  environment: "test",
  internalServiceToken: "r3-test-internal-service-token",
  jwtSecret: "r3-test-jwt-secret-with-sufficient-length"
};

const PRODUCTION_SECURITY_CONFIG: RuntimeSecurityConfig = {
  environment: "production",
  internalServiceToken: "r3-production-internal-service-token",
  jwtSecret: "r3-production-jwt-secret-with-sufficient-length"
};

const VALID_DECISION_PAYLOAD = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "R3 runtime boundary synthetic decision."
} as const satisfies DecisionPayload;

type M1ReplayEvidencePublicResult = PublicResultView & {
  replay_evidence?: PublicRunReplayEvidence;
};

async function startServer(
  securityConfig: RuntimeSecurityConfig = TEST_SECURITY_CONFIG
): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  const server = createApiServer(store, { securityConfig });
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
    omitTenantHeader?: boolean;
    servicePrincipal?: string;
    tenantId?: string;
    token?: string;
  } = {}
): Promise<{ body: ApiEnvelope<TData>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json"
  });

  if (!options.omitTenantHeader) {
    headers.set("x-tenant-id", options.tenantId ?? "tenant_demo");
  }

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

async function login(
  baseUrl: string,
  username: string,
  password: string,
  tenantId = "tenant_demo",
  omitTenantHeader = false
): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    method: "POST",
    omitTenantHeader,
    tenantId
  });

  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

function expectNoPrivateRuntimeData(value: unknown, forbidden: string[]): void {
  const serialized = JSON.stringify(value);

  for (const item of forbidden) {
    expect(serialized).not.toContain(item);
  }
}

async function createBetaStudentAndTeam(
  baseUrl: string,
  adminToken: string,
  teacherToken: string
): Promise<{ betaStudentToken: string; betaTeam: Team; betaUser: User }> {
  const betaUser = await request<User>(baseUrl, "/api/v1/admin/users", {
    body: {
      username: "student_beta_r3",
      email: "student-beta-r3@demo.simwar.local",
      display_name: "R3 Beta Student",
      password: "student_beta_r3",
      roles: ["learner"]
    },
    method: "POST",
    token: adminToken
  });
  expect(betaUser.status).toBe(201);

  const betaTeam = await request<Team>(baseUrl, "/api/v1/courses/course_demo/teams", {
    body: {
      captain_user_id: betaUser.body.data.user_id,
      name: "R3 Beta Team"
    },
    method: "POST",
    token: teacherToken
  });
  expect(betaTeam.status).toBe(201);

  return {
    betaStudentToken: await login(baseUrl, "student_beta_r3", "student_beta_r3"),
    betaTeam: betaTeam.body.data,
    betaUser: betaUser.body.data
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

describe("R3 runtime boundary guard", () => {
  it("fails closed for shared-runtime secrets and seeded demo account login", async () => {
    expect(() =>
      createApiServer(createP1Store(), {
        env: {
          APP_ENV: "production",
          JWT_SECRET: PRODUCTION_SECURITY_CONFIG.jwtSecret
        }
      })
    ).toThrow("runtime_internal_service_token_required");

    expect(() =>
      createApiServer(createP1Store(), {
        securityConfig: {
          ...PRODUCTION_SECURITY_CONFIG,
          internalServiceToken: "service-kernel-token"
        }
      })
    ).toThrow("runtime_internal_service_token_unsafe_default");

    const { baseUrl, server } = await startServer(PRODUCTION_SECURITY_CONFIG);

    try {
      const demoLogin = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
        body: {
          password: "admin",
          username: "admin"
        },
        method: "POST",
        tenantId: "tenant_demo"
      });
      expect(demoLogin.status).toBe(401);
      expect(demoLogin.body.code).toBe("AUTH-401-003");
      expect(JSON.stringify(demoLogin.body)).not.toContain("password_hash");
      expect(JSON.stringify(demoLogin.body)).not.toContain("simwar-local-development-secret");
    } finally {
      await stopServer(server);
    }
  });

  it("enforces tenant identity binding and platform authority explicitly", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const tenantAdminToken = await login(baseUrl, "admin", "admin");
      const platformToken = await login(baseUrl, "platform", "platform", "tenant_platform");

      const forgedRead = await request<unknown>(baseUrl, "/api/v1/courses", {
        tenantId: "tenant_other",
        token: teacherToken
      });
      expect(forgedRead.status).toBe(403);
      expect(forgedRead.body.code).toBe("TENANT-403-001");
      expectNoPrivateRuntimeData(forgedRead.body, ["tenant_other", "usr_other_teacher"]);

      const forgedWrite = await request<unknown>(baseUrl, "/api/v1/courses/course_demo/runs", {
        method: "POST",
        tenantId: "tenant_other",
        token: teacherToken
      });
      expect(forgedWrite.status).toBe(403);
      expect(forgedWrite.body.code).toBe("TENANT-403-001");
      expectNoPrivateRuntimeData(forgedWrite.body, ["tenant_other", "usr_other_teacher"]);

      const bodyTenantEscalation = await request<User>(baseUrl, "/api/v1/admin/users", {
        body: {
          display_name: "Cross Tenant User",
          email: "cross-tenant@other.simwar.local",
          password: "cross-tenant",
          roles: ["learner"],
          tenant_id: "tenant_other",
          username: "cross_tenant_user"
        },
        method: "POST",
        token: tenantAdminToken
      });
      expect(bodyTenantEscalation.status).toBe(403);
      expect(bodyTenantEscalation.body.code).toBe("TENANT-403-001");
      expectNoPrivateRuntimeData(bodyTenantEscalation.body, ["tenant_other", "cross-tenant"]);

      const tenantAdminState = await request<{
        tenants: Tenant[];
        users: User[];
      }>(baseUrl, "/api/v1/admin/state", {
        omitTenantHeader: true,
        token: tenantAdminToken
      });
      expect(tenantAdminState.status).toBe(200);
      expect(tenantAdminState.body.data.tenants.map((tenant) => tenant.tenant_id)).toEqual([
        "tenant_demo"
      ]);
      expectNoPrivateRuntimeData(tenantAdminState.body.data, [
        "tenant_platform",
        "tenant_other",
        "usr_platform",
        "usr_other_teacher"
      ]);

      const platformState = await request<{ tenants: Tenant[]; users: User[] }>(
        baseUrl,
        "/api/v1/admin/state",
        {
          omitTenantHeader: true,
          token: platformToken
        }
      );
      expect(platformState.status).toBe(200);
      expect(platformState.body.data.tenants.map((tenant) => tenant.tenant_id).sort()).toEqual([
        "tenant_demo",
        "tenant_other",
        "tenant_platform"
      ]);
      expect(
        platformState.body.data.users.some((user) => user.user_id === "usr_other_teacher")
      ).toBe(true);
    } finally {
      await stopServer(server);
    }
  });

  it("keeps student success, structured error, free-text error, and replay projections safe", async () => {
    const { baseUrl, server, store } = await startServer();
    const protectedTruthSentinel = "r3-protected-truth-sentinel";
    const freeTextSentinel = "r3-free-text-private-artifact-sentinel";

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const adminToken = await login(baseUrl, "admin", "admin");
      const { betaStudentToken, betaTeam, betaUser } = await createBetaStudentAndTeam(
        baseUrl,
        adminToken,
        teacherToken
      );
      const run = await createRunAndOpenRound(baseUrl, teacherToken);

      const truthProtectedFailure = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: {
              ...VALID_DECISION_PAYLOAD,
              state_true: {
                score: protectedTruthSentinel
              },
              strategy_statement: "Structured protected truth must not be reflected."
            },
            team_id: "team_alpha"
          },
          method: "POST",
          token: studentToken
        }
      );
      expect(truthProtectedFailure.status).toBe(403);
      expect(truthProtectedFailure.body.code).toBe("TRUTH-403-001");
      expectNoPrivateRuntimeData(truthProtectedFailure.body, [protectedTruthSentinel]);

      const freeTextFailure = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: {
              ...VALID_DECISION_PAYLOAD,
              marketing_budget: -1,
              strategy_statement: freeTextSentinel
            },
            team_id: "team_alpha"
          },
          method: "POST",
          token: studentToken
        }
      );
      expect(freeTextFailure.status).toBe(422);
      expect(freeTextFailure.body.code).toBe("DEC-422-001");
      expectNoPrivateRuntimeData(freeTextFailure.body, [freeTextSentinel]);

      const alphaDecision = await submitDecision(
        baseUrl,
        studentToken,
        run.run_id,
        "team_alpha",
        "Alpha team holds premium care positioning."
      );
      const betaDecision = await submitDecision(
        baseUrl,
        betaStudentToken,
        run.run_id,
        betaTeam.team_id,
        "Beta team stresses service reliability."
      );

      const crossTeamWrite = await request<ApiErrorEnvelope>(
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
      expect(crossTeamWrite.status).toBe(403);
      expect(crossTeamWrite.body.code).toBe("TEAM-403-001");
      expectNoPrivateRuntimeData(crossTeamWrite.body, [betaTeam.team_id, betaDecision.decision_id]);

      const lock = await request<Round>(baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/lock`, {
        method: "POST",
        token: teacherToken
      });
      expect(lock.status).toBe(200);

      const settlement = await request<SettlementResult>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(settlement.status).toBe(200);

      const publish = await request<Round>(baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/publish`, {
        method: "POST",
        token: teacherToken
      });
      expect(publish.status).toBe(200);

      const settlementSnapshot = structuredClone(store.settlementResults);
      const roundSnapshot = structuredClone(store.rounds);
      const replayEvidence = buildReplayEvidenceFromStore(store, run, settlement.body.data);
      expect(replayEvidence.replay_status).toBe("matched");
      expect(replayEvidence.replay_writes_formal_results).toBe(false);
      expect(selectM1RunReplayEvidenceGolden(replayEvidence).replay.replay_status).toBe("matched");
      expect(store.settlementResults).toEqual(settlementSnapshot);
      expect(store.rounds).toEqual(roundSnapshot);

      const studentResult = await request<M1ReplayEvidencePublicResult>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        {
          token: studentToken
        }
      );
      expect(studentResult.status).toBe(200);
      expect(studentResult.body.data.results).toHaveLength(1);
      expect(studentResult.body.data.results[0]?.team_id).toBe(alphaDecision.team_id);
      expect(studentResult.body.data.replay_evidence).toBeUndefined();
      expectNoPrivateRuntimeData(studentResult.body.data, [
        "state_true",
        "ReplayManifest",
        "replay_manifest",
        "manifest_hash",
        "decision_batch_hash",
        "json_runtime_source_digest",
        "canonical_evidence_digest",
        "teacher_private_notes",
        betaTeam.team_id,
        betaUser.user_id,
        betaDecision.decision_id
      ]);

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
        replay_status: "matched",
        replay_writes_formal_results: false
      });

      const adminAudit = await request<unknown[]>(baseUrl, "/api/v1/audit/logs", {
        token: adminToken
      });
      expect(adminAudit.status).toBe(200);
      expectNoPrivateRuntimeData(adminAudit.body.data, ["tenant_other", "usr_other_teacher"]);

      const otherTenantRead = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        {
          tenantId: "tenant_other",
          token: studentToken
        }
      );
      expect(otherTenantRead.status).toBe(403);
      expect(otherTenantRead.body.code).toBe("TENANT-403-001");
    } finally {
      await stopServer(server);
    }
  });
});
