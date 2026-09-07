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

interface ComposedSupportEvidence {
  readonly portability: {
    readonly status: "PORTABILITY_EVIDENCE_WITH_LIMITS";
    readonly compatibility_status: "COMPATIBLE" | "NON_BREAKING" | "BREAKING";
    readonly external_validity: "NOT_PROVEN";
    readonly package_identity: string;
  };
  readonly holdout: {
    readonly status: "NOT_ELIGIBLE";
    readonly leakage_count: number;
    readonly eligibility: "NOT_ELIGIBLE";
  };
  readonly shanghai: {
    readonly consumption_status: "LOOKAHEAD_READY";
    readonly qualification_status: "LIMITED";
    readonly calibration_evidence: "NOT_PROVEN";
    readonly formal_binding_eligible: false;
  };
}

export interface IndustryModelRealityJoinSupportComposition {
  readonly support_evidence: ComposedSupportEvidence;
  readonly support_evidence_digest: string;
  readonly source_refs: readonly string[];
  readonly known_limits: readonly string[];
  readonly writer_effect: "NONE";
  readonly official_truth_write: false;
}

function assertValid(label: string, issues: readonly string[]): void {
  if (issues.length > 0) throw new Error(`IM_O2_${label}_SUPPORT_INVALID:${issues.join(",")}`);
}

export function composeIndustryModelRealityJoinSupport(): IndustryModelRealityJoinSupportComposition {
  const m4 = buildM4PortabilityCompatibilityPack();
  const m5 = buildM5RealityQualificationPack();
  const m29 = buildM29MainPullConsumptionPack();
  assertValid("M4", validateM4PortabilityCompatibility(m4));
  assertValid("M5", validateM5RealityQualification(m5));
  assertValid("M29", validateM29MainPullConsumptionPack(m29));
  const m4Package = m4.compiled_packages.find((item) => item.package_role === "SECOND_CITY");
  if (!m4Package) throw new Error("IM_O2_M4_SECOND_CITY_PACKAGE_NOT_FOUND");

  const support_evidence: ComposedSupportEvidence = {
    portability: {
      status: "PORTABILITY_EVIDENCE_WITH_LIMITS",
      compatibility_status: m4.compatibility_report.overall_status,
      external_validity: "NOT_PROVEN",
      package_identity: m4Package.package_id
    },
    holdout: {
      status: "NOT_ELIGIBLE",
      leakage_count: m5.holdout.leakage_count,
      eligibility: "NOT_ELIGIBLE"
    },
    shanghai: {
      consumption_status: m29.regional_consumption.consumption_status,
      qualification_status: m29.regional_consumption.qualification_status,
      calibration_evidence: m29.regional_consumption.calibration_evidence,
      formal_binding_eligible: m29.regional_consumption.formal_binding_eligible
    }
  };
  return {
    support_evidence,
    support_evidence_digest: stableDigest(support_evidence),
    source_refs: [
      "packages/sh-next-support/src/m4-portability.ts",
      "packages/sh-next-support/src/m5-reality-qualification.ts",
      "packages/sh-next-support/src/m29-main-pull-consumption.ts"
    ],
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
