import type { IncomingMessage, ServerResponse } from "node:http";
import {
  COURSE_REPORT_EXPORT_FORMATS,
  COURSE_REPORT_KPIS,
  COURSE_REPORT_ROLE_SLOTS,
  type ActorRole,
  type ApiEnvelope,
  type CourseReportExportFormat,
  type CourseReportFilterInput,
  type CurrentUser,
  type PermissionKey
} from "@simwar/shared-contracts";
import {
  CourseReportQueryServiceError,
  createCourseReportExport,
  type CourseReportQueryService
} from "./course-report-query-service.js";

const COURSE_REPORT_PATHS = new Set([
  "/api/v1/bff/admin/course-reports",
  "/api/v1/bff/admin/course-reports/export",
  "/api/v1/bff/teacher/course-reports",
  "/api/v1/bff/teacher/course-reports/export"
]);

export interface CourseReportRequestContext {
  requestId: string;
  tenantId: string;
  actor?: CurrentUser;
}

export interface CourseReportRouteDependencies {
  createContext(): CourseReportRequestContext;
  courseReports: CourseReportQueryService;
  requirePermission(context: CourseReportRequestContext, permission: PermissionKey): CurrentUser;
  actorHasAnyRole(actor: CurrentUser, roles: readonly ActorRole[]): boolean;
  createEnvelope<TData>(context: CourseReportRequestContext, data: TData): ApiEnvelope<TData>;
  sendJson(response: ServerResponse, statusCode: number, body: unknown): void;
}

export function isCourseReportRoute(method: string | undefined, url: URL): boolean {
  return method === "GET" && COURSE_REPORT_PATHS.has(url.pathname);
}

export async function handleCourseReportRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: CourseReportRouteDependencies
): Promise<void> {
  const context = dependencies.createContext();
  const isAdmin = url.pathname.startsWith("/api/v1/bff/admin/");
  const isExport = url.pathname.endsWith("/export");

  if (isAdmin) {
    requireCourseReportAdmin(context, request, dependencies);
  } else {
    requireCourseReportTeacher(context, dependencies);
  }

  const { filters, format } = parseCourseReportQuery(url, isExport);
  const report = await dependencies.courseReports.query(context.tenantId, filters);
  dependencies.sendJson(
    response,
    200,
    dependencies.createEnvelope(context, format ? createCourseReportExport(report, format) : report)
  );
}

function requireCourseReportAdmin(
  context: CourseReportRequestContext,
  request: IncomingMessage,
  dependencies: CourseReportRouteDependencies
): CurrentUser {
  const actor = dependencies.requirePermission(context, "course:read");
  const isPlatformAdmin = dependencies.actorHasAnyRole(actor, ["platform_admin"]);
  if (
    (!isPlatformAdmin && !dependencies.actorHasAnyRole(actor, ["tenant_admin"])) ||
    (!isPlatformAdmin && actor.tenant_id !== context.tenantId) ||
    (isPlatformAdmin && !request.headers["x-tenant-id"]?.toString().trim())
  ) {
    throw new CourseReportQueryServiceError("COURSE_REPORT_FORBIDDEN");
  }
  return actor;
}

function requireCourseReportTeacher(
  context: CourseReportRequestContext,
  dependencies: CourseReportRouteDependencies
): CurrentUser {
  const actor = dependencies.requirePermission(context, "course:read");
  if (!dependencies.actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
    throw new CourseReportQueryServiceError("COURSE_REPORT_FORBIDDEN");
  }
  return actor;
}

function courseReportRequestError(
  code:
    | "COURSE_REPORT_INPUT_INVALID"
    | "COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED" = "COURSE_REPORT_INPUT_INVALID"
): CourseReportQueryServiceError {
  return new CourseReportQueryServiceError(code);
}

function requireCourseReportExactIdentity(value: string | null): string {
  if (
    value === null ||
    value.trim().length === 0 ||
    value !== value.trim() ||
    !/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) ||
    /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  ) {
    throw courseReportRequestError();
  }
  return value;
}

function getSingleCourseReportParameter(params: URLSearchParams, name: string): string | null {
  const values = params.getAll(name);
  if (values.length > 1) throw courseReportRequestError();
  return values[0] ?? null;
}

function parseCourseReportQuery(
  url: URL,
  includesExportFormat: boolean
): { filters: CourseReportFilterInput; format?: CourseReportExportFormat } {
  const allowed = new Set([
    "course_id",
    "kpi",
    "role",
    "round_no",
    "run_id",
    "team_id",
    ...(includesExportFormat ? ["format"] : [])
  ]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    throw courseReportRequestError();
  }

  const rawKpis = url.searchParams.getAll("kpi");
  if (
    rawKpis.some(
      (kpi) => !COURSE_REPORT_KPIS.includes(kpi as (typeof COURSE_REPORT_KPIS)[number])
    ) ||
    new Set(rawKpis).size !== rawKpis.length
  ) {
    throw courseReportRequestError();
  }

  const rawRole = getSingleCourseReportParameter(url.searchParams, "role");
  if (
    rawRole !== null &&
    !COURSE_REPORT_ROLE_SLOTS.includes(rawRole as (typeof COURSE_REPORT_ROLE_SLOTS)[number])
  ) {
    throw courseReportRequestError();
  }
  const rawRoundNo = getSingleCourseReportParameter(url.searchParams, "round_no");
  const rawRunId = getSingleCourseReportParameter(url.searchParams, "run_id");
  const rawTeamId = getSingleCourseReportParameter(url.searchParams, "team_id");
  const filters: CourseReportFilterInput = {
    course_id: requireCourseReportExactIdentity(
      getSingleCourseReportParameter(url.searchParams, "course_id")
    ),
    ...(rawKpis.length > 0
      ? { kpis: rawKpis as NonNullable<CourseReportFilterInput["kpis"]> }
      : {}),
    ...(rawRole !== null ? { role: rawRole as NonNullable<CourseReportFilterInput["role"]> } : {}),
    ...(rawRoundNo !== null ? { round_no: requireCourseReportRoundNo(rawRoundNo) } : {}),
    ...(rawRunId !== null ? { run_id: requireCourseReportExactIdentity(rawRunId) } : {}),
    ...(rawTeamId !== null ? { team_id: requireCourseReportExactIdentity(rawTeamId) } : {})
  };

  if (!includesExportFormat) return { filters };

  const rawFormat = getSingleCourseReportParameter(url.searchParams, "format");
  if (!COURSE_REPORT_EXPORT_FORMATS.includes(rawFormat as CourseReportExportFormat)) {
    throw courseReportRequestError("COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED");
  }
  return { filters, format: rawFormat as CourseReportExportFormat };
}

function requireCourseReportRoundNo(value: string | null): number {
  if (value === null || !/^[1-9]\d*$/.test(value)) throw courseReportRequestError();
  const roundNo = Number(value);
  if (!Number.isSafeInteger(roundNo)) throw courseReportRequestError();
  return roundNo;
}
