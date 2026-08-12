import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;

describe("fresh learner admission contract", () => {
  it("accepts the teacher-safe readiness fixture and rejects private fields", () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      readJson("contracts/schemas/fresh-learner-admission.v1.json")
    );
    expect(validate(readJson("contracts/fixtures/fresh-learner-admission.valid.json"))).toBe(true);
    expect(validate(readJson("contracts/fixtures/fresh-learner-admission.invalid.json"))).toBe(
      false
    );
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "additionalProperties",
          params: { additionalProperty: "password_hash" }
        })
      ])
    );
  });
});
