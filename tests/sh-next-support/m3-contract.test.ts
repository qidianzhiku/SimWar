import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { buildM3OperatingStressWorld } from "@simwar/sh-next-support";

describe("M3 operating stress JSON contract", () => {
  it("accepts the complete candidate pack and keeps governance flags closed", () => {
    const schema = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "contracts/schemas/sh-next-operating-stress.v1.json"),
        "utf8"
      )
    ) as object;
    const validate = new Ajv2020({ strict: false }).compile(schema);
    const pack = buildM3OperatingStressWorld();

    expect(validate(pack)).toBe(true);
    expect(validate.errors).toBeNull();
    expect(pack.authority.provider).toBe("OFF");
    expect(pack.authority.official_truth_write).toBe(false);
    expect(pack.consumer.classification).toBe("C1");
  });

  it("rejects null entries instead of treating array lengths as a valid contract", () => {
    const schema = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "contracts/schemas/sh-next-operating-stress.v1.json"),
        "utf8"
      )
    ) as object;
    const validate = new Ajv2020({ strict: false }).compile(schema);
    const malformed = buildM3OperatingStressWorld();

    (malformed.sources as unknown[]).fill(null);
    (malformed.observations as unknown[]).fill(null);
    expect(validate(malformed)).toBe(false);
  });
});
