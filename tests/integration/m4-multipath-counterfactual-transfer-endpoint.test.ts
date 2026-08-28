import { once } from "node:events";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  RoleDecisionSection,
  RoleWorkflowEvent,
  ResolutionAcknowledgement,
  TeamResolution,
  W4CanonicalStrategicDecision,
  W4EnterpriseState,
  W4ReplayInputManifest,
  W4ScopeContext
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import {
  createEnterpriseStateStrategicEvolutionService,
  createJsonW4Repository,
  createW4DecisionPayloadDigest
} from "../../services/api/src/w4-enterprise-state";
import { createP1Store } from "../../services/api/src/store";

const tenantId = "tenant_demo";
const courseId = "course_demo";
const runId = "m4-http-run";
const teamId = "team_alpha";

function scope(roundNo = 1, roundId = `m4-round-${roundNo}`): W4ScopeContext {
  return {
    actor_id: "usr_teacher",
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    round_id: roundId,
    round_no: roundNo,
    role_key: "teacher",
    activity_id: "w4-enterprise-state-strategic-evolution"
  };
}

function initialState(): W4EnterpriseState {
  return {
    enterprise_state_id: "m4-http-state-initial",
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    round_id: "m4-round-1",
    round_no: 1,
    version: 1,
    parent_state_ref: null,
    state_digest: "",
    state: {
      cash: 1_000,
      capacity: 100,
      product_lines: ["core-care"],
      positioning: "trusted-care",
      organization: { team_size: 4 },
      operating_units: [],
      portfolio: { projects: [], facilities: [] }
    }
  };
}

function decision(id: string, roundNo: number, cost: number): W4CanonicalStrategicDecision {
  const currentScope = scope(roundNo);
  const payload = {
    project_name: `${id} project`,
    cost,
    cycle_rounds: 2,
    area: 1_000,
    beds: 10,
    bed_mix: { standard: 10 },
    ramp: 0.5,
    lead_time_rounds: 0
  };
  return {
    decision_id: id,
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    round_id: currentScope.round_id,
    round_no: roundNo,
    team_id: teamId,
    kind: "new_project",
    version: 1,
    status: "canonical",
    payload,
    admission: {
      policy: "LEGACY_DIRECT_EXPLICIT",
      authority: "synthetic_run_creation_marker",
      canonical_decision_id: null,
      merge_commit_id: null,
      team_confirmation_id: null,
      decision_payload_digest: createW4DecisionPayloadDigest("new_project", payload)
    }
  };
}

function manifest(
  openingStateRef: Parameters<
    ReturnType<typeof createEnterpriseStateStrategicEvolutionService>["settleRound"]
  >[1]["opening_state_ref"],
  decisionItem: W4CanonicalStrategicDecision
): W4ReplayInputManifest {
  return {
    manifest_id: "m4-http-manifest-1",
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    round_id: "m4-round-1",
    opening_state_ref: structuredClone(openingStateRef),
    decision_ids: [decisionItem.decision_id],
    decision_payload_bindings: [
      {
        decision_id: decisionItem.decision_id,
        decision_payload_digest: decisionItem.admission.decision_payload_digest
      }
    ],
    scenario_package_id: "scenario_m4_http",
    parameter_set_id: "parameters_m4_http",
    engine_id: "toy_logit_wellness_v1",
    plugin_ids: ["plugin_wellness_stub"],
    seed: 79
  };
}

async function login(baseUrl: string, username: "teacher" | "student"): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    body: JSON.stringify({ username, password: username })
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data.access_token;
}

describe("M4 multi-path counterfactual transfer real BFF", () => {
  it("serves teacher detail and student-safe comparison without mutating official W4 state", async () => {
    const store = createP1Store();
    store.runs.push({
      run_id: runId,
      tenant_id: tenantId,
      course_id: courseId,
      scenario_package_id: "scenario_m4_http",
      parameter_set_id: "parameters_m4_http",
      seed: 79,
      status: "active"
    });
    const repository = createJsonW4Repository(store);
    const w4 = createEnterpriseStateStrategicEvolutionService(repository);
    const firstScope = scope();
    const initial = await w4.createInitialState(firstScope, initialState());
    const officialDecision = decision("m4-http-official", 1, 100);
    await w4.commitStrategicDecision(firstScope, officialDecision);
    const sourceManifest = manifest(initial.state_ref, officialDecision);
    const official = await w4.settleRound(firstScope, {
      opening_state_ref: initial.state_ref,
      decision_id: officialDecision.decision_id,
      replay_input_manifest: sourceManifest
    });
    const secondScope = scope(2);
    const pathA = decision("m4-http-path-a", 2, 125);
    const pathB = decision("m4-http-path-b", 2, 275);
    await w4.commitStrategicDecision(secondScope, pathA);
    await w4.commitStrategicDecision(secondScope, pathB);
    store.roleDecisionSections.push({
      section_id: "m4-http-section-ceo",
      assignment_id: "m4-http-assignment-ceo",
      tenant_id: tenantId,
      course_id: courseId,
      run_id: runId,
      round_id: official.closing_state_ref.round_id,
      team_id: teamId,
      role_key: "CEO",
      version: 1,
      status: "ready",
      payload: { private_note: "do not send" },
      submitted_by: "usr_student",
      updated_at: "2026-08-28T00:01:00.000Z"
    } as unknown as RoleDecisionSection);
    store.roleWorkflowEvents.push({
      event_id: "m4-http-event",
      tenant_id: tenantId,
      run_id: runId,
      round_id: official.closing_state_ref.round_id,
      team_id: teamId,
      actor_id: "usr_teacher",
      event_type: "resolution_proposed",
      resource_id: "m4-http-resolution",
      created_at: "2026-08-28T00:02:00.000Z"
    } as unknown as RoleWorkflowEvent);
    store.teamResolutions.push({
      resolution_id: "m4-http-resolution",
      tenant_id: tenantId,
      run_id: runId,
      round_id: official.closing_state_ref.round_id,
      team_id: teamId,
      status: "PROPOSED",
      source_section_ids: ["m4-http-section-ceo"],
      source_digest: "d".repeat(64),
      selected_values: {},
      proposed_by: "usr_teacher",
      proposed_at: "2026-08-28T00:02:00.000Z"
    } as unknown as TeamResolution);
    store.resolutionAcknowledgements.push({
      acknowledgement_id: "m4-http-ack",
      resolution_id: "m4-http-resolution",
      tenant_id: tenantId,
      run_id: runId,
      round_id: official.closing_state_ref.round_id,
      team_id: teamId,
      role_key: "CFO",
      status: "DISSENT_PRESERVED",
      dissent_note: "do not send",
      acknowledged_by: "usr_student",
      acknowledged_at: "2026-08-28T00:03:00.000Z"
    } as unknown as ResolutionAcknowledgement);

    const before = structuredClone(store.w4);
    const server = createApiServer(store);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server address unavailable");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const body = {
        source_state_ref: official.closing_state_ref,
        source_outcome_id: official.outcome_id,
        round_no: 2,
        paths: [
          { path_id: "path_a", label: "成本受控路径", decision_ids: [pathA.decision_id] },
          { path_id: "path_b", label: "扩张优先路径", decision_ids: [pathB.decision_id] }
        ],
        horizon_rounds: 1,
        scenario_package_id: sourceManifest.scenario_package_id,
        parameter_set_id: sourceManifest.parameter_set_id,
        engine_id: sourceManifest.engine_id,
        plugin_ids: sourceManifest.plugin_ids,
        seed: sourceManifest.seed
      };
      const teacherResponse = await fetch(
        `${baseUrl}/api/v1/bff/teacher/w4/runs/${runId}/multipath-counterfactual-transfer`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${teacherToken}`,
            "content-type": "application/json",
            "x-tenant-id": tenantId
          },
          body: JSON.stringify(body)
        }
      );
      expect(teacherResponse.status).toBe(200);
      const teacher = (await teacherResponse.json()) as ApiEnvelope<{
        visibility: string;
        paths: Array<{ rounds: unknown[] }>;
        lineage: { preserved_dissent_role_keys: string[] };
      }>;
      expect(teacher.data.visibility).toBe("teacher_safe");
      expect(teacher.data.paths).toHaveLength(2);
      expect(teacher.data.paths[0]?.rounds).toHaveLength(1);
      expect(teacher.data.lineage.preserved_dissent_role_keys).toEqual(["CFO"]);

      const studentResponse = await fetch(
        `${baseUrl}/api/v1/bff/student/w4/runs/${runId}/multipath-counterfactual-transfer`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${studentToken}`,
            "content-type": "application/json",
            "x-tenant-id": tenantId
          },
          body: JSON.stringify(body)
        }
      );
      expect(studentResponse.status).toBe(200);
      const student = (await studentResponse.json()) as ApiEnvelope<{
        visibility: string;
        paths: Array<{ rounds?: unknown[] }>;
        student_transfer: { role_safe: true };
      }>;
      expect(student.data.visibility).toBe("student_safe");
      expect(student.data.paths[0]).not.toHaveProperty("rounds");
      expect(student.data.student_transfer.role_safe).toBe(true);
      expect(JSON.stringify(student.data)).not.toContain("do not send");
      expect(store.w4).toEqual(before);
    } finally {
      server.close();
    }
  });
});
