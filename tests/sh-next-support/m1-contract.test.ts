import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { buildM1ExecutiveSeason } from "@simwar/sh-next-support";

describe("M1 JSON contract", () => {
  it("accepts the deterministic M1 pack under the repository schema", () => {
    const schema = JSON.parse(
      readFileSync(resolve(process.cwd(), "contracts/schemas/sh-next-support-m1.v1.json"), "utf8")
    ) as object;
    const validate = new Ajv2020({ strict: false }).compile(schema);

    expect(validate(buildM1ExecutiveSeason())).toBe(true);
    expect(validate.errors).toBeNull();
  });
});
