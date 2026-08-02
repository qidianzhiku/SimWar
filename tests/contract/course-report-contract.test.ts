import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  COURSE_REPORT_EXPORT_FORMATS,
  COURSE_REPORT_KPIS,
  COURSE_REPORT_SCHEMA_VERSION,
  type CourseReportDto,
  type CourseReportAdminDto,
  type CourseReportErrorEnvelope,
  type CourseReportExportDto,
  type CourseReportFilterInput
} from "../../packages/shared-contracts/src/index.js";

function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as T;
}

interface OpenApiOperation {
  parameters?: Array<{ in: string; name: string; required?: boolean }>;
  responses?: Record<
    string,
    {
      content?: { "application/json"?: { schema?: { $ref?: string } } };
      description?: string;
      "x-simwar-course-report-error-codes"?: string[];
    }
  >;
}

interface OpenApiDocument {
  components: { schemas: Record<string, { $ref?: string; properties?: Record<string, unknown> }> };
  paths: Record<string, Record<string, OpenApiOperation>>;
}

describe("Course Report Builder contract freeze", () => {
  it("accepts only the teacher-safe report fixture and rejects truth, replay, and student fields", () => {
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(
      readJson("contracts/schemas/course-report.v1.json")
    );
    const valid = readJson<Record<string, unknown>>("contracts/fixtures/course-report.valid.json");
    const invalid = readJson<Record<string, unknown>>(
      "contracts/fixtures/course-report.invalid.json"
    );

    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "state_true" }
        }),
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "replay_hash" }
        }),
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "decision_batch_hash" }
        }),
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "student_visible" }
        })
      ])
    );
    expect(validate({ ...valid, canonical_evidence_digest: "a".repeat(64) })).toBe(false);
  });

  it("freezes closed filters, KPI vocabulary, export formats, and safe DTO relationships", () => {
    const filter: CourseReportFilterInput = {
      course_id: "course_001",
      kpis: ["revenue", "score"],
      role: "CEO",
      round_no: 1
    };
    const report: CourseReportDto = {
      applied_filters: filter,
      known_limits: ["JSON_INTERNAL_ONLY", "POSTGRESQL_NOT_ACTIVE"],
      report_schema_version: COURSE_REPORT_SCHEMA_VERSION,
      rows: []
    };
    const exportPayload: CourseReportExportDto = {
      export_format: "csv",
      file_name: "course_001-report.csv",
      report
    };

    expect(COURSE_REPORT_KPIS).toEqual([
      "demand_band",
      "served_demand",
      "revenue",
      "profit_band",
      "score",
      "rank"
    ]);
    expect(COURSE_REPORT_EXPORT_FORMATS).toEqual(["json", "csv"]);
    expect(exportPayload.report.rows).toEqual([]);
    expectTypeOf<CourseReportAdminDto>().toMatchTypeOf<CourseReportDto>();
    expectTypeOf<CourseReportExportDto>().toMatchTypeOf<{ report: CourseReportDto }>();
  });

  it("binds role-specific admin and teacher report/export endpoints, with no student counterpart", () => {
    const openApi = yaml.load(
      readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8")
    ) as OpenApiDocument;

    expect(openApi.components.schemas.CourseReport).toMatchObject({
      $ref: "../schemas/course-report.v1.json"
    });

    for (const [path, responseSchema] of [
      ["/api/v1/bff/admin/course-reports", "CourseReportAdminEnvelope"],
      ["/api/v1/bff/admin/course-reports/export", "CourseReportAdminExportEnvelope"],
      ["/api/v1/bff/teacher/course-reports", "CourseReportTeacherEnvelope"],
      ["/api/v1/bff/teacher/course-reports/export", "CourseReportExportEnvelope"]
    ] as const) {
      const operation = openApi.paths[path]?.get;
      expect(operation, `GET ${path}`).toBeDefined();
      expect(operation?.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ in: "query", name: "course_id", required: true }),
          expect.objectContaining({ in: "query", name: "run_id" }),
          expect.objectContaining({ in: "query", name: "team_id" }),
          expect.objectContaining({ in: "query", name: "role" }),
          expect.objectContaining({ in: "query", name: "round_no" }),
          expect.objectContaining({ in: "query", name: "kpi" })
        ])
      );
      expect(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref).toBe(
        `#/components/schemas/${responseSchema}`
      );
      expect(operation?.parameters).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ in: "query", name: "tenant_id" })])
      );
    }

    expect(openApi.paths["/api/v1/bff/admin/course-reports"]?.get?.description).toContain(
      "tenant_admin"
    );
    expect(openApi.paths["/api/v1/bff/teacher/course-reports"]?.get?.description).toContain(
      "teacher"
    );
    expect(openApi.paths["/api/v1/bff/student/course-reports"]).toBeUndefined();
    expect(openApi.components.schemas.CourseReportFilterInput).toBeDefined();
    expect(openApi.components.schemas.CourseReportExport).toBeDefined();
  });

  it("freezes structured stable failure envelopes for every report route", () => {
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(
      readJson("contracts/schemas/course-report-error-envelope.v1.json")
    );
    const authenticationFailure: CourseReportErrorEnvelope = {
      code: "COURSE_REPORT_AUTHENTICATION_REQUIRED",
      message: "Authentication required",
      request_id: "request_course_report_001"
    };

    expect(validate(authenticationFailure)).toBe(true);
    expect(validate({ ...authenticationFailure, code: "AUTH-401-001" })).toBe(false);
    expect(
      validate({ ...authenticationFailure, code: "COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED" })
    ).toBe(true);

    const openApi = yaml.load(
      readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8")
    ) as OpenApiDocument;
    const routeErrorCodes = [
      ["/api/v1/bff/admin/course-reports", ["COURSE_REPORT_INPUT_INVALID"]],
      [
        "/api/v1/bff/admin/course-reports/export",
        ["COURSE_REPORT_INPUT_INVALID", "COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED"]
      ],
      ["/api/v1/bff/teacher/course-reports", ["COURSE_REPORT_INPUT_INVALID"]],
      [
        "/api/v1/bff/teacher/course-reports/export",
        ["COURSE_REPORT_INPUT_INVALID", "COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED"]
      ]
    ] as const;

    for (const [path, expected422Codes] of routeErrorCodes) {
      const responses = openApi.paths[path]?.get?.responses;
      for (const status of ["401", "403", "404", "422"] as const) {
        expect(responses?.[status]?.content?.["application/json"]?.schema?.$ref).toBe(
          "#/components/schemas/CourseReportErrorEnvelope"
        );
      }
      expect(responses?.["401"]?.["x-simwar-course-report-error-codes"]).toEqual([
        "COURSE_REPORT_AUTHENTICATION_REQUIRED"
      ]);
      expect(responses?.["403"]?.["x-simwar-course-report-error-codes"]).toEqual([
        "COURSE_REPORT_FORBIDDEN"
      ]);
      expect(responses?.["404"]?.["x-simwar-course-report-error-codes"]).toEqual([
        "COURSE_REPORT_NOT_FOUND"
      ]);
      expect(responses?.["422"]?.["x-simwar-course-report-error-codes"]).toEqual(expected422Codes);
    }
  });
});
