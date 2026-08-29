import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { buildM2CapitalSequencingWorld } from "@simwar/sh-next-support";

describe("M2 multi-region JSON contract", () => {
  it("accepts the deterministic five-city candidate pack", () => {
    const schema = JSON.parse(
      readFileSync(resolve(process.cwd(), "contracts/schemas/sh-next-multi-region.v1.json"), "utf8")
    ) as object;
    const validate = new Ajv2020({ strict: false }).compile(schema);

    expect(validate(buildM2CapitalSequencingWorld())).toBe(true);
    expect(validate.errors).toBeNull();
  });
});
