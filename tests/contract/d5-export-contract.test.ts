import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  isLearningExportBundleVersion,
  isXapiStatement
} from "@simwar/shared-contracts";

const readJson = (path: string) => JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));
const schema = readJson("contracts/schemas/d5-export.v1.json");
const valid = readJson("contracts/fixtures/d5-export.valid.json");
const invalid = readJson("contracts/fixtures/d5-export.invalid.json");

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addFormat("date-time", { type: "string", validate: (value) => !Number.isNaN(Date.parse(value)) });
  return ajv.compile(schema);
}

describe("D5 export contract", () => {
  it("accepts an immutable teacher/admin-safe bundle in Schema and TypeScript", () => {
    expect(validator()(valid)).toBe(true);
    expect(isLearningExportBundleVersion(valid)).toBe(true);
    expect(isXapiStatement(valid.statement_batch.statements[0])).toBe(true);
  });

  it("rejects empty source/report batches and arbitrary private payload", () => {
    expect(validator()(invalid)).toBe(false);
    expect(isLearningExportBundleVersion(invalid)).toBe(false);
  });

  it("keeps xAPI identifiers explicit and does not accept malformed nested objects", () => {
    const statement = structuredClone(valid.statement_batch.statements[0]);
    statement.verb.id = "latest";
    expect(isXapiStatement(statement)).toBe(false);
    const malformed = { ...valid.statement_batch.statements[0], actor: null };
    expect(isXapiStatement(malformed)).toBe(false);
  });
});
