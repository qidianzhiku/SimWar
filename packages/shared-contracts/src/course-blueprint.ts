import type { Course } from "./index.js";
import type { CourseBlueprintReference } from "./index.js";
import type { TeacherFormalCourseBindingPreviewDto, TeacherFormalCourseBindingSummaryDto } from "./teacher-formal-course-binding.js";

export const TEACHER_COURSE_BLUEPRINT_CATALOG_OPERATION_ID =
  "TEACHER_COURSE_BLUEPRINT_CATALOG_V1" as const;
export const TEACHER_COURSE_BLUEPRINT_READINESS_OPERATION_ID =
  "TEACHER_COURSE_BLUEPRINT_READINESS_V1" as const;
export const TEACHER_COURSE_BLUEPRINT_COURSE_CREATE_OPERATION_ID =
  "TEACHER_COURSE_BLUEPRINT_COURSE_CREATE_V1" as const;

/** Teacher-safe projection. Instructor-only guidance and approval/audit records are excluded. */
export interface TeacherCourseBlueprintCatalogItemDto {
  compatibility_constraints: Readonly<Record<string, string>>;
  content_digest_summary: string;
  course_blueprint_reference: CourseBlueprintReference;
  duration_minutes: number;
  objectives_summary: readonly string[];
  phases_summary: readonly { duration_minutes: number; order: number; title: string }[];
  status: "APPROVED";
  title: string;
}

export interface TeacherCourseBlueprintCatalogDto {
  candidates: readonly TeacherCourseBlueprintCatalogItemDto[];
  operation_id: typeof TEACHER_COURSE_BLUEPRINT_CATALOG_OPERATION_ID;
}

export interface TeacherCourseBlueprintReadinessDto {
  blueprint: TeacherCourseBlueprintCatalogItemDto;
  formal_course_binding: TeacherFormalCourseBindingPreviewDto;
  operation_id: typeof TEACHER_COURSE_BLUEPRINT_READINESS_OPERATION_ID;
  selection_status: "READY";
}

export interface TeacherCourseBlueprintCourseCreateInput {
  course_blueprint_reference: CourseBlueprintReference;
  scenario_package_reference: TeacherFormalCourseBindingPreviewDto["scenario_package_reference"];
  title: string;
}

export interface TeacherCourseBlueprintBindingSummaryDto {
  course_blueprint_reference: CourseBlueprintReference;
}

export interface TeacherCourseBlueprintCourseCreateDto {
  binding_summary: TeacherCourseBlueprintBindingSummaryDto;
  course: Course;
  formal_binding_summary: TeacherFormalCourseBindingSummaryDto;
  operation_id: typeof TEACHER_COURSE_BLUEPRINT_COURSE_CREATE_OPERATION_ID;
}
