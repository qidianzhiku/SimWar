import type {
  CoursePackageVersionTeacherDto,
  ModelQualificationRunAdmissionSelection
} from "@simwar/shared-contracts";

export interface ExactTeacherCourseBinding {
  readonly parameter_set_id: string;
  readonly scenario_package_id: string;
  readonly tenant_id: string;
}

/**
 * Resolve a single server-published package for the exact course binding.
 * Multiple matches are deliberately ambiguous: version ordering must never
 * become an implicit latest/default selector in a formal Run request.
 */
export function resolveExactTeacherCoursePackage(
  packages: readonly CoursePackageVersionTeacherDto[],
  binding: ExactTeacherCourseBinding
): CoursePackageVersionTeacherDto | null {
  const matches = packages.filter(
    (candidate) =>
      candidate.course_package_reference.tenant_id === binding.tenant_id &&
      candidate.course_blueprint_reference.tenant_id === binding.tenant_id &&
      candidate.scenario_package_reference.tenant_id === binding.tenant_id &&
      candidate.parameter_set_reference.parameter_set_id === binding.parameter_set_id &&
      candidate.scenario_package_reference.scenario_package_id === binding.scenario_package_id
  );
  return matches.length === 1 ? matches[0]! : null;
}

/**
 * Build the exact selector accepted by the existing qualified admission
 * contract. This is a request selector only; the API remains authoritative.
 */
export function buildTeacherQualifiedRunAdmission(
  courseId: string,
  coursePackage: CoursePackageVersionTeacherDto,
  selection: ModelQualificationRunAdmissionSelection
) {
  return {
    adoption: selection.adoption,
    calibration_dataset_id: selection.calibration_dataset_id,
    course_id: courseId,
    course_package_reference: coursePackage.course_package_reference,
    model_artifact_reference: selection.model_artifact_reference,
    model_version_reference: selection.model_version_reference,
    qualification_id: selection.qualification_id,
    source_package_id: selection.source_package_id
  } as const;
}
