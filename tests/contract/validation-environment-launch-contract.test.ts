import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { isValidationEnvironmentLaunch } from "@simwar/shared-contracts";

describe("W025 ValidationEnvironmentLaunch contract", () => {
  it("keeps the durable launch lifecycle closed and fail-closed", () => {
    const root = resolve(process.cwd());
    const schema = JSON.parse(
      readFileSync(resolve(root, "contracts/schemas/validation-environment-launch.v1.json"), "utf8")
    );
    const valid = JSON.parse(
      readFileSync(
        resolve(root, "contracts/fixtures/validation-environment-launch.valid.json"),
        "utf8"
      )
    );
    const invalid = JSON.parse(
      readFileSync(
        resolve(root, "contracts/fixtures/validation-environment-launch.invalid.json"),
        "utf8"
      )
    );
    const validate = new Ajv2020({ allErrors: true, strict: true, validateFormats: false }).compile(
      schema
    );

    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
    expect(isValidationEnvironmentLaunch(valid)).toBe(true);
    expect(isValidationEnvironmentLaunch(invalid)).toBe(false);
    expect(JSON.stringify(valid)).not.toContain("state_true");
    expect(JSON.stringify(valid)).not.toContain("HUMAN_VALIDATION_COMPLETED");
  });
});
