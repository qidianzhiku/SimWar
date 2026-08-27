export type W5FormalRebaseClassification =
  | "CURRENT"
  | "APPROVED_BASELINE"
  | "SHADOW"
  | "RESEARCH"
  | "MISSING"
  | "STALE"
  | "DEFERRED"
  | "NOT_CALIBRATED";

export type W5FormalRebaseModelFamily =
  | "IDEAL_POINT_LANCASTER"
  | "BLP_RCNL"
  | "HUFF_SPATIAL"
  | "CAPACITY"
  | "WORKFORCE"
  | "QUALITY_RISK"
  | "FINANCE"
  | "SYSTEM_DYNAMICS"
  | "MARKETING"
  | "SHANGHAI"
  | "SYNTHETIC_WANT"
  | "CORE_REALIZED";

export type W5FormalRebaseGateStatus = "PASS" | "PASS_WITH_LIMITS";

export type W5FormalRebaseDriftLabel =
  | "CODE_DRIFT"
  | "DATA_DRIFT"
  | "ENVIRONMENT_ANOMALY"
  | "MEASUREMENT_MISMATCH"
  | "EXPECTED_MODEL_DIFFERENCE";

export interface W5FormalRebaseContext {
  mission_lineage_id: string;
  mission_start_utc: string;
  head_sha: string;
  tree_sha: string;
  timestamp: string;
  command: string;
  environment_fingerprint: string;
  artifact_digests?: Readonly<Record<string, string>>;
}

export interface W5FeatureAuthority {
  economic_meaning: string;
  feature_id: string;
  primary_producer: W5FormalRebaseModelFamily;
  unit: string;
  visibility: "CURRENT_CORE" | "SYNTHETIC_HEURISTIC" | "SHADOW" | "RESEARCH";
}

export interface W5AuthorityCensusEntry {
  actual_invocation_path: string;
  artifact_id: string;
  classification: W5FormalRebaseClassification;
  code_path: string;
  consumer: string;
  data_refs: readonly string[];
  digest: string;
  environment: string;
  fallback: string;
  formal_writer: string;
  family: W5FormalRebaseModelFamily;
  invocation_proven: boolean;
  input_schema: string;
  input_unit: string;
  known_limits: readonly string[];
  output_schema: string;
  output_unit: string;
  primary_producer: string;
  reproduction_command: string;
  seed: number | null;
  solver_evaluator: string;
  symbol: string;
  version: string;
  visibility: "CURRENT_CORE" | "SYNTHETIC_HEURISTIC" | "SHADOW" | "RESEARCH" | "MISSING";
}

export interface W5AuthorityCensus {
  causal_feature_ownership: readonly W5FeatureAuthority[];
  entries: readonly W5AuthorityCensusEntry[];
  head_sha: string;
  mission_lineage_id: string;
  status: W5FormalRebaseGateStatus;
  summary: {
    double_producer_count: number;
    unowned_feature_count: number;
    unknown_count: number;
  };
  timestamp: string;
  tree_sha: string;
}

export interface W5ReproductionRecord {
  command: string;
  environment_fingerprint: string;
  exit_code: 0;
  fallback_continues_core?: boolean;
  head_sha: string;
  input_digest: string;
  kind: "GOLDEN" | "DIFFERENTIAL" | "REPLAY" | "ZERO_SIGNAL_FALLBACK" | "DRIFT";
  mission_lineage_id: string;
  notes: readonly string[];
  output_digest: string;
  replay_writes_official_results?: false;
  result: W5FormalRebaseGateStatus;
  timestamp: string;
  tree_sha: string;
}

export interface W5ReproductionManifest {
  drift_labels: readonly W5FormalRebaseDriftLabel[];
  head_sha: string;
  mission_lineage_id: string;
  records: readonly W5ReproductionRecord[];
  standard_advanced_parity: true;
  status: W5FormalRebaseGateStatus;
  timestamp: string;
  tree_sha: string;
}

export interface W5FormalCurrentModelBaseline {
  causal_feature_ownership: readonly W5FeatureAuthority[];
  fallback: {
    official_path_continues: true;
    plane_off: "DETERMINISTIC_CORE";
    second_runtime: false;
  };
  head_sha: string;
  identity: {
    model_version: string;
    parameter_digest: string;
    scenario: string;
    seed: number;
  };
  known_limits: readonly string[];
  mission_lineage_id: string;
  model_families: Readonly<Record<W5FormalRebaseModelFamily, W5AuthorityCensusEntry>>;
  replay: {
    deterministic: true;
    non_overwrite: true;
    exact_binding: true;
  };
  shanghai: {
    data_classification: "SYNTHETIC" | "ASSUMPTION";
    provenance: "SYNTHETIC_ASSUMPTION_NOT_CALIBRATED";
  };
  standard_advanced_parity: true;
  status: W5FormalRebaseGateStatus;
  system_dynamics: {
    official: false;
    status: "SHADOW_ONLY";
  };
  timestamp: string;
  tree_sha: string;
  synthetic_want: {
    official: false;
    status: "SYNTHETIC_HEURISTIC";
  };
}
