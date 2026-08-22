import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  AuditLog,
  FormalRunRuntimeBinding,
  Round,
  RoleDecisionSection,
  RoleId,
  SettlementResult,
  StudentRoleAssignment,
  StudentRoleWorkflowMergeDTO,
  StudentRoleWorkflowWorkspaceDTO,
  StudentDecisionTraceDTO,
  TeacherRoleWorkflowWorkspaceDTO,
  TeamConfirmation,
  TeamDivergenceSet,
  TeamResolutionSafeDTO
} from "../../packages/shared-contracts/src";
import { hashPassword } from "../../services/api/src/auth";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";
import { SYNTHETIC_JSON_INTERNAL_MARKER } from "../../services/api/src/synthetic-run-lifecycle";

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
    "x-tenant-id": "tenant_demo"
  });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? "GET"
  });
  return { body: (await response.json()) as ApiEnvelope<T>, status: response.status };
}

async function login(baseUrl: string, username: string): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password: username, username },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

function configureRoleWorkflowFixture(store: SimWarStore): void {
  const course = store.courses[0]!;
  store.runs = [
    {
      course_id: course.course_id,
      parameter_set_id: course.parameter_set_id,
      run_id: "run_role_workflow",
      scenario_package_id: course.scenario_package_id,
      seed: 314,
      status: "active",
      tenant_id: course.tenant_id
    }
  ];
  store.rounds = [
    {
      round_id: "round_role_workflow_1",
      round_no: 1,
      run_id: "run_role_workflow",
      status: "open",
      tenant_id: course.tenant_id
    }
  ];
  const creationAudit: AuditLog = {
    action: "run.create",
    actor_id: "usr_teacher",
    actor_role: "teacher",
    after: {
      lifecycle_state: "ACTIVE",
      synthetic_runtime_classification: SYNTHETIC_JSON_INTERNAL_MARKER
    },
    audit_id: "audit_run_role_workflow_create",
    created_at: "2026-07-31T02:00:00.000Z",
    request_id: "request_run_role_workflow_create",
    resource_id: "run_role_workflow",
    resource_type: "run",
    tenant_id: course.tenant_id
  };
  store.auditLogs.push(creationAudit);
  const roleUsers = [
    ["role_ceo", "CEO"],
    ["role_cfo", "CFO"],
    ["role_cmo", "CMO"],
    ["role_coo", "COO"]
  ] as const;
  for (const [username, role] of roleUsers) {
    store.users.push({
      created_at: "2026-07-31T02:00:00.000Z",
      display_name: role,
      email: `${username}@demo.simwar.local`,
      password_hash: hashPassword(username),
      roles: role === "CEO" ? ["learner", "team_captain"] : ["learner"],
      status: "active",
      team_id: "team_role_workflow",
      tenant_id: course.tenant_id,
      updated_at: "2026-07-31T02:00:00.000Z",
      user_id: username,
      username
    });
  }
  store.teams = [
    {
      captain_user_id: "role_ceo",
      course_id: course.course_id,
      members: roleUsers.map(([user_id, role_slot]) => ({
        display_name: role_slot,
        role_slot,
        user_id
      })),
      name: "Role Workflow Team",
      team_id: "team_role_workflow",
      tenant_id: course.tenant_id
    }
  ];
}

async function startServer(options: { incompleteRoleTeam?: boolean } = {}): Promise<{
  baseUrl: string;
  server: Server;
  store: SimWarStore;
}> {
  const store = createP1Store();
  configureRoleWorkflowFixture(store);
  if (options.incompleteRoleTeam) {
    store.teams[0]!.members = store.teams[0]!.members.filter(
      (member) => member.role_slot === "CEO"
    );
  }
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function startDefaultSeedServer(): Promise<{
  baseUrl: string;
  server: Server;
  store: SimWarStore;
}> {
  const store = createP1Store();
  store.runs = [
    {
      course_id: "course_demo",
      parameter_set_id: "param_toy_approved_1",
      run_id: "run_seed_ready",
      scenario_package_id: "scenario_eldercare_demo",
      seed: 2718,
      status: "active",
      tenant_id: "tenant_demo"
    }
  ];
  store.rounds = [
    {
      round_id: "round_default_seed_1",
      round_no: 1,
      run_id: "run_seed_ready",
      status: "open",
      tenant_id: "tenant_demo"
    }
  ];
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("default seed server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

const scope = {
  round_id: "round_role_workflow_1",
  run_id: "run_role_workflow",
  team_id: "team_role_workflow"
};

function createPolicyBinding(
  runId: string,
  policy: "ROLE_WORKFLOW_REQUIRED" | "LEGACY_DIRECT_EXPLICIT"
): FormalRunRuntimeBinding {
  return {
    binding_digest: "a".repeat(64),
    binding_schema_version: "formal-run-runtime-binding.v1",
    decision_admission_policy: policy,
    engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
    model_version_references: ["toy_logit_wellness_v1@0.1.0"],
    parameter_set_reference: {
      content_digest: "b".repeat(64),
      parameter_set_id: "parameters_demo",
      version: "1.0.0"
    },
    plugin_release_references: [],
    projection_schema_references: [
      { schema_id: "ParameterSet", version: "parameter-set.v1" },
      { schema_id: "ScenarioPackage", version: "scenario-package.v1" }
    ],
    run_id: runId,
    scenario_package_reference: {
      content_digest: "c".repeat(64),
      scenario_package_id: "scenario_demo",
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    seed: 314,
    seed_policy: "EXACT_RUN_SEED",
    tenant_id: "tenant_demo"
  };
}

describe("Role Workflow HTTP boundary", () => {
  it("blocks direct Decision submission for an explicitly formal run even before workflow records exist", async () => {
    const { baseUrl, server, store } = await startServer();
    store.auditLogs = [];
    store.formalRunRuntimeBindings.push(
      createPolicyBinding(scope.run_id, "ROLE_WORKFLOW_REQUIRED")
    );
    try {
      const studentToken = await login(baseUrl, "role_ceo");
      const response = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${scope.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: {
              capacity_plan: "hold",
              cash_buffer_target: 0.18,
              marketing_budget: 145000,
              pricing: { base_price: 12900 },
              service_quality_budget: 122000,
              strategy_statement: "Formal runs require role workflow admission."
            },
            team_id: scope.team_id
          },
          method: "POST",
          token: studentToken
        }
      );

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("ROLE_WORKFLOW_DIRECT_DECISION_DISABLED");
      expect(store.decisions).toEqual([]);
    } finally {
      await stopServer(server);
    }
  });

  it("fails closed when a run has neither a formal policy nor an explicit compatibility marker", async () => {
    const { baseUrl, server, store } = await startServer();
    store.auditLogs = [];
    try {
      const studentToken = await login(baseUrl, "role_ceo");
      const response = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${scope.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: {
              capacity_plan: "hold",
              cash_buffer_target: 0.18,
              marketing_budget: 145000,
              pricing: { base_price: 12900 },
              service_quality_budget: 122000,
              strategy_statement: "Missing policy must never become legacy."
            },
            team_id: scope.team_id
          },
          method: "POST",
          token: studentToken
        }
      );

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("DECISION_ADMISSION_POLICY_REQUIRED");
      expect(store.decisions).toEqual([]);
    } finally {
      await stopServer(server);
    }
  });

  it("makes the default golden team assignment-ready and preserves D2 fail-closed scope", async () => {
    const { baseUrl, server, store } = await startDefaultSeedServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const assignment = await request<StudentRoleAssignment>(
        baseUrl,
        "/api/v1/bff/teacher/role-workflows/assignments",
        {
          body: {
            course_id: "course_demo",
            role_key: "CEO",
            run_id: "run_seed_ready",
            team_id: "team_alpha",
            user_id: "usr_student"
          },
          method: "PUT",
          token: teacherToken
        }
      );
      expect(assignment.status).toBe(201);
      expect(store.studentRoleAssignments).toHaveLength(1);

      const eligibleEvents = await request<{ eligible_events: unknown[] }>(
        baseUrl,
        "/api/v1/bff/teacher/evidence?activity_id=activity_d2&course_id=course_demo&role_key=CEO&run_id=run_seed_ready&team_id=team_alpha",
        { token: teacherToken }
      );
      expect(eligibleEvents.status).toBe(200);
      expect(eligibleEvents.body.data.eligible_events).toEqual([]);
    } finally {
      await stopServer(server);
    }
  });

  it("rejects an incomplete team without disabling the legacy Decision route", async () => {
    const { baseUrl, server, store } = await startServer({ incompleteRoleTeam: true });
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const ceoToken = await login(baseUrl, "role_ceo");
      const assignment = await request<unknown>(
        baseUrl,
        "/api/v1/bff/teacher/role-workflows/assignments",
        {
          body: {
            course_id: "course_demo",
            role_key: "CEO",
            run_id: scope.run_id,
            team_id: scope.team_id,
            user_id: "role_ceo"
          },
          method: "PUT",
          token: teacherToken
        }
      );

      expect(assignment.status).toBe(422);
      expect(assignment.body.code).toBe("ROLE_WORKFLOW_TEAM_INCOMPLETE");
      expect(store.studentRoleAssignments).toEqual([]);
      expect(store.roleWorkflowEvents).toEqual([]);

      const legacyDecision = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${scope.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: {
              capacity_plan: "hold",
              cash_buffer_target: 0.18,
              marketing_budget: 145000,
              pricing: { base_price: 12900 },
              service_quality_budget: 122000,
              strategy_statement: "Legacy path remains viable."
            },
            team_id: scope.team_id
          },
          method: "POST",
          token: ceoToken
        }
      );
      expect(legacyDecision.status).toBe(201);
      expect(store.decisions).toHaveLength(1);
    } finally {
      await stopServer(server);
    }
  });

  it("runs Teacher assignment through Student safe drafts to one confirmed canonical Decision", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const tokens = new Map<string, string>();
      for (const username of ["role_ceo", "role_cfo", "role_cmo", "role_coo"]) {
        tokens.set(username, await login(baseUrl, username));
      }

      for (const [user_id, role_key] of [
        ["role_ceo", "CEO"],
        ["role_cfo", "CFO"],
        ["role_cmo", "CMO"],
        ["role_coo", "COO"]
      ] as [string, RoleId][]) {
        const assigned = await request<StudentRoleAssignment>(
          baseUrl,
          "/api/v1/bff/teacher/role-workflows/assignments",
          {
            body: {
              course_id: "course_demo",
              role_key,
              run_id: scope.run_id,
              team_id: scope.team_id,
              user_id
            },
            method: "PUT",
            token: teacherToken
          }
        );
        expect(assigned.status).toBe(201);
        expect(assigned.body.data.role_key).toBe(role_key);
      }

      const cfoWorkspace = await request<StudentRoleWorkflowWorkspaceDTO>(
        baseUrl,
        `/api/v1/bff/student/role-workspace?run_id=${scope.run_id}&round_id=${scope.round_id}&team_id=${scope.team_id}`,
        { token: tokens.get("role_cfo") }
      );
      expect(cfoWorkspace.status).toBe(200);
      expect(cfoWorkspace.body.data.context.role_key).toBe("CFO");
      const studentJson = JSON.stringify(cfoWorkspace.body.data);
      expect(studentJson).not.toContain("role_ceo");
      expect(studentJson).not.toContain("state_true");
      expect(studentJson).not.toContain("replay_hash");
      expect(studentJson).not.toContain("manifest");

      const payloads = new Map<string, object>([
        ["role_ceo", { strategy_statement: "One canonical team plan." }],
        ["role_cfo", { cash_buffer_target: 0.18, service_quality_budget: 122000 }],
        ["role_cmo", { marketing_budget: 145000, pricing: { base_price: 12900 } }],
        ["role_coo", { capacity_plan: "hold" }]
      ]);
      for (const username of ["role_ceo", "role_cfo", "role_cmo", "role_coo"]) {
        const saved = await request<RoleDecisionSection>(
          baseUrl,
          "/api/v1/bff/student/role-workspace/section",
          {
            body: { ...scope, expected_version: 0, payload: payloads.get(username) },
            method: "PUT",
            token: tokens.get(username)
          }
        );
        expect(saved.status).toBe(200);
        const ready = await request<RoleDecisionSection>(
          baseUrl,
          "/api/v1/bff/student/role-workspace/ready",
          {
            body: { ...scope, expected_version: saved.body.data.version },
            method: "POST",
            token: tokens.get(username)
          }
        );
        expect(ready.status).toBe(200);
        expect(ready.body.data.status).toBe("ready");
      }

      const teacherWorkspace = await request<TeacherRoleWorkflowWorkspaceDTO>(
        baseUrl,
        `/api/v1/bff/teacher/role-workflows?run_id=${scope.run_id}&round_id=${scope.round_id}&team_id=${scope.team_id}`,
        { token: teacherToken }
      );
      expect(teacherWorkspace.status).toBe(200);
      expect(teacherWorkspace.body.data.section_summaries).toHaveLength(4);
      expect(
        teacherWorkspace.body.data.section_summaries.every((section) => section.status === "ready")
      ).toBe(true);

      const [merge, concurrentMerge] = await Promise.all([
        request<StudentRoleWorkflowMergeDTO>(baseUrl, "/api/v1/bff/student/role-workspace/merge", {
          body: scope,
          method: "POST",
          token: tokens.get("role_ceo")
        }),
        request<StudentRoleWorkflowMergeDTO>(baseUrl, "/api/v1/bff/student/role-workspace/merge", {
          body: scope,
          method: "POST",
          token: tokens.get("role_ceo")
        })
      ]);
      expect([merge.status, concurrentMerge.status]).toEqual([201, 201]);
      expect(concurrentMerge.body.data.merge_commit_id).toBe(merge.body.data.merge_commit_id);
      expect(JSON.stringify(merge.body.data)).not.toContain("merged_payload");
      expect(store.decisionMergeCommits).toHaveLength(1);
      const hiddenPeerWorkspace = await request<StudentRoleWorkflowWorkspaceDTO>(
        baseUrl,
        `/api/v1/bff/student/role-workspace?run_id=${scope.run_id}&round_id=${scope.round_id}&team_id=${scope.team_id}`,
        { token: tokens.get("role_cfo") }
      );
      expect(hiddenPeerWorkspace.body.data.merge_candidate).toBeUndefined();
      const captainWorkspace = await request<StudentRoleWorkflowWorkspaceDTO>(
        baseUrl,
        `/api/v1/bff/student/role-workspace?run_id=${scope.run_id}&round_id=${scope.round_id}&team_id=${scope.team_id}`,
        { token: tokens.get("role_ceo") }
      );
      expect(captainWorkspace.body.data.merge_candidate).toEqual({
        created_at: merge.body.data.created_at,
        merge_commit_id: merge.body.data.merge_commit_id,
        status: "validated"
      });
      expect(JSON.stringify(captainWorkspace.body.data)).not.toContain("merged_payload");

      const [confirmation, repeatedConfirmation] = await Promise.all([
        request<TeamConfirmation>(baseUrl, "/api/v1/bff/student/role-workspace/confirm", {
          body: { ...scope, merge_commit_id: merge.body.data.merge_commit_id },
          method: "POST",
          token: tokens.get("role_ceo")
        }),
        request<TeamConfirmation>(baseUrl, "/api/v1/bff/student/role-workspace/confirm", {
          body: { ...scope, merge_commit_id: merge.body.data.merge_commit_id },
          method: "POST",
          token: tokens.get("role_ceo")
        })
      ]);
      expect([confirmation.status, repeatedConfirmation.status].sort()).toEqual([200, 201]);
      expect(repeatedConfirmation.body.data.team_confirmation_id).toBe(
        confirmation.body.data.team_confirmation_id
      );
      expect(store.decisions).toHaveLength(1);
      expect(store.decisions[0]).toMatchObject({
        canonical_source: "role_merge_commit",
        status: "submitted",
        team_confirmation_id: confirmation.body.data.team_confirmation_id
      });

      store.formalRunRuntimeBindings.push(
        createPolicyBinding(scope.run_id, "ROLE_WORKFLOW_REQUIRED")
      );
      const w4BeforeFormalMismatch = structuredClone(store.w4);
      const mismatchedW4Decision = await request<unknown>(
        baseUrl,
        `/api/v1/w4/runs/${scope.run_id}/rounds/1/strategic-decisions`,
        {
          body: {
            course_id: "course_demo",
            round_id: scope.round_id,
            team_id: scope.team_id,
            decision: {
              decision_id: "w4-formal-payload-mismatch",
              tenant_id: "tenant_demo",
              course_id: "course_demo",
              run_id: scope.run_id,
              round_id: scope.round_id,
              round_no: 1,
              team_id: scope.team_id,
              kind: "new_project",
              version: 1,
              status: "canonical",
              payload: {
                project_name: "Unconfirmed W4 project",
                cost: 300,
                cycle_rounds: 3,
                area: 12000,
                beds: 120,
                bed_mix: { standard: 120 },
                ramp: 0.4,
                lead_time_rounds: 2
              }
            }
          },
          method: "POST",
          token: tokens.get("role_ceo")
        }
      );
      expect(mismatchedW4Decision.status).toBe(409);
      expect(mismatchedW4Decision.body.data).toMatchObject({
        code: "W4_DECISION_PAYLOAD_BINDING_CONFLICT"
      });
      expect(store.w4).toEqual(w4BeforeFormalMismatch);
      expect(store.decisions).toHaveLength(1);
      store.formalRunRuntimeBindings.pop();

      const ceoTrace = await request<StudentDecisionTraceDTO>(
        baseUrl,
        `/api/v1/bff/student/role-workspace/decision-trace?run_id=${scope.run_id}&round_id=${scope.round_id}&team_id=${scope.team_id}`,
        { token: tokens.get("role_ceo") }
      );
      expect(ceoTrace.status).toBe(200);
      expect(ceoTrace.body.data).toMatchObject({
        current_stage: "CANONICAL_DECISION_MILESTONE",
        role_key: "CEO",
        round_id: scope.round_id,
        trace_completeness: "complete"
      });
      expect(ceoTrace.body.data.trace_stages.map((stage) => stage.stage_key)).toEqual([
        "ROLE_ASSIGNED",
        "ROLE_CONTRIBUTION_DRAFTED",
        "ROLE_CONTRIBUTION_READY",
        "TEAM_MERGE_MILESTONE",
        "TEAM_CONFIRMED",
        "CANONICAL_DECISION_MILESTONE"
      ]);
      expect(JSON.stringify(ceoTrace.body.data)).not.toContain("One canonical team plan.");
      expect(JSON.stringify(ceoTrace.body.data)).not.toContain("role_cfo");
      expect(JSON.stringify(ceoTrace.body.data)).not.toContain("state_true");
      expect(JSON.stringify(ceoTrace.body.data)).not.toContain("replay_hash");

      const cfoTrace = await request<StudentDecisionTraceDTO>(
        baseUrl,
        `/api/v1/bff/student/role-workspace/decision-trace?run_id=${scope.run_id}&round_id=${scope.round_id}&team_id=${scope.team_id}`,
        { token: tokens.get("role_cfo") }
      );
      expect(cfoTrace.status).toBe(200);
      expect(cfoTrace.body.data.trace_stages.map((stage) => stage.stage_key)).not.toContain(
        "TEAM_MERGE_MILESTONE"
      );
      expect(cfoTrace.body.data.trace_stages.map((stage) => stage.stage_key)).toContain(
        "TEAM_CONFIRMED"
      );
      expect(cfoTrace.body.data.trace_stages.map((stage) => stage.stage_key)).not.toContain(
        "CANONICAL_DECISION_MILESTONE"
      );
      expect(JSON.stringify(cfoTrace.body.data)).not.toContain("role_ceo");

      const peerConfirm = await request<unknown>(
        baseUrl,
        "/api/v1/bff/student/role-workspace/confirm",
        {
          body: { ...scope, merge_commit_id: merge.body.data.merge_commit_id },
          method: "POST",
          token: tokens.get("role_cfo")
        }
      );
      expect(peerConfirm.status).toBe(403);
      expect(store.decisions).toHaveLength(1);

      const legacyDecision = await request<unknown>(
        baseUrl,
        `/api/v1/runs/${scope.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: {
              capacity_plan: "hold",
              cash_buffer_target: 0.18,
              marketing_budget: 145000,
              pricing: { base_price: 12900 },
              service_quality_budget: 122000,
              strategy_statement: "One canonical team plan."
            },
            team_id: scope.team_id
          },
          method: "POST",
          token: tokens.get("role_ceo")
        }
      );
      expect(legacyDecision.status).toBe(409);
      expect(legacyDecision.body.code).toBe("ROLE_WORKFLOW_DIRECT_DECISION_DISABLED");
      expect(store.decisions).toHaveLength(1);

      const canonicalDecisionSnapshot = structuredClone(store.decisions);
      const locked = await request<Round>(baseUrl, `/api/v1/runs/${scope.run_id}/rounds/1/lock`, {
        method: "POST",
        token: teacherToken
      });
      expect(locked.status).toBe(200);
      expect(locked.body.data.status).toBe("locked");

      const settlement = await request<SettlementResult>(
        baseUrl,
        `/api/v1/runs/${scope.run_id}/rounds/1/settle`,
        { method: "POST", token: teacherToken }
      );
      expect(settlement.status).toBe(200);
      expect(settlement.body.data.replay_hash).toEqual(expect.any(String));

      const published = await request<Round>(
        baseUrl,
        `/api/v1/runs/${scope.run_id}/rounds/1/publish`,
        { method: "POST", token: teacherToken }
      );
      expect(published.status).toBe(200);
      expect(published.body.data.status).toBe("published");

      const officialSettlementSnapshot = structuredClone(store.settlementResults);
      const teacherResults = await request<{ replay_evidence?: unknown; results: unknown[] }>(
        baseUrl,
        `/api/v1/runs/${scope.run_id}/rounds/1/results`,
        { token: teacherToken }
      );
      expect(teacherResults.status).toBe(200);
      expect(teacherResults.body.data.replay_evidence).toBeDefined();

      const studentResults = await request<{ replay_evidence?: unknown; results: unknown[] }>(
        baseUrl,
        `/api/v1/runs/${scope.run_id}/rounds/1/results`,
        { token: tokens.get("role_ceo") }
      );
      expect(studentResults.status).toBe(200);
      expect(studentResults.body.data.replay_evidence).toBeUndefined();
      expect(JSON.stringify(studentResults.body.data)).not.toContain("state_true");

      const repeatedSettlement = await request<SettlementResult>(
        baseUrl,
        `/api/v1/runs/${scope.run_id}/rounds/1/settle`,
        { method: "POST", token: teacherToken }
      );
      expect(repeatedSettlement.status).toBe(200);
      expect(repeatedSettlement.body.data).toEqual(settlement.body.data);
      expect(store.decisions).toEqual(canonicalDecisionSnapshot);
      expect(store.settlementResults).toEqual(officialSettlementSnapshot);
    } finally {
      await stopServer(server);
    }
  });

  it("resolves observed team divergence through the HTTP boundary and preserves dissent", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const tokens = new Map<string, string>();
      for (const username of ["role_ceo", "role_cfo", "role_cmo", "role_coo"]) {
        tokens.set(username, await login(baseUrl, username));
      }
      const scope = {
        round_id: "round_role_workflow_1",
        run_id: "run_role_workflow",
        team_id: "team_role_workflow"
      };
      const roles = [
        ["role_ceo", "CEO"],
        ["role_cfo", "CFO"],
        ["role_cmo", "CMO"],
        ["role_coo", "COO"]
      ] as const;
      for (const [user_id, role_key] of roles) {
        const assigned = await request<StudentRoleAssignment>(
          baseUrl,
          "/api/v1/bff/teacher/role-workflows/assignments",
          {
            body: {
              course_id: "course_demo",
              role_key,
              run_id: scope.run_id,
              team_id: scope.team_id,
              user_id
            },
            method: "PUT",
            token: teacherToken
          }
        );
        expect(assigned.status).toBe(201);
      }
      const payloads = new Map<string, object>([
        ["role_ceo", { strategy_statement: "One bounded team plan." }],
        ["role_cfo", { cash_buffer_target: 0.18, service_quality_budget: 120000 }],
        ["role_cmo", { marketing_budget: 145000, pricing: { base_price: 12900 } }],
        ["role_coo", { capacity_plan: "hold", service_quality_budget: 125000 }]
      ]);
      for (const [username] of roles) {
        const saved = await request<RoleDecisionSection>(
          baseUrl,
          "/api/v1/bff/student/role-workspace/section",
          {
            body: { ...scope, expected_version: 0, payload: payloads.get(username) },
            method: "PUT",
            token: tokens.get(username)
          }
        );
        expect(saved.status).toBe(200);
        const ready = await request<RoleDecisionSection>(
          baseUrl,
          "/api/v1/bff/student/role-workspace/ready",
          {
            body: { ...scope, expected_version: saved.body.data.version },
            method: "POST",
            token: tokens.get(username)
          }
        );
        expect(ready.status).toBe(200);
      }

      const teacherWorkspace = await request<TeacherRoleWorkflowWorkspaceDTO>(
        baseUrl,
        `/api/v1/bff/teacher/role-workflows?run_id=${scope.run_id}&round_id=${scope.round_id}&team_id=${scope.team_id}`,
        { token: teacherToken }
      );
      expect(teacherWorkspace.body.data.divergence_summary).toMatchObject({
        divergence_count: 1,
        status: "OPEN"
      });

      const blockedMerge = await request(baseUrl, "/api/v1/bff/student/role-workspace/merge", {
        body: scope,
        method: "POST",
        token: tokens.get("role_ceo")
      });
      expect(blockedMerge.status).toBe(409);
      expect(blockedMerge.body.code).toBe("ROLE_WORKFLOW_DIVERGENCE_UNRESOLVED");

      const captainWorkspace = await request<StudentRoleWorkflowWorkspaceDTO>(
        baseUrl,
        `/api/v1/bff/student/role-workspace?run_id=${scope.run_id}&round_id=${scope.round_id}&team_id=${scope.team_id}`,
        { token: tokens.get("role_ceo") }
      );
      expect(captainWorkspace.body.data.divergence_set?.divergences).toHaveLength(1);
      const divergence = captainWorkspace.body.data.divergence_set as TeamDivergenceSet;
      const resolution = await request<TeamResolutionSafeDTO>(
        baseUrl,
        "/api/v1/bff/student/role-workspace/resolution",
        {
          body: {
            ...scope,
            selected_values: { service_quality_budget: 125000 },
            source_digest: divergence.source_digest,
            source_section_ids: divergence.source_section_ids
          },
          method: "POST",
          token: tokens.get("role_ceo")
        }
      );
      expect(resolution.status).toBe(201);
      expect(JSON.stringify(resolution.body.data)).not.toContain("proposed_by");

      for (const [username] of roles) {
        const acknowledgement = await request(
          baseUrl,
          "/api/v1/bff/student/role-workspace/resolution/acknowledgement",
          {
            body: {
              ...scope,
              resolution_id: resolution.body.data.resolution_id,
              status: username === "role_cfo" ? "DISSENT_PRESERVED" : "ACKNOWLEDGED",
              ...(username === "role_cfo"
                ? { dissent_note: "保留本角色对服务质量预算的异议。" }
                : {})
            },
            method: "POST",
            token: tokens.get(username)
          }
        );
        expect(acknowledgement.status).toBe(201);
        expect(JSON.stringify(acknowledgement.body.data)).not.toContain("acknowledged_by");
      }

      const merge = await request<StudentRoleWorkflowMergeDTO>(
        baseUrl,
        "/api/v1/bff/student/role-workspace/merge",
        { body: scope, method: "POST", token: tokens.get("role_ceo") }
      );
      expect(merge.status).toBe(201);
      expect(store.decisionMergeCommits[0]?.merged_payload.service_quality_budget).toBe(125000);
      expect(store.decisionMergeCommits[0]?.merged_payload).not.toHaveProperty("state_true");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("rejects unknown draft payload fields before they reach the workflow writer", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const cfoToken = await login(baseUrl, "role_cfo");
      const assigned = await request<StudentRoleAssignment>(
        baseUrl,
        "/api/v1/bff/teacher/role-workflows/assignments",
        {
          body: {
            course_id: "course_demo",
            role_key: "CFO",
            run_id: scope.run_id,
            team_id: scope.team_id,
            user_id: "role_cfo"
          },
          method: "PUT",
          token: teacherToken
        }
      );
      expect(assigned.status).toBe(201);

      const rejected = await request<unknown>(
        baseUrl,
        "/api/v1/bff/student/role-workspace/section",
        {
          body: {
            ...scope,
            expected_version: 0,
            payload: {
              cash_buffer_target: 0.2,
              state_true: { market_share: 1 }
            }
          },
          method: "PUT",
          token: cfoToken
        }
      );

      expect(rejected.status).toBe(422);
      expect(rejected.body.code).toBe("ROLE_WORKFLOW-422-001");
      expect(store.roleDecisionSections).toEqual([]);
    } finally {
      await stopServer(server);
    }
  });

  it("rejects unknown top-level fields on every Role Workflow mutation", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const ceoToken = await login(baseUrl, "role_ceo");
      const cases = [
        {
          path: "/api/v1/bff/teacher/role-workflows/assignments",
          method: "PUT",
          token: teacherToken,
          body: {
            course_id: "course_demo",
            role_key: "CEO",
            run_id: scope.run_id,
            team_id: scope.team_id,
            user_id: "role_ceo",
            state_true: {}
          }
        },
        {
          path: "/api/v1/bff/teacher/role-workflows/reset",
          method: "POST",
          token: teacherToken,
          body: { ...scope, state_true: {} }
        },
        {
          path: "/api/v1/bff/student/role-workspace/section",
          method: "PUT",
          token: ceoToken,
          body: {
            ...scope,
            expected_version: 0,
            payload: { strategy_statement: "safe" },
            state_true: {}
          }
        },
        {
          path: "/api/v1/bff/student/role-workspace/ready",
          method: "POST",
          token: ceoToken,
          body: { ...scope, expected_version: 1, state_true: {} }
        },
        {
          path: "/api/v1/bff/student/role-workspace/merge",
          method: "POST",
          token: ceoToken,
          body: { ...scope, state_true: {} }
        },
        {
          path: "/api/v1/bff/student/role-workspace/confirm",
          method: "POST",
          token: ceoToken,
          body: { ...scope, merge_commit_id: "merge_unknown", state_true: {} }
        }
      ];

      for (const testCase of cases) {
        const response = await request<unknown>(baseUrl, testCase.path, testCase);
        expect(response.status, testCase.path).toBe(422);
        expect(response.body.code, testCase.path).toBe("ROLE_WORKFLOW-422-001");
      }
      expect(store.studentRoleAssignments).toEqual([]);
      expect(store.roleDecisionSections).toEqual([]);
      expect(store.decisionMergeCommits).toEqual([]);
      expect(store.teamConfirmations).toEqual([]);
      expect(store.decisions).toEqual([]);
    } finally {
      await stopServer(server);
    }
  });
});
