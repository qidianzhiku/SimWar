import type { CourseBlueprintReference } from "./index.js";
import type { ParameterSetReference } from "./parameter-set-authority.js";
import type { ScenarioPackageReference } from "./scenario-package-authority.js";

export const COURSE_PACKAGE_VERSION_SCHEMA_VERSION = "course-package-version.v1" as const;

/** C5 owns only this teaching/configuration aggregate; it is not a source lifecycle authority. */
export const COURSE_PACKAGE_VERSION_STATUSES = [
  "DRAFT",
  "VALIDATED",
  "AVAILABLE",
  "RETIRED"
] as const;

export type CoursePackageVersionStatus = (typeof COURSE_PACKAGE_VERSION_STATUSES)[number];

export const COURSE_PACKAGE_COMMAND_FAILURE_CODES = [
  "COURSE_PACKAGE_INPUT_INVALID",
  "COURSE_PACKAGE_NOT_FOUND",
  "COURSE_PACKAGE_TENANT_SCOPE_VIOLATION",
  "COURSE_PACKAGE_DUPLICATE_VERSION",
  "COURSE_PACKAGE_DEPENDENCY_NOT_BINDABLE",
  "COURSE_PACKAGE_COMPATIBILITY_MISMATCH",
  "COURSE_PACKAGE_IMPORT_DIGEST_INVALID",
  "COURSE_PACKAGE_LIFECYCLE_INVALID",
  "COURSE_PACKAGE_FORBIDDEN"
] as const;

export type CoursePackageCommandFailureCode = (typeof COURSE_PACKAGE_COMMAND_FAILURE_CODES)[number];

/** Closed identity for an immutable CoursePackageVersion snapshot. */
export interface CoursePackageVersionReference {
  content_digest: string;
  course_package_id: string;
  tenant_id: string;
  version: string;
}

/** Client input never carries tenant or actor identity; the server derives both from authentication. */
export interface CoursePackageVersionDraftInput {
  course_blueprint_reference: CourseBlueprintReference;
  course_package_id: string;
  description: string;
  parameter_set_reference: ParameterSetReference;
  scenario_package_reference: ScenarioPackageReference;
  title: string;
  version: string;
}

/**
 * Immutable teaching/configuration aggregate. Its references are validated against
 * existing approved source lifecycles but do not create a Course, Run, or source binding.
 */
export interface CoursePackageVersion extends CoursePackageVersionDraftInput {
  content_digest: string;
  created_at: string;
  created_by: string;
  schema_version: typeof COURSE_PACKAGE_VERSION_SCHEMA_VERSION;
  status: CoursePackageVersionStatus;
  tenant_id: string;
}

export interface CoursePackageVersionCloneInput {
  course_package_id: string;
  description: string;
  source_course_package_reference: CoursePackageVersionReference;
  title: string;
  version: string;
}

export interface CoursePackageVersionImportInput {
  source_course_package_version: CoursePackageVersion;
}

export interface CoursePackageVersionExportDto {
  course_package_version: CoursePackageVersion;
}

/** Admin-only projection keeps lifecycle provenance available for governance review. */
export type CoursePackageVersionAdminDto = CoursePackageVersion;

/** Teacher-safe projection deliberately excludes lifecycle actor/timestamp details and has no student route. */
export interface CoursePackageVersionTeacherDto {
  course_blueprint_reference: CourseBlueprintReference;
  course_package_reference: CoursePackageVersionReference;
  description: string;
  parameter_set_reference: ParameterSetReference;
  scenario_package_reference: ScenarioPackageReference;
  title: string;
}

export interface CoursePackageVersionAdminListDto {
  course_package_versions: readonly CoursePackageVersionAdminDto[];
}

export interface CoursePackageVersionTeacherListDto {
  course_package_versions: readonly CoursePackageVersionTeacherDto[];
}
