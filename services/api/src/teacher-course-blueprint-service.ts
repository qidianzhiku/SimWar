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
  type CourseBlueprintAuthorityActor,
  type CourseBlueprintDraftInput,
  type CourseBlueprintVersion
} from "./course-blueprint-authority.js";
import { createCourseBlueprintBinding } from "./course-blueprint-binding.js";
import type { CourseBlueprintBindingPort } from "./course-blueprint-binding-store.js";
import {
  createTeacherFormalCourse,
  resolveTeacherFormalCourseBindingPreview,
  type CreateTeacherFormalCourseInput
} from "./teacher-formal-course-binding-service.js";

const AVAILABLE_C1_PRODUCT_CAPABILITIES = new Set([
  "course:create",
  "decision_submit",
  "round_publish"
]);

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
  beforeCommit?: () => Promise<void>;
  bindingStore: CourseBlueprintBindingPort;
  course: Course;
  formalCourse: Omit<CreateTeacherFormalCourseInput, "course">;
}

export type TeacherCourseBlueprintEditableContent = Omit<
  CourseBlueprintDraftInput,
  "course_blueprint_id" | "tenant_id"
>;

export interface TeacherCourseBlueprintStudioPreview {
  content_digest: string;
  course_blueprint_reference: CourseBlueprintReference;
  editable_content: TeacherCourseBlueprintEditableContent;
  status: "APPROVED" | "DRAFT" | "VALIDATED";
}

export interface CreateTeacherCourseBlueprintDraftInput {
  draft: TeacherCourseBlueprintEditableContent;
  source_course_blueprint_reference: CourseBlueprintReference;
}

export interface TeacherCourseBlueprintStudioDraft {
  content_digest: string;
  course_blueprint_reference: CourseBlueprintReference;
  source_course_blueprint_reference: CourseBlueprintReference;
  status: "DRAFT";
  title: string;
  version: string;
}

export interface TeacherCourseBlueprintStudioSubmission {
  course_blueprint_reference: CourseBlueprintReference;
  status: "VALIDATED";
}

function createStudioDraftResult(
  draft: CourseBlueprintVersion,
  source: CourseBlueprintVersion
): TeacherCourseBlueprintStudioDraft {
  return deepFreeze({
    content_digest: draft.content_digest,
    course_blueprint_reference: clone(draft.reference),
    source_course_blueprint_reference: clone(source.reference),
    status: "DRAFT" as const,
    title: draft.title,
    version: draft.version
  });
}

function createStudioSubmissionResult(
  validated: CourseBlueprintVersion
): TeacherCourseBlueprintStudioSubmission {
  return deepFreeze({
    course_blueprint_reference: clone(validated.reference),
    status: "VALIDATED" as const
  });
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
    if (error.code === "COURSE_BLUEPRINT_VERSION_ALREADY_EXISTS") {
      throw new TeacherCourseBlueprintError("TEACHER_COURSE_BLUEPRINT_INVALID");
    }
    throw new TeacherCourseBlueprintError("TEACHER_COURSE_BLUEPRINT_NOT_AVAILABLE");
  }
  throw error;
}

function createEditableContent(
  version: CourseBlueprintVersion
): TeacherCourseBlueprintEditableContent {
  return clone({
    activity_plan: version.activity_plan,
    description: version.description,
    duration_minutes: version.duration_minutes,
    instructor_guidance_reference: version.instructor_guidance_reference,
    objectives: version.objectives,
    ordered_phases: version.ordered_phases,
    required_product_capabilities: version.required_product_capabilities,
    scenario_compatibility_constraints: version.scenario_compatibility_constraints,
    schema_version: version.schema_version,
    title: version.title,
    version: version.version
  });
}

export async function previewTeacherCourseBlueprint(
  command: CourseBlueprintCommandService,
  tenantId: string,
  reference: CourseBlueprintReference
): Promise<TeacherCourseBlueprintStudioPreview> {
  if (reference.tenant_id !== tenantId) {
    throw new TeacherCourseBlueprintError("TEACHER_COURSE_BLUEPRINT_INVALID");
  }
  try {
    const version = await command.getByReference(tenantId, reference);
    if (!version || !["APPROVED", "DRAFT", "VALIDATED"].includes(version.status)) {
      throw new TeacherCourseBlueprintError("TEACHER_COURSE_BLUEPRINT_NOT_AVAILABLE");
    }
    return deepFreeze({
      content_digest: version.content_digest,
      course_blueprint_reference: clone(version.reference),
      editable_content: createEditableContent(version),
      status: version.status
    } as TeacherCourseBlueprintStudioPreview);
  } catch (error) {
    if (error instanceof TeacherCourseBlueprintError) throw error;
    mapAuthorityError(error);
  }
}

export async function createTeacherCourseBlueprintDraft(
  command: CourseBlueprintCommandService,
  actor: CourseBlueprintAuthorityActor,
  input: CreateTeacherCourseBlueprintDraftInput,
  postAppend?: (created: TeacherCourseBlueprintStudioDraft) => Promise<void>
): Promise<TeacherCourseBlueprintStudioDraft> {
  if (
    input.source_course_blueprint_reference.tenant_id !== actor.tenant_id ||
    !input.draft.version.trim()
  ) {
    throw new TeacherCourseBlueprintError("TEACHER_COURSE_BLUEPRINT_INVALID");
  }
  try {
    const { draft, source } = await command.createDraftFromApprovedSource(
      actor,
      input.source_course_blueprint_reference,
      {
        ...clone(input.draft),
        course_blueprint_id: input.source_course_blueprint_reference.course_blueprint_id,
        schema_version: input.draft.schema_version,
        tenant_id: actor.tenant_id
      },
      postAppend
        ? ({ draft: created, source: approvedSource }) =>
            postAppend(createStudioDraftResult(created, approvedSource))
        : undefined
    );
    return createStudioDraftResult(draft, source);
  } catch (error) {
    if (error instanceof TeacherCourseBlueprintError) throw error;
    mapAuthorityError(error);
  }
}

export async function submitTeacherCourseBlueprintDraft(
  command: CourseBlueprintCommandService,
  actor: CourseBlueprintAuthorityActor,
  reference: CourseBlueprintReference,
  postAppend?: (submitted: TeacherCourseBlueprintStudioSubmission) => Promise<void>
): Promise<TeacherCourseBlueprintStudioSubmission> {
  if (reference.tenant_id !== actor.tenant_id) {
    throw new TeacherCourseBlueprintError("TEACHER_COURSE_BLUEPRINT_INVALID");
  }
  try {
    const validated = await command.validate(
      actor,
      reference,
      postAppend ? (next) => postAppend(createStudioSubmissionResult(next)) : undefined
    );
    return createStudioSubmissionResult(validated);
  } catch (error) {
    mapAuthorityError(error);
  }
}

async function assertBlueprintCompatibility(
  blueprint: CourseBlueprintVersion,
  input: TeacherCourseBlueprintReadinessInput
): Promise<void> {
  if (
    blueprint.required_product_capabilities.some(
      (capability) => !AVAILABLE_C1_PRODUCT_CAPABILITIES.has(capability)
    )
  ) {
    throw new TeacherCourseBlueprintError("TEACHER_COURSE_BLUEPRINT_NOT_AVAILABLE");
  }

  const scenario = await input.formal_course.authorities.scenarios.getByReference(
    input.formal_course.tenant_id,
    input.formal_course.scenario_package_reference
  );
  if (
    !scenario ||
    Object.entries(blueprint.scenario_compatibility_constraints).some(
      ([key, value]) => scenario.compatibility_metadata[key] !== value
    )
  ) {
    throw new TeacherCourseBlueprintError("TEACHER_COURSE_BLUEPRINT_NOT_AVAILABLE");
  }
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
    await assertBlueprintCompatibility(blueprint, input);
    const formal_course_binding = await resolveTeacherFormalCourseBindingPreview(
      input.formal_course
    );
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
  const pendingBinding = await input.bindingStore.appendPending(binding);

  try {
    const created = await createTeacherFormalCourse({
      ...input.formalCourse,
      ...(input.beforeCommit ? { beforeCommit: input.beforeCommit } : {}),
      course: input.course
    });
    await input.bindingStore.commitPending(pendingBinding);
    return deepFreeze({
      binding_summary: { course_blueprint_reference: clone(binding.course_blueprint_reference) },
      course: clone(input.course),
      formal_binding_summary: clone(created.summary),
      operation_id: "TEACHER_COURSE_BLUEPRINT_COURSE_CREATE_V1" as const
    });
  } catch (error) {
    try {
      await input.bindingStore.removeUncommitted(pendingBinding);
    } catch {
      throw new TeacherCourseBlueprintError("TEACHER_COURSE_BLUEPRINT_COMPENSATION_FAILED");
    }
    throw error;
  }
}
