import { createP1Store } from "../../services/api/src/store";

const M2_RUN_ID = "run_m2_market_world_browser";
const M2_ROUND_ID = "round_m2_market_world_browser";
const M2_ASSIGNMENT_ID = "assignment_m2_market_world_browser";

export function seedM2MarketWorldProductFixture(storeFile: string): void {
  const store = createP1Store({ persistenceFile: storeFile });
  if (
    store.runs.some((run) => run.run_id === M2_RUN_ID) ||
    store.rounds.some((round) => round.round_id === M2_ROUND_ID) ||
    store.studentRoleAssignments.some((assignment) => assignment.assignment_id === M2_ASSIGNMENT_ID)
  ) {
    throw new Error("M2 Market World fixture must be seeded into a freshly reset store.");
  }

  const course = store.courses.find((candidate) => candidate.course_id === "course_demo");
  if (!course) {
    throw new Error("M2 Market World fixture requires the default demo course.");
  }

  store.runs.push({
    course_id: course.course_id,
    parameter_set_id: course.parameter_set_id,
    run_id: M2_RUN_ID,
    scenario_package_id: course.scenario_package_id,
    seed: 20260820,
    status: "active",
    tenant_id: course.tenant_id
  });
  store.rounds.push({
    round_id: M2_ROUND_ID,
    round_no: 1,
    run_id: M2_RUN_ID,
    status: "open",
    tenant_id: course.tenant_id
  });
  store.studentRoleAssignments.push({
    assigned_at: "2026-08-20T23:00:00.000Z",
    assigned_by: "usr_teacher",
    assignment_id: M2_ASSIGNMENT_ID,
    course_id: course.course_id,
    role_key: "CEO",
    role_template_id: "role_template_ceo_v1",
    run_id: M2_RUN_ID,
    source: "teacher_assigned",
    status: "active",
    team_id: "team_alpha",
    tenant_id: course.tenant_id,
    user_id: "usr_student"
  });
  store.persist();
}
