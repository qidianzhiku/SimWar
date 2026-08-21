import { createHash } from "node:crypto";
import type {
  Decision,
  DecisionMergeCommit,
  DecisionPayload,
  FormalCourseAuthorityBinding,
  FormalRunRuntimeBinding,
  PluginManifest,
  ProjectAssignment,
  ProjectProfile,
  RoleDecisionSection,
  StudentRoleAssignment,
  TeamConfirmation
} from "../../packages/shared-contracts/src";
import { getShanghaiMarketWorldReference } from "../../services/api/src/market-world-product";
import { hashPassword } from "../../services/api/src/auth";
import type { ParameterSetVersion } from "../../services/api/src/parameter-set-authority";
import type { PluginReleaseVersion } from "../../services/api/src/plugin-release-authority";
import type { ScenarioPackageVersion } from "../../services/api/src/scenario-package-authority";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

export const M2P4_RUN_ID = "run_m2_p4_live_round_ops_browser";
export const M2P4_ROUND_ID = "round_m2_p4_live_round_ops_browser";
export const M2P4_PROFILE_ID = "shanghai-project-m2-p4-browser";
export const M2P4_PROFILE_VERSION = "2026-08-21.2";
export const M2P4_PROFILE_DIGEST = "f".repeat(64);

const TENANT_ID = "tenant_demo";
const COURSE_ID = "course_demo";
const TEACHER_ID = "usr_teacher";
const CREATED_AT = "2026-08-21T08:30:00.000Z";

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
  if (!student) throw new Error("M2-P4 fixture requires seeded student");
  store.users.push({
    ...structuredClone(student),
    user_id: "usr_student_beta",
    username: "student_beta",
    email: "student_beta@demo.simwar.local",
    display_name: "P4 Student Beta",
    password_hash: hashPassword("student_beta", "seed-usr_student_beta-p4"),
    team_id: "team_beta"
  });
  store.userRoles.push({
    tenant_id: TENANT_ID,
    user_id: "usr_student_beta",
    role_id: "role_learner"
  });
  for (const role of ["CFO", "CMO", "COO"] as const) {
    const source = store.users.find(
      (candidate) => candidate.user_id === `usr_default_${role.toLowerCase()}`
    );
    if (!source) throw new Error(`M2-P4 fixture requires seeded ${role}`);
    const userId = `usr_student_beta_${role.toLowerCase()}`;
    store.users.push({
      ...structuredClone(source),
      user_id: userId,
      username: userId,
      email: `${userId}@demo.simwar.local`,
      display_name: `P4 Student Beta ${role}`,
      password_hash: hashPassword(userId, `seed-${userId}`),
      team_id: "team_beta"
    });
    store.userRoles.push({ tenant_id: TENANT_ID, user_id: userId, role_id: "role_learner" });
  }
}

function decisionPayload(strategy: string): DecisionPayload {
  return {
    pricing: { base_price: 12800 },
    marketing_budget: 180000,
    service_quality_budget: 160000,
    capacity_plan: "expand",
    cash_buffer_target: 0.16,
    strategy_statement: strategy
  };
}

function rolePayload(role: string): Partial<DecisionPayload> {
  switch (role) {
    case "CEO":
      return {
        pricing: { base_price: 12800 },
        strategy_statement: "P4 exact project operating thesis"
      };
    case "CFO":
      return { cash_buffer_target: 0.16 };
    case "CMO":
      return { marketing_budget: 180000 };
    case "COO":
      return { capacity_plan: "expand", service_quality_budget: 160000 };
    default:
      throw new Error(`Unsupported M2-P4 role: ${role}`);
  }
}

function addRoleWorkflow(store: SimWarStore): void {
  const teams = store.teams.filter((team) => team.course_id === COURSE_ID);
  for (const team of teams) {
    const assignments: StudentRoleAssignment[] = team.members.map((member) => ({
      assignment_id: `role-m2-p4-${team.team_id}-${member.role_slot.toLowerCase()}`,
      assigned_at: CREATED_AT,
      assigned_by: TEACHER_ID,
      course_id: COURSE_ID,
      role_key: member.role_slot === "risk" ? "COO" : member.role_slot,
      role_template_id: `role_template_${member.role_slot.toLowerCase()}_v1`,
      run_id: M2P4_RUN_ID,
      source: "seeded_default",
      status: "active",
      team_id: team.team_id,
      tenant_id: TENANT_ID,
      user_id: member.user_id
    }));
    store.studentRoleAssignments.push(...assignments);

    const payload = decisionPayload(`M2-P4 canonical strategy for ${team.team_id}`);
    const sections: RoleDecisionSection[] = assignments.map((assignment, index) => ({
      assignment_id: assignment.assignment_id,
      round_id: M2P4_ROUND_ID,
      run_id: M2P4_RUN_ID,
      section_id: `section-m2-p4-${team.team_id}-${assignment.role_key.toLowerCase()}`,
      status: "ready",
      submitted_at: CREATED_AT,
      submitted_by: assignment.user_id,
      team_id: team.team_id,
      tenant_id: TENANT_ID,
      updated_at: CREATED_AT,
      version: index + 1,
      role_key: assignment.role_key,
      payload: rolePayload(assignment.role_key)
    }));
    store.roleDecisionSections.push(...sections);

    const merge: DecisionMergeCommit = {
      created_at: CREATED_AT,
      created_by: TEACHER_ID,
      merge_commit_id: `merge-m2-p4-${team.team_id}`,
      merged_payload: payload,
      round_id: M2P4_ROUND_ID,
      run_id: M2P4_RUN_ID,
      source_section_ids: sections.map((section) => section.section_id),
      status: "validated",
      team_id: team.team_id,
      tenant_id: TENANT_ID
    };
    store.decisionMergeCommits.push(merge);

    const confirmation: TeamConfirmation = {
      confirmed_at: CREATED_AT,
      confirmed_by: team.captain_user_id,
      merge_commit_id: merge.merge_commit_id,
      round_id: M2P4_ROUND_ID,
      run_id: M2P4_RUN_ID,
      status: "confirmed",
      team_confirmation_id: `confirmation-m2-p4-${team.team_id}`,
      team_id: team.team_id,
      tenant_id: TENANT_ID
    };
    store.teamConfirmations.push(confirmation);

    const decision: Decision = {
      canonical_source: "role_merge_commit",
      decision_id: `decision-m2-p4-${team.team_id}`,
      merge_commit_id: merge.merge_commit_id,
      payload,
      round_id: M2P4_ROUND_ID,
      round_no: 1,
      run_id: M2P4_RUN_ID,
      status: "submitted",
      team_confirmation_id: confirmation.team_confirmation_id,
      team_id: team.team_id,
      tenant_id: TENANT_ID,
      submitted_by: team.captain_user_id,
      validation_report: [],
      version: 1
    };
    store.decisions.push(decision);
  }
}

function addFormalBindings(store: SimWarStore): void {
  const course = store.courses.find((candidate) => candidate.course_id === COURSE_ID);
  if (!course) throw new Error("M2-P4 fixture requires course_demo");
  const parameterSetReference = {
    content_digest: "a".repeat(64),
    parameter_set_id: course.parameter_set_id,
    version: "1.0.0"
  };
  const scenarioPackageReference = {
    content_digest: "b".repeat(64),
    scenario_package_id: course.scenario_package_id,
    tenant_id: TENANT_ID,
    version: "1.0.0"
  };
  const courseBindingWithoutDigest = {
    binding_schema_version: "formal-course-authority-binding.v1" as const,
    course_id: COURSE_ID,
    engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
    parameter_set_reference: parameterSetReference,
    scenario_package_reference: scenarioPackageReference,
    tenant_id: TENANT_ID
  };
  const courseBinding: FormalCourseAuthorityBinding = {
    ...courseBindingWithoutDigest,
    binding_digest: digest(courseBindingWithoutDigest)
  };
  store.formalCourseAuthorityBindings.push(courseBinding);
  const runtimeBindingWithoutDigest = {
    binding_schema_version: "formal-run-runtime-binding.v1",
    decision_admission_policy: "ROLE_WORKFLOW_REQUIRED",
    engine_reference: courseBindingWithoutDigest.engine_reference,
    model_version_references: ["toy_logit_wellness_v1@0.1.0"],
    parameter_set_reference: parameterSetReference,
    plugin_release_references: [
      { content_digest: "c".repeat(64), plugin_package_id: "plugin_wellness_v1", version: "1.0.0" }
    ],
    projection_schema_references: [
      { schema_id: "ParameterSet", version: "parameter-set.v1" },
      { schema_id: "ScenarioPackage", version: "scenario-package.v1" }
    ],
    run_id: M2P4_RUN_ID,
    scenario_package_reference: scenarioPackageReference,
    seed: 20260821,
    seed_policy: "EXACT_RUN_SEED",
    tenant_id: TENANT_ID
  } as const;
  const runtimeBinding: FormalRunRuntimeBinding = {
    ...runtimeBindingWithoutDigest,
    binding_digest: digest(runtimeBindingWithoutDigest)
  };
  store.formalRunRuntimeBindings.push(runtimeBinding);
}

function addFormalAuthoritySnapshots(store: SimWarStore): void {
  const parameterReference = {
    content_digest: "a".repeat(64),
    parameter_set_id: "param_toy_approved_1",
    version: "1.0.0"
  };
  const scenarioReference = {
    content_digest: "b".repeat(64),
    scenario_package_id: "scenario_eldercare_demo",
    tenant_id: TENANT_ID,
    version: "1.0.0"
  };
  const pluginReference = {
    content_digest: "c".repeat(64),
    plugin_package_id: "plugin_wellness_v1",
    version: "1.0.0"
  };
  const parameterSet: ParameterSetVersion = {
    compatibility_metadata: { engine_family: "toy_logit" },
    content_digest: parameterReference.content_digest,
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: parameterReference.parameter_set_id,
    parameter_values: {
      runtime_parameter_set: {
        base_capacity: 120,
        base_market_size: 240,
        fixed_cost: 120000,
        model_family: "toy_logit",
        unit_cost: 4200
      }
    },
    reference: parameterReference,
    schema_version: "parameter-set.v1",
    status: "APPROVED",
    tenant_id: TENANT_ID,
    version: parameterReference.version
  };
  const scenario: ScenarioPackageVersion = {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { engine_family: "toy_logit" },
    content: {
      runtime_scenario_package: {
        name: "M2-P4 live round operations scenario",
        plugin_package_ids: [pluginReference.plugin_package_id]
      }
    },
    content_digest: scenarioReference.content_digest,
    metadata: { title: "M2-P4 live round operations scenario" },
    parameter_set_reference: parameterReference,
    plugin_dependencies: [
      { plugin_package_id: pluginReference.plugin_package_id, version: pluginReference.version }
    ],
    reference: scenarioReference,
    scenario_package_id: scenarioReference.scenario_package_id,
    schema_version: "scenario-package.v1",
    status: "APPROVED",
    tenant_id: TENANT_ID,
    version: scenarioReference.version
  };
  const pluginManifest: PluginManifest = {
    adapter_ref: "@simwar/simulation-core/wellnessPluginV1",
    industry: "wellness",
    manifest_version: "1.0.0",
    name: "M2-P4 wellness runtime plugin",
    parameter_schema_ref: "contracts/schemas/wellness-parameters.v1.json",
    parameter_schema_version: "wellness.parameters.v1",
    plugin_id: pluginReference.plugin_package_id,
    settlement_hook_refs: ["adjustDemand:wellness.v1"],
    status: "approved",
    supported_hooks: ["adjustDemand"],
    version: pluginReference.version
  };
  const plugin: PluginReleaseVersion = {
    compatibility_metadata: { engine_family: "toy_logit" },
    content_digest: pluginReference.content_digest,
    official_commit_permissions: [],
    plugin_manifest: pluginManifest,
    plugin_package_id: pluginReference.plugin_package_id,
    reference: pluginReference,
    schema_version: "plugin-release.v1",
    status: "AVAILABLE",
    version: pluginReference.version
  };
  store.formalParameterSetLifecycleSnapshots.push(parameterSet);
  store.formalScenarioPackageLifecycleSnapshots.push(scenario);
  store.formalPluginReleaseLifecycleSnapshots.push(plugin);
}

export function seedM2P4LiveRoundOpsFixture(storeFile: string): void {
  const store = createP1Store({ persistenceFile: storeFile });
  const course = store.courses.find((candidate) => candidate.course_id === COURSE_ID);
  if (!course) throw new Error("M2-P4 fixture requires course_demo");
  course.market_world_reference = getShanghaiMarketWorldReference();
  addStudentBeta(store);
  store.teams.push({
    captain_user_id: "usr_student_beta",
    course_id: COURSE_ID,
    members: [
      { display_name: "P4 Student Beta", role_slot: "CEO", user_id: "usr_student_beta" },
      { display_name: "P4 Student Beta CFO", role_slot: "CFO", user_id: "usr_student_beta_cfo" },
      { display_name: "P4 Student Beta CMO", role_slot: "CMO", user_id: "usr_student_beta_cmo" },
      { display_name: "P4 Student Beta COO", role_slot: "COO", user_id: "usr_student_beta_coo" }
    ],
    name: "Beta M2-P4 Arena",
    team_id: "team_beta",
    tenant_id: TENANT_ID
  });
  store.runs.push({
    course_id: COURSE_ID,
    parameter_set_id: course.parameter_set_id,
    run_id: M2P4_RUN_ID,
    scenario_package_id: course.scenario_package_id,
    seed: 20260821,
    status: "active",
    tenant_id: TENANT_ID
  });
  store.rounds.push({
    round_id: M2P4_ROUND_ID,
    round_no: 1,
    run_id: M2P4_RUN_ID,
    status: "open",
    tenant_id: TENANT_ID
  });
  const profile: ProjectProfile = {
    course_id: COURSE_ID,
    content_digest: M2P4_PROFILE_DIGEST,
    created_at: CREATED_AT,
    created_by: TEACHER_ID,
    customer_segment: "上海城市养老照护家庭",
    description: "M2-P4 live round operations project.",
    geography: "Shanghai",
    industry: "eldercare",
    market_world_reference: getShanghaiMarketWorldReference(),
    positioning: "连续可信的照护服务",
    project_profile_id: M2P4_PROFILE_ID,
    provenance: { kind: "APPROVED_SAFE_TEMPLATE" },
    schema_version: "project-profile.v1",
    service_bundle: "社区照护与居家支持",
    starting_capacity: 100,
    starting_cash: 100000,
    status: "VALIDATED",
    tenant_id: TENANT_ID,
    template_id: "shanghai-eldercare-safe-v1",
    title: "M2-P4 Live Round Operations",
    version: M2P4_PROFILE_VERSION
  };
  store.projectProfiles.push(profile);
  const reference = {
    content_digest: profile.content_digest,
    project_profile_id: profile.project_profile_id,
    tenant_id: TENANT_ID,
    version: profile.version
  };
  const assignments: ProjectAssignment[] = ["team_alpha", "team_beta"].map((teamId) => ({
    assigned_at: CREATED_AT,
    assigned_by: TEACHER_ID,
    assignment_id: `project-assignment-m2-p4-${teamId}`,
    course_id: COURSE_ID,
    project_profile_reference: reference,
    run_id: M2P4_RUN_ID,
    schema_version: "project-assignment.v1",
    team_id: teamId,
    tenant_id: TENANT_ID
  }));
  store.projectAssignments.push(...assignments);
  addRoleWorkflow(store);
  addFormalAuthoritySnapshots(store);
  addFormalBindings(store);
  store.persist();
}
