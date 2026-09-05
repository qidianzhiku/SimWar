import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  assertCourseBoundQualificationResult,
  compileCourseBoundModelQualification,
  createDefaultCourseBoundQualificationInput
} from "../../packages/mod-support/src/course-bound-model-qualification";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;

describe("course-bound model qualification contract", () => {
  it("accepts the canonical result fixture and rejects authority/reference drift", () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      readJson("contracts/schemas/course-bound-model-qualification.v1.json")
    );
    const valid = readJson("contracts/fixtures/course-bound-model-qualification.valid.json");
    const invalid = readJson("contracts/fixtures/course-bound-model-qualification.invalid.json");

    expect(validate(valid), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(invalid)).toBe(false);

    const authorityDrift = structuredClone(valid) as {
      authority: { official_truth_write: boolean };
    };
    authorityDrift.authority.official_truth_write = true;
    expect(validate(authorityDrift)).toBe(false);

    const referenceDrift = structuredClone(valid) as {
      exact_binding: { refs: { model_version: { version: string } } };
    };
    referenceDrift.exact_binding.refs.model_version.version = "latest";
    expect(validate(referenceDrift)).toBe(false);

    const expectedTypes = {
      course_package: "course_package",
      scenario_package: "scenario_package",
      parameter_set: "parameter_set",
      model_version: "model_version",
      source_evidence: "source_evidence"
    } as const;
    for (const [slot, expectedType] of Object.entries(expectedTypes)) {
      const resourceTypeDrift = structuredClone(valid) as {
        exact_binding: { refs: Record<string, { resource_type: string }> };
      };
      resourceTypeDrift.exact_binding.refs[slot].resource_type =
        expectedType === "course_package" ? "scenario_package" : "course_package";
      expect(validate(resourceTypeDrift)).toBe(false);
    }
  });

  it("validates generated output and keeps machine semantics consistent", () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      readJson("contracts/schemas/course-bound-model-qualification.v1.json")
    );
    const result = compileCourseBoundModelQualification(
      createDefaultCourseBoundQualificationInput()
    );

    expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
    expect(result).toEqual(
      readJson("contracts/fixtures/course-bound-model-qualification.valid.json")
    );
    expect(result.status).toBe(result.join_request.requested_status);
    expect(result.mjp.fixture_count).toBe(result.mjp.fixtures.length);
    expect(result.mjp.fixture_ids).toEqual(
      result.mjp.fixtures.map((fixture) => fixture.fixture_id)
    );
    expect(result.authority.provider).toBe("OFF");
    expect(result.authority.formal_writer).toBe("NONE");
    expect(() => assertCourseBoundQualificationResult(result)).not.toThrow();
  });
});
