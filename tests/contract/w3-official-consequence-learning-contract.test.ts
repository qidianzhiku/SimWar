import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { isW3OfficialConsequenceRecord } from "@simwar/shared-contracts";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;

describe("W3 official consequence and decision learning contract", () => {
  it("accepts the safe fixture and rejects private or unsupported causal fields", () => {
    const schema = readJson("contracts/schemas/w3-official-consequence-learning.v1.json");
    const valid = readJson("contracts/fixtures/w3-official-consequence-learning.valid.json");
    const invalid = readJson("contracts/fixtures/w3-official-consequence-learning.invalid.json");
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(schema);

    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
    expect(isW3OfficialConsequenceRecord(valid)).toBe(true);
    expect(JSON.stringify(valid)).not.toContain("raw_private_payload");
    expect(JSON.stringify(valid)).not.toContain("causal_fact");
  });

  it("binds the six real BFF paths to the W3 envelope", () => {
    const openApi = yaml.load(
      readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8")
    ) as { paths?: Record<string, unknown>; components?: { schemas?: Record<string, unknown> } };
    const paths = openApi.paths ?? {};
    for (const path of [
      "/api/v1/bff/student/w3/consequence",
      "/api/v1/bff/teacher/w3/consequence",
      "/api/v1/bff/teacher/w3/counterfactual",
      "/api/v1/bff/student/w3/reflection",
      "/api/v1/bff/teacher/w3/evidence-selection",
      "/api/v1/bff/teacher/w3/next-round-hypothesis"
    ]) {
      expect(paths[path]).toBeDefined();
    }
    expect(openApi.components?.schemas?.W3OfficialConsequenceEnvelope?.properties?.data?.$ref).toBe(
      "#/components/schemas/W3OfficialConsequenceResponse"
    );
    expect(
      openApi.components?.schemas?.W3OfficialConsequenceResponse?.properties?.record?.$ref
    ).toBe("../schemas/w3-official-consequence-learning.v1.json");
  });
});
