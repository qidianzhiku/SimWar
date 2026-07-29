import type { Course } from "./index.js";
import type { FormalRunEngineReference } from "./formal-run-runtime-binding.js";
import type { ParameterSetReference } from "./parameter-set-authority.js";
import type {
  ScenarioPackageAuthorityPluginDependencyProjection,
  ScenarioPackageReference
} from "./scenario-package-authority.js";

export const TEACHER_FORMAL_COURSE_BINDING_PREVIEW_OPERATION_ID =
  "TEACHER_FORMAL_COURSE_BINDING_PREVIEW_V1" as const;

export const TEACHER_FORMAL_COURSE_CREATE_OPERATION_ID = "TEACHER_FORMAL_COURSE_CREATE_V1" as const;

export interface TeacherFormalCourseEngineProfileDto {
  engine_id: string;
  model_version_ref: string;
  runtime_authority: "JSON_INTERNAL_ONLY";
  version: string;
}

export interface TeacherFormalCourseBindingPreviewDto {
  engine_profile: TeacherFormalCourseEngineProfileDto;
  parameter_set_reference: ParameterSetReference;
  plugin_dependencies: readonly ScenarioPackageAuthorityPluginDependencyProjection[];
  scenario_package_reference: ScenarioPackageReference;
  selection_status: "READY";
}

export interface TeacherFormalCourseCreateInput {
  scenario_package_reference: ScenarioPackageReference;
  title: string;
}

export interface TeacherFormalCourseBindingSummaryDto {
  engine_reference: FormalRunEngineReference;
  parameter_set_reference: ParameterSetReference;
  scenario_package_reference: ScenarioPackageReference;
}

export interface TeacherFormalCourseCreateDto {
  binding_summary: TeacherFormalCourseBindingSummaryDto;
  course: Course;
  operation_id: typeof TEACHER_FORMAL_COURSE_CREATE_OPERATION_ID;
}
