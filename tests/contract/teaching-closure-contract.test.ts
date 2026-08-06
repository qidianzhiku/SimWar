import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { isTeachingClosureDto, type TeachingClosureDto } from "@simwar/shared-contracts";

const root = resolve(process.cwd());
const schema = JSON.parse(
  readFileSync(resolve(root, "contracts/schemas/teaching-closure.v1.json"), "utf8")
);
const valid = JSON.parse(
  readFileSync(resolve(root, "contracts/fixtures/teaching-closure.valid.json"), "utf8")
);
const invalid = JSON.parse(
  readFileSync(resolve(root, "contracts/fixtures/teaching-closure.invalid.json"), "utf8")
);
const openApi = readFileSync(resolve(root, "contracts/openapi/p0-api.openapi.yaml"), "utf8");

function validate(value: unknown): boolean {
  return new Ajv2020({ allErrors: true, strict: true }).compile(schema)(value) as boolean;
}

describe("W019 unified teaching closure contract", () => {
  it("accepts the exact safe queue fixture in schema and runtime validation", () => {
    expect(validate(valid)).toBe(true);
    expect(isTeachingClosureDto(valid)).toBe(true);
  });

  it("rejects fallback contexts and preserves a closed object", () => {
    expect(validate(invalid)).toBe(false);
    expect(isTeachingClosureDto(invalid)).toBe(false);
    expect(isTeachingClosureDto({ ...(valid as TeachingClosureDto), private_payload: "no" })).toBe(
      false
    );
  });

  it("declares one teacher-only read route", () => {
    expect(openApi).toContain("/api/v1/bff/teacher/teaching-closure:");
    expect(openApi).toContain("TEACHER_W019_TEACHING_CLOSURE_V1");
  });
});
