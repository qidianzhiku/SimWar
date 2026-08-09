import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { isW020AdvisoryReceipt } from "@simwar/shared-contracts";

describe("W020 governed AI advisory contract", () => {
  it("validates the closed receipt fixture and rejects raw prompt/truth writes", () => {
    const schema = JSON.parse(readFileSync(resolve("contracts/schemas/w020-governed-ai-advisory.v1.json"), "utf8"));
    const valid = JSON.parse(readFileSync(resolve("contracts/fixtures/w020-governed-ai-advisory.valid.json"), "utf8"));
    const invalid = JSON.parse(readFileSync(resolve("contracts/fixtures/w020-governed-ai-advisory.invalid.json"), "utf8"));
    const ajv = new Ajv2020({ strict: true, validateFormats: false });
    const validate = ajv.compile(schema);
    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
    expect(isW020AdvisoryReceipt(valid)).toBe(true);
    expect(JSON.stringify(valid)).not.toContain("state_true");
    expect(JSON.stringify(valid)).not.toContain("SettlementResult");
  });
});
