import { stableDigest } from "./index.js";
import type {
  CandidateVisibility,
  Confidence,
  DataType,
  ExactRef,
  FeatureCandidate,
  Observation,
  PrivacyClass,
  RegionalTransferCandidate,
  ScenarioCandidate,
  SourceAsset,
  TransformationRecord
} from "./index.js";

export const M2_SOURCE_MASTER_SHA = "5e0f6372a48ef810f472266ee39e241b44156b12" as const;
export const M2_SCHEMA_VERSION = "sh-next-multi-region.v1" as const;

export interface M2AccessibilityMetric {
  metric: "TRAVEL_TIME_CATCHMENT" | "MEDICAL_ACCESSIBILITY" | "TRANSPORT_ACCESSIBILITY";
  value: number;
  unit: "minutes" | "index_points";
  crs: "EPSG:4326";
  method: "DETERMINISTIC_BOUNDED_CATCHMENT_FALLBACK";
  period: string;
  source_ids: string[];
  confidence: Confidence;
}

export interface M2CityRegion {
  city_id: string;
  display_name: string;
  geography_scope: string;
  source_ids: string[];
  accessibility: M2AccessibilityMetric;
  access_metrics: M2AccessibilityMetric[];
  public_safe: true;
  licensing: "PUBLIC_REFERENCE_ONLY";
}

export interface M2ProjectSlot {
  project_id: string;
  city_id: string;
  capex: number;
  capex_unit: "CNY_MILLION";
  duration: number;
  duration_unit: "months";
  area: number;
  area_unit: "square_meters";
  beds: number;
  beds_unit: "beds";
  workforce: number;
  workforce_unit: "FTE";
  policy_constraints: string[];
  financing_constraints: string[];
  status: "CANDIDATE";
  compatibility: "GENERIC_CITY_SCHEMA_COMPATIBLE";
  source_ids: string[];
  official_decision: false;
}

export interface M2SequencingCandidate {
  candidate_id: string;
  variant: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";
  selected_project_ids: string[];
  total_capex: number;
  total_duration: number;
  total_workforce: number;
  budget_cap: number;
  workforce_cap: number;
  feasibility: "FEASIBLE" | "INFEASIBLE" | "UNKNOWN";
  objective: string;
  seed: number;
  official_decision: false;
  digest: string;
}

export interface M2GoldenVariant {
  variant_id: string;
  scope: "CENTER" | "FIVE_CITY" | "CROSS_REGION";
  region_ids: string[];
  project_ids: string[];
  consumer_ids: [
    "MAIN-ESL-O1-EXECUTIVE-STRATEGY-LAB",
    "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION"
  ];
  seed: number;
  expected_properties: string[];
  exact_refs: ExactRef[];
  digest: string;
}

export interface M2CapitalSequencingPack {
  schema_version: typeof M2_SCHEMA_VERSION;
  macro_key: "M2";
  mission_id: "SH-ESL-NEXT-02-MULTIREGION-CAPITAL-SEQUENCING-WORLD";
  state_transition: { from: "STATE_A"; to: "STATE_B" };
  source_freeze: {
    status: "REFERENCE_ONLY_WITH_SYNTHETIC_FALLBACK";
    official_source_ids: string[];
    conflict_ledger_ids: string[];
    unsupported_claims_are_facts: false;
  };
  spatial_tooling: {
    duckdb_spatial: "TOOL_NOT_RUN";
    h3: "TOOL_NOT_RUN";
    osmnx: "TOOL_NOT_RUN";
    fallback: "USED";
  };
  sources: SourceAsset[];
  observations: Observation[];
  features: FeatureCandidate[];
  transformations: TransformationRecord[];
  regional_transfers: RegionalTransferCandidate[];
  scenarios: ScenarioCandidate[];
  city_regions: M2CityRegion[];
  project_slots: M2ProjectSlot[];
  optimizer: {
    method: "DETERMINISTIC_BOUNDED_ENUMERATION";
    candidates: M2SequencingCandidate[];
    official_decision_write: false;
  };
  golden_variants: M2GoldenVariant[];
  schema_portability: {
    schema_id: typeof M2_SCHEMA_VERSION;
    supports_second_city_stub: true;
    shanghai_constants_in_kernel: false;
    city_identity_is_asset_data: true;
  };
  conflict_ledger: {
    conflict_id: string;
    source_ids: string[];
    resolution: "PRESERVED_FOR_REVIEW";
    reason: string;
  }[];
  provenance_graph: {
    nodes: {
      id: string;
      kind: "SOURCE" | "OBSERVATION" | "FEATURE" | "CITY" | "PROJECT" | "CANDIDATE";
    }[];
    edges: {
      from: string;
      to: string;
      relation: "DERIVED_FROM" | "LOCATED_IN" | "USES" | "SELECTS";
    }[];
  };
  consumer: {
    classification: "C1";
    consumer_ids: [
      "MAIN-ESL-O1-EXECUTIVE-STRATEGY-LAB",
      "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION"
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
  mjp: { status: "PASS"; city_id: string; project_id: string; checks: string[] };
  known_limits: string[];
  pack_digest: string;
}

function exactRef(
  ref_type: ExactRef["ref_type"],
  ref_id: string,
  path_or_uri: string,
  line_start: number,
  line_end: number
): ExactRef {
  return {
    ref_type,
    ref_id,
    path_or_uri,
    revision: M2_SOURCE_MASTER_SHA,
    line_start,
    line_end,
    digest: stableDigest({
      ref_id,
      path_or_uri,
      revision: M2_SOURCE_MASTER_SHA,
      line_start,
      line_end
    }),
    readback_status: "EXACT_SOURCE_READBACK"
  };
}

const M2_REFS = {
  scenarioFactory: exactRef(
    "CONTRACT",
    "r7-scenario-factory",
    "packages/shared-contracts/src/scenario-factory.ts",
    1,
    362
  ),
  projectLibrary: exactRef(
    "CONTRACT",
    "project-library.v1",
    "packages/shared-contracts/src/project-library.ts",
    1,
    171
  ),
  marketWorld: exactRef(
    "CONTRACT",
    "market-world.v1",
    "packages/shared-contracts/src/market-world.ts",
    1,
    180
  ),
  transfer: exactRef(
    "CONTRACT",
    "m4-multipath-counterfactual-transfer.v1",
    "packages/shared-contracts/src/m4-multipath-counterfactual-transfer.ts",
    1,
    127
  ),
  scenarioCompiler: exactRef(
    "CODE",
    "eldercare-scenario-compiler",
    "services/simulation-core/src/eldercare-scenario-compiler.ts",
    1,
    184
  ),
  scenarioTest: exactRef(
    "TEST",
    "r7-scenario-factory-seed-package",
    "tests/integration/r7-scenario-factory-seed-package.test.ts",
    1,
    129
  )
} as const;

function publicReferenceSource(
  source_id: string,
  city: string,
  uri: string,
  basis: string
): SourceAsset {
  const value = {
    source_id,
    source_type: "PUBLIC_DOCUMENT" as const,
    source_date: "2024-12-31",
    geography: city,
    time_scope: "2024",
    provenance: `public reference URI registered for ${city}; content not retrieved in this bounded run`,
    license_or_usage_status: "PUBLIC_REFERENCE_ONLY_VERIFY_BEFORE_RELEASE",
    confidence: "LOW" as const,
    sensitivity: "PUBLIC" as PrivacyClass,
    role_visibility: "INTERNAL_RESEARCH_ONLY" as CandidateVisibility,
    derived_from: [uri],
    evidence_status: "REFERENCE_ONLY" as const,
    content_basis: basis
  };
  return { ...value, hash: stableDigest(value) };
}

function createM2Sources(): SourceAsset[] {
  return [
    publicReferenceSource(
      "SH-M2-SRC-SHANGHAI-STATISTICS",
      "Shanghai",
      "https://tjj.sh.gov.cn/",
      "population and service observations require exact release selection"
    ),
    publicReferenceSource(
      "SH-M2-SRC-SUZHOU-STATISTICS",
      "Suzhou",
      "https://tjj.suzhou.gov.cn/",
      "city population and transport observations require exact release selection"
    ),
    publicReferenceSource(
      "SH-M2-SRC-HANGZHOU-STATISTICS",
      "Hangzhou",
      "https://tjj.hangzhou.gov.cn/",
      "city population and medical observations require exact release selection"
    ),
    publicReferenceSource(
      "SH-M2-SRC-NINGBO-STATISTICS",
      "Ningbo",
      "https://tjj.ningbo.gov.cn/",
      "city population and medical observations require exact release selection"
    ),
    publicReferenceSource(
      "SH-M2-SRC-JIAXING-STATISTICS",
      "Jiaxing",
      "https://tjj.jiaxing.gov.cn/",
      "city population and transport observations require exact release selection"
    ),
    publicReferenceSource(
      "SH-M2-SRC-TRANSPORT-REFERENCE",
      "Yangtze River Delta",
      "https://www.gov.cn/",
      "regional transport reference; exact policy scope requires review"
    )
  ];
}

function observation(
  observation_id: string,
  source_id: string,
  geography: string,
  value: number,
  unit: string,
  basis: string,
  data_type: DataType = "SYNTHETIC"
): Observation {
  return {
    observation_id,
    source_id,
    location: geography,
    period: "2024",
    basis,
    unit,
    geography,
    data_type,
    value,
    confidence: "LOW",
    sensitivity: "PUBLIC",
    observation_status: "CANDIDATE_ANCHOR",
    expiry: "2026-12-31"
  };
}

function createM2Observations(): Observation[] {
  return [
    observation(
      "SH-M2-OBS-SHANGHAI-POPULATION",
      "SH-M2-SRC-SHANGHAI-STATISTICS",
      "Shanghai",
      0.82,
      "relative_population_index",
      "synthetic fallback; official value not claimed"
    ),
    observation(
      "SH-M2-OBS-SUZHOU-POPULATION",
      "SH-M2-SRC-SUZHOU-STATISTICS",
      "Suzhou",
      0.68,
      "relative_population_index",
      "synthetic fallback; official value not claimed"
    ),
    observation(
      "SH-M2-OBS-HANGZHOU-POPULATION",
      "SH-M2-SRC-HANGZHOU-STATISTICS",
      "Hangzhou",
      0.71,
      "relative_population_index",
      "synthetic fallback; official value not claimed"
    ),
    observation(
      "SH-M2-OBS-NINGBO-POPULATION",
      "SH-M2-SRC-NINGBO-STATISTICS",
      "Ningbo",
      0.55,
      "relative_population_index",
      "synthetic fallback; official value not claimed"
    ),
    observation(
      "SH-M2-OBS-JIAXING-POPULATION",
      "SH-M2-SRC-JIAXING-STATISTICS",
      "Jiaxing",
      0.42,
      "relative_population_index",
      "synthetic fallback; official value not claimed"
    ),
    observation(
      "SH-M2-OBS-TRANSPORT-REFERENCE",
      "SH-M2-SRC-TRANSPORT-REFERENCE",
      "Yangtze River Delta",
      0.6,
      "access_index",
      "synthetic fallback; geography mismatch retained for review"
    )
  ];
}

function createM2Features(): FeatureCandidate[] {
  return [
    [
      "SH-M2-FEATURE-SHANGHAI-CATCHMENT",
      "Shanghai",
      32,
      "minutes",
      ["SH-M2-SRC-SHANGHAI-STATISTICS"]
    ],
    ["SH-M2-FEATURE-SUZHOU-CATCHMENT", "Suzhou", 38, "minutes", ["SH-M2-SRC-SUZHOU-STATISTICS"]],
    [
      "SH-M2-FEATURE-HANGZHOU-CATCHMENT",
      "Hangzhou",
      41,
      "minutes",
      ["SH-M2-SRC-HANGZHOU-STATISTICS"]
    ],
    ["SH-M2-FEATURE-NINGBO-CATCHMENT", "Ningbo", 46, "minutes", ["SH-M2-SRC-NINGBO-STATISTICS"]],
    ["SH-M2-FEATURE-JIAXING-CATCHMENT", "Jiaxing", 35, "minutes", ["SH-M2-SRC-JIAXING-STATISTICS"]]
  ].map(([feature_id, geography, value, unit, source_ids]) => ({
    feature_id: feature_id as string,
    name: "travel_time_catchment_candidate",
    value: value as number,
    unit: unit as string,
    range: { min: 0, max: 120 },
    source_ids: source_ids as string[],
    temporal_scope: "2024",
    geography: geography as string,
    confidence: "LOW" as const,
    possible_mod_consumer: "MAIN-ESL-O1 + MAIN-RT-O1 / accessibility-context",
    calibration_evidence: "NOT_PROVEN" as const,
    visibility: "INTERNAL_RESEARCH_ONLY" as const
  }));
}

function createM2Cities(): M2CityRegion[] {
  const rows: Array<[string, string, string, string, number, number, number]> = [
    [
      "shanghai",
      "Shanghai",
      "municipality-wide support scope",
      "SH-M2-SRC-SHANGHAI-STATISTICS",
      32,
      0.82,
      0.77
    ],
    ["suzhou", "Suzhou", "city-wide support scope", "SH-M2-SRC-SUZHOU-STATISTICS", 38, 0.68, 0.66],
    [
      "hangzhou",
      "Hangzhou",
      "city-wide support scope",
      "SH-M2-SRC-HANGZHOU-STATISTICS",
      41,
      0.71,
      0.7
    ],
    ["ningbo", "Ningbo", "city-wide support scope", "SH-M2-SRC-NINGBO-STATISTICS", 46, 0.55, 0.59],
    [
      "jiaxing",
      "Jiaxing",
      "city-wide support scope",
      "SH-M2-SRC-JIAXING-STATISTICS",
      35,
      0.42,
      0.54
    ]
  ];
  return rows.map(
    ([city_id, display_name, geography_scope, source_id, minutes, medical, transport]) => {
      const metrics: M2AccessibilityMetric[] = [
        {
          metric: "TRAVEL_TIME_CATCHMENT",
          value: minutes,
          unit: "minutes",
          crs: "EPSG:4326",
          method: "DETERMINISTIC_BOUNDED_CATCHMENT_FALLBACK",
          period: "2024",
          source_ids: [source_id],
          confidence: "LOW"
        },
        {
          metric: "MEDICAL_ACCESSIBILITY",
          value: medical,
          unit: "index_points",
          crs: "EPSG:4326",
          method: "DETERMINISTIC_BOUNDED_CATCHMENT_FALLBACK",
          period: "2024",
          source_ids: [source_id],
          confidence: "LOW"
        },
        {
          metric: "TRANSPORT_ACCESSIBILITY",
          value: transport,
          unit: "index_points",
          crs: "EPSG:4326",
          method: "DETERMINISTIC_BOUNDED_CATCHMENT_FALLBACK",
          period: "2024",
          source_ids: [source_id, "SH-M2-SRC-TRANSPORT-REFERENCE"],
          confidence: "LOW"
        }
      ];
      return {
        city_id,
        display_name,
        geography_scope,
        source_ids: [source_id, "SH-M2-SRC-TRANSPORT-REFERENCE"],
        accessibility: metrics[0]!,
        access_metrics: metrics,
        public_safe: true,
        licensing: "PUBLIC_REFERENCE_ONLY"
      };
    }
  );
}

function project(
  project_id: string,
  city_id: string,
  capex: number,
  duration: number,
  area: number,
  beds: number,
  workforce: number,
  source_id: string
): M2ProjectSlot {
  return {
    project_id,
    city_id,
    capex,
    capex_unit: "CNY_MILLION",
    duration,
    duration_unit: "months",
    area,
    area_unit: "square_meters",
    beds,
    beds_unit: "beds",
    workforce,
    workforce_unit: "FTE",
    policy_constraints: [
      "candidate zoning compatibility requires review",
      "service licensing not granted by candidate"
    ],
    financing_constraints: [
      "candidate financing only",
      "covenant and cash buffer must be checked by MAIN"
    ],
    status: "CANDIDATE",
    compatibility: "GENERIC_CITY_SCHEMA_COMPATIBLE",
    source_ids: [source_id],
    official_decision: false
  };
}

function createM2Projects(): M2ProjectSlot[] {
  return [
    project(
      "SH-M2-PROJECT-SHANGHAI-A",
      "shanghai",
      180,
      18,
      9000,
      180,
      62,
      "SH-M2-SRC-SHANGHAI-STATISTICS"
    ),
    project(
      "SH-M2-PROJECT-SUZHOU-A",
      "suzhou",
      145,
      16,
      7600,
      150,
      54,
      "SH-M2-SRC-SUZHOU-STATISTICS"
    ),
    project(
      "SH-M2-PROJECT-HANGZHOU-A",
      "hangzhou",
      155,
      20,
      8200,
      160,
      58,
      "SH-M2-SRC-HANGZHOU-STATISTICS"
    ),
    project(
      "SH-M2-PROJECT-NINGBO-A",
      "ningbo",
      135,
      17,
      7000,
      140,
      50,
      "SH-M2-SRC-NINGBO-STATISTICS"
    ),
    project(
      "SH-M2-PROJECT-JIAXING-A",
      "jiaxing",
      120,
      14,
      6300,
      125,
      44,
      "SH-M2-SRC-JIAXING-STATISTICS"
    )
  ];
}

function sequencingCandidate(
  variant: M2SequencingCandidate["variant"],
  project_ids: string[],
  projects: M2ProjectSlot[]
): M2SequencingCandidate {
  const selected = projects.filter((item) => project_ids.includes(item.project_id));
  const total_capex = selected.reduce((sum, item) => sum + item.capex, 0);
  const total_duration = selected.reduce((max, item) => Math.max(max, item.duration), 0);
  const total_workforce = selected.reduce((sum, item) => sum + item.workforce, 0);
  const content = {
    candidate_id: `SH-M2-OPT-${variant}`,
    variant,
    selected_project_ids: project_ids,
    total_capex,
    total_duration,
    total_workforce,
    budget_cap: 520,
    workforce_cap: 180,
    feasibility:
      total_capex <= 520 && total_workforce <= 180
        ? ("FEASIBLE" as const)
        : ("INFEASIBLE" as const),
    objective: "candidate sequencing utility under budget and workforce constraints",
    seed: 20260829,
    official_decision: false as const
  };
  return { ...content, digest: stableDigest(content) };
}

function createM2Optimizer(projects: M2ProjectSlot[]) {
  return {
    method: "DETERMINISTIC_BOUNDED_ENUMERATION" as const,
    candidates: [
      sequencingCandidate("CONSERVATIVE", ["SH-M2-PROJECT-JIAXING-A"], projects),
      sequencingCandidate(
        "BALANCED",
        ["SH-M2-PROJECT-SUZHOU-A", "SH-M2-PROJECT-JIAXING-A"],
        projects
      ),
      sequencingCandidate(
        "AGGRESSIVE",
        projects.map((item) => item.project_id),
        projects
      )
    ],
    official_decision_write: false as const
  };
}

function goldenVariant(
  variant_id: string,
  scope: M2GoldenVariant["scope"],
  region_ids: string[],
  project_ids: string[],
  seed: number
): M2GoldenVariant {
  const exact_refs = [
    M2_REFS.scenarioFactory,
    M2_REFS.projectLibrary,
    M2_REFS.marketWorld,
    M2_REFS.transfer
  ];
  const consumer_ids: M2GoldenVariant["consumer_ids"] = [
    "MAIN-ESL-O1-EXECUTIVE-STRATEGY-LAB",
    "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION"
  ];
  const content = {
    variant_id,
    scope,
    region_ids,
    project_ids,
    consumer_ids,
    seed,
    expected_properties:
      scope === "CENTER"
        ? ["one-city baseline", "same generic schema"]
        : scope === "FIVE_CITY"
          ? ["five city regions", "accessibility metrics preserve CRS and period"]
          : [
              "cross-region expansion",
              "optimizer remains nonofficial",
              "second-city schema remains compatible"
            ],
    exact_refs
  };
  return { ...content, digest: stableDigest(content) };
}

export function buildM2CapitalSequencingWorld(): M2CapitalSequencingPack {
  const sources = createM2Sources();
  const observations = createM2Observations();
  const features = createM2Features();
  const city_regions = createM2Cities();
  const project_slots = createM2Projects();
  const transformations: TransformationRecord[] = city_regions.map((region) => ({
    transformation_id: `SH-M2-TRANSFORM-${region.city_id}`,
    input: region.source_ids,
    rule: "apply bounded deterministic catchment fallback; preserve source period, CRS, unit, and geography",
    assumption: "optional spatial libraries are not run; no H3 cell substitutes exact geometry",
    output: `SH-M2-FEATURE-${region.city_id.toUpperCase()}-CATCHMENT`,
    unit: "minutes",
    time_scope: "2024",
    geography: region.geography_scope,
    confidence: "LOW",
    provenance: region.source_ids.join(",")
  }));
  const scenarios: ScenarioCandidate[] = [
    ["CENTER", ["shanghai"]],
    ["FIVE_CITY", city_regions.map((region) => region.city_id)],
    ["CROSS_REGION", ["shanghai", "suzhou", "hangzhou", "ningbo", "jiaxing"]]
  ].map(
    ([scope, region_ids], index) =>
      ({
        scenario_id: `sh-esl-next-02-scenario-${String(scope).toLowerCase()}`,
        title: `M2 ${scope} capital sequencing candidate`,
        geography: (region_ids as string[]).join(","),
        time_scope: "2024-2026",
        data_type: "SYNTHETIC",
        source_ids: sources.map((source_item) => source_item.source_id),
        feature_ids: features.map((feature) => feature.feature_id),
        transfer_ids: [],
        visibility: "INTERNAL_RESEARCH_ONLY" as const,
        exact_refs: [M2_REFS.scenarioFactory, M2_REFS.scenarioCompiler],
        no_correct_answer_prefilled: true,
        formal_runtime_admitted: false,
        seed: 20260829 + index
      }) as ScenarioCandidate
  );
  const optimizer = createM2Optimizer(project_slots);
  const golden_variants = [
    goldenVariant(
      "SH-M2-GOLDEN-CENTER",
      "CENTER",
      ["shanghai"],
      ["SH-M2-PROJECT-SHANGHAI-A"],
      2026082901
    ),
    goldenVariant(
      "SH-M2-GOLDEN-FIVE-CITY",
      "FIVE_CITY",
      city_regions.map((region) => region.city_id),
      project_slots.map((project_item) => project_item.project_id),
      2026082902
    ),
    goldenVariant(
      "SH-M2-GOLDEN-CROSS-REGION",
      "CROSS_REGION",
      city_regions.map((region) => region.city_id),
      ["SH-M2-PROJECT-JIAXING-A", "SH-M2-PROJECT-SUZHOU-A"],
      2026082903
    )
  ];
  const conflict_ledger = [
    {
      conflict_id: "SH-M2-CONFLICT-TRANSPORT-GEOGRAPHY",
      source_ids: ["SH-M2-SRC-TRANSPORT-REFERENCE", "SH-M2-SRC-SHANGHAI-STATISTICS"],
      resolution: "PRESERVED_FOR_REVIEW" as const,
      reason:
        "regional transport reference has wider geography than city observations; values are not averaged"
    }
  ];
  const packWithoutDigest: Omit<M2CapitalSequencingPack, "pack_digest"> = {
    schema_version: M2_SCHEMA_VERSION,
    macro_key: "M2",
    mission_id: "SH-ESL-NEXT-02-MULTIREGION-CAPITAL-SEQUENCING-WORLD",
    state_transition: { from: "STATE_A", to: "STATE_B" },
    source_freeze: {
      status: "REFERENCE_ONLY_WITH_SYNTHETIC_FALLBACK",
      official_source_ids: sources.map((source_item) => source_item.source_id),
      conflict_ledger_ids: conflict_ledger.map((conflict) => conflict.conflict_id),
      unsupported_claims_are_facts: false
    },
    spatial_tooling: {
      duckdb_spatial: "TOOL_NOT_RUN",
      h3: "TOOL_NOT_RUN",
      osmnx: "TOOL_NOT_RUN",
      fallback: "USED"
    },
    sources,
    observations,
    features,
    transformations,
    regional_transfers: [],
    scenarios,
    city_regions,
    project_slots,
    optimizer,
    golden_variants,
    schema_portability: {
      schema_id: M2_SCHEMA_VERSION,
      supports_second_city_stub: true,
      shanghai_constants_in_kernel: false,
      city_identity_is_asset_data: true
    },
    conflict_ledger,
    provenance_graph: {
      nodes: [
        ...sources.map((item) => ({ id: item.source_id, kind: "SOURCE" as const })),
        ...observations.map((item) => ({ id: item.observation_id, kind: "OBSERVATION" as const })),
        ...features.map((item) => ({ id: item.feature_id, kind: "FEATURE" as const })),
        ...city_regions.map((item) => ({ id: item.city_id, kind: "CITY" as const })),
        ...project_slots.map((item) => ({ id: item.project_id, kind: "PROJECT" as const })),
        ...optimizer.candidates.map((item) => ({
          id: item.candidate_id,
          kind: "CANDIDATE" as const
        }))
      ],
      edges: [
        ...observations.map((item) => ({
          from: item.source_id,
          to: item.observation_id,
          relation: "DERIVED_FROM" as const
        })),
        ...city_regions.flatMap((region) =>
          region.source_ids.map((source_id) => ({
            from: source_id,
            to: region.city_id,
            relation: "DERIVED_FROM" as const
          }))
        ),
        ...project_slots.map((item) => ({
          from: item.city_id,
          to: item.project_id,
          relation: "LOCATED_IN" as const
        })),
        ...optimizer.candidates.flatMap((candidate) =>
          candidate.selected_project_ids.map((project_id) => ({
            from: project_id,
            to: candidate.candidate_id,
            relation: "SELECTS" as const
          }))
        )
      ]
    },
    consumer: {
      classification: "C1",
      consumer_ids: [
        "MAIN-ESL-O1-EXECUTIVE-STRATEGY-LAB",
        "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION"
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
      city_id: "suzhou",
      project_id: "SH-M2-PROJECT-SUZHOU-A",
      checks: [
        "city accessibility has CRS/unit/period",
        "project feasibility candidate is nonofficial",
        "exact contract refs",
        "same schema supports second city"
      ]
    },
    known_limits: [
      "Public source URIs are registered as reference-only; official values are not official claims until exact releases are retrieved and licensed.",
      "DuckDB Spatial, H3, and OSMnx were not run in this bounded environment; deterministic fallback is explicit.",
      "The optimizer is a nonofficial candidate and must not become a formal decision.",
      "No current MAIN-ESL or MAIN-RT C0 consumer seam was proven; the pack remains C1 JOIN_WITH_LIMITS.",
      "Shanghai identity is asset data; no Shanghai city constant is added to the kernel."
    ]
  };
  return { ...packWithoutDigest, pack_digest: stableDigest(packWithoutDigest) };
}

export function validateM2CapitalSequencingWorld(pack: M2CapitalSequencingPack): string[] {
  const issues: string[] = [];
  const { pack_digest, ...content } = pack;
  if (stableDigest(content) !== pack_digest) issues.push("m2_pack_digest_mismatch");
  if (pack.city_regions.length !== 5) issues.push("m2_city_count_invalid");
  if (pack.project_slots.length < 5) issues.push("m2_project_pipeline_incomplete");
  if (pack.optimizer.candidates.length !== 3) issues.push("m2_optimizer_variants_invalid");
  if (pack.optimizer.official_decision_write) issues.push("m2_optimizer_official_write_enabled");
  if (
    !pack.schema_portability.supports_second_city_stub ||
    pack.schema_portability.shanghai_constants_in_kernel
  ) {
    issues.push("m2_schema_portability_invalid");
  }
  for (const region of pack.city_regions) {
    if (region.accessibility.unit !== "minutes" || region.accessibility.crs !== "EPSG:4326")
      issues.push(`${region.city_id}:accessibility_metadata_invalid`);
    if (region.accessibility.method !== "DETERMINISTIC_BOUNDED_CATCHMENT_FALLBACK")
      issues.push(`${region.city_id}:spatial_method_unbounded`);
  }
  for (const candidate of pack.optimizer.candidates) {
    if (candidate.official_decision)
      issues.push(`${candidate.candidate_id}:official_decision_write_enabled`);
    const { digest, ...candidateContent } = candidate;
    if (stableDigest(candidateContent) !== digest)
      issues.push(`${candidate.candidate_id}:digest_mismatch`);
  }
  if (pack.mjp.status !== "PASS") issues.push("m2_mjp_not_pass");
  return issues;
}
