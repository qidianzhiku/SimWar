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
  W4CanonicalStrategicDecision,
  W4OfficialOutcome,
  W4StateRef
} from "@simwar/shared-contracts";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";
import { createW4DecisionPayloadDigest } from "../../services/api/src/w4-enterprise-state";

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

function seedFixture(store: SimWarStore, officialScore = 80): void {
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
          score: officialScore,
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
          score: officialScore,
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
    decision_id: "w4_decision_w3_endpoint",
    decision_payload_digest: "",
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
  const w4DecisionPayload: W4CanonicalStrategicDecision["payload"] = {
    rationale: "W3 endpoint fixture W4 admission",
    lead_time_rounds: 0,
    reversible: false,
    dependencies: [],
    kpi_hypothesis: "bounded official consequence join",
    capital_action_kind: "debt",
    principal: capitalAction.principal,
    term_rounds: capitalAction.term_rounds,
    rate_or_cost_bps: capitalAction.rate_or_cost_bps,
    cost_source: capitalAction.cost_source,
    covenant_min_cash: capitalAction.covenant_min_cash,
    fees: capitalAction.fees,
    obligation: capitalAction.obligation
  };
  const w4Decision: W4CanonicalStrategicDecision = {
    decision_id: capitalAction.decision_id,
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    round_id: roundId,
    round_no: 1,
    team_id: teamId,
    kind: "capital_action",
    version: 1,
    status: "canonical",
    payload: w4DecisionPayload,
    admission: {
      policy: "ROLE_WORKFLOW_REQUIRED",
      authority: "formal_run_runtime_binding",
      canonical_decision_id: "decision_w3_endpoint",
      merge_commit_id: "merge_w3_endpoint",
      team_confirmation_id: "confirmation_w3_endpoint",
      decision_payload_digest: createW4DecisionPayloadDigest("capital_action", w4DecisionPayload)
    }
  };
  capitalAction.decision_payload_digest = w4Decision.admission.decision_payload_digest;
  store.w4.decisions.push(w4Decision);
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
      decision_ids: [capitalAction.decision_id],
      decision_payload_bindings: [
        {
          decision_id: capitalAction.decision_id,
          decision_payload_digest: capitalAction.decision_payload_digest
        }
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
    source_ref: evidenceRef,
    target_ref: eventRef
  };
  store.evidenceArtifacts.push(artifact);
  store.evidenceProvenanceEdges.push(edge);
  store.teacherConfirmationVersions.push(confirmation);
}

async function startServer(
  officialScore = 80
): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  seedFixture(store, officialScore);
  store.studentRoleAssignments.push({
    assignment_id: "assignment_w3_endpoint",
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    user_id: "usr_student",
    role_key: "CEO",
    role_template_id: "role_template_ceo",
    status: "active",
    source: "teacher_assigned",
    assigned_by: "usr_teacher",
    assigned_at: "2026-08-18T00:00:00.000Z"
  });
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
  it.each([80, 37.25])(
    "reads public score %s losslessly through selection, Student GET and reflection",
    async (officialScore) => {
      const { baseUrl, server, store } = await startServer(officialScore);
      seedLearningEvidence(store);
      store.teacherConfirmationVersions[0] = {
        ...store.teacherConfirmationVersions[0]!,
        context: {
          ...store.teacherConfirmationVersions[0]!.context,
          round_id: roundId,
          round_no: 1
        }
      };
      store.evidenceArtifacts[0] = {
        ...store.evidenceArtifacts[0]!,
        context: { ...store.evidenceArtifacts[0]!.context, round_id: roundId, round_no: 1 }
      };
      try {
        const teacherToken = await login(baseUrl, "teacher");
        const studentToken = await login(baseUrl, "student");
        const truthBefore = JSON.stringify([
          store.decisions,
          store.settlementResults,
          store.rounds
        ]);
        const context = commandContext();
        const selected = await request<W3OfficialConsequenceResponse>(
          baseUrl,
          "/api/v1/bff/teacher/w3/evidence-selection",
          {
            token: teacherToken,
            method: "POST",
            body: {
              context,
              evidence_refs: [store.evidenceArtifacts[0]!.artifact_ref],
              idempotency_key: `selection-public-score-${officialScore}`
            }
          }
        );
        expect(selected.status).toBe(201);
        expect(selected.body.data.record.official_result.score).toBe(officialScore);
        expect(selected.body.data.record.learning.evidence_selection_status).toBe("SELECTED");
        const get = await request<W3OfficialConsequenceResponse>(
          baseUrl,
          `/api/v1/bff/student/w3/consequence?${contextQuery}`,
          { token: studentToken }
        );
        expect(get.status).toBe(200);
        expect(get.body.data.record.official_result.score).toBe(officialScore);
        expect(get.body.data.record.official_result.rank).toBe(1);
        expect(get.body.data.record.context.round_no).toBe(1);
        const reflected = await request<W3OfficialConsequenceResponse>(
          baseUrl,
          "/api/v1/bff/student/w3/reflection",
          {
            token: studentToken,
            method: "POST",
            body: {
              context,
              idempotency_key: `reflection-public-score-${officialScore}`,
              prompt_id: "w3-reflection-off-v1",
              response: "A bounded public-score observation."
            }
          }
        );
        expect(reflected.status).toBe(201);
        expect(reflected.body.data.record.official_result.score).toBe(officialScore);
        expect(JSON.stringify([store.decisions, store.settlementResults, store.rounds])).toBe(
          truthBefore
        );
        expect(JSON.stringify(get.body.data)).not.toContain("state_true");
        expect(JSON.stringify(get.body.data)).not.toContain("raw_private_payload");
      } finally {
        await stopServer(server);
      }
    }
  );

  it.each(["wrong role", "inactive", "missing"])(
    "rejects native Student GET and POST with %s assignment without learning writes",
    async (mode) => {
      const { baseUrl, server, store } = await startServer();
      if (mode === "inactive") store.studentRoleAssignments[0]!.status = "inactive";
      if (mode === "missing") store.studentRoleAssignments.splice(0);
      const context = {
        ...commandContext(),
        ...(mode === "wrong role" ? { role_key: "CFO" } : {})
      };
      try {
        const token = await login(baseUrl, "student");
        const before = JSON.stringify([store.auditLogs, store.decisions, store.settlementResults]);
        const get = await request(
          baseUrl,
          `/api/v1/bff/student/w3/consequence?${new URLSearchParams(
            Object.entries(context).map(([key, value]) => [key, String(value)])
          )}`,
          { token }
        );
        expect(get.status).toBe(403);
        expect(get.body.code).toBe("W3_ACTOR_SCOPE_VIOLATION");
        expect(get.body.data).toBeUndefined();
        const post = await request(baseUrl, "/api/v1/bff/student/w3/reflection", {
          method: "POST",
          token,
          body: {
            context,
            idempotency_key: "unauthorized-role",
            prompt_id: "prompt",
            response: "Do not write this."
          }
        });
        expect(post.status).toBe(403);
        expect(post.body.data).toBeUndefined();
        expect(JSON.stringify([store.auditLogs, store.decisions, store.settlementResults])).toBe(
          before
        );
      } finally {
        await stopServer(server);
      }
    }
  );

  it("rejects unsupported native activity before reflection writes", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const token = await login(baseUrl, "student");
      const before = JSON.stringify(store.auditLogs);
      const get = await request(
        baseUrl,
        `/api/v1/bff/student/w3/consequence?${contextQuery.replace("activity_consequence", "activity_other")}`,
        { token }
      );
      expect(get.status).toBe(422);
      const post = await request(baseUrl, "/api/v1/bff/student/w3/reflection", {
        method: "POST",
        token,
        body: {
          context: { ...commandContext(), activity_id: "activity_other" },
          idempotency_key: "other-activity",
          prompt_id: "prompt",
          response: "Do not write this."
        }
      });
      expect(post.status).toBe(422);
      expect(JSON.stringify(store.auditLogs)).toBe(before);
    } finally {
      await stopServer(server);
    }
  });
  it("rejects a supplied foreign tenant instead of silently rebinding it to the authenticated tenant", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const token = await login(baseUrl, "student");
      const before = JSON.stringify(store.auditLogs);
      const get = await request(
        baseUrl,
        `/api/v1/bff/student/w3/consequence?${contextQuery}&tenant_id=tenant_other`,
        { token }
      );
      expect(get.status).toBe(403);
      const post = await request(baseUrl, "/api/v1/bff/student/w3/reflection", {
        method: "POST",
        token,
        body: {
          context: { ...commandContext(), tenant_id: "tenant_other" },
          idempotency_key: "foreign-tenant",
          prompt_id: "prompt",
          response: "Do not write this."
        }
      });
      expect(post.status).toBe(403);
      expect(JSON.stringify(store.auditLogs)).toBe(before);
    } finally {
      await stopServer(server);
    }
  });
  it.each(["extra authority field", "string round number"])(
    "rejects malformed native POST context with %s",
    async (mode) => {
      const { baseUrl, server, store } = await startServer();
      try {
        const token = await login(baseUrl, "student");
        const before = JSON.stringify(store.auditLogs);
        const context = {
          ...commandContext(),
          ...(mode === "extra authority field" ? { actor_id: "another-actor" } : { round_no: "1" })
        };
        const post = await request(baseUrl, "/api/v1/bff/student/w3/reflection", {
          method: "POST",
          token,
          body: {
            context,
            idempotency_key: "malformed-context",
            prompt_id: "prompt",
            response: "Do not write this."
          }
        });
        expect(post.status).toBe(422);
        expect(post.body.data).toBeUndefined();
        expect(JSON.stringify(store.auditLogs)).toBe(before);
      } finally {
        await stopServer(server);
      }
    }
  );

  it.each(["role_key", "activity_id", "round_id", "missing context"])(
    "does not project old reflection, counterfactual or selection audits with different %s",
    async (field) => {
      const { baseUrl, server, store } = await startServer();
      const context = { ...commandContext(), tenant_id: tenantId };
      const wrong =
        field === "missing context" ? undefined : { ...context, [field]: "other_identity" };
      seedLearningEvidence(store);
      store.evidenceArtifacts[0] = {
        ...store.evidenceArtifacts[0]!,
        context: { ...store.evidenceArtifacts[0]!.context, round_id: roundId, round_no: 1 }
      };
      store.auditLogs.push({
        action: "w3.reflection.save",
        actor_id: "usr_student",
        actor_role: "learner",
        audit_id: "old_wrong_reflection",
        created_at: "2026-08-18T00:00:00.000Z",
        request_id: "old",
        resource_id: "old",
        resource_type: "w3_official_consequence",
        tenant_id: tenantId,
        after: {
          record_id: `w3_consequence_${runId}_1_${teamId}`,
          context: wrong,
          reflection: {
            ai_used: false,
            advisory_only: true,
            reflection_id: "old",
            prompt_id: "prompt",
            response: "wrong-context-content",
            status: "SUBMITTED"
          }
        }
      });
      store.auditLogs.push(
        {
          action: "w3.counterfactual.create",
          actor_id: "usr_teacher",
          actor_role: "teacher",
          audit_id: "old_wrong_counterfactual",
          created_at: "2026-08-18T00:00:00.000Z",
          request_id: "old",
          resource_id: "old_cf",
          resource_type: "w3_official_consequence",
          tenant_id: tenantId,
          after: {
            record_id: `w3_consequence_${runId}_1_${teamId}`,
            context: wrong,
            counterfactual: {
              causal_label: "model_conditioned_association",
              changed_field: "marketing_budget",
              changed_value_digest: "a".repeat(64),
              original_value_digest: "b".repeat(64),
              comparison: {
                official_score: 80,
                counterfactual_score: 81,
                score_delta: 1,
                official_rank: 1,
                counterfactual_rank: 1,
                rank_delta: 0
              },
              counterfactual_id: "old_cf",
              exact_context_ref: {
                discriminator: "exact_ref",
                resource_type: "round",
                resource_id: roundId,
                tenant_id: tenantId,
                version: "1.0.0",
                content_digest: "c".repeat(64)
              },
              official: false
            }
          }
        },
        {
          action: "w3.evidence.select",
          actor_id: "usr_teacher",
          actor_role: "teacher",
          audit_id: "old_wrong_selection",
          created_at: "2026-08-18T00:00:00.000Z",
          request_id: "old",
          resource_id: "old_sel",
          resource_type: "w3_official_consequence",
          tenant_id: tenantId,
          after: {
            record_id: `w3_consequence_${runId}_1_${teamId}`,
            context: wrong,
            selection: {
              status: "SELECTED",
              selection_id: "old_sel",
              evidence_refs: [store.evidenceArtifacts[0]!.artifact_ref]
            }
          }
        }
      );
      try {
        const token = await login(baseUrl, "student");
        const old = JSON.stringify(
          store.auditLogs.find((audit) => audit.audit_id === "old_wrong_reflection")
        );
        const get = await request<W3OfficialConsequenceResponse>(
          baseUrl,
          `/api/v1/bff/student/w3/consequence?${contextQuery}`,
          { token }
        );
        expect(get.status).toBe(200);
        expect(get.body.data.record.reflection).toBeUndefined();
        expect(get.body.data.record.counterfactual).toBeUndefined();
        expect(get.body.data.record.learning.evidence_selection_status).toBe("NOT_SELECTED");
        expect(JSON.stringify(get.body)).not.toContain("wrong-context-content");
        expect(
          JSON.stringify(store.auditLogs.find((audit) => audit.audit_id === "old_wrong_reflection"))
        ).toBe(old);
      } finally {
        await stopServer(server);
      }
    }
  );

  const invalidEvidenceRounds: readonly {
    label: string;
    round: { round_id?: string; round_no?: number };
  }[] = [
    { label: "missing round_id", round: { round_no: 1 } },
    { label: "missing round_no", round: { round_id: roundId } },
    { label: "wrong round_id", round: { round_id: "another_round", round_no: 1 } },
    { label: "wrong round_no", round: { round_id: roundId, round_no: 2 } }
  ];

  it.each(invalidEvidenceRounds)("rejects new D2 selection with $label", async ({ round }) => {
    const { baseUrl, server, store } = await startServer();
    seedLearningEvidence(store);
    store.evidenceArtifacts[0] = {
      ...store.evidenceArtifacts[0]!,
      context: { ...store.evidenceArtifacts[0]!.context, ...round }
    };
    try {
      const token = await login(baseUrl, "teacher");
      const before = JSON.stringify([store.auditLogs, store.decisions, store.settlementResults]);
      const selected = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        "/api/v1/bff/teacher/w3/evidence-selection",
        {
          body: {
            context: commandContext(),
            evidence_refs: [store.evidenceArtifacts[0]!.artifact_ref],
            idempotency_key: "strict-selection"
          },
          method: "POST",
          token
        }
      );
      expect(selected.status).toBe(404);
      expect(selected.body.code).toBe("W3_EVIDENCE_NOT_FOUND");
      expect(JSON.stringify([store.auditLogs, store.decisions, store.settlementResults])).toBe(
        before
      );
    } finally {
      await stopServer(server);
    }
  });

  it.each([
    "wrong tenant",
    "wrong resource type",
    "wrong version",
    "wrong digest",
    "missing artifact"
  ])("rejects selected evidence with %s", async (mode) => {
    const { baseUrl, server, store } = await startServer();
    seedLearningEvidence(store);
    store.evidenceArtifacts[0] = {
      ...store.evidenceArtifacts[0]!,
      context: { ...store.evidenceArtifacts[0]!.context, round_id: roundId, round_no: 1 }
    };
    const ref = {
      ...store.evidenceArtifacts[0]!.artifact_ref,
      ...(mode === "wrong tenant" ? { tenant_id: "tenant_other" } : {}),
      ...(mode === "wrong resource type" ? { resource_type: "round" } : {}),
      ...(mode === "wrong version" ? { version: "9.0.0" } : {}),
      ...(mode === "wrong digest" ? { content_digest: "f".repeat(64) } : {})
    };
    if (mode === "missing artifact") {
      // Isolate selection admission from a separate D4 report dependency failure.
      store.teacherConfirmationVersions.splice(0);
      store.evidenceArtifacts.splice(0);
    }
    try {
      const token = await login(baseUrl, "teacher");
      const selected = await request(baseUrl, "/api/v1/bff/teacher/w3/evidence-selection", {
        body: {
          context: commandContext(),
          evidence_refs: [ref],
          idempotency_key: "metadata-selection"
        },
        method: "POST",
        token
      });
      expect(selected.status).toBe(mode === "wrong tenant" ? 422 : 404);
      expect(store.auditLogs.filter((audit) => audit.action === "w3.evidence.select")).toHaveLength(
        0
      );
    } finally {
      await stopServer(server);
    }
  });

  it.each(["null ref", "private extra field"])(
    "rejects malformed selection input %s before audit writes",
    async (mode) => {
      const { baseUrl, server, store } = await startServer();
      seedLearningEvidence(store);
      const ref =
        mode === "null ref"
          ? null
          : {
              ...store.evidenceArtifacts[0]!.artifact_ref,
              private_payload: "must-not-be-projected"
            };
      try {
        const token = await login(baseUrl, "teacher");
        const result = await request(baseUrl, "/api/v1/bff/teacher/w3/evidence-selection", {
          body: {
            context: commandContext(),
            evidence_refs: [ref],
            idempotency_key: "malformed-selection"
          },
          method: "POST",
          token
        });
        expect(result.status).toBe(422);
        expect(JSON.stringify(result.body)).not.toContain("must-not-be-projected");
        expect(
          store.auditLogs.filter((audit) => audit.action === "w3.evidence.select")
        ).toHaveLength(0);
      } finally {
        await stopServer(server);
      }
    }
  );

  it.each(invalidEvidenceRounds)(
    "keeps old $label selection readonly but unqualified on exact reads",
    async ({ round }) => {
      const { baseUrl, server, store } = await startServer();
      seedLearningEvidence(store);
      store.teacherConfirmationVersions[0] = {
        ...store.teacherConfirmationVersions[0]!,
        context: {
          ...store.teacherConfirmationVersions[0]!.context,
          round_id: roundId,
          round_no: 1
        }
      };
      store.evidenceArtifacts[0] = {
        ...store.evidenceArtifacts[0]!,
        context: { ...store.evidenceArtifacts[0]!.context, ...round }
      };
      try {
        const teacher = await login(baseUrl, "teacher");
        const student = await login(baseUrl, "student");
        const reflection = await request<W3OfficialConsequenceResponse>(
          baseUrl,
          "/api/v1/bff/student/w3/reflection",
          {
            body: {
              context: commandContext(),
              idempotency_key: "old-selection-reflection",
              prompt_id: "prompt",
              response: "An exact-round reflection."
            },
            method: "POST",
            token: student
          }
        );
        expect(reflection.status).toBe(201);
        const recordId = reflection.body.data.record.record_id;
        store.auditLogs.push({
          action: "w3.evidence.select",
          actor_id: "usr_teacher",
          actor_role: "teacher",
          audit_id: "old_selection_audit",
          created_at: "2026-08-18T00:00:00.000Z",
          request_id: "old_selection_request",
          resource_id: "old_selection",
          resource_type: "w3_official_consequence",
          tenant_id: tenantId,
          after: {
            context: { ...commandContext(), tenant_id: tenantId },
            record_id: recordId,
            selection: {
              selection_id: "old_selection",
              status: "SELECTED",
              evidence_refs: [store.evidenceArtifacts[0]!.artifact_ref]
            }
          }
        });
        const oldAudit = JSON.stringify(
          store.auditLogs.find((audit) => audit.audit_id === "old_selection_audit")
        );
        const legacy = await request<W3OfficialConsequenceResponse>(
          baseUrl,
          `/api/v1/bff/teacher/w3/consequence?${contextQuery}`,
          { token: teacher }
        );
        expect(legacy.body.data.record.learning.evidence_selection_status).toBe("SELECTED");
        const exact = await request<W3OfficialConsequenceResponse>(
          baseUrl,
          `/api/v1/bff/student/w3/consequence?${contextQuery}`,
          { token: student }
        );
        expect(exact.status).toBe(200);
        expect(exact.body.data.record.learning.evidence_selection_status).toBe("NOT_SELECTED");
        const hypothesis = await request<W3OfficialConsequenceResponse>(
          baseUrl,
          "/api/v1/bff/teacher/w3/next-round-hypothesis",
          { body: { context: commandContext() }, method: "POST", token: teacher }
        );
        expect(hypothesis.status).toBe(200);
        expect(hypothesis.body.data.record.learning.next_round_hypothesis_status).toBe("BLOCKED");
        expect(hypothesis.body.data.record.next_round_hypothesis).toBeUndefined();
        expect(
          JSON.stringify(store.auditLogs.find((audit) => audit.audit_id === "old_selection_audit"))
        ).toBe(oldAudit);
      } finally {
        await stopServer(server);
      }
    }
  );

  it("keeps unbound D3/D4 out of native Student GET and POST while retaining Teacher legacy reads", async () => {
    const { baseUrl, server, store } = await startServer();
    seedLearningEvidence(store);
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const teacher = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        `/api/v1/bff/teacher/w3/consequence?${contextQuery}`,
        { token: teacherToken }
      );
      expect(teacher.body.data.record.learning.teacher_confirmation_status).toBe("CONFIRMED");
      expect(teacher.body.data.record.learning.student_learning_report_ref).toBeDefined();
      const beforeTruth = JSON.stringify([store.decisions, store.settlementResults]);
      const student = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        `/api/v1/bff/student/w3/consequence?${contextQuery}`,
        { token: studentToken }
      );
      expect(student.status).toBe(200);
      expect(student.body.data.record.learning.teacher_confirmation_status).toBe("MISSING");
      expect(student.body.data.record.learning.student_learning_report_ref).toBeUndefined();
      const body = {
        context: commandContext(),
        idempotency_key: "native-exact-reflection",
        prompt_id: "w3-reflection-off-v1",
        response: "An exact-round reflection."
      };
      const saved = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        "/api/v1/bff/student/w3/reflection",
        { body, method: "POST", token: studentToken }
      );
      expect(saved.status).toBe(201);
      expect(saved.body.data.record.reflection?.status).toBe("SUBMITTED");
      expect(saved.body.data.record.learning.teacher_confirmation_status).toBe("MISSING");
      expect(saved.body.data.record.learning.student_learning_report_ref).toBeUndefined();
      const again = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        "/api/v1/bff/student/w3/reflection",
        { body, method: "POST", token: studentToken }
      );
      expect(again.body.data.record.reflection).toEqual(saved.body.data.record.reflection);
      expect(store.auditLogs.filter((audit) => audit.action === "w3.reflection.save")).toHaveLength(
        1
      );
      expect(JSON.stringify([store.decisions, store.settlementResults])).toBe(beforeTruth);
    } finally {
      await stopServer(server);
    }
  });

  it("does not qualify a hypothesis with unbound D3 or expose a legacy ready audit on exact Student reads", async () => {
    const { baseUrl, server, store } = await startServer();
    seedLearningEvidence(store);
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const context = commandContext();
      await request(baseUrl, "/api/v1/bff/student/w3/reflection", {
        body: {
          context,
          idempotency_key: "hyp-reflection",
          prompt_id: "prompt",
          response: "Bounded observation."
        },
        method: "POST",
        token: studentToken
      });
      await request(baseUrl, "/api/v1/bff/teacher/w3/evidence-selection", {
        body: {
          context,
          idempotency_key: "hyp-selection",
          evidence_refs: [store.evidenceArtifacts[0]!.artifact_ref]
        },
        method: "POST",
        token: teacherToken
      });
      const blocked = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        "/api/v1/bff/teacher/w3/next-round-hypothesis",
        { body: { context }, method: "POST", token: teacherToken }
      );
      expect(blocked.status).toBe(200);
      expect(blocked.body.data.record.learning.next_round_hypothesis_status).toBe("BLOCKED");
      expect(
        store.auditLogs.filter((audit) => audit.action === "w3.next_round_hypothesis.ready")
      ).toHaveLength(0);
      // An old learning audit is retained, not migrated into exact evidence.
      store.auditLogs.push({
        action: "w3.next_round_hypothesis.ready",
        actor_id: "usr_teacher",
        actor_role: "teacher",
        audit_id: "legacy_hypothesis",
        created_at: "2026-08-18T00:00:00.000Z",
        request_id: "legacy_request",
        resource_id: blocked.body.data.record.record_id,
        resource_type: "w3_official_consequence",
        tenant_id: tenantId,
        after: {
          record_id: blocked.body.data.record.record_id,
          context: { ...context, tenant_id: tenantId },
          hypothesis: {
            status: "READY",
            basis: "legacy",
            hypothesis: "Legacy unqualified hypothesis"
          }
        }
      });
      const exact = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        `/api/v1/bff/student/w3/consequence?${contextQuery}`,
        { token: studentToken }
      );
      expect(exact.body.data.record.learning.next_round_hypothesis_status).toBe("BLOCKED");
      expect(exact.body.data.record.next_round_hypothesis).toBeUndefined();
      expect(store.auditLogs.some((audit) => audit.audit_id === "legacy_hypothesis")).toBe(true);
      store.teacherConfirmationVersions[0] = {
        ...store.teacherConfirmationVersions[0]!,
        context: {
          ...store.teacherConfirmationVersions[0]!.context,
          round_id: roundId,
          round_no: 1
        }
      };
      store.evidenceArtifacts[0] = {
        ...store.evidenceArtifacts[0]!,
        context: { ...store.evidenceArtifacts[0]!.context, round_id: roundId, round_no: 1 }
      };
      const nowBound = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        `/api/v1/bff/student/w3/consequence?${contextQuery}`,
        { token: studentToken }
      );
      expect(nowBound.body.data.record.learning.teacher_confirmation_status).toBe("CONFIRMED");
      expect(nowBound.body.data.record.next_round_hypothesis).toBeUndefined();
      expect(nowBound.body.data.record.learning.next_round_hypothesis_status).toBe("BLOCKED");
    } finally {
      await stopServer(server);
    }
  });

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
    store.teacherConfirmationVersions[0] = {
      ...store.teacherConfirmationVersions[0]!,
      context: { ...store.teacherConfirmationVersions[0]!.context, round_id: roundId, round_no: 1 }
    };
    store.evidenceArtifacts[0] = {
      ...store.evidenceArtifacts[0]!,
      context: { ...store.evidenceArtifacts[0]!.context, round_id: roundId, round_no: 1 }
    };
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
      const retainedAudits = JSON.stringify(store.auditLogs);
      store.evidenceArtifacts.splice(0);
      const noLongerBound = await request<W3OfficialConsequenceResponse>(
        baseUrl,
        `/api/v1/bff/student/w3/consequence?${contextQuery}`,
        { token: studentToken }
      );
      expect(noLongerBound.status).toBe(409);
      expect(noLongerBound.body.code).toBe("W3_OUTPUT_INVALID");
      expect(noLongerBound.body.message).toBe("W3 official consequence request rejected");
      expect(noLongerBound.body.data).toBeUndefined();
      expect(JSON.stringify(noLongerBound.body)).not.toContain("D4_REPORT_NOT_AVAILABLE");
      expect(JSON.stringify(store.auditLogs)).toBe(retainedAudits);
    } finally {
      await stopServer(server);
    }
  });
});
