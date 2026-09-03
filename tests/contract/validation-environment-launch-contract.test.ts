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

  it("accepts and validates the exact qualified admission receipt", () => {
    const root = resolve(process.cwd());
    const schema = JSON.parse(
      readFileSync(resolve(root, "contracts/schemas/validation-environment-launch.v1.json"), "utf8")
    );
    const valid = JSON.parse(
      readFileSync(
        resolve(root, "contracts/fixtures/validation-environment-launch.valid.json"),
        "utf8"
      )
    ) as Record<string, unknown>;
    const validate = new Ajv2020({ allErrors: true, strict: true, validateFormats: false }).compile(
      schema
    );
    const receipt = {
      calibration_dataset_id: "calibration-1",
      course_id: "w025_course_001",
      course_package_reference: valid.course_package_reference,
      model_artifact_reference: {
        artifact_id: "artifact-1",
        content_digest: "1111111111111111111111111111111111111111111111111111111111111111",
        format: "json",
        source_ref: "source-package-1"
      },
      model_version_reference: {
        content_digest: "2222222222222222222222222222222222222222222222222222222222222222",
        model_version_id: "model-version-1",
        version: "1.0.0"
      },
      official_truth_write: false,
      parameter_set_reference: valid.source_parameter_set &&
        (valid.source_parameter_set as Record<string, unknown>).reference,
      provider: "OFF",
      qualification_content_digest:
        "3333333333333333333333333333333333333333333333333333333333333333",
      qualification_id: "qualification-1",
      scenario_package_reference: valid.source_scenario_package &&
        (valid.source_scenario_package as Record<string, unknown>).reference,
      source_package_id: "source-package-1",
      status: "ADMITTED",
      tenant_id: "tenant-w025",
      writer_effect: "NONE"
    };
    const launch = { ...valid, qualified_run_admission_receipt: receipt };

    expect(validate(launch)).toBe(true);
    expect(isValidationEnvironmentLaunch(launch)).toBe(true);

    const forged = {
      ...launch,
      qualified_run_admission_receipt: { ...receipt, official_truth_write: true }
    };
    expect(validate(forged)).toBe(false);
    expect(isValidationEnvironmentLaunch(forged)).toBe(false);
  });
});
