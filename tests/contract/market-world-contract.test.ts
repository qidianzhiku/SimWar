import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createMarketWorldReference,
  MARKET_WORLD_STUDENT_FORBIDDEN_FIELDS,
  type MarketWorldRef
} from "../../packages/shared-contracts/src/market-world";
import {
  getShanghaiMarketWorldReference,
  MARKET_WORLD_PRODUCT_PROJECTION
} from "../../services/api/src/market-world-product";

describe("Market World contract", () => {
  it("requires an exact id, version, and digest without latest aliases", () => {
    const reference = getShanghaiMarketWorldReference();

    expect(reference).toMatchObject({
      market_world_id: "shanghai-eldercare-market-world",
      version: "2026-08-20.m2.1"
    });
    expect(reference.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(createMarketWorldReference(reference)).toEqual(reference);

    for (const alias of ["latest", "current", "default", "1.x"]) {
      expect(() =>
        createMarketWorldReference({
          digest: reference.digest,
          market_world_id: reference.market_world_id,
          version: alias
        })
      ).toThrow("MARKET_WORLD_REFERENCE_INVALID");
    }
  });

  it("keeps the generic schema city-neutral and the Shanghai asset specialized", () => {
    const schema = JSON.parse(
      readFileSync("contracts/schemas/market-world.v1.json", "utf8")
    ) as Record<string, unknown>;
    const referenceProperties = (
      (schema.$defs as Record<string, unknown>).marketWorldRef as Record<string, unknown>
    ).properties as Record<string, unknown>;

    expect(referenceProperties).toHaveProperty("market_world_id");
    expect(referenceProperties).toHaveProperty("version");
    expect(referenceProperties).toHaveProperty("digest");
    expect(JSON.stringify(schema)).not.toContain("shanghai-eldercare-market-world");
    expect(MARKET_WORLD_PRODUCT_PROJECTION.market_world_id).toBe("shanghai-eldercare-market-world");
  });

  it("freezes the student forbidden-field boundary", () => {
    const forbidden = MARKET_WORLD_STUDENT_FORBIDDEN_FIELDS as readonly string[];
    expect(forbidden).toEqual(
      expect.arrayContaining([
        "state_true",
        "raw_source_path",
        "private_coefficient",
        "other_team_data",
        "unpublished_result"
      ])
    );
  });

  it("rejects malformed or cross-shaped references", () => {
    const valid = getShanghaiMarketWorldReference();
    const cases: Array<Partial<MarketWorldRef>> = [
      { ...valid, digest: "wrong" },
      { ...valid, market_world_id: "" },
      { ...valid, version: "2026-08-20" }
    ];

    for (const candidate of cases) {
      expect(() => createMarketWorldReference(candidate as MarketWorldRef)).toThrow(
        "MARKET_WORLD_REFERENCE_INVALID"
      );
    }
  });
});
