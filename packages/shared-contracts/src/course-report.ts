import type { KnownLimitSemanticId } from "./known-limits.js";

export const COURSE_REPORT_SCHEMA_VERSION = "course-report.v1" as const;

/** Teacher reports consume only published, safe result projections. */
export const COURSE_REPORT_KPIS = [
  "demand_band",
  "served_demand",
  "revenue",
  "profit_band",
  "score",
  "rank"
] as const;

export type CourseReportKpi = (typeof COURSE_REPORT_KPIS)[number];

export const COURSE_REPORT_ROLE_SLOTS = ["CEO", "CFO", "CMO", "COO", "risk"] as const;

export type CourseReportRoleSlot = (typeof COURSE_REPORT_ROLE_SLOTS)[number];

export const COURSE_REPORT_EXPORT_FORMATS = ["json", "csv"] as const;

export type CourseReportExportFormat = (typeof COURSE_REPORT_EXPORT_FORMATS)[number];

export const COURSE_REPORT_FAILURE_CODES = [
  "COURSE_REPORT_INPUT_INVALID",
  "COURSE_REPORT_NOT_FOUND",
  "COURSE_REPORT_FORBIDDEN",
  "COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED"
] as const;

export type CourseReportFailureCode = (typeof COURSE_REPORT_FAILURE_CODES)[number];

/** Tenant identity is server-derived; this input never grants cross-tenant report access. */
export interface CourseReportFilterInput {
  course_id: string;
  kpis?: readonly CourseReportKpi[];
  role?: CourseReportRoleSlot;
  round_no?: number;
  run_id?: string;
  team_id?: string;
}

export interface CourseReportMetricValue {
  kpi: CourseReportKpi;
  value: number | string;
}

/** Safe, teacher-only row; it excludes state_true, Decisions, replay material, and audit internals. */
export interface CourseReportRow {
  course_id: string;
  metrics: readonly CourseReportMetricValue[];
  round_no: number;
  run_id: string;
  team_id: string;
  team_name: string;
}

export interface CourseReportDto {
  applied_filters: CourseReportFilterInput;
  known_limits: readonly KnownLimitSemanticId[];
  report_schema_version: typeof COURSE_REPORT_SCHEMA_VERSION;
  rows: readonly CourseReportRow[];
}

/** Admin and Teacher share one safe report shape; role scope is enforced by their distinct BFF routes. */
export type CourseReportAdminDto = CourseReportDto;

/** Teacher has no additional fields beyond the shared safe report shape. */
export type CourseReportTeacherDto = CourseReportDto;

/** Export remains a read-only serialization of the same safe report DTO. */
export interface CourseReportExportDto {
  export_format: CourseReportExportFormat;
  file_name: string;
  report: CourseReportDto;
}
