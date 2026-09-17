import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import SwaggerParser from "@apidevtools/swagger-parser";
import { isGSICrossRoundPairOptions } from "@simwar/shared-contracts";
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
  it("binds existing canonical GSI objects rather than new contract aliases", () => {
    for (const [name, definition] of [
      ["GSIRequest", "request"],
      ["GSIReceipt", "receipt"],
      ["GSIExactBinding", "binding"],
      ["GSITeacherProjection", "teacherProjection"]
    ]) {
      expect(document.components.schemas[name!]).toEqual({
        $ref: `../schemas/gsi-governed-stakeholder-shadow-plane.v1.json#/$defs/${definition}`
      });
    }
    for (const name of [
      "GSICrossRoundComparison",
      "GSICrossRoundTeacherProjection",
      "GSICrossRoundStudentProjection",
      "GSICrossRoundAdminProjection",
      "GSICrossRoundPairOptions"
    ]) {
      expect(document.components.schemas[name]?.["x-shared-contract"]).toBe(name);
    }
    expect(document.components.schemas.GSICrossRoundContext?.["x-shared-contract"]).toBe(
      "GSICrossRoundContextProjection"
    );
  });

  it("validates the actual pair-options envelope and exact runtime identifier constraints", async () => {
    const spec = (await SwaggerParser.dereference(
      "contracts/openapi/gsi-governed-stakeholder-shadow-plane.openapi.yaml"
    )) as unknown as {
      paths: Record<
        string,
        {
          get: {
            parameters: Array<{ schema: Record<string, unknown> }>;
            responses: Record<
              string,
              { content: { "application/json": { schema: Record<string, unknown> } } }
            >;
          };
        }
      >;
    };
    const ajv = new Ajv2020({ strict: false, validateFormats: false });
    const valid = {
      surface: "student",
      context: {
        tenant_id: "tenant_demo",
        course_id: "course_demo",
        run_id: "run_demo",
        team_id: "team_demo",
        activity_id: "activity_demo",
        role_key: "CEO"
      },
      rounds: [{ round_id: "round_1", round_no: 1 }],
      provider: "OFF",
      official_truth_write: false,
      non_causal: true,
      causal_proof: false,
      known_limits: ["read only"]
    };
    expect(isGSICrossRoundPairOptions(valid)).toBe(true);
    for (const surface of ["teacher", "student", "admin"]) {
      const operation = spec.paths[`/api/v1/bff/${surface}/gsi/candidates/pair-options`].get;
      const validate = ajv.compile(operation.responses["200"].content["application/json"].schema);
      const data = { ...valid, surface };
      expect(validate({ code: "OK", data, message: "success", request_id: "req_1" })).toBe(true);
      expect(validate(data)).toBe(false);
      for (const parameter of operation.parameters) {
        const identifier = ajv.compile(parameter.schema);
        for (const rejected of [
          "",
          " ",
          " course_demo",
          "course_demo ",
          "latest",
          "LATEST",
          "Current",
          "Default",
          "Fallback",
          "First",
          "Last",
          "Newest"
        ])
          expect(identifier(rejected), rejected).toBe(false);
        for (const accepted of ["course_demo", "contains space", "round_latest_1"])
          expect(identifier(accepted), accepted).toBe(true);
      }
    }
    for (const field of ["context", "rounds", "provider", "non_causal"]) {
      expect(isGSICrossRoundPairOptions({ ...valid, [field]: null })).toBe(false);
    }
    expect(
      isGSICrossRoundPairOptions({
        ...valid,
        context: { ...valid.context, round_id: "unexpected" }
      })
    ).toBe(false);
  });

  it("extends the existing role route family with exact candidate or round-pair parameters", () => {
    for (const role of ["teacher", "student", "admin"]) {
      const operation = document.paths[`/api/v1/bff/${role}/gsi/candidates/compare`]?.get;
      expect(operation).toBeDefined();
      expect(operation?.parameters?.map((parameter) => parameter.$ref?.split("/").pop())).toEqual(
        expect.arrayContaining([
          "FromCandidateId",
          "ToCandidateId",
          "FromRoundId",
          "ToRoundId",
          "CourseId",
          "RunId",
          "TeamId",
          "ActivityId",
          "RoleKey",
          "ExpectedComparisonDigest",
          "ExpectedContextDigest"
        ])
      );
      expect(document.components.parameters.FromCandidateId).toMatchObject({
        name: "from_candidate_id",
        required: false
      });
      expect(document.components.parameters.ToCandidateId?.required).toBe(false);
      expect(document.components.parameters.FromRoundId?.name).toBe("from_round_id");
      expect(document.components.parameters.ToRoundId?.name).toBe("to_round_id");
      expect(document.paths[`/api/v1/bff/${role}/gsi/candidates/pair-options`]?.get).toBeDefined();
      const modes = (operation as { [key: string]: unknown } | undefined)?.["x-gsi-query-modes"] as
        | Array<{ name: string; required: string[]; forbidden: string[] }>
        | undefined;
      expect(modes).toEqual([
        {
          name: "exact_candidate_pair",
          required: ["from_candidate_id", "to_candidate_id", "activity_id", "role_key"],
          forbidden: ["from_round_id", "to_round_id", "course_id", "run_id", "team_id"]
        },
        {
          name: "exact_round_pair",
          required: [
            "course_id",
            "run_id",
            "team_id",
            "from_round_id",
            "to_round_id",
            "activity_id",
            "role_key"
          ],
          forbidden: ["from_candidate_id", "to_candidate_id"]
        }
      ]);
    }
  });

  it("marks every pair-options context parameter as route-required without changing compare optionality", () => {
    const expectedNames = ["course_id", "run_id", "team_id", "activity_id", "role_key"];

    for (const role of ["teacher", "student", "admin"]) {
      const operation = document.paths[`/api/v1/bff/${role}/gsi/candidates/pair-options`]?.get;
      expect(operation).toBeDefined();
      const parameters = operation?.parameters ?? [];
      const resolved = parameters.map((parameter) => {
        const componentName = parameter.$ref?.split("/").pop();
        return componentName ? document.components.parameters[componentName] : parameter;
      });

      expect(resolved.map((parameter) => parameter?.name)).toEqual(expectedNames);
      expect(resolved.every((parameter) => parameter?.required === true)).toBe(true);
    }

    expect(document.components.parameters.CourseId?.required).toBe(false);
    expect(document.components.parameters.RunId?.required).toBe(false);
    expect(document.components.parameters.TeamId?.required).toBe(false);
  });

  it("declares descriptive, non-causal and Provider-OFF response schemas", () => {
    expect(document.components.schemas.GSICrossRoundComparison).toBeDefined();
    expect(document.components.schemas.GSICrossRoundTeacherProjection).toBeDefined();
    expect(document.components.schemas.GSICrossRoundStudentProjection).toBeDefined();
    expect(document.components.schemas.GSICrossRoundAdminProjection).toBeDefined();
    expect(document.components.schemas.GSICrossRoundPairOptions).toBeDefined();
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

  it("declares a closed safe pair-options schema without candidate identifiers", () => {
    const schema = JSON.parse(
      readFileSync("contracts/schemas/gsi-cross-round-pair-options.v1.json", "utf8")
    ) as {
      properties: Record<string, unknown>;
      $defs: Record<string, { properties?: Record<string, unknown> }>;
    };
    expect(() =>
      new Ajv2020({ strict: true, validateFormats: false }).compile(schema)
    ).not.toThrow();
    expect(schema.properties.candidate_id).toBeUndefined();
    expect(schema.$defs.context.properties?.candidate_id).toBeUndefined();
    expect(schema.$defs.round.properties?.candidate_id).toBeUndefined();
  });
});
