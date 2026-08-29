import { CourseBlueprintCommandService } from "../../services/api/src/course-blueprint-authority";
import { createCourseBlueprintBinding } from "../../services/api/src/course-blueprint-binding";
import { CourseBlueprintBindingStore } from "../../services/api/src/course-blueprint-binding-store";
import { createFormalCourseAuthorityBinding } from "../../services/api/src/formal-course-authority-binding";
import { FormalCourseAuthorityBindingStore } from "../../services/api/src/formal-course-authority-binding-store";
import { createJsonFormalScenarioAuthorityPersistence } from "../../services/api/src/json-repository-adapter";
import { createJsonFormalScenarioAuthorityRuntime } from "../../services/api/src/formal-scenario-authority-runtime";
import { createP1Store } from "../../services/api/src/store";

const tenantId = "tenant_demo";

export async function seedRegionalTransferFixture(storeFile: string): Promise<void> {
  const store = createP1Store({ persistenceFile: storeFile });
  const persistence = createJsonFormalScenarioAuthorityPersistence(store);
  const formal = createJsonFormalScenarioAuthorityRuntime(persistence);
  const actor = {
    actor_id: "usr_platform",
    capabilities: ["course_blueprint:manage", "parameter_set:manage", "scenario_package:manage"],
    correlation_id: "rt_o1_browser_fixture",
    tenant_id: tenantId
  };
  const existing = await formal.parameterSets.listLifecycleSnapshots(
    tenantId,
    "parameter_rt_o1_browser",
    "1.0.0"
  );
  const ensureSecondConsumerTeam = () => {
    if (store.teams.some((team) => team.team_id === "team_beta")) return;
    store.teams.push({
      captain_user_id: "usr_default_cfo",
      course_id: "course_demo",
      members: [
        {
          display_name: "P0 CFO",
          role_slot: "CEO",
          user_id: "usr_default_cfo"
        }
      ],
      name: "Beta 康养队",
      team_id: "team_beta",
      tenant_id: tenantId
    });
  };
  if (existing.length > 0) {
    ensureSecondConsumerTeam();
    store.persist();
    return;
  }

  const parameterDraft = await formal.parameterSets.createDraft(actor, {
    compatibility_metadata: { engine_family: "toy_logit" },
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: "parameter_rt_o1_browser",
    parameter_values: { base_capacity: 120 },
    schema_version: "parameter-set.v1",
    tenant_id: tenantId,
    version: "1.0.0"
  });
  const parameterValidated = await formal.parameterSets.validate(actor, parameterDraft.reference);
  const parameterFrozen = await formal.parameterSets.freeze(actor, parameterValidated.reference);
  const parameterApproved = await formal.parameterSets.approve(
    actor,
    parameterFrozen.reference,
    "rt_o1_browser_parameter_approval"
  );
  const scenarioDraft = await formal.scenarioPackages.createDraft(actor, {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { scenario_family: "wellness" },
    content: { rounds: 1 },
    metadata: { title: "RT-O1 browser scenario" },
    parameter_set_reference: parameterApproved.version.reference,
    plugin_dependencies: [],
    scenario_package_id: "scenario_rt_o1_browser",
    schema_version: "scenario-package.v1",
    tenant_id: tenantId,
    version: "1.0.0"
  });
  const scenarioValidated = await formal.scenarioPackages.validate(actor, scenarioDraft.reference);
  const scenarioFrozen = await formal.scenarioPackages.freeze(actor, scenarioValidated.reference);
  const scenarioApproved = await formal.scenarioPackages.approve(
    actor,
    scenarioFrozen.reference,
    "rt_o1_browser_scenario_approval"
  );
  const blueprints = new CourseBlueprintCommandService(persistence.createCourseBlueprintRegistry());
  const blueprintDraft = await blueprints.createDraft(actor, {
    activity_plan: [{ activity_id: "rt_o1_browser_activity" }],
    course_blueprint_id: "blueprint_rt_o1_browser",
    description: "RT-O1 browser blueprint.",
    duration_minutes: 30,
    instructor_guidance_reference: "guide://rt-o1-browser",
    objectives: ["Use a bounded regional-transfer candidate."],
    ordered_phases: [
      {
        activity_type: "briefing",
        duration_minutes: 30,
        order: 1,
        phase_id: "rt_o1_browser_phase",
        student_instruction: "Read the published regional context.",
        teacher_guidance: "Keep the candidate bounded.",
        title: "Regional transfer"
      }
    ],
    required_product_capabilities: ["course:create"],
    scenario_compatibility_constraints: { scenario_family: "wellness" },
    schema_version: "course-blueprint.v1",
    tenant_id: tenantId,
    title: "RT-O1 browser blueprint",
    version: "1.0.0"
  });
  const blueprintValidated = await blueprints.validate(actor, blueprintDraft.reference);
  const blueprintFrozen = await blueprints.freeze(actor, blueprintValidated.reference);
  const blueprintApproved = await blueprints.approve(
    actor,
    blueprintFrozen.reference,
    "rt_o1_browser_blueprint_approval"
  );

  const course = store.courses.find((candidate) => candidate.course_id === "course_demo");
  if (!course) throw new Error("rt_o1_browser_course_missing");
  course.parameter_set_id = parameterApproved.version.reference.parameter_set_id;
  course.scenario_package_id = scenarioApproved.version.reference.scenario_package_id;
  new CourseBlueprintBindingStore(store).append(
    createCourseBlueprintBinding({
      binding_schema_version: "course-blueprint-binding.v1",
      course_blueprint_reference: blueprintApproved.version.reference,
      course_id: course.course_id,
      tenant_id: tenantId
    })
  );
  const formalCourseBinding = await createFormalCourseAuthorityBinding({
    authorities: {
      parameterSets: formal.parameterSets,
      plugins: formal.pluginReleases,
      scenarios: formal.scenarioPackages
    },
    course_id: course.course_id,
    engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
    parameter_set_reference: parameterApproved.version.reference,
    scenario_package_reference: scenarioApproved.version.reference,
    tenant_id: tenantId
  });
  new FormalCourseAuthorityBindingStore(store).append(formalCourseBinding);
  store.runs.push({
    course_id: course.course_id,
    parameter_set_id: parameterApproved.version.reference.parameter_set_id,
    run_id: "run_rt_o1_browser",
    scenario_package_id: scenarioApproved.version.reference.scenario_package_id,
    seed: 20260829,
    status: "active",
    tenant_id: tenantId
  });
  store.rounds.push({
    round_id: "round_rt_o1_browser_001",
    round_no: 1,
    run_id: "run_rt_o1_browser",
    status: "open",
    tenant_id: tenantId
  });
  ensureSecondConsumerTeam();
  store.persist();
}
