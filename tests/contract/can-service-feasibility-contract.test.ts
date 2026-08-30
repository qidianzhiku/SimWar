import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CAN_SERVICE_FEASIBILITY_SCHEMA_VERSION,
  isCanServiceFeasibilityResponse,
  type CanServiceFeasibilityResponse
} from "../../packages/shared-contracts/src/can-service-feasibility";

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as unknown;

describe("R1 CAN service-feasibility contract", () => {
  it("keeps the schema and valid fixture aligned with the no-write response contract", () => {
    const schema = readJson("contracts/schemas/can-service-feasibility.v1.json") as {
      properties?: { schema_version?: { const?: string } };
    };
    const fixture = readJson("contracts/fixtures/can-service-feasibility.valid.json");

    expect(schema.properties?.schema_version?.const).toBe(CAN_SERVICE_FEASIBILITY_SCHEMA_VERSION);
    expect(isCanServiceFeasibilityResponse(fixture)).toBe(true);
    expect((fixture as CanServiceFeasibilityResponse).authority.official_truth_write).toBe(false);
    expect((fixture as CanServiceFeasibilityResponse).authority.settlement_write).toBe(false);
  });

  it("rejects the student-private fixture when it contains admin-only exact inputs", () => {
    expect(
      isCanServiceFeasibilityResponse(
        readJson("contracts/fixtures/can-service-feasibility.student-private.invalid.json")
      )
    ).toBe(false);
  });
});
