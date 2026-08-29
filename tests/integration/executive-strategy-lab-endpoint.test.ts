import { once } from "node:events";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  RoleDecisionSection,
  StudentRoleAssignment,
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
const runId = "esl-http-run";
const teamId = "team_alpha";
const roundId = "esl-round-1";

function scope(roundNo = 1, round = `esl-round-${roundNo}`): W4ScopeContext {
  return {
    actor_id: "usr_teacher",
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    round_id: round,
    round_no: roundNo,
    role_key: "teacher",
    activity_id: "w4-enterprise-state-strategic-evolution"
  };
}

function initialState(): W4EnterpriseState {
  return {
    enterprise_state_id: "esl-state-initial",
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    round_id: roundId,
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

function strategicDecision(
  id: string,
  roundNo: number,
  cost: number
): W4CanonicalStrategicDecision {
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
    round_id: `esl-round-${roundNo}`,
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
  decision: W4CanonicalStrategicDecision
): W4ReplayInputManifest {
  return {
    manifest_id: "esl-manifest-1",
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    round_id: roundId,
    opening_state_ref: structuredClone(openingStateRef),
    decision_ids: [decision.decision_id],
    decision_payload_bindings: [
      {
        decision_id: decision.decision_id,
        decision_payload_digest: decision.admission.decision_payload_digest
      }
    ],
    scenario_package_id: "scenario_esl_http",
    parameter_set_id: "parameters_esl_http",
    engine_id: "toy_logit_wellness_v1",
    plugin_ids: ["plugin_wellness_stub"],
    seed: 79
  };
}

async function login(baseUrl: string, username: "teacher" | "student" | "admin") {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    body: JSON.stringify({ username, password: username })
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data.access_token;
}

function binding() {
  return {
    tenant_id: tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    round_id: roundId,
    round_no: 1,
    scenario_package_id: "scenario_esl_http",
    scenario_version: "1.0.0",
    parameter_set_id: "parameters_esl_http",
    parameter_set_version: "1.0.0",
    model_version_id: "model_esl_http",
    model_version: "1.0.0",
    model_artifact_id: "artifact_esl_http",
    model_artifact_version: "1.0.0",
    engine_id: "toy_logit_wellness_v1",
    plugin_ids: ["plugin_wellness_stub"],
    seed: 79
  };
}

describe("Executive Strategy Lab real BFF", () => {
  it("composes W4 and M4, then serves role-safe Student and Admin projections", async () => {
    const store = createP1Store();
    store.runs.push({
      run_id: runId,
      tenant_id: tenantId,
      course_id: courseId,
      scenario_package_id: "scenario_esl_http",
      parameter_set_id: "parameters_esl_http",
      seed: 79,
      status: "active"
    });
    store.rounds.push({
      round_id: roundId,
      tenant_id: tenantId,
      run_id: runId,
      round_no: 1,
      status: "published"
    });
    store.studentRoleAssignments.push({
      assignment_id: "esl-assignment-ceo",
      tenant_id: tenantId,
      course_id: courseId,
      run_id: runId,
      team_id: teamId,
      user_id: "usr_student",
      role_key: "CEO",
      role_template_id: "role-template-ceo",
      status: "active",
      source: "teacher_assigned",
      assigned_by: "usr_teacher",
      assigned_at: "2026-08-29T00:00:00.000Z"
    } satisfies StudentRoleAssignment);

    const repository = createJsonW4Repository(store);
    const w4 = createEnterpriseStateStrategicEvolutionService(repository);
    const firstScope = scope();
    const initial = await w4.createInitialState(firstScope, initialState());
    const officialDecision = strategicDecision("esl-http-official", 1, 100);
    await w4.commitStrategicDecision(firstScope, officialDecision);
    await w4.settleRound(firstScope, {
      opening_state_ref: initial.state_ref,
      decision_id: officialDecision.decision_id,
      replay_input_manifest: manifest(initial.state_ref, officialDecision)
    });
    const secondScope = scope(2);
    const pathA = strategicDecision("decision_priority_investment", 2, 125);
    const pathB = strategicDecision("decision_cash_protection", 2, 275);
    await w4.commitStrategicDecision(secondScope, pathA);
    await w4.commitStrategicDecision(secondScope, pathB);
    store.roleDecisionSections.push({
      section_id: "esl-section-ceo",
      assignment_id: "esl-assignment-ceo",
      tenant_id: tenantId,
      course_id: courseId,
      run_id: runId,
      round_id: roundId,
      team_id: teamId,
      role_key: "CEO",
      version: 1,
      status: "ready",
      payload: { private_note: "never expose" },
      submitted_by: "usr_student",
      updated_at: "2026-08-29T00:01:00.000Z"
    } as unknown as RoleDecisionSection);

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
      const adminToken = await login(baseUrl, "admin");
      const request = {
        discriminator: "esl_strategy_lab_request",
        exact_binding: binding(),
        paths: [
          {
            path_id: "path_priority_investment",
            label: "优先投资路径",
            decision_ids: [pathA.decision_id]
          },
          {
            path_id: "path_cash_protection",
            label: "现金保护路径",
            decision_ids: [pathB.decision_id]
          }
        ],
        transfer_hypothesis: "下一轮先验证服务质量与现金缓冲的平衡。",
        idempotency_key: "esl-http-journey-001"
      };
      const createResponse = await fetch(`${baseUrl}/api/v1/bff/teacher/esl/strategy-lab`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${teacherToken}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify(request)
      });
      expect(createResponse.status).toBe(201);
      const created = (await createResponse.json()) as ApiEnvelope<{
        candidate_id: string;
        paths: Array<{ officiality: string }>;
      }>;
      expect(created.data.paths).toHaveLength(2);
      expect(created.data.paths.every((path) => path.officiality === "NON_OFFICIAL")).toBe(true);
      const candidateId = created.data.candidate_id;

      const studentResponse = await fetch(
        `${baseUrl}/api/v1/bff/student/esl/candidates/${candidateId}`,
        {
          headers: { authorization: `Bearer ${studentToken}`, "x-tenant-id": tenantId }
        }
      );
      expect(studentResponse.status).toBe(200);
      const student = (await studentResponse.json()) as ApiEnvelope<{
        surface: string;
        paths: Array<{ finance_feasibility: { official: boolean } }>;
        student_projection?: { role_safe: boolean; role_key?: string };
      }>;
      expect(student.data.surface).toBe("student");
      expect(student.data.student_projection?.role_safe).toBe(true);
      expect(student.data.student_projection?.role_key).toBe("CEO");
      expect(student.data.paths.every((path) => !Object.hasOwn(path, "decision_ids"))).toBe(true);
      expect(student.data.paths.every((path) => path.finance_feasibility.official === false)).toBe(
        true
      );
      expect(JSON.stringify(student.data)).not.toContain("never expose");

      const adminResponse = await fetch(
        `${baseUrl}/api/v1/bff/admin/esl/audit?candidate_id=${encodeURIComponent(candidateId)}`,
        { headers: { authorization: `Bearer ${adminToken}`, "x-tenant-id": tenantId } }
      );
      expect(adminResponse.status).toBe(200);
      const admin = (await adminResponse.json()) as ApiEnvelope<{
        surface: string;
        paths: unknown[];
        admin_projection?: { audit: { no_write: boolean; generated_by: string } };
      }>;
      expect(admin.data.surface).toBe("admin");
      expect(admin.data.paths).toEqual([]);
      expect(admin.data.admin_projection?.audit.no_write).toBe(true);
      expect(admin.data.admin_projection?.audit.generated_by).toBe("usr_teacher");
      expect(store.w4).toEqual(before);
    } finally {
      server.close();
    }
  });
});
