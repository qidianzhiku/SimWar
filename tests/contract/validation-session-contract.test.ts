import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { isValidationSessionRecord } from "@simwar/shared-contracts";

describe("W023 ValidationSession contract", () => {
  it("accepts synthetic session records and rejects human mode/private fields", () => {
    const schema = JSON.parse(
      readFileSync(resolve("contracts/schemas/validation-session.v1.json"), "utf8")
    );
    const valid = JSON.parse(
      readFileSync(resolve("contracts/fixtures/validation-session.valid.json"), "utf8")
    );
    const invalid = JSON.parse(
      readFileSync(resolve("contracts/fixtures/validation-session.invalid.json"), "utf8")
    );
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(schema);
    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
    expect(isValidationSessionRecord(valid)).toBe(true);
    expect(JSON.stringify(valid)).not.toContain("state_true");
    expect(JSON.stringify(valid)).not.toContain("HUMAN_VALIDATION_COMPLETED");
  });
});
