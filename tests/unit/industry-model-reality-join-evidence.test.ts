import { describe, expect, it } from "vitest";
import { stableDigest } from "../../packages/sh-next-support/src/index";
import { composeIndustryModelRealityJoinSupport } from "../../services/api/src/industry-model-reality-join-evidence";

const exactRequestContext = {
  tenant_id: "tenant_demo",
  course_id: "course_demo",
  run_id: "run-im-o2",
  team_id: "team-im-o2",
  round_id: "round-im-o2",
  scenario_package_id: "scenario-im-o2",
  parameter_set_id: "parameter-im-o2",
  qualification_id: "qualification-im-o2"
} as const;

describe("IM-O2 evidence composition cell", () => {
  it("does not attach global support packs without an exact applicability proof", () => {
    const result = composeIndustryModelRealityJoinSupport(exactRequestContext);
    expect(result.support_evidence.availability).toBe("UNAVAILABLE");
    expect(result.support_evidence.reason).toBe("EXACT_SUPPORT_APPLICABILITY_NOT_PROVEN");
    expect(result.support_evidence).not.toHaveProperty("portability");
    expect(result.support_evidence).not.toHaveProperty("holdout");
    expect(result.support_evidence).not.toHaveProperty("shanghai");
    expect(result.support_evidence_digest).toBe(
      stableDigest({
        support_evidence: result.support_evidence,
        source_refs: result.source_refs,
        upstream_pack_digests: result.upstream_pack_digests
      })
    );
  });

  it("binds the digest to exact request context and upstream pack identities", () => {
    const result = composeIndustryModelRealityJoinSupport(exactRequestContext);
    const moved = composeIndustryModelRealityJoinSupport({
      ...exactRequestContext,
      scenario_package_id: "different-scenario"
    });
    expect(result.support_evidence.request_context_digest).not.toBe(
      moved.support_evidence.request_context_digest
    );
    expect(result.support_evidence_digest).not.toBe(moved.support_evidence_digest);
    expect(result.upstream_pack_digests.m4).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.upstream_pack_digests.m5).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.upstream_pack_digests.m29).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("is a read-only evidence producer with explicit source lineage", () => {
    const result = composeIndustryModelRealityJoinSupport(exactRequestContext);
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
