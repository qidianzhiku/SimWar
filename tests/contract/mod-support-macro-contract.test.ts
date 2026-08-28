import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  MOD_MACRO_KEYS,
  compileModMacro,
  createDefaultModMacroRequest,
  type ModMacroKey
} from "../../packages/mod-support/src/index";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;

describe("MOD support macro contract", () => {
  it("accepts the canonical fixture and rejects formal-writer drift", () => {
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(
      readJson("contracts/schemas/mod-support-macro.v1.json")
    );
    const valid = readJson("contracts/fixtures/mod-support-macro.valid.json");
    const invalid = structuredClone(valid) as {
      authority: { official_truth_write: boolean };
    };
    invalid.authority.official_truth_write = true;

    expect(validate(valid), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(invalid)).toBe(false);
  });

  it("validates generated outputs for all six macro keys and preserves threshold counts", () => {
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(
      readJson("contracts/schemas/mod-support-macro.v1.json")
    );

    for (const macroKey of [...MOD_MACRO_KEYS] as ModMacroKey[]) {
      const result = compileModMacro(
        createDefaultModMacroRequest(macroKey, { fresh_need_proof: true })
      );

      expect(validate(result), `${macroKey}: ${JSON.stringify(validate.errors)}`).toBe(true);
      expect(result.mjp.fixture_count).toBeGreaterThanOrEqual(result.mjp.minimum_fixture_count);
      expect(result.exact_binding.refs.every((ref) => ref.version !== "latest")).toBe(true);
    }
  });
});
