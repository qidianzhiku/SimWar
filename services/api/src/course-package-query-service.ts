import type {
  CoursePackageVersionAdminListDto,
  CoursePackageVersion,
  CoursePackageVersionReference,
  CoursePackageVersionTeacherDto,
  CoursePackageVersionTeacherListDto
} from "@simwar/shared-contracts";
import {
  type CoursePackageRegistryPort,
  createCoursePackageVersionReference
} from "./course-package-json-registry.js";

export function toTeacherCoursePackageVersionDto(
  version: CoursePackageVersion
): CoursePackageVersionTeacherDto {
  return {
    course_blueprint_reference: structuredClone(version.course_blueprint_reference),
    course_package_reference: createCoursePackageVersionReference(version),
    description: version.description,
    parameter_set_reference: structuredClone(version.parameter_set_reference),
    scenario_package_reference: structuredClone(version.scenario_package_reference),
    title: version.title
  };
}

export class CoursePackageQueryService {
  constructor(private readonly registry: CoursePackageRegistryPort) {}

  async listAdmin(tenantId: string): Promise<CoursePackageVersionAdminListDto> {
    return { course_package_versions: await this.registry.listForTenant(tenantId) };
  }

  async listTeacher(tenantId: string): Promise<CoursePackageVersionTeacherListDto> {
    const versions = await this.registry.listForTenant(tenantId);
    return {
      course_package_versions: versions
        .filter((version) => version.status === "AVAILABLE")
        .map(toTeacherCoursePackageVersionDto)
    };
  }

  async getByReference(
    tenantId: string,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersion | null> {
    return this.registry.getByReference(tenantId, reference);
  }
}
