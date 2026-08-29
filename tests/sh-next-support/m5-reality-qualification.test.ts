import { describe, expect, it } from "vitest";
import {
  buildM5RealityQualificationPack,
  classifyM5Qualification,
  validateM5RealityQualification,
  type M5QualificationGateInput
} from "@simwar/sh-next-support";

describe("M5 reality qualification and holdout observatory", () => {
  it("builds a conflict-preserving qualification pipeline with a safe NOT_ELIGIBLE outcome", () => {
    const pack = buildM5RealityQualificationPack();

    expect(validateM5RealityQualification(pack)).toEqual([]);
    expect(pack.overall_status).toBe("NOT_ELIGIBLE");
    expect(pack.eligibility.every((item) => item.status === "NOT_ELIGIBLE")).toBe(true);
    expect(pack.conflict_ledger).toHaveLength(1);
    expect(pack.conflict_ledger[0].resolution).toBe("PRESERVED_FOR_REVIEW");
    expect(pack.conflict_ledger[0].averaged_away).toBe(false);
    expect(pack.authority.provider).toBe("OFF");
    expect(pack.authority.official_truth_write).toBe(false);
    expect(pack.authority.parameter_set_formal_write).toBe(false);
  });

  it("mechanically distinguishes READY, LIMITED, and NOT_ELIGIBLE scopes", () => {
    const ready: M5QualificationGateInput = {
      source_retrieved: false,
      rights_status: "PUBLIC_SAFE",
      conflict_count: 0,
      required_domains: 0,
      computed_domains: 0,
      holdout_leakage_count: 0,
      replay_only: true
    };
    const limited: M5QualificationGateInput = {
      ...ready,
      source_retrieved: true,
      conflict_count: 1,
      required_domains: 6,
      computed_domains: 2,
      replay_only: false
    };
    const notEligible: M5QualificationGateInput = {
      ...ready,
      replay_only: false,
      source_retrieved: false
    };

    expect(classifyM5Qualification(ready)).toBe("READY");
    expect(classifyM5Qualification(limited)).toBe("LIMITED");
    expect(classifyM5Qualification(notEligible)).toBe("NOT_ELIGIBLE");
    expect(classifyM5Qualification({ ...ready, holdout_leakage_count: 1 })).toBe("NOT_ELIGIBLE");
  });

  it("proves zero holdout leakage and refuses to calculate unsupported RGI values", () => {
    const pack = buildM5RealityQualificationPack();

    expect(pack.holdout.leakage_count).toBe(0);
    expect(pack.holdout.leakage_ids).toEqual([]);
    expect(pack.holdout.leakage_proof).toBe("EXACT_SOURCE_AND_PERIOD_PARTITION_NO_OVERLAP");
    expect(pack.rgi.every((item) => item.computable === false && item.value === null)).toBe(true);
    expect(pack.rgi.every((item) => item.status === "NOT_COMPUTABLE")).toBe(true);
  });

  it("creates fixed-seed Golden/Replay evidence without overwriting formal truth", () => {
    const pack = buildM5RealityQualificationPack();
    const golden = pack.golden_replay;

    expect(golden.fixed_seed).toBe(2026082905);
    expect(golden.replay_status).toBe("READY_FOR_REPLAY_ONLY");
    expect(golden.formal_result_overwritten).toBe(false);
    expect(golden.settlement_write).toBe(false);
    expect(golden.truth_hash_exclusion).toContain("qualification_candidate");
    expect(/^[a-f0-9]{64}$/.test(golden.digest)).toBe(true);
  });

  it("records source, feature, range, model, and scenario drift for M6", () => {
    const pack = buildM5RealityQualificationPack();
    expect(pack.drift_ledger.map((item) => item.drift_kind)).toEqual([
      "SOURCE",
      "FEATURE",
      "RANGE",
      "MODEL",
      "SCENARIO"
    ]);
    expect(pack.drift_ledger.every((item) => item.status === "NO_CURRENT_EVIDENCE")).toBe(true);
    expect(
      pack.drift_ledger.every((item) => item.next_action === "M6_LIFECYCLE_REQUALIFICATION")
    ).toBe(true);
  });
});
