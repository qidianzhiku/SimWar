import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;

describe("M4 multi-path counterfactual transfer contract", () => {
  it("accepts bounded student projection and rejects official writes", () => {
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(
      readJson("contracts/schemas/m4-multipath-counterfactual-transfer.v1.json")
    );
    const valid = readJson("contracts/fixtures/m4-multipath-counterfactual-transfer.valid.json");
    const invalid = readJson(
      "contracts/fixtures/m4-multipath-counterfactual-transfer.invalid.json"
    );
    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
    expect(JSON.stringify(valid)).not.toContain("raw_counterfactual_state:");
    expect(JSON.stringify(valid)).toContain('"officiality":"OFFICIAL"');
    expect(JSON.stringify(valid)).toContain('"official_decision_writes":false');
  });
});
