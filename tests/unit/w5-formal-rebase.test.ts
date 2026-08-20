import { describe, expect, it } from "vitest";
import {
  buildW5AuthorityCensus,
  freezeW5CurrentBaseline,
  reproduceW5ModelBaseline
} from "../../services/api/src/w5-formal-rebase";

const context = {
  mission_lineage_id: "SIMWAR-W5-FORMAL-REBASE-V5.8-20260820T155612Z",
  mission_start_utc: "2026-08-20T15:56:12.000Z",
  head_sha: "a".repeat(40),
  tree_sha: "b".repeat(40),
  timestamp: "2026-08-20T16:01:00.000Z",
  command: "npm run test:w5:formal-rebase",
  environment_fingerprint: "node=22;platform=win32;package-lock=verified"
};

describe("W5 formal rebase evidence", () => {
  it("closes the authority census without UNKNOWN, unowned, or double producers", () => {
    const census = buildW5AuthorityCensus(context);

    expect(census.status).toBe("PASS_WITH_LIMITS");
    expect(census.summary).toEqual({
      double_producer_count: 0,
      unowned_feature_count: 0,
      unknown_count: 0
    });
    expect(census.entries).toHaveLength(12);
    expect(census.entries.find((entry) => entry.family === "BLP_RCNL")?.classification).toBe(
      "MISSING"
    );
    expect(census.entries.find((entry) => entry.family === "SYNTHETIC_WANT")?.classification).toBe(
      "CURRENT"
    );
    expect(census.entries.every((entry) => entry.primary_producer && entry.formal_writer)).toBe(
      true
    );
  });

  it("records fresh golden, differential, replay, fallback, and drift evidence", () => {
    const census = buildW5AuthorityCensus(context);
    const manifest = reproduceW5ModelBaseline(context, census);

    expect(manifest.status).toBe("PASS_WITH_LIMITS");
    expect(manifest.records.map((record) => record.kind)).toEqual([
      "GOLDEN",
      "DIFFERENTIAL",
      "REPLAY",
      "ZERO_SIGNAL_FALLBACK",
      "DRIFT"
    ]);
    expect(
      manifest.records.every((record) => record.mission_lineage_id === context.mission_lineage_id)
    ).toBe(true);
    expect(manifest.records.every((record) => record.timestamp >= context.mission_start_utc)).toBe(
      true
    );
    expect(
      manifest.records.find((record) => record.kind === "REPLAY")?.replay_writes_official_results
    ).toBe(false);
    expect(
      manifest.records.find((record) => record.kind === "ZERO_SIGNAL_FALLBACK")
        ?.fallback_continues_core
    ).toBe(true);
    expect(manifest.drift_labels).toEqual([
      "CODE_DRIFT",
      "DATA_DRIFT",
      "ENVIRONMENT_ANOMALY",
      "MEASUREMENT_MISMATCH",
      "EXPECTED_MODEL_DIFFERENCE"
    ]);
  });

  it("freezes exact identity, truthful unsupported-family limits, and Standard/Advanced parity", () => {
    const census = buildW5AuthorityCensus(context);
    const manifest = reproduceW5ModelBaseline(context, census);
    const baseline = freezeW5CurrentBaseline(context, census, manifest);

    expect(baseline.status).toBe("PASS_WITH_LIMITS");
    expect(baseline.identity).toEqual({
      model_version: "eldercare_w5_governed_v1@1.0.0",
      parameter_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      scenario: "r7a-shanghai-eldercare-core-scenario-v2",
      seed: 20260726
    });
    expect(baseline.synthetic_want.status).toBe("SYNTHETIC_HEURISTIC");
    expect(baseline.system_dynamics.status).toBe("SHADOW_ONLY");
    expect(baseline.shanghai.provenance).toBe("SYNTHETIC_ASSUMPTION_NOT_CALIBRATED");
    expect(baseline.standard_advanced_parity).toBe(true);
    expect(baseline.model_families.BLP_RCNL.classification).toBe("MISSING");
    expect(baseline.model_families.IDEAL_POINT_LANCASTER.classification).toBe("DEFERRED");
  });
});
