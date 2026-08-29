import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as T;
}

describe("scenario-productization.v1 contract", () => {
  it("accepts the complete M7-M12 candidate envelope", () => {
    const schema = readJson<Record<string, unknown>>(
      "contracts/schemas/shanghai-productization.v1.json"
    );
    const fixture = readJson<Record<string, unknown>>(
      "contracts/fixtures/shanghai-productization.valid.json"
    );
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(schema);
    expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);
  });

  it("rejects formal truth mutation and implicit latest references", () => {
    const schema = readJson<Record<string, unknown>>(
      "contracts/schemas/shanghai-productization.v1.json"
    );
    const fixture = readJson<Record<string, unknown>>(
      "contracts/fixtures/shanghai-productization.valid.json"
    );
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(schema);
    const mutated = structuredClone(fixture);
    (mutated.authority as Record<string, unknown>).truth_mutation_count = 1;
    expect(validate(mutated)).toBe(false);

    const latest = structuredClone(fixture);
    const entries = (latest.catalog as Record<string, unknown>).entries as Array<
      Record<string, unknown>
    >;
    const reference = entries[0]?.scenario_reference as Record<string, unknown>;
    reference.version = "latest";
    expect(validate(latest)).toBe(false);
  });
});
