import { describe, expect, it } from "vitest";

import { validateProgramEventLedger } from "../../scripts/program-event-ledger-validator.mjs";

const requiredFields = [
  "cycle_id",
  "macro_id",
  "lane",
  "source_epoch",
  "prepared_at",
  "delivered_at",
  "acknowledged_at",
  "decided_at",
  "consumed_at",
  "integration_requested_at",
  "integration_started_at",
  "integration_completed_at",
  "main_wait_reason",
  "rebase_count",
  "requalification_count",
  "review_repair_count",
  "focused_validation_count",
  "heavy_validation_count",
  "fresh_reality_rebuild_count",
  "consumer_id",
  "consumer_status",
  "shared_seam",
  "hot_files",
  "final_disposition",
  "evidence_status",
  "evidence_refs"
] as const;

function completeCycle(cycleId: string) {
  const cycle = Object.fromEntries(requiredFields.map((field) => [field, null]));
  return {
    ...cycle,
    cycle_id: cycleId,
    macro_id: `macro-${cycleId}`,
    lane: "MAIN",
    source_epoch: "91569bd7396899589acbca324bc68d8ece660366",
    prepared_at: "2026-09-01T00:00:00Z",
    delivered_at: "2026-09-01T01:00:00Z",
    decided_at: "2026-09-01T02:00:00Z",
    consumed_at: "2026-09-01T03:00:00Z",
    integration_requested_at: "2026-09-01T03:10:00Z",
    integration_completed_at: "2026-09-01T04:00:00Z",
    final_disposition: "CONSUMED",
    evidence_status: "COMPLETE_CURRENT_EPOCH",
    evidence_refs: ["tests/unit/program-event-ledger-validator.test.ts"]
  };
}

describe("program event ledger validator", () => {
  it("accepts six complete cycles while preserving unknown fields as null", () => {
    const ledger = {
      schema_version: "1.0.0",
      required_complete_cycles: 6,
      cycles: Array.from({ length: 6 }, (_, index) => completeCycle(`cycle-${index + 1}`))
    };

    expect(validateProgramEventLedger(ledger)).toEqual({
      valid: true,
      completeCycles: 6,
      unknownFieldCount: 6 * 13,
      errors: []
    });
  });

  it("rejects an open cycle instead of treating missing closure evidence as zero", () => {
    const ledger = {
      schema_version: "1.0.0",
      required_complete_cycles: 1,
      cycles: [
        {
          ...completeCycle("cycle-open"),
          final_disposition: "OPEN",
          consumed_at: null,
          integration_completed_at: null
        }
      ]
    };

    const result = validateProgramEventLedger(ledger);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("cycle-open");
    expect(result.errors.join("\n")).toContain("complete closure");
  });
});
