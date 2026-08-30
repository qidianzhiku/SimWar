import { describe, expect, it } from "vitest";
import {
  buildM26SourceBoundOperatingCapitalWorldPack,
  validateM26SourceBoundOperatingCapitalWorldPack
} from "@simwar/sh-next-support";

describe("Shanghai M26 source-bound operating and capital world", () => {
  it("binds operating assets and diagnostics to the M25 evidence epoch", () => {
    const pack = buildM26SourceBoundOperatingCapitalWorldPack();

    expect(pack.state_transition).toEqual({ from: "STATE_A", to: "STATE_B" });
    expect(pack.state_b).toBe("SOURCE_BOUND_OPERATING_CAPITAL_WORLD_COMPILED");
    expect(pack.evidence_epoch_ref.epoch_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(pack.assets.length).toBeGreaterThanOrEqual(3);
    expect(pack.assets.every((asset) => asset.source_reality_class === "PUBLIC_SOURCE_BOUND")).toBe(
      true
    );
    expect(pack.mod_can.status).toBe("CANDIDATE_ONLY");
    expect(pack.finance.status).toBe("NOT_COMPUTABLE");
    expect(pack.double_count_guard.pass).toBe(true);
    expect(pack.no_hidden_fallback).toBe(true);
    expect(validateM26SourceBoundOperatingCapitalWorldPack(pack)).toEqual([]);
  });

  it("fails closed for epoch drift, hidden fallback, and finance double counting", () => {
    const pack = buildM26SourceBoundOperatingCapitalWorldPack();
    const tampered = structuredClone(pack);
    tampered.evidence_epoch_ref.epoch_digest = "f".repeat(64);
    expect(validateM26SourceBoundOperatingCapitalWorldPack(tampered)).toEqual(
      expect.arrayContaining(["evidence_epoch_digest_mismatch"])
    );

    const fallback = structuredClone(pack);
    fallback.no_hidden_fallback = false;
    expect(validateM26SourceBoundOperatingCapitalWorldPack(fallback)).toEqual(
      expect.arrayContaining(["hidden_fallback_forbidden"])
    );

    const doubleCount = structuredClone(pack);
    doubleCount.double_count_guard.pass = false;
    expect(validateM26SourceBoundOperatingCapitalWorldPack(doubleCount)).toEqual(
      expect.arrayContaining(["double_count_guard_failed"])
    );
  });

  it("fails closed when a persisted asset, guard key, or corridor reference drifts", () => {
    const pack = buildM26SourceBoundOperatingCapitalWorldPack();

    const changedAsset = structuredClone(pack);
    changedAsset.assets[0].unit = "unsupported-unit";
    expect(validateM26SourceBoundOperatingCapitalWorldPack(changedAsset)).toEqual(
      expect.arrayContaining(["asset_source_feature_mismatch"])
    );

    const changedGuard = structuredClone(pack);
    changedGuard.double_count_guard.source_feature_uses = { "unrelated-feature": 1 };
    expect(validateM26SourceBoundOperatingCapitalWorldPack(changedGuard)).toEqual(
      expect.arrayContaining(["feature_use_keys_mismatch"])
    );

    const changedCorridor = structuredClone(pack);
    changedCorridor.stress_corridors[0].asset_ids = ["missing-asset"];
    expect(validateM26SourceBoundOperatingCapitalWorldPack(changedCorridor)).toEqual(
      expect.arrayContaining(["corridor_asset_reference_invalid"])
    );
  });

  it("keeps role-safe explanations and formal writers closed", () => {
    const pack = buildM26SourceBoundOperatingCapitalWorldPack();

    expect(pack.role_visibility.student.forbidden_fields).toContain("private_finance_rows");
    expect(pack.recovery.why_not).toContain("PUBLIC_SOURCE_BOUND evidence does not prove audited cash flow");
    expect(pack.authority.official_truth_write).toBe(false);
    expect(pack.authority.settlement_write).toBe(false);
    expect(pack.authority.parameter_set_formal_write).toBe(false);
    expect(pack.authority.provider).toBe("OFF");
  });
});
