import { once } from "node:events";
import { request as nodeRequest } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  SettlementResult,
  W4CapitalAction,
  W4CanonicalStrategicDecision,
  W4OfficialOutcome,
  W4StateRef
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createW4DecisionPayloadDigest } from "../../services/api/src/w4-enterprise-state";
import {
  createP1Store,
  DEFAULT_TENANT_ID,
  OTHER_TENANT_ID,
  type SimWarStore
} from "../../services/api/src/store";

const tenantId = DEFAULT_TENANT_ID;
const courseId = "course_demo";
const teamId = "team_alpha";
const runId = "run_r3_corridor";
const roundId = "round_r3_corridor_1";
const bindingDigest = "a".repeat(64);

async function requestJson<T>(
  baseUrl: string,
  path: string,
  options: { method?: string; body?: unknown; token?: string; tenant?: string } = {}
): Promise<{ body: T; status: number }> {
  return new Promise((resolve, reject) => {
    const request = nodeRequest(
      `${baseUrl}${path}`,
      {
        headers: {
          "content-type": "application/json",
          "x-tenant-id": options.tenant ?? tenantId,
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {})
        },
        method: options.method ?? "GET"
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          try {
            resolve({
              body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as T,
              status: response.statusCode ?? 0
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("error", reject);
    if (options.body !== undefined) request.write(JSON.stringify(options.body));
    request.end();
  });
}

async function login(baseUrl: string, username: "teacher" | "student"): Promise<string> {
  const result = await requestJson<ApiEnvelope<AuthSession>>(baseUrl, "/api/v1/auth/login", {
    method: "POST",
    body: { password: username, username }
  });
  expect(result.status).toBe(200);
  return result.body.data.access_token;
}

function seedCorridor(store: SimWarStore): void {
  const course = store.courses.find((candidate) => candidate.course_id === courseId);
  const team = store.teams.find((candidate) => candidate.team_id === teamId);
  if (!course || !team) throw new Error("R3 corridor requires the default course and team");
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
    decision_id: "decision_r3_corridor",
    merge_commit_id: "merge_r3_corridor",
    payload: {
      capacity_plan: "hold",
      cash_buffer_target: 0.2,
      marketing_budget: 100000,
      pricing: { base_price: 12000 },
      service_quality_budget: 100000,
      strategy_statement: "R3 consequence corridor"
    },
    round_id: roundId,
    round_no: 1,
    run_id: runId,
    status: "submitted",
    submitted_by: team.captain_user_id,
    team_confirmation_id: "confirmation_r3_corridor",
    team_id: teamId,
    tenant_id: tenantId,
    validation_report: [],
    version: 1
  });
  const w4DecisionPayload: W4CanonicalStrategicDecision["payload"] = {
    rationale: "R3 consequence corridor W4 admission",
    lead_time_rounds: 0,
    reversible: false,
    dependencies: [],
    kpi_hypothesis: "bounded official consequence join",
    capital_action_kind: "debt",
    principal: 250,
    term_rounds: 2,
    rate_or_cost_bps: 550,
    cost_source: `operating-world:${bindingDigest}`,
    covenant_min_cash: 500,
    fees: 5,
    obligation: "term_debt"
  };
  const w4Decision: W4CanonicalStrategicDecision = {
    decision_id: "w4_decision_r3_corridor",
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
      canonical_decision_id: "decision_r3_corridor",
      merge_commit_id: "merge_r3_corridor",
      team_confirmation_id: "confirmation_r3_corridor",
      decision_payload_digest: createW4DecisionPayloadDigest("capital_action", w4DecisionPayload)
    }
  };
  store.w4.decisions.push(w4Decision);
  const settlement: SettlementResult = {
    parameter_set_id: course.parameter_set_id,
    replay_hash: "c".repeat(64),
    round_id: roundId,
    round_no: 1,
    run_id: runId,
    scenario_package_id: course.scenario_package_id,
    settlement_result_id: "settlement_r3_corridor",
    team_results: [
      {
        state_est: {
          explanation: "bounded corridor result",
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
  store.settlementResults.push(settlement);
  const stateRef: W4StateRef = {
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    round_id: roundId,
    enterprise_state_id: "state_r3_corridor",
    version: 1,
    state_digest: "d".repeat(64)
  };
  const capitalAction: W4CapitalAction = {
    capital_action_id: "capital_action_r3_corridor",
    decision_id: w4Decision.decision_id,
    decision_payload_digest: w4Decision.admission.decision_payload_digest,
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
    official_outcome_id: "outcome_r3_corridor",
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    round_id: roundId,
    round_no: 1,
    opening_state_ref: stateRef,
    closing_state_ref: { ...stateRef, enterprise_state_id: "state_r3_corridor_closed" },
    commitment_ids: [],
    persistent_effect_ids: [],
    reexecuted_decision_ids: [],
    replay_input_manifest: {
      manifest_id: "manifest_r3_corridor",
      tenant_id: tenantId,
      course_id: courseId,
      run_id: runId,
      team_id: teamId,
      round_id: roundId,
      opening_state_ref: stateRef,
      decision_ids: [w4Decision.decision_id],
      decision_payload_bindings: [
        {
          decision_id: w4Decision.decision_id,
          decision_payload_digest: w4Decision.admission.decision_payload_digest
        }
      ],
      scenario_package_id: course.scenario_package_id,
      parameter_set_id: course.parameter_set_id,
      engine_id: "toy_logit_wellness_v1",
      plugin_ids: [],
      seed: 2031,
      operating_world_binding_digest: bindingDigest
    },
    settlement_digest: settlement.replay_hash,
    status: "official"
  };
  store.w4.capitalActions.push(capitalAction);
  store.w4.outcomes.push(outcome);
  store.auditLogs.push({
    action: "round.publish",
    actor_id: "usr_teacher",
    actor_role: "teacher",
    audit_id: "audit_r3_corridor_publish",
    created_at: "2026-08-18T12:45:00.000Z",
    request_id: "request_r3_corridor_publish",
    resource_id: roundId,
    resource_type: "round",
    tenant_id: tenantId
  });
}

describe("SH-M3 W5 R3 Operating World consequence corridor", () => {
  it("joins exact W4 evidence into real student/teacher BFF projections and fails closed", async () => {
    const store = createP1Store();
    seedCorridor(store);
    const server = createApiServer(store);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("R3 corridor server unavailable");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const query =
      `activity_id=activity_consequence&course_id=${courseId}&role_key=CEO&round_id=${roundId}` +
      `&round_no=1&run_id=${runId}&team_id=${teamId}`;
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const before = structuredClone(store.settlementResults[0]);
      const student = await requestJson<ApiEnvelope<{ record: Record<string, unknown> }>>(
        baseUrl,
        `/api/v1/bff/student/w3/consequence?${query}`,
        { token: studentToken }
      );
      const teacher = await requestJson<ApiEnvelope<{ record: Record<string, unknown> }>>(
        baseUrl,
        `/api/v1/bff/teacher/w3/consequence?${query}`,
        { token: teacherToken }
      );
      expect(student.status).toBe(200);
      expect(teacher.status).toBe(200);
      expect(student.body.data.record.operating_world_consequence_trace).toMatchObject({
        official_delta: "WHITELISTED_ONLY"
      });
      expect(student.body.data.record.operating_world_consequence_trace).not.toHaveProperty(
        "w4_action_ref"
      );
      expect(teacher.body.data.record.operating_world_consequence_trace).toMatchObject({
        w4_action_ref: "capital_action_r3_corridor",
        w4_replay_manifest_ref: "manifest_r3_corridor"
      });
      expect(store.settlementResults[0]).toEqual(before);

      store.w4.outcomes[0].replay_input_manifest.operating_world_binding_digest = "b".repeat(64);
      const mismatched = await requestJson<ApiEnvelope<{ record: Record<string, unknown> }>>(
        baseUrl,
        `/api/v1/bff/student/w3/consequence?${query}`,
        { token: studentToken }
      );
      expect(mismatched.status).toBe(200);
      expect(mismatched.body.data.record.operating_world_consequence_trace).toBeUndefined();

      const crossTenant = await requestJson<Record<string, unknown>>(
        baseUrl,
        `/api/v1/bff/student/w3/consequence?${query}`,
        { token: studentToken, tenant: OTHER_TENANT_ID }
      );
      expect(crossTenant.status).toBe(403);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
