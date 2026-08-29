import { describe, expect, it } from "vitest";
import {
  buildM4PortabilityCompatibilityPack,
  compileM4CityCandidate,
  resolveM4PackageReference,
  selectM4SecondCity,
  validateM4PortabilityCompatibility,
  type M4CitySelectionCandidate
} from "@simwar/sh-next-support";

describe("M4 second-city portability compatibility", () => {
  it("builds a three-package source-to-scenario candidate with one generic compiler", () => {
    const pack = buildM4PortabilityCompatibilityPack();

    expect(validateM4PortabilityCompatibility(pack)).toEqual([]);
    expect(pack.compiled_packages).toHaveLength(3);
    expect(pack.compiled_packages.map((item) => item.package_role)).toEqual([
      "ANCHOR",
      "SECOND_CITY",
      "SYNTHETIC_STUB"
    ]);
    expect(new Set(pack.compiled_packages.map((item) => item.compiler_version))).toEqual(
      new Set(["sh-next-generic-city-compiler.v1"])
    );
    expect(new Set(pack.compiled_packages.map((item) => item.schema_version))).toEqual(
      new Set(["sh-next-portability.v1"])
    );
    expect(pack.compatibility_report.overall_status).toBe("COMPATIBLE");
    expect(pack.mjp.status).toBe("PASS");
  });

  it("selects the highest-coverage public-safe city deterministically without a city special case", () => {
    const candidates: M4CitySelectionCandidate[] = [
      {
        city_id: "city-z",
        display_name: "City Z",
        public_safe: true,
        rights_status: "PUBLIC_SAFE",
        source_coverage: 4,
        temporal_coverage: 2,
        method_coverage: 3
      },
      {
        city_id: "city-a",
        display_name: "City A",
        public_safe: true,
        rights_status: "PUBLIC_SAFE",
        source_coverage: 4,
        temporal_coverage: 2,
        method_coverage: 3
      },
      {
        city_id: "private-city",
        display_name: "Private City",
        public_safe: false,
        rights_status: "INTERNAL_ONLY",
        source_coverage: 99,
        temporal_coverage: 99,
        method_coverage: 99
      }
    ];

    expect(selectM4SecondCity(candidates).city_id).toBe("city-a");
  });

  it("keeps source, observation, transfer, scenario, and compile links auditable", () => {
    const pack = buildM4PortabilityCompatibilityPack();
    const packageIds = new Set(pack.compiled_packages.flatMap((item) => item.source_ids));
    const transferIds = new Set(pack.regional_transfers.map((item) => item.transfer_id));

    expect(pack.sources.length).toBeGreaterThanOrEqual(3);
    expect(pack.observations.every((item) => packageIds.has(item.source_id))).toBe(true);
    expect(pack.regional_transfers.every((item) => item.bounds.min <= item.bounds.max)).toBe(true);
    expect(
      pack.scenario_candidates.every((item) =>
        item.transfer_ids.every((transferId) => transferIds.has(transferId))
      )
    ).toBe(true);
    expect(
      pack.scenario_candidates.every((item) =>
        item.source_ids.every((sourceId) =>
          pack.sources.some((source) => source.source_id === sourceId)
        )
      )
    ).toBe(true);
    expect(pack.provenance_graph.edges.length).toBeGreaterThan(0);
    expect(pack.compiled_packages.every((item) => /^[a-f0-9]{64}$/.test(item.package_digest))).toBe(
      true
    );
    expect(pack.transformations).toHaveLength(9);
    expect(
      pack.transformations.every((transformation) => {
        const observation = pack.observations.find(
          (item) => item.observation_id === transformation.input[0]
        );
        const feature = pack.features.find((item) => item.feature_id === transformation.output);
        return observation?.unit === transformation.unit && feature?.unit === observation?.unit;
      })
    ).toBe(true);
  });

  it("produces non-breaking asset/profile/policy/project diffs and reverse portability proof", () => {
    const pack = buildM4PortabilityCompatibilityPack();

    expect(pack.compatibility_report.dimensions).toEqual(
      expect.objectContaining({
        asset: expect.objectContaining({ status: "NON_BREAKING" }),
        parameter: expect.objectContaining({ status: "NON_BREAKING" }),
        profile: expect.objectContaining({ status: "NON_BREAKING" }),
        policy: expect.objectContaining({ status: "NON_BREAKING" }),
        project: expect.objectContaining({ status: "NON_BREAKING" })
      })
    );
    expect(pack.compatibility_report.breaking_diffs).toEqual([]);
    expect(pack.compatibility_report.migration_candidates.length).toBeGreaterThan(0);
    expect(pack.reverse_portability.replaced_with).toBe("SYNTHETIC_STUB");
    expect(pack.reverse_portability.generic_contract_without_shanghai_enum_or_const).toBe(true);
    expect(pack.reverse_portability.round_trip_status).toBe("PASS");
  });

  it("rejects implicit latest and history deletion instead of silently resolving a package", () => {
    const pack = buildM4PortabilityCompatibilityPack();
    const exact = pack.compiled_packages[0];

    expect(() => resolveM4PackageReference(pack, { package_id: exact.package_id })).toThrow(
      "M4_EXACT_VERSION_REQUIRED"
    );
    expect(() =>
      resolveM4PackageReference(pack, {
        package_id: exact.package_id,
        version: exact.version,
        digest: exact.package_digest,
        history_deleted: true
      })
    ).toThrow("M4_HISTORY_DELETE_REJECTED");
    expect(
      resolveM4PackageReference(pack, {
        package_id: exact.package_id,
        version: exact.version,
        digest: exact.package_digest
      })
    ).toEqual(exact);
  });

  it("rejects a package whose nested content no longer matches its stored digest", () => {
    const pack = buildM4PortabilityCompatibilityPack();
    const exact = pack.compiled_packages[0];
    exact.profile_candidate.values.capacity_index = 0.91;

    expect(() =>
      resolveM4PackageReference(pack, {
        package_id: exact.package_id,
        version: exact.version,
        digest: exact.package_digest
      })
    ).toThrow("M4_PACKAGE_DIGEST_MISMATCH");
  });

  it("rejects expired transfer candidates at the deterministic validation date", () => {
    const pack = buildM4PortabilityCompatibilityPack();
    pack.regional_transfers[0].valid_to = "2025-12-31";

    expect(validateM4PortabilityCompatibility(pack)).toContain(
      "SH-M4-TRANSFER-SHANGHAI-TO-SECOND_CITY:expired_or_invalid"
    );
  });

  it("compiles a city object without Shanghai-specific enums or runtime writes", () => {
    const pack = buildM4PortabilityCompatibilityPack();
    const stub = pack.compiled_packages.find((item) => item.package_role === "SYNTHETIC_STUB");
    expect(stub).toBeDefined();
    expect(stub?.city_id).toBe("synthetic-city-stub");

    const recompiled = compileM4CityCandidate({
      ...stub!,
      package_id: "m4-recompiled-stub-v1",
      package_digest: undefined
    });
    expect(recompiled.schema_version).toBe("sh-next-portability.v1");
    expect(recompiled.formal_runtime_admitted).toBe(false);
    expect(recompiled.official_truth_write).toBe(false);
    expect(recompiled.settlement_write).toBe(false);
    expect(recompiled.parameter_set_formal_write).toBe(false);
  });
});
