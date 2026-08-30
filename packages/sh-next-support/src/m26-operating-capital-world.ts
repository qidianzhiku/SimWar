import { stableDigest } from "./index.js";
import {
  buildM25PublicSourceRealityEvidenceEpochPack,
  validateM25PublicSourceRealityEvidenceEpochPack,
  type M25FeatureCandidate
} from "./m25-public-source-evidence.js";

export const M26_OPERATING_CAPITAL_SCHEMA_VERSION = "sh-operating-capital-world.v1" as const;
export const M26_SOURCE_MASTER_SHA = "e156cc4a6229aa1dddbd68f139f0724ab8647ce1" as const;
export const M26_MISSION_ID = "SIMWAR-SH-M26-SOURCE-BOUND-OPERATING-CAPITAL-WORLD" as const;

export interface M26OperatingCapitalAsset {
  asset_id: string;
  asset_type: "QUALITY" | "CARE_MIX" | "WORKFORCE";
  derived_from_feature_id: string;
  source_reality_class: "PUBLIC_SOURCE_BOUND";
  value: number;
  unit: string;
  bounds: { min: number; max: number | null };
  temporal_scope: string;
  geography: "Hangzhou";
  evidence_epoch_digest: string;
  hidden_manual_number: false;
  asset_digest: string;
}

export interface M26StressCorridor {
  corridor_id: string;
  asset_ids: string[];
  operating_pressure: "UNQUANTIFIED_CANDIDATE";
  capital_status: "NOT_COMPUTABLE";
  deterministic_rule: string;
  no_hidden_loop: true;
  corridor_digest: string;
}

export interface M26SourceBoundOperatingCapitalWorldPack {
  schema_version: typeof M26_OPERATING_CAPITAL_SCHEMA_VERSION;
  mission_id: typeof M26_MISSION_ID;
  state_a: {
    name: "STATIC_CANDIDATE_FIXTURES";
    limitation: string;
  };
  state_b: "SOURCE_BOUND_OPERATING_CAPITAL_WORLD_COMPILED";
  state_transition: { from: "STATE_A"; to: "STATE_B" };
  evidence_epoch_ref: {
    epoch_id: string;
    epoch_digest: string;
    source_epoch_base_sha: typeof M26_SOURCE_MASTER_SHA;
  };
  assets: M26OperatingCapitalAsset[];
  capital_evidence: {
    status: "MISSING";
    source_reality_class: "REFERENCE_ONLY";
    reason: string;
    numeric_value: null;
    hidden_manual_number: false;
  };
  stress_corridors: M26StressCorridor[];
  mod_can: {
    status: "CANDIDATE_ONLY";
    consumed_feature_ids: string[];
    diagnostics: string[];
    official_truth_write: false;
  };
  finance: {
    status: "NOT_COMPUTABLE";
    input_feature_ids: [];
    missing_evidence: string[];
    no_double_count: true;
  };
  double_count_guard: {
    pass: true;
    source_feature_uses: Record<string, 1>;
    rule: string;
  };
  role_visibility: {
    teacher: { visibility: "TEACHER_ONLY"; fields: string[] };
    student: { visibility: "STUDENT_SAFE"; fields: string[]; forbidden_fields: string[] };
    admin: { visibility: "INTERNAL_RESEARCH_ONLY"; fields: string[] };
  };
  recovery: {
    why_not: string[];
    revalidation: string[];
    rollback_candidate: true;
  };
  no_hidden_fallback: true;
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

function digestWithout(value: object, key: string): string {
  const copy = { ...value } as Record<string, unknown>;
  delete copy[key];
  return stableDigest(copy);
}

function asset(
  feature: M25FeatureCandidate,
  asset_type: M26OperatingCapitalAsset["asset_type"],
  epoch_digest: string
): M26OperatingCapitalAsset {
  if (typeof feature.value !== "number") throw new Error(`M26_FEATURE_NOT_NUMERIC:${feature.feature_id}`);
  const input: Omit<M26OperatingCapitalAsset, "asset_digest"> = {
    asset_id: `M26-ASSET-${asset_type}-${feature.feature_id}`,
    asset_type,
    derived_from_feature_id: feature.feature_id,
    source_reality_class: "PUBLIC_SOURCE_BOUND",
    value: feature.value,
    unit: feature.unit,
    bounds: feature.range as { min: number; max: number | null },
    temporal_scope: feature.temporal_scope,
    geography: "Hangzhou",
    evidence_epoch_digest: epoch_digest,
    hidden_manual_number: false
  };
  return { ...input, asset_digest: digestWithout(input, "asset_digest") };
}

function corridor(input: Omit<M26StressCorridor, "corridor_digest">): M26StressCorridor {
  return { ...input, corridor_digest: digestWithout(input, "corridor_digest") };
}

function requiredFeature(features: M25FeatureCandidate[], id: string): M25FeatureCandidate {
  const item = features.find((candidate) => candidate.feature_id === id);
  if (!item) throw new Error(`M26_FEATURE_MISSING:${id}`);
  return item;
}

export function buildM26SourceBoundOperatingCapitalWorldPack(): M26SourceBoundOperatingCapitalWorldPack {
  const m25 = buildM25PublicSourceRealityEvidenceEpochPack();
  const epoch_digest = m25.source_epoch.epoch_digest;
  const nursing = requiredFeature(m25.features, "HZ-M25-FEATURE-NURSING-BED-RATIO");
  const dementia = requiredFeature(m25.features, "HZ-M25-FEATURE-DEMENTIA-BEDS");
  const workforce = requiredFeature(m25.features, "HZ-M25-FEATURE-CARE-STAFF");
  const assets = [
    asset(nursing, "QUALITY", epoch_digest),
    asset(dementia, "CARE_MIX", epoch_digest),
    asset(workforce, "WORKFORCE", epoch_digest)
  ];
  const stress_corridors = [
    corridor({
      corridor_id: "M26-CORRIDOR-CARE-CAPACITY",
      asset_ids: assets.map((item) => item.asset_id),
      operating_pressure: "UNQUANTIFIED_CANDIDATE",
      capital_status: "NOT_COMPUTABLE",
      deterministic_rule: "Compare exact source-bound feature identities and units; do not convert a target into a demand, revenue, cash, or score result.",
      no_hidden_loop: true
    })
  ];
  const source_feature_uses: Record<string, 1> = Object.fromEntries(
    assets.map((item) => [item.derived_from_feature_id, 1])
  );
  const content: Omit<M26SourceBoundOperatingCapitalWorldPack, "pack_digest"> = {
    schema_version: M26_OPERATING_CAPITAL_SCHEMA_VERSION,
    mission_id: M26_MISSION_ID,
    state_a: {
      name: "STATIC_CANDIDATE_FIXTURES",
      limitation: "M19 assets and corridors were static candidate fixtures without a current public-source epoch binding or explicit capital evidence gap."
    },
    state_b: "SOURCE_BOUND_OPERATING_CAPITAL_WORLD_COMPILED",
    state_transition: { from: "STATE_A", to: "STATE_B" },
    evidence_epoch_ref: {
      epoch_id: m25.source_epoch.epoch_id,
      epoch_digest,
      source_epoch_base_sha: M26_SOURCE_MASTER_SHA
    },
    assets,
    capital_evidence: {
      status: "MISSING",
      source_reality_class: "REFERENCE_ONLY",
      reason: "No audited cash-flow, balance-sheet, or capital-availability observation is present in the public-source epoch.",
      numeric_value: null,
      hidden_manual_number: false
    },
    stress_corridors,
    mod_can: {
      status: "CANDIDATE_ONLY",
      consumed_feature_ids: assets.map((item) => item.derived_from_feature_id),
      diagnostics: [
        "CAN may consume the exact feature candidates as bounded care-capacity context.",
        "CAN must revalidate source digest, expiry, geography, unit, and target-vs-outcome scope before any consumer binding.",
        "CAN does not produce official Truth, Settlement, Score, Rank, or ParameterSet state."
      ],
      official_truth_write: false
    },
    finance: {
      status: "NOT_COMPUTABLE",
      input_feature_ids: [],
      missing_evidence: [
        "PUBLIC_SOURCE_BOUND care-capacity targets do not prove audited cash flow.",
        "No audited capital, revenue, cost, covenant, or runway observation is present."
      ],
      no_double_count: true
    },
    double_count_guard: {
      pass: true,
      source_feature_uses,
      rule: "Each source feature is consumed once by the operating candidate layer; finance receives no feature input and cannot double count operating evidence."
    },
    role_visibility: {
      teacher: {
        visibility: "TEACHER_ONLY",
        fields: ["assets", "capital_evidence", "stress_corridors", "double_count_guard", "recovery"]
      },
      student: {
        visibility: "STUDENT_SAFE",
        fields: ["bounded_feature_labels", "operating_pressure", "why_not"],
        forbidden_fields: ["private_finance_rows", "audited_cash_flow", "official_truth", "settlement", "score", "rank"]
      },
      admin: {
        visibility: "INTERNAL_RESEARCH_ONLY",
        fields: ["epoch_digest", "asset_digest", "capital_evidence", "revalidation", "rollback_candidate"]
      }
    },
    recovery: {
      why_not: [
        "PUBLIC_SOURCE_BOUND evidence does not prove audited cash flow",
        "A missing capital observation cannot be replaced by a synthetic production-like fallback",
        "Target-year policy values cannot be silently treated as current operating outcomes"
      ],
      revalidation: [
        "Re-fetch the exact official source before expiry.",
        "Confirm the feature unit and target-year scope before use.",
        "Recompute the epoch and world digests after any source change."
      ],
      rollback_candidate: true
    },
    no_hidden_fallback: true,
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
      "M26 consumes M25 public-source targets as candidate context and does not claim model calibration.",
      "Finance/capital feasibility is NOT_COMPUTABLE because audited capital evidence is missing.",
      "No operating loop, revenue, cash, score, rank, settlement, ParameterSet, Provider, PostgreSQL/RLS, Pilot, or Production state is produced.",
      "Formal regional-transfer consumer binding remains subject to PR #475 and exact current-source revalidation."
    ]
  };
  return { ...content, pack_digest: stableDigest(content) };
}

export function validateM26SourceBoundOperatingCapitalWorldPack(
  pack: M26SourceBoundOperatingCapitalWorldPack
): string[] {
  const issues: string[] = [];
  const { pack_digest, ...content } = pack;
  if (stableDigest(content) !== pack_digest) issues.push("pack_digest_mismatch");
  const m25 = buildM25PublicSourceRealityEvidenceEpochPack();
  issues.push(...validateM25PublicSourceRealityEvidenceEpochPack(m25).map((issue) => `m25_${issue}`));
  if (pack.evidence_epoch_ref.epoch_digest !== m25.source_epoch.epoch_digest)
    issues.push("evidence_epoch_digest_mismatch");
  if (pack.evidence_epoch_ref.source_epoch_base_sha !== M26_SOURCE_MASTER_SHA)
    issues.push("source_epoch_base_mismatch");
  const featureIds = new Set(m25.features.map((item) => item.feature_id));
  for (const item of pack.assets) {
    if (digestWithout(item, "asset_digest") !== item.asset_digest) issues.push("asset_digest_mismatch");
    if (item.source_reality_class !== "PUBLIC_SOURCE_BOUND") issues.push("asset_reality_class_invalid");
    if (!featureIds.has(item.derived_from_feature_id)) issues.push("asset_feature_missing");
    if (item.hidden_manual_number) issues.push("hidden_manual_number_forbidden");
    if (item.evidence_epoch_digest !== m25.source_epoch.epoch_digest) issues.push("asset_epoch_mismatch");
  }
  for (const item of pack.stress_corridors) {
    if (digestWithout(item, "corridor_digest") !== item.corridor_digest) issues.push("corridor_digest_mismatch");
    if (item.no_hidden_loop !== true || item.capital_status !== "NOT_COMPUTABLE") issues.push("hidden_loop_or_capital_status_invalid");
  }
  if (!pack.no_hidden_fallback) issues.push("hidden_fallback_forbidden");
  if (pack.finance.status !== "NOT_COMPUTABLE" || pack.finance.input_feature_ids.length !== 0)
    issues.push("finance_boundary_invalid");
  if (pack.finance.no_double_count !== true) issues.push("finance_double_count_invalid");
  if (!pack.double_count_guard.pass) issues.push("double_count_guard_failed");
  if (Object.values(pack.double_count_guard.source_feature_uses).some((count) => count !== 1))
    issues.push("feature_double_count_detected");
  if (pack.mod_can.status !== "CANDIDATE_ONLY" || pack.mod_can.official_truth_write)
    issues.push("mod_can_authority_invalid");
  if (pack.recovery.why_not.every((item) => item.length === 0)) issues.push("why_not_missing");
  if (
    pack.authority.official_truth_write ||
    pack.authority.settlement_write ||
    pack.authority.parameter_set_formal_write ||
    pack.authority.provider !== "OFF" ||
    pack.authority.second_truth_writer
  )
    issues.push("authority_boundary_invalid");
  if (pack.state_b !== "SOURCE_BOUND_OPERATING_CAPITAL_WORLD_COMPILED") issues.push("state_b_invalid");
  return [...new Set(issues)];
}
