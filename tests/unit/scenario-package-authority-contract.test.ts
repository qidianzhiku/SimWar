import { describe, expect, it } from "vitest";
import {
  ScenarioPackageAuthorityError,
  createScenarioPackageReference
} from "../../packages/shared-contracts/src/scenario-package-authority";
import { createScenarioPackageReference as createReferenceFromSharedIndex } from "../../packages/shared-contracts/src/index";

const validInput = {
  content_digest: "a".repeat(64),
  scenario_package_id: "scenario_package_001",
  tenant_id: "tenant_001",
  version: "1.2.0"
};

describe("ScenarioPackage authority shared contract", () => {
  it("creates an exact immutable ScenarioPackage reference", () => {
    const reference = createScenarioPackageReference(validInput);

    expect(reference).toEqual(validInput);
    expect(Object.isFrozen(reference)).toBe(true);
    expect(() => {
      (reference as { version: string }).version = "2.0.0";
    }).toThrow();
  });

  it("rejects blank package and tenant identities", () => {
    for (const field of ["scenario_package_id", "tenant_id"] as const) {
      for (const value of ["", "   "]) {
        expect(() =>
          createScenarioPackageReference({
            ...validInput,
            [field]: value
          })
        ).toThrow(new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_REFERENCE_INVALID"));
      }
    }
  });

  it("rejects blank, floating, wildcard and range versions", () => {
    for (const version of ["", "   ", "latest", "*", "^1.0.0", "~1.0.0"]) {
      expect(() =>
        createScenarioPackageReference({
          ...validInput,
          version
        })
      ).toThrow(new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_REFERENCE_INVALID"));
    }
  });

  it("rejects malformed and uppercase content digests", () => {
    for (const content_digest of ["a".repeat(63), "a".repeat(65), "g".repeat(64), "A".repeat(64)]) {
      expect(() =>
        createScenarioPackageReference({
          ...validInput,
          content_digest
        })
      ).toThrow(new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_REFERENCE_INVALID"));
    }
  });

  it("exports the reference factory from the shared package index", () => {
    expect(createReferenceFromSharedIndex(validInput)).toEqual(validInput);
  });

  it("does not expose runtime, Replay truth, settlement, or embedded ParameterSet content", () => {
    const reference = createScenarioPackageReference(validInput);

    expect(Object.keys(reference).sort()).toEqual([
      "content_digest",
      "scenario_package_id",
      "tenant_id",
      "version"
    ]);
    expect(reference).not.toHaveProperty("runtime");
    expect(reference).not.toHaveProperty("replay_hash");
    expect(reference).not.toHaveProperty("truth_hash");
    expect(reference).not.toHaveProperty("SettlementResult");
    expect(reference).not.toHaveProperty("parameter_values");
  });
});
