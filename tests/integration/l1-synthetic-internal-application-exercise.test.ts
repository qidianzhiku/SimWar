import { existsSync, readFileSync } from "node:fs";
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
import {
  createM1RunReplayEvidence,
  selectM1RunReplayEvidenceGolden
} from "../../services/api/src/run-manifest-replay-evidence";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const INTERNAL_ONLY_MARKER = "INTERNAL_ONLY_DRAFT_NOT_RELEASED";
const STATUS_DOCUMENTS = [
  "docs/governance/g0-solo-maintainer-control-policy.md",
  "docs/quality/l1-g0-g7-current-evidence-ledger.md",
  "docs/quality/l1-synthetic-application-decision-evidence.md",
  "docs/quality/l1-known-limits-and-release-note.md",
  "docs/operations/l1-teacher-kit-internal-only.md",
  "docs/operations/l1-session-runbook-lite.md",
  "docs/operations/l1-synthetic-data-reset-and-abort.md",
  "docs/operations/l1-replay-evidence-review-checklist.md",
  "docs/operations/l1-issue-escalation-procedure.md",
  "docs/architecture/r4-discovery-parity-gap-directory.md"
] as const;
const STUDENT_FORBIDDEN_FIELDS = [
  "state_true",
  "replay_evidence",
  "ReplayManifest",
  "replay_manifest",
  "manifest_hash",
  "decision_batch_hash",
  "json_runtime_source_digest",
  "canonical_evidence_digest",
  "tenant_other",
  "tenant_platform",
  "usr_other_teacher",
  "usr_platform",
  "synthetic-protected-truth-sentinel"
];
const VALID_DECISION_PAYLOAD = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "L1 synthetic internal application decision."
} as const satisfies DecisionPayload;

type ReplayEvidencePublicResult = PublicResultView & {
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
    omitTenantHeader?: boolean;
    requestId?: string;
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

  if (options.requestId) {
    headers.set("x-request-id", options.requestId);
  }

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
    status: response.status
  };
}

async function login(
  baseUrl: string,
  username: string,
  password: string,
  tenantId = "tenant_demo"
): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    method: "POST",
    tenantId
  });

  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

async function createBetaStudentAndTeam(
  baseUrl: string,
  adminToken: string,
  teacherToken: string
): Promise<{ betaStudentToken: string; betaTeam: Team; betaUser: User }> {
  const betaUserResponse = await request<User>(baseUrl, "/api/v1/admin/users", {
    body: {
      username: "student_beta_synthetic",
      email: "student-beta-synthetic@demo.simwar.local",
      display_name: "Synthetic Beta Student",
      password: "student_beta_synthetic",
      roles: ["learner"]
    },
    method: "POST",
    token: adminToken
  });
  expect(betaUserResponse.status).toBe(201);

  const betaTeamResponse = await request<Team>(baseUrl, "/api/v1/courses/course_demo/teams", {
    body: {
      name: "Beta Synthetic Application Team",
      captain_user_id: betaUserResponse.body.data.user_id
    },
    method: "POST",
    token: teacherToken
  });
  expect(betaTeamResponse.status).toBe(201);

  return {
    betaStudentToken: await login(baseUrl, "student_beta_synthetic", "student_beta_synthetic"),
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

function assertSerializedDoesNotContain(value: unknown, forbiddenFields: string[]): void {
  const serialized = JSON.stringify(value);

  for (const forbidden of forbiddenFields) {
    expect(serialized).not.toContain(forbidden);
  }
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

describe("L1 synthetic internal application exercise", () => {
  it("keeps the internal-only evidence package explicit and mutually consistent", () => {
    for (const path of STATUS_DOCUMENTS) {
      expect(existsSync(path), `${path} must exist`).toBe(true);
      const document = readFileSync(path, "utf8");

      expect(document).toContain(INTERNAL_ONLY_MARKER);
      expect(document).toContain("G0 Status:");
      expect(document).toContain("EXCEPTION");
      expect(document).toContain("G0 PASS:");
      expect(document).toContain("NOT_GRANTED");
      expect(document).toContain("L1 Status:");
      expect(document).toContain("NOT_READY");
      expect(document).toContain("PostgreSQL runtime");
      expect(document).toContain("NOT_AUTHORIZED");
      expect(document).toContain("Pilot");
      expect(document).toContain("Production");
    }
  });

  it("performs the synthetic internal application dry-run without widening truth or visibility", async () => {
    const { baseUrl, server, store } = await startServer();
    const protectedTruthSentinel = "synthetic-protected-truth-sentinel";

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const adminToken = await login(baseUrl, "admin", "admin");
      const platformToken = await login(baseUrl, "platform", "platform", "tenant_platform");
      const { betaStudentToken, betaTeam, betaUser } = await createBetaStudentAndTeam(
        baseUrl,
        adminToken,
        teacherToken
      );
      const run = await createRunAndOpenRound(baseUrl, teacherToken);

      const controlledAbort = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: {
              ...VALID_DECISION_PAYLOAD,
              state_true: {
                settlement_status: protectedTruthSentinel
              },
              strategy_statement: "Controlled abort must not leak protected truth."
            },
            team_id: "team_alpha"
          },
          method: "POST",
          requestId: "req_l1_synthetic_truth_abort",
          token: studentToken
        }
      );
      expect(controlledAbort.status).toBe(403);
      expect(controlledAbort.body.code).toBe("TRUTH-403-001");
      expect(controlledAbort.body.request_id).toBe("req_l1_synthetic_truth_abort");
      assertSerializedDoesNotContain(controlledAbort.body, [protectedTruthSentinel]);

      const alphaDecision = await submitDecision(
        baseUrl,
        studentToken,
        run.run_id,
        "team_alpha",
        "Alpha synthetic team preserves service reliability."
      );
      const betaDecision = await submitDecision(
        baseUrl,
        betaStudentToken,
        run.run_id,
        betaTeam.team_id,
        "Beta synthetic team tests multi-team result projection."
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
      assertSerializedDoesNotContain(crossTeamAttempt.body, [
        betaDecision.decision_id,
        betaUser.user_id
      ]);

      const crossTenantRead = await request<ApiErrorEnvelope>(baseUrl, "/api/v1/courses", {
        tenantId: "tenant_other",
        token: teacherToken
      });
      expect(crossTenantRead.status).toBe(403);
      expect(crossTenantRead.body.code).toBe("TENANT-403-001");
      assertSerializedDoesNotContain(crossTenantRead.body, ["tenant_other", "usr_other_teacher"]);

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

      const formalResultSnapshot = structuredClone(store.settlementResults);
      const formalRoundSnapshot = structuredClone(store.rounds);
      const replayEvidence = buildReplayEvidenceFromStore(store, run, settlementResponse.body.data);
      expect(replayEvidence.replay_status).toBe("matched");
      expect(replayEvidence.replay_result_hash).toBe(settlementResponse.body.data.replay_hash);
      expect(replayEvidence.replay_writes_formal_results).toBe(false);
      expect(selectM1RunReplayEvidenceGolden(replayEvidence).replay.replay_status).toBe("matched");
      expect(store.settlementResults).toEqual(formalResultSnapshot);
      expect(store.rounds).toEqual(formalRoundSnapshot);

      const repeatedSettlement = await request<SettlementResult>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(repeatedSettlement.status).toBe(200);
      expect(repeatedSettlement.body.data.replay_hash).toBe(
        settlementResponse.body.data.replay_hash
      );
      expect(store.settlementResults).toEqual(formalResultSnapshot);
      expect(store.rounds).toEqual(formalRoundSnapshot);

      const studentResult = await request<ReplayEvidencePublicResult>(
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
      assertSerializedDoesNotContain(studentResult.body.data, [
        ...STUDENT_FORBIDDEN_FIELDS,
        betaTeam.team_id,
        betaUser.user_id
      ]);

      const teacherResult = await request<ReplayEvidencePublicResult>(
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

      const tenantAdminState = await request<{ tenants: Tenant[]; users: User[] }>(
        baseUrl,
        "/api/v1/admin/state",
        {
          omitTenantHeader: true,
          token: adminToken
        }
      );
      expect(tenantAdminState.status).toBe(200);
      expect(tenantAdminState.body.data.tenants.map((tenant) => tenant.tenant_id)).toEqual([
        "tenant_demo"
      ]);
      assertSerializedDoesNotContain(tenantAdminState.body.data, [
        "tenant_other",
        "tenant_platform",
        "usr_other_teacher",
        "usr_platform"
      ]);

      const platformState = await request<{ tenants: Tenant[] }>(baseUrl, "/api/v1/admin/state", {
        omitTenantHeader: true,
        token: platformToken
      });
      expect(platformState.status).toBe(200);
      expect(platformState.body.data.tenants.map((tenant) => tenant.tenant_id).sort()).toEqual([
        "tenant_demo",
        "tenant_other",
        "tenant_platform"
      ]);

      expect(alphaDecision.team_id).toBe("team_alpha");
      expect(betaDecision.team_id).toBe(betaTeam.team_id);
      expect(store.auditLogs.map((log) => log.action)).toEqual(
        expect.arrayContaining([
          "decision.submit",
          "round.lock",
          "round.settle_requested",
          "round.publish"
        ])
      );
    } finally {
      await stopServer(server);
    }
  });
});
