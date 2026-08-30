import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

describe("regional-transfer.v1 contract", () => {
  it("declares the exact-reference and role-safe product envelope", () => {
    const schema = JSON.parse(
      readFileSync("contracts/schemas/regional-transfer.v1.json", "utf8")
    ) as {
      required: string[];
      properties: Record<string, { const?: unknown; required?: string[] }>;
    };
    expect(schema.required).toEqual(
      expect.arrayContaining([
        "candidate_ref",
        "scope",
        "baseline",
        "target",
        "formal_references",
        "provenance",
        "qualification",
        "requalification",
        "activation",
        "authority",
        "known_limits"
      ])
    );
    expect(schema.properties.schema_version.const).toBe("regional-transfer.v1");
    expect(schema.properties.requalification.required).toEqual(
      expect.arrayContaining([
        "baseline",
        "model_version_comparison",
        "reason_codes",
        "status",
        "target",
        "transfer_mode"
      ])
    );
  });

  it("accepts the exact formal-reference shapes emitted by the product service", () => {
    const schema = JSON.parse(
      readFileSync("contracts/schemas/regional-transfer.v1.json", "utf8")
    ) as {
      $defs: Record<string, unknown>;
      properties: Record<string, Record<string, unknown>>;
    };
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $defs: schema.$defs,
      ...schema.properties.formal_references
    });

    expect(
      validate({
        course_blueprint_reference: {
          content_digest: "a".repeat(64),
          course_blueprint_id: "blueprint_rt_001",
          tenant_id: "tenant_demo",
          version: "1.0.0"
        },
        parameter_set_reference: {
          content_digest: "b".repeat(64),
          parameter_set_id: "parameter_rt_001",
          version: "1.0.0"
        },
        scenario_package_reference: {
          content_digest: "c".repeat(64),
          scenario_package_id: "scenario_rt_001",
          tenant_id: "tenant_demo",
          version: "1.0.0"
        }
      })
    ).toBe(true);
  });

  it("documents every reachable regional-transfer BFF route in OpenAPI", () => {
    const openapi = readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8");
    const operations = [
      [
        "/api/v1/bff/teacher/regional-transfer/selection",
        "REGIONAL_TRANSFER_SELECTION_GET_V1",
        "200"
      ],
      ["/api/v1/bff/teacher/regional-transfer", "REGIONAL_TRANSFER_TEACHER_LIST_V1", "200"],
      ["/api/v1/bff/teacher/regional-transfer/preview", "REGIONAL_TRANSFER_PREVIEW_V1", "200"],
      ["/api/v1/bff/teacher/regional-transfer/validate", "REGIONAL_TRANSFER_VALIDATE_V1", "200"],
      ["/api/v1/bff/teacher/regional-transfer/freeze", "REGIONAL_TRANSFER_FREEZE_V1", "201"],
      [
        "/api/v1/bff/teacher/regional-transfer/candidates/{candidateId}/bind",
        "REGIONAL_TRANSFER_BIND_V1",
        "200"
      ],
      [
        "/api/v1/bff/student/regional-transfer/candidates/{candidateId}",
        "REGIONAL_TRANSFER_STUDENT_PROJECTION_GET_V1",
        "200"
      ],
      [
        "/api/v1/bff/admin/regional-transfer/candidates/{candidateId}",
        "REGIONAL_TRANSFER_ADMIN_AUDIT_GET_V1",
        "200"
      ]
    ] as const;

    for (const [path, operationId, successStatus] of operations) {
      const start = openapi.indexOf(`  ${path}:`);
      expect(start, path).toBeGreaterThanOrEqual(0);
      const nextPath = openapi.indexOf("\n  /api/", start + 1);
      const operation = openapi.slice(start, nextPath === -1 ? undefined : nextPath);
      expect(operation).toContain(`operationId: ${operationId}`);
      expect(operation).toContain("SessionBearer");
      expect(operation).toContain("responses:");
      expect(operation).toContain(`"${successStatus}"`);
      expect(operation).toContain("schema:");
    }
  });
});
