import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { validateM29MainPullConsumptionPack } from "@simwar/sh-next-support";

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8"));
}

function createValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addFormat("date", {
    type: "string",
    validate: (value: string) =>
      /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  });
  return ajv.compile(readJson("contracts/schemas/sh-main-pull-consumption.v1.json"));
}

describe("M29 MAIN-pull source-backed consumption contract", () => {
  it("accepts the canonical fixture in AJV and the support validator", () => {
    const valid = readJson("contracts/fixtures/sh-main-pull-consumption.valid.json");
    const validate = createValidator();
    expect(validate(valid)).toBe(true);
    expect(validateM29MainPullConsumptionPack(valid as never)).toEqual([]);
  });

  it("rejects route claims, implicit selectors, and extra role fields", () => {
    const valid = readJson("contracts/fixtures/sh-main-pull-consumption.valid.json") as {
      product_proof: { real_route_proof: string };
      source_pack_refs: { m27_transfer: { candidate_version: string } };
      role_journey: { student: Record<string, unknown> };
    };
    const validate = createValidator();
    expect(validate(readJson("contracts/fixtures/sh-main-pull-consumption.invalid.json"))).toBe(
      false
    );

    const routeDrift = structuredClone(valid);
    routeDrift.product_proof.real_route_proof = "PROVEN";
    expect(validate(routeDrift)).toBe(false);

    const selectorDrift = structuredClone(valid);
    selectorDrift.source_pack_refs.m27_transfer.candidate_version = "latest";
    expect(validate(selectorDrift)).toBe(false);

    const roleDrift = structuredClone(valid);
    roleDrift.role_journey.student.official_truth = "leak";
    expect(validate(roleDrift)).toBe(false);
  });
});
