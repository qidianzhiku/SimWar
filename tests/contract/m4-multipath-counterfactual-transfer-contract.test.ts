import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import type { M4MultipathCounterfactualResponse } from "@simwar/shared-contracts";

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
    const teacherPaths = (valid as { paths: Array<Record<string, unknown>> }).paths.map(
      (path, index) => ({
        ...path,
        decision_payload_bindings: [
          { decision_id: `decision_teacher_${index}`, decision_payload_digest: "1".repeat(64) }
        ],
        rounds: [{}],
        capital_actions: []
      })
    );
    expect(validate({ ...(valid as Record<string, unknown>), paths: teacherPaths })).toBe(false);
    expect(JSON.stringify(valid)).not.toContain("raw_counterfactual_state:");
    expect(JSON.stringify(valid)).toContain('"officiality":"OFFICIAL"');
    expect(JSON.stringify(valid)).toContain('"official_decision_writes":false');
  });

  it("keeps the shared response paths discriminated by visibility", () => {
    const valid = readJson("contracts/fixtures/m4-multipath-counterfactual-transfer.valid.json") as
      M4MultipathCounterfactualResponse;

    if (valid.visibility === "teacher_safe") {
      expect(valid.paths.every((path) => Array.isArray(path.capital_actions))).toBe(true);
    } else {
      expect(valid.paths.every((path) => !Object.hasOwn(path, "capital_actions"))).toBe(true);
    }
  });
});
