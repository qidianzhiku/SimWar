export type DemandAttributes = Readonly<Record<string, number>>;

export interface DemandProduct {
  attributes: DemandAttributes;
  attractiveness: number;
  distance: number;
  firm_id: string;
  product_id: string;
  reachable: boolean;
  price: number;
}

export interface DemandCohort {
  cohort_id: string;
  ideal_attributes: DemandAttributes;
  size: number;
}

export interface DemandInstrument {
  product_id: string;
  values: readonly number[];
}

export interface DemandMarket {
  cohorts: readonly DemandCohort[];
  instruments: readonly DemandInstrument[];
  market_id: string;
  outside_option: { available: boolean; utility: number };
  products: readonly DemandProduct[];
}

export interface DemandBindingInput {
  artifact_digest: string;
  artifact_id: string;
  course_id: string;
  model_version: string;
  model_version_id: string;
  parameter_set_id: string;
  round_no: number;
  run_id: string;
  scenario_id: string;
  seed: number;
  team_id: string;
  tenant_id: string;
}

export interface DemandExactBinding extends DemandBindingInput {
  binding_digest: string;
}

export interface DemandCoefficients {
  ideal_fit: number;
  intercept: number;
  price: number;
  quality: number;
  spatial: number;
}

export interface DemandModelVersionInput {
  coefficients: DemandCoefficients;
  model_version_id: string;
  source_ref: string;
  version: string;
}

export interface DemandModelVersion {
  artifact: {
    artifact_id: string;
    content_digest: string;
    format: "governed-demand-typescript-candidate";
    source_ref: string;
  };
  coefficients: DemandCoefficients;
  content_digest: string;
  model_family: "governed_demand_candidate";
  model_version_id: string;
  no_implicit_latest: true;
  runtime_activation: false;
  status: "CANDIDATE";
  version: string;
}

export interface GovernedDemandRuntimeInput {
  exact_binding: DemandExactBinding;
  markets: readonly DemandMarket[];
  model_version: DemandModelVersion;
  plane: "OFF" | "ON";
}

export interface IdealLancasterResult {
  attribute_distance: number;
  fit_score: number;
  lineage: { feature_id: "ideal_lancaster_fit"; source_ref: string; unit: "dimensionless" };
  utility_component: number;
}

export interface HuffSpatialResult {
  lineage: { feature_id: "huff_spatial_weight"; source_ref: string; unit: "normalized_weight" };
  outside_option_weight: number;
  weights: readonly {
    normalized_weight: number;
    product_id: string;
    reachable: boolean;
    raw_weight: number;
  }[];
}

export interface DemandCandidateProductOutput {
  candidate_share: number;
  firm_id: string;
  huff_spatial_weight: number;
  ideal_lancaster_fit: number;
  product_id: string;
  utility: number;
}

export interface DemandCandidateMarketOutput {
  market_id: string;
  outside_option_share: number;
  products: readonly DemandCandidateProductOutput[];
}

export interface GovernedDemandRuntimeOutput {
  authority_flags: { official_truth_write: false; provider_calls: 0; settlement_write: false };
  fallback: {
    applied: boolean;
    plane: "CURRENT_W5_SYNTHETIC_WANT" | "NONE";
    reason: "DEMAND_CANDIDATE_PLANE_OFF" | "NONE";
  };
  lineage: {
    feature_ownership: readonly ["ideal_lancaster_fit", "huff_spatial_weight"];
    producer: "O3_GOVERNED_DEMAND_CANDIDATE";
    source_classification: "SYNTHETIC_GOLDEN";
  };
  markets: readonly DemandCandidateMarketOutput[];
  model_version_ref: { content_digest: string; model_version_id: string; version: string };
  replay_input_digest: string;
  status: "FALLBACK" | "PASS";
}

export type DemandCandidateErrorCode =
  | "MODEL_VERSION_REFERENCE_INVALID"
  | "WRONG_SCOPE_REF_DIGEST"
  | "OUT_OF_DOMAIN"
  | "NO_INSTRUMENT"
  | "INVALID_SHARES"
  | "NUMERIC_OVERFLOW";
