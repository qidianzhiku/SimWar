import type {
  CourseReportAdminDto,
  CourseReportExportDto,
  CourseReportExportFormat,
  CourseReportFailureCode,
  CourseReportFilterInput
} from "@simwar/shared-contracts";

export const ADMIN_COURSE_REPORT_PATH = "/api/v1/bff/admin/course-reports";
export const ADMIN_COURSE_REPORT_EXPORT_PATH = `${ADMIN_COURSE_REPORT_PATH}/export`;

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
type ResponseEnvelope<TData> = { code?: unknown; data?: TData; message?: unknown; request_id?: unknown };

const FAILURE_CODES = new Set<CourseReportFailureCode>([
  "COURSE_REPORT_AUTHENTICATION_REQUIRED",
  "COURSE_REPORT_INPUT_INVALID",
  "COURSE_REPORT_NOT_FOUND",
  "COURSE_REPORT_FORBIDDEN",
  "COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED"
]);

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

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isSafeReport(value: unknown): value is CourseReportAdminDto {
  if (!isRecord(value) || !hasOnlyKeys(value, ["applied_filters", "known_limits", "report_schema_version", "rows"])) {
    return false;
  }
  if (!isRecord(value.applied_filters) || typeof value.applied_filters.course_id !== "string") return false;
  if (!Array.isArray(value.known_limits) || !value.known_limits.every((item) => typeof item === "string")) return false;
  if (value.report_schema_version !== "course-report.v1" || !Array.isArray(value.rows)) return false;
  return value.rows.every(
    (row) =>
      isRecord(row) &&
      hasOnlyKeys(row, ["course_id", "metrics", "round_no", "run_id", "team_id", "team_name"]) &&
      typeof row.course_id === "string" &&
      typeof row.round_no === "number" &&
      typeof row.run_id === "string" &&
      typeof row.team_id === "string" &&
      typeof row.team_name === "string" &&
      Array.isArray(row.metrics) &&
      row.metrics.every(
        (metric) =>
          isRecord(metric) &&
          hasOnlyKeys(metric, ["kpi", "value"]) &&
          typeof metric.kpi === "string" &&
          (typeof metric.value === "string" || typeof metric.value === "number")
      )
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
  token: string,
  fetcher: Fetcher,
  valid: (value: unknown) => value is TData
): Promise<TData> {
  const response = await fetcher(path, { headers: { authorization: `Bearer ${token}` }, method: "GET" });
  let envelope: ResponseEnvelope<unknown>;
  try {
    envelope = (await response.json()) as ResponseEnvelope<unknown>;
  } catch {
    throw new CourseReportRequestError(response.status, "COURSE_REPORT_RESPONSE_INVALID");
  }
  if (!response.ok) {
    throw new CourseReportRequestError(
      response.status,
      typeof envelope.code === "string" && FAILURE_CODES.has(envelope.code as CourseReportFailureCode)
        ? (envelope.code as CourseReportFailureCode)
        : "COURSE_REPORT_RESPONSE_INVALID"
    );
  }
  if (!valid(envelope.data)) throw new CourseReportRequestError(response.status, "COURSE_REPORT_RESPONSE_INVALID");
  return envelope.data;
}

export function loadAdminCourseReport(
  filter: CourseReportFilterInput,
  token: string,
  fetcher: Fetcher = fetch
): Promise<CourseReportAdminDto> {
  return request(`${ADMIN_COURSE_REPORT_PATH}${queryFor(filter)}`, token, fetcher, isSafeReport);
}

export function exportAdminCourseReport(
  filter: CourseReportFilterInput,
  format: CourseReportExportFormat,
  token: string,
  fetcher: Fetcher = fetch
): Promise<CourseReportExportDto> {
  return request(`${ADMIN_COURSE_REPORT_EXPORT_PATH}${queryFor(filter, format)}`, token, fetcher, (value): value is CourseReportExportDto =>
    isRecord(value) &&
    hasOnlyKeys(value, ["export_format", "file_name", "report"]) &&
    (value.export_format === "json" || value.export_format === "csv") &&
    typeof value.file_name === "string" &&
    isSafeReport(value.report)
  );
}
