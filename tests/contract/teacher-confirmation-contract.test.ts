import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { isTeacherConfirmationVersion } from "@simwar/shared-contracts";

const schema = JSON.parse(readFileSync(resolve(process.cwd(), "contracts/schemas/teacher-confirmation.v1.json"), "utf8"));
const valid = JSON.parse(readFileSync(resolve(process.cwd(), "contracts/fixtures/teacher-confirmation.valid.json"), "utf8"));
const invalid = JSON.parse(readFileSync(resolve(process.cwd(), "contracts/fixtures/teacher-confirmation.invalid.json"), "utf8"));

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addFormat("date-time", { type: "string", validate: (value) => !Number.isNaN(Date.parse(value)) });
  return ajv.compile(schema);
}

describe("D3 teacher confirmation contract", () => {
  it("accepts the valid fixture in stock strict Ajv and the runtime validator", () => {
    expect(validator()(valid)).toBe(true);
    expect(isTeacherConfirmationVersion(valid)).toBe(true);
  });

  it("rejects reserved, wildcard, unsafe, and empty values", () => {
    expect(validator()(invalid)).toBe(false);
    expect(isTeacherConfirmationVersion(invalid)).toBe(false);
  });
});
