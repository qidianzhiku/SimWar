import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;

describe("W4 Enterprise State contract", () => {
  it("accepts official outcome lineage and rejects historical re-entry/private truth", () => {
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(
      readJson("contracts/schemas/w4-enterprise-state.v1.json")
    );
    const valid = readJson("contracts/fixtures/w4-enterprise-state.valid.json");
    const invalid = readJson("contracts/fixtures/w4-enterprise-state.invalid.json");
    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
    expect(JSON.stringify(valid)).not.toContain("state_true");
    expect(JSON.stringify(valid)).toContain("parent_state_ref");

    const policySeams = (
      valid as {
        policy_seams: Array<{
          kind: string;
          may_write_enterprise_state: boolean;
          may_write_official_outcome: boolean;
        }>;
      }
    ).policy_seams;
    expect(policySeams.map((seam) => seam.kind)).toEqual([
      "merger_acquisition",
      "asset_backed_securitization",
      "initial_public_offering",
      "project_sale",
      "project_closure"
    ]);
    expect(policySeams.every((seam) => !seam.may_write_enterprise_state)).toBe(true);
    expect(policySeams.every((seam) => !seam.may_write_official_outcome)).toBe(true);
  });
});
