import { describe, expect, it, vi } from "vitest";
import type {
  CourseBlueprintReference,
  ParameterSetReference,
  ScenarioPackageReference,
  TeacherScenarioStudioDraftInput
} from "@simwar/shared-contracts";
import { W5_MODEL_VERSION_REF } from "@simwar/shared-contracts";
import type { CourseBlueprintVersion } from "../../services/api/src/course-blueprint-authority";
import {
  CoursePackageCommandService,
  type CoursePackageSourceReadPorts
} from "../../services/api/src/course-package-command-service";
import { CoursePackageJsonRegistry } from "../../services/api/src/course-package-json-registry";
import type { ParameterSetVersion } from "../../services/api/src/parameter-set-authority";
import type { ScenarioPackageVersion } from "../../services/api/src/scenario-package-authority";
import {
  TeacherScenarioStudioError,
  TeacherScenarioStudioService,
  type TeacherScenarioStudioSourcePorts
} from "../../services/api/src/teacher-scenario-studio-service";

const tenantId = "tenant_demo";
const digest = (character: string) => character.repeat(64);

const blueprintReference: CourseBlueprintReference = {
  content_digest: digest("a"),
  course_blueprint_id: "blueprint_tss_001",
  tenant_id: tenantId,
  version: "1.0.0"
};
const parameterReference: ParameterSetReference = {
  content_digest: digest("b"),
  parameter_set_id: "parameter_tss_001",
  version: "1.0.0"
};
const scenarioReference: ScenarioPackageReference = {
  content_digest: digest("c"),
  scenario_package_id: "scenario_tss_001",
  tenant_id: tenantId,
  version: "1.0.0"
};

const configuration = {
  custom_parameters: { mode: "DRAFT_ONLY" as const, values: { custom_rate: 1.2 } },
  experience_profile: "STANDARD" as const,
  model_version_ref: W5_MODEL_VERSION_REF,
  module_configuration: {
    capital: { enabled: true },
    environment: { region: "generic" },
    funding: { enabled: true },
    policy_shocks: { enabled: false },
    project_template: { template_id: "generic" },
    workforce: { enabled: true }
  },
  schema_version: "teacher-scenario-studio.v1" as const
};

const draft: TeacherScenarioStudioDraftInput = {
  course_blueprint_reference: blueprintReference,
  course_package_id: "course_package_tss_001",
  description: "A governed teacher scenario studio candidate.",
  parameter_set_reference: parameterReference,
  scenario_package_reference: scenarioReference,
  studio_configuration: configuration,
  title: "TSS candidate",
  version: "1.0.0"
};

const blueprint = {
  reference: blueprintReference,
  scenario_compatibility_constraints: { scenario_family: "wellness" },
  status: "APPROVED",
  title: "TSS blueprint"
} as CourseBlueprintVersion;
const parameterSet = {
  model_version_ref: W5_MODEL_VERSION_REF,
  reference: parameterReference,
  status: "APPROVED"
} as ParameterSetVersion;
const scenario = {
  compatibility_metadata: { scenario_family: "wellness" },
  parameter_set_reference: parameterReference,
  plugin_dependencies: [],
  reference: scenarioReference,
  status: "APPROVED"
} as ScenarioPackageVersion;

function createPorts(overrides: { modelVersionRef?: string; scenarioFamily?: string } = {}) {
  const currentScenario = {
    ...scenario,
    compatibility_metadata: { scenario_family: overrides.scenarioFamily ?? "wellness" }
  } as ScenarioPackageVersion;
  const commandSources: CoursePackageSourceReadPorts = {
    courseBlueprints: {
      assertBindable: async () => undefined,
      getByReference: async () => blueprint
    },
    parameterSets: {
      assertBindable: async () => undefined,
      getByReference: async () => ({
        ...parameterSet,
        model_version_ref: overrides.modelVersionRef ?? W5_MODEL_VERSION_REF
      })
    },
    scenarioPackages: {
      assertBindable: async () => undefined,
      getByReference: async () => currentScenario
    }
  };
  const sources: TeacherScenarioStudioSourcePorts = {
    courseBlueprints: {
      getByReference: async () => blueprint,
      listApprovedForTenant: async () => [blueprint]
    },
    parameterSets: {
      getByReference: async () => ({
        ...parameterSet,
        model_version_ref: overrides.modelVersionRef ?? W5_MODEL_VERSION_REF
      })
    },
    scenarioPackages: {
      assertBindable: async () => undefined,
      getByReference: async () => currentScenario,
      listApprovedForTenant: async () => [currentScenario]
    }
  };
  return { commandSources, sources };
}

function createService(overrides: Parameters<typeof createPorts>[0] = {}) {
  const { commandSources, sources } = createPorts(overrides);
  const coursePackages = new CoursePackageCommandService(
    new CoursePackageJsonRegistry({ now: () => "2026-08-27T20:00:00.000Z" }),
    commandSources
  );
  const activateCourse = vi.fn(async ({ title }: { title: string }) => ({
    course_id: "course_tss_001",
    created_by: "usr_teacher",
    parameter_set_id: parameterReference.parameter_set_id,
    scenario_package_id: scenarioReference.scenario_package_id,
    status: "draft" as const,
    tenant_id: tenantId,
    title
  }));
  return {
    activateCourse,
    service: new TeacherScenarioStudioService({
      activateCourse,
      coursePackages,
      sources
    })
  };
}

describe("TeacherScenarioStudioService", () => {
  it("keeps coupled authoring in the existing CoursePackage writer and activates an exact bundle", async () => {
    const { activateCourse, service } = createService();
    const actor = { actor_id: "usr_teacher", tenant_id: tenantId };
    const created = await service.createDraft(actor, draft);

    expect(created.status).toBe("DRAFT");
    expect(created.studio_configuration.custom_parameters.mode).toBe("DRAFT_ONLY");

    const reference = created.course_package_reference;
    const validated = await service.validate(actor, reference);
    expect(validated.status).toBe("VALIDATED");

    const frozen = await service.freeze(actor, reference);
    expect(frozen.status).toBe("FROZEN");

    const preview = await service.preview(actor, reference);
    expect(preview.role_safe_preview.student_visible).toBe(false);
    expect(preview.role_safe_preview.summary).not.toContain("custom_rate");

    const activated = await service.activate(actor, reference);
    expect(activated.activation.run_activation).toBe("DEFERRED_TO_EXISTING_RUN_WRITER");
    expect(activated.course.course_id).toBe("course_tss_001");
    expect(activateCourse).toHaveBeenCalledWith(
      expect.objectContaining({
        course_blueprint_reference: blueprintReference,
        scenario_package_reference: scenarioReference,
        tenant_id: tenantId
      })
    );
  });

  it("blocks a model version that is not the explicit current authority", async () => {
    const { service } = createService({ modelVersionRef: "other_model@1.0.0" });
    const created = await service.createDraft(
      { actor_id: "usr_teacher", tenant_id: tenantId },
      draft
    );

    await expect(
      service.validate(
        { actor_id: "usr_teacher", tenant_id: tenantId },
        created.course_package_reference
      )
    ).rejects.toEqual(
      new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_MODEL_VERSION_MISMATCH")
    );
  });

  it("blocks a compatibility mismatch before the package lifecycle advances", async () => {
    const { service } = createService({ scenarioFamily: "other" });
    const created = await service.createDraft(
      { actor_id: "usr_teacher", tenant_id: tenantId },
      draft
    );

    await expect(
      service.validate(
        { actor_id: "usr_teacher", tenant_id: tenantId },
        created.course_package_reference
      )
    ).rejects.toEqual(
      new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_COMPATIBILITY_MISMATCH")
    );
  });

  it("rejects implicit latest identities and non-draft custom parameter modes", async () => {
    const { service } = createService();
    await expect(
      service.createDraft(
        { actor_id: "usr_teacher", tenant_id: tenantId },
        { ...draft, version: "latest" }
      )
    ).rejects.toEqual(new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_INPUT_INVALID"));

    await expect(
      service.createDraft(
        { actor_id: "usr_teacher", tenant_id: tenantId },
        {
          ...draft,
          studio_configuration: {
            ...draft.studio_configuration,
            custom_parameters: { mode: "ACTIVATED" as never, values: {} }
          }
        }
      )
    ).rejects.toEqual(
      new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_CUSTOM_PARAMETER_INVALID")
    );
  });
});
