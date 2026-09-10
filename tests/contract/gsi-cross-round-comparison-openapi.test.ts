import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const document = yaml.load(
  readFileSync("contracts/openapi/gsi-governed-stakeholder-shadow-plane.openapi.yaml", "utf8")
) as {
  paths: Record<
    string,
    { get?: { parameters?: Array<{ name?: string; required?: boolean; $ref?: string }> } }
  >;
  components: {
    parameters: Record<string, { name?: string; required?: boolean }>;
    schemas: Record<string, Record<string, unknown>>;
  };
};

describe("GSI cross-round comparison OpenAPI parity", () => {
  it("extends the existing role route family with exact pair parameters", () => {
    for (const role of ["teacher", "student", "admin"]) {
      const operation = document.paths[`/api/v1/bff/${role}/gsi/candidates/compare`]?.get;
      expect(operation).toBeDefined();
      expect(operation?.parameters?.map((parameter) => parameter.$ref?.split("/").pop())).toEqual(
        expect.arrayContaining([
          "FromCandidateId",
          "ToCandidateId",
          "ActivityId",
          "RoleKey",
          "ExpectedComparisonDigest",
          "ExpectedContextDigest"
        ])
      );
      expect(document.components.parameters.FromCandidateId).toMatchObject({
        name: "from_candidate_id",
        required: true
      });
    }
  });

  it("declares descriptive, non-causal and Provider-OFF response schemas", () => {
    expect(document.components.schemas.GSICrossRoundComparison).toBeDefined();
    expect(document.components.schemas.GSICrossRoundTeacherProjection).toBeDefined();
    expect(document.components.schemas.GSICrossRoundStudentProjection).toBeDefined();
    expect(document.components.schemas.GSICrossRoundAdminProjection).toBeDefined();
    const student = document.components.schemas.GSICrossRoundStudentProjection;
    const properties = student.properties as Record<string, unknown>;
    expect(properties.comparison_digest).toBeUndefined();
    expect(properties.provider).toMatchObject({ const: "OFF" });
    expect(properties.non_causal).toMatchObject({ const: true });
    expect(properties.causal_proof).toMatchObject({ const: false });
  });

  it("keeps the versioned JSON response schema closed and compilable", () => {
    const schema = JSON.parse(
      readFileSync("contracts/schemas/gsi-cross-round-comparison.v1.json", "utf8")
    ) as { $defs: Record<string, { properties?: Record<string, unknown> }> };
    expect(() =>
      new Ajv2020({ strict: true, validateFormats: false }).compile(schema)
    ).not.toThrow();
    expect(schema.$defs.student.properties?.comparison_digest).toBeUndefined();
    expect(schema.$defs.student.properties?.candidate_id).toBeUndefined();
  });
});
