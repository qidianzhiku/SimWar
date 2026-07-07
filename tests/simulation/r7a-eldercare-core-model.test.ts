import { describe, expect, it } from "vitest";
import {
  createDefaultEldercareModelInput,
  evaluateEldercareCoreRound,
  projectEldercareLearnerBrief
} from "../../services/simulation-core/src/eldercare-core-model";

const PRIVATE_MARKERS = [
  "state_true",
  "SettlementResult",
  "canonical_evidence_digest",
  "decision_batch_hash",
  "manifest_hash",
  "json_runtime_source_digest",
  "privateReplay",
  "Teacher private metadata",
  "Tenant Admin private metadata"
];

describe("R7-A eldercare core model", () => {
  it("evaluates a deterministic Beijing-Yanjiao eldercare round without formal truth writes", () => {
    const input = createDefaultEldercareModelInput();
    const first = evaluateEldercareCoreRound(input);
    const second = evaluateEldercareCoreRound(input);

    expect(second).toEqual(first);
    expect(first.model_family).toBe("eldercare_core_model_v1");
    expect(first.formal_truth_write).toBe(false);
    expect(first.postgresql_runtime_required).toBe(false);
    expect(first.round_metrics.market.demand_index).toBeGreaterThan(0);
    expect(first.round_metrics.operations.service_capacity).toBeGreaterThan(0);
    expect(first.round_metrics.finance.operating_margin).toBeGreaterThanOrEqual(-1);
    expect(
      first.plugin_trace.every((trace) => trace.evidence_label === "SOURCE_ONLY_INFERENCE")
    ).toBe(true);
    expect(first.plugin_trace.map((trace) => trace.hook)).toEqual([
      "segmentDemand",
      "capacityGuardrail",
      "payerMix",
      "serviceQualityRisk"
    ]);
  });

  it("keeps learner-facing eldercare briefs free of protected truth and private replay fields", () => {
    const result = evaluateEldercareCoreRound(createDefaultEldercareModelInput());
    const learnerBrief = projectEldercareLearnerBrief(result);
    const serialized = JSON.stringify(learnerBrief);

    expect(learnerBrief.visibility).toBe("learner_safe_summary");
    expect(learnerBrief.replay_writes_formal_results).toBe(false);
    for (const marker of PRIVATE_MARKERS) {
      expect(serialized).not.toContain(marker);
    }
  });

  it("classifies unlicensed medical-care expansion as a controlled failure", () => {
    const base = createDefaultEldercareModelInput();
    const result = evaluateEldercareCoreRound({
      ...base,
      decision: {
        ...base.decision,
        license_scope: "community_daycare_only",
        medical_care_expansion: true
      }
    });

    expect(result.controlled_failures).toContainEqual({
      code: "ELDERCARE_LICENSE_SCOPE_DENIED",
      evidence_label: "CONTRACT_BACKED_EVIDENCE",
      message: "medical care expansion requires an authorized eldercare medical license scope"
    });
    expect(JSON.stringify(result)).not.toContain("state_true");
  });
});
