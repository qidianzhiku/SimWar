import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const schema = JSON.parse(
  readFileSync(resolve(process.cwd(), "contracts/schemas/evidence-provenance.v1.json"), "utf8")
);
const valid = JSON.parse(
  readFileSync(resolve(process.cwd(), "contracts/fixtures/evidence-provenance.valid.json"), "utf8")
);

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addFormat("date-time", { type: "string", validate: (value) => !Number.isNaN(Date.parse(value)) });
  return ajv.compile(schema);
}

describe("D2 JSON Schema contract", () => {
  it("compiles with stock strict Ajv and accepts the valid receipt", () => {
    const validate = validator();
    expect(validate(valid)).toBe(true);
  });

  it("rejects reserved exact identities with case changes", () => {
    const validate = validator();
    const candidate = structuredClone(valid);
    candidate.data.artifact.artifact_ref.resource_id = "LATEST";
    expect(validate(candidate)).toBe(false);
  });

  it("rejects wildcard and unresolved exact versions", () => {
    const validate = validator();
    const wildcard = structuredClone(valid);
    wildcard.data.artifact.course_package_ref.version = "1.0.X";
    expect(validate(wildcard)).toBe(false);
    const unresolved = structuredClone(valid);
    unresolved.data.artifact.rubric_ref.version = "unresolved";
    expect(validate(unresolved)).toBe(false);
  });
});
