import type { SimWarStore } from "../../services/api/src/store";
import {
  persistCoursePackageLifecycleSnapshots,
  readCoursePackageLifecycleSnapshots
} from "../../services/api/src/store";
import {
  createJsonFormalScenarioAuthorityPersistence,
  createJsonRepositoryPorts
} from "../../services/api/src/json-repository-adapter";
import { createJsonFormalScenarioAuthorityRuntime } from "../../services/api/src/formal-scenario-authority-runtime";
import { CourseBlueprintCommandService } from "../../services/api/src/course-blueprint-authority";
import { CoursePackageCommandService } from "../../services/api/src/course-package-command-service";
import { CoursePackageQueryService } from "../../services/api/src/course-package-query-service";
import {
  CoursePackageJsonRegistry,
  createCoursePackageVersionReference
} from "../../services/api/src/course-package-json-registry";
import { MODEL_QUALIFICATION_MODEL_VERSION } from "../../services/api/src/model-qualification-service";

/** Synthetic fixture through existing lifecycle commands; no alternate authority or runtime. */
export async function seedO5FormalCourse(store: SimWarStore) {
  const tenant_id = "tenant_demo";
  const actor = {
    actor_id: "usr_teacher",
    tenant_id,
    correlation_id: "o5-fixture",
    capabilities: ["parameter_set:manage", "scenario_package:manage", "course_blueprint:manage"]
  };
  const persistence = createJsonFormalScenarioAuthorityPersistence(store);
  const runtime = createJsonFormalScenarioAuthorityRuntime(persistence);
  const { parameterSets, scenarioPackages } = runtime;
  const model = MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference;
  const draft = await parameterSets.createDraft(actor, {
    parameter_set_id: "parameter_o5",
    version: "1.0.0",
    tenant_id,
    schema_version: "parameter-set.v1",
    model_version_ref: `${model.model_version_id}@${model.version}`,
    compatibility_metadata: { scenario_family: "o5" },
    parameter_values: {
      runtime_parameter_set: {
        model_family: "toy_logit",
        base_capacity: 100,
        base_market_size: 1000,
        fixed_cost: 10,
        unit_cost: 2
      }
    }
  });
  const valid = await parameterSets.validate(actor, draft.reference);
  const frozen = await parameterSets.freeze(actor, valid.reference);
  const parameter = (await parameterSets.approve(actor, frozen.reference, "o5-parameter-approved"))
    .version;
  const scenarioDraft = await scenarioPackages.createDraft(actor, {
    scenario_package_id: "scenario_o5",
    version: "1.0.0",
    tenant_id,
    schema_version: "scenario-package.v1",
    metadata: { title: "Synthetic O5 exact scenario" },
    compatibility_metadata: { scenario_family: "o5" },
    content: { runtime_scenario_package: { name: "Synthetic O5", plugin_package_ids: [] } },
    parameter_set_reference: parameter.reference,
    plugin_dependencies: [],
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" }
  });
  const scenarioValid = await scenarioPackages.validate(actor, scenarioDraft.reference);
  const scenarioFrozen = await scenarioPackages.freeze(actor, scenarioValid.reference);
  const scenario = (
    await scenarioPackages.approve(actor, scenarioFrozen.reference, "o5-scenario-approved")
  ).version;
  const courseBlueprints = new CourseBlueprintCommandService(
    persistence.createCourseBlueprintRegistry()
  );
  const blueprintDraft = await courseBlueprints.createDraft(actor, {
    course_blueprint_id: "blueprint_o5",
    tenant_id,
    version: "1.0.0",
    schema_version: "course-blueprint.v1",
    title: "Synthetic O5 course",
    description: "Exact evidence adoption browser fixture",
    duration_minutes: 30,
    objectives: ["Inspect exact adoption and retained history"],
    activity_plan: [],
    instructor_guidance_reference: "o5-guidance",
    ordered_phases: [
      {
        activity_type: "simulation",
        duration_minutes: 30,
        order: 1,
        phase_id: "phase-1",
        student_instruction: "Inspect safe limits",
        teacher_guidance: "Review exact evidence",
        title: "Evidence governance"
      }
    ],
    required_product_capabilities: ["course:create"],
    scenario_compatibility_constraints: { scenario_family: "o5" }
  });
  const blueprintValid = await courseBlueprints.validate(actor, blueprintDraft.reference);
  const blueprintFrozen = await courseBlueprints.freeze(actor, blueprintValid.reference);
  const blueprint = (
    await courseBlueprints.approve(actor, blueprintFrozen.reference, "o5-blueprint-approved")
  ).version;
  const registry = new CoursePackageJsonRegistry(
    { persist: (snapshots) => persistCoursePackageLifecycleSnapshots(store, snapshots) },
    readCoursePackageLifecycleSnapshots(store)
  );
  const packages = new CoursePackageCommandService(registry, {
    courseBlueprints,
    parameterSets,
    scenarioPackages
  });
  const packageDraft = await packages.createDraft(actor, {
    course_package_id: "package_o5",
    version: "1.0.0",
    title: "Synthetic O5 course package",
    description: "Bounded offline fixture only",
    course_blueprint_reference: blueprint.reference,
    parameter_set_reference: parameter.reference,
    scenario_package_reference: scenario.reference
  });
  const packageValid = await packages.validate(
    actor,
    createCoursePackageVersionReference(packageDraft)
  );
  const available = await packages.makeAvailable(
    actor,
    createCoursePackageVersionReference(packageValid)
  );
  const repositories = createJsonRepositoryPorts(store);
  const course = (await repositories.courses.getCourse(tenant_id, "course_demo"))!;
  await repositories.courses.saveCourse({
    ...course,
    parameter_set_id: parameter.parameter_set_id,
    scenario_package_id: scenario.scenario_package_id,
    status: "draft"
  });
  return {
    authorities: { parameterSets, scenarios: scenarioPackages, plugins: runtime.pluginReleases },
    coursePackage: available,
    coursePackageQueries: new CoursePackageQueryService(registry),
    parameter_set_reference: parameter.reference,
    scenario_package_reference: scenario.reference,
    course_package_reference: createCoursePackageVersionReference(available),
    engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" }
  };
}
