import { describe, expect, it, vi } from "vitest";
import type {
  CourseReportDto,
  CourseReportFilterInput
} from "../../packages/shared-contracts/src/index.js";
import {
  ADMIN_COURSE_REPORT_EXPORT_PATH,
  ADMIN_COURSE_REPORT_PATH,
  CourseReportRequestError as AdminCourseReportRequestError,
  exportAdminCourseReport,
  loadAdminCourseReport
} from "../../apps/admin/src/course-report-client.js";
import {
  CourseReportRequestError as TeacherCourseReportRequestError,
  TEACHER_COURSE_REPORT_EXPORT_PATH,
  TEACHER_COURSE_REPORT_PATH,
  exportTeacherCourseReport,
  loadTeacherCourseReport
} from "../../apps/teacher/src/course-report-client.js";

const filter: CourseReportFilterInput = {
  course_id: "course_001",
  kpis: ["revenue", "score"],
  role: "CEO",
  round_no: 1,
  run_id: "run_001",
  team_id: "team_001"
};

const adminRequest = { tenantId: "tenant_demo", token: "admin-token" };
const teacherRequest = { tenantId: "tenant_demo", token: "teacher-token" };
const apiBase = "http://localhost:3000";

const report: CourseReportDto = {
  applied_filters: filter,
  known_limits: ["JSON_INTERNAL_ONLY", "POSTGRESQL_NOT_ACTIVE"],
  report_schema_version: "course-report.v1",
  rows: [
    {
      course_id: "course_001",
      metrics: [
        { kpi: "revenue", value: 10800 },
        { kpi: "score", value: 91 }
      ],
      round_no: 1,
      run_id: "run_001",
      team_id: "team_001",
      team_name: "North Team"
    }
  ]
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
    status
  });
}

describe("C6 Course Report consumers", () => {
  it("uses only the frozen Admin and Teacher BFF routes with closed report filters", async () => {
    const adminFetcher = vi.fn(async () =>
      jsonResponse({ code: "OK", data: report, message: "success", request_id: "req_admin" })
    );
    const teacherFetcher = vi.fn(async () =>
      jsonResponse({ code: "OK", data: report, message: "success", request_id: "req_teacher" })
    );

    await expect(loadAdminCourseReport(filter, adminRequest, adminFetcher)).resolves.toEqual(
      report
    );
    await expect(loadTeacherCourseReport(filter, teacherRequest, teacherFetcher)).resolves.toEqual(
      report
    );

    const query =
      "?course_id=course_001&run_id=run_001&team_id=team_001&role=CEO&round_no=1&kpi=revenue&kpi=score";
    expect(adminFetcher).toHaveBeenCalledWith(`${apiBase}${ADMIN_COURSE_REPORT_PATH}${query}`, {
      headers: { authorization: "Bearer admin-token", "x-tenant-id": "tenant_demo" },
      method: "GET"
    });
    expect(teacherFetcher).toHaveBeenCalledWith(`${apiBase}${TEACHER_COURSE_REPORT_PATH}${query}`, {
      headers: { authorization: "Bearer teacher-token", "x-tenant-id": "tenant_demo" },
      method: "GET"
    });
  });

  it("exports the same safe projection as JSON or CSV without a client tenant field", async () => {
    const adminFetcher = vi.fn(async () =>
      jsonResponse({
        code: "OK",
        data: { export_format: "csv", file_name: "course_001-report.csv", report },
        message: "success",
        request_id: "req_admin_export"
      })
    );
    const teacherFetcher = vi.fn(async () =>
      jsonResponse({
        code: "OK",
        data: { export_format: "json", file_name: "course_001-report.json", report },
        message: "success",
        request_id: "req_teacher_export"
      })
    );

    await expect(
      exportAdminCourseReport(filter, "csv", adminRequest, adminFetcher)
    ).resolves.toMatchObject({
      export_format: "csv",
      report
    });
    await expect(
      exportTeacherCourseReport(filter, "json", teacherRequest, teacherFetcher)
    ).resolves.toMatchObject({ export_format: "json", report });

    expect(adminFetcher.mock.calls[0]?.[0]).toBe(
      `${apiBase}${ADMIN_COURSE_REPORT_EXPORT_PATH}?course_id=course_001&run_id=run_001&team_id=team_001&role=CEO&round_no=1&kpi=revenue&kpi=score&format=csv`
    );
    expect(teacherFetcher.mock.calls[0]?.[0]).toBe(
      `${apiBase}${TEACHER_COURSE_REPORT_EXPORT_PATH}?course_id=course_001&run_id=run_001&team_id=team_001&role=CEO&round_no=1&kpi=revenue&kpi=score&format=json`
    );
  });

  it("maps only frozen failure codes and rejects an internal field leak", async () => {
    const forbidden = vi.fn(async () =>
      jsonResponse(
        {
          code: "COURSE_REPORT_FORBIDDEN",
          message: "safe message",
          request_id: "req_forbidden"
        },
        403
      )
    );
    const leaking = vi.fn(async () =>
      jsonResponse({
        code: "OK",
        data: {
          ...report,
          applied_filters: { ...report.applied_filters, tenant_id: "tenant_other" },
          state_true: { profit: 1 },
          student_visible: true
        },
        message: "success",
        request_id: "req_leak"
      })
    );
    const malformedError = vi.fn(async () =>
      jsonResponse({ code: "COURSE_REPORT_FORBIDDEN" }, 403)
    );
    const malformedSuccess = vi.fn(async () =>
      jsonResponse({ code: "OK", data: report, message: "success" })
    );

    await expect(loadAdminCourseReport(filter, adminRequest, forbidden)).rejects.toEqual(
      new AdminCourseReportRequestError(403, "COURSE_REPORT_FORBIDDEN")
    );
    await expect(loadTeacherCourseReport(filter, teacherRequest, forbidden)).rejects.toEqual(
      new TeacherCourseReportRequestError(403, "COURSE_REPORT_FORBIDDEN")
    );
    await expect(loadTeacherCourseReport(filter, teacherRequest, leaking)).rejects.toEqual(
      new TeacherCourseReportRequestError(200, "COURSE_REPORT_RESPONSE_INVALID")
    );
    await expect(loadAdminCourseReport(filter, adminRequest, malformedError)).rejects.toEqual(
      new AdminCourseReportRequestError(403, "COURSE_REPORT_RESPONSE_INVALID")
    );
    await expect(loadTeacherCourseReport(filter, teacherRequest, malformedSuccess)).rejects.toEqual(
      new TeacherCourseReportRequestError(200, "COURSE_REPORT_RESPONSE_INVALID")
    );
  });
});
