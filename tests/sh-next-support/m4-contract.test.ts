import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  buildM4PortabilityCompatibilityPack,
  validateM4PortabilityCompatibility
} from "@simwar/sh-next-support";

describe("M4 portability JSON contract", () => {
  it("accepts the complete candidate pack and keeps writer boundaries closed", () => {
    const schema = JSON.parse(
      readFileSync(resolve(process.cwd(), "contracts/schemas/sh-next-portability.v1.json"), "utf8")
    ) as object;
    const validate = new Ajv2020({ strict: false }).compile(schema);
    const pack = buildM4PortabilityCompatibilityPack();

    expect(validate(pack)).toBe(true);
    expect(validate.errors).toBeNull();
    expect(validateM4PortabilityCompatibility(pack)).toEqual([]);
    expect(pack.authority.provider).toBe("OFF");
    expect(pack.authority.official_truth_write).toBe(false);
    expect(pack.authority.settlement_write).toBe(false);
    expect(pack.consumer.classification).toBe("C1");
    expect(
      new Set(
        pack.scenario_candidates.flatMap((item) => item.exact_refs.map((ref) => ref.revision))
      )
    ).toEqual(new Set(["b86150a276e2cfc77fd4714e794a3d33de9d541c"]));
  });

  it("rejects null package entries and invalid digest-shaped package records", () => {
    const schema = JSON.parse(
      readFileSync(resolve(process.cwd(), "contracts/schemas/sh-next-portability.v1.json"), "utf8")
    ) as object;
    const validate = new Ajv2020({ strict: false }).compile(schema);
    const malformed = buildM4PortabilityCompatibilityPack();

    (malformed.compiled_packages as unknown[])[0] = null;
    expect(validate(malformed)).toBe(false);

    const malformedDigest = buildM4PortabilityCompatibilityPack();
    malformedDigest.compiled_packages[0].package_digest = "not-a-sha";
    expect(validate(malformedDigest)).toBe(false);
  });
});
