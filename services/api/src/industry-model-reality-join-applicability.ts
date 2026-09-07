import {
  buildM29MainPullConsumptionPack,
  buildM4PortabilityCompatibilityPack,
  buildM5RealityQualificationPack,
  stableDigest,
  validateM29MainPullConsumptionPack,
  validateM4PortabilityCompatibility,
  validateM5RealityQualification
} from "@simwar/sh-next-support";
import type {
  IndustryModelRealityJoinContextDto,
  IndustryModelRealityJoinSupportEvidenceDto
} from "@simwar/shared-contracts";

/** Shared cell-interface shape; C1 does not import or depend on C2 implementation. */
export interface IndustryModelRealityJoinLineageFacts {
  readonly admission_receipt: {
    readonly tenant_id: string;
    readonly course_id: string;
    readonly qualification_id: string;
    readonly scenario_package_reference: { readonly scenario_package_id: string };
    readonly parameter_set_reference: { readonly parameter_set_id: string };
  };
  readonly course_package_reference: unknown;
  readonly run_identity: {
    readonly course_id: string;
    readonly run_id: string;
    readonly tenant_id: string;
  };
  readonly evidence_epoch: { readonly tenant_id: string; readonly course_id: string };
  readonly source_evidence_reference: {
    readonly evidence_digest: string;
  };
}

export interface IndustryModelRealityJoinApplicabilityInput {
  readonly exact_context: IndustryModelRealityJoinContextDto & { readonly qualification_id: string };
  readonly lineage: IndustryModelRealityJoinLineageFacts | null | undefined;
  readonly expected_applicability_digest?: string;
}

export interface IndustryModelRealityJoinApplicability {
  readonly status: "BOUND" | "UNAVAILABLE" | "REBASE_REQUIRED";
  readonly reason: string;
  readonly applicability_digest: string;
  readonly support_evidence: IndustryModelRealityJoinSupportEvidenceDto;
  readonly support_evidence_digest: string;
  readonly source_refs: readonly string[];
  readonly known_limits: readonly string[];
  readonly writer_effect: "NONE";
  readonly official_truth_write: false;
}

const KNOWN_LIMITS = [
  "M4 portability compatibility is not external validity.",
  "M5 holdout and qualification remain NOT_ELIGIBLE.",
  "M29 Shanghai consumption remains LOOKAHEAD_READY with LIMITED qualification.",
  "M29 calibration evidence is NOT_PROVEN and formal binding is not eligible.",
  "Support evidence is reference-only and does not write official REALIZED."
] as const;

function unavailable(
  request: IndustryModelRealityJoinApplicabilityInput["exact_context"],
  reason = "EXACT_SUPPORT_APPLICABILITY_NOT_PROVEN"
): IndustryModelRealityJoinApplicability {
  const m4 = buildM4PortabilityCompatibilityPack();
  const m5 = buildM5RealityQualificationPack();
  const m29 = buildM29MainPullConsumptionPack();
  const upstream_pack_digests = { m4: m4.pack_digest, m5: m5.pack_digest, m29: m29.pack_digest };
  const support_evidence: IndustryModelRealityJoinSupportEvidenceDto = {
    availability: "UNAVAILABLE",
    reason: "EXACT_SUPPORT_APPLICABILITY_NOT_PROVEN",
    request_context_digest: stableDigest(request),
    upstream_pack_digests
  };
  const source_refs = [
    "services/api/src/industry-model-reality-join-lineage.ts",
    "services/api/src/industry-model-reality-join-applicability.ts",
    "packages/sh-next-support/src/m30-main-pull-consumption.ts"
  ] as const;
  return {
    status: reason === "EXACT_SUPPORT_IDENTITY_MOVED_REQUIRES_REBASE" ? "REBASE_REQUIRED" : "UNAVAILABLE",
    reason,
    applicability_digest: stableDigest({ request, reason, upstream_pack_digests }),
    support_evidence,
    support_evidence_digest: stableDigest({ support_evidence, source_refs }),
    source_refs,
    known_limits: KNOWN_LIMITS,
    writer_effect: "NONE",
    official_truth_write: false
  };
}

function exactContextMatches(
  request: IndustryModelRealityJoinApplicabilityInput["exact_context"],
  lineage: IndustryModelRealityJoinLineageFacts
): boolean {
  const admission = lineage.admission_receipt;
  return (
    request.tenant_id === lineage.run_identity.tenant_id &&
    request.course_id === lineage.run_identity.course_id &&
    request.run_id === lineage.run_identity.run_id &&
    request.scenario_package_id === admission.scenario_package_reference.scenario_package_id &&
    request.parameter_set_id === admission.parameter_set_reference.parameter_set_id &&
    request.qualification_id === admission.qualification_id &&
    request.tenant_id === admission.tenant_id &&
    request.course_id === admission.course_id &&
    lineage.evidence_epoch.tenant_id === request.tenant_id &&
    lineage.evidence_epoch.course_id === request.course_id
  );
}

export function resolveIndustryModelRealityJoinApplicability(
  input: IndustryModelRealityJoinApplicabilityInput
): IndustryModelRealityJoinApplicability {
  if (!input.lineage) return unavailable(input.exact_context);
  if (!exactContextMatches(input.exact_context, input.lineage)) {
    return unavailable(input.exact_context, "EXACT_SUPPORT_IDENTITY_MOVED_REQUIRES_REBASE");
  }
  const m4 = buildM4PortabilityCompatibilityPack();
  const m5 = buildM5RealityQualificationPack();
  const m29 = buildM29MainPullConsumptionPack();
  const issues = [
    ...validateM4PortabilityCompatibility(m4),
    ...validateM5RealityQualification(m5),
    ...validateM29MainPullConsumptionPack(m29)
  ];
  if (issues.length > 0) return unavailable(input.exact_context, "UPSTREAM_SUPPORT_INVALID");
  const m4Package = m4.compiled_packages.find((item) => item.package_role === "SECOND_CITY");
  if (!m4Package) return unavailable(input.exact_context, "M4_SECOND_CITY_PACKAGE_NOT_FOUND");
  const upstream_pack_digests = { m4: m4.pack_digest, m5: m5.pack_digest, m29: m29.pack_digest };
  const support_evidence: IndustryModelRealityJoinSupportEvidenceDto = {
    availability: "BOUND",
    applicability_digest: stableDigest({
      exact_context: input.exact_context,
      package_reference: input.lineage.course_package_reference,
      admission_snapshot: input.lineage.admission_receipt,
      evidence_epoch: input.lineage.evidence_epoch,
      m30_evidence_digest: input.lineage.source_evidence_reference.evidence_digest,
      upstream_pack_digests
    }),
    upstream_pack_digests,
    portability: {
      status: "PORTABILITY_EVIDENCE_WITH_LIMITS",
      compatibility_status: m4.compatibility_report.overall_status === "BREAKING" ? "BREAKING" : "COMPATIBLE",
      external_validity: "NOT_PROVEN",
      package_identity: m4Package.package_id
    },
    holdout: {
      status: "NOT_ELIGIBLE",
      leakage_count: m5.holdout.leakage_count,
      eligibility: "NOT_ELIGIBLE"
    },
    shanghai: {
      consumption_status: "LOOKAHEAD_READY",
      qualification_status: "LIMITED",
      calibration_evidence: "NOT_PROVEN",
      formal_binding_eligible: false
    }
  };
  const source_refs = [
    "services/api/src/industry-model-reality-join-lineage.ts",
    "services/api/src/industry-model-reality-join-applicability.ts",
    "packages/sh-next-support/src/m4-portability.ts",
    "packages/sh-next-support/src/m5-reality-qualification.ts",
    "packages/sh-next-support/src/m30-main-pull-consumption.ts"
  ] as const;
  const applicability_digest = support_evidence.applicability_digest;
  if (
    input.expected_applicability_digest !== undefined &&
    input.expected_applicability_digest !== applicability_digest
  ) {
    return unavailable(input.exact_context, "EXACT_SUPPORT_IDENTITY_MOVED_REQUIRES_REBASE");
  }
  return {
    status: "BOUND",
    reason: "EXACT_SUPPORT_APPLICABILITY_PROVEN",
    applicability_digest,
    support_evidence,
    support_evidence_digest: stableDigest({ support_evidence, source_refs }),
    source_refs,
    known_limits: KNOWN_LIMITS,
    writer_effect: "NONE",
    official_truth_write: false
  };
}
