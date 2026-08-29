import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  buildM5RealityQualificationPack,
  validateM5RealityQualification
} from "@simwar/sh-next-support";

describe("M5 reality qualification JSON contract", () => {
  it("accepts the complete qualification pack", () => {
    const schema = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "contracts/schemas/sh-next-reality-qualification.v1.json"),
        "utf8"
      )
    ) as object;
    const validate = new Ajv2020({ strict: false }).compile(schema);
    const pack = buildM5RealityQualificationPack();

    expect(validate(pack)).toBe(true);
    expect(validate.errors).toBeNull();
    expect(validateM5RealityQualification(pack)).toEqual([]);
    expect(pack.consumer.classification).toBe("C1");
    expect(pack.main_handoff.status).toBe("JOIN_WITH_LIMITS");
  });

  it("rejects null nested qualification records and fake calibrated output", () => {
    const schema = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "contracts/schemas/sh-next-reality-qualification.v1.json"),
        "utf8"
      )
    ) as object;
    const validate = new Ajv2020({ strict: false }).compile(schema);
    const malformed = buildM5RealityQualificationPack();

    (malformed.eligibility as unknown[])[0] = null;
    expect(validate(malformed)).toBe(false);

    const fakeCalibration = buildM5RealityQualificationPack();
    fakeCalibration.eligibility[0].eligible_for_calibration = true;
    expect(validateM5RealityQualification(fakeCalibration)).toContain(
      "m5_calibration_eligibility_claim_invalid"
    );
  });
});
