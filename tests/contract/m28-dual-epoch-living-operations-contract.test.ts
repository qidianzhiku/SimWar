import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { validateM28DualEpochLivingOperationsPack } from "@simwar/sh-next-support";

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
  return ajv.compile(readJson("contracts/schemas/sh-dual-epoch-living-operations.v1.json"));
}

describe("M28 dual-epoch living operations contract", () => {
  it("accepts the canonical fixture in both AJV and the support validator", () => {
    const valid = readJson("contracts/fixtures/sh-dual-epoch-living-operations.valid.json");
    const validate = createValidator();
    expect(validate(valid)).toBe(true);
    expect(validateM28DualEpochLivingOperationsPack(valid as never)).toEqual([]);
  });

  it("rejects extra operations, implicit selectors, and withdrawal-as-delete", () => {
    const valid = readJson("contracts/fixtures/sh-dual-epoch-living-operations.valid.json") as {
      operation_log: unknown[];
      rollback_candidate: { rollback_version: string };
      withdrawal: { withdrawal_is_delete: boolean };
    };
    const invalid = readJson("contracts/fixtures/sh-dual-epoch-living-operations.invalid.json");
    const validate = createValidator();
    expect(validate(invalid)).toBe(false);

    const tooMany = structuredClone(valid);
    tooMany.operation_log.push(structuredClone(valid.operation_log[0]));
    expect(validate(tooMany)).toBe(false);

    const selector = structuredClone(valid);
    selector.rollback_candidate.rollback_version = "latest";
    expect(validate(selector)).toBe(false);

    const deleteDrift = structuredClone(valid);
    deleteDrift.withdrawal.withdrawal_is_delete = true;
    expect(validate(deleteDrift)).toBe(false);
  });
});
