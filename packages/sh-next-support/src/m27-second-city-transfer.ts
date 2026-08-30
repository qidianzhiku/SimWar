import { stableDigest } from "./index.js";
import {
  buildM25PublicSourceRealityEvidenceEpochPack,
  M25_SOURCE_EPOCH_BASE_SHA,
  validateM25PublicSourceRealityEvidenceEpochPack,
  type M25RegionalTransfer
} from "./m25-public-source-evidence.js";
import { buildM4PortabilityCompatibilityPack } from "./m4-portability.js";
import { buildM5RealityQualificationPack } from "./m5-reality-qualification.js";
import { buildM6LivingScenarioLifecyclePack } from "./m6-living-scenario.js";

export const M27_SECOND_CITY_SCHEMA_VERSION = "sh-second-city-transfer-requalification.v1" as const;
export const M27_CURRENT_MASTER_SHA = "0dece5cd9c58d8bafb5231b3047c849aa4861298" as const;
export const M27_SOURCE_EPOCH_BASE_SHA = M25_SOURCE_EPOCH_BASE_SHA;
export const M27_MISSION_ID = "SIMWAR-SH-M27-SECOND-CITY-PUBLIC-SOURCE-TRANSFER-REQUALIFICATION" as const;

export type M27QualificationStatus = "READY" | "LIMITED" | "NOT_ELIGIBLE" | "NOT_COMPUTABLE";

export interface M27RegionalTransferEnvelope {
  schema_version: "regional-transfer.v1";
  candidate_ref: {
    candidate_id: string;
    content_digest: string;
    tenant_id: string;
    version: string;
  };
  consumer_scope: {
    minimum_team_count: 2;
    run_id: string;
    status: "SHARED_GOVERNED_SCENARIO";
    team_ids: string[];
  };
  scope: { course_id: string; round_no: number; run_id: string; tenant_id: string };
  baseline: {
    package_reference: { digest: string; package_id: string; version: string };
    region: "Shanghai";
  };
  target: {
    package_reference: { digest: string; package_id: string; version: string };
    region: "Hangzhou";
  };
  formal_references: {
    course_blueprint_reference: { content_digest: string; course_blueprint_id: string; tenant_id: string; version: string };
    parameter_set_reference: { content_digest: string; parameter_set_id: string; version: string };
    scenario_package_reference: { content_digest: string; scenario_package_id: string; tenant_id: string; version: string };
  };
  provenance: {
    current_source_readback: "EXACT_SOURCE_READBACK_REQUIRED";
    support_packs: {
      m4_pack_digest: string;
      m4_source_revision: string;
      m5_pack_digest: string;
      m5_source_revision: string;
      m6_pack_digest: string;
      m6_source_revision: string;
    };
  };
  qualification: {
    calibration_eligible: false;
    rights_status: "PUBLIC_SAFE";
    status: "READY_WITH_LIMITS";
    source_status: "REFERENCE_ONLY_WITH_SYNTHETIC_FALLBACK";
  };
  diff: {
    changes: Array<{ field: "region" | "package" | "qualification"; from: string; to: string }>;
    status: "DIFF_RECORDED";
  };
  impact: {
    affected_consumers: string[];
    requalification_required: true;
    rollback_candidate: true;
  };
  activation: { published: false; status: "NOT_ACTIVATED" };
  authority: {
    formal_writer_mutations: 0;
    official_truth_write: false;
    provider: "OFF";
    runtime_authority: "JSON_INTERNAL_ONLY";
    settlement_write: false;
  };
  rollback: {
    candidate_version: string;
    dry_run: true;
    executed: false;
    resolution: "SAFE_DRY_RUN_CANDIDATE";
    rollback_version: string;
    version_guard: "EXACT_VERSION_REQUIRED";
  };
  lifecycle: "PREVIEWED";
  known_limits: string[];
}

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
    source_epoch_base_sha: typeof M27_SOURCE_EPOCH_BASE_SHA;
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
  transfer: M27RegionalTransferEnvelope;
  transfer_summary: {
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

function candidateContent(envelope: M27RegionalTransferEnvelope): object {
  return {
    baseline: envelope.baseline.package_reference,
    baseline_region: envelope.baseline.region,
    course_blueprint_reference: envelope.formal_references.course_blueprint_reference,
    course_id: envelope.scope.course_id,
    parameter_set_reference: envelope.formal_references.parameter_set_reference,
    round_no: envelope.scope.round_no,
    run_id: envelope.scope.run_id,
    scenario_package_reference: envelope.formal_references.scenario_package_reference,
    target: envelope.target.package_reference,
    target_region: envelope.target.region,
    consumer_team_ids: envelope.consumer_scope.team_ids
  };
}

function validateRegionalTransferEnvelope(envelope: M27RegionalTransferEnvelope): string[] {
  const issues: string[] = [];
  const candidateDigest = stableDigest(candidateContent(envelope));
  if (envelope.schema_version !== "regional-transfer.v1") issues.push("shared_schema_mismatch");
  if (envelope.candidate_ref.content_digest !== candidateDigest) issues.push("envelope_candidate_digest_invalid");
  if (envelope.candidate_ref.candidate_id !== `rt_candidate_${candidateDigest.slice(0, 16)}`)
    issues.push("envelope_candidate_id_invalid");
  if (envelope.scope.tenant_id !== envelope.candidate_ref.tenant_id) issues.push("envelope_tenant_scope_invalid");
  if (
    envelope.consumer_scope.minimum_team_count !== 2 ||
    envelope.consumer_scope.status !== "SHARED_GOVERNED_SCENARIO" ||
    envelope.consumer_scope.team_ids.length < 2 ||
    envelope.consumer_scope.run_id !== envelope.scope.run_id
  )
    issues.push("envelope_consumer_scope_invalid");
  if (envelope.baseline.region !== "Shanghai" || envelope.target.region !== "Hangzhou")
    issues.push("envelope_region_invalid");
  if (envelope.formal_references.course_blueprint_reference.version.match(/^(latest|default|current)$/iu))
    issues.push("envelope_floating_course_version");
  if (envelope.formal_references.parameter_set_reference.version.match(/^(latest|default|current)$/iu))
    issues.push("envelope_floating_parameter_version");
  if (envelope.formal_references.scenario_package_reference.version.match(/^(latest|default|current)$/iu))
    issues.push("envelope_floating_scenario_version");
  if (
    envelope.provenance.current_source_readback !== "EXACT_SOURCE_READBACK_REQUIRED" ||
    !/^[a-f0-9]{64}$/u.test(envelope.provenance.support_packs.m4_pack_digest) ||
    !/^[a-f0-9]{64}$/u.test(envelope.provenance.support_packs.m5_pack_digest) ||
    !/^[a-f0-9]{64}$/u.test(envelope.provenance.support_packs.m6_pack_digest)
  )
    issues.push("envelope_provenance_invalid");
  if (
    envelope.activation.published ||
    envelope.activation.status !== "NOT_ACTIVATED" ||
    envelope.lifecycle !== "PREVIEWED" ||
    envelope.qualification.calibration_eligible ||
    envelope.qualification.status !== "READY_WITH_LIMITS" ||
    envelope.qualification.source_status !== "REFERENCE_ONLY_WITH_SYNTHETIC_FALLBACK"
  )
    issues.push("envelope_activation_or_qualification_invalid");
  if (
    envelope.diff.status !== "DIFF_RECORDED" ||
    envelope.diff.changes.length === 0 ||
    !envelope.impact.requalification_required ||
    !envelope.impact.rollback_candidate
  )
    issues.push("envelope_diff_or_impact_invalid");
  if (
    envelope.authority.formal_writer_mutations !== 0 ||
    envelope.authority.official_truth_write ||
    envelope.authority.provider !== "OFF" ||
    envelope.authority.runtime_authority !== "JSON_INTERNAL_ONLY" ||
    envelope.authority.settlement_write
  )
    issues.push("envelope_authority_invalid");
  if (
    !envelope.rollback.dry_run ||
    envelope.rollback.executed ||
    envelope.rollback.resolution !== "SAFE_DRY_RUN_CANDIDATE" ||
    envelope.rollback.version_guard !== "EXACT_VERSION_REQUIRED"
  )
    issues.push("envelope_rollback_invalid");
  return issues;
}

function requiredTransfer(transfers: M25RegionalTransfer[]): M25RegionalTransfer {
  const transfer = transfers.find((item) => item.target_geography === "Hangzhou");
  if (!transfer) throw new Error("M27_HANGZHOU_TRANSFER_MISSING");
  return transfer;
}

function buildRegionalTransferEnvelope(
  m25: ReturnType<typeof buildM25PublicSourceRealityEvidenceEpochPack>
): M27RegionalTransferEnvelope {
  const tenantId = "tenant_m27_public_source_candidate";
  const runId = "run_m27_public_source_requalification";
  const courseId = "course_m27_public_source_requalification";
  const baselinePackageReference = {
    digest: stableDigest({ city: "Shanghai", epoch_digest: m25.source_epoch.epoch_digest, role: "ANCHOR" }),
    package_id: "SH-M25-PUBLIC-SOURCE-ANCHOR",
    version: "1.0.0"
  };
  const targetPackageReference = {
    digest: stableDigest({ city: "Hangzhou", epoch_digest: m25.source_epoch.epoch_digest, role: "SECOND_CITY" }),
    package_id: "HZ-M25-PUBLIC-SOURCE-TARGET",
    version: "1.0.0"
  };
  const courseBlueprintReference = {
    content_digest: stableDigest({ course_id: courseId, epoch_digest: m25.source_epoch.epoch_digest }),
    course_blueprint_id: "blueprint_m27_public_source_requalification",
    tenant_id: tenantId,
    version: "1.0.0"
  };
  const parameterSetReference = {
    content_digest: stableDigest({ purpose: "M27_REQUALIFICATION_ONLY", epoch_digest: m25.source_epoch.epoch_digest }),
    parameter_set_id: "parameter_m27_requalification_not_activated",
    version: "1.0.0"
  };
  const scenarioPackageReference = {
    content_digest: stableDigest({ purpose: "M27_PUBLIC_SOURCE_SCENARIO_CANDIDATE", epoch_digest: m25.source_epoch.epoch_digest }),
    scenario_package_id: "scenario_m27_public_source_requalification",
    tenant_id: tenantId,
    version: "1.0.0"
  };
  const teamIds = ["team_m27_candidate_a", "team_m27_candidate_b"];
  const candidateDigest = stableDigest({
    baseline: baselinePackageReference,
    baseline_region: "Shanghai",
    course_blueprint_reference: courseBlueprintReference,
    course_id: courseId,
    parameter_set_reference: parameterSetReference,
    round_no: 1,
    run_id: runId,
    scenario_package_reference: scenarioPackageReference,
    target: targetPackageReference,
    target_region: "Hangzhou",
    consumer_team_ids: teamIds
  });
  const m4 = buildM4PortabilityCompatibilityPack();
  const m5 = buildM5RealityQualificationPack();
  const m6 = buildM6LivingScenarioLifecyclePack();
  return {
    schema_version: "regional-transfer.v1",
    candidate_ref: {
      candidate_id: `rt_candidate_${candidateDigest.slice(0, 16)}`,
      content_digest: candidateDigest,
      tenant_id: tenantId,
      version: "1.0.0"
    },
    consumer_scope: {
      minimum_team_count: 2,
      run_id: runId,
      status: "SHARED_GOVERNED_SCENARIO",
      team_ids: teamIds
    },
    scope: { course_id: courseId, round_no: 1, run_id: runId, tenant_id: tenantId },
    baseline: { package_reference: baselinePackageReference, region: "Shanghai" },
    target: { package_reference: targetPackageReference, region: "Hangzhou" },
    formal_references: {
      course_blueprint_reference: courseBlueprintReference,
      parameter_set_reference: parameterSetReference,
      scenario_package_reference: scenarioPackageReference
    },
    provenance: {
      current_source_readback: "EXACT_SOURCE_READBACK_REQUIRED",
      support_packs: {
        m4_pack_digest: m4.pack_digest,
        m4_source_revision: "b86150a276e2cfc77fd4714e794a3d33de9d541c",
        m5_pack_digest: m5.pack_digest,
        m5_source_revision: "f3ee70712bbb2ff6f256bcfc007d56e0ee9bebf4",
        m6_pack_digest: m6.pack_digest,
        m6_source_revision: "d573ea20ab352b5cc6f22d6af3de45c68f6d3334"
      }
    },
    qualification: {
      calibration_eligible: false,
      rights_status: "PUBLIC_SAFE",
      status: "READY_WITH_LIMITS",
      source_status: "REFERENCE_ONLY_WITH_SYNTHETIC_FALLBACK"
    },
    diff: {
      changes: [
        { field: "region", from: "Shanghai", to: "Hangzhou" },
        { field: "package", from: baselinePackageReference.package_id, to: targetPackageReference.package_id },
        { field: "qualification", from: "M5_NOT_ELIGIBLE", to: "READY_WITH_LIMITS" }
      ],
      status: "DIFF_RECORDED"
    },
    impact: {
      affected_consumers: ["TSS", "Course", "Run", "Student", "Admin"],
      requalification_required: true,
      rollback_candidate: true
    },
    activation: { published: false, status: "NOT_ACTIVATED" },
    authority: {
      formal_writer_mutations: 0,
      official_truth_write: false,
      provider: "OFF",
      runtime_authority: "JSON_INTERNAL_ONLY",
      settlement_write: false
    },
    rollback: {
      candidate_version: targetPackageReference.version,
      dry_run: true,
      executed: false,
      resolution: "SAFE_DRY_RUN_CANDIDATE",
      rollback_version: baselinePackageReference.version,
      version_guard: "EXACT_VERSION_REQUIRED"
    },
    lifecycle: "PREVIEWED",
    known_limits: [
      "This is an exact regional-transfer.v1 candidate envelope and is not published or activated.",
      "Formal references are candidate fixtures only and require current source, package, model, course, run, round, and team revalidation."
    ]
  };
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
      source_epoch_base_sha: M27_SOURCE_EPOCH_BASE_SHA
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
    transfer: buildRegionalTransferEnvelope(m25),
    transfer_summary: {
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
  if (pack.evidence_epoch_ref.source_epoch_base_sha !== M27_SOURCE_EPOCH_BASE_SHA)
    issues.push("source_epoch_base_mismatch");

  const expectedTransfer = requiredTransfer(m25.regional_transfers);
  const expectedHangzhouAssets = m25.source_assets.filter((item) => item.geography === "Hangzhou");
  const expectedReceiptIds = expectedHangzhouAssets.map((item) => item.source_receipt_id);
  const expectedAssetIds = expectedHangzhouAssets.map((item) => item.source_id);
  if (pack.evidence_epoch_ref.epoch_id !== m25.source_epoch.epoch_id)
    issues.push("evidence_epoch_id_mismatch");
  issues.push(...validateRegionalTransferEnvelope(pack.transfer).map((issue) => `envelope_${issue}`));
  if (pack.transfer.schema_version !== "regional-transfer.v1") issues.push("shared_schema_mismatch");
  if (
    pack.transfer_summary.transfer_id !== expectedTransfer.transfer_id ||
    pack.transfer_summary.baseline_region !== expectedTransfer.baseline_geography ||
    pack.transfer_summary.target_region !== expectedTransfer.target_geography ||
    JSON.stringify(pack.transfer_summary.source_feature_ids) !== JSON.stringify(expectedTransfer.source_feature_ids) ||
    JSON.stringify(pack.transfer_summary.target_feature_ids) !== JSON.stringify(expectedTransfer.target_feature_ids) ||
    pack.transfer_summary.method !== expectedTransfer.method ||
    pack.transfer_summary.output !== expectedTransfer.output
  )
    issues.push("exact_transfer_binding_invalid");
  if (pack.second_city.city !== "Hangzhou" || !pack.second_city.public_source_coverage)
    issues.push("second_city_coverage_invalid");
  if (pack.second_city.source_reality_class !== "PUBLIC_SOURCE_BOUND") issues.push("second_city_source_class_invalid");
  if (pack.second_city.synthetic_only) issues.push("synthetic_only_second_city_forbidden");
  if (
    JSON.stringify(pack.second_city.source_receipt_ids) !== JSON.stringify(expectedReceiptIds) ||
    JSON.stringify(pack.second_city.source_asset_ids) !== JSON.stringify(expectedAssetIds)
  )
    issues.push("second_city_lineage_mismatch");
  if (pack.second_city.rights_status !== "PUBLIC_REFERENCE_ONLY" || pack.transfer_summary.rights_status !== "PUBLIC_REFERENCE_ONLY")
    issues.push("rights_status_invalid");
  if (
    pack.transfer_summary.valid_to !== expectedTransfer.valid_to ||
    pack.second_city.expiry !== m25.source_epoch.expires_at
  )
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
  if (pack.qualification.status !== "LIMITED")
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
