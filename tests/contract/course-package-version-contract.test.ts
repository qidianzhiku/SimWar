import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  CoursePackageVersion,
  CoursePackageVersionAdminDto,
  CoursePackageVersionTeacherDto
} from "../../packages/shared-contracts/src/course-package-version";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;
}

interface OpenApiOperation {
  requestBody?: { content?: { "application/json"?: { schema?: { $ref?: string } } } };
  responses?: Record<string, { content?: { "application/json"?: { schema?: { $ref?: string } } } }>;
}

interface OpenApiDocument {
  paths: Record<string, Record<string, OpenApiOperation>>;
}

describe("CoursePackageVersion contract freeze", () => {
  it("accepts the immutable teaching package fixture and rejects truth, student, and open references", () => {
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(
      readJson("contracts/schemas/course-package-version.v1.json")
    );
    const valid = readJson<Record<string, unknown>>(
      "contracts/fixtures/course-package-version.valid.json"
    );
    const invalid = readJson<Record<string, unknown>>(
      "contracts/fixtures/course-package-version.invalid.json"
    );

    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "required",
          params: { missingProperty: "course_blueprint_reference" }
        }),
        expect.objectContaining({
          keyword: "required",
          params: { missingProperty: "content_digest" }
        }),
        expect.objectContaining({ keyword: "not" }),
        expect.objectContaining({ keyword: "enum" }),
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "mode" }
        }),
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "license" }
        }),
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "provenance" }
        }),
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "unknown_field" }
        })
      ])
    );
    expect(validate({ ...valid, state_true: { profit: 1 } })).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "state_true" }
        })
      ])
    );
    expect(validate({ ...valid, student_visible: true })).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "student_visible" }
        })
      ])
    );

    const scenario = valid.scenario_package_reference as Record<string, unknown>;
    expect(
      validate({ ...valid, scenario_package_reference: { ...scenario, version: "latest" } })
    ).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ keyword: "not" })])
    );
  });

  it("freezes one aggregate shape with safe admin and teacher projections", () => {
    expectTypeOf<CoursePackageVersionAdminDto>().toMatchTypeOf<CoursePackageVersion>();
    expectTypeOf<CoursePackageVersionTeacherDto>().not.toMatchTypeOf<CoursePackageVersion>();
  });

  it("binds only admin and teacher endpoints to explicit package schemas", () => {
    const openApi = yaml.load(
      readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8")
    ) as OpenApiDocument;

    const operations = [
      [
        "/api/v1/admin/course-package-versions/drafts",
        "post",
        "CoursePackageVersionDraftInput",
        "CoursePackageVersionAdminEnvelope",
        "201"
      ],
      [
        "/api/v1/admin/course-package-versions/clone",
        "post",
        "CoursePackageVersionCloneInput",
        "CoursePackageVersionAdminEnvelope",
        "201"
      ],
      [
        "/api/v1/admin/course-package-versions/import",
        "post",
        "CoursePackageVersionImportInput",
        "CoursePackageVersionAdminEnvelope",
        "201"
      ],
      [
        "/api/v1/admin/course-package-versions/{coursePackageId}/versions/{version}/export",
        "get",
        undefined,
        "CoursePackageVersionExportEnvelope",
        "200"
      ],
      [
        "/api/v1/bff/teacher/course-package-versions",
        "get",
        undefined,
        "CoursePackageVersionTeacherListEnvelope",
        "200"
      ],
      [
        "/api/v1/bff/teacher/course-package-versions/clone",
        "post",
        "CoursePackageVersionCloneInput",
        "CoursePackageVersionTeacherEnvelope",
        "201"
      ]
    ] as const;

    for (const [path, method, requestSchema, responseSchema, status] of operations) {
      const operation = openApi.paths[path]?.[method];
      expect(operation, `${method.toUpperCase()} ${path}`).toBeDefined();
      if (requestSchema) {
        expect(operation?.requestBody?.content?.["application/json"]?.schema?.$ref).toBe(
          `#/components/schemas/${requestSchema}`
        );
      }
      expect(operation?.responses?.[status]?.content?.["application/json"]?.schema?.$ref).toBe(
        `#/components/schemas/${responseSchema}`
      );
    }

    expect(openApi.paths["/api/v1/bff/student/course-package-versions"]).toBeUndefined();
  });
});
