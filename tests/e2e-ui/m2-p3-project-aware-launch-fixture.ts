import { createHash } from "node:crypto";
import type {
  FormalCourseAuthorityBinding,
  FormalRunRuntimeBinding,
  ProjectAssignment,
  ProjectProfile,
  StudentRoleAssignment
} from "../../packages/shared-contracts/src";
import { getShanghaiMarketWorldReference } from "../../services/api/src/market-world-product";
import { hashPassword } from "../../services/api/src/auth";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

export const M2P3_RUN_ID = "run_m2_p3_project_aware_browser";
export const M2P3_ROUND_ID = "round_m2_p3_project_aware_browser";
export const M2P3_PROFILE_ID = "shanghai-project-m2-p3-browser";
export const M2P3_PROFILE_VERSION = "2026-08-21.1";
export const M2P3_PROFILE_DIGEST = "a".repeat(64);

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function addStudentBeta(store: SimWarStore): void {
  const student = store.users.find((candidate) => candidate.user_id === "usr_student");
  if (!student) throw new Error("M2-P3 fixture requires seeded student");
  store.users.push({
    ...structuredClone(student),
    user_id: "usr_student_beta",
    username: "student_beta",
    email: "student_beta@demo.simwar.local",
    display_name: "P3 Student Beta",
    password_hash: hashPassword("student_beta", "seed-usr_student_beta"),
    team_id: "team_beta"
  });
  store.userRoles.push({
    tenant_id: "tenant_demo",
    user_id: "usr_student_beta",
    role_id: "role_learner"
  });
}

function addRoleAssignments(store: SimWarStore): void {
  const assignments: StudentRoleAssignment[] = store.teams
    .filter((team) => team.course_id === "course_demo")
    .flatMap((team) =>
      team.members.map((member) => ({
        assignment_id: `role-m2-p3-${team.team_id}-${member.role_slot.toLowerCase()}`,
        assigned_at: "2026-08-21T08:00:00.000Z",
        assigned_by: "usr_teacher",
        course_id: "course_demo",
        role_key: (member.role_slot === "risk" ? "COO" : member.role_slot) as Exclude<
          typeof member.role_slot,
          "risk"
        >,
        role_template_id: `role_template_${member.role_slot.toLowerCase()}_v1`,
        run_id: M2P3_RUN_ID,
        source: "seeded_default" as const,
        status: "active" as const,
        team_id: team.team_id,
        tenant_id: "tenant_demo",
        user_id: member.user_id
      }))
    );
  store.studentRoleAssignments.push(...assignments);
}

export function seedM2P3ProjectAwareLaunchFixture(
  storeFile: string,
  options: { initiallyBlocked?: boolean } = {}
): void {
  const store = createP1Store({ persistenceFile: storeFile });
  const course = store.courses.find((candidate) => candidate.course_id === "course_demo");
  if (!course) throw new Error("M2-P3 fixture requires course_demo");
  course.market_world_reference = getShanghaiMarketWorldReference();
  addStudentBeta(store);
  store.teams.push({
    captain_user_id: "usr_student_beta",
    course_id: course.course_id,
    members: [{ display_name: "P3 Student Beta", role_slot: "CEO", user_id: "usr_student_beta" }],
    name: "Beta Matched Arena",
    team_id: "team_beta",
    tenant_id: course.tenant_id
  });
  store.runs.push({
    course_id: course.course_id,
    parameter_set_id: course.parameter_set_id,
    run_id: M2P3_RUN_ID,
    scenario_package_id: course.scenario_package_id,
    seed: 20260821,
    status: "active",
    tenant_id: course.tenant_id
  });
  store.rounds.push({
    round_id: M2P3_ROUND_ID,
    round_no: 1,
    run_id: M2P3_RUN_ID,
    status: "open",
    tenant_id: course.tenant_id
  });
  const profile: ProjectProfile = {
    course_id: course.course_id,
    content_digest: M2P3_PROFILE_DIGEST,
    created_at: "2026-08-21T08:00:00.000Z",
    created_by: "usr_teacher",
    customer_segment: "上海城市养老照护家庭",
    description: "M2-P3 matched arena project.",
    geography: "Shanghai",
    industry: "eldercare",
    market_world_reference: getShanghaiMarketWorldReference(),
    positioning: "连续可信的照护服务",
    project_profile_id: M2P3_PROFILE_ID,
    provenance: { kind: "APPROVED_SAFE_TEMPLATE" },
    schema_version: "project-profile.v1",
    service_bundle: "社区照护与居家支持",
    starting_capacity: 100,
    starting_cash: 100000,
    status: "VALIDATED",
    tenant_id: course.tenant_id,
    template_id: "shanghai-eldercare-safe-v1",
    title: "M2-P3 Matched Arena",
    version: M2P3_PROFILE_VERSION
  };
  store.projectProfiles.push(profile);
  const reference = {
    content_digest: profile.content_digest,
    project_profile_id: profile.project_profile_id,
    tenant_id: profile.tenant_id,
    version: profile.version
  };
  const assignmentTeamIds = options.initiallyBlocked ? ["team_alpha"] : ["team_alpha", "team_beta"];
  const assignments: ProjectAssignment[] = assignmentTeamIds.map((teamId) => ({
    assigned_at: "2026-08-21T08:00:00.000Z",
    assigned_by: "usr_teacher",
    assignment_id: `project-assignment-m2-p3-${teamId}`,
    course_id: course.course_id,
    project_profile_reference: reference,
    run_id: M2P3_RUN_ID,
    schema_version: "project-assignment.v1",
    team_id: teamId,
    tenant_id: course.tenant_id
  }));
  store.projectAssignments.push(...assignments);
  addRoleAssignments(store);

  const parameterSetReference = {
    content_digest: "b".repeat(64),
    parameter_set_id: course.parameter_set_id,
    version: "1.0.0"
  };
  const scenarioReference = {
    content_digest: "c".repeat(64),
    scenario_package_id: course.scenario_package_id,
    tenant_id: course.tenant_id,
    version: "1.0.0"
  };
  const bindingWithoutDigest = {
    binding_schema_version: "formal-course-authority-binding.v1" as const,
    course_id: course.course_id,
    engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
    parameter_set_reference: parameterSetReference,
    scenario_package_reference: scenarioReference,
    tenant_id: course.tenant_id
  };
  const courseBinding: FormalCourseAuthorityBinding = {
    ...bindingWithoutDigest,
    binding_digest: digest(bindingWithoutDigest)
  };
  store.formalCourseAuthorityBindings.push(courseBinding);
  const runtimeBinding: FormalRunRuntimeBinding = {
    binding_digest: "d".repeat(64),
    binding_schema_version: "formal-run-runtime-binding.v1",
    decision_admission_policy: "ROLE_WORKFLOW_REQUIRED",
    engine_reference: bindingWithoutDigest.engine_reference,
    model_version_references: ["toy_logit_wellness_v1@0.1.0"],
    parameter_set_reference: parameterSetReference,
    plugin_release_references: [
      { content_digest: "e".repeat(64), plugin_package_id: "plugin_wellness_v1", version: "1.0.0" }
    ],
    projection_schema_references: [
      { schema_id: "ParameterSet", version: "parameter-set.v1" },
      { schema_id: "ScenarioPackage", version: "scenario-package.v1" }
    ],
    run_id: M2P3_RUN_ID,
    scenario_package_reference: scenarioReference,
    seed: 20260821,
    seed_policy: "EXACT_RUN_SEED",
    tenant_id: course.tenant_id
  };
  store.formalRunRuntimeBindings.push(runtimeBinding);
  store.persist();
}
