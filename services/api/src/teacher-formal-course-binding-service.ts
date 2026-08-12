import type {
  Course,
  FormalRunEngineReference,
  ParameterSetReference,
  ScenarioPackageReference,
  TeacherFormalCourseBindingPreviewDto,
  TeacherFormalCourseBindingSummaryDto
} from "@simwar/shared-contracts";
import {
  createFormalCourseAuthorityBinding,
  type FormalCourseAuthorityBinding
} from "./formal-course-authority-binding.js";
import type {
  FormalCourseAuthorityBindingPort,
  PendingFormalCourseAuthorityBinding
} from "./formal-course-authority-binding-store.js";
import type { FormalRunBindingAuthorityPorts } from "./formal-run-runtime-binding.js";
import { getActiveJsonRuntimeEngineProfile } from "./formal-runtime-input-resolver.js";

export type TeacherFormalCourseBindingFailureCode =
  | "TEACHER_FORMAL_COURSE_BINDING_ENGINE_INCOMPATIBLE"
  | "TEACHER_FORMAL_COURSE_BINDING_INVALID"
  | "TEACHER_FORMAL_COURSE_BINDING_NOT_AVAILABLE";

export class TeacherFormalCourseBindingError extends Error {
  constructor(readonly code: TeacherFormalCourseBindingFailureCode) {
    super(code);
    this.name = "TeacherFormalCourseBindingError";
  }
}

export interface TeacherFormalCoursePersistence {
  deleteCourse(tenantId: string, courseId: string): Promise<void>;
  saveCourse(course: Course): Promise<void>;
}

export interface TeacherFormalCourseBindingPreviewInput {
  authorities: FormalRunBindingAuthorityPorts;
  scenario_package_reference: ScenarioPackageReference;
  tenant_id: string;
}

export interface CreateTeacherFormalCourseInput extends TeacherFormalCourseBindingPreviewInput {
  beforeCommit?: () => Promise<void>;
  course: Course;
  persistence: TeacherFormalCoursePersistence;
  bindingStore: FormalCourseAuthorityBindingPort;
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

function sameScenarioReference(
  left: ScenarioPackageReference,
  right: ScenarioPackageReference
): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.scenario_package_id === right.scenario_package_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function createSummary(
  binding: FormalCourseAuthorityBinding
): TeacherFormalCourseBindingSummaryDto {
  return deepFreeze({
    engine_reference: clone(binding.engine_reference),
    parameter_set_reference: clone(binding.parameter_set_reference),
    scenario_package_reference: clone(binding.scenario_package_reference)
  });
}

export async function resolveTeacherFormalCourseBindingPreview(
  input: TeacherFormalCourseBindingPreviewInput
): Promise<TeacherFormalCourseBindingPreviewDto> {
  const engineProfile = getActiveJsonRuntimeEngineProfile();
  if (input.scenario_package_reference.tenant_id !== input.tenant_id) {
    throw new TeacherFormalCourseBindingError("TEACHER_FORMAL_COURSE_BINDING_INVALID");
  }

  try {
    await input.authorities.scenarios.assertBindable(
      input.tenant_id,
      input.scenario_package_reference
    );
    const scenario = await input.authorities.scenarios.getByReference(
      input.tenant_id,
      input.scenario_package_reference
    );
    if (
      !scenario ||
      scenario.status !== "APPROVED" ||
      !sameScenarioReference(scenario.reference, input.scenario_package_reference)
    ) {
      throw new TeacherFormalCourseBindingError("TEACHER_FORMAL_COURSE_BINDING_NOT_AVAILABLE");
    }

    await input.authorities.parameterSets.assertBindable(
      input.tenant_id,
      scenario.parameter_set_reference
    );
    const parameterSet = await input.authorities.parameterSets.getByReference(
      input.tenant_id,
      scenario.parameter_set_reference
    );
    if (!parameterSet || parameterSet.status !== "APPROVED") {
      throw new TeacherFormalCourseBindingError("TEACHER_FORMAL_COURSE_BINDING_NOT_AVAILABLE");
    }
    if (parameterSet.model_version_ref !== engineProfile.model_version_ref) {
      throw new TeacherFormalCourseBindingError(
        "TEACHER_FORMAL_COURSE_BINDING_ENGINE_INCOMPATIBLE"
      );
    }

    const plugins = await Promise.all(
      scenario.plugin_dependencies.map((dependency) =>
        input.authorities.plugins.resolveAvailableForNewBinding(
          dependency.plugin_package_id,
          dependency.version
        )
      )
    );
    if (plugins.some((plugin) => !plugin || plugin.status !== "AVAILABLE")) {
      throw new TeacherFormalCourseBindingError("TEACHER_FORMAL_COURSE_BINDING_NOT_AVAILABLE");
    }

    return deepFreeze({
      engine_profile: clone(engineProfile),
      parameter_set_reference: clone(parameterSet.reference),
      plugin_dependencies: scenario.plugin_dependencies.map((dependency) => ({ ...dependency })),
      scenario_package_reference: clone(scenario.reference),
      selection_status: "READY"
    });
  } catch (error) {
    if (error instanceof TeacherFormalCourseBindingError) {
      throw error;
    }
    throw new TeacherFormalCourseBindingError("TEACHER_FORMAL_COURSE_BINDING_NOT_AVAILABLE");
  }
}

export async function createTeacherFormalCourse(input: CreateTeacherFormalCourseInput): Promise<{
  binding: FormalCourseAuthorityBinding;
  summary: TeacherFormalCourseBindingSummaryDto;
}> {
  const preview = await resolveTeacherFormalCourseBindingPreview(input);
  const engineReference: FormalRunEngineReference = {
    engine_id: preview.engine_profile.engine_id,
    version: preview.engine_profile.version
  };
  const parameterReference: ParameterSetReference = preview.parameter_set_reference;
  const binding = await createFormalCourseAuthorityBinding({
    authorities: input.authorities,
    course_id: input.course.course_id,
    engine_reference: engineReference,
    parameter_set_reference: parameterReference,
    scenario_package_reference: preview.scenario_package_reference,
    tenant_id: input.tenant_id
  });

  let coursePersisted = false;
  let pendingBinding: PendingFormalCourseAuthorityBinding | undefined;
  try {
    await input.persistence.saveCourse(input.course);
    coursePersisted = true;
    if (input.beforeCommit) {
      if (
        !input.bindingStore.appendPending ||
        !input.bindingStore.commitPending ||
        !input.bindingStore.removeUncommitted
      ) {
        throw new Error("formal_course_authority_binding_transaction_required");
      }
      pendingBinding = await input.bindingStore.appendPending(binding);
      await input.beforeCommit();
      await input.bindingStore.commitPending(pendingBinding);
    } else {
      await input.bindingStore.append(binding);
    }
    return deepFreeze({ binding, summary: createSummary(binding) });
  } catch (error) {
    let compensationError: unknown;
    if (pendingBinding) {
      try {
        await input.bindingStore.removeUncommitted(pendingBinding);
      } catch (rollbackError) {
        compensationError = rollbackError;
      }
    }
    if (coursePersisted) {
      try {
        await input.persistence.deleteCourse(input.course.tenant_id, input.course.course_id);
      } catch (rollbackError) {
        compensationError ??= rollbackError;
      }
    }
    if (compensationError) throw compensationError;
    throw error;
  }
}
