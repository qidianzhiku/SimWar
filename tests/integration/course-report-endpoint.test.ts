import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  ApiErrorEnvelope,
  AuthSession,
  CourseReportDto,
  CourseReportExportDto
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const tenantId = "tenant_demo";

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  store.runs.push({
    course_id: "course_demo",
    parameter_set_id: "param_toy_approved_1",
    run_id: "run_course_report_001",
    scenario_package_id: "scenario_eldercare_demo",
    seed: 17,
    status: "completed",
    tenant_id: tenantId
  });
  store.rounds.push({
    round_id: "round_course_report_001",
    round_no: 1,
    run_id: "run_course_report_001",
    status: "published",
    tenant_id: tenantId
  });
  store.settlementResults.push({
    parameter_set_id: "param_toy_approved_1",
    replay_hash: "b".repeat(64),
    round_id: "round_course_report_001",
    round_no: 1,
    run_id: "run_course_report_001",
    scenario_package_id: "scenario_eldercare_demo",
    settlement_result_id: "result_course_report_001",
    team_results: [
      {
        state_est: {
          explanation: "internal only",
          next_round_risk: "balanced",
          recommended_focus: "observe"
        },
        state_obs: {
          demand_band: "medium",
          profit_band: "healthy",
          rank: 1,
          revenue: 1200,
          score: 88,
          served_demand: 40
        },
        state_true: {
          cash_flow: 300,
          cost: 800,
          demand: 43,
          market_share: 0.6,
          profit: 400,
          rank: 1,
          revenue: 1200,
          score: 88,
          served_demand: 40,
          settlement_status: "settled"
        },
        team_id: "team_alpha",
        team_name: "Alpha 康养队"
      }
    ],
    tenant_id: tenantId
  });
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function login(
  baseUrl: string,
  username: string,
  loginTenantId = tenantId
): Promise<AuthSession> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({ password: username, username }),
    headers: { "content-type": "application/json", "x-tenant-id": loginTenantId },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data;
}

async function request<T>(
  baseUrl: string,
  path: string,
  token?: string,
  requestTenantId: string | null = tenantId
): Promise<{ body: T; status: number }> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(requestTenantId ? { "x-tenant-id": requestTenantId } : {})
    }
  });
  return { body: (await response.json()) as T, status: response.status };
}

function expectCourseReportError(
  response: { body: ApiErrorEnvelope; status: number },
  status: number,
  code: string
): void {
  expect(response.status).toBe(status);
  expect(response.body).toMatchObject({
    code,
    message: expect.any(String),
    request_id: expect.any(String)
  });
}

type CourseReportMatrixActor = "admin" | "student" | "teacher" | null;

interface CourseReportFailureCase {
  actor: CourseReportMatrixActor;
  code: string;
  path: string;
  route: string;
  status: number;
}

const courseReportFailureCases: CourseReportFailureCase[] = [
  {
    authorizedActor: "admin",
    missingPath: "/api/v1/bff/admin/course-reports?course_id=course_missing",
    path: "/api/v1/bff/admin/course-reports?course_id=course_demo",
    route: "Admin query",
    validationCode: "COURSE_REPORT_INPUT_INVALID",
    validationPath: "/api/v1/bff/admin/course-reports?course_id=course_demo&kpi=profit"
  },
  {
    authorizedActor: "admin",
    missingPath: "/api/v1/bff/admin/course-reports/export?course_id=course_missing&format=json",
    path: "/api/v1/bff/admin/course-reports/export?course_id=course_demo&format=json",
    route: "Admin export",
    validationCode: "COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED",
    validationPath: "/api/v1/bff/admin/course-reports/export?course_id=course_demo&format=xlsx"
  },
  {
    authorizedActor: "teacher",
    missingPath: "/api/v1/bff/teacher/course-reports?course_id=course_missing",
    path: "/api/v1/bff/teacher/course-reports?course_id=course_demo",
    route: "Teacher query",
    validationCode: "COURSE_REPORT_INPUT_INVALID",
    validationPath: "/api/v1/bff/teacher/course-reports?course_id=course_demo&kpi=profit"
  },
  {
    authorizedActor: "teacher",
    missingPath: "/api/v1/bff/teacher/course-reports/export?course_id=course_missing&format=json",
    path: "/api/v1/bff/teacher/course-reports/export?course_id=course_demo&format=json",
    route: "Teacher export",
    validationCode: "COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED",
    validationPath: "/api/v1/bff/teacher/course-reports/export?course_id=course_demo&format=xlsx"
  }
].flatMap(({ authorizedActor, missingPath, path, route, validationCode, validationPath }) => [
  {
    actor: null,
    code: "COURSE_REPORT_AUTHENTICATION_REQUIRED",
    path,
    route,
    status: 401
  },
  {
    actor: "student",
    code: "COURSE_REPORT_FORBIDDEN",
    path,
    route,
    status: 403
  },
  {
    actor: authorizedActor,
    code: "COURSE_REPORT_NOT_FOUND",
    path: missingPath,
    route,
    status: 404
  },
  {
    actor: authorizedActor,
    code: validationCode,
    path: validationPath,
    route,
    status: 422
  }
]);

describe("Course Report Builder BFF endpoints", () => {
  it("serves the same tenant-scoped safe report to Teacher and Admin without writes", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const [teacher, admin] = await Promise.all([
        login(baseUrl, "teacher"),
        login(baseUrl, "admin")
      ]);
      const auditCount = store.auditLogs.length;
      const path = "/api/v1/bff/teacher/course-reports?course_id=course_demo&kpi=revenue&kpi=score";
      const teacherReport = await request<ApiEnvelope<CourseReportDto>>(
        baseUrl,
        path,
        teacher.access_token
      );
      const adminReport = await request<ApiEnvelope<CourseReportDto>>(
        baseUrl,
        path.replace("/teacher/", "/admin/"),
        admin.access_token
      );

      expect(teacherReport.status).toBe(200);
      expect(adminReport.status).toBe(200);
      expect(teacherReport.body.data).toEqual(adminReport.body.data);
      expect(teacherReport.body.data.rows[0]?.metrics).toEqual([
        { kpi: "revenue", value: 1200 },
        { kpi: "score", value: 88 }
      ]);
      expect(JSON.stringify(teacherReport.body.data)).not.toContain("state_true");
      expect(JSON.stringify(teacherReport.body.data)).not.toContain("replay_hash");
      expect(JSON.stringify(teacherReport.body.data)).not.toContain("internal only");
      expect(store.auditLogs).toHaveLength(auditCount);
    } finally {
      await stopServer(server);
    }
  });

  it("exports safe JSON and CSV DTOs and rejects unsupported formats", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacher = await login(baseUrl, "teacher");
      const csv = await request<ApiEnvelope<CourseReportExportDto>>(
        baseUrl,
        "/api/v1/bff/teacher/course-reports/export?course_id=course_demo&format=csv",
        teacher.access_token
      );
      const json = await request<ApiEnvelope<CourseReportExportDto>>(
        baseUrl,
        "/api/v1/bff/teacher/course-reports/export?course_id=course_demo&format=json",
        teacher.access_token
      );
      const unsupported = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/teacher/course-reports/export?course_id=course_demo&format=xlsx",
        teacher.access_token
      );

      expect(csv.status).toBe(200);
      expect(csv.body.data).toMatchObject({
        export_format: "csv",
        file_name: "course_demo-report.csv"
      });
      expect(json.body.data).toMatchObject({
        export_format: "json",
        file_name: "course_demo-report.json"
      });
      expect(unsupported.status).toBe(422);
      expect(unsupported.body.code).toBe("COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED");
    } finally {
      await stopServer(server);
    }
  });

  it("maps missing auth, role denial, missing scope, and invalid filters to frozen failures", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const [teacher, student] = await Promise.all([
        login(baseUrl, "teacher"),
        login(baseUrl, "student")
      ]);
      const unauthenticated = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/teacher/course-reports?course_id=course_demo"
      );
      const denied = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/teacher/course-reports?course_id=course_demo",
        student.access_token
      );
      const missing = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/teacher/course-reports?course_id=course_missing",
        teacher.access_token
      );
      const invalid = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/teacher/course-reports?course_id=course_demo&kpi=profit",
        teacher.access_token
      );

      expect(unauthenticated).toMatchObject({
        body: { code: "COURSE_REPORT_AUTHENTICATION_REQUIRED" },
        status: 401
      });
      expect(denied).toMatchObject({ body: { code: "COURSE_REPORT_FORBIDDEN" }, status: 403 });
      expect(missing).toMatchObject({ body: { code: "COURSE_REPORT_NOT_FOUND" }, status: 404 });
      expect(invalid).toMatchObject({ body: { code: "COURSE_REPORT_INPUT_INVALID" }, status: 422 });
    } finally {
      await stopServer(server);
    }
  });

  it("returns structured frozen failures for Admin query and export input paths", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const admin = await login(baseUrl, "admin");
      const invalidQuery = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/admin/course-reports?course_id=course_demo&kpi=profit",
        admin.access_token
      );
      const unsupportedExport = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/admin/course-reports/export?course_id=course_demo&format=xlsx",
        admin.access_token
      );

      expectCourseReportError(invalidQuery, 422, "COURSE_REPORT_INPUT_INVALID");
      expectCourseReportError(unsupportedExport, 422, "COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED");
    } finally {
      await stopServer(server);
    }
  });

  it("returns Teacher export failures without changing report access semantics", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacher = await login(baseUrl, "teacher");
      const missingCourse = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/teacher/course-reports/export?course_id=course_missing&format=json",
        teacher.access_token
      );
      const unsupportedFormat = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/teacher/course-reports/export?course_id=course_demo&format=xlsx",
        teacher.access_token
      );

      expectCourseReportError(missingCourse, 404, "COURSE_REPORT_NOT_FOUND");
      expectCourseReportError(unsupportedFormat, 422, "COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED");
    } finally {
      await stopServer(server);
    }
  });

  it("rejects Student access across Admin and export report entries", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const student = await login(baseUrl, "student");
      const adminQuery = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/admin/course-reports?course_id=course_demo",
        student.access_token
      );
      const adminExport = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/admin/course-reports/export?course_id=course_demo&format=json",
        student.access_token
      );
      const teacherExport = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/teacher/course-reports/export?course_id=course_demo&format=json",
        student.access_token
      );

      expectCourseReportError(adminQuery, 403, "COURSE_REPORT_FORBIDDEN");
      expectCourseReportError(adminExport, 403, "COURSE_REPORT_FORBIDDEN");
      expectCourseReportError(teacherExport, 403, "COURSE_REPORT_FORBIDDEN");
    } finally {
      await stopServer(server);
    }
  });

  it("requires a platform target tenant and rejects tenant-admin cross-tenant headers", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const [platform, admin] = await Promise.all([
        login(baseUrl, "platform", "tenant_platform"),
        login(baseUrl, "admin")
      ]);
      const platformQuery = await request<ApiEnvelope<CourseReportDto>>(
        baseUrl,
        "/api/v1/bff/admin/course-reports?course_id=course_demo",
        platform.access_token,
        tenantId
      );
      const platformExport = await request<ApiEnvelope<CourseReportExportDto>>(
        baseUrl,
        "/api/v1/bff/admin/course-reports/export?course_id=course_demo&format=csv",
        platform.access_token,
        tenantId
      );
      const missingPlatformTarget = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/admin/course-reports?course_id=course_demo",
        platform.access_token,
        null
      );
      const crossTenantAdmin = await request<ApiErrorEnvelope>(
        baseUrl,
        "/api/v1/bff/admin/course-reports?course_id=course_demo",
        admin.access_token,
        "tenant_other"
      );

      expect(platformQuery.status).toBe(200);
      expect(platformExport.status).toBe(200);
      expect(platformExport.body.data.export_format).toBe("csv");
      expectCourseReportError(missingPlatformTarget, 403, "COURSE_REPORT_FORBIDDEN");
      expectCourseReportError(crossTenantAdmin, 403, "COURSE_REPORT_FORBIDDEN");
    } finally {
      await stopServer(server);
    }
  });

  it.each(courseReportFailureCases)(
    "returns structured $status $code for $route",
    async ({ actor, code, path, status }) => {
      const { baseUrl, server } = await startServer();
      try {
        const token = actor ? (await login(baseUrl, actor)).access_token : undefined;
        const response = await request<ApiErrorEnvelope>(baseUrl, path, token);

        expectCourseReportError(response, status, code);
      } finally {
        await stopServer(server);
      }
    }
  );
});
