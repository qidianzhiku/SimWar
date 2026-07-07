import { readFileSync } from "node:fs";
import { once } from "node:events";
import type { Server } from "node:http";
import type {
  ApiEnvelope,
  ApiErrorEnvelope,
  AuthSession,
  Course,
  Decision,
  DecisionPayload,
  PublicResultView,
  PublicRunReplayEvidence,
  Round,
  Run,
  SettlementResult,
  Team,
  User
} from "@simwar/shared-contracts";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../../services/api/src/server";
import {
  createM1RunReplayEvidence,
  selectM1RunReplayEvidenceGolden
} from "../../services/api/src/run-manifest-replay-evidence";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";
import {
  approveR7CCompiledScenario,
  bindR7CReleaseCandidateToRun,
  buildR7CShadowArenaBatch,
  compileR7CScenarioDraft,
  createR7CReleaseCandidate,
  createR7CScenarioDraft,
  createR7CScenarioRegistry,
  freezeR7CApprovedScenario,
  projectR7CScenarioForActor
} from "../../services/simulation-core/src/eldercare-scenario-factory";

const VALID_DECISION_PAYLOAD = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "R5/R6 course delivery synthetic decision."
} as const satisfies DecisionPayload;

const COURSE_DELIVERY_COURSE_ID = "course_002";

const teacherActor = {
  actor_id: "teacher_course_delivery",
  course_id: COURSE_DELIVERY_COURSE_ID,
  role: "teacher" as const,
  tenant_id: "tenant_demo"
};
const studentActor = {
  actor_id: "student_course_delivery",
  course_id: COURSE_DELIVERY_COURSE_ID,
  role: "student" as const,
  team_id: "team_course_delivery_alpha",
  tenant_id: "tenant_demo"
};
const tenantAdminActor = {
  actor_id: "tenant_admin_course_delivery",
  role: "tenant_admin" as const,
  tenant_id: "tenant_demo"
};
const platformActor = {
  actor_id: "platform_course_delivery",
  platform_authority: true,
  role: "platform_admin" as const,
  tenant_id: "tenant_demo"
};
const otherTenantActor = {
  actor_id: "student_other_course_delivery",
  course_id: "course_other",
  role: "student" as const,
  team_id: "team_other",
  tenant_id: "tenant_other"
};

type CourseDeliveryFixture = {
  fixture_id: "r5-r6-course-delivery-learning-evidence";
  metadata: {
    direct_store_delta: "NONE";
    g0_pass: "NOT_GRANTED";
    g0_status: "EXCEPTION";
    l1_status: "NOT_READY";
  };
  forbidden_student_fields: string[];
};

type ReplayEvidencePublicResult = PublicResultView & {
  replay_evidence?: PublicRunReplayEvidence;
};

function loadFixture(): CourseDeliveryFixture {
  return JSON.parse(
    readFileSync("contracts/fixtures/r5-r6-course-delivery-learning-evidence.valid.json", "utf8")
  ) as CourseDeliveryFixture;
}

function createApprovedCourseScenario() {
  const registry = createR7CScenarioRegistry({ actor: teacherActor });
  const draft = createR7CScenarioDraft(registry, {
    actor: teacherActor,
    variant_id: "base_operations"
  });
  const approved = approveR7CCompiledScenario(compileR7CScenarioDraft(draft), {
    actor: teacherActor
  });
  const frozen = freezeR7CApprovedScenario(approved, { actor: teacherActor });

  return {
    family: registry.family,
    releaseCandidate: createR7CReleaseCandidate(frozen, { actor: teacherActor })
  };
}

async function startServerWithScenarioAsset(): Promise<{
  baseUrl: string;
  releaseCandidate: ReturnType<typeof createApprovedCourseScenario>["releaseCandidate"];
  server: Server;
  store: SimWarStore;
  family: ReturnType<typeof createApprovedCourseScenario>["family"];
}> {
  const { family, releaseCandidate } = createApprovedCourseScenario();
  const store = createP1Store();
  const approvedCourseParameterSet = {
    ...releaseCandidate.compiled_record.asset.parameter_set,
    status: "approved" as const,
    tenant_id: "tenant_demo"
  };

  store.scenarios.unshift(releaseCandidate.compiled_record.asset.scenario_package);
  store.parameterSets.unshift(approvedCourseParameterSet);

  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    family,
    releaseCandidate,
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
  const headers = new Headers({ "content-type": "application/json" });

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

async function createLearnerAndTeam(
  baseUrl: string,
  adminToken: string,
  teacherToken: string,
  courseId: string,
  username: string,
  teamName: string
): Promise<{ team: Team; token: string; user: User }> {
  const userResponse = await request<User>(baseUrl, "/api/v1/admin/users", {
    body: {
      display_name: `${teamName} Learner`,
      email: `${username}@demo.simwar.local`,
      password: username,
      roles: ["learner"],
      username
    },
    method: "POST",
    token: adminToken
  });
  expect(userResponse.status).toBe(201);

  const teamResponse = await request<Team>(baseUrl, `/api/v1/courses/${courseId}/teams`, {
    body: {
      captain_user_id: userResponse.body.data.user_id,
      name: teamName
    },
    method: "POST",
    token: teacherToken
  });
  expect(teamResponse.status).toBe(201);

  return {
    team: teamResponse.body.data,
    token: await login(baseUrl, username, username),
    user: userResponse.body.data
  };
}

async function submitDecision(
  baseUrl: string,
  token: string,
  runId: string,
  teamId: string,
  statement: string
): Promise<Decision> {
  const response = await request<Decision>(baseUrl, `/api/v1/runs/${runId}/rounds/1/decisions`, {
    body: {
      decision_payload: {
        ...VALID_DECISION_PAYLOAD,
        strategy_statement: statement
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

function assertDoesNotContain(value: unknown, forbiddenFields: string[]): void {
  const serialized = JSON.stringify(value);

  for (const forbidden of forbiddenFields) {
    expect(serialized).not.toContain(forbidden);
  }
}

describe("R5/R6/R7-C course delivery and learning evidence guard", () => {
  it("delivers a scenario-asset-driven synthetic course without writing learning evidence to truth", async () => {
    const fixture = loadFixture();
    const { baseUrl, family, releaseCandidate, server, store } =
      await startServerWithScenarioAsset();
    const protectedTruthSentinel = "course-delivery-protected-truth-sentinel";

    try {
      expect(fixture.metadata).toMatchObject({
        direct_store_delta: "NONE",
        g0_pass: "NOT_GRANTED",
        g0_status: "EXCEPTION",
        l1_status: "NOT_READY"
      });

      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const adminToken = await login(baseUrl, "admin", "admin");
      const platformToken = await login(baseUrl, "platform", "platform", "tenant_platform");

      const courseResponse = await request<Course>(baseUrl, "/api/v1/courses", {
        body: { title: "R5/R6/R7-C synthetic course delivery evidence" },
        method: "POST",
        token: teacherToken
      });
      expect(courseResponse.status).toBe(201);
      const course = courseResponse.body.data;
      expect(course.scenario_package_id).toBe(
        releaseCandidate.compiled_record.asset.scenario_package.scenario_package_id
      );
      expect(course.parameter_set_id).toBe(
        releaseCandidate.compiled_record.asset.parameter_set.parameter_set_id
      );

      const runBeforePublish = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/runs`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(runBeforePublish.status).toBe(409);
      expect(runBeforePublish.body.code).toBe("RUN-409-001");

      const publishCourse = await request<Course>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/publish`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(publishCourse.status).toBe(200);
      expect(publishCourse.body.data.status).toBe("published");

      const alpha = await createLearnerAndTeam(
        baseUrl,
        adminToken,
        teacherToken,
        course.course_id,
        "student_course_alpha",
        "Course Delivery Alpha"
      );
      const beta = await createLearnerAndTeam(
        baseUrl,
        adminToken,
        teacherToken,
        course.course_id,
        "student_course_beta",
        "Course Delivery Beta"
      );

      const runResponse = await request<{ round: Round; run: Run }>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/runs`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(runResponse.status).toBe(201);
      const run = runResponse.body.data.run;
      expect(run.scenario_package_id).toBe(course.scenario_package_id);
      expect(run.parameter_set_id).toBe(course.parameter_set_id);
      expect(run.seed).toBe(releaseCandidate.compiled_record.asset.parameter_set.seed);

      const boundCandidate = bindR7CReleaseCandidateToRun(releaseCandidate, {
        actor: {
          ...teacherActor,
          course_id: course.course_id
        },
        run_id: run.run_id
      });
      expect(boundCandidate.run_binding).toMatchObject({
        mutation_allowed: false,
        parameter_set_id: run.parameter_set_id,
        run_id: run.run_id,
        scenario_package_id: run.scenario_package_id
      });

      const studentProjection = projectR7CScenarioForActor(boundCandidate, {
        actor: {
          ...studentActor,
          course_id: course.course_id,
          team_id: alpha.team.team_id
        }
      });
      expect(studentProjection.visibility).toBe("student_redacted_scenario_observation");
      assertDoesNotContain(studentProjection, fixture.forbidden_student_fields);
      expect(() => projectR7CScenarioForActor(boundCandidate, { actor: otherTenantActor })).toThrow(
        /R7C_SCENARIO_FACTORY_TENANT_SCOPE_DENIED/
      );

      const teacherProjection = projectR7CScenarioForActor(boundCandidate, {
        actor: {
          ...teacherActor,
          course_id: course.course_id
        }
      });
      const tenantAdminProjection = projectR7CScenarioForActor(boundCandidate, {
        actor: tenantAdminActor
      });
      const platformProjection = projectR7CScenarioForActor(boundCandidate, {
        actor: platformActor
      });
      expect(teacherProjection.visibility).toBe("teacher_authorized_scenario_factory");
      expect(tenantAdminProjection.visibility).toBe("tenant_admin_scenario_status");
      expect(platformProjection.visibility).toBe("platform_admin_explicit_authority");

      const startResponse = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/start`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(startResponse.status).toBe(200);
      expect(startResponse.body.data.status).toBe("open");

      const protectedSubmit = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: {
              ...VALID_DECISION_PAYLOAD,
              state_true: { score: protectedTruthSentinel }
            },
            team_id: alpha.team.team_id
          },
          method: "POST",
          requestId: "req_course_delivery_truth_guard",
          token: alpha.token
        }
      );
      expect(protectedSubmit.status).toBe(403);
      expect(protectedSubmit.body.code).toBe("TRUTH-403-001");
      assertDoesNotContain(protectedSubmit.body, [protectedTruthSentinel]);

      const alphaDecision = await submitDecision(
        baseUrl,
        alpha.token,
        run.run_id,
        alpha.team.team_id,
        "Alpha prioritizes dependable care quality."
      );
      const betaDecision = await submitDecision(
        baseUrl,
        beta.token,
        run.run_id,
        beta.team.team_id,
        "Beta tests payer-mix and capacity resilience."
      );

      const crossTeamAttempt = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: VALID_DECISION_PAYLOAD,
            team_id: beta.team.team_id
          },
          method: "POST",
          token: alpha.token
        }
      );
      expect(crossTeamAttempt.status).toBe(403);
      expect(crossTeamAttempt.body.code).toBe("TEAM-403-001");
      assertDoesNotContain(crossTeamAttempt.body, [betaDecision.decision_id, beta.user.user_id]);

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
      expect(settlementResponse.body.data.team_results).toHaveLength(2);

      const publishRound = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(publishRound.status).toBe(200);
      expect(publishRound.body.data.status).toBe("published");

      const formalResultSnapshot = structuredClone(store.settlementResults);
      const formalRoundSnapshot = structuredClone(store.rounds);
      const replayEvidence = buildReplayEvidenceFromStore(store, run, settlementResponse.body.data);
      const shadowArena = buildR7CShadowArenaBatch(
        family,
        boundCandidate,
        settlementResponse.body.data
      );

      expect(replayEvidence.replay_status).toBe("matched");
      expect(replayEvidence.replay_result_hash).toBe(settlementResponse.body.data.replay_hash);
      expect(replayEvidence.replay_writes_formal_results).toBe(false);
      expect(selectM1RunReplayEvidenceGolden(replayEvidence).replay.replay_status).toBe("matched");
      expect(shadowArena.official_result_non_overwrite).toBe(true);
      expect(shadowArena.replay_writes_formal_results).toBe(false);
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
          token: alpha.token
        }
      );
      expect(studentResult.status).toBe(200);
      expect(studentResult.body.data.classroom_debrief_prompts).toHaveLength(3);
      expect(studentResult.body.data.results).toHaveLength(1);
      expect(studentResult.body.data.results[0]?.team_id).toBe(alpha.team.team_id);
      expect(studentResult.body.data.results[0]?.state_true).toBeUndefined();
      expect(studentResult.body.data.replay_evidence).toBeUndefined();
      assertDoesNotContain(studentResult.body.data, [
        ...fixture.forbidden_student_fields,
        beta.team.team_id,
        beta.user.user_id
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
        replay_status: "matched",
        replay_writes_formal_results: false
      });

      const tenantAdminState = await request<{
        tenants: Array<{ tenant_id: string }>;
        users: User[];
      }>(baseUrl, "/api/v1/admin/state", {
        omitTenantHeader: true,
        token: adminToken
      });
      expect(tenantAdminState.status).toBe(200);
      expect(tenantAdminState.body.data.tenants.map((item) => item.tenant_id)).toEqual([
        "tenant_demo"
      ]);
      assertDoesNotContain(tenantAdminState.body.data, [
        "tenant_other",
        "usr_other_teacher",
        "tenant_platform"
      ]);

      const platformState = await request<{ tenants: Array<{ tenant_id: string }> }>(
        baseUrl,
        "/api/v1/admin/state",
        {
          omitTenantHeader: true,
          token: platformToken
        }
      );
      expect(platformState.status).toBe(200);
      expect(platformState.body.data.tenants.map((item) => item.tenant_id).sort()).toEqual([
        "tenant_demo",
        "tenant_other",
        "tenant_platform"
      ]);

      const learningEvidenceLedger = {
        course_id: course.course_id,
        excluded_from_truth_hash: true,
        formal_truth_write: false,
        ledger_kind: "learning_evidence_ledger" as const,
        replay_source_result_id: settlementResponse.body.data.settlement_result_id,
        scenario_package_id: run.scenario_package_id,
        shadow_arena_public_view: shadowArena.public_view,
        student_feedback: {
          prompts: studentResult.body.data.classroom_debrief_prompts,
          result_count: studentResult.body.data.results.length
        },
        teacher_evidence: {
          replay_status: teacherResult.body.data.replay_evidence?.replay_status,
          scenario_visibility: teacherProjection.visibility
        }
      };
      expect(learningEvidenceLedger.formal_truth_write).toBe(false);
      expect(learningEvidenceLedger.excluded_from_truth_hash).toBe(true);
      assertDoesNotContain(learningEvidenceLedger, [
        "state_true",
        "decision_batch_hash",
        "json_runtime_source_digest",
        "canonical_evidence_digest",
        "private_replay"
      ]);
      expect(store.settlementResults).toEqual(formalResultSnapshot);

      expect(alphaDecision.team_id).toBe(alpha.team.team_id);
      expect(betaDecision.team_id).toBe(beta.team.team_id);
      expect(store.auditLogs.map((log) => log.action)).toEqual(
        expect.arrayContaining([
          "course.create",
          "course.publish",
          "team.create",
          "run.create",
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
