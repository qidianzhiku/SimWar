import { describe, expect, it } from "vitest";
import {
  buildM2CapitalSequencingWorld,
  validateM2CapitalSequencingWorld
} from "@simwar/sh-next-support";

describe("M2 Shanghai multi-region capital sequencing world", () => {
  it("contains five city regions with provenance-complete accessibility metrics", () => {
    const pack = buildM2CapitalSequencingWorld();

    expect(pack.state_transition).toEqual({ from: "STATE_A", to: "STATE_B" });
    expect(pack.city_regions).toHaveLength(5);
    expect(pack.city_regions.map((region) => region.city_id)).toEqual([
      "shanghai",
      "suzhou",
      "hangzhou",
      "ningbo",
      "jiaxing"
    ]);
    for (const region of pack.city_regions) {
      expect(region.accessibility.crs).toBe("EPSG:4326");
      expect(region.accessibility.method).toBe("DETERMINISTIC_BOUNDED_CATCHMENT_FALLBACK");
      expect(region.accessibility.unit).toBe("minutes");
      expect(region.accessibility.period).toBe("2024");
      expect(region.source_ids.length).toBeGreaterThan(0);
      expect(region.licensing).toBe("PUBLIC_REFERENCE_ONLY");
    }
  });

  it("records optional spatial tool availability without pretending those tools ran", () => {
    const pack = buildM2CapitalSequencingWorld();

    expect(pack.spatial_tooling).toEqual({
      duckdb_spatial: "TOOL_NOT_RUN",
      h3: "TOOL_NOT_RUN",
      osmnx: "TOOL_NOT_RUN",
      fallback: "USED"
    });
    expect(pack.spatial_tooling.h3).not.toBe("USED_AS_EXACT_GEOMETRY");
  });

  it("builds constrained project slots and nonofficial sequencing candidates", () => {
    const pack = buildM2CapitalSequencingWorld();

    expect(pack.project_slots.length).toBeGreaterThanOrEqual(5);
    expect(pack.scenarios).toHaveLength(3);
    for (const project of pack.project_slots) {
      expect(project.capex_unit).toBe("CNY_MILLION");
      expect(project.duration_unit).toBe("months");
      expect(project.workforce_unit).toBe("FTE");
      expect(project.status).toBe("CANDIDATE");
      expect(project.official_decision).toBe(false);
    }
    expect(pack.optimizer.candidates.length).toBe(3);
    expect(pack.optimizer.candidates.map((candidate) => candidate.variant)).toEqual([
      "CONSERVATIVE",
      "BALANCED",
      "AGGRESSIVE"
    ]);
    expect(
      pack.optimizer.candidates.every((candidate) => candidate.official_decision === false)
    ).toBe(true);
    expect(
      pack.optimizer.candidates.every((candidate) => /^[a-f0-9]{64}$/.test(candidate.digest))
    ).toBe(true);
  });

  it("provides fixed-seed golden variants consumable by ESL and RT without Shanghai kernel constants", () => {
    const pack = buildM2CapitalSequencingWorld();

    expect(pack.golden_variants).toHaveLength(3);
    expect(pack.golden_variants.map((variant) => variant.consumer_ids)).toEqual([
      ["MAIN-ESL-O1-EXECUTIVE-STRATEGY-LAB", "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION"],
      ["MAIN-ESL-O1-EXECUTIVE-STRATEGY-LAB", "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION"],
      ["MAIN-ESL-O1-EXECUTIVE-STRATEGY-LAB", "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION"]
    ]);
    expect(pack.schema_portability.supports_second_city_stub).toBe(true);
    expect(pack.schema_portability.shanghai_constants_in_kernel).toBe(false);
    expect(pack.mjp.status).toBe("PASS");
    expect(validateM2CapitalSequencingWorld(pack)).toEqual([]);
  });

  it("preserves a source conflict instead of silently averaging evidence", () => {
    const pack = buildM2CapitalSequencingWorld();

    expect(pack.conflict_ledger).toHaveLength(1);
    expect(pack.conflict_ledger[0]?.resolution).toBe("PRESERVED_FOR_REVIEW");
    expect(pack.known_limits.some((limit) => limit.includes("not official"))).toBe(true);
  });
});
