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
import { isCourseFactoryMetadataForTenant } from "@simwar/shared-contracts";
import { validateM30CourseFactorySourceEvidence } from "@simwar/sh-next-support";

/**
 * Published Course Factory versions are delivery-ready through the same
 * CoursePackage query authority. Legacy packages still require AVAILABLE;
 * a bare PUBLISHED status is never enough to enter a delivery flow.
 */
type DeliveryPackageLike = {
  factory_metadata?: unknown;
  status: string;
  tenant_id?: unknown;
};

function isNotExpired(expiresAt: string | null, now: string): boolean {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) return false;
  if (expiresAt === null) return true;
  const expiryMs = Date.parse(expiresAt);
  return Number.isFinite(expiryMs) && expiryMs > nowMs;
}

export function isDeliveryReadyCoursePackage<T extends DeliveryPackageLike>(
  version: T | null | undefined,
  now = new Date().toISOString()
): version is T & { status: "AVAILABLE" | "PUBLISHED" } {
  if (!version) return false;
  if (version.status === "AVAILABLE") return true;
  if (
    version.status !== "PUBLISHED" ||
    typeof version.tenant_id !== "string" ||
    !isCourseFactoryMetadataForTenant(version.factory_metadata, version.tenant_id)
  ) {
    return false;
  }
  if (
    version.factory_metadata.source_evidence_reference !== undefined &&
    validateM30CourseFactorySourceEvidence(version.factory_metadata.source_evidence_reference).length > 0
  ) {
    return false;
  }
  const expiresAt = version.factory_metadata.rights.expires_at;
  return isNotExpired(expiresAt, now);
}

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

  isDeliveryReady(
    version: CoursePackageVersion | null | undefined
  ): version is CoursePackageVersion & { status: "AVAILABLE" | "PUBLISHED" } {
    return isDeliveryReadyCoursePackage(version, this.registry.currentTime());
  }

  async listAdmin(tenantId: string): Promise<CoursePackageVersionAdminListDto> {
    return { course_package_versions: await this.registry.listForTenant(tenantId) };
  }

  async listTeacher(tenantId: string): Promise<CoursePackageVersionTeacherListDto> {
    const versions = await this.registry.listForTenant(tenantId);
    return {
      course_package_versions: versions
        .filter((version) => this.isDeliveryReady(version))
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
