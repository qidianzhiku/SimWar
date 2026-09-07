import {
  buildM29MainPullConsumptionPack,
  validateM29MainPullConsumptionPack
} from "@simwar/sh-next-support";
import {
  buildM4PortabilityCompatibilityPack,
  validateM4PortabilityCompatibility
} from "@simwar/sh-next-support";
import {
  buildM5RealityQualificationPack,
  validateM5RealityQualification
} from "@simwar/sh-next-support";
import { stableDigest } from "@simwar/sh-next-support";
import type {
  IndustryModelRealityJoinContextDto,
  IndustryModelRealityJoinSupportEvidenceDto
} from "@simwar/shared-contracts";

export type IndustryModelRealityJoinSupportApplicabilityInput = IndustryModelRealityJoinContextDto & {
  readonly qualification_id: string;
};

export interface IndustryModelRealityJoinSupportComposition {
  readonly support_evidence: IndustryModelRealityJoinSupportEvidenceDto;
  readonly support_evidence_digest: string;
  readonly source_refs: readonly string[];
  readonly upstream_pack_digests: {
    readonly m4: string;
    readonly m5: string;
    readonly m29: string;
  };
  readonly known_limits: readonly string[];
  readonly writer_effect: "NONE";
  readonly official_truth_write: false;
}

function assertValid(label: string, issues: readonly string[]): void {
  if (issues.length > 0) throw new Error(`IM_O2_${label}_SUPPORT_INVALID:${issues.join(",")}`);
}

export function composeIndustryModelRealityJoinSupport(
  requestContext: IndustryModelRealityJoinSupportApplicabilityInput
): IndustryModelRealityJoinSupportComposition {
  const m4 = buildM4PortabilityCompatibilityPack();
  const m5 = buildM5RealityQualificationPack();
  const m29 = buildM29MainPullConsumptionPack();
  assertValid("M4", validateM4PortabilityCompatibility(m4));
  assertValid("M5", validateM5RealityQualification(m5));
  assertValid("M29", validateM29MainPullConsumptionPack(m29));
  const m4Package = m4.compiled_packages.find((item) => item.package_role === "SECOND_CITY");
  if (!m4Package) throw new Error("IM_O2_M4_SECOND_CITY_PACKAGE_NOT_FOUND");

  const upstream_pack_digests = {
    m4: m4.pack_digest,
    m5: m5.pack_digest,
    m29: m29.pack_digest
  } as const;
  const source_refs = [
    "packages/sh-next-support/src/m4-portability.ts",
    "packages/sh-next-support/src/m5-reality-qualification.ts",
    "packages/sh-next-support/src/m29-main-pull-consumption.ts"
  ] as const;
  const support_evidence: IndustryModelRealityJoinSupportEvidenceDto = {
    availability: "UNAVAILABLE",
    reason: "EXACT_SUPPORT_APPLICABILITY_NOT_PROVEN",
    request_context_digest: stableDigest(requestContext),
    upstream_pack_digests
  };
  return {
    support_evidence,
    support_evidence_digest: stableDigest({
      support_evidence,
      source_refs,
      upstream_pack_digests
    }),
    source_refs,
    upstream_pack_digests,
    known_limits: [
      "M4 portability compatibility is not external validity.",
      "M5 holdout and qualification remain NOT_ELIGIBLE.",
      "M29 Shanghai consumption remains LOOKAHEAD_READY with LIMITED qualification.",
      "M29 calibration evidence is NOT_PROVEN and formal binding is not eligible.",
      "Support evidence is reference-only and does not write official REALIZED."
    ],
    writer_effect: "NONE",
    official_truth_write: false
  };
}
