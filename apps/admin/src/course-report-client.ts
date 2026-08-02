import {
  COURSE_REPORT_KPIS,
  COURSE_REPORT_ROLE_SLOTS,
  KNOWN_LIMITS_CATALOG,
  type ApiEnvelope,
  type CourseReportAdminDto,
  type CourseReportErrorEnvelope,
  type CourseReportExportDto,
  type CourseReportExportFormat,
  type CourseReportFailureCode,
  type CourseReportFilterInput,
  type CourseReportKpi,
  type CourseReportRoleSlot,
  type KnownLimitSemanticId
} from "@simwar/shared-contracts";

export const ADMIN_COURSE_REPORT_PATH = "/api/v1/bff/admin/course-reports";
export const ADMIN_COURSE_REPORT_EXPORT_PATH = `${ADMIN_COURSE_REPORT_PATH}/export`;

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const EXACT_IDENTITY = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/;
const INEXACT_IDENTITY_SEGMENT =
  /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i;

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
type CourseReportRequestContext = { tenantId: string; token: string };

const FAILURE_CODES = new Set<CourseReportFailureCode>([
  "COURSE_REPORT_AUTHENTICATION_REQUIRED",
  "COURSE_REPORT_INPUT_INVALID",
  "COURSE_REPORT_NOT_FOUND",
  "COURSE_REPORT_FORBIDDEN",
  "COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED"
]);
const KNOWN_LIMIT_IDS = new Set<KnownLimitSemanticId>(
  KNOWN_LIMITS_CATALOG.map((item) => item.semantic_id)
);

export class CourseReportRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: CourseReportFailureCode | "COURSE_REPORT_RESPONSE_INVALID"
  ) {
    super("Course report request failed");
    this.name = "CourseReportRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
): boolean {
  const actual = Object.keys(value);
  return (
    required.every((key) => actual.includes(key)) &&
    actual.every((key) => required.includes(key) || optional.includes(key))
  );
}

function isExactIdentity(value: unknown): value is string {
  return (
    typeof value === "string" && EXACT_IDENTITY.test(value) && !INEXACT_IDENTITY_SEGMENT.test(value)
  );
}

function isCourseReportKpi(value: unknown): value is CourseReportKpi {
  return typeof value === "string" && COURSE_REPORT_KPIS.includes(value as CourseReportKpi);
}

function isCourseReportRole(value: unknown): value is CourseReportRoleSlot {
  return (
    typeof value === "string" && COURSE_REPORT_ROLE_SLOTS.includes(value as CourseReportRoleSlot)
  );
}

function isKnownLimit(value: unknown): value is KnownLimitSemanticId {
  return typeof value === "string" && KNOWN_LIMIT_IDS.has(value as KnownLimitSemanticId);
}

function isFilter(value: unknown): value is CourseReportFilterInput {
  if (
    !isRecord(value) ||
    !hasKeys(value, ["course_id"], ["kpis", "role", "round_no", "run_id", "team_id"])
  ) {
    return false;
  }
  if (!isExactIdentity(value.course_id)) return false;
  if (value.run_id !== undefined && !isExactIdentity(value.run_id)) return false;
  if (value.team_id !== undefined && !isExactIdentity(value.team_id)) return false;
  if (value.role !== undefined && !isCourseReportRole(value.role)) return false;
  if (
    value.round_no !== undefined &&
    (typeof value.round_no !== "number" || !Number.isInteger(value.round_no) || value.round_no < 1)
  ) {
    return false;
  }
  if (value.kpis !== undefined) {
    if (
      !Array.isArray(value.kpis) ||
      value.kpis.length === 0 ||
      !value.kpis.every(isCourseReportKpi)
    ) {
      return false;
    }
    if (new Set(value.kpis).size !== value.kpis.length) return false;
  }
  return true;
}

function isMetric(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasKeys(value, ["kpi", "value"]) &&
    isCourseReportKpi(value.kpi) &&
    (typeof value.value === "string" ||
      (typeof value.value === "number" && Number.isFinite(value.value)))
  );
}

function isSafeReport(value: unknown): value is CourseReportAdminDto {
  if (
    !isRecord(value) ||
    !hasKeys(value, ["applied_filters", "known_limits", "report_schema_version", "rows"])
  ) {
    return false;
  }
  if (!isFilter(value.applied_filters)) return false;
  if (!Array.isArray(value.known_limits) || !value.known_limits.every(isKnownLimit)) return false;
  if (value.report_schema_version !== "course-report.v1" || !Array.isArray(value.rows))
    return false;
  return value.rows.every(
    (row) =>
      isRecord(row) &&
      hasKeys(row, ["course_id", "metrics", "round_no", "run_id", "team_id", "team_name"]) &&
      isExactIdentity(row.course_id) &&
      typeof row.round_no === "number" &&
      Number.isInteger(row.round_no) &&
      row.round_no >= 1 &&
      isExactIdentity(row.run_id) &&
      isExactIdentity(row.team_id) &&
      typeof row.team_name === "string" &&
      row.team_name.trim() === row.team_name &&
      row.team_name.length > 0 &&
      Array.isArray(row.metrics) &&
      row.metrics.length > 0 &&
      row.metrics.every(isMetric)
  );
}

function isErrorEnvelope(value: unknown): value is CourseReportErrorEnvelope {
  if (!isRecord(value) || !hasKeys(value, ["code", "message", "request_id"], ["details"])) {
    return false;
  }
  if (
    typeof value.code !== "string" ||
    !FAILURE_CODES.has(value.code as CourseReportFailureCode) ||
    typeof value.message !== "string" ||
    value.message.length === 0 ||
    typeof value.request_id !== "string" ||
    value.request_id.length === 0
  ) {
    return false;
  }
  return (
    value.details === undefined ||
    (Array.isArray(value.details) &&
      value.details.every(
        (detail) =>
          isRecord(detail) &&
          hasKeys(detail, ["reason"], ["field"]) &&
          typeof detail.reason === "string" &&
          detail.reason.length > 0 &&
          (detail.field === undefined ||
            (typeof detail.field === "string" && detail.field.length > 0))
      ))
  );
}

function isSuccessEnvelope<TData>(
  value: unknown,
  valid: (data: unknown) => data is TData
): value is ApiEnvelope<TData> {
  return (
    isRecord(value) &&
    hasKeys(value, ["code", "data", "message", "request_id"]) &&
    value.code === "OK" &&
    typeof value.message === "string" &&
    value.message.length > 0 &&
    typeof value.request_id === "string" &&
    value.request_id.length > 0 &&
    valid(value.data)
  );
}

function queryFor(filter: CourseReportFilterInput, format?: CourseReportExportFormat): string {
  const query = new URLSearchParams({ course_id: filter.course_id });
  if (filter.run_id) query.set("run_id", filter.run_id);
  if (filter.team_id) query.set("team_id", filter.team_id);
  if (filter.role) query.set("role", filter.role);
  if (filter.round_no) query.set("round_no", String(filter.round_no));
  for (const kpi of filter.kpis ?? []) query.append("kpi", kpi);
  if (format) query.set("format", format);
  return `?${query.toString()}`;
}

async function request<TData>(
  path: string,
  context: CourseReportRequestContext,
  fetcher: Fetcher,
  valid: (value: unknown) => value is TData
): Promise<TData> {
  const response = await fetcher(`${API_BASE}${path}`, {
    headers: {
      authorization: `Bearer ${context.token}`,
      "x-tenant-id": context.tenantId
    },
    method: "GET"
  });
  let envelope: unknown;
  try {
    envelope = await response.json();
  } catch {
    throw new CourseReportRequestError(response.status, "COURSE_REPORT_RESPONSE_INVALID");
  }
  if (!response.ok) {
    if (!isErrorEnvelope(envelope)) {
      throw new CourseReportRequestError(response.status, "COURSE_REPORT_RESPONSE_INVALID");
    }
    throw new CourseReportRequestError(response.status, envelope.code);
  }
  if (!isSuccessEnvelope(envelope, valid)) {
    throw new CourseReportRequestError(response.status, "COURSE_REPORT_RESPONSE_INVALID");
  }
  return envelope.data;
}

export function loadAdminCourseReport(
  filter: CourseReportFilterInput,
  context: CourseReportRequestContext,
  fetcher: Fetcher = fetch
): Promise<CourseReportAdminDto> {
  return request(`${ADMIN_COURSE_REPORT_PATH}${queryFor(filter)}`, context, fetcher, isSafeReport);
}

export function exportAdminCourseReport(
  filter: CourseReportFilterInput,
  format: CourseReportExportFormat,
  context: CourseReportRequestContext,
  fetcher: Fetcher = fetch
): Promise<CourseReportExportDto> {
  return request(
    `${ADMIN_COURSE_REPORT_EXPORT_PATH}${queryFor(filter, format)}`,
    context,
    fetcher,
    (value): value is CourseReportExportDto =>
      isRecord(value) &&
      hasKeys(value, ["export_format", "file_name", "report"]) &&
      (value.export_format === "json" || value.export_format === "csv") &&
      typeof value.file_name === "string" &&
      value.file_name.length > 0 &&
      isSafeReport(value.report)
  );
}
