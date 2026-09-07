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
  IndustryModelRealityJoinSupportEvidenceDto,
  CoursePackageVersion,
  QualifiedRunAdmissionSnapshot
} from "@simwar/shared-contracts";
import { adaptIndustryModelRealityJoinLineage } from "./industry-model-reality-join-lineage.js";
import { resolveIndustryModelRealityJoinApplicability } from "./industry-model-reality-join-applicability.js";

export type IndustryModelRealityJoinSupportApplicabilityInput =
  IndustryModelRealityJoinContextDto & {
    readonly qualification_id: string;
    readonly course_package_version?: CoursePackageVersion | null;
    readonly qualified_run_admission_snapshot?: QualifiedRunAdmissionSnapshot | null;
    readonly expected_applicability_digest?: string;
  };

export interface IndustryModelRealityJoinSupportComposition {
  readonly applicability_status: "BOUND" | "UNAVAILABLE" | "REBASE_REQUIRED";
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
  if (
    requestContext.course_package_version !== undefined &&
    requestContext.qualified_run_admission_snapshot !== undefined
  ) {
    try {
      const lineage = adaptIndustryModelRealityJoinLineage({
        as_of: new Date().toISOString(),
        course_package_version: requestContext.course_package_version!,
        qualified_run_admission_snapshot: requestContext.qualified_run_admission_snapshot
      });
      const applicability = resolveIndustryModelRealityJoinApplicability({
        exact_context: requestContext,
        lineage,
        ...(requestContext.expected_applicability_digest === undefined
          ? {}
          : { expected_applicability_digest: requestContext.expected_applicability_digest })
      });
      return {
        applicability_status: applicability.status,
        support_evidence: applicability.support_evidence,
        support_evidence_digest: applicability.support_evidence_digest,
        source_refs: applicability.source_refs,
        upstream_pack_digests,
        known_limits: applicability.known_limits,
        writer_effect: "NONE",
        official_truth_write: false
      };
    } catch {
      // A missing, stale, or conflicting lineage is deliberately fail-closed.
      // Keep the established UNAVAILABLE contract rather than leaking a raw
      // adapter error to the role projection.
    }
  }
  const support_evidence: IndustryModelRealityJoinSupportEvidenceDto = {
    availability: "UNAVAILABLE",
    reason: "EXACT_SUPPORT_APPLICABILITY_NOT_PROVEN",
    request_context_digest: stableDigest(requestContext),
    upstream_pack_digests
  };
  return {
    applicability_status: "UNAVAILABLE",
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
