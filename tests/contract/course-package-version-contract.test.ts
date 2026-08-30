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
import {
  assertValidCoursePackageVersion,
  calculateCoursePackageContentDigest
} from "../../services/api/src/course-package-json-registry";

function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as T;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = new Date(value);
  const canonical = value.includes(".") ? value : value.replace("Z", ".000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === canonical;
}

function compileCoursePackageSchema() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addFormat("date", { type: "string", validate: isValidDate });
  ajv.addFormat("date-time", { type: "string", validate: isValidDateTime });
  ajv.addSchema(readJson("contracts/schemas/teacher-scenario-studio.v1.json"));
  return ajv.compile(readJson("contracts/schemas/course-package-version.v1.json"));
}

interface OpenApiOperation {
  requestBody?: { content?: { "application/json"?: { schema?: { $ref?: string } } } };
  responses?: Record<
    string,
    { content?: { "application/json"?: { schema?: { $ref?: string } } }; description?: string }
  >;
}

interface OpenApiDocument {
  components: {
    schemas: Record<
      string,
      { $ref?: string; properties?: Record<string, { $ref?: string; pattern?: string }> }
    >;
  };
  paths: Record<string, Record<string, OpenApiOperation>>;
}

describe("CoursePackageVersion contract freeze", () => {
  it("accepts the immutable teaching package fixture and rejects truth, student, and open references", () => {
    const validate = compileCoursePackageSchema();
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

  it("keeps the valid fixture semantically valid and rejects schema-valid whitespace that runtime rejects", () => {
    const validate = compileCoursePackageSchema();
    const valid = readJson<CoursePackageVersion>(
      "contracts/fixtures/course-package-version.valid.json"
    );

    expect(() => assertValidCoursePackageVersion(valid)).not.toThrow();

    for (const field of ["description", "title"] as const) {
      const whitespaceCandidate: CoursePackageVersion = {
        ...valid,
        [field]: `${valid[field]} `,
        content_digest: calculateCoursePackageContentDigest({
          course_blueprint_reference: valid.course_blueprint_reference,
          course_package_id: valid.course_package_id,
          description: field === "description" ? `${valid.description} ` : valid.description,
          parameter_set_reference: valid.parameter_set_reference,
          scenario_package_reference: valid.scenario_package_reference,
          title: field === "title" ? `${valid.title} ` : valid.title,
          version: valid.version
        })
      };

      expect(validate(whitespaceCandidate)).toBe(false);
      expect(() => assertValidCoursePackageVersion(whitespaceCandidate)).toThrow(
        "COURSE_PACKAGE_INPUT_INVALID"
      );
    }

    const openApi = yaml.load(
      readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8")
    ) as OpenApiDocument;
    for (const schemaName of ["CoursePackageVersionDraftInput", "CoursePackageVersionCloneInput"]) {
      expect(openApi.components.schemas[schemaName]?.properties?.title?.pattern).toBe(
        "^\\S(?:[\\s\\S]*\\S)?$"
      );
      expect(openApi.components.schemas[schemaName]?.properties?.description?.pattern).toBe(
        "^\\S(?:[\\s\\S]*\\S)?$"
      );
    }
    expect(openApi.components.schemas.CoursePackageVersion?.$ref).toBe(
      "../schemas/course-package-version.v1.json"
    );
  });

  it("rejects impossible calendar values in timestamp fields", () => {
    const validate = compileCoursePackageSchema();
    const valid = readJson<Record<string, unknown>>(
      "contracts/fixtures/course-package-version.valid.json"
    );

    expect(validate({ ...valid, created_at: "2026-13-40T00:00:00.000Z" })).toBe(false);
  });

  it("accepts the optional Teacher Scenario Studio configuration in the package contract", () => {
    const validate = compileCoursePackageSchema();
    const valid = readJson<CoursePackageVersion>(
      "contracts/fixtures/course-package-version.valid.json"
    );
    const studio_configuration = {
      custom_parameters: { mode: "DRAFT_ONLY", values: { custom_rate: 1.2 } },
      experience_profile: "STANDARD",
      model_version_ref: "toy_logit_wellness_v1@0.1.0",
      module_configuration: {
        capital: { enabled: true },
        environment: { region: "generic" },
        funding: { enabled: true },
        policy_shocks: { enabled: false },
        project_template: { template_id: "generic" },
        workforce: { enabled: true }
      },
      schema_version: "teacher-scenario-studio.v1"
    } as const;
    const candidate: CoursePackageVersion = {
      ...valid,
      content_digest: calculateCoursePackageContentDigest({
        ...valid,
        studio_configuration
      }),
      studio_configuration
    };

    expect(validate(candidate)).toBe(true);
    expect(() => assertValidCoursePackageVersion(candidate)).not.toThrow();
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
    expect(openApi.components.schemas.CoursePackageVersionReferenceInput).toMatchObject({
      properties: {
        course_package_id: { $ref: "#/components/schemas/CoursePackageExactIdentity" },
        version: { $ref: "#/components/schemas/CoursePackageExactVersion" }
      }
    });
    expect(openApi.components.schemas.CoursePackageExactVersion).toBeDefined();
    expect(
      openApi.paths["/api/v1/admin/course-package-versions/clone"]?.post?.responses?.["404"]
    ).toBeDefined();
    expect(
      openApi.paths["/api/v1/bff/teacher/course-package-versions/clone"]?.post?.responses?.["404"]
    ).toBeDefined();
    expect(
      openApi.paths["/api/v1/admin/course-package-versions/clone"]?.post?.responses?.["409"]
        ?.description
    ).toContain("source package is not AVAILABLE");
    expect(
      openApi.paths["/api/v1/bff/teacher/course-package-versions/clone"]?.post?.responses?.["409"]
        ?.description
    ).toContain("source package is not AVAILABLE");
  });

  it("publishes the explicit tenant baseline provisioning API contract", () => {
    const openApi = yaml.load(
      readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8")
    ) as OpenApiDocument;
    const operation = openApi.paths["/api/v1/admin/tenant-baselines/provision"]?.post;

    expect(operation?.requestBody?.content?.["application/json"]?.schema?.$ref).toBe(
      "#/components/schemas/TenantBaselineProvisioningRequest"
    );
    for (const status of ["200", "201"] as const) {
      expect(operation?.responses?.[status]?.content?.["application/json"]?.schema?.$ref).toBe(
        "#/components/schemas/TenantBaselineProvisioningEnvelope"
      );
    }
    for (const status of ["401", "403", "404", "409", "422"] as const) {
      expect(operation?.responses?.[status]).toBeDefined();
    }
    expect(openApi.components.schemas.TenantBaselineProvisioningRequest).toMatchObject({
      additionalProperties: false,
      properties: {
        source_parameter_set: {
          $ref: "#/components/schemas/TenantBaselineParameterSetSource"
        },
        source_scenario_package: {
          $ref: "#/components/schemas/TenantBaselineScenarioPackageSource"
        }
      }
    });
    expect(
      openApi.components.schemas.TenantBaselineProvisioningRequest.properties
    ).not.toHaveProperty("local_display_metadata");
    expect(openApi.components.schemas.TenantBaselineProvenance.required).not.toContain(
      "requested_local_metadata"
    );
    expect(openApi.components.schemas.TenantBaselineProvenance.properties).not.toHaveProperty(
      "requested_local_metadata"
    );
    expect(openApi.components.schemas.TenantBaselineProvisioningResult).toMatchObject({
      properties: {
        provenance: { $ref: "#/components/schemas/TenantBaselineProvenance" }
      }
    });
  });
});
