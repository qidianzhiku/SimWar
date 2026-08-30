import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

function schemaValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  return ajv.compile(
    JSON.parse(readFileSync(resolve("contracts/schemas/course-factory.v1.json"), "utf8"))
  );
}

function reference(kind: "blueprint" | "scenario" | "parameter", character: string) {
  return kind === "blueprint"
    ? {
        content_digest: character.repeat(64),
        course_blueprint_id: "blueprint_demo",
        tenant_id: "tenant_demo",
        version: "1.0.0"
      }
    : kind === "scenario"
      ? {
          content_digest: character.repeat(64),
          scenario_package_id: "scenario_demo",
          tenant_id: "tenant_demo",
          version: "1.0.0"
        }
      : {
          content_digest: character.repeat(64),
          parameter_set_id: "parameter_demo",
          version: "1.0.0"
        };
}

function draft() {
  return {
    course_blueprint_reference: reference("blueprint", "a"),
    course_package_id: "course_factory_demo",
    description: "A governed course package.",
    factory_metadata: {
      known_limits: ["JSON runtime only"],
      provenance: { kind: "ORIGINAL" },
      rights: {
        allowed_tenant_ids: ["tenant_demo"],
        copy_allowed: true,
        export_allowed: true,
        expires_at: "2027-08-30T00:00:00.000Z",
        owner_tenant_id: "tenant_demo"
      },
      schema_version: "course-factory.v1",
      source_manifest: {
        course_blueprint_reference: reference("blueprint", "a"),
        parameter_set_reference: reference("parameter", "c"),
        scenario_package_reference: reference("scenario", "b")
      },
      user_data_policy: {
        copied_private_data: false,
        copied_user_decisions: false,
        copied_user_results: false
      }
    },
    parameter_set_reference: reference("parameter", "c"),
    scenario_package_reference: reference("scenario", "b"),
    title: "Governed course",
    version: "1.0.0"
  };
}

describe("Course Factory contract", () => {
  it("accepts exact draft metadata and rejects user-data copying or open identities", () => {
    const validate = schemaValidator();
    expect(validate({ ...draft() })).toBe(true);

    const userDataCandidate = structuredClone(draft());
    userDataCandidate.factory_metadata.user_data_policy.copied_private_data = true;
    expect(validate(userDataCandidate)).toBe(false);

    const openIdentityCandidate = structuredClone(draft());
    openIdentityCandidate.version = "latest";
    expect(validate(openIdentityCandidate)).toBe(false);
  });

  it("binds all factory routes to exact request and response contracts", () => {
    const openApi = yaml.load(
      readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8")
    ) as {
      paths: Record<
        string,
        Record<string, { requestBody?: unknown; responses?: Record<string, unknown> }>
      >;
    };
    const expected: readonly [string, string, string, string][] = [
      ["/api/v1/admin/course-factory/catalog", "get", "200", "CourseFactoryCatalogEnvelope"],
      ["/api/v1/admin/course-factory/versions", "post", "201", "CourseFactoryVersionEnvelope"],
      [
        "/api/v1/admin/course-factory/versions/clone",
        "post",
        "201",
        "CourseFactoryVersionEnvelope"
      ],
      [
        "/api/v1/admin/course-factory/versions/rollback",
        "post",
        "201",
        "CourseFactoryVersionEnvelope"
      ],
      [
        "/api/v1/admin/course-factory/versions/{coursePackageId}/versions/{version}/{action}",
        "post",
        "200",
        "CourseFactoryVersionEnvelope"
      ],
      [
        "/api/v1/admin/course-factory/versions/{coursePackageId}/versions/{version}/audit",
        "get",
        "200",
        "CourseFactoryAuditEnvelope"
      ],
      [
        "/api/v1/admin/course-factory/versions/{coursePackageId}/versions/{version}/export",
        "get",
        "200",
        "CourseFactoryVersionEnvelope"
      ],
      ["/api/v1/bff/teacher/course-factory/catalog", "get", "200", "CourseFactoryCatalogEnvelope"],
      [
        "/api/v1/bff/enterprise/course-factory/sponsor",
        "get",
        "200",
        "CourseFactorySponsorEnvelope"
      ]
    ];

    for (const [path, method, status, responseSchema] of expected) {
      const operation = openApi.paths[path]?.[method] as
        | {
            requestBody?: { content?: { "application/json"?: { schema?: { $ref?: string } } } };
            responses?: Record<
              string,
              { content?: { "application/json"?: { schema?: { $ref?: string } } } }
            >;
          }
        | undefined;
      expect(operation, `${method.toUpperCase()} ${path}`).toBeDefined();
      expect(operation?.responses?.[status]?.content?.["application/json"]?.schema?.$ref).toBe(
        `#/components/schemas/${responseSchema}`
      );
    }

    expect(
      (
        openApi.paths["/api/v1/admin/course-factory/versions"]?.post as {
          requestBody?: { content?: { "application/json"?: { schema?: { $ref?: string } } } };
        }
      ).requestBody?.content?.["application/json"]?.schema?.$ref
    ).toBe("#/components/schemas/CourseFactoryDraftInput");
  });
});
