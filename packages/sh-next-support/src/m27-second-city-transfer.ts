import { stableDigest } from "./index.js";
import {
  buildM25PublicSourceRealityEvidenceEpochPack,
  validateM25PublicSourceRealityEvidenceEpochPack,
  type M25RegionalTransfer
} from "./m25-public-source-evidence.js";

export const M27_SECOND_CITY_SCHEMA_VERSION = "sh-second-city-transfer-requalification.v1" as const;
export const M27_SOURCE_MASTER_SHA = "0dece5cd9c58d8bafb5231b3047c849aa4861298" as const;
export const M27_MISSION_ID = "SIMWAR-SH-M27-SECOND-CITY-PUBLIC-SOURCE-TRANSFER-REQUALIFICATION" as const;

export type M27QualificationStatus = "READY" | "LIMITED" | "NOT_ELIGIBLE" | "NOT_COMPUTABLE";

export interface M27SecondCityTransferRequalificationPack {
  schema_version: typeof M27_SECOND_CITY_SCHEMA_VERSION;
  mission_id: typeof M27_MISSION_ID;
  state_a: {
    name: "SINGLE_CITY_TRANSFER_WITHOUT_SECOND_CITY_REQUALIFICATION";
    limitation: string;
  };
  state_b: "SECOND_CITY_PUBLIC_SOURCE_TRANSFER_REQUALIFICATION_READY";
  state_transition: { from: "STATE_A"; to: "STATE_B" };
  evidence_epoch_ref: {
    epoch_id: string;
    epoch_digest: string;
    source_epoch_base_sha: typeof M27_SOURCE_MASTER_SHA;
  };
  second_city: {
    city: "Hangzhou";
    source_receipt_ids: string[];
    source_asset_ids: string[];
    public_source_coverage: true;
    source_reality_class: "PUBLIC_SOURCE_BOUND";
    synthetic_only: false;
    rights_status: "PUBLIC_REFERENCE_ONLY";
    expiry: string;
  };
  transfer: {
    schema_version: "regional-transfer.v1";
    transfer_id: string;
    baseline_region: "Shanghai";
    target_region: "Hangzhou";
    source_feature_ids: string[];
    target_feature_ids: string[];
    method: string;
    output: "REQUALIFICATION_REQUIRED";
    rights_status: "PUBLIC_REFERENCE_ONLY";
    valid_from: string;
    valid_to: string;
    approval_status: "CANDIDATE_ONLY";
  };
  compatibility: {
    same_schema_shape: true;
    shared_contract: "regional-transfer.v1";
    exact_binding_required: true;
    differences: Array<{ field: "region" | "package" | "qualification"; from: string; to: string }>;
    compatibility_digest: string;
  };
  qualification: {
    status: M27QualificationStatus;
    source_status: "PUBLIC_SOURCE_BOUND";
    calibration_evidence: "NOT_PROVEN";
    calibration_eligible: false;
    formal_binding_eligible: false;
    reason: string;
    required_rechecks: string[];
  };
  pr475_absorption: {
    pr_number: 475;
    current_state: "OPEN";
    base_sha: string;
    head_sha: string;
    unresolved_review_threads: number;
    absorbed_concepts: string[];
    no_conflicting_writer: true;
    no_auto_cherry_pick: true;
    integration_stage: "LOOKAHEAD_READY";
  };
  role_visibility: {
    teacher: { visibility: "TEACHER_ONLY"; fields: string[] };
    student: { visibility: "STUDENT_SAFE"; fields: string[]; forbidden_fields: string[] };
    admin: { visibility: "INTERNAL_RESEARCH_ONLY"; fields: string[] };
  };
  authority: {
    candidate_writer: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER";
    official_truth_write: false;
    settlement_write: false;
    parameter_set_formal_write: false;
    provider: "OFF";
    second_truth_writer: false;
    runtime_authority: "JSON_INTERNAL_ONLY";
  };
  known_limits: string[];
  pack_digest: string;
}

function compatibilityDigest(input: Omit<M27SecondCityTransferRequalificationPack["compatibility"], "compatibility_digest">): string {
  return stableDigest(input);
}

function requiredTransfer(transfers: M25RegionalTransfer[]): M25RegionalTransfer {
  const transfer = transfers.find((item) => item.target_geography === "Hangzhou");
  if (!transfer) throw new Error("M27_HANGZHOU_TRANSFER_MISSING");
  return transfer;
}

export function buildM27SecondCityTransferRequalificationPack(): M27SecondCityTransferRequalificationPack {
  const m25 = buildM25PublicSourceRealityEvidenceEpochPack();
  const transfer = requiredTransfer(m25.regional_transfers);
  const hangzhouAssets = m25.source_assets.filter((item) => item.geography === "Hangzhou");
  const hangzhouFeatures = m25.features.filter((item) => item.geography === "Hangzhou");
  if (hangzhouAssets.length === 0 || hangzhouFeatures.length === 0)
    throw new Error("M27_PUBLIC_SOURCE_SECOND_CITY_MISSING");

  const differences: M27SecondCityTransferRequalificationPack["compatibility"]["differences"] = [
    { field: "region", from: transfer.baseline_geography, to: transfer.target_geography },
    { field: "package", from: "SHANGHAI_PUBLIC_EVIDENCE_PACKAGE", to: "HANGZHOU_PUBLIC_TARGET_PACKAGE" },
    { field: "qualification", from: "SOURCE_COVERAGE_CANDIDATE", to: "REQUALIFICATION_REQUIRED" }
  ];
  const compatibilityContent = {
    same_schema_shape: true as const,
    shared_contract: "regional-transfer.v1" as const,
    exact_binding_required: true as const,
    differences
  };
  const content: Omit<M27SecondCityTransferRequalificationPack, "pack_digest"> = {
    schema_version: M27_SECOND_CITY_SCHEMA_VERSION,
    mission_id: M27_MISSION_ID,
    state_a: {
      name: "SINGLE_CITY_TRANSFER_WITHOUT_SECOND_CITY_REQUALIFICATION",
      limitation: "The predecessor transfer candidate exposed a public-safe target-city shape but did not prove second-city public-source coverage, rights, expiry, or exact requalification against current source evidence."
    },
    state_b: "SECOND_CITY_PUBLIC_SOURCE_TRANSFER_REQUALIFICATION_READY",
    state_transition: { from: "STATE_A", to: "STATE_B" },
    evidence_epoch_ref: {
      epoch_id: m25.source_epoch.epoch_id,
      epoch_digest: m25.source_epoch.epoch_digest,
      source_epoch_base_sha: M27_SOURCE_MASTER_SHA
    },
    second_city: {
      city: "Hangzhou",
      source_receipt_ids: hangzhouAssets.map((item) => item.source_receipt_id),
      source_asset_ids: hangzhouAssets.map((item) => item.source_id),
      public_source_coverage: true,
      source_reality_class: "PUBLIC_SOURCE_BOUND",
      synthetic_only: false,
      rights_status: "PUBLIC_REFERENCE_ONLY",
      expiry: m25.source_epoch.expires_at
    },
    transfer: {
      schema_version: "regional-transfer.v1",
      transfer_id: transfer.transfer_id,
      baseline_region: transfer.baseline_geography,
      target_region: transfer.target_geography,
      source_feature_ids: [...transfer.source_feature_ids],
      target_feature_ids: [...transfer.target_feature_ids],
      method: transfer.method,
      output: transfer.output,
      rights_status: transfer.rights_status,
      valid_from: transfer.valid_from,
      valid_to: transfer.valid_to,
      approval_status: transfer.approval_status
    },
    compatibility: {
      ...compatibilityContent,
      compatibility_digest: compatibilityDigest(compatibilityContent)
    },
    qualification: {
      status: "LIMITED",
      source_status: "PUBLIC_SOURCE_BOUND",
      calibration_evidence: "NOT_PROVEN",
      calibration_eligible: false,
      formal_binding_eligible: false,
      reason: "Hangzhou has official public-source target evidence, but the evidence is planning-target scope and does not establish calibrated transfer behavior or formal product binding.",
      required_rechecks: [
        "Re-fetch every official receipt before expiry and preserve the exact locator.",
        "Confirm target-year scope, unit, geography, and rights before consumer binding.",
        "Run the shared regional-transfer validator against exact package, ParameterSet, ScenarioPackage, course, round, and run references.",
        "Requalify after any source digest, schema, package, or model reference change."
      ]
    },
    pr475_absorption: {
      pr_number: 475,
      current_state: "OPEN",
      base_sha: "d9c314d2365f48caef8187592c1b16915db4fd38",
      head_sha: "3ace58f5531424f95fcd502ae7f88ff702cd054e",
      unresolved_review_threads: 3,
      absorbed_concepts: [
        "regional-transfer.v1 shared contract",
        "exact package and version binding",
        "teacher/student/admin role-safe projections",
        "compatibility diff, expiry, requalification, and rollback-candidate controls"
      ],
      no_conflicting_writer: true,
      no_auto_cherry_pick: true,
      integration_stage: "LOOKAHEAD_READY"
    },
    role_visibility: {
      teacher: {
        visibility: "TEACHER_ONLY",
        fields: ["second_city", "transfer", "compatibility", "qualification", "pr475_absorption", "known_limits"]
      },
      student: {
        visibility: "STUDENT_SAFE",
        fields: ["target_region", "bounded_qualification_status", "required_rechecks_summary"],
        forbidden_fields: ["source_receipt_ids", "source_digests", "private_project_data", "official_truth", "settlement", "score", "rank"]
      },
      admin: {
        visibility: "INTERNAL_RESEARCH_ONLY",
        fields: ["evidence_epoch_ref", "source_receipt_ids", "compatibility", "pr475_absorption", "required_rechecks"]
      }
    },
    authority: {
      candidate_writer: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER",
      official_truth_write: false,
      settlement_write: false,
      parameter_set_formal_write: false,
      provider: "OFF",
      second_truth_writer: false,
      runtime_authority: "JSON_INTERNAL_ONLY"
    },
    known_limits: [
      "Hangzhou public-source coverage is proven only for labeled planning targets; it is not a calibrated outcome dataset.",
      "The transfer remains candidate-only and REQUALIFICATION_REQUIRED; this pack does not activate or freeze a shared regional-transfer runtime record.",
      "PR #475 is reused by concept and exact contract shape only; its current open review state prevents declaring product integration complete.",
      "No official Truth, Settlement, Score, Rank, ParameterSet, Provider, PostgreSQL/RLS, Pilot, Production, or Human Validation state is written."
    ]
  };
  return { ...content, pack_digest: stableDigest(content) };
}

export function validateM27SecondCityTransferRequalificationPack(
  pack: M27SecondCityTransferRequalificationPack
): string[] {
  const issues: string[] = [];
  const { pack_digest, ...content } = pack;
  if (stableDigest(content) !== pack_digest) issues.push("pack_digest_mismatch");

  const m25 = buildM25PublicSourceRealityEvidenceEpochPack();
  issues.push(...validateM25PublicSourceRealityEvidenceEpochPack(m25).map((issue) => `m25_${issue}`));
  if (pack.evidence_epoch_ref.epoch_digest !== m25.source_epoch.epoch_digest)
    issues.push("evidence_epoch_digest_mismatch");
  if (pack.evidence_epoch_ref.source_epoch_base_sha !== M27_SOURCE_MASTER_SHA)
    issues.push("source_epoch_base_mismatch");

  const expectedTransfer = requiredTransfer(m25.regional_transfers);
  if (pack.transfer.schema_version !== "regional-transfer.v1") issues.push("shared_schema_mismatch");
  if (
    pack.transfer.transfer_id !== expectedTransfer.transfer_id ||
    pack.transfer.baseline_region !== expectedTransfer.baseline_geography ||
    pack.transfer.target_region !== expectedTransfer.target_geography ||
    JSON.stringify(pack.transfer.source_feature_ids) !== JSON.stringify(expectedTransfer.source_feature_ids) ||
    JSON.stringify(pack.transfer.target_feature_ids) !== JSON.stringify(expectedTransfer.target_feature_ids) ||
    pack.transfer.method !== expectedTransfer.method ||
    pack.transfer.output !== expectedTransfer.output
  )
    issues.push("exact_transfer_binding_invalid");
  if (pack.second_city.city !== "Hangzhou" || !pack.second_city.public_source_coverage)
    issues.push("second_city_coverage_invalid");
  if (pack.second_city.source_reality_class !== "PUBLIC_SOURCE_BOUND") issues.push("second_city_source_class_invalid");
  if (pack.second_city.synthetic_only) issues.push("synthetic_only_second_city_forbidden");
  if (pack.second_city.rights_status !== "PUBLIC_REFERENCE_ONLY" || pack.transfer.rights_status !== "PUBLIC_REFERENCE_ONLY")
    issues.push("rights_status_invalid");
  if (pack.transfer.valid_to < m25.source_epoch.expires_at || pack.second_city.expiry < m25.source_epoch.expires_at)
    issues.push("expiry_before_epoch_invalid");

  const expectedDifferences = [
    { field: "region", from: expectedTransfer.baseline_geography, to: expectedTransfer.target_geography },
    { field: "package", from: "SHANGHAI_PUBLIC_EVIDENCE_PACKAGE", to: "HANGZHOU_PUBLIC_TARGET_PACKAGE" },
    { field: "qualification", from: "SOURCE_COVERAGE_CANDIDATE", to: "REQUALIFICATION_REQUIRED" }
  ];
  const compatibilityContent = {
    same_schema_shape: true as const,
    shared_contract: "regional-transfer.v1" as const,
    exact_binding_required: true as const,
    differences: pack.compatibility.differences
  };
  if (
    !pack.compatibility.same_schema_shape ||
    pack.compatibility.shared_contract !== "regional-transfer.v1" ||
    !pack.compatibility.exact_binding_required ||
    JSON.stringify(pack.compatibility.differences) !== JSON.stringify(expectedDifferences) ||
    compatibilityDigest(compatibilityContent) !== pack.compatibility.compatibility_digest
  )
    issues.push("compatibility_diff_invalid");

  if (
    pack.qualification.source_status !== "PUBLIC_SOURCE_BOUND" ||
    pack.qualification.calibration_evidence !== "NOT_PROVEN" ||
    pack.qualification.calibration_eligible ||
    pack.qualification.formal_binding_eligible
  )
    issues.push(
      (pack.qualification.calibration_evidence as string) === "MODEL_CALIBRATED"
        ? "calibration_claim_forbidden"
        : "qualification_boundary_invalid"
    );
  if (!(["READY", "LIMITED", "NOT_ELIGIBLE", "NOT_COMPUTABLE"] as string[]).includes(pack.qualification.status))
    issues.push("qualification_status_invalid");

  if (
    pack.pr475_absorption.pr_number !== 475 ||
    pack.pr475_absorption.current_state !== "OPEN" ||
    pack.pr475_absorption.no_conflicting_writer !== true ||
    pack.pr475_absorption.no_auto_cherry_pick !== true ||
    pack.pr475_absorption.integration_stage !== "LOOKAHEAD_READY"
  )
    issues.push("pr475_reuse_boundary_invalid");

  if (
    pack.authority.official_truth_write ||
    pack.authority.settlement_write ||
    pack.authority.parameter_set_formal_write ||
    pack.authority.provider !== "OFF" ||
    pack.authority.second_truth_writer
  )
    issues.push("authority_boundary_invalid");
  if (pack.state_b !== "SECOND_CITY_PUBLIC_SOURCE_TRANSFER_REQUALIFICATION_READY") issues.push("state_b_invalid");
  return [...new Set(issues)];
}
