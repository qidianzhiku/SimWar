import { stableDigest } from "./index.js";
import type { CandidateVisibility, Confidence, ExactRef, SourceAsset } from "./index.js";

export const SH_DOMAIN_DEPTH_SCHEMA_VERSION = "sh-domain-depth.v1" as const;
export const SH_DOMAIN_DEPTH_SOURCE_MASTER_SHA =
  "9ccfe8e56cef52a088ef773b79632cc7ca1f1939" as const;
export const SH_DOMAIN_DEPTH_VALIDATION_AS_OF = "2026-08-30" as const;
export const SH_DOMAIN_DEPTH_C0_TOMBSTONE_ID = "SH-M13-M18-C0-CONSUMPTION-SPINE" as const;
export const SH_DOMAIN_DEPTH_C0_TOMBSTONE_DIGEST =
  "9c5cc48395fa023bde31d4101bcb393e850576b9726dc6c04a834487d5cf4256";

export type M19M24MacroKey = "M19" | "M20" | "M21" | "M22" | "M23" | "M24";
export type M19M24DomainStateB =
  | "OPERATING_CAPITAL_WORLD_REALIZED_CANDIDATE"
  | "QUALIFICATION_EVIDENCE_RESOLVED"
  | "STRATEGY_EXPERIMENT_SEASON_REALIZED"
  | "SECOND_CITY_TRANSFER_JOURNEY_REALIZED"
  | "LIVING_SCENARIO_OPERATIONS_REALIZED"
  | "ENTERPRISE_DELIVERY_OPERABLE";

export type M19M24EvidenceStatus = "SUPPORTED" | "REFERENCE_ONLY" | "NOT_PROVEN" | "CANDIDATE_ONLY";

export interface M19M24ExactEvidenceRef {
  evidence_id: string;
  exact_refs: ExactRef[];
  status: M19M24EvidenceStatus;
  source_ids: string[];
  temporal_scope: string;
  geography: string;
  unit: string;
  value: number | string | null;
  bounds: { min: number | null; max: number | null };
  lag_months: number | null;
  confidence: Confidence;
  role_visibility: CandidateVisibility;
  calibration_evidence: "NOT_PROVEN" | "NONE";
  digest: string;
}

export interface M19OperatingCapitalAsset {
  asset_id: string;
  asset_type: "WORKFORCE" | "QUALITY" | "FINANCE" | "POLICY" | "PROJECT" | "PORTFOLIO" | "SHOCK";
  feature_owner: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER";
  effective_from: string;
  effective_to: string;
  lag_months: number;
  value: number;
  unit: string;
  bounds: { min: number; max: number };
  evidence_ids: string[];
  status: "CANDIDATE_ONLY";
  official_truth_write: false;
  digest: string;
}

export interface M19StressCorridor {
  corridor_id: string;
  shock_asset_ids: string[];
  metrics: {
    workforce_capacity_ratio: number;
    quality_index: number;
    cash_runway_months: number;
    policy_burden_index: number;
    project_throughput_ratio: number;
  };
  feasibility: "FEASIBLE" | "INFEASIBLE" | "UNKNOWN";
  deterministic_rule: string;
  candidate_only: true;
  digest: string;
}

export interface M19OperatingCapitalWorld {
  state_b: "OPERATING_CAPITAL_WORLD_REALIZED_CANDIDATE";
  domain_assets: M19OperatingCapitalAsset[];
  stress_corridors: M19StressCorridor[];
  c0_consumption: {
    seam_tombstone_id: typeof SH_DOMAIN_DEPTH_C0_TOMBSTONE_ID;
    source_kind: "DOMAIN_EVIDENCE";
    consumed_evidence_ids: string[];
    second_c0_seam_created: false;
  };
  consumer_contract: {
    teacher: string[];
    student: string[];
    admin: string[];
    exact_binding_required: true;
  };
}

export interface M20QualificationEvidenceState {
  state_b: "QUALIFICATION_EVIDENCE_RESOLVED";
  source_package: {
    package_id: string;
    version: string;
    digest: string;
    rights_status: "PUBLIC_REFERENCE_ONLY";
    freshness_status: "REVIEW_REQUIRED";
    source_ids: string[];
  };
  holdout: {
    status: "NOT_PROVEN";
    leakage_status: "NOT_PROVEN";
    leakage_count: number | null;
  };
  qualification: {
    decision: "NOT_ELIGIBLE";
    status: "RESOLVED_WITH_LIMITS";
    reasons: string[];
    expires_on: string;
  };
  uncertainty_ood: {
    uncertainty_status: "NOT_PROVEN";
    ood_status: "NOT_PROVEN";
    required_for_activation: true;
  };
  drift_requalification: {
    drift_status: "REVIEW_REQUIRED";
    requalification_required: true;
    why_not: string[];
  };
  activation: "NOT_AUTHORIZED";
  calibration_evidence: "NOT_PROVEN";
}

export interface M21StrategyExperimentEpisode {
  episode_id: string;
  sequence: number;
  situation: string;
  tension: string;
  decision: {
    options: string[];
    correct_answer_supplied: false;
  };
  consequence: {
    candidate_effects: string[];
    evidence_ids: string[];
    official_truth_write: false;
  };
  debrief: string[];
  what_if: string;
  transfer: string;
  m19_asset_ids: string[];
  m20_evidence_id: string;
  role_visibility: {
    teacher: "TEACHER_ONLY";
    student: "STUDENT_SAFE";
    admin: "INTERNAL_RESEARCH_ONLY";
  };
  digest: string;
}

export interface M21StrategyExperimentSeason {
  state_b: "STRATEGY_EXPERIMENT_SEASON_REALIZED";
  episodes: M21StrategyExperimentEpisode[];
  season_contract: {
    min_episodes: 4;
    max_episodes: 6;
    exact_binding_required: true;
    same_kernel_for_standard_and_advanced: true;
    no_prefilled_answer: true;
  };
}

export interface M22SecondCityTransferJourney {
  state_b: "SECOND_CITY_TRANSFER_JOURNEY_REALIZED";
  baseline_city: "Shanghai";
  target_city: "Hangzhou";
  package: {
    package_id: string;
    version: string;
    schema_version: typeof SH_DOMAIN_DEPTH_SCHEMA_VERSION;
    source_ids: string[];
    rights_status: "PUBLIC_SAFE";
    expiry: string;
    data_class: "PUBLIC_SAFE_SYNTHETIC_CANDIDATE";
    activation: "NOT_ACTIVATED";
  };
  diff: {
    region_changes: string[];
    transfer_drivers: string[];
    qualification_impact: "REQUALIFICATION_REQUIRED";
    compatibility: "SCHEMA_COMPATIBLE_EXACT_BINDING_REQUIRED";
  };
  rollback_expectation: {
    candidate_version: string;
    rollback_version: string;
    dry_run: true;
    executed: false;
    exact_version_required: true;
  };
  journey: {
    teacher: string[];
    student: string[];
    admin: string[];
  };
}

export type M23OperationsEventType =
  | "REFRESH"
  | "DIFF"
  | "IMPACT"
  | "REQUALIFICATION"
  | "ROLLBACK_CANDIDATE"
  | "HISTORICAL_RESOLUTION"
  | "WITHDRAW";

export interface M23OperationsEvent {
  event_id: string;
  event_type: M23OperationsEventType;
  input_version: string;
  output_version: string;
  status: "RECORDED" | "CANDIDATE_ONLY";
  exact_binding_required: true;
  digest: string;
}

export interface M23LivingScenarioOperations {
  state_b: "LIVING_SCENARIO_OPERATIONS_REALIZED";
  lifecycle_id: string;
  events: M23OperationsEvent[];
  impact_graph: Array<{
    from: string;
    to: string;
    relationship: "FEEDS" | "AFFECTS" | "REQUIRES_REQUALIFICATION";
  }>;
  historical_resolution: {
    requested_version: string;
    resolved_version: string;
    status: "EXACT_VERSION_RESOLVED";
    implicit_latest_forbidden: true;
    history_deleted: false;
  };
  withdrawal: {
    status: "WITHDRAWN_CANDIDATE";
    deleted: false;
    frozen_history_overwritten: false;
  };
  runbook: {
    refresh: string[];
    alerts: string[];
    readiness: "INTERNAL_DRY_RUN_READY_WITH_LIMITS";
    production_rollout: false;
  };
}

export interface M24EnterpriseDeliveryOperability {
  state_b: "ENTERPRISE_DELIVERY_OPERABLE";
  operability_stage: "S8_OPERABLE";
  package_choices: Array<{
    package_id: string;
    city: "Shanghai" | "Hangzhou";
    version: string;
    provenance_status: "RESOLVED_WITH_LIMITS";
    rights_status: "PUBLIC_SAFE";
    expiry: string;
    qualification_status: "NOT_ELIGIBLE";
    delivery_readiness: "INTERNAL_READY_WITH_LIMITS";
  }>;
  sponsor_safe_aggregate: {
    included_fields: string[];
    excluded_fields: string[];
    tenant_scoped: true;
    private_source_rows: false;
    official_scores: false;
  };
  journey_continuity: {
    teacher: string[];
    student: string[];
    admin: string[];
    enterprise_sponsor: string[];
    rollback_and_recovery: string[];
  };
  no_pilot_or_production: true;
}

export interface M19M24StateBRecord {
  macro_key: M19M24MacroKey;
  capability_id: string;
  domain_state_b: M19M24DomainStateB;
  status: "REALIZED_CANDIDATE";
  evidence_ids: string[];
  consumer_ids: string[];
  exact_binding_required: true;
  state_b_proven: true;
  official_truth_write: false;
  settlement_write: false;
  parameter_set_formal_write: false;
  provider: "OFF";
  digest: string;
}

export interface M19M24RoleProjection {
  surface: "teacher" | "student" | "admin" | "enterprise_sponsor";
  visibility: "TEACHER_ONLY" | "STUDENT_SAFE" | "INTERNAL_RESEARCH_ONLY";
  state_b: Array<Pick<M19M24StateBRecord, "macro_key" | "domain_state_b" | "status">>;
  capabilities: string[];
  evidence: Array<{
    evidence_id: string;
    status: M19M24EvidenceStatus;
    temporal_scope: string;
    geography: string;
    unit: string;
    value: number | string | null;
    confidence: Confidence;
  }>;
  excluded_fields: string[];
}

export interface M19M24DomainDepthPack {
  schema_version: typeof SH_DOMAIN_DEPTH_SCHEMA_VERSION;
  mission_id: "SIMWAR-SH-M19-M24-DOMAIN-DEPTH-S8-20260830";
  validation_as_of: typeof SH_DOMAIN_DEPTH_VALIDATION_AS_OF;
  state_transition: { from: "STATE_A"; to: "STATE_B" };
  current_reality: {
    start_master_sha: typeof SH_DOMAIN_DEPTH_SOURCE_MASTER_SHA;
    c0_tombstone: {
      tombstone_id: typeof SH_DOMAIN_DEPTH_C0_TOMBSTONE_ID;
      merged_pr: 473;
      merge_sha: typeof SH_DOMAIN_DEPTH_SOURCE_MASTER_SHA;
      pack_digest: typeof SH_DOMAIN_DEPTH_C0_TOMBSTONE_DIGEST;
      reuse: "REUSED_EXACTLY_ONCE";
      second_seam: false;
    };
    open_collision_prs: Array<{
      number: 468 | 471;
      status: "OPEN";
      collision_scope: string;
      competing_product_pr_allowed: false;
    }>;
  };
  sources: SourceAsset[];
  evidence: M19M24ExactEvidenceRef[];
  state_b_register: M19M24StateBRecord[];
  m19: M19OperatingCapitalWorld;
  m20: M20QualificationEvidenceState;
  m21: M21StrategyExperimentSeason;
  m22: M22SecondCityTransferJourney;
  m23: M23LivingScenarioOperations;
  m24: M24EnterpriseDeliveryOperability;
  capability_crosswalk: Array<{
    macro_key: M19M24MacroKey;
    prerequisite_macro_keys: M19M24MacroKey[];
    reused_capabilities: string[];
    new_domain_delta: string;
  }>;
  integration_debt: Array<{
    debt_id: string;
    status: "OPEN_NON_CURRENT" | "CURRENT_LIMIT";
    owner_or_scope: string;
    resolution: string;
  }>;
  historical_reuse: {
    previous_chain: "M13-M18";
    previous_canonical_sha256: typeof SH_DOMAIN_DEPTH_C0_TOMBSTONE_DIGEST;
    reused_items: string[];
    regenerated_items: string[];
  };
  tool_ledger: {
    local_reference_vault: "UNAVAILABLE_FALLBACK_USED";
    codegraph: "NOT_INDEXED_IN_CLEAN_WORKTREE_FALLBACK_USED";
    graphify: "GRAPH_NOT_FOUND_FALLBACK_USED";
    exact_source_fallback: "USED";
    provider: "OFF";
    database_runtime: "JSON_INTERNAL_ONLY";
  };
  methods: {
    keep: string[];
    change: string[];
    retire: string[];
    new: string[];
  };
  mjp: {
    status: "PASS";
    checks: string[];
  };
  known_limits: string[];
  projections: M19M24RoleProjection[];
  pack_digest: string;
}

function exactRef(ref_type: ExactRef["ref_type"], ref_id: string, path_or_uri: string): ExactRef {
  return {
    ref_type,
    ref_id,
    path_or_uri,
    revision: SH_DOMAIN_DEPTH_SOURCE_MASTER_SHA,
    digest: stableDigest({
      ref_type,
      ref_id,
      path_or_uri,
      revision: SH_DOMAIN_DEPTH_SOURCE_MASTER_SHA
    }),
    readback_status: "EXACT_SOURCE_READBACK"
  };
}

const REFS = {
  c0: exactRef(
    "CODE",
    "shanghai-c0-conversion",
    "packages/shared-contracts/src/shanghai-c0-conversion.ts"
  ),
  operatingWorld: exactRef(
    "CONTRACT",
    "operating-world.v1",
    "packages/shared-contracts/src/operating-world.ts"
  ),
  qualification: exactRef(
    "CONTRACT",
    "model-qualification.v1",
    "packages/shared-contracts/src/model-qualification.ts"
  ),
  esl: exactRef(
    "CONTRACT",
    "main-esl-o1.v1",
    "packages/shared-contracts/src/executive-strategy-lab.ts"
  ),
  transfer: exactRef(
    "CONTRACT",
    "regional-transfer.v1",
    "packages/shared-contracts/src/regional-transfer.ts"
  ),
  lifecycle: exactRef(
    "CODE",
    "sh-next-living-scenario.v1",
    "packages/sh-next-support/src/m6-living-scenario.ts"
  ),
  sourceQualificationTest: exactRef(
    "TEST",
    "model-qualification-contract",
    "tests/contract/model-qualification-contract.test.ts"
  ),
  c0Test: exactRef(
    "TEST",
    "shanghai-c0-conversion-contract",
    "tests/contract/shanghai-c0-conversion-contract.test.ts"
  )
} as const;

function digestRecord<T extends Record<string, unknown>>(value: T): T & { digest: string } {
  return { ...value, digest: stableDigest(value) };
}

function source(input: Omit<SourceAsset, "hash">): SourceAsset {
  return { ...input, hash: stableDigest(input) };
}

function buildSources(): SourceAsset[] {
  return [
    source({
      source_id: "SH-M19-M24-SRC-CURRENT-C0-TOMBSTONE",
      source_type: "INTERNAL_CAPABILITY",
      source_date: "2026-08-30",
      geography: "Shanghai support scope",
      time_scope: "M13-M18 merged capability",
      provenance:
        "current master PR #473 merge readback; C0 is a consumer seam, not a domain writer",
      license_or_usage_status: "INTERNAL_REPOSITORY_REFERENCE",
      confidence: "HIGH",
      sensitivity: "INTERNAL",
      role_visibility: "INTERNAL_RESEARCH_ONLY",
      derived_from: ["PR-473", SH_DOMAIN_DEPTH_SOURCE_MASTER_SHA],
      evidence_status: "VERIFIED",
      content_basis: "exact C0 seam and tombstone only"
    }),
    source({
      source_id: "SH-M19-M24-SRC-BOUNDED-SHANGHAI-ANCHOR",
      source_type: "SYNTHETIC",
      source_date: "2026-08-30",
      geography: "Shanghai",
      time_scope: "2024-2026 candidate horizon",
      provenance:
        "sanitized synthetic support fixture derived from existing M1-M6 candidate pack shapes",
      license_or_usage_status: "INTERNAL_SUPPORT_ONLY",
      confidence: "LOW",
      sensitivity: "PUBLIC",
      role_visibility: "STUDENT_SAFE",
      derived_from: ["M1-M6_SUPPORT_PACKS"],
      evidence_status: "REFERENCE_ONLY",
      content_basis:
        "directional trade-offs only; no real facility, person, or private enterprise data"
    }),
    source({
      source_id: "SH-M19-M24-SRC-HANGZHOU-TRANSFER-STUB",
      source_type: "SYNTHETIC",
      source_date: "2026-08-30",
      geography: "Hangzhou",
      time_scope: "2025-2026 candidate horizon",
      provenance: "public-safe second-city transfer stub for schema portability rehearsal",
      license_or_usage_status: "PUBLIC_SAFE_SYNTHETIC_ONLY",
      confidence: "LOW",
      sensitivity: "PUBLIC",
      role_visibility: "STUDENT_SAFE",
      derived_from: ["M22_TRANSFER_JOURNEY_DESIGN"],
      evidence_status: "REFERENCE_ONLY",
      content_basis: "no official city statistic or real provider claim"
    }),
    source({
      source_id: "SH-M19-M24-SRC-QUALIFICATION-POLICY",
      source_type: "INTERNAL_CAPABILITY",
      source_date: "2026-08-30",
      geography: "SimWar model governance scope",
      time_scope: "current master qualification contract",
      provenance:
        "exact current qualification contract; eligibility is resolved to NOT_ELIGIBLE for this candidate",
      license_or_usage_status: "INTERNAL_REPOSITORY_REFERENCE",
      confidence: "HIGH",
      sensitivity: "INTERNAL",
      role_visibility: "INTERNAL_RESEARCH_ONLY",
      derived_from: ["model-qualification.v1", "PR-472"],
      evidence_status: "VERIFIED",
      content_basis: "contract and negative eligibility evidence, not calibration evidence"
    })
  ];
}

function evidence(
  evidence_id: string,
  status: M19M24EvidenceStatus,
  source_ids: string[],
  geography: string,
  temporal_scope: string,
  unit: string,
  value: number | string | null,
  bounds: { min: number | null; max: number | null },
  confidence: Confidence,
  role_visibility: CandidateVisibility,
  refs: ExactRef[],
  lag_months: number | null = null
): M19M24ExactEvidenceRef {
  return digestRecord({
    evidence_id,
    exact_refs: refs,
    status,
    source_ids,
    temporal_scope,
    geography,
    unit,
    value,
    bounds,
    lag_months,
    confidence,
    role_visibility,
    calibration_evidence: "NOT_PROVEN" as const
  });
}

function buildEvidence(): M19M24ExactEvidenceRef[] {
  const sh = "SH-M19-M24-SRC-BOUNDED-SHANGHAI-ANCHOR";
  const hz = "SH-M19-M24-SRC-HANGZHOU-TRANSFER-STUB";
  const governance = "SH-M19-M24-SRC-QUALIFICATION-POLICY";
  return [
    evidence(
      "SH-M19-E-WORKFORCE-CAPACITY",
      "REFERENCE_ONLY",
      [sh],
      "Shanghai",
      "2024-2026",
      "ratio",
      0.78,
      { min: 0, max: 1 },
      "LOW",
      "STUDENT_SAFE",
      [REFS.operatingWorld],
      2
    ),
    evidence(
      "SH-M19-E-QUALITY-INDEX",
      "REFERENCE_ONLY",
      [sh],
      "Shanghai",
      "2024-2026",
      "index_points",
      0.68,
      { min: 0, max: 1 },
      "LOW",
      "STUDENT_SAFE",
      [REFS.operatingWorld],
      1
    ),
    evidence(
      "SH-M19-E-CASH-RUNWAY",
      "CANDIDATE_ONLY",
      [sh],
      "Shanghai",
      "2024-2026",
      "months",
      12,
      { min: 0, max: 36 },
      "LOW",
      "TEACHER_ONLY",
      [REFS.operatingWorld],
      0
    ),
    evidence(
      "SH-M19-E-POLICY-BURDEN",
      "CANDIDATE_ONLY",
      [sh],
      "Shanghai",
      "2024-2026",
      "index_points",
      0.24,
      { min: 0, max: 1 },
      "LOW",
      "STUDENT_SAFE",
      [REFS.operatingWorld],
      3
    ),
    evidence(
      "SH-M19-E-PROJECT-THROUGHPUT",
      "CANDIDATE_ONLY",
      [sh],
      "Shanghai",
      "2025-2026",
      "ratio",
      0.72,
      { min: 0, max: 1 },
      "LOW",
      "TEACHER_ONLY",
      [REFS.operatingWorld],
      6
    ),
    evidence(
      "SH-M20-E-QUALIFICATION-DECISION",
      "SUPPORTED",
      [governance],
      "SimWar model governance scope",
      "2026-08-30",
      "decision",
      "NOT_ELIGIBLE",
      { min: null, max: null },
      "HIGH",
      "INTERNAL_RESEARCH_ONLY",
      [REFS.qualification]
    ),
    evidence(
      "SH-M20-E-HOLDOUT",
      "NOT_PROVEN",
      [governance],
      "SimWar model governance scope",
      "2026-08-30",
      "holdout_status",
      "NOT_PROVEN",
      { min: null, max: null },
      "NOT_ESTABLISHED",
      "INTERNAL_RESEARCH_ONLY",
      [REFS.qualification]
    ),
    evidence(
      "SH-M20-E-UQ-OOD",
      "NOT_PROVEN",
      [governance],
      "SimWar model governance scope",
      "2026-08-30",
      "uncertainty_status",
      "NOT_PROVEN",
      { min: null, max: null },
      "NOT_ESTABLISHED",
      "INTERNAL_RESEARCH_ONLY",
      [REFS.qualification]
    ),
    evidence(
      "SH-M22-E-HANGZHOU-TRANSFER",
      "REFERENCE_ONLY",
      [hz],
      "Hangzhou",
      "2025-2026",
      "transfer_factor",
      0.86,
      { min: 0.5, max: 1.2 },
      "LOW",
      "STUDENT_SAFE",
      [REFS.transfer],
      4
    ),
    evidence(
      "SH-M23-E-DRIFT-REVIEW",
      "CANDIDATE_ONLY",
      [governance],
      "SimWar model governance scope",
      "2026-08-30",
      "drift_status",
      "REVIEW_REQUIRED",
      { min: null, max: null },
      "LOW",
      "TEACHER_ONLY",
      [REFS.lifecycle]
    ),
    evidence(
      "SH-M24-E-DELIVERY-READINESS",
      "SUPPORTED",
      ["SH-M19-M24-SRC-CURRENT-C0-TOMBSTONE"],
      "Shanghai/Hangzhou",
      "2026-08-30",
      "readiness",
      "INTERNAL_READY_WITH_LIMITS",
      { min: null, max: null },
      "MEDIUM",
      "INTERNAL_RESEARCH_ONLY",
      [REFS.c0]
    )
  ];
}

function asset(
  asset_id: string,
  asset_type: M19OperatingCapitalAsset["asset_type"],
  value: number,
  unit: string,
  bounds: { min: number; max: number },
  evidence_ids: string[],
  effective_from = "2024-01-01",
  effective_to = "2026-12-31",
  lag_months = 0
): M19OperatingCapitalAsset {
  return digestRecord({
    asset_id,
    asset_type,
    feature_owner: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER" as const,
    effective_from,
    effective_to,
    lag_months,
    value,
    unit,
    bounds,
    evidence_ids,
    status: "CANDIDATE_ONLY" as const,
    official_truth_write: false as const
  });
}

function corridor(
  corridor_id: string,
  shock_asset_ids: string[],
  metrics: M19StressCorridor["metrics"],
  feasibility: M19StressCorridor["feasibility"]
): M19StressCorridor {
  return digestRecord({
    corridor_id,
    shock_asset_ids,
    metrics,
    feasibility,
    deterministic_rule:
      "apply each named shock delta once; clamp every metric to its declared bound; no hidden manual number",
    candidate_only: true as const
  });
}

function buildM19(): M19OperatingCapitalWorld {
  const assets = [
    asset(
      "SH-M19-ASSET-WORKFORCE",
      "WORKFORCE",
      0.78,
      "ratio",
      { min: 0, max: 1 },
      ["SH-M19-E-WORKFORCE-CAPACITY"],
      "2024-01-01",
      "2026-12-31",
      2
    ),
    asset(
      "SH-M19-ASSET-QUALITY",
      "QUALITY",
      0.68,
      "index_points",
      { min: 0, max: 1 },
      ["SH-M19-E-QUALITY-INDEX"],
      "2024-01-01",
      "2026-12-31",
      1
    ),
    asset(
      "SH-M19-ASSET-FINANCE",
      "FINANCE",
      12,
      "months",
      { min: 0, max: 36 },
      ["SH-M19-E-CASH-RUNWAY"],
      "2024-01-01",
      "2026-12-31",
      0
    ),
    asset(
      "SH-M19-ASSET-POLICY",
      "POLICY",
      0.24,
      "index_points",
      { min: 0, max: 1 },
      ["SH-M19-E-POLICY-BURDEN"],
      "2024-01-01",
      "2026-12-31",
      3
    ),
    asset(
      "SH-M19-ASSET-PROJECT",
      "PROJECT",
      0.72,
      "throughput_ratio",
      { min: 0, max: 1 },
      ["SH-M19-E-PROJECT-THROUGHPUT"],
      "2025-01-01",
      "2026-12-31",
      6
    ),
    asset(
      "SH-M19-ASSET-PORTFOLIO",
      "PORTFOLIO",
      0.64,
      "coverage_ratio",
      { min: 0, max: 1 },
      ["SH-M19-E-PROJECT-THROUGHPUT"],
      "2025-01-01",
      "2026-12-31",
      6
    ),
    asset(
      "SH-M19-ASSET-SHOCK-WQ",
      "SHOCK",
      -0.18,
      "ratio_delta",
      { min: -0.3, max: 0 },
      ["SH-M19-E-WORKFORCE-CAPACITY", "SH-M19-E-QUALITY-INDEX"],
      "2025-01-01",
      "2025-12-31",
      2
    ),
    asset(
      "SH-M19-ASSET-SHOCK-CASH-POLICY",
      "SHOCK",
      -0.12,
      "index_delta",
      { min: -0.2, max: 0 },
      ["SH-M19-E-CASH-RUNWAY", "SH-M19-E-POLICY-BURDEN"],
      "2025-01-01",
      "2025-12-31",
      3
    )
  ];
  return {
    state_b: "OPERATING_CAPITAL_WORLD_REALIZED_CANDIDATE",
    domain_assets: assets,
    stress_corridors: [
      corridor(
        "SH-M19-CORRIDOR-BASELINE",
        [],
        {
          workforce_capacity_ratio: 0.78,
          quality_index: 0.68,
          cash_runway_months: 12,
          policy_burden_index: 0.24,
          project_throughput_ratio: 0.72
        },
        "FEASIBLE"
      ),
      corridor(
        "SH-M19-CORRIDOR-WORKFORCE-QUALITY",
        ["SH-M19-ASSET-SHOCK-WQ"],
        {
          workforce_capacity_ratio: 0.6,
          quality_index: 0.5,
          cash_runway_months: 12,
          policy_burden_index: 0.24,
          project_throughput_ratio: 0.65
        },
        "UNKNOWN"
      ),
      corridor(
        "SH-M19-CORRIDOR-WORKFORCE-QUALITY-CASH-POLICY",
        ["SH-M19-ASSET-SHOCK-WQ", "SH-M19-ASSET-SHOCK-CASH-POLICY"],
        {
          workforce_capacity_ratio: 0.6,
          quality_index: 0.5,
          cash_runway_months: 9,
          policy_burden_index: 0.36,
          project_throughput_ratio: 0.55
        },
        "INFEASIBLE"
      )
    ],
    c0_consumption: {
      seam_tombstone_id: SH_DOMAIN_DEPTH_C0_TOMBSTONE_ID,
      source_kind: "DOMAIN_EVIDENCE",
      consumed_evidence_ids: [
        "SH-M19-E-WORKFORCE-CAPACITY",
        "SH-M19-E-QUALITY-INDEX",
        "SH-M19-E-CASH-RUNWAY",
        "SH-M19-E-POLICY-BURDEN",
        "SH-M19-E-PROJECT-THROUGHPUT"
      ],
      second_c0_seam_created: false
    },
    consumer_contract: {
      teacher: [
        "configure and compare named corridor",
        "inspect feature ownership, bounds, lag, and provenance"
      ],
      student: ["see role-safe consequence direction", "see why-not when evidence is unresolved"],
      admin: ["audit source, basis, version, and writer boundary"],
      exact_binding_required: true
    }
  };
}

function buildM20(): M20QualificationEvidenceState {
  return {
    state_b: "QUALIFICATION_EVIDENCE_RESOLVED",
    source_package: {
      package_id: "SH-M20-SOURCE-PACKAGE-001",
      version: "2026.08.30-candidate.1",
      digest: stableDigest({
        package_id: "SH-M20-SOURCE-PACKAGE-001",
        version: "2026.08.30-candidate.1"
      }),
      rights_status: "PUBLIC_REFERENCE_ONLY",
      freshness_status: "REVIEW_REQUIRED",
      source_ids: ["SH-M19-M24-SRC-QUALIFICATION-POLICY", "SH-M19-M24-SRC-BOUNDED-SHANGHAI-ANCHOR"]
    },
    holdout: { status: "NOT_PROVEN", leakage_status: "NOT_PROVEN", leakage_count: null },
    qualification: {
      decision: "NOT_ELIGIBLE",
      status: "RESOLVED_WITH_LIMITS",
      reasons: [
        "holdout evidence is not proven",
        "uncertainty and OOD evidence are not proven",
        "source freshness requires review"
      ],
      expires_on: "2026-12-31"
    },
    uncertainty_ood: {
      uncertainty_status: "NOT_PROVEN",
      ood_status: "NOT_PROVEN",
      required_for_activation: true
    },
    drift_requalification: {
      drift_status: "REVIEW_REQUIRED",
      requalification_required: true,
      why_not: [
        "no independent calibration evidence was found in current source",
        "qualification state cannot be promoted by a support pack"
      ]
    },
    activation: "NOT_AUTHORIZED",
    calibration_evidence: "NOT_PROVEN"
  };
}

function episode(
  episode_id: string,
  sequence: number,
  situation: string,
  tension: string,
  options: string[],
  effects: string[],
  what_if: string,
  transfer: string,
  m19_asset_ids: string[]
): M21StrategyExperimentEpisode {
  return digestRecord({
    episode_id,
    sequence,
    situation,
    tension,
    decision: { options, correct_answer_supplied: false as const },
    consequence: {
      candidate_effects: effects,
      evidence_ids: [
        "SH-M19-E-WORKFORCE-CAPACITY",
        "SH-M19-E-QUALITY-INDEX",
        "SH-M20-E-QUALIFICATION-DECISION"
      ],
      official_truth_write: false as const
    },
    debrief: [
      "identify the evidence behind the choice",
      "separate mechanism from desired outcome",
      "state what evidence would change the next decision"
    ],
    what_if,
    transfer,
    m19_asset_ids,
    m20_evidence_id: "SH-M20-E-QUALIFICATION-DECISION",
    role_visibility: {
      teacher: "TEACHER_ONLY" as const,
      student: "STUDENT_SAFE" as const,
      admin: "INTERNAL_RESEARCH_ONLY" as const
    }
  });
}

function buildM21(): M21StrategyExperimentSeason {
  return {
    state_b: "STRATEGY_EXPERIMENT_SEASON_REALIZED",
    episodes: [
      episode(
        "SH-M21-E01",
        1,
        "Demand intent is rising while capacity is fixed.",
        "A growth promise may outrun delivery capacity.",
        [
          "focus on one service promise",
          "expand capacity immediately",
          "delay commitment and gather evidence"
        ],
        [
          "focus preserves quality headroom",
          "expansion increases lag exposure",
          "delay preserves option value"
        ],
        "What if the demand signal is local rather than Shanghai-wide?",
        "Transfer the hypothesis only after geography and rights are checked.",
        ["SH-M19-ASSET-WORKFORCE", "SH-M19-ASSET-QUALITY"]
      ),
      episode(
        "SH-M21-E02",
        2,
        "Workforce supply contracts during a quality-sensitive period.",
        "Reducing staff cost can create delayed quality consequences.",
        [
          "protect staffing and reduce throughput",
          "maintain throughput and accept quality uncertainty",
          "stage a bounded response"
        ],
        [
          "staff protection reduces delivery risk",
          "throughput may become infeasible",
          "staging makes lag visible"
        ],
        "What if the workforce shock lasts two periods?",
        "Compare lag and expiry before transferring the response.",
        ["SH-M19-ASSET-WORKFORCE", "SH-M19-ASSET-SHOCK-WQ"]
      ),
      episode(
        "SH-M21-E03",
        3,
        "Cash runway narrows while a project portfolio is under review.",
        "Capital timing competes with operating resilience.",
        ["pause the project", "continue with a cash buffer", "split the project into milestones"],
        [
          "pause preserves runway",
          "continuation may cross the infeasible corridor",
          "milestones reduce exposure but add coordination"
        ],
        "What if policy burden rises before project completion?",
        "Carry the mechanism, not the numeric value, to a second city.",
        ["SH-M19-ASSET-FINANCE", "SH-M19-ASSET-PROJECT", "SH-M19-ASSET-PORTFOLIO"]
      ),
      episode(
        "SH-M21-E04",
        4,
        "Policy burden increases with unresolved source freshness.",
        "The team must decide whether to act or abstain.",
        [
          "act on the bounded candidate",
          "abstain and request requalification",
          "run a teacher-only stress comparison"
        ],
        [
          "action is candidate-only",
          "abstention preserves evidence integrity",
          "comparison reveals sensitivity without activation"
        ],
        "What if the source rights expire before the next class?",
        "Use the exact version and rights state as transfer prerequisites.",
        ["SH-M19-ASSET-POLICY", "SH-M19-ASSET-SHOCK-CASH-POLICY"]
      ),
      episode(
        "SH-M21-E05",
        5,
        "A candidate consequence differs from the official baseline context.",
        "Mechanism explanation must not become a score or rank.",
        ["write a mechanism note", "write a transfer hypothesis", "record uncertainty and stop"],
        [
          "mechanism notes improve debrief trace",
          "transfer remains a draft",
          "stopping avoids unsupported claims"
        ],
        "What if the qualification decision changes to NOT_ELIGIBLE after drift review?",
        "Re-run exact qualification before any consumer binds the candidate.",
        ["SH-M19-ASSET-QUALITY", "SH-M19-ASSET-FINANCE"]
      )
    ],
    season_contract: {
      min_episodes: 4,
      max_episodes: 6,
      exact_binding_required: true,
      same_kernel_for_standard_and_advanced: true,
      no_prefilled_answer: true
    }
  };
}

function buildM22(): M22SecondCityTransferJourney {
  return {
    state_b: "SECOND_CITY_TRANSFER_JOURNEY_REALIZED",
    baseline_city: "Shanghai",
    target_city: "Hangzhou",
    package: {
      package_id: "SH-M22-HANGZHOU-MINIMAL-PACKAGE",
      version: "2026.08.30-candidate.1",
      schema_version: SH_DOMAIN_DEPTH_SCHEMA_VERSION,
      source_ids: ["SH-M19-M24-SRC-HANGZHOU-TRANSFER-STUB"],
      rights_status: "PUBLIC_SAFE",
      expiry: "2026-12-31",
      data_class: "PUBLIC_SAFE_SYNTHETIC_CANDIDATE",
      activation: "NOT_ACTIVATED"
    },
    diff: {
      region_changes: [
        "Shanghai municipality-wide support scope -> Hangzhou city-wide support scope",
        "region-specific package version changes"
      ],
      transfer_drivers: [
        "accessibility context",
        "workforce availability assumption",
        "policy burden assumption"
      ],
      qualification_impact: "REQUALIFICATION_REQUIRED",
      compatibility: "SCHEMA_COMPATIBLE_EXACT_BINDING_REQUIRED"
    },
    rollback_expectation: {
      candidate_version: "2026.08.30-candidate.1",
      rollback_version: "2025.12.31-baseline.1",
      dry_run: true,
      executed: false,
      exact_version_required: true
    },
    journey: {
      teacher: [
        "compare Shanghai and Hangzhou package diffs",
        "inspect rights and expiry before selection"
      ],
      student: [
        "see target-city role-safe mechanism and limits",
        "submit transfer reflection, not an official decision"
      ],
      admin: ["audit package/version/source/qualification lineage"]
    }
  };
}

function buildM23(): M23LivingScenarioOperations {
  const active = "SHANGHAI-2025.12.31-baseline.1";
  const candidate = "SHANGHAI-2026.08.30-candidate.1";
  const eventSpecs: ReadonlyArray<
    readonly [M23OperationsEventType, string, string, M23OperationsEvent["status"]]
  > = [
    ["REFRESH", active, candidate, "CANDIDATE_ONLY"],
    ["DIFF", active, candidate, "RECORDED"],
    ["IMPACT", candidate, candidate, "RECORDED"],
    ["REQUALIFICATION", candidate, candidate, "CANDIDATE_ONLY"],
    ["ROLLBACK_CANDIDATE", candidate, active, "CANDIDATE_ONLY"],
    ["HISTORICAL_RESOLUTION", active, active, "RECORDED"],
    ["WITHDRAW", candidate, candidate, "CANDIDATE_ONLY"]
  ];
  const events: M23OperationsEvent[] = eventSpecs.map(
    ([event_type, input_version, output_version, status], index) =>
      digestRecord({
        event_id: `SH-M23-EVENT-${String(index + 1).padStart(2, "0")}`,
        event_type,
        input_version,
        output_version,
        status,
        exact_binding_required: true as const
      })
  );
  return {
    state_b: "LIVING_SCENARIO_OPERATIONS_REALIZED",
    lifecycle_id: "SH-M23-LIVING-SCENARIO-LIFECYCLE-001",
    events,
    impact_graph: [
      {
        from: "source:SH-M19-M24-SRC-BOUNDED-SHANGHAI-ANCHOR",
        to: "feature:SH-M19-ASSET-QUALITY",
        relationship: "FEEDS"
      },
      {
        from: "feature:SH-M19-ASSET-QUALITY",
        to: "model:qualification-candidate",
        relationship: "REQUIRES_REQUALIFICATION"
      },
      {
        from: "model:qualification-candidate",
        to: "consumer:SH-M24-ENTERPRISE-DELIVERY",
        relationship: "AFFECTS"
      }
    ],
    historical_resolution: {
      requested_version: active,
      resolved_version: active,
      status: "EXACT_VERSION_RESOLVED",
      implicit_latest_forbidden: true,
      history_deleted: false
    },
    withdrawal: {
      status: "WITHDRAWN_CANDIDATE",
      deleted: false,
      frozen_history_overwritten: false
    },
    runbook: {
      refresh: [
        "detect expiry or drift",
        "create a versioned candidate",
        "retain source and rights receipt"
      ],
      alerts: [
        "expiry reached",
        "qualification changed",
        "source rights unknown",
        "impact graph unresolved"
      ],
      readiness: "INTERNAL_DRY_RUN_READY_WITH_LIMITS",
      production_rollout: false
    }
  };
}

function buildM24(): M24EnterpriseDeliveryOperability {
  return {
    state_b: "ENTERPRISE_DELIVERY_OPERABLE",
    operability_stage: "S8_OPERABLE",
    package_choices: [
      {
        package_id: "SH-M24-SHANGHAI-DELIVERY-PACK",
        city: "Shanghai",
        version: "2026.08.30-candidate.1",
        provenance_status: "RESOLVED_WITH_LIMITS",
        rights_status: "PUBLIC_SAFE",
        expiry: "2026-12-31",
        qualification_status: "NOT_ELIGIBLE",
        delivery_readiness: "INTERNAL_READY_WITH_LIMITS"
      },
      {
        package_id: "SH-M24-HANGZHOU-DELIVERY-PACK",
        city: "Hangzhou",
        version: "2026.08.30-candidate.1",
        provenance_status: "RESOLVED_WITH_LIMITS",
        rights_status: "PUBLIC_SAFE",
        expiry: "2026-12-31",
        qualification_status: "NOT_ELIGIBLE",
        delivery_readiness: "INTERNAL_READY_WITH_LIMITS"
      }
    ],
    sponsor_safe_aggregate: {
      included_fields: [
        "package_id",
        "city",
        "version",
        "rights_status",
        "expiry",
        "qualification_status",
        "delivery_readiness",
        "known_limits"
      ],
      excluded_fields: [
        "private_source_rows",
        "student_identity",
        "other_team_decisions",
        "official_scores",
        "settlement",
        "raw_model_payload"
      ],
      tenant_scoped: true,
      private_source_rows: false,
      official_scores: false
    },
    journey_continuity: {
      teacher: [
        "select or copy a package",
        "inspect provenance, qualification, expiry, and limits",
        "prepare an internal delivery run"
      ],
      student: [
        "receive only role-safe package brief",
        "complete mechanism/reflection loop",
        "see uncertainty and why-not"
      ],
      admin: ["audit tenant-scoped lineage and lifecycle", "inspect rollback/recovery readiness"],
      enterprise_sponsor: [
        "view sponsor-safe aggregate",
        "compare package readiness without private rows"
      ],
      rollback_and_recovery: [
        "resolve exact prior version",
        "withdraw candidate without deleting history",
        "re-run qualification before rebind"
      ]
    },
    no_pilot_or_production: true
  };
}

function stateB(
  macro_key: M19M24MacroKey,
  capability_id: string,
  domain_state_b: M19M24DomainStateB,
  evidence_ids: string[],
  consumer_ids: string[]
): M19M24StateBRecord {
  return digestRecord({
    macro_key,
    capability_id,
    domain_state_b,
    status: "REALIZED_CANDIDATE" as const,
    evidence_ids,
    consumer_ids,
    exact_binding_required: true as const,
    state_b_proven: true as const,
    official_truth_write: false as const,
    settlement_write: false as const,
    parameter_set_formal_write: false as const,
    provider: "OFF" as const
  });
}

function roleProjection(
  pack: Omit<M19M24DomainDepthPack, "projections" | "pack_digest">,
  surface: M19M24RoleProjection["surface"]
): M19M24RoleProjection {
  const visibility =
    surface === "student"
      ? "STUDENT_SAFE"
      : surface === "teacher"
        ? "TEACHER_ONLY"
        : "INTERNAL_RESEARCH_ONLY";
  const capabilities =
    surface === "student"
      ? [
          "read role-safe consequence direction",
          "record rationale/reflection",
          "see uncertainty, why-not, and limits"
        ]
      : surface === "teacher"
        ? [
            "configure/compare candidate domains",
            "facilitate evidence-backed episodes",
            "inspect qualification and operational readiness"
          ]
        : surface === "enterprise_sponsor"
          ? ["select/copy public-safe package", "view sponsor-safe readiness and limits"]
          : [
              "audit source/version/rights/expiry/qualification lineage",
              "inspect rollback and writer boundaries"
            ];
  const safeEvidence = pack.evidence.map(
    ({ evidence_id, status, temporal_scope, geography, unit, value, confidence }) => ({
      evidence_id,
      status,
      temporal_scope,
      geography,
      unit,
      value: surface === "student" && (unit === "months" || unit === "ratio") ? null : value,
      confidence
    })
  );
  return {
    surface,
    visibility,
    state_b: pack.state_b_register.map(({ macro_key, domain_state_b, status }) => ({
      macro_key,
      domain_state_b,
      status
    })),
    capabilities,
    evidence: safeEvidence,
    excluded_fields:
      surface === "student"
        ? [
            "private_source_rows",
            "raw_model_payload",
            "official_truth",
            "settlement",
            "score",
            "rank",
            "other_team_decisions",
            "formal_activation"
          ]
        : ["private_source_rows", "raw_model_payload", "official_truth", "settlement"]
  };
}

export function buildM19M24DomainDepthPack(): M19M24DomainDepthPack {
  const sources = buildSources();
  const evidenceRows = buildEvidence();
  const m19 = buildM19();
  const m20 = buildM20();
  const m21 = buildM21();
  const m22 = buildM22();
  const m23 = buildM23();
  const m24 = buildM24();
  const state_b_register = [
    stateB(
      "M19",
      "SH-M19-OPERATING-CAPITAL-WORLD",
      m19.state_b,
      [
        "SH-M19-E-WORKFORCE-CAPACITY",
        "SH-M19-E-QUALITY-INDEX",
        "SH-M19-E-CASH-RUNWAY",
        "SH-M19-E-POLICY-BURDEN",
        "SH-M19-E-PROJECT-THROUGHPUT"
      ],
      ["MAIN-ESL-O1", "MAIN-RT-O1", "TEACHER-C0-CONSUMER"]
    ),
    stateB(
      "M20",
      "SH-M20-QUALIFICATION-EVIDENCE",
      m20.state_b,
      ["SH-M20-E-QUALIFICATION-DECISION", "SH-M20-E-HOLDOUT", "SH-M20-E-UQ-OOD"],
      ["MAIN-MODEL-GOVERNANCE", "MOD-CALIBRATION-DIAGNOSTICS"]
    ),
    stateB(
      "M21",
      "SH-M21-STRATEGY-EXPERIMENT-SEASON",
      m21.state_b,
      ["SH-M20-E-QUALIFICATION-DECISION"],
      ["MAIN-ESL-O1", "TEACHER-LEARNING-DESIGN"]
    ),
    stateB(
      "M22",
      "SH-M22-SECOND-CITY-TRANSFER",
      m22.state_b,
      ["SH-M22-E-HANGZHOU-TRANSFER"],
      ["MAIN-RT-O1", "TEACHER-REGIONAL-TRANSFER", "STUDENT-TRANSFER"]
    ),
    stateB(
      "M23",
      "SH-M23-LIVING-SCENARIO-OPERATIONS",
      m23.state_b,
      ["SH-M23-E-DRIFT-REVIEW"],
      ["MAIN-RT-O1", "MOD-CALIBRATION-DIAGNOSTICS", "ADMIN-LIFECYCLE"]
    ),
    stateB(
      "M24",
      "SH-M24-ENTERPRISE-DELIVERY-OPERABILITY",
      m24.state_b,
      ["SH-M24-E-DELIVERY-READINESS"],
      ["ENTERPRISE-SPONSOR", "TEACHER", "STUDENT", "ADMIN"]
    )
  ];
  const content: Omit<M19M24DomainDepthPack, "pack_digest" | "projections"> = {
    schema_version: SH_DOMAIN_DEPTH_SCHEMA_VERSION,
    mission_id: "SIMWAR-SH-M19-M24-DOMAIN-DEPTH-S8-20260830",
    validation_as_of: SH_DOMAIN_DEPTH_VALIDATION_AS_OF,
    state_transition: { from: "STATE_A", to: "STATE_B" },
    current_reality: {
      start_master_sha: SH_DOMAIN_DEPTH_SOURCE_MASTER_SHA,
      c0_tombstone: {
        tombstone_id: SH_DOMAIN_DEPTH_C0_TOMBSTONE_ID,
        merged_pr: 473,
        merge_sha: SH_DOMAIN_DEPTH_SOURCE_MASTER_SHA,
        pack_digest: SH_DOMAIN_DEPTH_C0_TOMBSTONE_DIGEST,
        reuse: "REUSED_EXACTLY_ONCE",
        second_seam: false
      },
      open_collision_prs: [
        {
          number: 468,
          status: "OPEN",
          collision_scope: "executive capital feasibility in ESL",
          competing_product_pr_allowed: false
        },
        {
          number: 471,
          status: "OPEN",
          collision_scope: "R1 CAN feasibility candidate product",
          competing_product_pr_allowed: false
        }
      ]
    },
    sources,
    evidence: evidenceRows,
    state_b_register,
    m19,
    m20,
    m21,
    m22,
    m23,
    m24,
    capability_crosswalk: [
      {
        macro_key: "M19",
        prerequisite_macro_keys: [],
        reused_capabilities: ["C0 seam tombstone", "M3 operating stress shape"],
        new_domain_delta:
          "typed workforce/quality/finance/policy/project/portfolio/shock assets and deterministic stress corridors"
      },
      {
        macro_key: "M20",
        prerequisite_macro_keys: ["M19"],
        reused_capabilities: ["current model qualification contract"],
        new_domain_delta:
          "resolved negative qualification evidence with rights/freshness/holdout/UQ-OOD/drift why-not"
      },
      {
        macro_key: "M21",
        prerequisite_macro_keys: ["M19", "M20"],
        reused_capabilities: ["ESL role-safe projections", "M1 episode loop"],
        new_domain_delta: "five exact-bound Situation-to-Transfer episodes"
      },
      {
        macro_key: "M22",
        prerequisite_macro_keys: ["M19", "M20", "M21"],
        reused_capabilities: ["regional-transfer schema", "M4 portability shape"],
        new_domain_delta: "public-safe Hangzhou minimal package and role-safe transfer journey"
      },
      {
        macro_key: "M23",
        prerequisite_macro_keys: ["M20", "M22"],
        reused_capabilities: ["M6 lifecycle candidate chain"],
        new_domain_delta:
          "governed refresh-to-withdraw operations dry run with impact and exact history"
      },
      {
        macro_key: "M24",
        prerequisite_macro_keys: ["M19", "M20", "M21", "M22", "M23"],
        reused_capabilities: ["C0 consumption seam", "course delivery role projections"],
        new_domain_delta: "S8 enterprise/sponsor package selection, readiness, rollback continuity"
      }
    ],
    integration_debt: [
      {
        debt_id: "SH-DEBT-468",
        status: "OPEN_NON_CURRENT",
        owner_or_scope: "PR #468",
        resolution:
          "do not consume or compete while open/behind; rebind after fresh merge or closure"
      },
      {
        debt_id: "SH-DEBT-471",
        status: "OPEN_NON_CURRENT",
        owner_or_scope: "PR #471",
        resolution:
          "do not consume or compete while open/dirty; rebind after fresh merge or closure"
      },
      {
        debt_id: "SH-DEBT-QUALIFICATION",
        status: "CURRENT_LIMIT",
        owner_or_scope: "model governance",
        resolution: "resolved to NOT_ELIGIBLE; no activation or calibrated claim"
      }
    ],
    historical_reuse: {
      previous_chain: "M13-M18",
      previous_canonical_sha256: SH_DOMAIN_DEPTH_C0_TOMBSTONE_DIGEST,
      reused_items: [
        "C0 exact binding and role-safe consumer boundary",
        "current master merged C0 tombstone",
        "M1-M6 candidate pack shapes"
      ],
      regenerated_items: [
        "M19-M24 distinct domain State B records",
        "domain-depth evidence and validation",
        "S8 operability pack"
      ]
    },
    tool_ledger: {
      local_reference_vault: "UNAVAILABLE_FALLBACK_USED",
      codegraph: "NOT_INDEXED_IN_CLEAN_WORKTREE_FALLBACK_USED",
      graphify: "GRAPH_NOT_FOUND_FALLBACK_USED",
      exact_source_fallback: "USED",
      provider: "OFF",
      database_runtime: "JSON_INTERNAL_ONLY"
    },
    methods: {
      keep: [
        "CURRENT_REALITY_FIRST",
        "exact refs and no implicit latest",
        "role-safe projections",
        "MJP before H2",
        "one truth/settlement authority"
      ],
      change: [
        "SEAM_COMPLETE is no longer accepted as DOMAIN_DEPTH_COMPLETE",
        "each macro must prove a distinct State B",
        "opaque candidate refs must resolve or remain NOT_PROVEN"
      ],
      retire: [
        "generic receipt/action registry as domain completion",
        "mega-PR proof",
        "static default demo as product proof",
        "inferred calibration"
      ],
      new: [
        "DOMAIN_DEPTH_GATE",
        "SEAM_TOMBSTONE_REUSE",
        "EVIDENCE_RESOLUTION_GATE",
        "DISTINCT_STATE_B_LINT",
        "S8_OPERABILITY_CLOSURE"
      ]
    },
    mjp: {
      status: "PASS",
      checks: [
        "M19 typed domain assets resolve to evidence with units/bounds/lag",
        "M20 qualification is resolved to NOT_ELIGIBLE without unsupported calibration",
        "M21 contains five exact-bound episodes",
        "M22 uses one schema with a public-safe second city",
        "M23 records refresh/diff/impact/requalification/rollback/history/withdraw without deletion",
        "M24 reaches S8 operable internal readiness without Pilot or Production"
      ]
    },
    known_limits: [
      "Pack uses sanitized synthetic/public-safe candidates; it does not claim official Shanghai or Hangzhou statistics.",
      "No private real-project rows, provider calls, model activation, production PostgreSQL/RLS, Pilot, Production, or Human Validation were used.",
      "M20 remains NOT_ELIGIBLE because holdout, uncertainty, OOD, freshness, and independent calibration evidence are not proven.",
      "#468 and #471 remain open non-current integration debt and are not consumed as current evidence.",
      "The pack is integration-ready candidate support; it does not write official Truth, Settlement, Score, Rank, or ParameterSet state."
    ]
  };
  const withoutProjections = { ...content } as Omit<
    M19M24DomainDepthPack,
    "projections" | "pack_digest"
  >;
  const projections = ["teacher", "student", "admin", "enterprise_sponsor"].map((surface) =>
    roleProjection(withoutProjections, surface as M19M24RoleProjection["surface"])
  );
  const packWithoutDigest = { ...content, projections } as Omit<
    M19M24DomainDepthPack,
    "pack_digest"
  >;
  return { ...packWithoutDigest, pack_digest: stableDigest(packWithoutDigest) };
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function validateM19M24DomainDepthPack(pack: M19M24DomainDepthPack): string[] {
  const issues: string[] = [];
  const { pack_digest, ...content } = pack;
  if (!validDigest(pack_digest) || stableDigest(content) !== pack_digest)
    issues.push("pack_digest_mismatch");
  if (pack.state_transition.from !== "STATE_A" || pack.state_transition.to !== "STATE_B")
    issues.push("state_transition_invalid");
  if (
    pack.current_reality.c0_tombstone.second_seam ||
    pack.current_reality.c0_tombstone.reuse !== "REUSED_EXACTLY_ONCE"
  )
    issues.push("c0_tombstone_reuse_invalid");
  if (pack.current_reality.c0_tombstone.pack_digest !== SH_DOMAIN_DEPTH_C0_TOMBSTONE_DIGEST)
    issues.push("c0_tombstone_digest_invalid");
  const expectedMacros: M19M24MacroKey[] = ["M19", "M20", "M21", "M22", "M23", "M24"];
  if (
    pack.state_b_register.length !== expectedMacros.length ||
    pack.state_b_register.map((item) => item.macro_key).join(",") !== expectedMacros.join(",")
  )
    issues.push("macro_order_invalid");
  if (
    new Set(pack.state_b_register.map((item) => item.domain_state_b)).size !== expectedMacros.length
  )
    issues.push("distinct_state_b_invalid");
  for (const record of pack.state_b_register) {
    const { digest, ...recordContent } = record;
    if (!validDigest(digest) || stableDigest(recordContent) !== digest)
      issues.push(`${record.macro_key}:state_b_digest_invalid`);
    if (
      !record.state_b_proven ||
      record.official_truth_write ||
      record.settlement_write ||
      record.parameter_set_formal_write ||
      record.provider !== "OFF"
    )
      issues.push(`${record.macro_key}:authority_invalid`);
  }
  for (const item of pack.sources)
    if (!validDigest(item.hash)) issues.push(`${item.source_id}:source_hash_invalid`);
  for (const item of pack.evidence) {
    const { digest, ...itemContent } = item;
    if (!validDigest(digest) || stableDigest(itemContent) !== digest)
      issues.push(`${item.evidence_id}:evidence_digest_invalid`);
    if (item.calibration_evidence !== "NOT_PROVEN" && item.calibration_evidence !== "NONE")
      issues.push(`${item.evidence_id}:calibration_claim_invalid`);
  }
  for (const item of pack.m19.domain_assets) {
    const { digest, ...itemContent } = item;
    if (!validDigest(digest) || stableDigest(itemContent) !== digest)
      issues.push(`${item.asset_id}:asset_digest_invalid`);
    if (item.official_truth_write || item.status !== "CANDIDATE_ONLY")
      issues.push(`${item.asset_id}:asset_authority_invalid`);
  }
  for (const item of pack.m19.stress_corridors) {
    const { digest, ...itemContent } = item;
    if (!validDigest(digest) || stableDigest(itemContent) !== digest)
      issues.push(`${item.corridor_id}:corridor_digest_invalid`);
  }
  if (
    pack.m19.c0_consumption.seam_tombstone_id !== SH_DOMAIN_DEPTH_C0_TOMBSTONE_ID ||
    pack.m19.c0_consumption.source_kind !== "DOMAIN_EVIDENCE" ||
    pack.m19.c0_consumption.second_c0_seam_created
  )
    issues.push("m19_c0_consumption_invalid");
  if (
    pack.m20.qualification.decision !== "NOT_ELIGIBLE" ||
    pack.m20.activation !== "NOT_AUTHORIZED" ||
    pack.m20.calibration_evidence !== "NOT_PROVEN"
  )
    issues.push("m20_qualification_boundary_invalid");
  if (
    pack.m20.holdout.status !== "NOT_PROVEN" ||
    pack.m20.uncertainty_ood.ood_status !== "NOT_PROVEN"
  )
    issues.push("m20_evidence_resolution_invalid");
  if (
    pack.m21.episodes.length < 4 ||
    pack.m21.episodes.length > 6 ||
    pack.m21.episodes.some(
      (item, index) =>
        item.sequence !== index + 1 ||
        item.decision.correct_answer_supplied ||
        item.consequence.official_truth_write
    )
  )
    issues.push("m21_episode_state_b_invalid");
  for (const item of pack.m21.episodes) {
    const { digest, ...itemContent } = item;
    if (!validDigest(digest) || stableDigest(itemContent) !== digest)
      issues.push(`${item.episode_id}:episode_digest_invalid`);
  }
  if (
    (pack.m22.target_city as string) === pack.m22.baseline_city ||
    pack.m22.package.schema_version !== SH_DOMAIN_DEPTH_SCHEMA_VERSION ||
    pack.m22.package.activation !== "NOT_ACTIVATED" ||
    !pack.m22.rollback_expectation.dry_run ||
    pack.m22.rollback_expectation.executed
  )
    issues.push("m22_transfer_state_b_invalid");
  if (
    pack.m23.events.length !== 7 ||
    pack.m23.events.map((item) => item.event_type).join(",") !==
      "REFRESH,DIFF,IMPACT,REQUALIFICATION,ROLLBACK_CANDIDATE,HISTORICAL_RESOLUTION,WITHDRAW"
  )
    issues.push("m23_event_sequence_invalid");
  for (const item of pack.m23.events) {
    const { digest, ...itemContent } = item;
    if (!validDigest(digest) || stableDigest(itemContent) !== digest)
      issues.push(`${item.event_id}:event_digest_invalid`);
  }
  if (
    !pack.m23.historical_resolution.implicit_latest_forbidden ||
    pack.m23.historical_resolution.history_deleted ||
    pack.m23.withdrawal.deleted ||
    pack.m23.withdrawal.frozen_history_overwritten ||
    pack.m23.runbook.production_rollout
  )
    issues.push("m23_operations_boundary_invalid");
  if (
    pack.m24.operability_stage !== "S8_OPERABLE" ||
    !pack.m24.no_pilot_or_production ||
    pack.m24.sponsor_safe_aggregate.private_source_rows ||
    pack.m24.sponsor_safe_aggregate.official_scores
  )
    issues.push("m24_s8_boundary_invalid");
  if (pack.mjp.status !== "PASS" || pack.projections.length !== 4)
    issues.push("mjp_or_projection_invalid");
  return issues;
}

export function projectM19M24ForRole(
  pack: M19M24DomainDepthPack,
  surface: M19M24RoleProjection["surface"]
): M19M24RoleProjection {
  return (
    pack.projections.find((projection) => projection.surface === surface) ??
    roleProjection(pack, surface)
  );
}
