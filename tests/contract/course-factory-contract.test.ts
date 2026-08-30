import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

function schemaValidator() {
  const ajv = new Ajv2020({ $data: true, allErrors: true, strict: true });
  ajv.addFormat("date", {
    type: "string",
    validate: (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    }
  });
  ajv.addFormat("date-time", {
    type: "string",
    validate: (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
      const parsed = new Date(value);
      const canonical = value.includes(".") ? value : value.replace("Z", ".000Z");
      return Number.isFinite(parsed.getTime()) && parsed.toISOString() === canonical;
    }
  });
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

    for (const identity of ["LATEST", "DEFAULT", "Unresolved"]) {
      const reservedIdentityCandidate = structuredClone(draft());
      reservedIdentityCandidate.version = identity;
      expect(validate(reservedIdentityCandidate)).toBe(false);
    }

    for (const timestamp of [
      "2026-02-29T00:00:00.000Z",
      "2026-04-31T00:00:00.000Z",
      "2026-01-01T24:00:00.000Z"
    ]) {
      const invalidTimestampCandidate = structuredClone(draft());
      invalidTimestampCandidate.factory_metadata.rights.expires_at = timestamp;
      expect(validate(invalidTimestampCandidate)).toBe(false);
    }

    const paddedModelArtifactCandidate = structuredClone(draft());
    paddedModelArtifactCandidate.factory_metadata.source_manifest.model_artifact_reference = {
      artifact_id: "artifact_demo",
      content_digest: "e".repeat(64),
      format: " json ",
      source_ref: "source:artifact_demo"
    };
    expect(validate(paddedModelArtifactCandidate)).toBe(false);

    const paddedModelVersionCandidate = structuredClone(draft());
    paddedModelVersionCandidate.factory_metadata.source_manifest.model_version_reference = {
      content_digest: "f".repeat(64),
      model_version_id: "model_demo",
      version: "1.0.0"
    };
    expect(validate(paddedModelVersionCandidate)).toBe(true);

    const originalLineageCandidate = structuredClone(draft());
    originalLineageCandidate.factory_metadata.provenance.source_course_package_reference = {
      content_digest: "a".repeat(64),
      course_package_id: "source_course",
      tenant_id: "tenant_demo",
      version: "1.0.0"
    };
    expect(validate(originalLineageCandidate)).toBe(false);

    const missingNonOriginalLineageCandidate = structuredClone(draft());
    missingNonOriginalLineageCandidate.factory_metadata.provenance.kind = "CLONED";
    expect(validate(missingNonOriginalLineageCandidate)).toBe(false);

    const crossTenantLineageCandidate = structuredClone(draft());
    crossTenantLineageCandidate.factory_metadata.provenance.kind = "CLONED";
    crossTenantLineageCandidate.factory_metadata.provenance.source_course_package_reference = {
      content_digest: "b".repeat(64),
      course_package_id: "source_course",
      tenant_id: "tenant_other",
      version: "1.0.0"
    };
    expect(validate(crossTenantLineageCandidate)).toBe(false);
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
      [
        "/api/v1/bff/teacher/course-factory/catalog",
        "get",
        "200",
        "CourseFactoryTeacherCatalogEnvelope"
      ],
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
