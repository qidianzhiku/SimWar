import { stableDigest } from "./index.js";

export const M25_PUBLIC_SOURCE_SCHEMA_VERSION = "sh-public-source-evidence-epoch.v1" as const;
export const M25_SOURCE_EPOCH_BASE_SHA =
  "d9c314d2365f48caef8187592c1b16915db4fd38" as const;
export const M25_MISSION_ID = "SIMWAR-SH-M25-PUBLIC-SOURCE-REALITY-EVIDENCE-EPOCH" as const;

export type M25EvidenceRealityClass =
  | "SYNTHETIC"
  | "REFERENCE_ONLY"
  | "PUBLIC_SOURCE_BOUND"
  | "DEIDENTIFIED_PRIVATE"
  | "HUMAN";

export type M25CandidateVisibility =
  | "TEACHER_ONLY"
  | "STUDENT_SAFE"
  | "INTERNAL_RESEARCH_ONLY"
  | "RESTRICTED";

export interface M25SourceReceipt {
  source_id: string;
  source_type: "OFFICIAL_PUBLIC_PAGE";
  publisher: string;
  title: string;
  url: string;
  published_or_reference_date: string;
  retrieved_at: string;
  retrieval_status: "RETRIEVED" | "RETRIEVED_WITH_JS_LIMIT";
  exact_locator: string;
  definition: string;
  geography: "Shanghai" | "Hangzhou";
  time_scope: string;
  unit_basis: string;
  rights_status: "PUBLIC_REFERENCE_ONLY";
  expiry: string;
  revalidation_required: true;
  excerpt_digest: string;
  source_digest: string;
}

export interface M25SourceAsset {
  source_id: string;
  source_type: "PUBLIC_DOCUMENT";
  reality_class: "PUBLIC_SOURCE_BOUND";
  source_receipt_id: string;
  source_date: string;
  geography: "Shanghai" | "Hangzhou";
  time_scope: string;
  provenance: string;
  license_or_usage_status: "PUBLIC_REFERENCE_ONLY";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NOT_ESTABLISHED";
  sensitivity: "PUBLIC";
  role_visibility: M25CandidateVisibility;
  derived_from: string[];
  content_basis: string;
  hash: string;
}

export interface M25Observation {
  observation_id: string;
  source_id: string;
  field: string;
  location: string;
  period: string;
  basis: string;
  unit: string;
  geography: "Shanghai" | "Hangzhou";
  value: number | string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NOT_ESTABLISHED";
  evidence_reality_class: M25EvidenceRealityClass;
  observation_status: "OBSERVED" | "UNKNOWN" | "CONFLICT";
  exact_locator: string;
  expiry: string;
  observation_digest: string;
}

export interface M25FeatureCandidate {
  feature_id: string;
  name: string;
  value: number | string | null;
  unit: string;
  range: { min: number | null; max: number | null };
  source_ids: string[];
  observation_ids: string[];
  temporal_scope: string;
  geography: "Shanghai" | "Hangzhou";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NOT_ESTABLISHED";
  possible_mod_consumer: string;
  calibration_evidence: "NOT_PROVEN";
  visibility: M25CandidateVisibility;
  feature_digest: string;
}

export interface M25TransformationRecord {
  transformation_id: string;
  input: string[];
  rule: string;
  assumption: string;
  output: string;
  unit: string;
  time_scope: string;
  geography: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NOT_ESTABLISHED";
  provenance: string;
  transformation_digest: string;
}

export interface M25RegionalTransfer {
  transfer_id: string;
  baseline_geography: "Shanghai";
  target_geography: "Hangzhou";
  driver: string;
  method: string;
  output: "REQUALIFICATION_REQUIRED";
  unit: "status";
  bounds: { min: null; max: null };
  source_feature_ids: string[];
  target_feature_ids: string[];
  evidence_reality_class: "PUBLIC_SOURCE_BOUND";
  confidence: "MEDIUM";
  valid_from: string;
  valid_to: string;
  rights_status: "PUBLIC_REFERENCE_ONLY";
  approval_status: "CANDIDATE_ONLY";
  transfer_digest: string;
}

export interface M25ScenarioCandidate {
  scenario_id: string;
  title: string;
  geography: "Shanghai" | "Hangzhou";
  time_scope: string;
  data_type: "PUBLIC_SOURCE_BOUND";
  source_ids: string[];
  feature_ids: string[];
  transfer_ids: string[];
  visibility: M25CandidateVisibility;
  premise: string;
  no_correct_answer_prefilled: true;
  formal_runtime_admitted: false;
  scenario_digest: string;
}

export interface M25ConflictEntry {
  conflict_id: string;
  sources: string[];
  conflict_type: "RETRIEVAL_SCOPE" | "DATE_SCOPE" | "DEFINITION_SCOPE";
  observed_positions: string[];
  resolution: "PRESERVED";
  status: "OPEN" | "CLOSED_WITH_EXPLICIT_SCOPE";
  impact: string;
}

export interface M25ModelHandoff {
  feature_id: string;
  possible_mod_consumer: string;
  unit: string;
  range: { min: number | null; max: number | null };
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NOT_ESTABLISHED";
  temporal_scope: string;
  calibration_evidence: "NOT_PROVEN";
  activation: "NOT_AUTHORIZED";
}

export interface M25PublicSourceRealityEvidenceEpochPack {
  schema_version: typeof M25_PUBLIC_SOURCE_SCHEMA_VERSION;
  mission_id: typeof M25_MISSION_ID;
  state_a: {
    name: "REFERENCE_ONLY_ANCHORS_WITHOUT_CURRENT_PUBLIC_EPOCH";
    reality_classes: ["SYNTHETIC", "REFERENCE_ONLY"];
    evidence_gap: string;
  };
  state_b: "PUBLIC_SOURCE_REALITY_EVIDENCE_EPOCH_BOUND";
  state_transition: { from: "STATE_A"; to: "STATE_B" };
  source_epoch: {
    epoch_id: "SH-PUBLIC-SOURCE-EPOCH-2026-08-30";
    source_epoch_base_sha: typeof M25_SOURCE_EPOCH_BASE_SHA;
    fetched_at: "2026-08-30";
    expires_at: "2026-11-30";
    revalidation_policy: string;
    source_receipts: M25SourceReceipt[];
    epoch_digest: string;
  };
  source_assets: M25SourceAsset[];
  observations: M25Observation[];
  features: M25FeatureCandidate[];
  transformations: M25TransformationRecord[];
  regional_transfers: M25RegionalTransfer[];
  scenario_candidates: M25ScenarioCandidate[];
  conflict_ledger: M25ConflictEntry[];
  provenance_graph: {
    nodes: Array<{ id: string; kind: "SOURCE" | "OBSERVATION" | "FEATURE" | "TRANSFER" | "SCENARIO" }>;
    edges: Array<{ from: string; to: string; relation: "DERIVED_FROM" | "USES" | "QUALIFIES" }>;
  };
  role_visibility: {
    teacher: { visibility: "TEACHER_ONLY"; fields: string[] };
    student: { visibility: "STUDENT_SAFE"; fields: string[]; forbidden_fields: string[] };
    admin: { visibility: "INTERNAL_RESEARCH_ONLY"; fields: string[] };
  };
  model_handoff: M25ModelHandoff[];
  authority: {
    candidate_writer: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER";
    official_truth_write: false;
    settlement_write: false;
    parameter_set_formal_write: false;
    provider: "OFF";
    runtime_authority: "JSON_INTERNAL_ONLY";
    second_truth_writer: false;
  };
  tool_ledger: {
    local_reference_vault: "UNAVAILABLE_FALLBACK_USED";
    codegraph: "CURRENT_WORKTREE_NOT_INDEXED_FALLBACK_USED";
    graphify: "GRAPH_NOT_FOUND_FALLBACK_USED";
    official_source_fetch: "USED";
    exact_source_contract_test_fallback: "USED";
  };
  known_limits: string[];
  pack_digest: string;
}

function digestWithout<T extends object>(value: T, key: string): string {
  const copy = { ...value } as Record<string, unknown>;
  delete copy[key];
  return stableDigest(copy);
}

function receipt(input: Omit<M25SourceReceipt, "source_digest">): M25SourceReceipt {
  return { ...input, source_digest: digestWithout(input, "source_digest") };
}

function sourceAsset(input: Omit<M25SourceAsset, "hash">): M25SourceAsset {
  return { ...input, hash: stableDigest(input) };
}

function observation(input: Omit<M25Observation, "observation_digest">): M25Observation {
  return { ...input, observation_digest: digestWithout(input, "observation_digest") };
}

function feature(input: Omit<M25FeatureCandidate, "feature_digest">): M25FeatureCandidate {
  return { ...input, feature_digest: digestWithout(input, "feature_digest") };
}

function transformation(
  input: Omit<M25TransformationRecord, "transformation_digest">
): M25TransformationRecord {
  return { ...input, transformation_digest: digestWithout(input, "transformation_digest") };
}

function transfer(input: Omit<M25RegionalTransfer, "transfer_digest">): M25RegionalTransfer {
  return { ...input, transfer_digest: digestWithout(input, "transfer_digest") };
}

function scenario(input: Omit<M25ScenarioCandidate, "scenario_digest">): M25ScenarioCandidate {
  return { ...input, scenario_digest: digestWithout(input, "scenario_digest") };
}

export function buildM25PublicSourceRealityEvidenceEpochPack(): M25PublicSourceRealityEvidenceEpochPack {
  const shYearbook = receipt({
    source_id: "SH-TJJ-YEARBOOK-2025",
    source_type: "OFFICIAL_PUBLIC_PAGE",
    publisher: "Shanghai Municipal Bureau of Statistics",
    title: "2025上海统计年鉴",
    url: "https://tjj.sh.gov.cn/tjnj/tjnj2025.htm",
    published_or_reference_date: "2025",
    retrieved_at: "2026-08-30",
    retrieval_status: "RETRIEVED",
    exact_locator: "HTML index: 第二篇人口、就业与工资; 表2.7各区户籍老年人口年龄构成（2024）",
    definition: "Official yearbook index exposes the named age-composition table; row values require exact table retrieval.",
    geography: "Shanghai",
    time_scope: "2024 table index",
    unit_basis: "table listing; row unit not asserted",
    rights_status: "PUBLIC_REFERENCE_ONLY",
    expiry: "2026-11-30",
    revalidation_required: true,
    excerpt_digest: stableDigest({
      url: "https://tjj.sh.gov.cn/tjnj/tjnj2025.htm",
      locator: "第二篇/表2.7",
      basis: "official HTML index"
    })
  });
  const shEldercare = receipt({
    source_id: "SH-MZJ-ELDERCARE-SERVICE-PAGE",
    source_type: "OFFICIAL_PUBLIC_PAGE",
    publisher: "Shanghai Municipal Civil Affairs Bureau",
    title: "上海养老服务政策信息页",
    url: "https://shyl.mzj.sh.gov.cn/elderly_care_policy/policy_details?uuid=50915bbc-3cd4-4de9-98ad-c8c62c137a1a",
    published_or_reference_date: "2026-05-15",
    retrieved_at: "2026-08-30",
    retrieval_status: "RETRIEVED_WITH_JS_LIMIT",
    exact_locator: "Public URL resolved; non-JavaScript response exposes no document body.",
    definition: "Policy page is retained as a revalidation target; no numeric observation is derived from the unavailable body.",
    geography: "Shanghai",
    time_scope: "2026 policy page candidate",
    unit_basis: "not available from non-JavaScript response",
    rights_status: "PUBLIC_REFERENCE_ONLY",
    expiry: "2026-11-30",
    revalidation_required: true,
    excerpt_digest: stableDigest({
      url: "https://shyl.mzj.sh.gov.cn/elderly_care_policy/policy_details?uuid=50915bbc-3cd4-4de9-98ad-c8c62c137a1a",
      retrieval_status: "RETRIEVED_WITH_JS_LIMIT"
    })
  });
  const hzSolution = receipt({
    source_id: "HZ-SWW-ONE-ELDER-ONE-CHILD-2022",
    source_type: "OFFICIAL_PUBLIC_PAGE",
    publisher: "Hangzhou Municipal Bureau of Commerce",
    title: "涉及养老托育，出台16项重点任务！杭州市“一老一小”整体解决方案发布！",
    url: "https://jz.sww.hangzhou.gov.cn/axjz/contents/51/4401.html",
    published_or_reference_date: "2022-12-01",
    retrieved_at: "2026-08-30",
    retrieval_status: "RETRIEVED",
    exact_locator: "HTML lines 29-47: 2025 eldercare targets and table headings; lines 35-47 list units and target values.",
    definition: "Published municipal solution with explicit target-year indicators; targets are not current observed outcomes and are not calibration evidence.",
    geography: "Hangzhou",
    time_scope: "2021 baseline and 2025 target",
    unit_basis: "percent, beds per 10,000 older people, people per 10,000 older people, as labelled by source table",
    rights_status: "PUBLIC_REFERENCE_ONLY",
    expiry: "2026-11-30",
    revalidation_required: true,
    excerpt_digest: stableDigest({
      url: "https://jz.sww.hangzhou.gov.cn/axjz/contents/51/4401.html",
      locator: "lines 35-47",
      indicators: ["nursing_bed_ratio", "dementia_beds_per_10k", "community_health_management", "certified_care_staff_per_10k"]
    })
  });
  const source_receipts = [shYearbook, shEldercare, hzSolution];
  const source_assets = [
    sourceAsset({
      source_id: "SH-TJJ-YEARBOOK-2025",
      source_type: "PUBLIC_DOCUMENT",
      reality_class: "PUBLIC_SOURCE_BOUND",
      source_receipt_id: shYearbook.source_id,
      source_date: "2025",
      geography: "Shanghai",
      time_scope: "2024 table index",
      provenance: "Exact public official yearbook index readback; no row value inferred.",
      license_or_usage_status: "PUBLIC_REFERENCE_ONLY",
      confidence: "HIGH",
      sensitivity: "PUBLIC",
      role_visibility: "TEACHER_ONLY",
      derived_from: [shYearbook.source_id],
      content_basis: "Table 2.7 availability and definition anchor only."
    }),
    sourceAsset({
      source_id: "SH-MZJ-ELDERCARE-SERVICE-PAGE",
      source_type: "PUBLIC_DOCUMENT",
      reality_class: "PUBLIC_SOURCE_BOUND",
      source_receipt_id: shEldercare.source_id,
      source_date: "2026-05-15",
      geography: "Shanghai",
      time_scope: "2026 policy page candidate",
      provenance: "Exact official URL receipt; body retrieval is JS-limited and therefore produces no numeric observation.",
      license_or_usage_status: "PUBLIC_REFERENCE_ONLY",
      confidence: "LOW",
      sensitivity: "PUBLIC",
      role_visibility: "TEACHER_ONLY",
      derived_from: [shEldercare.source_id],
      content_basis: "Revalidation target and retrieval limitation only."
    }),
    sourceAsset({
      source_id: "HZ-SWW-ONE-ELDER-ONE-CHILD-2022",
      source_type: "PUBLIC_DOCUMENT",
      reality_class: "PUBLIC_SOURCE_BOUND",
      source_receipt_id: hzSolution.source_id,
      source_date: "2022-12-01",
      geography: "Hangzhou",
      time_scope: "2021 baseline and 2025 target",
      provenance: "Exact public official page readback with labeled indicator rows.",
      license_or_usage_status: "PUBLIC_REFERENCE_ONLY",
      confidence: "MEDIUM",
      sensitivity: "PUBLIC",
      role_visibility: "STUDENT_SAFE",
      derived_from: [hzSolution.source_id],
      content_basis: "Municipal target indicators, explicitly marked as targets rather than current outcomes."
    })
  ];
  const observations = [
    observation({
      observation_id: "SH-M25-OBS-YEARBOOK-TABLE-2-7-LISTED",
      source_id: shYearbook.source_id,
      field: "table_2_7_age_composition_index",
      location: "Shanghai",
      period: "2024",
      basis: "Official HTML yearbook index lists the table.",
      unit: "table_listing",
      geography: "Shanghai",
      value: "listed",
      confidence: "HIGH",
      evidence_reality_class: "PUBLIC_SOURCE_BOUND",
      observation_status: "OBSERVED",
      exact_locator: "第二篇/表2.7各区户籍老年人口年龄构成（2024）",
      expiry: "2026-11-30"
    }),
    observation({
      observation_id: "SH-M25-OBS-ELDERCARE-BODY-UNAVAILABLE",
      source_id: shEldercare.source_id,
      field: "policy_body",
      location: "Shanghai",
      period: "2026 policy candidate",
      basis: "Public URL returned a JavaScript shell without the document body.",
      unit: "not_available",
      geography: "Shanghai",
      value: null,
      confidence: "NOT_ESTABLISHED",
      evidence_reality_class: "REFERENCE_ONLY",
      observation_status: "UNKNOWN",
      exact_locator: "non-JavaScript response",
      expiry: "2026-11-30"
    }),
    observation({
      observation_id: "HZ-M25-OBS-NURSING-BED-RATIO-2025",
      source_id: hzSolution.source_id,
      field: "nursing_bed_ratio",
      location: "Hangzhou",
      period: "2025 target",
      basis: "Source table lines 35-38 label unit % and target 65.",
      unit: "%",
      geography: "Hangzhou",
      value: 65,
      confidence: "MEDIUM",
      evidence_reality_class: "PUBLIC_SOURCE_BOUND",
      observation_status: "OBSERVED",
      exact_locator: "HTML lines 35-38",
      expiry: "2026-11-30"
    }),
    observation({
      observation_id: "HZ-M25-OBS-DEMENTIA-BEDS-2025",
      source_id: hzSolution.source_id,
      field: "dementia_beds_per_10k_older_people",
      location: "Hangzhou",
      period: "2025 target",
      basis: "Source table lines 35-39 label unit beds and target 20 per 10,000 older people.",
      unit: "beds_per_10k_older_people",
      geography: "Hangzhou",
      value: 20,
      confidence: "MEDIUM",
      evidence_reality_class: "PUBLIC_SOURCE_BOUND",
      observation_status: "OBSERVED",
      exact_locator: "HTML lines 35-39",
      expiry: "2026-11-30"
    }),
    observation({
      observation_id: "HZ-M25-OBS-CARE-STAFF-2025",
      source_id: hzSolution.source_id,
      field: "certified_care_staff_per_10k_older_people",
      location: "Hangzhou",
      period: "2025 target",
      basis: "Source table lines 45-47 label unit people and target 28 per 10,000 older people.",
      unit: "people_per_10k_older_people",
      geography: "Hangzhou",
      value: 28,
      confidence: "MEDIUM",
      evidence_reality_class: "PUBLIC_SOURCE_BOUND",
      observation_status: "OBSERVED",
      exact_locator: "HTML lines 45-47",
      expiry: "2026-11-30"
    })
  ];
  const features = [
    feature({
      feature_id: "SH-M25-FEATURE-AGE-COMPOSITION-COVERAGE",
      name: "Shanghai public age-composition evidence coverage",
      value: "table_available_exact_rows_pending",
      unit: "availability_status",
      range: { min: null, max: null },
      source_ids: [shYearbook.source_id],
      observation_ids: ["SH-M25-OBS-YEARBOOK-TABLE-2-7-LISTED"],
      temporal_scope: "2024 table index",
      geography: "Shanghai",
      confidence: "HIGH",
      possible_mod_consumer: "MOD regional-demand evidence gate",
      calibration_evidence: "NOT_PROVEN",
      visibility: "TEACHER_ONLY"
    }),
    feature({
      feature_id: "HZ-M25-FEATURE-NURSING-BED-RATIO",
      name: "Hangzhou nursing bed ratio target",
      value: 65,
      unit: "%",
      range: { min: 0, max: 100 },
      source_ids: [hzSolution.source_id],
      observation_ids: ["HZ-M25-OBS-NURSING-BED-RATIO-2025"],
      temporal_scope: "2025 target",
      geography: "Hangzhou",
      confidence: "MEDIUM",
      possible_mod_consumer: "MOD capacity-quality feature candidate",
      calibration_evidence: "NOT_PROVEN",
      visibility: "STUDENT_SAFE"
    }),
    feature({
      feature_id: "HZ-M25-FEATURE-DEMENTIA-BEDS",
      name: "Hangzhou dementia-care beds target",
      value: 20,
      unit: "beds_per_10k_older_people",
      range: { min: 0, max: null },
      source_ids: [hzSolution.source_id],
      observation_ids: ["HZ-M25-OBS-DEMENTIA-BEDS-2025"],
      temporal_scope: "2025 target",
      geography: "Hangzhou",
      confidence: "MEDIUM",
      possible_mod_consumer: "MOD care-mix feature candidate",
      calibration_evidence: "NOT_PROVEN",
      visibility: "STUDENT_SAFE"
    }),
    feature({
      feature_id: "HZ-M25-FEATURE-CARE-STAFF",
      name: "Hangzhou certified care staff target",
      value: 28,
      unit: "people_per_10k_older_people",
      range: { min: 0, max: null },
      source_ids: [hzSolution.source_id],
      observation_ids: ["HZ-M25-OBS-CARE-STAFF-2025"],
      temporal_scope: "2025 target",
      geography: "Hangzhou",
      confidence: "MEDIUM",
      possible_mod_consumer: "MOD workforce-capacity feature candidate",
      calibration_evidence: "NOT_PROVEN",
      visibility: "STUDENT_SAFE"
    })
  ];
  const transformations = [
    transformation({
      transformation_id: "SH-M25-TRANSFORM-SH-TABLE-COVERAGE",
      input: ["SH-M25-OBS-YEARBOOK-TABLE-2-7-LISTED"],
      rule: "Map an official table-listing observation to a categorical evidence-coverage feature.",
      assumption: "No row value, population value, or rate is inferred from table availability.",
      output: "SH-M25-FEATURE-AGE-COMPOSITION-COVERAGE",
      unit: "availability_status",
      time_scope: "2024 table index",
      geography: "Shanghai",
      confidence: "HIGH",
      provenance: "Shanghai Statistics Yearbook official HTML index."
    }),
    transformation({
      transformation_id: "HZ-M25-TRANSFORM-TARGETS-TO-FEATURES",
      input: [
        "HZ-M25-OBS-NURSING-BED-RATIO-2025",
        "HZ-M25-OBS-DEMENTIA-BEDS-2025",
        "HZ-M25-OBS-CARE-STAFF-2025"
      ],
      rule: "Copy each labeled target into a same-unit feature without averaging or extrapolation.",
      assumption: "Published targets are planning evidence, not current outcomes or calibration data.",
      output: "HZ-M25-FEATURE-NURSING-BED-RATIO,HZ-M25-FEATURE-DEMENTIA-BEDS,HZ-M25-FEATURE-CARE-STAFF",
      unit: "source-labelled units",
      time_scope: "2025 target",
      geography: "Hangzhou",
      confidence: "MEDIUM",
      provenance: "Hangzhou municipal official solution HTML lines 35-47."
    }),
    transformation({
      transformation_id: "M25-TRANSFORM-SH-HZ-REQUALIFICATION",
      input: ["SH-M25-FEATURE-AGE-COMPOSITION-COVERAGE", "HZ-M25-FEATURE-NURSING-BED-RATIO"],
      rule: "Create a transfer candidate only when source-bound evidence exists for both cities; preserve field and unit differences.",
      assumption: "A cross-city candidate is not a numeric transfer factor and requires later schema-level requalification.",
      output: "SH-M25-TRANSFER-SHANGHAI-HANGZHOU",
      unit: "status",
      time_scope: "2024 index to 2025 target",
      geography: "Shanghai→Hangzhou",
      confidence: "MEDIUM",
      provenance: "M25 source receipts and same-mission deterministic compiler."
    })
  ];
  const regional_transfers = [
    transfer({
      transfer_id: "SH-M25-TRANSFER-SHANGHAI-HANGZHOU",
      baseline_geography: "Shanghai",
      target_geography: "Hangzhou",
      driver: "Public-source coverage and explicitly labeled care-capacity targets",
      method: "Exact field/unit comparison; no synthetic coefficient, average, extrapolation, or calibration write.",
      output: "REQUALIFICATION_REQUIRED",
      unit: "status",
      bounds: { min: null, max: null },
      source_feature_ids: ["SH-M25-FEATURE-AGE-COMPOSITION-COVERAGE"],
      target_feature_ids: [
        "HZ-M25-FEATURE-NURSING-BED-RATIO",
        "HZ-M25-FEATURE-DEMENTIA-BEDS",
        "HZ-M25-FEATURE-CARE-STAFF"
      ],
      evidence_reality_class: "PUBLIC_SOURCE_BOUND",
      confidence: "MEDIUM",
      valid_from: "2026-08-30",
      valid_to: "2026-11-30",
      rights_status: "PUBLIC_REFERENCE_ONLY",
      approval_status: "CANDIDATE_ONLY"
    })
  ];
  const scenario_candidates = [
    scenario({
      scenario_id: "SH-M25-SCENARIO-SHANGHAI-EVIDENCE-COVERAGE",
      title: "Shanghai public evidence coverage: retrieve exact age composition before binding",
      geography: "Shanghai",
      time_scope: "2024 table index; revalidate by 2026-11-30",
      data_type: "PUBLIC_SOURCE_BOUND",
      source_ids: [shYearbook.source_id, shEldercare.source_id],
      feature_ids: ["SH-M25-FEATURE-AGE-COMPOSITION-COVERAGE"],
      transfer_ids: [],
      visibility: "STUDENT_SAFE",
      premise: "The learner must distinguish an official table listing from a retrievable row value and choose a safe evidence request.",
      no_correct_answer_prefilled: true,
      formal_runtime_admitted: false
    }),
    scenario({
      scenario_id: "SH-M25-SCENARIO-HANGZHOU-CARE-CAPACITY",
      title: "Hangzhou target indicators: separate planning targets from observed reality",
      geography: "Hangzhou",
      time_scope: "2025 target; revalidate by 2026-11-30",
      data_type: "PUBLIC_SOURCE_BOUND",
      source_ids: [hzSolution.source_id],
      feature_ids: [
        "HZ-M25-FEATURE-NURSING-BED-RATIO",
        "HZ-M25-FEATURE-DEMENTIA-BEDS",
        "HZ-M25-FEATURE-CARE-STAFF"
      ],
      transfer_ids: ["SH-M25-TRANSFER-SHANGHAI-HANGZHOU"],
      visibility: "STUDENT_SAFE",
      premise: "The learner must use labeled targets as bounded evidence and request requalification before transfer.",
      no_correct_answer_prefilled: true,
      formal_runtime_admitted: false
    })
  ];
  const conflict_ledger: M25ConflictEntry[] = [
    {
      conflict_id: "SH-M25-CONFLICT-SH-RETRIEVAL-SCOPE",
      sources: [shYearbook.source_id, shEldercare.source_id],
      conflict_type: "RETRIEVAL_SCOPE",
      observed_positions: [
        "Yearbook HTML index is readable and names an exact table.",
        "Shanghai civil-affairs policy URL resolves only to a JavaScript shell in this readback."
      ],
      resolution: "PRESERVED",
      status: "OPEN",
      impact: "Shanghai numeric eldercare observations remain missing; no numeric fallback is allowed."
    },
    {
      conflict_id: "SH-M25-CONFLICT-HZ-TARGET-VS-OUTCOME",
      sources: [hzSolution.source_id],
      conflict_type: "DATE_SCOPE",
      observed_positions: ["The source labels values as 2025 targets, not 2026 observed outcomes."],
      resolution: "PRESERVED",
      status: "CLOSED_WITH_EXPLICIT_SCOPE",
      impact: "Feature consumers must carry target-year scope and cannot claim current outcome or calibration."
    }
  ];
  const provenance_graph = {
    nodes: [
      ...source_assets.map((item) => ({ id: item.source_id, kind: "SOURCE" as const })),
      ...observations.map((item) => ({ id: item.observation_id, kind: "OBSERVATION" as const })),
      ...features.map((item) => ({ id: item.feature_id, kind: "FEATURE" as const })),
      ...regional_transfers.map((item) => ({ id: item.transfer_id, kind: "TRANSFER" as const })),
      ...scenario_candidates.map((item) => ({ id: item.scenario_id, kind: "SCENARIO" as const }))
    ],
    edges: [
      ...observations.map((item) => ({ from: item.source_id, to: item.observation_id, relation: "DERIVED_FROM" as const })),
      ...features.flatMap((item) => item.observation_ids.map((id) => ({ from: id, to: item.feature_id, relation: "DERIVED_FROM" as const }))),
      ...regional_transfers.flatMap((item) => [...item.source_feature_ids, ...item.target_feature_ids].map((id) => ({ from: id, to: item.transfer_id, relation: "QUALIFIES" as const }))),
      ...scenario_candidates.flatMap((item) => [...item.feature_ids, ...item.transfer_ids].map((id) => ({ from: id, to: item.scenario_id, relation: "USES" as const })))
    ]
  };
  const model_handoff = features.map((item) => ({
    feature_id: item.feature_id,
    possible_mod_consumer: item.possible_mod_consumer,
    unit: item.unit,
    range: item.range,
    confidence: item.confidence,
    temporal_scope: item.temporal_scope,
    calibration_evidence: "NOT_PROVEN" as const,
    activation: "NOT_AUTHORIZED" as const
  }));
  const content: Omit<M25PublicSourceRealityEvidenceEpochPack, "pack_digest"> = {
    schema_version: M25_PUBLIC_SOURCE_SCHEMA_VERSION,
    mission_id: M25_MISSION_ID,
    state_a: {
      name: "REFERENCE_ONLY_ANCHORS_WITHOUT_CURRENT_PUBLIC_EPOCH",
      reality_classes: ["SYNTHETIC", "REFERENCE_ONLY"],
      evidence_gap: "M19/M22-era anchors did not carry a current, exact public-source epoch."
    },
    state_b: "PUBLIC_SOURCE_REALITY_EVIDENCE_EPOCH_BOUND",
    state_transition: { from: "STATE_A", to: "STATE_B" },
    source_epoch: {
      epoch_id: "SH-PUBLIC-SOURCE-EPOCH-2026-08-30",
      source_epoch_base_sha: M25_SOURCE_EPOCH_BASE_SHA,
      fetched_at: "2026-08-30",
      expires_at: "2026-11-30",
    revalidation_policy: "Re-fetch the exact source and exact official URL locator before expiry; reject implicit latest, preserve unavailable/changed definitions, and recompile the epoch digest.",
      source_receipts,
      epoch_digest: stableDigest({
        epoch_id: "SH-PUBLIC-SOURCE-EPOCH-2026-08-30",
        source_epoch_base_sha: M25_SOURCE_EPOCH_BASE_SHA,
        source_receipts
      })
    },
    source_assets,
    observations,
    features,
    transformations,
    regional_transfers,
    scenario_candidates,
    conflict_ledger,
    provenance_graph,
    role_visibility: {
      teacher: {
        visibility: "TEACHER_ONLY",
        fields: ["source_receipts", "exact_locator", "expiry", "conflict_ledger", "model_handoff"]
      },
      student: {
        visibility: "STUDENT_SAFE",
        fields: ["scenario_candidates", "bounded_feature_labels", "requalification_required"],
        forbidden_fields: ["raw_source_excerpt", "private_source_rows", "official_truth", "calibration_status"]
      },
      admin: {
        visibility: "INTERNAL_RESEARCH_ONLY",
        fields: ["source_digest", "epoch_digest", "rights_status", "expiry", "revalidation_policy"]
      }
    },
    model_handoff,
    authority: {
      candidate_writer: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER",
      official_truth_write: false,
      settlement_write: false,
      parameter_set_formal_write: false,
      provider: "OFF",
      runtime_authority: "JSON_INTERNAL_ONLY",
      second_truth_writer: false
    },
    tool_ledger: {
      local_reference_vault: "UNAVAILABLE_FALLBACK_USED",
      codegraph: "CURRENT_WORKTREE_NOT_INDEXED_FALLBACK_USED",
      graphify: "GRAPH_NOT_FOUND_FALLBACK_USED",
      official_source_fetch: "USED",
      exact_source_contract_test_fallback: "USED"
    },
    known_limits: [
      "Shanghai civil-affairs policy body was JavaScript-limited; no numeric observation was inferred.",
      "Shanghai yearbook source readback proves table availability, not row values.",
      "Hangzhou values are 2025 planning targets, not observed outcomes.",
      "No feature is MODEL_CALIBRATED; all calibration evidence remains NOT_PROVEN.",
      "No ParameterSet, official Truth, Settlement, Provider, production scheduler, PostgreSQL/RLS cutover, Pilot, Production, or Human Validation is authorized.",
      "Scenario candidates are candidate-only and require exact binding and later requalification before any product consumption."
    ]
  };
  return { ...content, pack_digest: stableDigest(content) };
}

export function validateM25PublicSourceRealityEvidenceEpochPack(
  pack: M25PublicSourceRealityEvidenceEpochPack
): string[] {
  const issues: string[] = [];
  const { pack_digest, ...content } = pack;
  if (stableDigest(content) !== pack_digest) issues.push("pack_digest_mismatch");
  if (stableDigest({
    epoch_id: pack.source_epoch.epoch_id,
    source_epoch_base_sha: pack.source_epoch.source_epoch_base_sha,
    source_receipts: pack.source_epoch.source_receipts
  }) !== pack.source_epoch.epoch_digest)
    issues.push("epoch_digest_mismatch");
  for (const source of pack.source_assets) {
    if (digestWithout(source, "hash") !== source.hash) issues.push("source_digest_mismatch");
    if (source.reality_class !== "PUBLIC_SOURCE_BOUND") issues.push("unsupported_source_reality_class");
    if (!pack.source_epoch.source_receipts.some((item) => item.source_id === source.source_receipt_id))
      issues.push("source_receipt_missing");
  }
  for (const item of pack.observations) {
    if (digestWithout(item, "observation_digest") !== item.observation_digest)
      issues.push("observation_digest_mismatch");
    if (item.evidence_reality_class === "SYNTHETIC" || item.evidence_reality_class === "DEIDENTIFIED_PRIVATE")
      issues.push("unsupported_observation_reality_class");
    if (typeof item.value === "number" && item.unit.trim().length === 0) issues.push("observation_unit_missing");
  }
  for (const item of pack.features) {
    if (digestWithout(item, "feature_digest") !== item.feature_digest) issues.push("feature_digest_mismatch");
    if (item.calibration_evidence !== "NOT_PROVEN") issues.push("calibration_claim_not_proven");
    if (typeof item.value === "number" && item.unit.trim().length === 0) issues.push("feature_unit_missing");
  }
  for (const item of pack.transformations) {
    if (digestWithout(item, "transformation_digest") !== item.transformation_digest)
      issues.push("transformation_digest_mismatch");
  }
  for (const item of pack.regional_transfers) {
    if (digestWithout(item, "transfer_digest") !== item.transfer_digest) issues.push("transfer_digest_mismatch");
    if (item.output !== "REQUALIFICATION_REQUIRED" || item.approval_status !== "CANDIDATE_ONLY")
      issues.push("transfer_activation_boundary_invalid");
  }
  for (const item of pack.scenario_candidates) {
    if (digestWithout(item, "scenario_digest") !== item.scenario_digest) issues.push("scenario_digest_mismatch");
    if (item.formal_runtime_admitted || !item.no_correct_answer_prefilled)
      issues.push("scenario_authority_boundary_invalid");
  }
  if (pack.state_b !== "PUBLIC_SOURCE_REALITY_EVIDENCE_EPOCH_BOUND") issues.push("state_b_invalid");
  if (pack.source_assets.filter((item) => item.geography === "Shanghai").length === 0) issues.push("shanghai_source_missing");
  if (pack.source_assets.filter((item) => item.geography === "Hangzhou").length === 0) issues.push("second_city_source_missing");
  if (!pack.source_epoch.revalidation_policy.includes("exact official URL")) issues.push("revalidation_policy_missing");
  if (pack.authority.official_truth_write || pack.authority.settlement_write || pack.authority.parameter_set_formal_write)
    issues.push("authority_boundary_invalid");
  if (pack.authority.provider !== "OFF" || pack.authority.second_truth_writer) issues.push("provider_or_writer_boundary_invalid");
  if (pack.role_visibility.student.forbidden_fields.includes("raw_source_excerpt") === false)
    issues.push("student_raw_excerpt_boundary_missing");
  return [...new Set(issues)];
}
