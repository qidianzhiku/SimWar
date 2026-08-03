import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8"));
}

describe("D1 learning design contract", () => {
  it("accepts the valid fixture and rejects the closed-object negative fixture", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    ajv.addFormat("date-time", {
      type: "string",
      validate: (value: string) => !Number.isNaN(Date.parse(value))
    });
    const validate = ajv.compile(readJson("contracts/schemas/learning-design.v1.json"));
    expect(validate(readJson("contracts/fixtures/learning-design.valid.json"))).toBe(true);
    expect(validate(readJson("contracts/fixtures/learning-design.invalid.json"))).toBe(false);
  });

  it("rejects forbidden score fields and indirect references", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    ajv.addFormat("date-time", {
      type: "string",
      validate: (value: string) => !Number.isNaN(Date.parse(value))
    });
    const validate = ajv.compile(readJson("contracts/schemas/learning-design.v1.json"));
    const valid = readJson("contracts/fixtures/learning-design.valid.json") as {
      learning_goals: Array<Record<string, unknown>>;
    };
    const withScore = structuredClone(valid);
    withScore.learning_goals[0].business_score_weight = 0.5;
    expect(validate(withScore)).toBe(false);
    const withLatest = structuredClone(valid);
    const goal = withLatest.learning_goals[0];
    const coursePackage = goal.course_package_reference as Record<string, unknown>;
    coursePackage.course_package_id = "latest";
    expect(validate(withLatest)).toBe(false);
  });
});
