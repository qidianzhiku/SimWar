import { createJsonRoleWorkflowRepositoryPort } from "../../services/api/src/json-repository-adapter";
import { RoleWorkflowCommandService } from "../../services/api/src/role-workflow";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const tenantId = "tenant_demo";
const runId = "run_w3_browser";
const roundId = "round_w3_browser_1";
const decisionId = "decision_w3_browser";
const settlementId = "settlement_w3_browser";

async function ensureStudentRoleAssignment(store: SimWarStore): Promise<void> {
  const run = store.runs.find((candidate) => candidate.run_id === runId);
  const round = store.rounds.find((candidate) => candidate.round_id === roundId);
  const teacher = store.users.find((candidate) => candidate.user_id === "usr_teacher");
  if (
    !run ||
    run.tenant_id !== tenantId ||
    run.course_id !== "course_demo" ||
    !round ||
    round.tenant_id !== tenantId ||
    round.run_id !== runId ||
    round.round_no !== 1 ||
    round.status !== "published" ||
    !teacher ||
    teacher.tenant_id !== tenantId ||
    !teacher.roles.includes("teacher")
  ) {
    throw new Error("W3 fixture requires the exact published scope and Teacher actor.");
  }

  const repository = createJsonRoleWorkflowRepositoryPort(store);
  const scope = { course_id: "course_demo", run_id: runId, team_id: "team_alpha" };
  const snapshot = await repository.readRoleWorkflow({ tenant_id: tenantId, ...scope });
  const active = snapshot.assignments.filter((assignment) => assignment.status === "active");
  const existing = active.filter(
    (assignment) => assignment.user_id === "usr_student" || assignment.role_key === "CEO"
  );
  if (existing.length) {
    const assignment = existing[0];
    if (
      existing.length !== 1 ||
      assignment.tenant_id !== tenantId ||
      assignment.course_id !== scope.course_id ||
      assignment.run_id !== runId ||
      assignment.team_id !== scope.team_id ||
      assignment.user_id !== "usr_student" ||
      assignment.role_key !== "CEO" ||
      assignment.source !== "teacher_assigned" ||
      assignment.assigned_by !== teacher.user_id ||
      !snapshot.events.some(
        (event) =>
          event.event_type === "role_assigned" &&
          event.resource_id === assignment.assignment_id &&
          event.tenant_id === tenantId &&
          event.run_id === runId &&
          event.team_id === scope.team_id &&
          event.actor_id === teacher.user_id
      )
    ) {
      throw new Error("W3 fixture role assignment cannot be safely reused.");
    }
    return;
  }

  const workflow = new RoleWorkflowCommandService(repository);
  await workflow.assignRole(
    { actor_id: teacher.user_id, actor_role: "teacher", tenant_id: tenantId },
    { ...scope, user_id: "usr_student", role_key: "CEO" }
  );
}

export async function seedW3OfficialConsequenceFixture(storeFile: string): Promise<void> {
  const store = createP1Store({ persistenceFile: storeFile });
  if (store.runs.some((run) => run.run_id === runId)) {
    await ensureStudentRoleAssignment(store);
    return;
  }
  const course = store.courses.find((candidate) => candidate.course_id === "course_demo");
  const team = store.teams.find((candidate) => candidate.team_id === "team_alpha");
  if (!course || !team) throw new Error("W3 fixture requires the default course and team.");

  store.runs.push({
    course_id: course.course_id,
    parameter_set_id: course.parameter_set_id,
    run_id: runId,
    scenario_package_id: course.scenario_package_id,
    seed: 2030,
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
    decision_id: decisionId,
    merge_commit_id: "merge_w3_browser",
    payload: {
      capacity_plan: "expand",
      cash_buffer_target: 0.18,
      marketing_budget: 140000,
      pricing: { base_price: 12500 },
      service_quality_budget: 130000,
      strategy_statement: "Bounded W3 browser decision"
    },
    round_id: roundId,
    round_no: 1,
    run_id: runId,
    status: "submitted",
    submitted_by: team.captain_user_id,
    team_confirmation_id: "confirmation_w3_browser",
    team_id: team.team_id,
    tenant_id: tenantId,
    validation_report: [],
    version: 1
  });
  store.settlementResults.push({
    parameter_set_id: course.parameter_set_id,
    replay_hash: "b".repeat(64),
    round_id: roundId,
    round_no: 1,
    run_id: runId,
    scenario_package_id: course.scenario_package_id,
    settlement_result_id: settlementId,
    team_results: [
      {
        state_est: {
          explanation: "The bounded official model context is visible for learning.",
          next_round_risk: "balanced",
          recommended_focus: "Test one bounded change next round."
        },
        state_obs: {
          demand_band: "medium",
          profit_band: "healthy",
          rank: 1,
          revenue: 180000,
          score: 82,
          served_demand: 105
        },
        state_true: {
          cash_flow: 50000,
          cost: 130000,
          demand: 120,
          market_share: 0.44,
          profit: 50000,
          revenue: 180000,
          rank: 1,
          score: 82,
          served_demand: 105,
          settlement_status: "settled"
        },
        team_id: team.team_id,
        team_name: team.name
      }
    ],
    tenant_id: tenantId
  });
  store.auditLogs.push({
    action: "round.publish",
    actor_id: "usr_teacher",
    actor_role: "teacher",
    audit_id: "audit_w3_browser_publish",
    created_at: "2026-08-18T12:40:00.000Z",
    request_id: "request_w3_browser_publish",
    resource_id: roundId,
    resource_type: "round",
    tenant_id: tenantId
  });
  store.persist();
  await ensureStudentRoleAssignment(store);
}
