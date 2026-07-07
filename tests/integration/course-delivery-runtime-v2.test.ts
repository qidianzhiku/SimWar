import { once } from "node:events";
import type { Server } from "node:http";
import type {
  AdminState,
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
import {
  buildCourseDeliveryThreePartFeedbackV1,
  createCourseDeliveryBlueprintV1,
  createCourseDeliveryLearningEvidenceLedgerV1,
  createCourseDeliveryRunBindingEvidenceV1,
  summarizeCourseDeliveryStateMachineEvidenceV1
} from "../../services/api/src/course-delivery-productization";
import {
  COURSE_DELIVERY_RUNTIME_V2_FORBIDDEN_STUDENT_MARKERS,
  createCourseDeliveryRuntimeV2Evidence
} from "../../services/api/src/course-delivery-runtime-v2";
import { createM1RunReplayEvidence } from "../../services/api/src/run-manifest-replay-evidence";
import { createApiServer } from "../../services/api/src/server";
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
  strategy_statement: "Course Delivery Runtime V2 synthetic evidence decision."
} as const satisfies DecisionPayload;

const COURSE_ID = "course_002";
const teacherActor = {
  actor_id: "teacher_runtime_v2",
  course_id: COURSE_ID,
  role: "teacher" as const,
  tenant_id: "tenant_demo"
};
const tenantAdminActor = {
  actor_id: "tenant_admin_runtime_v2",
  role: "tenant_admin" as const,
  tenant_id: "tenant_demo"
};
const platformActor = {
  actor_id: "platform_runtime_v2",
  platform_authority: true,
  role: "platform_admin" as const,
  tenant_id: "tenant_demo"
};

type ReplayEvidencePublicResult = PublicResultView & {
  replay_evidence?: PublicRunReplayEvidence;
};

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
  family: ReturnType<typeof createApprovedCourseScenario>["family"];
  releaseCandidate: ReturnType<typeof createApprovedCourseScenario>["releaseCandidate"];
  server: Server;
  store: SimWarStore;
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

function assertDoesNotContain(value: unknown, forbiddenMarkers: string[]): void {
  const serialized = JSON.stringify(value);

  for (const marker of forbiddenMarkers) {
    expect(serialized).not.toContain(marker);
  }
}

describe("Course Delivery Runtime V2 synthetic execution evidence", () => {
  it("converges course execution, replay, role visibility and learning evidence without truth writes", async () => {
    const { baseUrl, family, releaseCandidate, server, store } =
      await startServerWithScenarioAsset();
    const protectedTruthSentinel = "course-delivery-runtime-v2-protected-truth";

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const adminToken = await login(baseUrl, "admin", "admin");
      const platformToken = await login(baseUrl, "platform", "platform", "tenant_platform");

      const courseResponse = await request<Course>(baseUrl, "/api/v1/courses", {
        body: { title: "Course Delivery Runtime V2 synthetic execution" },
        method: "POST",
        token: teacherToken
      });
      expect(courseResponse.status).toBe(201);
      const course = courseResponse.body.data;
      const scenarioPackage = releaseCandidate.compiled_record.asset.scenario_package;
      const parameterSet = store.parameterSets.find(
        (candidate) => candidate.parameter_set_id === course.parameter_set_id
      );

      if (!parameterSet) {
        throw new Error("missing approved course parameter set");
      }

      const blueprint = createCourseDeliveryBlueprintV1({
        approvalReference: releaseCandidate.release_candidate_id,
        course,
        knownLimitsReference: "docs/quality/course-delivery-runtime-v2.md",
        parameterSet,
        pluginPackageId: scenarioPackage.plugin_package_ids[0] ?? "plugin_wellness_eldercare_v1",
        pluginVersion: releaseCandidate.compiled_record.plugin_version,
        releaseCandidate,
        scenarioPackage,
        teacherScope: "tenant_demo:course_delivery_runtime_v2_teacher",
        runBindingReference: "pending"
      });

      const publishCourse = await request<Course>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/publish`,
        {
          method: "POST",
          requestId: "req_runtime_v2_course_publish_once",
          token: teacherToken
        }
      );
      expect(publishCourse.status).toBe(200);
      const publishedCourse = publishCourse.body.data;

      const alpha = await createLearnerAndTeam(
        baseUrl,
        adminToken,
        teacherToken,
        course.course_id,
        "student_runtime_v2_alpha",
        "Runtime V2 Alpha"
      );
      const beta = await createLearnerAndTeam(
        baseUrl,
        adminToken,
        teacherToken,
        course.course_id,
        "student_runtime_v2_beta",
        "Runtime V2 Beta"
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
      const boundCandidate = bindR7CReleaseCandidateToRun(releaseCandidate, {
        actor: {
          ...teacherActor,
          course_id: course.course_id
        },
        run_id: run.run_id
      });
      const runBindingEvidence = createCourseDeliveryRunBindingEvidenceV1({
        blueprint,
        releaseCandidate: boundCandidate,
        run
      });

      const studentProjection = projectR7CScenarioForActor(boundCandidate, {
        actor: {
          actor_id: "student_runtime_v2_alpha",
          course_id: course.course_id,
          role: "student",
          team_id: alpha.team.team_id,
          tenant_id: "tenant_demo"
        }
      });
      expect(studentProjection.visibility).toBe("student_redacted_scenario_observation");
      assertDoesNotContain(studentProjection, COURSE_DELIVERY_RUNTIME_V2_FORBIDDEN_STUDENT_MARKERS);

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

      const startResponse = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/start`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(startResponse.status).toBe(200);

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
          requestId: "req_runtime_v2_truth_guard",
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
        "Alpha prioritizes high-quality delivery."
      );
      const betaDecision = await submitDecision(
        baseUrl,
        beta.token,
        run.run_id,
        beta.team.team_id,
        "Beta prioritizes resilient capacity."
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
          requestId: "req_runtime_v2_round_lock_once",
          token: teacherToken
        }
      );
      expect(lockResponse.status).toBe(200);
      const lockResponseAgain = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        {
          method: "POST",
          requestId: "req_runtime_v2_round_lock_twice",
          token: teacherToken
        }
      );
      expect(lockResponseAgain.status).toBe(200);
      expect(lockResponseAgain.body.data.decision_batch_id).toBe(
        lockResponse.body.data.decision_batch_id
      );

      const settlementResponse = await request<SettlementResult>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(settlementResponse.status).toBe(200);
      const formalSettlementSnapshot = structuredClone(store.settlementResults);
      const replayEvidence = buildReplayEvidenceFromStore(store, run, settlementResponse.body.data);
      const shadowArena = buildR7CShadowArenaBatch(
        family,
        boundCandidate,
        settlementResponse.body.data
      );
      expect(shadowArena.official_result_non_overwrite).toBe(true);
      expect(shadowArena.replay_writes_formal_results).toBe(false);
      expect(store.settlementResults).toEqual(formalSettlementSnapshot);

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
      expect(store.settlementResults).toEqual(formalSettlementSnapshot);

      const publishRound = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST",
          requestId: "req_runtime_v2_round_publish_once",
          token: teacherToken
        }
      );
      expect(publishRound.status).toBe(200);
      const publishRoundAgain = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST",
          requestId: "req_runtime_v2_round_publish_twice",
          token: teacherToken
        }
      );
      expect(publishRoundAgain.status).toBe(200);

      const studentResult = await request<ReplayEvidencePublicResult>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        {
          token: alpha.token
        }
      );
      expect(studentResult.status).toBe(200);
      expect(studentResult.body.data.results).toHaveLength(1);
      expect(studentResult.body.data.results[0]?.team_id).toBe(alpha.team.team_id);
      expect(studentResult.body.data.replay_evidence).toBeUndefined();
      assertDoesNotContain(studentResult.body.data, [
        ...COURSE_DELIVERY_RUNTIME_V2_FORBIDDEN_STUDENT_MARKERS,
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
      expect(teacherResult.body.data.replay_evidence).toMatchObject({
        evidence_kind: "m1_json_runtime_replay_evidence",
        replay_status: "matched",
        replay_writes_formal_results: false
      });

      const tenantAdminState = await request<AdminState>(baseUrl, "/api/v1/admin/state", {
        omitTenantHeader: true,
        token: adminToken
      });
      expect(tenantAdminState.status).toBe(200);
      expect(tenantAdminState.body.data.tenants.map((item) => item.tenant_id)).toEqual([
        "tenant_demo"
      ]);

      const platformState = await request<AdminState>(baseUrl, "/api/v1/admin/state", {
        omitTenantHeader: true,
        token: platformToken
      });
      expect(platformState.status).toBe(200);
      expect(platformState.body.data.tenants.map((item) => item.tenant_id).sort()).toEqual([
        "tenant_demo",
        "tenant_other",
        "tenant_platform"
      ]);

      const feedback = buildCourseDeliveryThreePartFeedbackV1({
        deterministicNextStep: "Use replay evidence to guide the next synthetic round.",
        scenarioObservation: "Only public scenario observations are included for learners.",
        studentResult: studentResult.body.data
      });
      const learningEvidence = createCourseDeliveryLearningEvidenceLedgerV1({
        blueprint,
        feedback,
        replaySourceResultId: settlementResponse.body.data.settlement_result_id,
        runBindingEvidence,
        shadowArenaPublicView: shadowArena.public_view,
        teacherEvidence: {
          replay_status: teacherResult.body.data.replay_evidence?.replay_status ?? "not_run",
          scenario_visibility: teacherProjection.visibility
        }
      });
      const stateMachineEvidence = summarizeCourseDeliveryStateMachineEvidenceV1(store.auditLogs);

      const evidence = createCourseDeliveryRuntimeV2Evidence({
        course: publishedCourse,
        decisions: [alphaDecision, betaDecision],
        learningEvidence,
        platformState: platformState.body.data,
        projections: {
          platform: platformProjection,
          student: studentProjection,
          teacher: teacherProjection,
          tenantAdmin: tenantAdminProjection
        },
        replayEvidence,
        repeatedSettlement: repeatedSettlement.body.data,
        round: publishRoundAgain.body.data,
        run,
        runBindingEvidence,
        settlement: settlementResponse.body.data,
        shadowArena,
        stateMachineEvidence,
        studentResult: studentResult.body.data,
        teams: [alpha.team, beta.team],
        tenantAdminState: tenantAdminState.body.data,
        teacherResult: teacherResult.body.data
      });

      expect(evidence.evidence_kind).toBe(
        "course_delivery_runtime_v2_synthetic_execution_evidence"
      );
      expect(evidence.direct_store_delta).toBe("NONE");
      expect(evidence.g0_status).toBe("EXCEPTION");
      expect(evidence.g0_pass).toBe("NOT_GRANTED");
      expect(evidence.l1_status).toBe("NOT_READY");
      expect(evidence.runtime_chain).toEqual([
        "course.publish",
        "run.create",
        "round.start",
        "decision.submit",
        "round.lock",
        "round.settle_requested",
        "round.publish",
        "result.read",
        "replay.evidence",
        "shadow_arena.non_overwrite",
        "learning_evidence.excluded_from_truth_hash"
      ]);
      expect(evidence.student_negative_visibility).toMatchObject({
        other_team_visible: false,
        private_truth_visible: false,
        replay_evidence_visible: false
      });
      expect(evidence.teacher_evidence).toMatchObject({
        replay_status: "matched",
        team_result_count: 2
      });
      expect(evidence.tenant_scope).toMatchObject({
        platform_admin_explicit_authority: true,
        tenant_admin_visible_tenants: ["tenant_demo"]
      });
      expect(evidence.shadow_replay).toMatchObject({
        official_result_non_overwrite: true,
        replay_writes_formal_results: false
      });
      expect(evidence.repeated_settlement).toMatchObject({
        official_result_non_overwrite: true,
        replay_hash_stable: true
      });
      expect(evidence.learning_evidence).toMatchObject({
        excluded_from_truth_hash: true,
        formal_truth_write: false
      });
      expect(evidence.projections).toMatchObject({
        platform: "platform_admin_explicit_authority",
        student: "student_redacted_scenario_observation",
        teacher: "teacher_authorized_scenario_factory",
        tenant_admin: "tenant_admin_scenario_status"
      });
      expect(evidence.state_machine.duplicate_side_effects_detected).toBe(false);
      expect(evidence.known_limits).toEqual(
        expect.arrayContaining([
          "does_not_claim_g0_pass",
          "does_not_claim_l1_ready",
          "does_not_activate_postgresql_runtime",
          "does_not_prove_durable_settlement"
        ])
      );
      assertDoesNotContain(evidence.student_negative_visibility, [
        "state_true",
        "canonical_evidence_digest",
        beta.team.team_id,
        beta.user.user_id
      ]);
    } finally {
      await stopServer(server);
    }
  });
});
