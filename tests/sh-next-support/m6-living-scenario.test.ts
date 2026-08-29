import { describe, expect, it } from "vitest";
import {
  buildM6LivingScenarioLifecyclePack,
  stableDigest,
  validateM6LivingScenarioLifecycle
} from "@simwar/sh-next-support";

describe("M6 living scenario refresh, drift, and rollback lifecycle", () => {
  it("reuses M5 once and completes the refresh-to-rollback candidate chain", () => {
    const pack = buildM6LivingScenarioLifecyclePack();

    expect(validateM6LivingScenarioLifecycle(pack)).toEqual([]);
    expect(pack.state_transition).toEqual({ from: "STATE_A", to: "STATE_B" });
    expect(pack.reuse.upstream_macro).toBe("M5");
    expect(pack.reuse.reuse_count).toBe(1);
    expect(pack.reuse.regenerated).toBe(false);
    expect(pack.reuse.upstream_pack_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(pack.events.map((event) => event.event_type)).toEqual([
      "REFRESH",
      "DIFF",
      "IMPACT",
      "REQUALIFY",
      "ROLLBACK_CANDIDATE",
      "HISTORICAL_RESOLUTION",
      "RETIRE"
    ]);
    expect(pack.requalification.qualification_status).toBe("NOT_ELIGIBLE");
    expect(pack.rollback_candidate.dry_run).toBe(true);
    expect(pack.rollback_candidate.executed).toBe(false);
    expect(pack.rollback_candidate.formal_write).toBe(false);
  });

  it("does not trigger a refresh before the source expiry date", () => {
    const pack = buildM6LivingScenarioLifecyclePack();

    expect(pack.refresh_candidate.trigger).toBe("EXPIRY_NOT_REACHED");
    expect(pack.refresh_candidate.refresh_status).toBe("NO_REFRESH_REQUIRED");
    expect(pack.refresh_candidate.retrieval_status).toBe("NOT_APPLICABLE");
    expect(pack.refresh_candidate.current_as_of < pack.refresh_candidate.prior_expiry).toBe(true);
  });

  it("records the expiry evaluation and source-to-consumer impact without implicit latest", () => {
    const pack = buildM6LivingScenarioLifecyclePack();

    expect(pack.diff.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "expiry", change_kind: "EXPIRY" }),
        expect.objectContaining({ field: "refresh_status", change_kind: "CONTENT" })
      ])
    );
    expect(pack.impact_graph.some((edge) => edge.from.kind === "SOURCE")).toBe(true);
    expect(pack.impact_graph.some((edge) => edge.to.kind === "SCENARIO_CONSUMER")).toBe(true);
    expect(pack.historical_resolution.implicit_latest_forbidden).toBe(true);
    expect(pack.historical_resolution.resolution_status).toBe("EXACT_VERSION_RESOLVED");
    expect(pack.historical_resolution.requested_version).toBe(
      pack.rollback_candidate.rollback_version
    );
    expect(pack.historical_resolution.resolved_version).toBe(
      pack.rollback_candidate.rollback_version
    );
    expect(pack.historical_resolution.history_deletion).toBe(false);
  });

  it("links M1 through M5 digests and keeps all lifecycle writers candidate-only", () => {
    const pack = buildM6LivingScenarioLifecyclePack();

    expect(pack.chain_summary.macro_keys).toEqual(["M1", "M2", "M3", "M4", "M5"]);
    expect(Object.keys(pack.chain_summary.pack_digests)).toEqual(["M1", "M2", "M3", "M4", "M5"]);
    expect(pack.chain_summary.tombstones.every((item) => item.status === "REUSED")).toBe(true);
    expect(pack.authority.provider).toBe("OFF");
    expect(pack.authority.official_truth_write).toBe(false);
    expect(pack.authority.settlement_write).toBe(false);
    expect(pack.authority.parameter_set_formal_write).toBe(false);
    expect(pack.consumer.formal_join).toBe(false);
    expect(pack.consumer.consumer_ready).toBe(false);
  });

  it("rejects a tampered lifecycle digest and a rollback deletion claim", () => {
    const pack = buildM6LivingScenarioLifecyclePack();
    pack.diff.changes[0]!.current = "TAMPERED";
    expect(validateM6LivingScenarioLifecycle(pack)).toContain("m6_diff_digest_mismatch");

    const unsafe = buildM6LivingScenarioLifecyclePack();
    unsafe.rollback_candidate.deletion = true;
    expect(validateM6LivingScenarioLifecycle(unsafe)).toContain("m6_rollback_guard_invalid");
  });

  it("rejects latest active versions and split requalification baselines after re-digesting", () => {
    const latest = buildM6LivingScenarioLifecyclePack();
    latest.rollback_candidate.active_version = "latest";
    const { digest: latestRollbackDigest, ...latestRollbackContent } = latest.rollback_candidate;
    void latestRollbackDigest;
    latest.rollback_candidate.digest = stableDigest(latestRollbackContent);
    const { pack_digest: latestPackDigest, ...latestPackContent } = latest;
    void latestPackDigest;
    latest.pack_digest = stableDigest(latestPackContent);
    expect(validateM6LivingScenarioLifecycle(latest)).toContain("m6_rollback_guard_invalid");

    const split = buildM6LivingScenarioLifecyclePack();
    split.requalification.upstream_m5_pack_digest = "a".repeat(64);
    const { digest: splitQualificationDigest, ...splitQualificationContent } =
      split.requalification;
    void splitQualificationDigest;
    split.requalification.digest = stableDigest(splitQualificationContent);
    const { pack_digest: splitPackDigest, ...splitPackContent } = split;
    void splitPackDigest;
    split.pack_digest = stableDigest(splitPackContent);
    expect(validateM6LivingScenarioLifecycle(split)).toEqual(
      expect.arrayContaining(["m6_requalification_binding_invalid"])
    );

    const digestTampered = buildM6LivingScenarioLifecyclePack();
    digestTampered.requalification.consumer_ready = true;
    expect(validateM6LivingScenarioLifecycle(digestTampered)).toContain(
      "m6_requalification_digest_mismatch"
    );
  });
});
