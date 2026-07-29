import { describe, expect, it, vi } from "vitest";
import type { Course } from "../../packages/shared-contracts/src/index.js";
import {
  CourseBlueprintCommandService,
  InMemoryJsonCourseBlueprintRegistry,
  type CourseBlueprintDraftInput
} from "../../services/api/src/course-blueprint-authority.js";
import { CourseBlueprintBindingStore } from "../../services/api/src/course-blueprint-binding-store.js";
import { FormalCourseAuthorityBindingStore } from "../../services/api/src/formal-course-authority-binding-store.js";
import { createCourseBlueprintBinding } from "../../services/api/src/course-blueprint-binding.js";
import {
  createTeacherCourseFromBlueprint,
  listTeacherCourseBlueprintCatalog,
  resolveTeacherCourseBlueprintReadiness
} from "../../services/api/src/teacher-course-blueprint-service.js";
import { createJsonRepositoryPorts } from "../../services/api/src/json-repository-adapter.js";
import { createP1Store } from "../../services/api/src/store.js";

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
        compatibility_metadata: { scenario_family: "wellness" },
        parameter_set_reference: parameterReference,
        plugin_dependencies: [],
        reference: scenarioReference,
        status: "APPROVED",
        tenant_id: tenantId
      }))
    }
  };
}

function createCourseInput(
  command: CourseBlueprintCommandService,
  reference: Awaited<ReturnType<typeof createApprovedBlueprint>>["approved"]["version"]["reference"],
  options: {
    authorityPorts?: ReturnType<typeof authorities>;
    bindingStore?: CourseBlueprintBindingStore;
    deleteCourse?: (tenantId: string, courseId: string) => Promise<void>;
    formalBindingAppend?: () => void;
    saveCourse?: (item: Course) => Promise<void>;
  } = {}
) {
  const authorityPorts = options.authorityPorts ?? authorities();
  return {
    bindingStore: options.bindingStore ?? bindingStore(),
    course: course(),
    course_blueprint_reference: reference,
    formalCourse: {
      authorities: authorityPorts,
      bindingStore: { append: vi.fn(options.formalBindingAppend ?? (() => undefined)) },
      persistence: {
        deleteCourse: vi.fn(options.deleteCourse ?? (async () => undefined)),
        saveCourse: vi.fn(options.saveCourse ?? (async () => undefined))
      },
      scenario_package_reference: scenarioReference,
      tenant_id: tenantId
    },
    formal_course: {
      authorities: authorityPorts,
      scenario_package_reference: scenarioReference,
      tenant_id: tenantId
    }
  } satisfies Parameters<typeof createTeacherCourseFromBlueprint>[1];
}

function authoritiesWithScenarioCompatibility(
  compatibilityMetadata: Readonly<Record<string, string>>
) {
  const ports = authorities();
  ports.scenarios.getByReference = vi.fn(async () => ({
    compatibility_metadata: compatibilityMetadata,
    parameter_set_reference: parameterReference,
    plugin_dependencies: [],
    reference: scenarioReference,
    status: "APPROVED" as const,
    tenant_id: tenantId
  }));
  return ports;
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

  it("rejects a ScenarioPackage that does not satisfy Blueprint compatibility constraints", async () => {
    const { command, approved } = await createApprovedBlueprint();
    await expect(resolveTeacherCourseBlueprintReadiness(command, {
      course_blueprint_reference: approved.version.reference,
      formal_course: {
        authorities: authoritiesWithScenarioCompatibility({ scenario_family: "manufacturing" }),
        scenario_package_reference: scenarioReference,
        tenant_id: tenantId
      }
    })).rejects.toMatchObject({ code: "TEACHER_COURSE_BLUEPRINT_NOT_AVAILABLE" });
  });

  it("rejects a Blueprint that requires an unavailable product capability", async () => {
    const command = new CourseBlueprintCommandService(new InMemoryJsonCourseBlueprintRegistry());
    const draft = await command.createDraft(actor, {
      ...blueprint,
      course_blueprint_id: "blueprint_unsupported_capability",
      required_product_capabilities: ["course:create", "future:unsupported"]
    });
    const validated = await command.validate(actor, draft.reference);
    const frozen = await command.freeze(actor, validated.reference);
    const approved = await command.approve(actor, frozen.reference, "approval_unsupported");

    await expect(resolveTeacherCourseBlueprintReadiness(command, {
      course_blueprint_reference: approved.version.reference,
      formal_course: {
        authorities: authorities(),
        scenario_package_reference: scenarioReference,
        tenant_id: tenantId
      }
    })).rejects.toMatchObject({ code: "TEACHER_COURSE_BLUEPRINT_NOT_AVAILABLE" });
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

  it("classifies a failed Course cleanup without retaining an uncommitted Blueprint binding", async () => {
    const { command, approved } = await createApprovedBlueprint();
    const c1BindingStore = bindingStore();
    const persisted: Course[] = [];

    await expect(createTeacherCourseFromBlueprint(
      command,
      createCourseInput(command, approved.version.reference, {
        bindingStore: c1BindingStore,
        deleteCourse: async () => {
          throw new Error("course cleanup failed");
        },
        formalBindingAppend: () => {
          throw new Error("b5 append failure");
        },
        saveCourse: async (item) => {
          persisted.push(item);
        }
      })
    )).rejects.toThrow("course cleanup failed");

    expect(c1BindingStore.getForCourse(tenantId, "course_c1")).toBeNull();
    expect(persisted).toEqual([course()]);
  });

  it("does not create a Course or B5 binding when the Blueprint binding append cannot persist", async () => {
    const { command, approved } = await createApprovedBlueprint();
    const failingStore = new CourseBlueprintBindingStore({
      courseBlueprintBindings: [],
      persist: () => {
        throw new Error("blueprint binding persist failed");
      }
    } as never);
    const saveCourse = vi.fn(async () => undefined);
    const appendFormalBinding = vi.fn();

    await expect(createTeacherCourseFromBlueprint(
      command,
      createCourseInput(command, approved.version.reference, {
        bindingStore: failingStore,
        formalBindingAppend: appendFormalBinding,
        saveCourse
      })
    )).rejects.toThrow("blueprint binding persist failed");

    expect(failingStore.getForCourse(tenantId, "course_c1")).toBeNull();
    expect(saveCourse).not.toHaveBeenCalled();
    expect(appendFormalBinding).not.toHaveBeenCalled();
  });

  it("removes the pending Blueprint binding when Course persistence fails", async () => {
    const { command, approved } = await createApprovedBlueprint();
    const c1BindingStore = bindingStore();
    const appendFormalBinding = vi.fn();

    await expect(createTeacherCourseFromBlueprint(
      command,
      createCourseInput(command, approved.version.reference, {
        bindingStore: c1BindingStore,
        formalBindingAppend: appendFormalBinding,
        saveCourse: async () => {
          throw new Error("course save failed");
        }
      })
    )).rejects.toThrow("course save failed");

    expect(c1BindingStore.getForCourse(tenantId, "course_c1")).toBeNull();
    expect(appendFormalBinding).not.toHaveBeenCalled();
  });

  it("rolls back a real JSON Course mutation when persistence fails", async () => {
    const store = createP1Store();
    store.courses.length = 0;
    store.persist = vi.fn(() => {
      throw new Error("course persist failed");
    });
    const ports = createJsonRepositoryPorts(store);

    await expect(ports.courses.saveCourse(course())).rejects.toThrow("course persist failed");
    expect(store.courses).toEqual([]);
  });

  it("rolls back a real JSON audit mutation when persistence fails", async () => {
    const store = createP1Store();
    store.auditLogs.length = 0;
    store.persist = vi.fn(() => {
      throw new Error("audit persist failed");
    });
    const ports = createJsonRepositoryPorts(store);

    await expect(ports.auditLogs.appendAuditLog({
      action: "course.create",
      actor_id: "usr_teacher",
      audit_id: "audit_c1",
      created_at: "2026-07-29T00:00:00.000Z",
      request_id: "request_c1",
      resource_id: "course_c1",
      resource_type: "course",
      tenant_id: tenantId
    })).rejects.toThrow("audit persist failed");
    expect(store.auditLogs).toEqual([]);
  });

  it("compensates Course and both bindings when a pre-commit side effect fails", async () => {
    const { command, approved } = await createApprovedBlueprint();
    const store = createP1Store();
    store.courses.length = 0;
    store.formalCourseAuthorityBindings.length = 0;
    store.courseBlueprintBindings.length = 0;
    const c1BindingStore = new CourseBlueprintBindingStore(store);
    const ports = createJsonRepositoryPorts(store);

    await expect(createTeacherCourseFromBlueprint(
      command,
      {
        ...createCourseInput(command, approved.version.reference, {
          bindingStore: c1BindingStore
        }),
        beforeCommit: async () => {
          throw new Error("audit persist failed");
        },
        formalCourse: {
          ...createCourseInput(command, approved.version.reference).formalCourse,
          bindingStore: new FormalCourseAuthorityBindingStore(store),
          persistence: ports.courses
        }
      }
    )).rejects.toThrow("audit persist failed");

    expect(store.courses).toEqual([]);
    expect(store.formalCourseAuthorityBindings).toEqual([]);
    expect(store.courseBlueprintBindings).toEqual([]);
  });

  it.each([
    {
      name: "Scenario unavailable",
      mutate: (ports: ReturnType<typeof authorities>) => {
        ports.scenarios.getByReference = vi.fn(async () => null);
      }
    },
    {
      name: "Plugin unavailable",
      mutate: (ports: ReturnType<typeof authorities>) => {
        ports.scenarios.getByReference = vi.fn(async () => ({
          compatibility_metadata: { scenario_family: "wellness" },
          parameter_set_reference: parameterReference,
          plugin_dependencies: [{ plugin_package_id: "missing_plugin", version: "1.0.0" }],
          reference: scenarioReference,
          status: "APPROVED" as const,
          tenant_id: tenantId
        }));
        ports.plugins.resolveAvailableForNewBinding = vi.fn(async () => null);
      }
    },
    {
      name: "Engine incompatible",
      mutate: (ports: ReturnType<typeof authorities>) => {
        ports.parameterSets.getByReference = vi.fn(async () => ({
          model_version_ref: "different_engine@9.9.9",
          reference: parameterReference,
          status: "APPROVED" as const,
          tenant_id: tenantId
        }));
      }
    }
  ])("leaves zero Course and binding residue when $name", async ({ mutate }) => {
    const { command, approved } = await createApprovedBlueprint();
    const authorityPorts = authorities();
    mutate(authorityPorts);
    const c1BindingStore = bindingStore();
    const saveCourse = vi.fn(async () => undefined);
    const appendFormalBinding = vi.fn();

    await expect(createTeacherCourseFromBlueprint(
      command,
      createCourseInput(command, approved.version.reference, {
        authorityPorts,
        bindingStore: c1BindingStore,
        formalBindingAppend: appendFormalBinding,
        saveCourse
      })
    )).rejects.toBeDefined();

    expect(c1BindingStore.getForCourse(tenantId, "course_c1")).toBeNull();
    expect(saveCourse).not.toHaveBeenCalled();
    expect(appendFormalBinding).not.toHaveBeenCalled();
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

  it("keeps a v1 Course binding unchanged when v2 is approved and v1 is retired", async () => {
    const { command, approved: approvedV1 } = await createApprovedBlueprint();
    const c1BindingStore = bindingStore();
    c1BindingStore.append(createCourseBlueprintBinding({
      binding_schema_version: "course-blueprint-binding.v1",
      course_blueprint_reference: approvedV1.version.reference,
      course_id: "course_v1",
      tenant_id: tenantId
    }));

    const draftV2 = await command.createDraft(actor, {
      ...blueprint,
      title: "C1 Blueprint v2",
      version: "2.0.0"
    });
    const validatedV2 = await command.validate(actor, draftV2.reference);
    const frozenV2 = await command.freeze(actor, validatedV2.reference);
    const approvedV2 = await command.approve(actor, frozenV2.reference, "approval_c1_v2");
    await command.retire(actor, approvedV1.version.reference);

    expect(c1BindingStore.getForCourse(tenantId, "course_v1")?.course_blueprint_reference)
      .toEqual(approvedV1.version.reference);
    expect(approvedV2.version.reference).not.toEqual(approvedV1.version.reference);
    await expect(command.assertBindable(tenantId, approvedV2.version.reference)).resolves.toBeUndefined();
  });
});
