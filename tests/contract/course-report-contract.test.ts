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
    { content?: { "application/json"?: { schema?: { $ref?: string } } }; description?: string }
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
    expectTypeOf<CourseReportExportDto>().toMatchTypeOf<{ report: CourseReportDto }>();
  });

  it("binds teacher report and export endpoints, with no student counterpart", () => {
    const openApi = yaml.load(
      readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8")
    ) as OpenApiDocument;

    expect(openApi.components.schemas.CourseReport).toMatchObject({
      $ref: "../schemas/course-report.v1.json"
    });

    for (const [path, responseSchema] of [
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
    }

    expect(openApi.paths["/api/v1/bff/student/course-reports"]).toBeUndefined();
    expect(openApi.components.schemas.CourseReportFilterInput).toBeDefined();
    expect(openApi.components.schemas.CourseReportExport).toBeDefined();
  });
});
