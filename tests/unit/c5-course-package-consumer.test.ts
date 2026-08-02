import { describe, expect, it, vi } from "vitest";
import type {
  CoursePackageVersion,
  CoursePackageVersionTeacherDto
} from "../../packages/shared-contracts/src/course-package-version";
import {
  ADMIN_COURSE_PACKAGE_VERSION_LIST_PATH,
  exportAdminCoursePackageVersion,
  getAdminCoursePackageSurfaceState,
  loadAdminCoursePackageVersions,
  runAdminCoursePackageLifecycle
} from "../../apps/admin/src/course-package-client";
import {
  TEACHER_COURSE_PACKAGE_VERSION_LIST_PATH,
  TEACHER_COURSE_PACKAGE_VERSION_CLONE_PATH,
  cloneTeacherCoursePackageVersion,
  getTeacherCoursePackageSurfaceState,
  loadTeacherCoursePackageVersions
} from "../../apps/teacher/src/course-package-client";

const digest = "a".repeat(64);

const adminPackage: CoursePackageVersion = {
  content_digest: digest,
  course_blueprint_reference: {
    content_digest: "b".repeat(64),
    course_blueprint_id: "blueprint_wellness_001",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  course_package_id: "course_package_wellness_001",
  created_at: "2026-08-02T03:07:00.000Z",
  created_by: "usr_admin",
  description: "Teaching-only package.",
  parameter_set_reference: {
    content_digest: "c".repeat(64),
    parameter_set_id: "parameter_wellness_001",
    version: "1.0.0"
  },
  scenario_package_reference: {
    content_digest: "d".repeat(64),
    scenario_package_id: "scenario_wellness_001",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  schema_version: "course-package-version.v1",
  status: "AVAILABLE",
  tenant_id: "tenant_demo",
  title: "Wellness Teaching Package",
  version: "1.0.0"
};

const teacherPackage: CoursePackageVersionTeacherDto = {
  course_blueprint_reference: adminPackage.course_blueprint_reference,
  course_package_reference: {
    content_digest: adminPackage.content_digest,
    course_package_id: adminPackage.course_package_id,
    tenant_id: adminPackage.tenant_id,
    version: adminPackage.version
  },
  description: adminPackage.description,
  parameter_set_reference: adminPackage.parameter_set_reference,
  scenario_package_reference: adminPackage.scenario_package_reference,
  title: adminPackage.title
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
    status
  });
}

describe("C5 CoursePackageVersion consumers", () => {
  it("consumes the frozen Admin and Teacher lists through their exact read-only routes", async () => {
    const adminFetcher = vi.fn(async () =>
      jsonResponse({
        code: "OK",
        data: { course_package_versions: [adminPackage] },
        message: "success",
        request_id: "req_admin_list"
      })
    );
    const teacherFetcher = vi.fn(async () =>
      jsonResponse({
        code: "OK",
        data: { course_package_versions: [teacherPackage] },
        message: "success",
        request_id: "req_teacher_list"
      })
    );

    await expect(loadAdminCoursePackageVersions("admin-token", adminFetcher)).resolves.toEqual([
      adminPackage
    ]);
    await expect(
      loadTeacherCoursePackageVersions("teacher-token", teacherFetcher)
    ).resolves.toEqual([teacherPackage]);

    expect(adminFetcher).toHaveBeenCalledWith(ADMIN_COURSE_PACKAGE_VERSION_LIST_PATH, {
      headers: { authorization: "Bearer admin-token" },
      method: "GET"
    });
    expect(teacherFetcher).toHaveBeenCalledWith(TEACHER_COURSE_PACKAGE_VERSION_LIST_PATH, {
      headers: { authorization: "Bearer teacher-token" },
      method: "GET"
    });
  });

  it("sends a closed reference for lifecycle and export actions without client-side compatibility checks", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          code: "OK",
          data: adminPackage,
          message: "success",
          request_id: "req_validate"
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          code: "OK",
          data: { course_package_version: adminPackage },
          message: "success",
          request_id: "req_export"
        })
      );

    await expect(
      runAdminCoursePackageLifecycle("validate", adminPackage, "admin-token", fetcher)
    ).resolves.toEqual(adminPackage);
    await expect(
      exportAdminCoursePackageVersion(adminPackage, "admin-token", fetcher)
    ).resolves.toEqual(adminPackage);

    expect(fetcher.mock.calls[0]).toEqual([
      "/api/v1/admin/course-package-versions/course_package_wellness_001/versions/1.0.0/validate",
      {
        body: JSON.stringify({
          content_digest: digest,
          course_package_id: "course_package_wellness_001",
          version: "1.0.0"
        }),
        headers: {
          authorization: "Bearer admin-token",
          "content-type": "application/json"
        },
        method: "POST"
      }
    ]);
    expect(fetcher.mock.calls[1]).toEqual([
      "/api/v1/admin/course-package-versions/course_package_wellness_001/versions/1.0.0/export?content_digest=" +
        digest,
      {
        headers: { authorization: "Bearer admin-token" },
        method: "GET"
      }
    ]);
  });

  it("asks the Teacher BFF to clone an exact available Course Package version without creating a Course or Run", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        code: "OK",
        data: teacherPackage,
        message: "success",
        request_id: "req_teacher_clone"
      })
    );
    const cloneInput = {
      course_package_id: "course_package_wellness_clone_001",
      description: "Teacher-owned Course Package version.",
      source_course_package_reference: teacherPackage.course_package_reference,
      title: "Teacher Wellness Package",
      version: "1.1.0"
    };

    await expect(
      cloneTeacherCoursePackageVersion(cloneInput, "teacher-token", fetcher)
    ).resolves.toEqual(teacherPackage);

    expect(fetcher).toHaveBeenCalledWith(TEACHER_COURSE_PACKAGE_VERSION_CLONE_PATH, {
      body: JSON.stringify(cloneInput),
      headers: {
        authorization: "Bearer teacher-token",
        "content-type": "application/json"
      },
      method: "POST"
    });
  });

  it("renders server-provided lifecycle and command failures as safe prescribed states", async () => {
    const responseFor = (code: string, status: number) =>
      vi.fn(async () => jsonResponse({ code, message: "server detail is not displayed" }, status));

    const dependencyError = await loadAdminCoursePackageVersions(
      "admin-token",
      responseFor("COURSE_PACKAGE_DEPENDENCY_NOT_BINDABLE", 422)
    ).catch((error: unknown) => error);
    const digestError = await loadAdminCoursePackageVersions(
      "admin-token",
      responseFor("COURSE_PACKAGE_IMPORT_DIGEST_INVALID", 422)
    ).catch((error: unknown) => error);
    const incompatibleError = await loadAdminCoursePackageVersions(
      "admin-token",
      responseFor("COURSE_PACKAGE_COMPATIBILITY_MISMATCH", 422)
    ).catch((error: unknown) => error);
    const deniedExport = await exportAdminCoursePackageVersion(
      adminPackage,
      "admin-token",
      responseFor("COURSE_PACKAGE_FORBIDDEN", 403)
    ).catch((error: unknown) => error);
    const deniedRead = await loadTeacherCoursePackageVersions(
      "teacher-token",
      responseFor("COURSE_PACKAGE_FORBIDDEN", 403)
    ).catch((error: unknown) => error);
    const unknownError = await loadAdminCoursePackageVersions(
      "admin-token",
      responseFor("UNRECOGNIZED_FAILURE", 500)
    ).catch((error: unknown) => error);

    expect(getAdminCoursePackageSurfaceState(dependencyError, "validate")).toBe(
      "DEPENDENCY_MISSING"
    );
    expect(getAdminCoursePackageSurfaceState(digestError, "import")).toBe("DIGEST_MISMATCH");
    expect(getAdminCoursePackageSurfaceState(incompatibleError, "make-available")).toBe(
      "INCOMPATIBLE"
    );
    expect(getAdminCoursePackageSurfaceState(deniedExport, "export")).toBe("EXPORT_RESTRICTED");
    expect(getTeacherCoursePackageSurfaceState(deniedRead)).toBe("PERMISSION_DENIED");
    expect(getAdminCoursePackageSurfaceState(unknownError, "list")).toBe("UNKNOWN");
    expect(getAdminCoursePackageSurfaceState({ ...adminPackage, status: "RETIRED" }, "list")).toBe(
      "STALE"
    );
  });
});
