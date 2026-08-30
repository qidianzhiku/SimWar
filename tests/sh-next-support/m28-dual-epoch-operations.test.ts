import { describe, expect, it } from "vitest";
import {
  buildM28DualEpochLivingOperationsPack,
  evaluateM28EvidenceFreshness,
  projectM28ForRole,
  resolveM28HistoricalEpoch,
  stableDigest,
  validateM28DualEpochLivingOperationsPack,
  withdrawM28Candidate
} from "@simwar/sh-next-support";

describe("Shanghai M28 dual-epoch living scenario operations", () => {
  it("compiles the full deterministic State A to State B operation chain", () => {
    const pack = buildM28DualEpochLivingOperationsPack();
    expect(pack.state_transition).toEqual({ from: "STATE_A", to: "STATE_B" });
    expect(pack.state_b).toBe("DUAL_EPOCH_LIVING_SCENARIO_OPERATIONS_EXECUTED_CANDIDATE");
    expect(pack.epoch_a.epoch_id).not.toBe(pack.epoch_b.epoch_id);
    expect(pack.epoch_a.content_digest).not.toBe(pack.epoch_b.content_digest);
    expect(pack.operation_log.map((item) => item.operation)).toEqual([
      "REFRESH",
      "DIFF",
      "IMPACT",
      "REQUALIFICATION",
      "ROLLBACK_CANDIDATE",
      "HISTORICAL_RESOLUTION",
      "WITHDRAW"
    ]);
    expect(validateM28DualEpochLivingOperationsPack(pack)).toEqual([]);
  });

  it("fails closed for implicit selectors, digest drift, and unsafe lifecycle changes", () => {
    const pack = buildM28DualEpochLivingOperationsPack();

    const selectorDrift = structuredClone(pack);
    selectorDrift.epoch_b.version = "latest";
    expect(validateM28DualEpochLivingOperationsPack(selectorDrift)).toEqual(
      expect.arrayContaining(["floating_epoch_selector"])
    );

    const rollbackSelectorDrift = structuredClone(pack);
    rollbackSelectorDrift.rollback_candidate.rollback_version = "DEFAULT";
    expect(validateM28DualEpochLivingOperationsPack(rollbackSelectorDrift)).toEqual(
      expect.arrayContaining(["floating_selector_present", "rollback_binding_invalid"])
    );

    const semanticRefDrift = structuredClone(pack);
    semanticRefDrift.operation_log[1].output_refs = ["DIFF:UNRELATED"];
    semanticRefDrift.operation_log[1].operation_digest = stableDigest(
      Object.fromEntries(
        Object.entries(semanticRefDrift.operation_log[1]).filter(([key]) => key !== "operation_digest")
      )
    );
    const semanticRefContent = Object.fromEntries(
      Object.entries(semanticRefDrift).filter(([key]) => key !== "pack_digest")
    );
    semanticRefDrift.pack_digest = stableDigest(semanticRefContent);
    expect(validateM28DualEpochLivingOperationsPack(semanticRefDrift)).toEqual(
      expect.arrayContaining(["operation_2_binding_invalid", "operation_2_cross_record_binding_invalid"])
    );

    const digestDrift = structuredClone(pack);
    digestDrift.operation_log[2].rule = "untrusted mutation";
    expect(validateM28DualEpochLivingOperationsPack(digestDrift)).toEqual(
      expect.arrayContaining(["pack_digest_mismatch", "operation_3_digest_invalid"])
    );

    const unsafeWithdrawal = structuredClone(pack);
    unsafeWithdrawal.withdrawal.withdrawal_is_delete = true;
    unsafeWithdrawal.withdrawal.delete_executed = true;
    expect(validateM28DualEpochLivingOperationsPack(unsafeWithdrawal)).toEqual(
      expect.arrayContaining(["withdrawal_delete_boundary_invalid"])
    );
  });

  it("keeps requalification candidate-only and disables scheduler, database, and truth writers", () => {
    const pack = buildM28DualEpochLivingOperationsPack();
    expect(pack.requalification.status).toBe("LIMITED");
    expect(pack.requalification.calibration_evidence).toBe("NOT_PROVEN");
    expect(pack.historical_resolution.history_deleted).toBe(false);
    expect(pack.withdrawal.withdrawal_is_delete).toBe(false);
    expect(pack.operational_controls.scheduler_present).toBe(false);
    expect(pack.operational_controls.database_writer_present).toBe(false);
    expect(pack.authority.official_truth_write).toBe(false);
    expect(pack.authority.settlement_write).toBe(false);
    expect(pack.authority.second_truth_writer).toBe(false);
    expect(pack.authority.provider).toBe("OFF");
  });

  it("executes read-only exact resolution and withdrawal without deleting frozen history", () => {
    const pack = buildM28DualEpochLivingOperationsPack();
    const epochABytes = JSON.stringify(pack.epoch_a);
    const resolved = resolveM28HistoricalEpoch(pack, {
      epoch_id: pack.epoch_a.epoch_id,
      version: pack.epoch_a.version,
      content_digest: pack.epoch_a.content_digest
    });
    const withdrawn = withdrawM28Candidate(pack, {
      epoch_id: pack.epoch_b.epoch_id,
      content_digest: pack.epoch_b.content_digest
    });
    expect(resolved.history_deleted).toBe(false);
    expect(resolved.resolution_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(withdrawn.withdrawal_is_delete).toBe(false);
    expect(withdrawn.delete_executed).toBe(false);
    expect(JSON.stringify(pack.epoch_a)).toBe(epochABytes);
    expect(withdrawM28Candidate(pack, {
      epoch_id: pack.epoch_b.epoch_id,
      content_digest: pack.epoch_b.content_digest
    })).toEqual(withdrawn);
    expect(evaluateM28EvidenceFreshness(pack, "2026-08-29")).toBe("VALID_BEFORE_EXPIRY");
    expect(evaluateM28EvidenceFreshness(pack, "2026-11-30")).toBe("EXPIRY_REQUIRES_RECOMPILE");
    expect(evaluateM28EvidenceFreshness(pack, "2026-12-01")).toBe("EXPIRY_REQUIRES_RECOMPILE");
  });

  it("returns role-safe projections without exposing source or official truth to students", () => {
    const pack = buildM28DualEpochLivingOperationsPack();
    const student = projectM28ForRole(pack, "student");
    const enterprise = projectM28ForRole(pack, "enterprise");
    expect(student).toEqual({
      role: "student",
      epoch_version: pack.epoch_b.version,
      requalification_status: "LIMITED",
      withdrawal_status: "CANDIDATE_WITHDRAWN",
      historical_resolution_status: "HISTORICAL_EPOCH_RESOLVED"
    });
    expect(JSON.stringify(student)).not.toContain("source_receipt_ids");
    expect(JSON.stringify(student)).not.toContain("official_truth");
    expect(enterprise).toEqual(expect.objectContaining({ role: "enterprise", candidate_scope: "CANDIDATE_ONLY" }));
  });
});
