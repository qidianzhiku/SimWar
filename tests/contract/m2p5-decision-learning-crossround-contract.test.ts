import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;

describe("M2-P5 decision learning cross-round contract", () => {
  it("accepts the bounded safe fixture and rejects private truth fields", () => {
    const schema = readJson("contracts/schemas/m2p5-decision-learning-crossround.v1.json");
    const valid = readJson("contracts/fixtures/m2p5-decision-learning-crossround.valid.json");
    const invalid = readJson("contracts/fixtures/m2p5-decision-learning-crossround.invalid.json");
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(schema);

    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
    expect(JSON.stringify(valid)).not.toContain("state_true");
    expect(JSON.stringify(valid)).not.toContain("replay_hash");
  });

  it("binds both exact-scope BFF surfaces to the M2-P5 response schema", () => {
    const openApi = yaml.load(
      readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8")
    ) as { paths?: Record<string, unknown>; components?: { schemas?: Record<string, unknown> } };
    expect(
      openApi.paths?.["/api/v1/bff/student/m2p5/runs/{runId}/rounds/{roundNo}/decision-learning"]
    ).toBeDefined();
    expect(
      openApi.paths?.["/api/v1/bff/teacher/m2p5/runs/{runId}/rounds/{roundNo}/decision-learning"]
    ).toBeDefined();
    expect(openApi.components?.schemas?.M2P5DecisionLearningEnvelope).toMatchObject({
      properties: {
        data: { $ref: "#/components/schemas/M2P5DecisionLearningResponse" }
      }
    });
    expect(openApi.components?.schemas?.M2P5DecisionLearningResponse).toMatchObject({
      $ref: "../schemas/m2p5-decision-learning-crossround.v1.json"
    });
  });
});
