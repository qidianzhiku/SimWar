import { once } from "node:events";
import type { Server } from "node:http";
import type {
  ApiEnvelope,
  ApiErrorEnvelope,
  AuthSession,
  Course,
  DecisionPayload,
  PublicResultView,
  Round,
  Run,
  SettlementResult,
  Team,
  User
} from "@simwar/shared-contracts";
import { describe, expect, it } from "vitest";
import {
  COURSE_DELIVERY_API_PERMISSION_MATRIX_V1,
  buildCourseDeliveryThreePartFeedbackV1,
  createCourseDeliveryBlueprintV1,
  createCourseDeliveryLearningEvidenceLedgerV1,
  createCourseDeliveryRunBindingEvidenceV1,
  summarizeCourseDeliveryStateMachineEvidenceV1
} from "../../services/api/src/course-delivery-productization";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";
import {
  approveR7CCompiledScenario,
  bindR7CReleaseCandidateToRun,
  compileR7CScenarioDraft,
  createR7CReleaseCandidate,
  createR7CScenarioDraft,
  createR7CScenarioRegistry,
  freezeR7CApprovedScenario
} from "../../services/simulation-core/src/eldercare-scenario-factory";

const VALID_DECISION_PAYLOAD = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "Course delivery productization decision."
} as const satisfies DecisionPayload;

const COURSE_ID = "course_002";
const teacherActor = {
  actor_id: "teacher_course_delivery_productization",
  course_id: COURSE_ID,
  role: "teacher" as const,
  tenant_id: "tenant_demo"
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
  releaseCandidate: ReturnType<typeof createApprovedCourseScenario>["releaseCandidate"];
  server: Server;
  store: SimWarStore;
}> {
  const { releaseCandidate } = createApprovedCourseScenario();
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
    requestId?: string;
    tenantId?: string;
    token?: string;
  } = {}
): Promise<{ body: ApiEnvelope<TData>; headers: Headers; status: number }> {
  const headers = new Headers({ "content-type": "application/json" });
  headers.set("x-tenant-id", options.tenantId ?? "tenant_demo");

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
) {
  const response = await request(baseUrl, `/api/v1/runs/${runId}/rounds/1/decisions`, {
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
}

function assertSerializedDoesNotContain(value: unknown, forbiddenFields: string[]): void {
  const serialized = JSON.stringify(value);

  for (const forbidden of forbiddenFields) {
    expect(serialized).not.toContain(forbidden);
  }
}

describe("Course Delivery Productization V1", () => {
  it("formalizes blueprint, idempotent state gates, audit evidence and learning evidence", async () => {
    const { baseUrl, releaseCandidate, server, store } = await startServerWithScenarioAsset();
    const forbiddenStudentFields = [
      "state_true",
      "replay_evidence",
      "ReplayManifest",
      "manifest_hash",
      "canonical_evidence_digest",
      "private_replay"
    ];

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const adminToken = await login(baseUrl, "admin", "admin");
      const courseResponse = await request<Course>(baseUrl, "/api/v1/courses", {
        body: { title: "Course Delivery Productization V1" },
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
        knownLimitsReference: "docs/quality/r5-r6-course-delivery-learning-evidence.md",
        parameterSet,
        pluginPackageId: scenarioPackage.plugin_package_ids[0] ?? "plugin_wellness_eldercare_v1",
        pluginVersion: releaseCandidate.compiled_record.plugin_version,
        releaseCandidate,
        scenarioPackage,
        teacherScope: "tenant_demo:course_delivery_teacher",
        runBindingReference: "pending"
      });
      expect(blueprint.synthetic_classification).toEqual([
        "LEARNING_EVIDENCE_ONLY",
        "NOT_SETTLEMENT_INPUT",
        "NOT_FORMAL_TRUTH",
        "NOT_AUTOMATIC_GRADE",
        "NOT_AI_DECISION"
      ]);
      expect(blueprint.freeze_reference).toBe(releaseCandidate.compiled_record.frozen_asset_hash);
      expect(blueprint.visibility_plan.student.can_read_private_replay).toBe(false);

      expect(() =>
        createCourseDeliveryBlueprintV1({
          approvalReference: releaseCandidate.release_candidate_id,
          course,
          knownLimitsReference: "docs/quality/r5-r6-course-delivery-learning-evidence.md",
          parameterSet: { ...parameterSet, status: "candidate" },
          pluginPackageId: scenarioPackage.plugin_package_ids[0] ?? "plugin_wellness_eldercare_v1",
          pluginVersion: releaseCandidate.compiled_record.plugin_version,
          releaseCandidate,
          scenarioPackage,
          teacherScope: "tenant_demo:course_delivery_teacher",
          runBindingReference: "pending"
        })
      ).toThrow(/COURSE_DELIVERY_PARAMETER_NOT_APPROVED/);

      const publishCourse = await request<Course>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/publish`,
        {
          method: "POST",
          requestId: "req_course_publish_once",
          token: teacherToken
        }
      );
      expect(publishCourse.status).toBe(200);
      const publishCourseAgain = await request<Course>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/publish`,
        {
          method: "POST",
          requestId: "req_course_publish_twice",
          token: teacherToken
        }
      );
      expect(publishCourseAgain.status).toBe(200);
      expect(store.auditLogs.filter((log) => log.action === "course.publish")).toHaveLength(1);

      const alpha = await createLearnerAndTeam(
        baseUrl,
        adminToken,
        teacherToken,
        course.course_id,
        "student_course_product_alpha",
        "Course Product Alpha"
      );
      const beta = await createLearnerAndTeam(
        baseUrl,
        adminToken,
        teacherToken,
        course.course_id,
        "student_course_product_beta",
        "Course Product Beta"
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
      expect(runBindingEvidence.mutation_allowed).toBe(false);
      expect(runBindingEvidence.seed).toBe(run.seed);

      const startResponse = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/start`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(startResponse.status).toBe(200);
      await submitDecision(
        baseUrl,
        alpha.token,
        run.run_id,
        alpha.team.team_id,
        "Alpha commits to high service reliability."
      );
      await submitDecision(
        baseUrl,
        beta.token,
        run.run_id,
        beta.team.team_id,
        "Beta commits to demand resilience."
      );

      const lockResponse = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        {
          method: "POST",
          requestId: "req_round_lock_once",
          token: teacherToken
        }
      );
      expect(lockResponse.status).toBe(200);
      const lockResponseAgain = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        {
          method: "POST",
          requestId: "req_round_lock_twice",
          token: teacherToken
        }
      );
      expect(lockResponseAgain.status).toBe(200);
      expect(lockResponseAgain.body.data.decision_batch_id).toBe(
        lockResponse.body.data.decision_batch_id
      );
      expect(store.auditLogs.filter((log) => log.action === "round.lock")).toHaveLength(1);

      const lockedSubmit = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: VALID_DECISION_PAYLOAD,
            team_id: alpha.team.team_id
          },
          method: "POST",
          token: alpha.token
        }
      );
      expect(lockedSubmit.status).toBe(409);
      expect(lockedSubmit.body.code).toBe("ROUND-409-002");
      assertSerializedDoesNotContain(lockedSubmit.body, [beta.team.team_id, beta.user.user_id]);

      const settlementResponse = await request<SettlementResult>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(settlementResponse.status).toBe(200);
      expect(settlementResponse.headers.get("x-simwar-settlement-outcome")).toBe("committed");
      const repeatedSettlement = await request<SettlementResult>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          token: teacherToken
        }
      );
      expect(repeatedSettlement.status).toBe(200);
      expect(repeatedSettlement.headers.get("x-simwar-settlement-outcome")).toBe("reused");
      expect(store.auditLogs.filter((log) => log.action === "round.settle_requested")).toHaveLength(
        1
      );

      const publishRound = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST",
          requestId: "req_round_publish_once",
          token: teacherToken
        }
      );
      expect(publishRound.status).toBe(200);
      const publishRoundAgain = await request<Round>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST",
          requestId: "req_round_publish_twice",
          token: teacherToken
        }
      );
      expect(publishRoundAgain.status).toBe(200);
      expect(store.auditLogs.filter((log) => log.action === "round.publish")).toHaveLength(1);

      const studentResult = await request<PublicResultView>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        { token: alpha.token }
      );
      expect(studentResult.status).toBe(200);
      const feedback = buildCourseDeliveryThreePartFeedbackV1({
        deterministicNextStep:
          "Review capacity, service budget and cash buffer before the next round.",
        scenarioObservation: "Approved public scenario signal only.",
        studentResult: studentResult.body.data
      });
      expect(feedback.what_happened.result_count).toBe(1);
      expect(feedback.why_it_happened.private_trace_included).toBe(false);
      expect(feedback.next_step_suggestion.advisory_only).toBe(true);
      assertSerializedDoesNotContain(feedback, forbiddenStudentFields);

      const ledger = createCourseDeliveryLearningEvidenceLedgerV1({
        blueprint,
        feedback,
        replaySourceResultId: settlementResponse.body.data.settlement_result_id,
        runBindingEvidence,
        shadowArenaPublicView: {
          cases: [],
          note: "shadow arena public evidence is generated separately and remains non-overwriting"
        },
        teacherEvidence: {
          replay_status: "matched",
          scenario_visibility: "teacher_authorized_scenario_factory"
        }
      });
      expect(ledger.classification).toEqual(blueprint.synthetic_classification);
      expect(ledger.formal_truth_write).toBe(false);
      expect(ledger.excluded_from_truth_hash).toBe(true);
      assertSerializedDoesNotContain(ledger, forbiddenStudentFields);

      const stateEvidence = summarizeCourseDeliveryStateMachineEvidenceV1(store.auditLogs);
      expect(stateEvidence.transitions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "course.publish",
            from_state: "draft",
            to_state: "published"
          }),
          expect.objectContaining({ action: "round.lock", from_state: "open", to_state: "locked" }),
          expect.objectContaining({
            action: "round.publish",
            from_state: "settled",
            to_state: "published"
          })
        ])
      );
      expect(stateEvidence.duplicate_side_effects_detected).toBe(false);
      expect(COURSE_DELIVERY_API_PERMISSION_MATRIX_V1).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            operation: "Round Lock",
            forbidden_callers: expect.arrayContaining(["student", "cross_tenant_actor"])
          }),
          expect.objectContaining({
            operation: "Learning Evidence Read",
            explicit_non_proof: "not_formal_truth_or_automatic_grade"
          })
        ])
      );
    } finally {
      await stopServer(server);
    }
  });
});
