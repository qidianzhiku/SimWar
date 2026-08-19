import { createP1Store } from "../../services/api/src/store";

const tenantId = "tenant_demo";
const runId = "run_w3_browser";
const roundId = "round_w3_browser_1";
const decisionId = "decision_w3_browser";
const settlementId = "settlement_w3_browser";

export function seedW3OfficialConsequenceFixture(storeFile: string): void {
  const store = createP1Store({ persistenceFile: storeFile });
  if (store.runs.some((run) => run.run_id === runId)) {
    throw new Error("W3 fixture must be seeded into a freshly reset store.");
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
}
