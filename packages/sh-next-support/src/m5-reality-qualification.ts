import { stableDigest } from "./index.js";
import type {
  ExactRef,
  FeatureCandidate,
  Observation,
  SourceAsset,
  TransformationRecord
} from "./index.js";

export const M5_SOURCE_MASTER_SHA = "f3ee70712bbb2ff6f256bcfc007d56e0ee9bebf4" as const;
export const M5_SCHEMA_VERSION = "sh-next-reality-qualification.v1" as const;
export const M5_MISSION_ID =
  "SH-RT-NEXT-02-REALITY-QUALIFICATION-GOLDEN-HOLDOUT-OBSERVATORY" as const;
export const M5_VALIDATION_AS_OF = "2026-08-29" as const;

export type M5QualificationStatus = "READY" | "LIMITED" | "NOT_ELIGIBLE";
export type M5RealityDomain = "DEMAND" | "SPATIAL" | "OPS" | "FINANCE" | "CUSTOMER" | "BEHAVIOR";
export type M5DriftKind = "SOURCE" | "FEATURE" | "RANGE" | "MODEL" | "SCENARIO";

export interface M5QualificationGateInput {
  source_retrieved: boolean;
  rights_status: "PUBLIC_SAFE" | "INTERNAL_ONLY" | "UNKNOWN";
  conflict_count: number;
  required_domains: number;
  computed_domains: number;
  holdout_leakage_count: number;
  replay_only: boolean;
}

export interface M5SourceQualityAssessment {
  source_id: string;
  owner: string;
  license_status: "PUBLIC_REFERENCE_ONLY" | "UNKNOWN";
  freshness_status: "CURRENT" | "STALE" | "UNKNOWN";
  missingness_rate: number;
  unit_status: "DECLARED" | "MISSING";
  geography_status: "MATCHED" | "MISMATCH" | "UNKNOWN";
  conflict_count: number;
  privacy_status: "PUBLIC_SAFE" | "RESTRICTED";
  evidence_status: "VERIFIED" | "REFERENCE_ONLY" | "NOT_RETRIEVED";
  quality_status: "PASS" | "LIMITED" | "FAIL";
  expiry: string;
}

export interface M5ConflictRecord {
  conflict_id: string;
  source_ids: string[];
  observation_ids: string[];
  conflict_type: "SAME_PERIOD_DIFFERENT_VALUE" | "GEOGRAPHIC_SCOPE_MISMATCH";
  resolution: "PRESERVED_FOR_REVIEW";
  averaged_away: false;
  reason: string;
}

export interface M5EligibilityDecision {
  domain: M5RealityDomain;
  status: M5QualificationStatus;
  evidence_status: "VERIFIED" | "REFERENCE_ONLY" | "NOT_RETRIEVED";
  eligible_for_calibration: false;
  eligible_for_holdout: false;
  reasons: string[];
  expiry: string;
}

export interface M5StatusExample {
  qualification_id: string;
  scope: "REPLAY_ONLY" | "REFERENCE_CANDIDATE" | "CALIBRATION";
  status: M5QualificationStatus;
  claim_boundary: string;
}

export interface M5HoldoutEvidence {
  holdout_id: "SH-M5-HOLDOUT-TEMPORAL-SOURCE-PARTITION";
  partition_rule: "TEMPORAL_SOURCE_EXACT_PARTITION";
  training_observation_ids: string[];
  holdout_observation_ids: string[];
  overlap_keys: string[];
  leakage_count: number;
  leakage_ids: string[];
  leakage_proof: "EXACT_SOURCE_AND_PERIOD_PARTITION_NO_OVERLAP";
  status: "NOT_ELIGIBLE";
  known_limit: string;
}

export interface M5RGIResult {
  domain: M5RealityDomain;
  status: "NOT_COMPUTABLE";
  computable: false;
  value: null;
  evidence_status: "NOT_RETRIEVED";
  reason: string;
  source_ids: string[];
  expiry: string;
}

export interface M5GoldenReplayEvidence {
  golden_id: "SH-M5-GOLDEN-REFERENCE-REPLAY-V1";
  fixed_seed: 2026082905;
  input_digest: string;
  package_digest: string;
  expected_directions: string[];
  replay_status: "READY_FOR_REPLAY_ONLY";
  formal_result_overwritten: false;
  settlement_write: false;
  truth_hash_exclusion: string[];
  digest: string;
}

export interface M5DriftRecord {
  drift_id: string;
  drift_kind: M5DriftKind;
  subject_id: string;
  baseline_digest: string;
  current_digest: null;
  delta: null;
  status: "NO_CURRENT_EVIDENCE";
  impact_scope: string[];
  next_action: "M6_LIFECYCLE_REQUALIFICATION";
}

export interface M5RealityQualificationPack {
  schema_version: typeof M5_SCHEMA_VERSION;
  macro_key: "M5";
  mission_id: typeof M5_MISSION_ID;
  validation_as_of: typeof M5_VALIDATION_AS_OF;
  state_transition: { from: "STATE_A"; to: "STATE_B" };
  source_freeze: {
    status: "REFERENCE_ONLY_WITH_SYNTHETIC_FALLBACK";
    official_source_retrieval: "NOT_RETRIEVED";
    unsupported_claims_are_facts: false;
  };
  sources: SourceAsset[];
  source_quality: M5SourceQualityAssessment[];
  observations: Observation[];
  features: FeatureCandidate[];
  transformations: TransformationRecord[];
  conflict_ledger: M5ConflictRecord[];
  eligibility: M5EligibilityDecision[];
  status_examples: M5StatusExample[];
  holdout: M5HoldoutEvidence;
  rgi: M5RGIResult[];
  golden_replay: M5GoldenReplayEvidence;
  drift_ledger: M5DriftRecord[];
  replay: {
    input_digest: string;
    algorithm: "DETERMINISTIC_QUALIFICATION_REPLAY_V1";
    formal_result_overwritten: false;
    truth_hash_exclusion: string[];
  };
  overall_status: "NOT_ELIGIBLE";
  role_visibility: {
    teacher: { visibility: "TEACHER_ONLY"; fields: string[] };
    student: { visibility: "STUDENT_SAFE"; fields: string[]; forbidden_fields: string[] };
    admin: { visibility: "INTERNAL_RESEARCH_ONLY"; fields: string[] };
  };
  consumer: {
    classification: "C1";
    consumer_ids: [
      "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION",
      "MOD-CALIBRATION-DIAGNOSTICS",
      "FE-KNOWN-LIMITS"
    ];
    consumer_ready: false;
    formal_join: false;
    exact_binding_required: true;
  };
  authority: {
    candidate_writer: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER";
    official_truth_write: false;
    settlement_write: false;
    parameter_set_formal_write: false;
    provider: "OFF";
    runtime_authority: "JSON_INTERNAL_ONLY";
  };
  mjp: { status: "PASS"; qualification_cycle_id: string; checks: string[] };
  main_handoff: {
    status: "JOIN_WITH_LIMITS";
    required_consumer_action: "PROVE_C0_SOURCE_CONTRACT_SEAM";
    exact_refs: ExactRef[];
  };
  known_limits: string[];
  pack_digest: string;
}

const M5_DOMAINS: readonly M5RealityDomain[] = [
  "DEMAND",
  "SPATIAL",
  "OPS",
  "FINANCE",
  "CUSTOMER",
  "BEHAVIOR"
];

const M5_REFS = {
  priorPortability: exactRef(
    "CONTRACT",
    "sh-next-portability.v1",
    "contracts/schemas/sh-next-portability.v1.json",
    "EXACT_SOURCE_READBACK"
  ),
  qualificationSource: exactRef(
    "CODE",
    "sh-next-reality-qualification.v1",
    "packages/sh-next-support/src/m5-reality-qualification.ts",
    "REFERENCE_ONLY"
  ),
  qualificationTests: exactRef(
    "TEST",
    "m5-reality-qualification-tests",
    "tests/sh-next-support/m5-reality-qualification.test.ts",
    "REFERENCE_ONLY"
  )
} as const;

function exactRef(
  ref_type: ExactRef["ref_type"],
  ref_id: string,
  path_or_uri: string,
  readback_status: ExactRef["readback_status"]
): ExactRef {
  return {
    ref_type,
    ref_id,
    path_or_uri,
    revision: M5_SOURCE_MASTER_SHA,
    digest: stableDigest({ ref_id, path_or_uri, revision: M5_SOURCE_MASTER_SHA }),
    readback_status
  };
}

function source(input: Omit<SourceAsset, "hash">): SourceAsset {
  return { ...input, hash: stableDigest(input) };
}

function createSources(): SourceAsset[] {
  const definitions = [
    ["STATISTICS", "Shanghai Statistics public reference shape"],
    ["CIVIL-AFFAIRS", "Shanghai civil-affairs public reference shape"],
    ["PLANNING", "Shanghai planning public reference shape"],
    ["TRANSPORT", "Shanghai transport public reference shape"],
    ["MEDICAL", "Shanghai medical-access public reference shape"],
    ["POLICY", "Shanghai policy public reference shape"]
  ] as const;
  return definitions.map(([suffix, description]) =>
    source({
      source_id: `SH-M5-SRC-${suffix}-REFERENCE`,
      source_type: "PUBLIC_DOCUMENT",
      source_date: "2025-12-31",
      geography: "Shanghai",
      time_scope: "2025",
      provenance: `bounded public-source reference metadata: ${description}; release was not retrieved in this run`,
      license_or_usage_status: "PUBLIC_REFERENCE_ONLY",
      confidence: "NOT_ESTABLISHED",
      sensitivity: "PUBLIC",
      role_visibility: "STUDENT_SAFE",
      derived_from: ["M4-portability-candidate", "M5-question-first-source-freeze"],
      evidence_status: "NOT_RETRIEVED",
      content_basis:
        "source shape and governance metadata only; no official value, person, organization, or private record"
    })
  );
}

function createObservations(sources: SourceAsset[]): Observation[] {
  const sourceBySuffix = (suffix: string) =>
    sources.find((item) => item.source_id.endsWith(`${suffix}-REFERENCE`))?.source_id ??
    "MISSING_SOURCE";
  return [
    {
      observation_id: "SH-M5-OBS-DEMAND-A",
      source_id: sourceBySuffix("STATISTICS"),
      location: "Shanghai-public-scope",
      period: "2025",
      basis: "synthetic_conflict_fixture_from_reference_shape",
      unit: "index_points",
      geography: "Shanghai",
      data_type: "STRESS_TEST",
      value: 0.61,
      confidence: "NOT_ESTABLISHED",
      sensitivity: "PUBLIC",
      observation_status: "CONFLICT",
      expiry: "2027-12-31"
    },
    {
      observation_id: "SH-M5-OBS-DEMAND-B",
      source_id: sourceBySuffix("CIVIL-AFFAIRS"),
      location: "Shanghai-public-scope",
      period: "2025",
      basis: "synthetic_conflict_fixture_from_reference_shape",
      unit: "index_points",
      geography: "Shanghai",
      data_type: "STRESS_TEST",
      value: 0.67,
      confidence: "NOT_ESTABLISHED",
      sensitivity: "PUBLIC",
      observation_status: "CONFLICT",
      expiry: "2027-12-31"
    },
    {
      observation_id: "SH-M5-OBS-SPATIAL",
      source_id: sourceBySuffix("TRANSPORT"),
      location: "Shanghai-public-scope",
      period: "2025",
      basis: "bounded_reference_shape_no_release_readback",
      unit: "minutes",
      geography: "Shanghai",
      data_type: "ASSUMPTION",
      value: "UNKNOWN",
      confidence: "NOT_ESTABLISHED",
      sensitivity: "PUBLIC",
      observation_status: "UNKNOWN",
      expiry: "2027-12-31"
    },
    {
      observation_id: "SH-M5-OBS-OPS",
      source_id: sourceBySuffix("CIVIL-AFFAIRS"),
      location: "Shanghai-public-scope",
      period: "2025",
      basis: "bounded_reference_shape_no_release_readback",
      unit: "capacity_ratio",
      geography: "Shanghai",
      data_type: "ASSUMPTION",
      value: "UNKNOWN",
      confidence: "NOT_ESTABLISHED",
      sensitivity: "PUBLIC",
      observation_status: "UNKNOWN",
      expiry: "2027-12-31"
    },
    {
      observation_id: "SH-M5-OBS-FINANCE",
      source_id: sourceBySuffix("STATISTICS"),
      location: "Shanghai-public-scope",
      period: "2025",
      basis: "bounded_reference_shape_no_release_readback",
      unit: "CNY_million",
      geography: "Shanghai",
      data_type: "ASSUMPTION",
      value: "UNKNOWN",
      confidence: "NOT_ESTABLISHED",
      sensitivity: "PUBLIC",
      observation_status: "UNKNOWN",
      expiry: "2027-12-31"
    },
    {
      observation_id: "SH-M5-OBS-CUSTOMER",
      source_id: sourceBySuffix("MEDICAL"),
      location: "Shanghai-public-scope",
      period: "2025",
      basis: "bounded_reference_shape_no_release_readback",
      unit: "index_points",
      geography: "Shanghai",
      data_type: "ASSUMPTION",
      value: "UNKNOWN",
      confidence: "NOT_ESTABLISHED",
      sensitivity: "PUBLIC",
      observation_status: "UNKNOWN",
      expiry: "2027-12-31"
    },
    {
      observation_id: "SH-M5-OBS-BEHAVIOR",
      source_id: sourceBySuffix("POLICY"),
      location: "Shanghai-public-scope",
      period: "2025",
      basis: "bounded_reference_shape_no_release_readback",
      unit: "index_points",
      geography: "Shanghai",
      data_type: "ASSUMPTION",
      value: "UNKNOWN",
      confidence: "NOT_ESTABLISHED",
      sensitivity: "PUBLIC",
      observation_status: "UNKNOWN",
      expiry: "2027-12-31"
    }
  ];
}

function createFeatures(sources: SourceAsset[]): FeatureCandidate[] {
  const sourceId = (suffix: string) =>
    sources.find((item) => item.source_id.endsWith(`${suffix}-REFERENCE`))?.source_id ??
    "MISSING_SOURCE";
  const definitions: ReadonlyArray<readonly [M5RealityDomain, string, string, string[]]> = [
    [
      "DEMAND",
      "demand_pressure_candidate",
      "index_points",
      [sourceId("STATISTICS"), sourceId("CIVIL-AFFAIRS")]
    ],
    ["SPATIAL", "spatial_accessibility_candidate", "minutes", [sourceId("TRANSPORT")]],
    ["OPS", "operations_capacity_candidate", "capacity_ratio", [sourceId("CIVIL-AFFAIRS")]],
    ["FINANCE", "finance_headroom_candidate", "CNY_million", [sourceId("STATISTICS")]],
    ["CUSTOMER", "customer_service_candidate", "index_points", [sourceId("MEDICAL")]],
    ["BEHAVIOR", "behavior_response_candidate", "index_points", [sourceId("POLICY")]]
  ];
  return definitions.map(([domain, name, unit, source_ids]) => ({
    feature_id: `SH-M5-FEATURE-${domain}`,
    name,
    value: "UNKNOWN",
    unit,
    range: { min: null, max: null },
    source_ids,
    temporal_scope: "2025",
    geography: "Shanghai",
    confidence: "NOT_ESTABLISHED",
    possible_mod_consumer: "MOD-CALIBRATION-DIAGNOSTICS / reality-gap-input",
    calibration_evidence: "NONE",
    visibility: "TEACHER_ONLY"
  }));
}

function createQuality(sources: SourceAsset[]): M5SourceQualityAssessment[] {
  return sources.map((item) => ({
    source_id: item.source_id,
    owner: "PUBLIC_SOURCE_OWNER_NOT_RETRIEVED",
    license_status: "PUBLIC_REFERENCE_ONLY",
    freshness_status: "UNKNOWN",
    missingness_rate: 1,
    unit_status: "MISSING",
    geography_status: "UNKNOWN",
    conflict_count:
      item.source_id.includes("STATISTICS") || item.source_id.includes("CIVIL") ? 1 : 0,
    privacy_status: "PUBLIC_SAFE",
    evidence_status: "NOT_RETRIEVED",
    quality_status: "LIMITED",
    expiry: "2027-12-31"
  }));
}

type HoldoutLeakage = {
  overlap_keys: string[];
  leakage_ids: string[];
  missing_observation_ids: string[];
};

function holdoutKey(observation: Observation): string {
  return `${observation.source_id}:${observation.period}`;
}

function computeHoldoutLeakage(
  observations: Observation[],
  holdout: Pick<M5HoldoutEvidence, "training_observation_ids" | "holdout_observation_ids">
): HoldoutLeakage {
  const byId = new Map(observations.map((item) => [item.observation_id, item]));
  const missing_observation_ids: string[] = [];
  const collect = (ids: string[]) => {
    const byKey = new Map<string, string[]>();
    for (const id of ids) {
      const observation = byId.get(id);
      if (!observation) {
        missing_observation_ids.push(id);
        continue;
      }
      const idsForKey = byKey.get(holdoutKey(observation)) ?? [];
      idsForKey.push(id);
      byKey.set(holdoutKey(observation), idsForKey);
    }
    return byKey;
  };
  const trainingByKey = collect(holdout.training_observation_ids);
  const holdoutByKey = collect(holdout.holdout_observation_ids);
  const overlap_keys = [...trainingByKey.keys()].filter((key) => holdoutByKey.has(key)).sort();
  const leakage_ids = overlap_keys
    .flatMap((key) => [...(trainingByKey.get(key) ?? []), ...(holdoutByKey.get(key) ?? [])])
    .sort();
  return {
    overlap_keys,
    leakage_ids,
    missing_observation_ids: [...new Set(missing_observation_ids)].sort()
  };
}

function createHoldout(observations: Observation[], holdoutSourceId: string): M5HoldoutEvidence {
  const training_observation_ids = observations
    .filter((item) => item.source_id !== holdoutSourceId)
    .map((item) => item.observation_id);
  const holdout_observation_ids = observations
    .filter((item) => item.source_id === holdoutSourceId)
    .map((item) => item.observation_id);
  const leakage = computeHoldoutLeakage(observations, {
    training_observation_ids,
    holdout_observation_ids
  });
  return {
    holdout_id: "SH-M5-HOLDOUT-TEMPORAL-SOURCE-PARTITION",
    partition_rule: "TEMPORAL_SOURCE_EXACT_PARTITION",
    training_observation_ids,
    holdout_observation_ids,
    overlap_keys: leakage.overlap_keys,
    leakage_count: leakage.overlap_keys.length,
    leakage_ids: leakage.leakage_ids,
    leakage_proof: "EXACT_SOURCE_AND_PERIOD_PARTITION_NO_OVERLAP",
    status: "NOT_ELIGIBLE",
    known_limit:
      "The partition proves no leakage in the candidate ledger; it does not create missing real-world evidence."
  };
}

function replayInputFor(
  pack: Pick<
    M5RealityQualificationPack,
    | "sources"
    | "source_quality"
    | "observations"
    | "features"
    | "transformations"
    | "conflict_ledger"
    | "eligibility"
    | "holdout"
    | "rgi"
    | "drift_ledger"
  >
) {
  return {
    algorithm: "DETERMINISTIC_QUALIFICATION_REPLAY_V1" as const,
    fixed_seed: 2026082905 as const,
    sources: pack.sources,
    source_quality: pack.source_quality,
    observations: pack.observations,
    features: pack.features,
    transformations: pack.transformations,
    conflict_ledger: pack.conflict_ledger,
    eligibility: pack.eligibility,
    holdout: pack.holdout,
    rgi: pack.rgi,
    drift_ledger: pack.drift_ledger
  };
}

function packageDigestFor(
  pack: Pick<
    M5RealityQualificationPack,
    | "schema_version"
    | "sources"
    | "source_quality"
    | "observations"
    | "features"
    | "transformations"
    | "conflict_ledger"
    | "eligibility"
    | "holdout"
    | "rgi"
    | "drift_ledger"
  >
): string {
  return stableDigest({
    schema_version: pack.schema_version,
    sources: pack.sources,
    source_quality: pack.source_quality,
    observations: pack.observations,
    features: pack.features,
    transformations: pack.transformations,
    conflict_ledger: pack.conflict_ledger,
    eligibility: pack.eligibility,
    holdout: pack.holdout,
    rgi: pack.rgi,
    drift_ledger: pack.drift_ledger
  });
}

export function classifyM5Qualification(input: M5QualificationGateInput): M5QualificationStatus {
  if (input.holdout_leakage_count > 0) return "NOT_ELIGIBLE";
  if (input.replay_only) return "READY";
  if (!input.source_retrieved || input.rights_status !== "PUBLIC_SAFE") return "NOT_ELIGIBLE";
  if (input.conflict_count > 0 || input.computed_domains < input.required_domains) return "LIMITED";
  return "READY";
}

function createEligibility(): M5EligibilityDecision[] {
  return M5_DOMAINS.map((domain) => ({
    domain,
    status: "NOT_ELIGIBLE" as const,
    evidence_status: "NOT_RETRIEVED" as const,
    eligible_for_calibration: false as const,
    eligible_for_holdout: false as const,
    reasons: [
      "current public release was not retrieved in this bounded run",
      "evidence is reference-only or unknown",
      "no calibration claim may be emitted"
    ],
    expiry: "2027-12-31"
  }));
}

function createRGI(sources: SourceAsset[]): M5RGIResult[] {
  const source_ids = sources.map((item) => item.source_id);
  return M5_DOMAINS.map((domain) => ({
    domain,
    status: "NOT_COMPUTABLE" as const,
    computable: false as const,
    value: null,
    evidence_status: "NOT_RETRIEVED" as const,
    reason: "no domain has sufficient retrieved public evidence for a computable RealityGap value",
    source_ids,
    expiry: "2027-12-31"
  }));
}

function createDriftLedger(): M5DriftRecord[] {
  return (
    [
      ["SOURCE", "M5-source-freeze"],
      ["FEATURE", "SH-M5-FEATURE-DEMAND"],
      ["RANGE", "SH-M5-FEATURE-RANGE-SET"],
      ["MODEL", "toy_logit_wellness_v1"],
      ["SCENARIO", "sh-m4-scenario-shanghai"]
    ] as const
  ).map(([drift_kind, subject_id]) => ({
    drift_id: `SH-M5-DRIFT-${drift_kind}`,
    drift_kind,
    subject_id,
    baseline_digest: stableDigest({ drift_kind, subject_id, baseline: "REFERENCE_ONLY" }),
    current_digest: null,
    delta: null,
    status: "NO_CURRENT_EVIDENCE" as const,
    impact_scope: ["MAIN-RT", "MOD-CALIBRATION-DIAGNOSTICS", "FE-KNOWN-LIMITS"],
    next_action: "M6_LIFECYCLE_REQUALIFICATION" as const
  }));
}

export function buildM5RealityQualificationPack(): M5RealityQualificationPack {
  const sources = createSources();
  const observations = createObservations(sources);
  const features = createFeatures(sources);
  const observationByDomain: Record<M5RealityDomain, string[]> = {
    DEMAND: ["SH-M5-OBS-DEMAND-A", "SH-M5-OBS-DEMAND-B"],
    SPATIAL: ["SH-M5-OBS-SPATIAL"],
    OPS: ["SH-M5-OBS-OPS"],
    FINANCE: ["SH-M5-OBS-FINANCE"],
    CUSTOMER: ["SH-M5-OBS-CUSTOMER"],
    BEHAVIOR: ["SH-M5-OBS-BEHAVIOR"]
  };
  const transformations: TransformationRecord[] = features.map((feature, index) => {
    const domain = M5_DOMAINS[index]!;
    return {
      transformation_id: `SH-M5-TRANSFORM-${domain}`,
      input: observationByDomain[domain],
      rule: "preserve conflict or unknown state; emit UNKNOWN feature without extrapolation",
      assumption: "unretrieved public-source shape is not an official measurement",
      output: feature.feature_id,
      unit: feature.unit,
      time_scope: feature.temporal_scope,
      geography: feature.geography,
      confidence: feature.confidence,
      provenance: feature.source_ids.join(",")
    };
  });
  const conflict_ledger: M5ConflictRecord[] = [
    {
      conflict_id: "SH-M5-CONFLICT-DEMAND-2025",
      source_ids: [sources[0]!.source_id, sources[1]!.source_id],
      observation_ids: ["SH-M5-OBS-DEMAND-A", "SH-M5-OBS-DEMAND-B"],
      conflict_type: "SAME_PERIOD_DIFFERENT_VALUE",
      resolution: "PRESERVED_FOR_REVIEW",
      averaged_away: false,
      reason:
        "two bounded candidate values are retained as a conflict fixture; no silent average or winner is selected"
    }
  ];
  const source_quality = createQuality(sources);
  const eligibility = createEligibility();
  const rgi = createRGI(sources);
  const drift_ledger = createDriftLedger();
  const holdoutSourceId = sources.find((item) =>
    item.source_id.includes("CIVIL-AFFAIRS")
  )?.source_id;
  if (!holdoutSourceId) throw new Error("M5_HOLDOUT_SOURCE_NOT_FOUND");
  const holdout = createHoldout(observations, holdoutSourceId);
  const replayInput = replayInputFor({
    sources,
    source_quality,
    observations,
    features,
    transformations,
    conflict_ledger,
    eligibility,
    holdout,
    rgi,
    drift_ledger
  });
  const package_digest = packageDigestFor({
    schema_version: M5_SCHEMA_VERSION,
    sources,
    source_quality,
    observations,
    features,
    transformations,
    conflict_ledger,
    eligibility,
    holdout,
    rgi,
    drift_ledger
  });
  const goldenContent = {
    golden_id: "SH-M5-GOLDEN-REFERENCE-REPLAY-V1" as const,
    fixed_seed: 2026082905 as const,
    input_digest: stableDigest(replayInput),
    package_digest,
    expected_directions: [
      "conflicted demand remains UNKNOWN for qualification",
      "unretrieved domain evidence does not produce a RealityGap value",
      "replay candidate does not overwrite formal result"
    ],
    replay_status: "READY_FOR_REPLAY_ONLY" as const,
    formal_result_overwritten: false as const,
    settlement_write: false as const,
    truth_hash_exclusion: [
      "qualification_candidate",
      "source_quality",
      "conflict_ledger",
      "rgi_candidate"
    ]
  };
  const golden_replay = { ...goldenContent, digest: stableDigest(goldenContent) };
  const replay = {
    input_digest: golden_replay.input_digest,
    algorithm: "DETERMINISTIC_QUALIFICATION_REPLAY_V1" as const,
    formal_result_overwritten: false as const,
    truth_hash_exclusion: [
      "qualification_candidate",
      "source_quality",
      "conflict_ledger",
      "rgi_candidate"
    ]
  };
  const packWithoutDigest: Omit<M5RealityQualificationPack, "pack_digest"> = {
    schema_version: M5_SCHEMA_VERSION,
    macro_key: "M5",
    mission_id: M5_MISSION_ID,
    validation_as_of: M5_VALIDATION_AS_OF,
    state_transition: { from: "STATE_A", to: "STATE_B" },
    source_freeze: {
      status: "REFERENCE_ONLY_WITH_SYNTHETIC_FALLBACK",
      official_source_retrieval: "NOT_RETRIEVED",
      unsupported_claims_are_facts: false
    },
    sources,
    source_quality,
    observations,
    features,
    transformations,
    conflict_ledger,
    eligibility,
    status_examples: [
      {
        qualification_id: "SH-M5-STATUS-REPLAY",
        scope: "REPLAY_ONLY",
        status: classifyM5Qualification({
          source_retrieved: false,
          rights_status: "PUBLIC_SAFE",
          conflict_count: 0,
          required_domains: 0,
          computed_domains: 0,
          holdout_leakage_count: 0,
          replay_only: true
        }),
        claim_boundary: "ready only to replay the deterministic candidate; not calibration-ready"
      },
      {
        qualification_id: "SH-M5-STATUS-REFERENCE",
        scope: "REFERENCE_CANDIDATE",
        status: classifyM5Qualification({
          source_retrieved: true,
          rights_status: "PUBLIC_SAFE",
          conflict_count: 1,
          required_domains: 6,
          computed_domains: 2,
          holdout_leakage_count: 0,
          replay_only: false
        }),
        claim_boundary: "limited candidate evidence; unresolved conflict and missing domains remain"
      },
      {
        qualification_id: "SH-M5-STATUS-PUBLIC-CALIBRATION",
        scope: "CALIBRATION",
        status: classifyM5Qualification({
          source_retrieved: false,
          rights_status: "PUBLIC_SAFE",
          conflict_count: 1,
          required_domains: 6,
          computed_domains: 0,
          holdout_leakage_count: 0,
          replay_only: false
        }),
        claim_boundary: "not eligible because current public evidence was not retrieved"
      }
    ],
    holdout,
    rgi,
    golden_replay,
    drift_ledger,
    replay,
    overall_status: "NOT_ELIGIBLE",
    role_visibility: {
      teacher: {
        visibility: "TEACHER_ONLY",
        fields: [
          "source_quality",
          "conflict_ledger",
          "eligibility",
          "holdout",
          "rgi",
          "drift_ledger",
          "known_limits"
        ]
      },
      student: {
        visibility: "STUDENT_SAFE",
        fields: ["bounded_feature_directions", "qualification_status", "replay_direction"],
        forbidden_fields: [
          "private_truth",
          "official_calibration",
          "formal_settlement",
          "final_rank",
          "restricted_source"
        ]
      },
      admin: {
        visibility: "INTERNAL_RESEARCH_ONLY",
        fields: ["source_hashes", "input_digest", "package_digest", "resolution_limits"]
      }
    },
    consumer: {
      classification: "C1",
      consumer_ids: [
        "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION",
        "MOD-CALIBRATION-DIAGNOSTICS",
        "FE-KNOWN-LIMITS"
      ],
      consumer_ready: false,
      formal_join: false,
      exact_binding_required: true
    },
    authority: {
      candidate_writer: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER",
      official_truth_write: false,
      settlement_write: false,
      parameter_set_formal_write: false,
      provider: "OFF",
      runtime_authority: "JSON_INTERNAL_ONLY"
    },
    mjp: {
      status: "PASS",
      qualification_cycle_id: "SH-M5-QUALIFICATION-CYCLE-REFERENCE-2025",
      checks: [
        "mechanical READY/LIMITED/NOT_ELIGIBLE classifier is exercised",
        "conflict ledger preserves incompatible candidate observations",
        "holdout leakage is zero by exact source and period partition",
        "unsupported RGI domains remain non-computable",
        "fixed-seed Golden/Replay evidence is non-overwriting"
      ]
    },
    main_handoff: {
      status: "JOIN_WITH_LIMITS",
      required_consumer_action: "PROVE_C0_SOURCE_CONTRACT_SEAM",
      exact_refs: [
        M5_REFS.priorPortability,
        M5_REFS.qualificationSource,
        M5_REFS.qualificationTests
      ]
    },
    known_limits: [
      "Official public releases were not retrieved in this bounded run; all sources are reference-only or synthetic conflict fixtures.",
      "overall_status is NOT_ELIGIBLE for calibration and no MODEL_CALIBRATED claim is emitted.",
      "READY applies only to deterministic replay scope; LIMITED applies only to bounded reference candidate scope.",
      "RGI/RealityGap values are not computed when domain evidence is absent or conflicted.",
      "No current MAIN-RT C0 seam was proven; formal join remains pending and no runtime writer is added."
    ]
  };
  return { ...packWithoutDigest, pack_digest: stableDigest(packWithoutDigest) };
}

export function validateM5RealityQualification(pack: M5RealityQualificationPack): string[] {
  const issues: string[] = [];
  const { pack_digest, ...content } = pack;
  if (stableDigest(content) !== pack_digest) issues.push("m5_pack_digest_mismatch");
  if (pack.overall_status !== "NOT_ELIGIBLE") issues.push("m5_overall_status_overclaim");
  if (pack.eligibility.length !== M5_DOMAINS.length)
    issues.push("m5_eligibility_domain_count_invalid");
  if (new Set(pack.eligibility.map((item) => item.domain)).size !== M5_DOMAINS.length)
    issues.push("m5_eligibility_domain_set_invalid");
  if (pack.sources.some((item) => !/^[a-f0-9]{64}$/.test(item.hash)))
    issues.push("m5_source_hash_invalid");
  if (
    pack.conflict_ledger.some(
      (item) => item.resolution !== "PRESERVED_FOR_REVIEW" || item.averaged_away
    )
  )
    issues.push("m5_conflict_resolution_invalid");
  if (pack.eligibility.some((item) => item.eligible_for_calibration || item.eligible_for_holdout))
    issues.push("m5_calibration_eligibility_claim_invalid");
  const holdoutLeakage = computeHoldoutLeakage(pack.observations, pack.holdout);
  if (holdoutLeakage.missing_observation_ids.length > 0)
    issues.push("m5_holdout_observation_reference_invalid");
  if (
    holdoutLeakage.overlap_keys.length !== pack.holdout.overlap_keys.length ||
    holdoutLeakage.overlap_keys.some((key, index) => key !== pack.holdout.overlap_keys[index]) ||
    holdoutLeakage.leakage_ids.length !== pack.holdout.leakage_ids.length ||
    holdoutLeakage.leakage_ids.some((id, index) => id !== pack.holdout.leakage_ids[index]) ||
    holdoutLeakage.overlap_keys.length !== pack.holdout.leakage_count
  )
    issues.push("m5_holdout_ledger_not_derived");
  if (holdoutLeakage.overlap_keys.length > 0 || holdoutLeakage.leakage_ids.length > 0)
    issues.push("m5_holdout_leakage_nonzero");
  if (
    pack.rgi.some(
      (item) => item.computable || item.value !== null || item.status !== "NOT_COMPUTABLE"
    )
  )
    issues.push("m5_rgi_unsupported_value_emitted");
  const goldenContent = Object.fromEntries(
    Object.entries(pack.golden_replay).filter(([key]) => key !== "digest")
  );
  if (stableDigest(goldenContent) !== pack.golden_replay.digest)
    issues.push("m5_golden_digest_mismatch");
  if (stableDigest(replayInputFor(pack)) !== pack.replay.input_digest)
    issues.push("m5_replay_input_digest_mismatch");
  if (pack.golden_replay.input_digest !== pack.replay.input_digest)
    issues.push("m5_golden_replay_input_not_bound");
  if (pack.golden_replay.package_digest !== packageDigestFor(pack))
    issues.push("m5_replay_package_digest_mismatch");
  if (pack.golden_replay.formal_result_overwritten || pack.golden_replay.settlement_write)
    issues.push("m5_replay_overwrite_enabled");
  if (
    pack.drift_ledger.length !== 5 ||
    new Set(pack.drift_ledger.map((item) => item.drift_kind)).size !== 5
  )
    issues.push("m5_drift_ledger_incomplete");
  if (
    pack.drift_ledger.some(
      (item) =>
        item.status !== "NO_CURRENT_EVIDENCE" || item.next_action !== "M6_LIFECYCLE_REQUALIFICATION"
    )
  )
    issues.push("m5_drift_status_overclaim");
  const statusSet = new Set(pack.status_examples.map((item) => item.status));
  for (const status of ["READY", "LIMITED", "NOT_ELIGIBLE"] as const) {
    if (!statusSet.has(status)) issues.push(`m5_status_classifier_missing_${status.toLowerCase()}`);
  }
  const observationById = new Map(pack.observations.map((item) => [item.observation_id, item]));
  const featureById = new Map(pack.features.map((item) => [item.feature_id, item]));
  for (const transformation of pack.transformations) {
    const observations = transformation.input.map((id) => observationById.get(id)).filter(Boolean);
    const feature = featureById.get(transformation.output);
    if (
      !feature ||
      observations.length !== transformation.input.length ||
      observations.some(
        (item) => item!.unit !== transformation.unit || item!.geography !== transformation.geography
      ) ||
      feature.unit !== transformation.unit ||
      feature.geography !== transformation.geography
    )
      issues.push(`${transformation.transformation_id}:provenance_mapping_invalid`);
  }
  if (
    pack.consumer.consumer_ready ||
    pack.consumer.formal_join ||
    !pack.consumer.exact_binding_required
  )
    issues.push("m5_consumer_claimed_ready_without_c0");
  if (
    pack.authority.provider !== "OFF" ||
    pack.authority.official_truth_write ||
    pack.authority.settlement_write ||
    pack.authority.parameter_set_formal_write
  )
    issues.push("m5_forbidden_authority_enabled");
  if (pack.mjp.status !== "PASS") issues.push("m5_mjp_not_pass");
  return issues;
}
