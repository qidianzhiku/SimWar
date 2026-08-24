import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  D2EvidenceArtifactVersion,
  D2ProvenanceEdge,
  Decision,
  SettlementResult,
  TeacherConfirmationVersion,
  W3OfficialConsequenceResponse,
  W4CapitalAction,
  W4OfficialOutcome,
  W4StateRef
} from "@simwar/shared-contracts";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const tenantId = "tenant_demo";
const courseId = "course_demo";
const teamId = "team_alpha";
const runId = "run_w3_endpoint";
const roundId = "round_w3_endpoint_1";

interface RequestOptions {
  body?: unknown;
  method?: string;
  token?: string;
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {}
): Promise<{ body: ApiEnvelope<T>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": tenantId
  });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? "GET"
  });
  return { body: (await response.json()) as ApiEnvelope<T>, status: response.status };
}

async function login(baseUrl: string, username: "teacher" | "student"): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password: username, username },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

function seedFixture(store: SimWarStore): void {
  const course = store.courses.find((candidate) => candidate.course_id === courseId);
  const team = store.teams.find((candidate) => candidate.team_id === teamId);
  if (!course || !team) throw new Error("W3 endpoint fixture requires default course and team");
  store.runs.push({
    course_id: courseId,
    parameter_set_id: course.parameter_set_id,
    run_id: runId,
    scenario_package_id: course.scenario_package_id,
    seed: 2031,
    status: "active",
    tenant_id: tenantId
  });
  store.rounds.push({
    round_id: roundId,
    round_no: 1,
    run_id: runId,
    status: "published",
    tenant_id: tenantId
  });
  store.decisions.push({
    canonical_source: "role_merge_commit",
    decision_id: "decision_w3_endpoint",
    merge_commit_id: "merge_w3_endpoint",
    payload: {
      capacity_plan: "hold",
      cash_buffer_target: 0.2,
      marketing_budget: 100000,
      pricing: { base_price: 12000 },
      service_quality_budget: 100000,
      strategy_statement: "W3 endpoint fixture decision"
    },
    round_id: roundId,
    round_no: 1,
    run_id: runId,
    status: "submitted",
    submitted_by: team.captain_user_id,
    team_confirmation_id: "confirmation_w3_endpoint",
    team_id: teamId,
    tenant_id: tenantId,
    validation_report: [],
    version: 1
  });
  const result: SettlementResult = {
    parameter_set_id: course.parameter_set_id,
    replay_hash: "c".repeat(64),
    round_id: roundId,
    round_no: 1,
    run_id: runId,
    scenario_package_id: course.scenario_package_id,
    settlement_result_id: "settlement_w3_endpoint",
    team_results: [
      {
        state_est: {
          explanation: "bounded endpoint consequence",
          next_round_risk: "balanced",
          recommended_focus: "test one change"
        },
        state_obs: {
          demand_band: "medium",
          profit_band: "healthy",
          rank: 1,
          revenue: 180000,
          score: 80,
          served_demand: 100
        },
        state_true: {
          cash_flow: 40000,
          cost: 140000,
          demand: 110,
          market_share: 0.4,
          profit: 40000,
          rank: 1,
          revenue: 180000,
          score: 80,
          served_demand: 100,
          settlement_status: "settled"
        },
        team_id: teamId,
        team_name: team.name
      }
    ],
    tenant_id: tenantId
  };
  store.settlementResults.push(result);
  const bindingDigest = "a".repeat(64);
  const decisionPayloadDigest = "b".repeat(64);
  const stateRef: W4StateRef = {
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    round_id: roundId,
    enterprise_state_id: "state_w3_endpoint",
    version: 1,
    state_digest: "d".repeat(64)
  };
  const capitalAction: W4CapitalAction = {
    capital_action_id: "capital_action_w3_endpoint",
    decision_id: "decision_w3_endpoint",
    decision_payload_digest: decisionPayloadDigest,
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    kind: "debt",
    status: "active",
    principal: 250,
    term_rounds: 2,
    rate_or_cost_bps: 550,
    cost_source: `operating-world:${bindingDigest}`,
    covenant_min_cash: 500,
    fees: 5,
    obligation: "term_debt",
    project_entry_id: null,
    initiative_id: null,
    policy_seam_id: null,
    created_round_no: 1,
    effective_round_no: 1,
    maturity_round_no: 3
  };
  const outcome: W4OfficialOutcome = {
    official_outcome_id: "w4_outcome_w3_endpoint",
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    round_id: roundId,
    round_no: 1,
    opening_state_ref: stateRef,
    closing_state_ref: { ...stateRef, enterprise_state_id: "state_w3_endpoint_closed" },
    commitment_ids: [],
    persistent_effect_ids: [],
    reexecuted_decision_ids: [],
    replay_input_manifest: {
      manifest_id: "manifest_w3_endpoint",
      tenant_id: tenantId,
      course_id: courseId,
      run_id: runId,
      team_id: teamId,
      round_id: roundId,
      opening_state_ref: stateRef,
      decision_ids: ["decision_w3_endpoint"],
      decision_payload_bindings: [
        { decision_id: "decision_w3_endpoint", decision_payload_digest: decisionPayloadDigest }
      ],
      scenario_package_id: course.scenario_package_id,
      parameter_set_id: course.parameter_set_id,
      engine_id: "toy_logit_wellness_v1",
      plugin_ids: [],
      seed: 2031,
      operating_world_binding_digest: bindingDigest
    },
    settlement_digest: result.replay_hash,
    status: "official"
  };
  store.w4.capitalActions.push(capitalAction);
  store.w4.outcomes.push(outcome);
  store.auditLogs.push({
    action: "round.publish",
    actor_id: "usr_teacher",
    actor_role: "teacher",
    audit_id: "audit_w3_endpoint_publish",
    created_at: "2026-08-18T12:45:00.000Z",
    request_id: "request_w3_endpoint_publish",
    resource_id: roundId,
    resource_type: "round",
    tenant_id: tenantId
  });
}

function seedLearningEvidence(store: SimWarStore): void {
  const digest = "d".repeat(64);
  const exact = <T extends string>(resource_type: T, resource_id: string) => ({
    content_digest: digest,
    discriminator: "exact_ref" as const,
    resource_id,
    resource_type,
    tenant_id: tenantId,
    version: "1.0.0"
  });
  const coursePackageRef = exact("course_package_version", "package_w3_endpoint");
  const learningGoalRef = exact("learning_goal_version", "goal_w3_endpoint");
  const rubricRef = exact("rubric_version", "rubric_w3_endpoint");
  const evidenceRef = exact("evidence_artifact", "artifact_w3_endpoint");
  const confirmationRef = exact("teacher_confirmation_version", "confirmation_w3_endpoint");
  const eventRef = exact("role_workflow_event", "event_w3_endpoint");
  const ruleRef = exact("transformation_rule", "rule_w3_endpoint");
  const artifact: D2EvidenceArtifactVersion = {
    artifact_digest: digest,
    artifact_kind: "observation",
    artifact_ref: evidenceRef,
    captured_at: "2026-08-18T12:45:00.000Z",
    captured_by: "usr_teacher",
    context: {
      activity_id: "activity_consequence",
      course_id: courseId,
      role_key: "CEO",
      run_id: runId,
      team_id: teamId
    },
    course_package_ref: coursePackageRef,
    discriminator: "d2_evidence_artifact_version",
    idempotency_key: "artifact-w3-endpoint",
    known_limits: ["Teacher-only evidence; no Human Validation."],
    learning_goal_ref: learningGoalRef,
    rubric_ref: rubricRef,
    schema_version: "evidence-provenance.v1",
    source_event_ref: eventRef,
    transformation_rule_ref: ruleRef,
    visibility: "teacher_only"
  };
  const confirmation: TeacherConfirmationVersion = {
    audit_receipt: {
      action: "teacher_confirmation.confirm",
      actor_id: "usr_teacher",
      audit_id: "audit_w3_endpoint_confirmation",
      recorded_at: "2026-08-18T12:46:00.000Z",
      request_id: "request_w3_endpoint_confirmation"
    },
    confirmation_ref: confirmationRef,
    content_digest: digest,
    context: { course_id: courseId, role_key: "CEO", run_id: runId, team_id: teamId },
    course_package_ref: coursePackageRef,
    created_at: "2026-08-18T12:46:00.000Z",
    created_by: "usr_teacher",
    criterion_decisions: [{ criterion_id: "criterion_w3_endpoint", level_ordinal: 2 }],
    discriminator: "teacher_confirmation_version",
    evidence_refs: [evidenceRef],
    idempotency_key: "confirmation-w3-endpoint",
    known_limits: ["Human Validation is not performed."],
    learning_goal_ref: learningGoalRef,
    rubric_ref: rubricRef,
    schema_version: "teacher-confirmation.v1",
    status: "CONFIRMED",
    teacher_feedback: "Confirmed bounded evidence for the official decision story."
  };
  const edge: D2ProvenanceEdge = {
    discriminator: "d2_provenance_edge",
    relation: "derived_from",
    source_ref: eventRef,
    target_ref: evidenceRef
  };
  store.evidenceArtifacts.push(artifact);
  store.evidenceProvenanceEdges.push(edge);
  store.teacherConfirmationVersions.push(confirmation);
}

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  seedFixture(store);
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

const contextQuery =
  `activity_id=activity_consequence&course_id=${courseId}&role_key=CEO&round_id=${roundId}` +
  `&round_no=1&run_id=${runId}&team_id=${teamId}`;

function commandContext() {
  return {
    activity_id: "activity_consequence",
    course_id: courseId,
    role_key: "CEO",
    round_id: roundId,
    round_no: 1,
    run_id: runId,
    team_id: teamId
  };
}

describe("W3 official consequence BFF endpoint", () => {
  it("keeps student-safe output, published reflection, and one-change retry conflict bounded", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const settlementBefore = structuredClone(store.settlementResults[0]);
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const student = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        `/api/v1/bff/student/w3/consequence?${contextQuery}`,
        { token: studentToken }
      );
      expect(student.status).toBe(200);
      expect(student.body.data.visibility).toBe("student_safe");
      expect(JSON.stringify(student.body.data)).not.toContain("state_true");
      expect(JSON.stringify(student.body.data)).not.toContain("replay_hash");
      expect(student.body.data.record.operating_world_consequence_trace).toMatchObject({
        official_delta: "WHITELISTED_ONLY",
        source_classification: "OFFICIAL_CONSUMER_ELIGIBLE",
        writes_official_state: false,
        causal_authority: "DETERMINISTIC_SYSTEM_FACTS",
        replay_relevant_digest: "c".repeat(64)
      });
      expect(student.body.data.record.operating_world_consequence_trace).not.toHaveProperty(
        "w4_action_ref"
      );
      expect(student.body.data.record.operating_world_consequence_trace).not.toHaveProperty(
        "w4_replay_manifest_ref"
      );

      const teacher = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        `/api/v1/bff/teacher/w3/consequence?${contextQuery}`,
        { token: teacherToken }
      );
      expect(teacher.status).toBe(200);
      expect(teacher.body.data.record.operating_world_consequence_trace).toMatchObject({
        w4_action_ref: "capital_action_w3_endpoint",
        w4_replay_manifest_ref: "manifest_w3_endpoint"
      });

      const reflection = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        "/api/v1/bff/student/w3/reflection",
        {
          body: {
            context: commandContext(),
            idempotency_key: "reflection-w3-endpoint",
            prompt_id: "w3-reflection-off-v1",
            response: "The official outcome shows a bounded model association."
          },
          method: "POST",
          token: studentToken
        }
      );
      expect(reflection.status).toBe(201);
      expect(reflection.body.data.record.reflection?.ai_used).toBe(false);

      const counterfactualInput = {
        context: commandContext(),
        changed_field: "marketing_budget",
        changed_value: 120000,
        idempotency_key: "cf-w3-endpoint"
      };
      const first = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        "/api/v1/bff/teacher/w3/counterfactual",
        { body: counterfactualInput, method: "POST", token: teacherToken }
      );
      expect(first.status).toBe(200);
      const repeated = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        "/api/v1/bff/teacher/w3/counterfactual",
        { body: counterfactualInput, method: "POST", token: teacherToken }
      );
      expect(repeated.status).toBe(200);
      expect(repeated.body.data.record.counterfactual?.counterfactual_id).toBe(
        first.body.data.record.counterfactual?.counterfactual_id
      );
      const conflict = await request<ApiEnvelope<unknown>>(
        baseUrl,
        "/api/v1/bff/teacher/w3/counterfactual",
        {
          body: { ...counterfactualInput, changed_value: 130000 },
          method: "POST",
          token: teacherToken
        }
      );
      expect(conflict.status).toBe(409);
      expect(conflict.body.code).toBe("W3_COUNTERFACTUAL_CONFLICT");
      expect(store.settlementResults[0]).toEqual(settlementBefore);
    } finally {
      await stopServer(server);
    }
  });

  it("blocks student result before publication and rejects non-canonical decisions", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const studentToken = await login(baseUrl, "student");
      const round = store.rounds.find((candidate) => candidate.round_id === roundId);
      if (!round) throw new Error("round fixture missing");
      round.status = "settled";
      const unpublished = await request<ApiEnvelope<unknown>>(
        baseUrl,
        `/api/v1/bff/student/w3/consequence?${contextQuery}`,
        { token: studentToken }
      );
      expect(unpublished.status).toBe(409);
      expect(unpublished.body.code).toBe("W3_OFFICIAL_RESULT_NOT_PUBLISHED");

      const decision = store.decisions[0] as Decision;
      decision.canonical_source = "legacy_direct";
      round.status = "published";
      const nonCanonical = await request<ApiEnvelope<unknown>>(
        baseUrl,
        `/api/v1/bff/student/w3/consequence?${contextQuery}`,
        { token: studentToken }
      );
      expect(nonCanonical.status).toBe(409);
      expect(nonCanonical.body.code).toBe("W3_CANONICAL_DECISION_REQUIRED");
    } finally {
      await stopServer(server);
    }
  });

  it("reads D2 and D3 evidence into a bounded next-round hypothesis", async () => {
    const { baseUrl, server, store } = await startServer();
    seedLearningEvidence(store);
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const context = commandContext();
      const reflection = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        "/api/v1/bff/student/w3/reflection",
        {
          body: {
            context,
            idempotency_key: "reflection-w3-learning",
            prompt_id: "w3-reflection-off-v1",
            response: "The confirmed evidence supports one bounded model association."
          },
          method: "POST",
          token: studentToken
        }
      );
      expect(reflection.status).toBe(201);
      const selected = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        "/api/v1/bff/teacher/w3/evidence-selection",
        {
          body: {
            context,
            evidence_refs: [
              {
                content_digest: "d".repeat(64),
                discriminator: "exact_ref",
                resource_id: "artifact_w3_endpoint",
                resource_type: "evidence_artifact",
                tenant_id: tenantId,
                version: "1.0.0"
              }
            ],
            idempotency_key: "selection-w3-learning"
          },
          method: "POST",
          token: teacherToken
        }
      );
      expect(selected.status).toBe(201);
      expect(selected.body.data.record.learning.evidence_selection_status).toBe("SELECTED");
      expect(selected.body.data.record.learning.teacher_confirmation_status).toBe("CONFIRMED");
      expect(selected.body.data.record.learning.student_learning_report_ref).toBeDefined();

      const hypothesis = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        "/api/v1/bff/teacher/w3/next-round-hypothesis",
        { body: { context }, method: "POST", token: teacherToken }
      );
      expect(hypothesis.status).toBe(200);
      expect(hypothesis.body.data.record.next_round_hypothesis?.status).toBe("READY");
    } finally {
      await stopServer(server);
    }
  });
});
