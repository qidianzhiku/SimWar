import { describe, expect, it } from "vitest";
import { stableDigest } from "../../packages/sh-next-support/src/index";
import { composeIndustryModelRealityJoinSupport } from "../../services/api/src/industry-model-reality-join-evidence";

describe("IM-O2 evidence composition cell", () => {
  it("preserves M4, M5, and M29 evidence boundaries", () => {
    const result = composeIndustryModelRealityJoinSupport();
    expect(result.support_evidence.portability.status).toBe("PORTABILITY_EVIDENCE_WITH_LIMITS");
    expect(result.support_evidence.portability.external_validity).toBe("NOT_PROVEN");
    expect(result.support_evidence.holdout.status).toBe("NOT_ELIGIBLE");
    expect(result.support_evidence.holdout.eligibility).toBe("NOT_ELIGIBLE");
    expect(result.support_evidence.shanghai.consumption_status).toBe("LOOKAHEAD_READY");
    expect(result.support_evidence.shanghai.formal_binding_eligible).toBe(false);
    expect(result.support_evidence_digest).toBe(stableDigest(result.support_evidence));
  });

  it("is a read-only evidence producer with explicit source lineage", () => {
    const result = composeIndustryModelRealityJoinSupport();
    expect(result.writer_effect).toBe("NONE");
    expect(result.official_truth_write).toBe(false);
    expect(result.source_refs).toEqual(
      expect.arrayContaining([
        "packages/sh-next-support/src/m4-portability.ts",
        "packages/sh-next-support/src/m5-reality-qualification.ts",
        "packages/sh-next-support/src/m29-main-pull-consumption.ts"
      ])
    );
  });
});
