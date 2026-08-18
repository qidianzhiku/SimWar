import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;

describe("W027 decision experience contract", () => {
  it("accepts the five-role COO-merged fixture and rejects standalone Quality & Risk/private projection", () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      readJson("contracts/schemas/w027-decision-experience.v1.json")
    );
    expect(validate(readJson("contracts/fixtures/w027-decision-experience.valid.json"))).toBe(true);
    expect(validate(readJson("contracts/fixtures/w027-decision-experience.invalid.json"))).toBe(
      false
    );
  });
});
