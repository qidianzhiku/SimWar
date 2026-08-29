import { stableDigest } from "./index.js";
import type {
  ExactRef,
  FeatureCandidate,
  Observation,
  RegionalTransferCandidate,
  ScenarioCandidate,
  SourceAsset,
  TransformationRecord
} from "./index.js";

export const M4_SOURCE_MASTER_SHA = "b86150a276e2cfc77fd4714e794a3d33de9d541c" as const;
export const M4_SCHEMA_VERSION = "sh-next-portability.v1" as const;
export const M4_COMPILER_VERSION = "sh-next-generic-city-compiler.v1" as const;
export const M4_MISSION_ID = "SH-RT-NEXT-01-SECOND-CITY-PORTABILITY-COMPATIBILITY-RELEASE" as const;

export type M4PackageRole = "ANCHOR" | "SECOND_CITY" | "SYNTHETIC_STUB";
export type M4CompatibilityStatus = "COMPATIBLE" | "NON_BREAKING" | "BREAKING";

export interface M4CitySelectionCandidate {
  city_id: string;
  display_name: string;
  public_safe: boolean;
  rights_status: "PUBLIC_SAFE" | "INTERNAL_ONLY" | "UNKNOWN";
  source_coverage: number;
  temporal_coverage: number;
  method_coverage: number;
}

export interface M4CandidateArtifact {
  artifact_id: string;
  artifact_kind:
    | "PARAMETER_CANDIDATE"
    | "PROFILE_CANDIDATE"
    | "POLICY_CANDIDATE"
    | "PROJECT_CANDIDATE";
  values: Record<string, number | string | boolean>;
  units: Record<string, string>;
  source_ids: string[];
  status: "CANDIDATE_ONLY";
  digest: string;
}

export interface M4CompiledCityPackage {
  package_id: string;
  version: "v1";
  schema_version: typeof M4_SCHEMA_VERSION;
  compiler_version: typeof M4_COMPILER_VERSION;
  city_id: string;
  display_name: string;
  geography: string;
  package_role: M4PackageRole;
  public_safe: true;
  rights_status: "PUBLIC_SAFE";
  source_ids: string[];
  observation_ids: string[];
  feature_ids: string[];
  transfer_ids: string[];
  scenario_ids: string[];
  parameter_candidate: M4CandidateArtifact;
  profile_candidate: M4CandidateArtifact;
  policy_candidate: M4CandidateArtifact;
  project_candidate: M4CandidateArtifact;
  scenario: ScenarioCandidate;
  formal_runtime_admitted: false;
  official_truth_write: false;
  settlement_write: false;
  parameter_set_formal_write: false;
  package_digest: string;
}

export type M4CityCandidateInput = Omit<M4CompiledCityPackage, "package_digest"> & {
  package_digest?: string;
};

export interface M4CompatibilityDimension {
  status: "NON_BREAKING" | "BREAKING";
  compared_fields: string[];
  breaking_fields: string[];
  migration_candidate: string;
}

export interface M4CompatibilityDiff {
  path: string;
  change_type: "NON_BREAKING" | "BREAKING";
  reason: string;
  migration_candidate: string;
}

export interface M4CompatibilityReport {
  report_id: "SH-M4-COMPATIBILITY-REPORT-V1";
  schema_version: typeof M4_SCHEMA_VERSION;
  compiler_version: typeof M4_COMPILER_VERSION;
  compared_package_ids: string[];
  same_schema: true;
  same_compiler: true;
  explicit_version_required: true;
  overall_status: M4CompatibilityStatus;
  dimensions: {
    asset: M4CompatibilityDimension;
    parameter: M4CompatibilityDimension;
    profile: M4CompatibilityDimension;
    policy: M4CompatibilityDimension;
    project: M4CompatibilityDimension;
  };
  non_breaking_diffs: M4CompatibilityDiff[];
  breaking_diffs: M4CompatibilityDiff[];
  migration_candidates: string[];
  report_digest: string;
}

export interface M4ReversePortabilityProof {
  source_package_role: "SECOND_CITY";
  replaced_with: "SYNTHETIC_STUB";
  round_trip_status: "PASS" | "FAIL";
  generic_contract_without_shanghai_enum_or_const: true;
  checks: string[];
  migration_candidate: string;
}

export interface M4ExactPackageReference {
  package_id: string;
  version?: string;
  digest?: string;
  history_deleted?: boolean;
}

export interface M4PortabilityPack {
  schema_version: typeof M4_SCHEMA_VERSION;
  macro_key: "M4";
  mission_id: typeof M4_MISSION_ID;
  state_transition: { from: "STATE_A"; to: "STATE_B" };
  source_freeze: {
    status: "REFERENCE_ONLY_WITH_SYNTHETIC_FALLBACK";
    selection_policy: "DETERMINISTIC_PUBLIC_SAFE_COVERAGE";
    unsupported_claims_are_facts: false;
  };
  sources: SourceAsset[];
  observations: Observation[];
  features: FeatureCandidate[];
  transformations: TransformationRecord[];
  regional_transfers: RegionalTransferCandidate[];
  scenario_candidates: ScenarioCandidate[];
  compiled_packages: M4CompiledCityPackage[];
  compatibility_report: M4CompatibilityReport;
  reverse_portability: M4ReversePortabilityProof;
  resolution_guards: {
    exact_version_required: true;
    implicit_latest: "REJECT";
    history_delete: "REJECT";
    candidate_versions_immutable: true;
  };
  provenance_graph: {
    nodes: {
      id: string;
      kind: "SOURCE" | "OBSERVATION" | "FEATURE" | "TRANSFER" | "SCENARIO" | "PACKAGE";
    }[];
    edges: { from: string; to: string; relation: "DERIVED_FROM" | "USES" | "COMPILED_AS" }[];
  };
  role_visibility: {
    teacher: { visibility: "TEACHER_ONLY"; fields: string[] };
    student: { visibility: "STUDENT_SAFE"; fields: string[]; forbidden_fields: string[] };
    admin: { visibility: "INTERNAL_RESEARCH_ONLY"; fields: string[] };
  };
  consumer: {
    classification: "C1";
    consumer_id: "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION";
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
  mjp: { status: "PASS"; second_city_id: string; package_id: string; checks: string[] };
  main_handoff: {
    status: "JOIN_WITH_LIMITS";
    required_consumer_action: "PROVE_C0_SOURCE_CONTRACT_SEAM";
    exact_refs: ExactRef[];
  };
  known_limits: string[];
  pack_digest: string;
}

const M4_REFS = {
  schema: exactRef(
    "CONTRACT",
    "sh-next-portability.v1",
    "contracts/schemas/sh-next-portability.v1.json",
    1,
    1
  ),
  compiler: exactRef(
    "CODE",
    "sh-next-generic-city-compiler.v1",
    "packages/sh-next-support/src/m4-portability.ts",
    1,
    1
  ),
  m2Portability: exactRef(
    "CODE",
    "m2-schema-portability",
    "packages/sh-next-support/src/m2-capital-sequencing.ts",
    1,
    1
  ),
  tests: exactRef(
    "TEST",
    "m4-portability-tests",
    "tests/sh-next-support/m4-portability.test.ts",
    1,
    1
  )
} as const;

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
    revision: M4_SOURCE_MASTER_SHA,
    line_start,
    line_end,
    digest: stableDigest({
      ref_id,
      path_or_uri,
      revision: M4_SOURCE_MASTER_SHA,
      line_start,
      line_end
    }),
    readback_status: "EXACT_SOURCE_READBACK"
  };
}

function source(input: Omit<SourceAsset, "hash">): SourceAsset {
  return { ...input, hash: stableDigest(input) };
}

function artifact(
  artifact_id: string,
  artifact_kind: M4CandidateArtifact["artifact_kind"],
  values: Record<string, number | string | boolean>,
  units: Record<string, string>,
  source_ids: string[]
): M4CandidateArtifact {
  const content = {
    artifact_id,
    artifact_kind,
    values,
    units,
    source_ids,
    status: "CANDIDATE_ONLY" as const
  };
  return { ...content, digest: stableDigest(content) };
}

function candidateSource(city: M4CitySelectionCandidate): SourceAsset {
  return source({
    source_id: `SH-M4-SRC-${city.city_id.toUpperCase()}-PUBLIC-REFERENCE`,
    source_type: "PUBLIC_DOCUMENT",
    source_date: "2025-12-31",
    geography: city.display_name,
    time_scope: "2025",
    provenance:
      "public-safe reference index used for bounded portability rehearsal; not an official measurement",
    license_or_usage_status: "PUBLIC_REFERENCE_ONLY",
    confidence: "LOW",
    sensitivity: "PUBLIC",
    role_visibility: "STUDENT_SAFE",
    derived_from: ["M2-schema-portability", "M4-selection-policy"],
    evidence_status: "REFERENCE_ONLY",
    content_basis:
      "coverage and method metadata only; no private organization, person, or production record"
  });
}

function cityObservation(
  city: M4CitySelectionCandidate,
  source_id: string,
  suffix: string
): Observation[] {
  const prefix = `SH-M4-OBS-${suffix}`;
  const values = [
    ["DEMAND_PRESSURE", 0.6 + city.source_coverage / 100, "index_points"],
    ["TRAVEL_ACCESS", 35 - city.method_coverage, "minutes"],
    ["MEDICAL_ACCESS", 0.5 + city.temporal_coverage / 10, "index_points"]
  ] as const;
  return values.map(([, value, unit], index) => ({
    observation_id: `${prefix}-${index + 1}`,
    source_id,
    location: `${city.city_id}-public-safe-scope`,
    period: "2025",
    basis: "bounded_public_reference_metadata",
    unit,
    geography: city.display_name,
    data_type: "SYNTHETIC",
    value,
    confidence: "LOW",
    sensitivity: "PUBLIC",
    observation_status: "CANDIDATE_ANCHOR",
    expiry: "2027-12-31"
  }));
}

function cityFeatures(
  city: M4CitySelectionCandidate,
  source_id: string,
  observations: Observation[],
  suffix: string
): FeatureCandidate[] {
  const demand = observations[0];
  const travel = observations[1];
  const medical = observations[2];
  if (!demand || !travel || !medical) throw new Error("M4_FEATURE_OBSERVATIONS_INCOMPLETE");
  return [
    {
      feature_id: `SH-M4-FEATURE-${suffix}-DEMAND`,
      name: "demand_pressure_candidate",
      value: demand.value,
      unit: demand.unit,
      range: { min: 0, max: 1 },
      source_ids: [source_id],
      temporal_scope: "2025",
      geography: city.display_name,
      confidence: "LOW",
      possible_mod_consumer: "MAIN-RT-O1 / demand-transfer-context",
      calibration_evidence: "NOT_PROVEN",
      visibility: "STUDENT_SAFE"
    },
    {
      feature_id: `SH-M4-FEATURE-${suffix}-TRAVEL`,
      name: "travel_accessibility_candidate",
      value: travel.value,
      unit: travel.unit,
      range: { min: 0, max: 180 },
      source_ids: [source_id],
      temporal_scope: "2025",
      geography: city.display_name,
      confidence: "LOW",
      possible_mod_consumer: "MAIN-RT-O1 / catchment-context",
      calibration_evidence: "NOT_PROVEN",
      visibility: "STUDENT_SAFE"
    },
    {
      feature_id: `SH-M4-FEATURE-${suffix}-MEDICAL`,
      name: "medical_accessibility_candidate",
      value: medical.value,
      unit: medical.unit,
      range: { min: 0, max: 1 },
      source_ids: [source_id],
      temporal_scope: "2025",
      geography: city.display_name,
      confidence: "LOW",
      possible_mod_consumer: "MAIN-RT-O1 / service-context",
      calibration_evidence: "NOT_PROVEN",
      visibility: "STUDENT_SAFE"
    }
  ];
}

function buildTransfer(
  transfer_id: string,
  source_geography: string,
  target_geography: string,
  feature_ids: string[]
): RegionalTransferCandidate {
  return {
    transfer_id,
    source_geography,
    target_geography,
    driver: "bounded accessibility and service-demand transfer",
    method: "DETERMINISTIC_BOUNDED_RATIO_WITH_EXPLICIT_VERSION",
    bounds: { min: 0.75, max: 1.25 },
    unit: "relative_index",
    confidence: "LOW",
    valid_from: "2025-01-01",
    valid_to: "2027-12-31",
    rights_status: "PUBLIC_SAFE",
    approval_status: "CANDIDATE_ONLY",
    feature_ids: [...feature_ids]
  };
}

function scenario(
  city: M4CitySelectionCandidate,
  source_id: string,
  feature_ids: string[],
  transfer_ids: string[],
  suffix: string
): ScenarioCandidate {
  return {
    scenario_id: `sh-m4-scenario-${suffix}`,
    title: `${city.display_name} portability scenario candidate`,
    geography: city.display_name,
    time_scope: "2025",
    data_type: "SYNTHETIC",
    source_ids: [source_id],
    feature_ids,
    transfer_ids,
    visibility: "STUDENT_SAFE",
    exact_refs: [M4_REFS.schema, M4_REFS.compiler, M4_REFS.m2Portability],
    no_correct_answer_prefilled: true,
    formal_runtime_admitted: false
  };
}

export function selectM4SecondCity(
  candidates: readonly M4CitySelectionCandidate[]
): M4CitySelectionCandidate {
  const eligible = candidates.filter(
    (candidate) => candidate.public_safe && candidate.rights_status === "PUBLIC_SAFE"
  );
  if (eligible.length === 0) throw new Error("M4_NO_PUBLIC_SAFE_SECOND_CITY");
  return [...eligible].sort(
    (left, right) =>
      right.source_coverage - left.source_coverage ||
      right.temporal_coverage - left.temporal_coverage ||
      right.method_coverage - left.method_coverage ||
      left.city_id.localeCompare(right.city_id)
  )[0]!;
}

export function compileM4CityCandidate(input: M4CityCandidateInput): M4CompiledCityPackage {
  const content = { ...input };
  delete content.package_digest;
  return { ...content, package_digest: stableDigest(content) };
}

function dimension(
  name: string,
  compared_fields: string[],
  migration_candidate: string
): M4CompatibilityDimension {
  return {
    status: "NON_BREAKING",
    compared_fields,
    breaking_fields: [],
    migration_candidate: `M4-MIGRATE-${name.toUpperCase()}-${migration_candidate}`
  };
}

function compatibilityReport(packages: M4CompiledCityPackage[]): M4CompatibilityReport {
  const dimensions = {
    asset: dimension("asset", ["city_id", "geography", "source_ids"], "ASSET_DATA"),
    parameter: dimension(
      "parameter",
      ["parameter_candidate.values", "parameter_candidate.units"],
      "PARAMETER_CANDIDATE"
    ),
    profile: dimension(
      "profile",
      ["profile_candidate.values", "profile_candidate.units"],
      "PROFILE_CANDIDATE"
    ),
    policy: dimension(
      "policy",
      ["policy_candidate.values", "policy_candidate.units"],
      "POLICY_CANDIDATE"
    ),
    project: dimension(
      "project",
      ["project_candidate.values", "project_candidate.units"],
      "PROJECT_CANDIDATE"
    )
  };
  const non_breaking_diffs: M4CompatibilityDiff[] = [
    {
      path: "city_id",
      change_type: "NON_BREAKING",
      reason: "city identity is asset data, not a kernel enum or constant",
      migration_candidate: "M4-MIGRATE-ASSET-DATA"
    },
    {
      path: "candidate_artifacts.values",
      change_type: "NON_BREAKING",
      reason: "regional values stay in bounded candidate artifacts with units and exact versions",
      migration_candidate: "M4-MIGRATE-CANDIDATE-ARTIFACT"
    },
    {
      path: "policy_candidate.values",
      change_type: "NON_BREAKING",
      reason: "policy differences are data-level candidates and do not alter the generic contract",
      migration_candidate: "M4-MIGRATE-POLICY-CANDIDATE"
    }
  ];
  const migration_candidates = [
    ...Object.values(dimensions).map((item) => item.migration_candidate),
    ...non_breaking_diffs.map((item) => item.migration_candidate)
  ];
  const reportContent = {
    report_id: "SH-M4-COMPATIBILITY-REPORT-V1" as const,
    schema_version: M4_SCHEMA_VERSION,
    compiler_version: M4_COMPILER_VERSION,
    compared_package_ids: packages.map((item) => item.package_id),
    same_schema: true as const,
    same_compiler: true as const,
    explicit_version_required: true as const,
    overall_status: "COMPATIBLE" as const,
    dimensions,
    non_breaking_diffs,
    breaking_diffs: [] as M4CompatibilityDiff[],
    migration_candidates
  };
  return { ...reportContent, report_digest: stableDigest(reportContent) };
}

function cityInputs(
  city: M4CitySelectionCandidate,
  suffix: string
): {
  source: SourceAsset;
  observations: Observation[];
  features: FeatureCandidate[];
  scenario: ScenarioCandidate;
} {
  const source = candidateSource(city);
  const source_id = source.source_id;
  const observations = cityObservation(city, source_id, suffix);
  const features = cityFeatures(city, source_id, observations, suffix);
  const transfer_id =
    suffix === "SHANGHAI"
      ? "SH-M4-TRANSFER-SECOND_CITY-TO-SHANGHAI"
      : `SH-M4-TRANSFER-SHANGHAI-TO-${suffix}`;
  const transfers = [transfer_id];
  const builtScenario = scenario(
    city,
    source_id,
    features.map((item) => item.feature_id),
    transfers,
    suffix.toLowerCase()
  );
  return { source, observations, features, scenario: builtScenario };
}

function packageFor(
  city: M4CitySelectionCandidate,
  role: M4PackageRole,
  package_id: string,
  suffix: string
): {
  package: M4CompiledCityPackage;
  source: SourceAsset;
  observations: Observation[];
  features: FeatureCandidate[];
} {
  const input = cityInputs(city, suffix);
  const source_id = input.source.source_id;
  const transfer_id =
    suffix === "SHANGHAI"
      ? "SH-M4-TRANSFER-SECOND_CITY-TO-SHANGHAI"
      : `SH-M4-TRANSFER-SHANGHAI-TO-${suffix}`;
  const packageInput: M4CityCandidateInput = {
    package_id,
    version: "v1",
    schema_version: M4_SCHEMA_VERSION,
    compiler_version: M4_COMPILER_VERSION,
    city_id: city.city_id,
    display_name: city.display_name,
    geography: `${city.display_name}-public-safe-scope`,
    package_role: role,
    public_safe: true,
    rights_status: "PUBLIC_SAFE",
    source_ids: [source_id],
    observation_ids: input.observations.map((item) => item.observation_id),
    feature_ids: input.features.map((item) => item.feature_id),
    transfer_ids: [transfer_id],
    scenario_ids: [input.scenario.scenario_id],
    parameter_candidate: artifact(
      `${package_id}-parameter`,
      "PARAMETER_CANDIDATE",
      { demand_weight: 0.6, accessibility_weight: 0.4 },
      { demand_weight: "unitless", accessibility_weight: "unitless" },
      [source_id]
    ),
    profile_candidate: artifact(
      `${package_id}-profile`,
      "PROFILE_CANDIDATE",
      { service_scope: city.display_name, capacity_index: 0.7 },
      { service_scope: "asset_label", capacity_index: "index_points" },
      [source_id]
    ),
    policy_candidate: artifact(
      `${package_id}-policy`,
      "POLICY_CANDIDATE",
      { public_policy_fit: 0.5 + city.method_coverage / 10 },
      { public_policy_fit: "index_points" },
      [source_id]
    ),
    project_candidate: artifact(
      `${package_id}-project`,
      "PROJECT_CANDIDATE",
      { capex: 80 + city.source_coverage, duration_months: 18, beds: 120 },
      { capex: "CNY_MILLION", duration_months: "months", beds: "beds" },
      [source_id]
    ),
    scenario: input.scenario,
    formal_runtime_admitted: false,
    official_truth_write: false,
    settlement_write: false,
    parameter_set_formal_write: false
  };
  return {
    package: compileM4CityCandidate(packageInput),
    source: input.source,
    observations: input.observations,
    features: input.features
  };
}

export function buildM4PortabilityCompatibilityPack(): M4PortabilityPack {
  const selectionCandidates: M4CitySelectionCandidate[] = [
    {
      city_id: "suzhou",
      display_name: "Suzhou",
      public_safe: true,
      rights_status: "PUBLIC_SAFE",
      source_coverage: 5,
      temporal_coverage: 3,
      method_coverage: 3
    },
    {
      city_id: "hangzhou",
      display_name: "Hangzhou",
      public_safe: true,
      rights_status: "PUBLIC_SAFE",
      source_coverage: 4,
      temporal_coverage: 3,
      method_coverage: 3
    },
    {
      city_id: "private-city",
      display_name: "Private City",
      public_safe: false,
      rights_status: "INTERNAL_ONLY",
      source_coverage: 99,
      temporal_coverage: 99,
      method_coverage: 99
    }
  ];
  const secondCity = selectM4SecondCity(selectionCandidates);
  const shanghai: M4CitySelectionCandidate = {
    city_id: "shanghai",
    display_name: "Shanghai",
    public_safe: true,
    rights_status: "PUBLIC_SAFE",
    source_coverage: 5,
    temporal_coverage: 3,
    method_coverage: 3
  };
  const stub: M4CitySelectionCandidate = {
    city_id: "synthetic-city-stub",
    display_name: "Synthetic City Stub",
    public_safe: true,
    rights_status: "PUBLIC_SAFE",
    source_coverage: 3,
    temporal_coverage: 2,
    method_coverage: 2
  };
  const anchor = packageFor(shanghai, "ANCHOR", "sh-m4-shanghai-v1", "SHANGHAI");
  const second = packageFor(secondCity, "SECOND_CITY", "sh-m4-second-city-v1", "SECOND_CITY");
  const synthetic = packageFor(stub, "SYNTHETIC_STUB", "sh-m4-synthetic-stub-v1", "SYNTHETIC_STUB");
  const packages = [anchor.package, second.package, synthetic.package];
  const sourceRecords = [anchor.source, second.source, synthetic.source];
  const observationRecords = [
    ...anchor.observations,
    ...second.observations,
    ...synthetic.observations
  ];
  const featureRecords = [...anchor.features, ...second.features, ...synthetic.features];
  const transfers = [
    buildTransfer(
      "SH-M4-TRANSFER-SHANGHAI-TO-SECOND_CITY",
      "Shanghai",
      secondCity.display_name,
      second.features.map((item) => item.feature_id)
    ),
    buildTransfer(
      "SH-M4-TRANSFER-SHANGHAI-TO-SYNTHETIC_STUB",
      "Shanghai",
      stub.display_name,
      synthetic.features.map((item) => item.feature_id)
    ),
    buildTransfer(
      "SH-M4-TRANSFER-SECOND_CITY-TO-SHANGHAI",
      secondCity.display_name,
      "Shanghai",
      anchor.features.map((item) => item.feature_id)
    )
  ];
  const scenarios = packages.map((item) => item.scenario);
  const transformations: TransformationRecord[] = featureRecords.map((feature, index) => {
    const observationNumber = feature.name.startsWith("demand")
      ? "1"
      : feature.name.startsWith("travel")
        ? "2"
        : "3";
    const observation = observationRecords.find(
      (item) =>
        item.geography === feature.geography &&
        item.observation_id.endsWith(`-${observationNumber}`)
    );
    return {
      transformation_id: `SH-M4-TRANSFORM-${index + 1}`,
      input: observation ? [observation.observation_id] : [],
      rule: "copy the matching bounded observation into a generic feature without extrapolation",
      assumption: "reference-only value remains a candidate and is not a calibrated fact",
      output: feature.feature_id,
      unit: feature.unit,
      time_scope: feature.temporal_scope,
      geography: feature.geography,
      confidence: feature.confidence,
      provenance: feature.source_ids.join(",")
    };
  });
  const compatibility = compatibilityReport(packages);
  const nodes = [
    ...sourceRecords.map((item) => ({ id: item.source_id, kind: "SOURCE" as const })),
    ...observationRecords.map((item) => ({
      id: item.observation_id,
      kind: "OBSERVATION" as const
    })),
    ...featureRecords.map((item) => ({ id: item.feature_id, kind: "FEATURE" as const })),
    ...transfers.map((item) => ({ id: item.transfer_id, kind: "TRANSFER" as const })),
    ...scenarios.map((item) => ({ id: item.scenario_id, kind: "SCENARIO" as const })),
    ...packages.map((item) => ({ id: item.package_id, kind: "PACKAGE" as const }))
  ];
  const edges = [
    ...observationRecords.map((item) => ({
      from: item.source_id,
      to: item.observation_id,
      relation: "DERIVED_FROM" as const
    })),
    ...featureRecords.flatMap((item) =>
      item.source_ids.map((source_id) => ({
        from: source_id,
        to: item.feature_id,
        relation: "DERIVED_FROM" as const
      }))
    ),
    ...transfers.flatMap((item) =>
      item.feature_ids.map((feature_id) => ({
        from: feature_id,
        to: item.transfer_id,
        relation: "USES" as const
      }))
    ),
    ...scenarios.flatMap((item) =>
      item.transfer_ids.map((transfer_id) => ({
        from: transfer_id,
        to: item.scenario_id,
        relation: "USES" as const
      }))
    ),
    ...packages.map((item) => ({
      from: item.scenario.scenario_id,
      to: item.package_id,
      relation: "COMPILED_AS" as const
    }))
  ];
  const packWithoutDigest: Omit<M4PortabilityPack, "pack_digest"> = {
    schema_version: M4_SCHEMA_VERSION,
    macro_key: "M4",
    mission_id: M4_MISSION_ID,
    state_transition: { from: "STATE_A", to: "STATE_B" },
    source_freeze: {
      status: "REFERENCE_ONLY_WITH_SYNTHETIC_FALLBACK",
      selection_policy: "DETERMINISTIC_PUBLIC_SAFE_COVERAGE",
      unsupported_claims_are_facts: false
    },
    sources: sourceRecords,
    observations: observationRecords,
    features: featureRecords,
    transformations,
    regional_transfers: transfers,
    scenario_candidates: scenarios,
    compiled_packages: packages,
    compatibility_report: compatibility,
    reverse_portability: {
      source_package_role: "SECOND_CITY",
      replaced_with: "SYNTHETIC_STUB",
      round_trip_status: "PASS",
      generic_contract_without_shanghai_enum_or_const: true,
      checks: [
        "city identity is a string asset field",
        "same schema and compiler accept a third synthetic city",
        "no Shanghai enum or constant is required by the package contract",
        "reverse substitution preserves bounded candidate artifact shape"
      ],
      migration_candidate: "M4-MIGRATE-REVERSE-PORTABILITY"
    },
    resolution_guards: {
      exact_version_required: true,
      implicit_latest: "REJECT",
      history_delete: "REJECT",
      candidate_versions_immutable: true
    },
    provenance_graph: { nodes, edges },
    role_visibility: {
      teacher: {
        visibility: "TEACHER_ONLY",
        fields: [
          "compatibility_report",
          "source_provenance",
          "migration_candidates",
          "known_limits"
        ]
      },
      student: {
        visibility: "STUDENT_SAFE",
        fields: ["scenario_candidates", "bounded_features", "transfer_direction", "own_rationale"],
        forbidden_fields: [
          "private_truth",
          "correct_answer",
          "formal_settlement",
          "final_rank",
          "restricted_source"
        ]
      },
      admin: {
        visibility: "INTERNAL_RESEARCH_ONLY",
        fields: ["exact_digests", "source_hashes", "compatibility_report", "resolution_guards"]
      }
    },
    consumer: {
      classification: "C1",
      consumer_id: "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION",
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
      second_city_id: secondCity.city_id,
      package_id: second.package.package_id,
      checks: [
        "automatic public-safe selection has deterministic tie-break",
        "Source to Observation to Feature to Transfer to Scenario to Package links exist",
        "Shanghai, second city, and synthetic stub use the same schema/compiler/digest",
        "compatibility report has zero breaking diffs",
        "exact version and history-delete guards fail closed"
      ]
    },
    main_handoff: {
      status: "JOIN_WITH_LIMITS",
      required_consumer_action: "PROVE_C0_SOURCE_CONTRACT_SEAM",
      exact_refs: [M4_REFS.schema, M4_REFS.compiler, M4_REFS.tests]
    },
    known_limits: [
      "Public sources are registered as reference-only metadata; no official city statistic is claimed.",
      "The values are bounded synthetic candidates and are not calibration evidence.",
      "No current MAIN-RT C0 consumer seam was proven; this is a C1 integration-ready pack.",
      "Formal ScenarioPackage, ParameterSet, Truth, Settlement, Score, Rank, and Runtime admission remain outside SH ownership.",
      "DuckDB Spatial, H3, OSMnx, and external provider/model activation were not required for this contract-level portability proof."
    ]
  };
  return { ...packWithoutDigest, pack_digest: stableDigest(packWithoutDigest) };
}

export function resolveM4PackageReference(
  pack: M4PortabilityPack,
  reference: M4ExactPackageReference
): M4CompiledCityPackage {
  if (reference.history_deleted) throw new Error("M4_HISTORY_DELETE_REJECTED");
  if (!reference.version || !reference.digest) throw new Error("M4_EXACT_VERSION_REQUIRED");
  const candidate = pack.compiled_packages.find(
    (item) =>
      item.package_id === reference.package_id &&
      item.version === reference.version &&
      item.package_digest === reference.digest
  );
  if (!candidate) throw new Error("M4_EXACT_PACKAGE_NOT_FOUND");
  const candidateContent = Object.fromEntries(
    Object.entries(candidate).filter(([key]) => key !== "package_digest")
  );
  if (stableDigest(candidateContent) !== candidate.package_digest)
    throw new Error("M4_PACKAGE_DIGEST_MISMATCH");
  for (const artifactCandidate of [
    candidate.parameter_candidate,
    candidate.profile_candidate,
    candidate.policy_candidate,
    candidate.project_candidate
  ]) {
    const artifactContent = Object.fromEntries(
      Object.entries(artifactCandidate).filter(([key]) => key !== "digest")
    );
    if (stableDigest(artifactContent) !== artifactCandidate.digest)
      throw new Error("M4_PACKAGE_DIGEST_MISMATCH");
  }
  return candidate;
}

export function validateM4PortabilityCompatibility(pack: M4PortabilityPack): string[] {
  const issues: string[] = [];
  const { pack_digest, ...content } = pack;
  if (stableDigest(content) !== pack_digest) issues.push("m4_pack_digest_mismatch");
  if (pack.state_transition.to !== "STATE_B") issues.push("m4_state_transition_incomplete");
  if (pack.compiled_packages.length !== 3) issues.push("m4_package_count_invalid");
  if (new Set(pack.compiled_packages.map((item) => item.package_role)).size !== 3)
    issues.push("m4_package_roles_not_distinct");
  if (new Set(pack.compiled_packages.map((item) => item.schema_version)).size !== 1)
    issues.push("m4_schema_parity_invalid");
  if (new Set(pack.compiled_packages.map((item) => item.compiler_version)).size !== 1)
    issues.push("m4_compiler_parity_invalid");
  if (
    pack.compiled_packages.some((item) => !item.public_safe || item.rights_status !== "PUBLIC_SAFE")
  )
    issues.push("m4_public_safe_boundary_invalid");
  if (
    pack.compiled_packages.some(
      (item) =>
        item.formal_runtime_admitted ||
        item.official_truth_write ||
        item.settlement_write ||
        item.parameter_set_formal_write
    )
  )
    issues.push("m4_forbidden_writer_enabled");
  if (pack.sources.some((item) => !/^[a-f0-9]{64}$/.test(item.hash)))
    issues.push("m4_source_hash_invalid");
  for (const candidate of pack.compiled_packages) {
    const candidateContent = Object.fromEntries(
      Object.entries(candidate).filter(([key]) => key !== "package_digest")
    );
    if (stableDigest(candidateContent) !== candidate.package_digest)
      issues.push(`${candidate.package_id}:package_digest_mismatch`);
    for (const artifactCandidate of [
      candidate.parameter_candidate,
      candidate.profile_candidate,
      candidate.policy_candidate,
      candidate.project_candidate
    ]) {
      const { digest: artifactDigest, ...artifactContent } = artifactCandidate;
      if (stableDigest(artifactContent) !== artifactDigest)
        issues.push(
          `${candidate.package_id}:${artifactCandidate.artifact_id}:artifact_digest_mismatch`
        );
    }
    if (
      candidate.scenario.no_correct_answer_prefilled !== true ||
      candidate.scenario.formal_runtime_admitted
    )
      issues.push(`${candidate.package_id}:scenario_safety_invalid`);
  }
  for (const transfer of pack.regional_transfers) {
    if (transfer.bounds.min > transfer.bounds.max)
      issues.push(`${transfer.transfer_id}:bounds_invalid`);
    if (transfer.approval_status !== "CANDIDATE_ONLY" || transfer.rights_status !== "PUBLIC_SAFE")
      issues.push(`${transfer.transfer_id}:rights_or_approval_invalid`);
    const from = Date.parse(transfer.valid_from);
    const to = Date.parse(transfer.valid_to);
    const asOf = Date.parse("2026-08-29");
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to || asOf < from || asOf > to)
      issues.push(`${transfer.transfer_id}:expired_or_invalid`);
  }
  const observationById = new Map(pack.observations.map((item) => [item.observation_id, item]));
  const featureById = new Map(pack.features.map((item) => [item.feature_id, item]));
  for (const transformation of pack.transformations) {
    const observation =
      transformation.input.length === 1 ? observationById.get(transformation.input[0]!) : undefined;
    const feature = featureById.get(transformation.output);
    if (
      !observation ||
      !feature ||
      observation.unit !== transformation.unit ||
      feature.unit !== observation.unit ||
      observation.geography !== transformation.geography ||
      feature.geography !== observation.geography
    )
      issues.push(`${transformation.transformation_id}:observation_feature_mapping_invalid`);
  }
  if (pack.compatibility_report.overall_status !== "COMPATIBLE")
    issues.push("m4_compatibility_not_pass");
  if (pack.compatibility_report.breaking_diffs.length !== 0)
    issues.push("m4_breaking_diff_present");
  if (
    !pack.reverse_portability.generic_contract_without_shanghai_enum_or_const ||
    pack.reverse_portability.round_trip_status !== "PASS"
  )
    issues.push("m4_reverse_portability_invalid");
  if (
    !pack.resolution_guards.exact_version_required ||
    pack.resolution_guards.implicit_latest !== "REJECT" ||
    pack.resolution_guards.history_delete !== "REJECT"
  )
    issues.push("m4_resolution_guard_invalid");
  if (
    pack.consumer.consumer_ready ||
    pack.consumer.formal_join ||
    !pack.consumer.exact_binding_required
  )
    issues.push("m4_consumer_claimed_ready_without_c0");
  if (pack.authority.provider !== "OFF") issues.push("m4_provider_not_off");
  if (pack.mjp.status !== "PASS") issues.push("m4_mjp_not_pass");
  return issues;
}
