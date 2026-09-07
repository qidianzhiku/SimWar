import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const openapi = yaml.load(readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8")) as {
  paths: Record<
    string,
    { get?: { operationId?: string; parameters?: unknown[]; responses?: Record<string, unknown> } }
  >;
};
const schema = JSON.parse(
  readFileSync("contracts/schemas/industry-model-reality-join.v1.json", "utf8")
);

describe("IM-O2 Reality Join OpenAPI parity", () => {
  it("publishes all exact role routes with the same freshness contract", () => {
    for (const role of ["teacher", "admin", "student"]) {
      const operation = openapi.paths[`/api/v1/bff/${role}/model-qualification/reality-join`]?.get;
      expect(operation?.operationId).toBe(
        `INDUSTRY_MODEL_REALITY_JOIN_${role.toUpperCase()}_GET_V1`
      );
      expect(operation?.responses?.["200"]).toBeDefined();
      expect(operation?.responses?.["401"]).toBeDefined();
      expect(operation?.responses?.["403"]).toBeDefined();
      const parameters = operation?.parameters as Array<{ name?: string; required?: boolean }>;
      expect(parameters.map((parameter) => parameter.name)).toEqual(
        expect.arrayContaining([
          "courseId",
          "runId",
          "teamId",
          "roundId",
          "scenarioPackageId",
          "parameterSetId",
          "qualificationId",
          "w5DraftId",
          "expectedRealityJoinDigest"
        ])
      );
      expect(
        parameters.find((parameter) => parameter.name === "expectedRealityJoinDigest")?.required
      ).toBe(false);
      expect(parameters.find((parameter) => parameter.name === "w5DraftId")?.required).toBe(false);
    }
  });

  it("keeps the versioned schema compilable and role-safe", () => {
    expect(schema.$id).toContain("industry-model-reality-join.v1.json");
    expect(() => new Ajv2020({ allErrors: true, strict: false }).compile(schema)).not.toThrow();
    expect(schema.$defs.student.additionalProperties).toBe(false);
    expect(schema.$defs.student.properties.adoption_id).toBeUndefined();
    expect(schema.$defs.student.properties.diagnostic_evidence_digest).toBeUndefined();
  });
});
