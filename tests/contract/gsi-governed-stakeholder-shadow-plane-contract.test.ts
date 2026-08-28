import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { isGSIReceipt, isGSIRequest } from "@simwar/shared-contracts";

const schema = JSON.parse(
  readFileSync(resolve("contracts/schemas/gsi-governed-stakeholder-shadow-plane.v1.json"), "utf8")
);
const valid = JSON.parse(
  readFileSync("contracts/fixtures/gsi-governed-stakeholder-shadow-plane.valid.json", "utf8")
);

describe("GSI governed stakeholder shadow plane contract", () => {
  it("accepts the bounded Provider-OFF request and receipt fixture", () => {
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(schema);
    expect(validate(valid), JSON.stringify(validate.errors)).toBe(true);
    expect(isGSIRequest(valid.request)).toBe(true);
    expect(isGSIReceipt(valid.receipt)).toBe(true);
    expect(valid.receipt.provider).toBe("OFF");
    expect(valid.receipt.formal_truth_write).toBe(false);
    expect(valid.receipt.writes_official_truth).toBe(false);
  });

  it("rejects implicit versions, unbounded proposals, and protected truth fields", () => {
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(schema);
    const implicitLatest = structuredClone(valid);
    implicitLatest.request.binding.model_version = "latest";
    expect(validate(implicitLatest)).toBe(false);

    const tooManyProposals = structuredClone(valid);
    tooManyProposals.request.proposals = Array.from({ length: 6 }, (_, index) => ({
      ...valid.request.proposals[0],
      proposal_id: `proposal_${index + 1}`
    }));
    expect(validate(tooManyProposals)).toBe(false);

    const protectedField = structuredClone(valid);
    protectedField.receipt.teacher_projection.state_true = {};
    expect(validate(protectedField)).toBe(false);
  });

  it("keeps the public object contract closed", () => {
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(schema);
    const extra = structuredClone(valid);
    extra.request.unexpected = true;
    expect(validate(extra)).toBe(false);
    expect(isGSIRequest(extra.request)).toBe(false);
  });
});
