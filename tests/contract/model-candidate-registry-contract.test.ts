import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

const schema = JSON.parse(
  readFileSync(resolve("contracts/schemas/model-candidate-registry.v1.json"), "utf8")
);
const validFixture = JSON.parse(
  readFileSync(resolve("contracts/fixtures/model-candidate-registry.valid.json"), "utf8")
);
const invalidFixture = JSON.parse(
  readFileSync(resolve("contracts/fixtures/model-candidate-registry.invalid.json"), "utf8")
);

describe("MOD-04 model candidate registry contract", () => {
  it("accepts the official research registry and preserves provider-off boundaries", () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    const validate = ajv.compile(schema);

    expect(validate(validFixture), JSON.stringify(validate.errors)).toBe(true);
    expect(validFixture.authority.provider_calls).toBe(0);
    expect(validFixture.authority.official_truth_writer).toBe(false);
    expect(validFixture.candidates.length).toBeGreaterThanOrEqual(1);
    for (const candidate of validFixture.candidates) {
      expect(candidate.runtime_boundary.activation_status).toBe("NOT_AUTHORIZED");
      expect(candidate.runtime_boundary.provider_calls).toBe(0);
      expect(candidate.runtime_boundary.official_truth_writer).toBe(false);
      expect(candidate.fallback.length).toBeGreaterThan(0);
      expect(candidate.recheck_after).toMatch(/^2026-09-/);
    }
  });

  it("rejects provider activation and official-writer claims", () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    const validate = ajv.compile(schema);

    expect(validate(invalidFixture)).toBe(false);
  });
});
