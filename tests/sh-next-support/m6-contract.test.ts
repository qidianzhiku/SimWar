import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  buildM6LivingScenarioLifecyclePack,
  validateM6LivingScenarioLifecycle
} from "@simwar/sh-next-support";

describe("M6 living scenario lifecycle JSON contract", () => {
  it("accepts the complete lifecycle pack", () => {
    const schema = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "contracts/schemas/sh-next-living-scenario.v1.json"),
        "utf8"
      )
    ) as object;
    const validate = new Ajv2020({ strict: false }).compile(schema);
    const pack = buildM6LivingScenarioLifecyclePack();

    expect(validate(pack)).toBe(true);
    expect(validate.errors).toBeNull();
    expect(validateM6LivingScenarioLifecycle(pack)).toEqual([]);
  });

  it("rejects null events and implicit-latest rollback state", () => {
    const schema = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "contracts/schemas/sh-next-living-scenario.v1.json"),
        "utf8"
      )
    ) as object;
    const validate = new Ajv2020({ strict: false }).compile(schema);
    const malformed = buildM6LivingScenarioLifecyclePack();

    (malformed.events as unknown[])[0] = null;
    expect(validate(malformed)).toBe(false);

    const unsafe = buildM6LivingScenarioLifecyclePack();
    unsafe.historical_resolution.requested_version = "latest";
    expect(validate(unsafe)).toBe(false);

    const activeLatest = buildM6LivingScenarioLifecyclePack();
    activeLatest.rollback_candidate.active_version = "latest";
    expect(validate(activeLatest)).toBe(false);
  });
});
