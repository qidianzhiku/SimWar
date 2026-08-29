import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("regional-transfer.v1 contract", () => {
  it("declares the exact-reference and role-safe product envelope", () => {
    const schema = JSON.parse(
      readFileSync("contracts/schemas/regional-transfer.v1.json", "utf8")
    ) as {
      required: string[];
      properties: Record<string, { const?: unknown; required?: string[] }>;
    };
    expect(schema.required).toEqual(
      expect.arrayContaining([
        "candidate_ref",
        "scope",
        "baseline",
        "target",
        "formal_references",
        "provenance",
        "qualification",
        "activation",
        "authority",
        "known_limits"
      ])
    );
    expect(schema.properties.schema_version.const).toBe("regional-transfer.v1");
  });
});
