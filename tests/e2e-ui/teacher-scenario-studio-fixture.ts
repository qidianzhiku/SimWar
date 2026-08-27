import { CourseBlueprintCommandService } from "../../services/api/src/course-blueprint-authority";
import { createJsonFormalScenarioAuthorityPersistence } from "../../services/api/src/json-repository-adapter";
import { createJsonFormalScenarioAuthorityRuntime } from "../../services/api/src/formal-scenario-authority-runtime";
import { createP1Store } from "../../services/api/src/store";

const tenantId = "tenant_demo";

export async function seedTeacherScenarioStudioFixture(storeFile: string): Promise<void> {
  const store = createP1Store({ persistenceFile: storeFile });
  const persistence = createJsonFormalScenarioAuthorityPersistence(store);
  const formal = createJsonFormalScenarioAuthorityRuntime(persistence);
  const actor = {
    actor_id: "usr_platform",
    capabilities: ["course_blueprint:manage", "parameter_set:manage", "scenario_package:manage"],
    correlation_id: "tss_browser_fixture",
    tenant_id: tenantId
  };

  const existingParameter = await formal.parameterSets.listLifecycleSnapshots(
    tenantId,
    "parameter_tss_browser",
    "1.0.0"
  );
  if (existingParameter.length > 0) return;

  const parameterDraft = await formal.parameterSets.createDraft(actor, {
    compatibility_metadata: { engine_family: "toy_logit" },
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: "parameter_tss_browser",
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
    "tss_browser_parameter_approval"
  );

  const scenarioDraft = await formal.scenarioPackages.createDraft(actor, {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { scenario_family: "wellness" },
    content: { rounds: 1 },
    metadata: { title: "TSS browser scenario" },
    parameter_set_reference: parameterApproved.version.reference,
    plugin_dependencies: [],
    scenario_package_id: "scenario_tss_browser",
    schema_version: "scenario-package.v1",
    tenant_id: tenantId,
    version: "1.0.0"
  });
  const scenarioValidated = await formal.scenarioPackages.validate(actor, scenarioDraft.reference);
  const scenarioFrozen = await formal.scenarioPackages.freeze(actor, scenarioValidated.reference);
  await formal.scenarioPackages.approve(
    actor,
    scenarioFrozen.reference,
    "tss_browser_scenario_approval"
  );

  const blueprints = new CourseBlueprintCommandService(persistence.createCourseBlueprintRegistry());
  const blueprintDraft = await blueprints.createDraft(actor, {
    activity_plan: [{ activity_id: "tss_browser_activity" }],
    course_blueprint_id: "blueprint_tss_browser",
    description: "TSS browser blueprint.",
    duration_minutes: 60,
    instructor_guidance_reference: "guide://tss-browser",
    objectives: ["Create a governed scenario candidate."],
    ordered_phases: [
      {
        activity_type: "briefing",
        duration_minutes: 60,
        order: 1,
        phase_id: "tss_browser_phase",
        student_instruction: "Observe the published result.",
        teacher_guidance: "Keep the candidate bounded.",
        title: "Briefing"
      }
    ],
    required_product_capabilities: ["course:create"],
    scenario_compatibility_constraints: { scenario_family: "wellness" },
    schema_version: "course-blueprint.v1",
    tenant_id: tenantId,
    title: "TSS browser blueprint",
    version: "1.0.0"
  });
  const blueprintValidated = await blueprints.validate(actor, blueprintDraft.reference);
  const blueprintFrozen = await blueprints.freeze(actor, blueprintValidated.reference);
  await blueprints.approve(actor, blueprintFrozen.reference, "tss_browser_blueprint_approval");
  store.persist();
}
