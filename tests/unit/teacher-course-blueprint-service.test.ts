import { describe, expect, it, vi } from "vitest";
import type { Course } from "../../packages/shared-contracts/src/index.js";
import {
  CourseBlueprintCommandService,
  InMemoryJsonCourseBlueprintRegistry,
  type CourseBlueprintDraftInput
} from "../../services/api/src/course-blueprint-authority.js";
import { CourseBlueprintBindingStore } from "../../services/api/src/course-blueprint-binding-store.js";
import { createCourseBlueprintBinding } from "../../services/api/src/course-blueprint-binding.js";
import {
  createTeacherCourseFromBlueprint,
  listTeacherCourseBlueprintCatalog,
  resolveTeacherCourseBlueprintReadiness
} from "../../services/api/src/teacher-course-blueprint-service.js";

const tenantId = "tenant_c1";
const actor = {
  actor_id: "usr_platform",
  capabilities: ["course_blueprint:manage"] as const,
  correlation_id: "corr_c1",
  tenant_id: tenantId
};
const blueprint: CourseBlueprintDraftInput = {
  activity_plan: [{ activity_id: "activity_c1", phase_id: "phase_c1" }],
  course_blueprint_id: "blueprint_c1",
  description: "CourseBlueprint test fixture",
  duration_minutes: 60,
  instructor_guidance_reference: "guide://private-c1",
  objectives: ["Complete the bounded course journey."],
  ordered_phases: [{
    activity_type: "briefing",
    duration_minutes: 60,
    order: 1,
    phase_id: "phase_c1",
    student_instruction: "Read the shared instruction.",
    teacher_guidance: "Private instructor guidance.",
    title: "Briefing"
  }],
  required_product_capabilities: ["course:create"],
  scenario_compatibility_constraints: { scenario_family: "wellness" },
  schema_version: "course-blueprint.v1",
  tenant_id: tenantId,
  title: "C1 Blueprint",
  version: "1.0.0"
};
const scenarioReference = {
  content_digest: "a".repeat(64),
  scenario_package_id: "scenario_c1",
  tenant_id: tenantId,
  version: "1.0.0"
};
const parameterReference = {
  content_digest: "b".repeat(64),
  parameter_set_id: "parameter_c1",
  version: "1.0.0"
};

async function createApprovedBlueprint() {
  const command = new CourseBlueprintCommandService(new InMemoryJsonCourseBlueprintRegistry());
  const draft = await command.createDraft(actor, blueprint);
  const validated = await command.validate(actor, draft.reference);
  const frozen = await command.freeze(actor, validated.reference);
  return { command, approved: await command.approve(actor, frozen.reference, "approval_c1") };
}

function authorities() {
  return {
    parameterSets: {
      assertBindable: vi.fn(async () => undefined),
      getByReference: vi.fn(async () => ({
        model_version_ref: "toy_logit_wellness_v1@0.1.0",
        reference: parameterReference,
        status: "APPROVED",
        tenant_id: tenantId
      }))
    },
    plugins: {
      getByReference: vi.fn(async () => null),
      resolveAvailableForNewBinding: vi.fn(async () => ({ status: "AVAILABLE" }))
    },
    scenarios: {
      assertBindable: vi.fn(async () => undefined),
      getByReference: vi.fn(async () => ({
        parameter_set_reference: parameterReference,
        plugin_dependencies: [],
        reference: scenarioReference,
        status: "APPROVED",
        tenant_id: tenantId
      }))
    }
  };
}

function course(): Course {
  return {
    course_id: "course_c1",
    created_by: "usr_teacher",
    parameter_set_id: parameterReference.parameter_set_id,
    scenario_package_id: scenarioReference.scenario_package_id,
    status: "draft",
    tenant_id: tenantId,
    title: "C1 Course"
  };
}

function bindingStore() {
  return new CourseBlueprintBindingStore({ courseBlueprintBindings: [], persist: () => undefined } as never);
}

describe("Teacher CourseBlueprint product service", () => {
  it("projects an approved tenant catalog without private guidance or approval records", async () => {
    const { command, approved } = await createApprovedBlueprint();
    const catalog = await listTeacherCourseBlueprintCatalog(command, tenantId);
    expect(catalog.candidates).toHaveLength(1);
    expect(catalog.candidates[0]).toMatchObject({
      course_blueprint_reference: approved.version.reference,
      status: "APPROVED",
      title: "C1 Blueprint"
    });
    expect(JSON.stringify(catalog)).not.toContain("Private instructor guidance");
    expect(JSON.stringify(catalog)).not.toContain("approval_c1");
  });

  it("resolves exact Blueprint and B5 inputs before a local selection becomes a course", async () => {
    const { command, approved } = await createApprovedBlueprint();
    const readiness = await resolveTeacherCourseBlueprintReadiness(command, {
      course_blueprint_reference: approved.version.reference,
      formal_course: { authorities: authorities(), scenario_package_reference: scenarioReference, tenant_id: tenantId }
    });
    expect(readiness.selection_status).toBe("READY");
    expect(readiness.blueprint.course_blueprint_reference).toEqual(approved.version.reference);
  });

  it("removes the uncommitted Blueprint binding when B5 creation cannot append its binding", async () => {
    const { command, approved } = await createApprovedBlueprint();
    const c1BindingStore = bindingStore();
    const persisted: Course[] = [];
    await expect(createTeacherCourseFromBlueprint(command, {
      bindingStore: c1BindingStore,
      course: course(),
      course_blueprint_reference: approved.version.reference,
      formalCourse: {
        authorities: authorities(),
        bindingStore: { append: vi.fn(() => { throw new Error("b5 append failure"); }) },
        persistence: {
          deleteCourse: vi.fn(async () => { persisted.length = 0; }),
          saveCourse: vi.fn(async (item) => { persisted.push(item); })
        },
        scenario_package_reference: scenarioReference,
        tenant_id: tenantId
      },
      formal_course: { authorities: authorities(), scenario_package_reference: scenarioReference, tenant_id: tenantId }
    })).rejects.toThrow("b5 append failure");
    expect(persisted).toEqual([]);
    expect(c1BindingStore.getForCourse(tenantId, "course_c1")).toBeNull();
  });

  it("preserves an old exact binding after retirement while rejecting retired versions for new courses", async () => {
    const { command, approved } = await createApprovedBlueprint();
    const c1BindingStore = bindingStore();
    const oldCourse = course();
    c1BindingStore.append(createCourseBlueprintBinding({
      binding_schema_version: "course-blueprint-binding.v1",
      course_blueprint_reference: approved.version.reference,
      course_id: oldCourse.course_id,
      tenant_id: tenantId
    }));
    await command.retire(actor, approved.version.reference);
    expect(c1BindingStore.getForCourse(tenantId, oldCourse.course_id)?.course_blueprint_reference).toEqual(approved.version.reference);
    await expect(resolveTeacherCourseBlueprintReadiness(command, {
      course_blueprint_reference: approved.version.reference,
      formal_course: { authorities: authorities(), scenario_package_reference: scenarioReference, tenant_id: tenantId }
    })).rejects.toMatchObject({ code: "TEACHER_COURSE_BLUEPRINT_NOT_AVAILABLE" });
  });
});
