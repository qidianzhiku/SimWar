import { describe, expect, it } from "vitest";
import {
  buildM28DualEpochLivingOperationsPack,
  validateM28DualEpochLivingOperationsPack
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
});
