import { describe, expect, it, vi } from "vitest";
import type { Course } from "../../packages/shared-contracts/src/index.js";
import {
  createTeacherFormalCourse,
  resolveTeacherFormalCourseBindingPreview,
  TeacherFormalCourseBindingError
} from "../../services/api/src/teacher-formal-course-binding-service.js";

const tenantId = "tenant_demo";
const scenarioReference = {
  content_digest: "a".repeat(64),
  scenario_package_id: "scenario_b5_001",
  tenant_id: tenantId,
  version: "1.0.0"
};
const parameterReference = {
  content_digest: "b".repeat(64),
  parameter_set_id: "parameter_b5_001",
  version: "1.0.0"
};

function createAuthorities(
  options: {
    modelVersionRef?: string;
    parameterStatus?: "APPROVED" | "RETIRED";
    pluginAvailable?: boolean;
    scenarioStatus?: "APPROVED" | "RETIRED";
  } = {}
) {
  return {
    parameterSets: {
      assertBindable: vi.fn(async () => undefined),
      getByReference: vi.fn(async () => ({
        reference: parameterReference,
        model_version_ref: options.modelVersionRef ?? "toy_logit_wellness_v1@0.1.0",
        status: options.parameterStatus ?? "APPROVED",
        tenant_id: tenantId
      }))
    },
    plugins: {
      getByReference: vi.fn(async () => null),
      resolveAvailableForNewBinding: vi.fn(async () =>
        options.pluginAvailable === false
          ? null
          : {
              plugin_package_id: "generic-plugin",
              version: "1.0.0",
              status: "AVAILABLE",
              reference: {
                content_digest: "c".repeat(64),
                plugin_package_id: "generic-plugin",
                version: "1.0.0"
              },
              compatibility_metadata: {},
              plugin_manifest: { plugin_id: "generic-plugin", version: "1.0.0" },
              schema_version: "plugin-release.v1"
            }
      )
    },
    scenarios: {
      assertBindable: vi.fn(async () => undefined),
      getByReference: vi.fn(async () => ({
        reference: scenarioReference,
        parameter_set_reference: parameterReference,
        plugin_dependencies: [{ plugin_package_id: "generic-plugin", version: "1.0.0" }],
        status: options.scenarioStatus ?? "APPROVED",
        tenant_id: tenantId
      }))
    }
  };
}

function createCourse(): Course {
  return {
    course_id: "course_b5_001",
    created_by: "usr_teacher",
    parameter_set_id: parameterReference.parameter_set_id,
    scenario_package_id: scenarioReference.scenario_package_id,
    status: "draft",
    tenant_id: tenantId,
    title: "B5 formal Course"
  };
}

describe("Teacher formal Course binding service", () => {
  it("returns a server-derived exact preview from an approved ScenarioPackage", async () => {
    const preview = await resolveTeacherFormalCourseBindingPreview({
      authorities: createAuthorities(),
      scenario_package_reference: scenarioReference,
      tenant_id: tenantId
    });

    expect(preview).toMatchObject({
      engine_profile: {
        engine_id: "toy_logit_wellness_v1",
        model_version_ref: "toy_logit_wellness_v1@0.1.0",
        runtime_authority: "JSON_INTERNAL_ONLY",
        version: "0.1.0"
      },
      parameter_set_reference: parameterReference,
      scenario_package_reference: scenarioReference,
      selection_status: "READY"
    });
  });

  it("fails closed when the selected ScenarioPackage cannot match the active exact Engine profile", async () => {
    await expect(
      resolveTeacherFormalCourseBindingPreview({
        authorities: createAuthorities({ modelVersionRef: "latest" }),
        scenario_package_reference: scenarioReference,
        tenant_id: tenantId
      })
    ).rejects.toMatchObject<TeacherFormalCourseBindingError>({
      code: "TEACHER_FORMAL_COURSE_BINDING_ENGINE_INCOMPATIBLE"
    });
  });

  it("does not persist a Course when its binding append fails", async () => {
    const persisted: Course[] = [];
    const remove = vi.fn(async () => {
      persisted.length = 0;
    });

    await expect(
      createTeacherFormalCourse({
        authorities: createAuthorities(),
        bindingStore: {
          append: vi.fn(() => {
            throw new Error("append failed");
          })
        },
        course: createCourse(),
        persistence: {
          deleteCourse: remove,
          saveCourse: vi.fn(async (course) => {
            persisted.push(course);
          })
        },
        scenario_package_reference: scenarioReference,
        tenant_id: tenantId
      })
    ).rejects.toThrow("append failed");

    expect(persisted).toEqual([]);
    expect(remove).toHaveBeenCalledWith(tenantId, "course_b5_001");
  });

  it("does not write when validation rejects a retired ScenarioPackage", async () => {
    const saveCourse = vi.fn(async () => undefined);
    await expect(
      createTeacherFormalCourse({
        authorities: createAuthorities({ scenarioStatus: "RETIRED" }),
        bindingStore: { append: vi.fn() },
        course: createCourse(),
        persistence: { deleteCourse: vi.fn(async () => undefined), saveCourse },
        scenario_package_reference: scenarioReference,
        tenant_id: tenantId
      })
    ).rejects.toMatchObject<TeacherFormalCourseBindingError>({
      code: "TEACHER_FORMAL_COURSE_BINDING_NOT_AVAILABLE"
    });
    expect(saveCourse).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant, non-approved ParameterSet, and unavailable Plugin selections before writes", async () => {
    const saveCourse = vi.fn(async () => undefined);
    const createInput = (authorities: ReturnType<typeof createAuthorities>, tenant = tenantId) =>
      createTeacherFormalCourse({
        authorities,
        bindingStore: { append: vi.fn() },
        course: createCourse(),
        persistence: { deleteCourse: vi.fn(async () => undefined), saveCourse },
        scenario_package_reference: scenarioReference,
        tenant_id: tenant
      });

    await expect(createInput(createAuthorities(), "tenant_other")).rejects.toBeDefined();
    await expect(
      createInput(createAuthorities({ parameterStatus: "RETIRED" }))
    ).rejects.toBeDefined();
    await expect(createInput(createAuthorities({ pluginAvailable: false }))).rejects.toBeDefined();
    expect(saveCourse).not.toHaveBeenCalled();
  });

  it("does not append a binding when Course persistence fails", async () => {
    const append = vi.fn();
    await expect(
      createTeacherFormalCourse({
        authorities: createAuthorities(),
        bindingStore: { append },
        course: createCourse(),
        persistence: {
          deleteCourse: vi.fn(async () => undefined),
          saveCourse: vi.fn(async () => {
            throw new Error("course write failed");
          })
        },
        scenario_package_reference: scenarioReference,
        tenant_id: tenantId
      })
    ).rejects.toThrow("course write failed");
    expect(append).not.toHaveBeenCalled();
  });
});
