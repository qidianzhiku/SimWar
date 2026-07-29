import type {
  Course,
  CourseBlueprintReference,
  TeacherCourseBlueprintCatalogDto,
  TeacherCourseBlueprintCatalogItemDto,
  TeacherCourseBlueprintCourseCreateDto,
  TeacherCourseBlueprintReadinessDto
} from "@simwar/shared-contracts";
import {
  CourseBlueprintAuthorityError,
  CourseBlueprintCommandService,
  type CourseBlueprintVersion
} from "./course-blueprint-authority.js";
import { createCourseBlueprintBinding } from "./course-blueprint-binding.js";
import { CourseBlueprintBindingStore } from "./course-blueprint-binding-store.js";
import {
  createTeacherFormalCourse,
  resolveTeacherFormalCourseBindingPreview,
  type CreateTeacherFormalCourseInput
} from "./teacher-formal-course-binding-service.js";

export type TeacherCourseBlueprintFailureCode =
  | "TEACHER_COURSE_BLUEPRINT_INVALID"
  | "TEACHER_COURSE_BLUEPRINT_NOT_AVAILABLE"
  | "TEACHER_COURSE_BLUEPRINT_COMPENSATION_FAILED";

export class TeacherCourseBlueprintError extends Error {
  constructor(readonly code: TeacherCourseBlueprintFailureCode) {
    super(code);
    this.name = "TeacherCourseBlueprintError";
  }
}

export interface TeacherCourseBlueprintReadinessInput {
  course_blueprint_reference: CourseBlueprintReference;
  formal_course: Pick<
    CreateTeacherFormalCourseInput,
    "authorities" | "scenario_package_reference" | "tenant_id"
  >;
}

export interface CreateTeacherCourseFromBlueprintInput extends TeacherCourseBlueprintReadinessInput {
  bindingStore: CourseBlueprintBindingStore;
  course: Course;
  formalCourse: Omit<CreateTeacherFormalCourseInput, "course">;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function createCatalogItem(version: CourseBlueprintVersion): TeacherCourseBlueprintCatalogItemDto {
  return deepFreeze({
    compatibility_constraints: clone(version.scenario_compatibility_constraints),
    content_digest_summary: version.content_digest.slice(0, 12),
    course_blueprint_reference: clone(version.reference),
    duration_minutes: version.duration_minutes,
    objectives_summary: [...version.objectives],
    phases_summary: version.ordered_phases.map((phase) => ({
      duration_minutes: phase.duration_minutes,
      order: phase.order,
      title: phase.title
    })),
    status: "APPROVED" as const,
    title: version.title
  });
}

function mapAuthorityError(error: unknown): never {
  if (error instanceof CourseBlueprintAuthorityError) {
    throw new TeacherCourseBlueprintError("TEACHER_COURSE_BLUEPRINT_NOT_AVAILABLE");
  }
  throw error;
}

export async function listTeacherCourseBlueprintCatalog(
  command: CourseBlueprintCommandService,
  tenantId: string
): Promise<TeacherCourseBlueprintCatalogDto> {
  const candidates = await command.listApprovedForTenant(tenantId);
  return deepFreeze({
    candidates: candidates.map(createCatalogItem),
    operation_id: "TEACHER_COURSE_BLUEPRINT_CATALOG_V1" as const
  });
}

export async function resolveTeacherCourseBlueprintReadiness(
  command: CourseBlueprintCommandService,
  input: TeacherCourseBlueprintReadinessInput
): Promise<TeacherCourseBlueprintReadinessDto> {
  if (
    input.course_blueprint_reference.tenant_id !== input.formal_course.tenant_id ||
    input.formal_course.scenario_package_reference.tenant_id !== input.formal_course.tenant_id
  ) {
    throw new TeacherCourseBlueprintError("TEACHER_COURSE_BLUEPRINT_INVALID");
  }
  try {
    await command.assertBindable(input.formal_course.tenant_id, input.course_blueprint_reference);
    const blueprint = await command.getByReference(
      input.formal_course.tenant_id,
      input.course_blueprint_reference
    );
    if (!blueprint || blueprint.status !== "APPROVED") {
      throw new TeacherCourseBlueprintError("TEACHER_COURSE_BLUEPRINT_NOT_AVAILABLE");
    }
    const formal_course_binding = await resolveTeacherFormalCourseBindingPreview(input.formal_course);
    return deepFreeze({
      blueprint: createCatalogItem(blueprint),
      formal_course_binding: clone(formal_course_binding),
      operation_id: "TEACHER_COURSE_BLUEPRINT_READINESS_V1" as const,
      selection_status: "READY" as const
    });
  } catch (error) {
    if (error instanceof TeacherCourseBlueprintError) throw error;
    mapAuthorityError(error);
  }
}

/**
 * JSON runtime uses bounded compensation: a C1 binding is removed only when B5
 * course creation fails before the Course becomes a visible product record.
 * This is intentionally not a crash-safe durable transaction.
 */
export async function createTeacherCourseFromBlueprint(
  command: CourseBlueprintCommandService,
  input: CreateTeacherCourseFromBlueprintInput
): Promise<TeacherCourseBlueprintCourseCreateDto> {
  const readiness = await resolveTeacherCourseBlueprintReadiness(command, input);
  const binding = createCourseBlueprintBinding({
    binding_schema_version: "course-blueprint-binding.v1",
    course_blueprint_reference: readiness.blueprint.course_blueprint_reference,
    course_id: input.course.course_id,
    tenant_id: input.course.tenant_id
  });
  const pendingBinding = input.bindingStore.appendPending(binding);

  try {
    const created = await createTeacherFormalCourse({
      ...input.formalCourse,
      course: input.course
    });
    input.bindingStore.commitPending(pendingBinding);
    return deepFreeze({
      binding_summary: { course_blueprint_reference: clone(binding.course_blueprint_reference) },
      course: clone(input.course),
      formal_binding_summary: clone(created.summary),
      operation_id: "TEACHER_COURSE_BLUEPRINT_COURSE_CREATE_V1" as const
    });
  } catch (error) {
    try {
      input.bindingStore.removeUncommitted(pendingBinding);
    } catch {
      throw new TeacherCourseBlueprintError("TEACHER_COURSE_BLUEPRINT_COMPENSATION_FAILED");
    }
    throw error;
  }
}
