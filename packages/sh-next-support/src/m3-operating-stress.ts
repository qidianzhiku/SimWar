import { stableDigest } from "./index.js";
import type {
  CandidateVisibility,
  Confidence,
  DataType,
  ExactRef,
  Observation,
  PrivacyClass,
  SourceAsset
} from "./index.js";

export const M3_SOURCE_MASTER_SHA = "0666cfcf449d3352564b6eee77cdf3891efdd8d6" as const;
export const M3_SCHEMA_VERSION = "sh-next-operating-stress.v1" as const;
export const M3_GSI_CONTRACT_ID = "gsi.governed.stakeholder.shadow.v1" as const;

export type M3OperatingLayerName =
  | "WANT"
  | "CAN"
  | "REALIZED"
  | "FINANCE"
  | "POLICY"
  | "STAKEHOLDER";
export type M3ShockKind = "DEMAND" | "WORKFORCE" | "QUALITY" | "CASH" | "POLICY" | "STAKEHOLDER";
export type M3ExperimentCorridor = "NORMAL" | "SINGLE_SHOCK" | "DOUBLE_SHOCK" | "RECOVERY";
export type M3Feasibility = "FEASIBLE" | "INFEASIBLE" | "UNKNOWN";

export interface M3OperatingLayer {
  layer: M3OperatingLayerName;
  metric: string;
  value: number;
  unit: string;
  data_type: DataType;
  period: string;
  geography: string;
  source_ids: string[];
  confidence: Confidence;
  privacy: PrivacyClass;
  candidate_only: true;
}

export interface M3ShockDefinition {
  shock_id: string;
  kind: M3ShockKind;
  target_layer: M3OperatingLayerName;
  description: string;
  delta: number;
  unit: string;
  bounds: { min: number; max: number };
  effective_from: string;
  effective_to: string;
  priority: number;
  evidence_state: "BOUNDED" | "UNKNOWN";
  data_type: "STRESS_TEST";
  source_ids: string[];
  visibility: CandidateVisibility;
  candidate_only: true;
}

export interface M3ExperimentCase {
  case_id: string;
  corridor: M3ExperimentCorridor;
  shock_ids: string[];
  seed: number;
  recovery_factor?: number;
  expected_properties: string[];
}

export interface M3Diagnostic {
  diagnostic_id: string;
  result_id: string;
  mechanism: "DEMAND" | "WORKFORCE" | "QUALITY" | "CASH" | "POLICY" | "STAKEHOLDER";
  message: string;
  visibility: "TEACHER_ONLY" | "STUDENT_SAFE" | "INTERNAL_RESEARCH_ONLY";
  evidence_refs: string[];
  candidate_only: true;
}

export interface M3StressMetrics {
  demand_index: number;
  workforce_capacity_ratio: number;
  quality_index: number;
  cash_runway_months: number;
  policy_burden_index: number;
  stakeholder_pressure_index: number;
}

export interface M3StressResult {
  result_id: string;
  case_id: string;
  corridor: M3ExperimentCorridor;
  shock_ids: string[];
  seed: number;
  metrics: M3StressMetrics;
  feasibility: M3Feasibility;
  diagnostics: M3Diagnostic[];
  recovery?: {
    candidate_only: true;
    prior_result_id: string;
    recovery_factor: number;
  };
  digest: string;
}

export interface M3GSISignalBinding {
  signal_id: string;
  stakeholder_type: "customer" | "regulator" | "bank" | "employee" | "media";
  intent:
    | "protect_demand"
    | "reduce_regulatory_risk"
    | "preserve_liquidity"
    | "retain_workforce"
    | "protect_reputation";
  bounded_value: number;
  source_proposal_count: 1;
}

export interface M3GSIShadowBinding {
  contract_id: typeof M3_GSI_CONTRACT_ID;
  resolver_version: "gsi-deterministic-resolver-v1";
  signal_bindings: M3GSISignalBinding[];
  provider: "OFF";
  plane_mode: "OFF" | "SHADOW";
  formal_truth_write: false;
  excluded_from_truth_hash: true;
  model_call_log: {
    model_call_log_id: string;
    model_version_id: "gsi-stakeholder-resolver-v1";
    provider: "OFF";
    input_digest: string;
    output_digest: string;
    exact_input_fields: string[];
    status: "DETERMINISTIC_SHADOW_CANDIDATE";
  };
  exact_refs: ExactRef[];
}

export interface M3RoleProjection {
  tenant_id: string;
  visibility: "TEACHER_ONLY" | "STUDENT_SAFE" | "INTERNAL_RESEARCH_ONLY";
  diagnostics: M3Diagnostic[];
  forbidden_fields: string[];
  source_scope: "BOUNDED_CANDIDATE";
}

export interface M3OperatingStressPack {
  schema_version: typeof M3_SCHEMA_VERSION;
  macro_key: "M3";
  mission_id: "SH-ESL-NEXT-03-OPERATING-ECONOMICS-STRESS-WORLD";
  tenant_id: string;
  state_transition: { from: "STATE_A"; to: "STATE_B" };
  source_freeze: {
    status: "REFERENCE_ONLY_WITH_SYNTHETIC_FALLBACK";
    gsi_source_status: "CURRENT_CONTRACT_REUSED";
    unsupported_claims_are_facts: false;
  };
  sources: SourceAsset[];
  observations: Observation[];
  baseline_layers: Record<M3OperatingLayerName, M3OperatingLayer>;
  shock_library: M3ShockDefinition[];
  experiment_matrix: M3ExperimentCase[];
  experiment_results: M3StressResult[];
  gsi_binding: M3GSIShadowBinding;
  replay: {
    input_digest: string;
    algorithm: "DETERMINISTIC_BOUNDED_STRESS_MATRIX_V1";
    truth_hash_exclusion: string[];
  };
  role_visibility: {
    teacher: { visibility: "TEACHER_ONLY"; fields: string[] };
    student: { visibility: "STUDENT_SAFE"; fields: string[]; forbidden_fields: string[] };
    admin: { visibility: "INTERNAL_RESEARCH_ONLY"; fields: string[] };
  };
  consumer: {
    classification: "C1";
    consumer_ids: [
      "MAIN-ESL-O1-EXECUTIVE-STRATEGY-LAB",
      "MAIN-GSI-O1-GOVERNED-STAKEHOLDER-SHADOW-PLANE"
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
    score_write: false;
    rank_write: false;
    provider: "OFF";
    runtime_authority: "JSON_INTERNAL_ONLY";
  };
  negative_controls: string[];
  mjp: { status: "PASS"; corridor: "M3-CORRIDOR-WORKFORCE-QUALITY-CASH"; checks: string[] };
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
    revision: M3_SOURCE_MASTER_SHA,
    line_start,
    line_end,
    digest: stableDigest({
      ref_id,
      path_or_uri,
      revision: M3_SOURCE_MASTER_SHA,
      line_start,
      line_end
    }),
    readback_status: "EXACT_SOURCE_READBACK"
  };
}

const M3_REFS = {
  gsiSharedContract: exactRef(
    "CONTRACT",
    "gsi-governed-stakeholder-shadow-plane.v1",
    "packages/shared-contracts/src/gsi-governed-stakeholder-shadow-plane.ts",
    1,
    260
  ),
  gsiContractDoc: exactRef(
    "CONTRACT",
    "gsi-governed-stakeholder-shadow-plane",
    "docs/contracts/gsi-governed-stakeholder-shadow-plane.md",
    1,
    20
  ),
  gsiSchema: exactRef(
    "CONTRACT",
    "gsi-governed-stakeholder-shadow-plane.v1.json",
    "contracts/schemas/gsi-governed-stakeholder-shadow-plane.v1.json",
    1,
    226
  ),
  gsiTests: exactRef(
    "TEST",
    "gsi-governed-stakeholder-shadow-plane-contract",
    "tests/contract/gsi-governed-stakeholder-shadow-plane-contract.test.ts",
    1,
    55
  )
};

const LAYER_ORDER: M3OperatingLayerName[] = [
  "WANT",
  "CAN",
  "REALIZED",
  "FINANCE",
  "POLICY",
  "STAKEHOLDER"
];

function sourceAsset(
  source_id: string,
  content_basis: string,
  derived_from: string[]
): SourceAsset {
  return {
    source_id,
    source_type: "SYNTHETIC",
    source_date: "2024-12-31",
    geography: "Shanghai-support-scope",
    time_scope: "2024-2026",
    provenance: "bounded synthetic operating-stress support anchor",
    license_or_usage_status: "INTERNAL_SUPPORT_ONLY",
    confidence: "LOW",
    sensitivity: "PUBLIC",
    role_visibility: "STUDENT_SAFE",
    derived_from,
    evidence_status: "REFERENCE_ONLY",
    content_basis,
    hash: stableDigest({ source_id, content_basis, derived_from })
  };
}

function createSources(): SourceAsset[] {
  return [
    sourceAsset(
      "SH-M3-SRC-OPERATING-BASELINE",
      "six-layer bounded baseline; not an official measurement",
      ["SH-M1-support-anchors"]
    ),
    sourceAsset(
      "SH-M3-SRC-WORKFORCE-SHOCK",
      "synthetic bounded workforce and care-supply stress direction",
      ["M3 operating stress design"]
    ),
    sourceAsset("SH-M3-SRC-QUALITY-SHOCK", "synthetic bounded quality incident stress direction", [
      "M3 operating stress design"
    ]),
    sourceAsset("SH-M3-SRC-CASH-SHOCK", "synthetic bounded cash runway stress direction", [
      "M3 operating stress design"
    ]),
    sourceAsset("SH-M3-SRC-POLICY-SHOCK", "synthetic bounded policy and payment stress direction", [
      "M3 operating stress design"
    ]),
    sourceAsset(
      "SH-M3-SRC-GSI-SHADOW",
      "reused GSI contract shape; deterministic Provider-OFF signal binding",
      ["gsi-governed-stakeholder-shadow-plane"]
    )
  ];
}

function createObservations(): Observation[] {
  const observations: ReadonlyArray<readonly [string, string, string, string, number, DataType]> = [
    [
      "SH-M3-OBS-WANT-DEMAND",
      "SH-M3-SRC-OPERATING-BASELINE",
      "WANT demand intent",
      "demand_index",
      0.72,
      "ASSUMPTION"
    ],
    [
      "SH-M3-OBS-CAN-CAPACITY",
      "SH-M3-SRC-OPERATING-BASELINE",
      "CAN delivery capacity",
      "capacity_ratio",
      0.78,
      "ASSUMPTION"
    ],
    [
      "SH-M3-OBS-REALIZED-QUALITY",
      "SH-M3-SRC-OPERATING-BASELINE",
      "REALIZED quality baseline",
      "quality_index",
      0.68,
      "SYNTHETIC"
    ],
    [
      "SH-M3-OBS-FINANCE-RUNWAY",
      "SH-M3-SRC-OPERATING-BASELINE",
      "FINANCE cash runway",
      "months",
      12,
      "INVESTMENT_MODEL"
    ],
    [
      "SH-M3-OBS-POLICY-BURDEN",
      "SH-M3-SRC-OPERATING-BASELINE",
      "POLICY burden baseline",
      "index_points",
      0.24,
      "ASSUMPTION"
    ],
    [
      "SH-M3-OBS-STAKEHOLDER-PRESSURE",
      "SH-M3-SRC-GSI-SHADOW",
      "STAKEHOLDER shadow pressure",
      "index_points",
      0.36,
      "STRESS_TEST"
    ]
  ] as const;
  return observations.map(([observation_id, source_id, basis, unit, value, data_type]) => ({
    observation_id,
    source_id,
    location: "Shanghai-support-scope",
    period: "2024-2026",
    basis,
    unit,
    geography: "Shanghai-support-scope",
    data_type,
    value,
    confidence: data_type === "SYNTHETIC" ? "MEDIUM" : "LOW",
    sensitivity: "PUBLIC",
    observation_status: "CANDIDATE_ANCHOR",
    expiry: "2026-12-31"
  }));
}

function createBaselineLayers(
  observations: Observation[]
): Record<M3OperatingLayerName, M3OperatingLayer> {
  const byId = new Map(observations.map((item) => [item.observation_id, item]));
  const layer = (
    name: M3OperatingLayerName,
    metric: string,
    observation_id: string,
    unit: string,
    data_type: DataType
  ): M3OperatingLayer => {
    const observation = byId.get(observation_id)!;
    return {
      layer: name,
      metric,
      value: Number(observation.value),
      unit,
      data_type,
      period: observation.period,
      geography: observation.geography,
      source_ids: [observation.source_id],
      confidence: observation.confidence,
      privacy: "PUBLIC",
      candidate_only: true
    };
  };
  return {
    WANT: layer(
      "WANT",
      "demand_intent_index",
      "SH-M3-OBS-WANT-DEMAND",
      "index_points",
      "ASSUMPTION"
    ),
    CAN: layer("CAN", "delivery_capacity_ratio", "SH-M3-OBS-CAN-CAPACITY", "ratio", "ASSUMPTION"),
    REALIZED: layer(
      "REALIZED",
      "quality_index",
      "SH-M3-OBS-REALIZED-QUALITY",
      "index_points",
      "SYNTHETIC"
    ),
    FINANCE: layer(
      "FINANCE",
      "cash_runway",
      "SH-M3-OBS-FINANCE-RUNWAY",
      "months",
      "INVESTMENT_MODEL"
    ),
    POLICY: layer(
      "POLICY",
      "policy_payment_burden",
      "SH-M3-OBS-POLICY-BURDEN",
      "index_points",
      "ASSUMPTION"
    ),
    STAKEHOLDER: layer(
      "STAKEHOLDER",
      "shadow_pressure",
      "SH-M3-OBS-STAKEHOLDER-PRESSURE",
      "index_points",
      "STRESS_TEST"
    )
  };
}

function createShockLibrary(): M3ShockDefinition[] {
  const source = (id: string) => [id];
  return [
    {
      shock_id: "SH-M3-SHOCK-DEMAND-DOWN",
      kind: "DEMAND",
      target_layer: "WANT",
      description: "bounded demand softening",
      delta: -0.12,
      unit: "index_points",
      bounds: { min: -0.2, max: 0 },
      effective_from: "2025-01-01",
      effective_to: "2025-12-31",
      priority: 1,
      evidence_state: "BOUNDED",
      data_type: "STRESS_TEST",
      source_ids: source("SH-M3-SRC-OPERATING-BASELINE"),
      visibility: "STUDENT_SAFE",
      candidate_only: true
    },
    {
      shock_id: "SH-M3-SHOCK-WORKFORCE-SUPPLY",
      kind: "WORKFORCE",
      target_layer: "CAN",
      description: "care workforce supply contraction",
      delta: -0.18,
      unit: "capacity_ratio",
      bounds: { min: -0.3, max: 0 },
      effective_from: "2025-01-01",
      effective_to: "2025-12-31",
      priority: 1,
      evidence_state: "BOUNDED",
      data_type: "STRESS_TEST",
      source_ids: source("SH-M3-SRC-WORKFORCE-SHOCK"),
      visibility: "STUDENT_SAFE",
      candidate_only: true
    },
    {
      shock_id: "SH-M3-SHOCK-QUALITY-INCIDENT",
      kind: "QUALITY",
      target_layer: "REALIZED",
      description: "quality incident pressure",
      delta: -0.22,
      unit: "index_points",
      bounds: { min: -0.35, max: 0 },
      effective_from: "2025-01-01",
      effective_to: "2025-06-30",
      priority: 1,
      evidence_state: "BOUNDED",
      data_type: "STRESS_TEST",
      source_ids: source("SH-M3-SRC-QUALITY-SHOCK"),
      visibility: "STUDENT_SAFE",
      candidate_only: true
    },
    {
      shock_id: "SH-M3-SHOCK-CASH-RATE",
      kind: "CASH",
      target_layer: "FINANCE",
      description: "financing and construction cost squeeze",
      delta: -3,
      unit: "months",
      bounds: { min: -6, max: 0 },
      effective_from: "2025-01-01",
      effective_to: "2025-12-31",
      priority: 1,
      evidence_state: "BOUNDED",
      data_type: "STRESS_TEST",
      source_ids: source("SH-M3-SRC-CASH-SHOCK"),
      visibility: "TEACHER_ONLY",
      candidate_only: true
    },
    {
      shock_id: "SH-M3-SHOCK-POLICY-PAYMENT",
      kind: "POLICY",
      target_layer: "POLICY",
      description: "policy and payment burden increase",
      delta: 0.18,
      unit: "index_points",
      bounds: { min: 0, max: 0.35 },
      effective_from: "2025-01-01",
      effective_to: "2025-12-31",
      priority: 2,
      evidence_state: "BOUNDED",
      data_type: "STRESS_TEST",
      source_ids: source("SH-M3-SRC-POLICY-SHOCK"),
      visibility: "STUDENT_SAFE",
      candidate_only: true
    },
    {
      shock_id: "SH-M3-SHOCK-STAKEHOLDER-UNKNOWN",
      kind: "STAKEHOLDER",
      target_layer: "STAKEHOLDER",
      description: "stakeholder signal requires abstention until evidence is resolved",
      delta: 0.12,
      unit: "index_points",
      bounds: { min: -0.2, max: 0.3 },
      effective_from: "2025-01-01",
      effective_to: "2025-12-31",
      priority: 2,
      evidence_state: "UNKNOWN",
      data_type: "STRESS_TEST",
      source_ids: source("SH-M3-SRC-GSI-SHADOW"),
      visibility: "TEACHER_ONLY",
      candidate_only: true
    }
  ];
}

function createExperimentMatrix(): M3ExperimentCase[] {
  const single = (suffix: string, shock_id: string): M3ExperimentCase => ({
    case_id: `SH-M3-CASE-SINGLE-${suffix}`,
    corridor: "SINGLE_SHOCK",
    shock_ids: [shock_id],
    seed: 301,
    expected_properties: ["single shock is isolated", "candidate diagnostic only"]
  });
  return [
    {
      case_id: "SH-M3-CASE-NORMAL",
      corridor: "NORMAL",
      shock_ids: [],
      seed: 300,
      expected_properties: ["baseline layers remain separate", "candidate diagnostic only"]
    },
    single("DEMAND", "SH-M3-SHOCK-DEMAND-DOWN"),
    single("WORKFORCE", "SH-M3-SHOCK-WORKFORCE-SUPPLY"),
    single("QUALITY", "SH-M3-SHOCK-QUALITY-INCIDENT"),
    single("CASH", "SH-M3-SHOCK-CASH-RATE"),
    single("POLICY", "SH-M3-SHOCK-POLICY-PAYMENT"),
    single("STAKEHOLDER", "SH-M3-SHOCK-STAKEHOLDER-UNKNOWN"),
    {
      case_id: "SH-M3-CASE-DOUBLE-WORKFORCE-QUALITY",
      corridor: "DOUBLE_SHOCK",
      shock_ids: ["SH-M3-SHOCK-WORKFORCE-SUPPLY", "SH-M3-SHOCK-QUALITY-INCIDENT"],
      seed: 302,
      expected_properties: [
        "workforce and quality coupling is explicit",
        "feasibility is candidate-only"
      ]
    },
    {
      case_id: "SH-M3-CASE-DOUBLE-QUALITY-CASH",
      corridor: "DOUBLE_SHOCK",
      shock_ids: ["SH-M3-SHOCK-QUALITY-INCIDENT", "SH-M3-SHOCK-CASH-RATE"],
      seed: 303,
      expected_properties: ["quality and cash coupling is explicit", "no official outcome"]
    },
    {
      case_id: "SH-M3-CASE-DOUBLE-WORKFORCE-QUALITY-CASH",
      corridor: "DOUBLE_SHOCK",
      shock_ids: [
        "SH-M3-SHOCK-WORKFORCE-SUPPLY",
        "SH-M3-SHOCK-QUALITY-INCIDENT",
        "SH-M3-SHOCK-CASH-RATE"
      ],
      seed: 304,
      expected_properties: ["MJP workforce quality cash corridor", "no official outcome"]
    },
    {
      case_id: "SH-M3-CASE-RECOVERY-WORKFORCE-QUALITY-CASH",
      corridor: "RECOVERY",
      shock_ids: [
        "SH-M3-SHOCK-WORKFORCE-SUPPLY",
        "SH-M3-SHOCK-QUALITY-INCIDENT",
        "SH-M3-SHOCK-CASH-RATE"
      ],
      seed: 305,
      recovery_factor: 0.5,
      expected_properties: ["recovery is a candidate corridor", "prior result remains immutable"]
    }
  ];
}

function createGSIBinding(): M3GSIShadowBinding {
  const signalInputs: ReadonlyArray<
    readonly [M3GSISignalBinding["stakeholder_type"], M3GSISignalBinding["intent"], number]
  > = [
    ["customer", "protect_demand", 0.18],
    ["regulator", "reduce_regulatory_risk", 0.2],
    ["bank", "preserve_liquidity", 0.16],
    ["employee", "retain_workforce", 0.22],
    ["media", "protect_reputation", 0.12]
  ];
  const signal_bindings: M3GSISignalBinding[] = signalInputs.map(
    ([stakeholder_type, intent, bounded_value], index) => ({
      signal_id: `SH-M3-GSI-SIGNAL-${index + 1}`,
      stakeholder_type,
      intent,
      bounded_value,
      source_proposal_count: 1
    })
  );
  const input = { contract_id: M3_GSI_CONTRACT_ID, plane_mode: "SHADOW", signal_bindings };
  return {
    contract_id: M3_GSI_CONTRACT_ID,
    resolver_version: "gsi-deterministic-resolver-v1",
    signal_bindings,
    provider: "OFF",
    plane_mode: "SHADOW",
    formal_truth_write: false,
    excluded_from_truth_hash: true,
    model_call_log: {
      model_call_log_id: "SH-M3-GSI-MODEL-CALL-001",
      model_version_id: "gsi-stakeholder-resolver-v1",
      provider: "OFF",
      input_digest: stableDigest(input),
      output_digest: stableDigest(signal_bindings),
      exact_input_fields: ["contract_id", "plane_mode", "signal_bindings"],
      status: "DETERMINISTIC_SHADOW_CANDIDATE"
    },
    exact_refs: [
      M3_REFS.gsiSharedContract,
      M3_REFS.gsiContractDoc,
      M3_REFS.gsiSchema,
      M3_REFS.gsiTests
    ]
  };
}

function metricFromLayers(
  baseline_layers: Record<M3OperatingLayerName, M3OperatingLayer>
): M3StressMetrics {
  return {
    demand_index: baseline_layers.WANT.value,
    workforce_capacity_ratio: baseline_layers.CAN.value,
    quality_index: baseline_layers.REALIZED.value,
    cash_runway_months: baseline_layers.FINANCE.value,
    policy_burden_index: baseline_layers.POLICY.value,
    stakeholder_pressure_index: baseline_layers.STAKEHOLDER.value
  };
}

function applyShock(metrics: M3StressMetrics, shock: M3ShockDefinition, factor: number): void {
  const delta = shock.delta * factor;
  switch (shock.kind) {
    case "DEMAND":
      metrics.demand_index += delta;
      break;
    case "WORKFORCE":
      metrics.workforce_capacity_ratio += delta;
      break;
    case "QUALITY":
      metrics.quality_index += delta;
      break;
    case "CASH":
      metrics.cash_runway_months += delta;
      break;
    case "POLICY":
      metrics.policy_burden_index += delta;
      break;
    case "STAKEHOLDER":
      metrics.stakeholder_pressure_index += delta;
      break;
  }
}

function makeResult(
  operating: Pick<M3OperatingStressPack, "baseline_layers" | "shock_library">,
  experiment: M3ExperimentCase,
  prior?: M3StressResult
): M3StressResult {
  const metrics = metricFromLayers(operating.baseline_layers);
  const shocks = experiment.shock_ids.map(
    (id) => operating.shock_library.find((shock) => shock.shock_id === id)!
  );
  const factor = experiment.recovery_factor ?? 1;
  for (const shock of shocks) applyShock(metrics, shock, factor);
  const hasUnknown = shocks.some((shock) => shock.evidence_state === "UNKNOWN");
  const infeasible =
    metrics.workforce_capacity_ratio < 0.5 ||
    metrics.quality_index < 0.5 ||
    metrics.cash_runway_months < 6;
  const feasibility: M3Feasibility = hasUnknown
    ? "UNKNOWN"
    : infeasible
      ? "INFEASIBLE"
      : "FEASIBLE";
  const result_id = `SH-M3-RESULT-${experiment.case_id.replace("SH-M3-CASE-", "")}`;
  const diagnosticDefinitions: Array<[M3Diagnostic["mechanism"], string, string[]]> = [
    ["DEMAND", "WANT demand intent is exposed as a candidate driver.", ["SH-M3-OBS-WANT-DEMAND"]],
    [
      "WORKFORCE",
      "CAN workforce capacity is stressed without rewriting formal capacity.",
      ["SH-M3-OBS-CAN-CAPACITY"]
    ],
    [
      "QUALITY",
      "REALIZED quality direction is diagnostic evidence, not a published result.",
      ["SH-M3-OBS-REALIZED-QUALITY"]
    ],
    ["CASH", "FINANCE runway is bounded for teaching analysis only.", ["SH-M3-OBS-FINANCE-RUNWAY"]],
    [
      "POLICY",
      "POLICY burden is kept distinct from customer demand and settlement.",
      ["SH-M3-OBS-POLICY-BURDEN"]
    ],
    [
      "STAKEHOLDER",
      "STAKEHOLDER signal remains shadow evidence and may abstain.",
      ["SH-M3-GSI-SIGNAL-1"]
    ]
  ];
  const activeMechanisms = new Set(shocks.map((shock) => shock.kind));
  if (experiment.corridor === "NORMAL") activeMechanisms.add("DEMAND");
  const diagnostics = diagnosticDefinitions
    .filter(([mechanism]) => activeMechanisms.has(mechanism))
    .map(([mechanism, message, evidence_refs]): M3Diagnostic => {
      const visibility: M3Diagnostic["visibility"] =
        mechanism === "CASH" || mechanism === "STAKEHOLDER" ? "TEACHER_ONLY" : "STUDENT_SAFE";
      return {
        diagnostic_id: `${result_id}-${mechanism}`,
        result_id,
        mechanism,
        message,
        visibility,
        evidence_refs,
        candidate_only: true
      };
    });
  const content = {
    case_id: experiment.case_id,
    corridor: experiment.corridor,
    diagnostics,
    feasibility,
    metrics,
    seed: experiment.seed,
    shock_ids: experiment.shock_ids
  };
  return {
    result_id,
    case_id: experiment.case_id,
    corridor: experiment.corridor,
    shock_ids: [...experiment.shock_ids],
    seed: experiment.seed,
    metrics,
    feasibility,
    diagnostics,
    ...(experiment.recovery_factor !== undefined && prior
      ? {
          recovery: {
            candidate_only: true as const,
            prior_result_id: prior.result_id,
            recovery_factor: experiment.recovery_factor
          }
        }
      : {}),
    digest: stableDigest(content)
  };
}

export function runM3StressMatrix(pack: M3OperatingStressPack): {
  input_digest: string;
  results: M3StressResult[];
} {
  const input = {
    baseline_layers: pack.baseline_layers,
    experiment_matrix: pack.experiment_matrix,
    shock_library: pack.shock_library
  };
  const results: M3StressResult[] = [];
  for (const experiment of pack.experiment_matrix) {
    const prior = experiment.recovery_factor === undefined ? undefined : results.at(-1);
    results.push(makeResult(pack, experiment, prior));
  }
  return { input_digest: stableDigest(input), results };
}

export function buildM3OperatingStressWorld(tenant_id = "tenant_demo"): M3OperatingStressPack {
  const sources = createSources();
  const observations = createObservations();
  const baseline_layers = createBaselineLayers(observations);
  const shock_library = createShockLibrary();
  const experiment_matrix = createExperimentMatrix();
  const gsi_binding = createGSIBinding();
  const replayInput = { baseline_layers, experiment_matrix, shock_library };
  const experiment_results = runM3StressMatrix({
    baseline_layers,
    experiment_matrix,
    shock_library
  } as M3OperatingStressPack).results;
  const replay = {
    input_digest: stableDigest(replayInput),
    algorithm: "DETERMINISTIC_BOUNDED_STRESS_MATRIX_V1" as const,
    truth_hash_exclusion: ["gsi_binding", "diagnostics", "candidate_only_data"]
  };
  const packWithoutDigest: Omit<M3OperatingStressPack, "pack_digest"> = {
    schema_version: M3_SCHEMA_VERSION,
    macro_key: "M3",
    mission_id: "SH-ESL-NEXT-03-OPERATING-ECONOMICS-STRESS-WORLD",
    tenant_id,
    state_transition: { from: "STATE_A", to: "STATE_B" },
    source_freeze: {
      status: "REFERENCE_ONLY_WITH_SYNTHETIC_FALLBACK",
      gsi_source_status: "CURRENT_CONTRACT_REUSED",
      unsupported_claims_are_facts: false
    },
    sources,
    observations,
    baseline_layers,
    shock_library,
    experiment_matrix,
    experiment_results,
    gsi_binding,
    replay,
    role_visibility: {
      teacher: {
        visibility: "TEACHER_ONLY",
        fields: [
          "all_candidate_layers",
          "shock_library",
          "experiment_results",
          "gsi_binding",
          "provenance"
        ]
      },
      student: {
        visibility: "STUDENT_SAFE",
        fields: ["mechanism", "safe_diagnostics", "shock_direction", "reflection_prompt"],
        forbidden_fields: ["private_truth", "raw_gsi_proposals", "official_score", "final_rank"]
      },
      admin: {
        visibility: "INTERNAL_RESEARCH_ONLY",
        fields: ["tenant_id", "source_hashes", "exact_refs", "replay", "negative_controls"]
      }
    },
    consumer: {
      classification: "C1",
      consumer_ids: [
        "MAIN-ESL-O1-EXECUTIVE-STRATEGY-LAB",
        "MAIN-GSI-O1-GOVERNED-STAKEHOLDER-SHADOW-PLANE"
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
      score_write: false,
      rank_write: false,
      provider: "OFF",
      runtime_authority: "JSON_INTERNAL_ONLY"
    },
    negative_controls: [
      "official_truth_write_rejected",
      "settlement_write_rejected",
      "student_private_signal_rejected",
      "cross_tenant_projection_rejected"
    ],
    mjp: {
      status: "PASS",
      corridor: "M3-CORRIDOR-WORKFORCE-QUALITY-CASH",
      checks: [
        "separated WANT/CAN/REALIZED/Finance/Policy/Stakeholder",
        "bounded triple stress",
        "teacher/student safe diagnostics"
      ]
    },
    known_limits: [
      "All operating values are synthetic bounded candidates and are not official measurements.",
      "GSI is reused as a Provider-OFF shadow contract; deterministic output is not AI effectiveness evidence.",
      "No current C0 MAIN consumer seam was proven; this pack remains a C1 forward contract.",
      "Diagnostics and feasibility are teaching/research candidates and never formal score, rank, settlement, or Truth.",
      "Unknown stakeholder evidence is retained as UNKNOWN and is not silently resolved."
    ]
  };
  return { ...packWithoutDigest, pack_digest: stableDigest(packWithoutDigest) };
}

export function validateM3OperatingStress(pack: M3OperatingStressPack): string[] {
  const issues: string[] = [];
  const { pack_digest, ...packContent } = pack;
  if (stableDigest(packContent) !== pack_digest) issues.push("m3_pack_digest_mismatch");
  if (JSON.stringify(Object.keys(pack.baseline_layers)) !== JSON.stringify(LAYER_ORDER)) {
    issues.push("m3_layer_separation_invalid");
  }
  if (!new Set(pack.experiment_matrix.map((item) => item.corridor)).has("RECOVERY")) {
    issues.push("m3_recovery_corridor_missing");
  }
  if (!new Set(pack.experiment_matrix.map((item) => item.corridor)).has("DOUBLE_SHOCK")) {
    issues.push("m3_double_corridor_missing");
  }
  if (pack.gsi_binding.contract_id !== M3_GSI_CONTRACT_ID || pack.gsi_binding.provider !== "OFF") {
    issues.push("m3_gsi_binding_invalid");
  }
  if (
    pack.authority.official_truth_write ||
    pack.authority.settlement_write ||
    pack.authority.parameter_set_formal_write ||
    pack.authority.score_write ||
    pack.authority.rank_write
  ) {
    issues.push("m3_forbidden_authority_enabled");
  }
  if (pack.consumer.formal_join || pack.consumer.consumer_ready)
    issues.push("m3_consumer_claimed_ready");
  if (pack.experiment_results.length !== pack.experiment_matrix.length)
    issues.push("m3_result_count_invalid");
  if (pack.experiment_results.some((result) => !/^[a-f0-9]{64}$/u.test(result.digest))) {
    issues.push("m3_result_digest_invalid");
  }
  if (!pack.experiment_results.some((result) => result.feasibility === "UNKNOWN")) {
    issues.push("m3_unknown_evidence_not_preserved");
  }
  if (pack.sources.some((source) => source.sensitivity === "RESTRICTED"))
    issues.push("m3_restricted_source_in_pack");
  return issues;
}

export function projectM3ForRole(
  pack: M3OperatingStressPack,
  role: "teacher" | "student" | "admin",
  tenant_id: string
): M3RoleProjection {
  if (tenant_id !== pack.tenant_id)
    throw new Error("tenant_scope mismatch: candidate pack belongs to another tenant");
  const visibility =
    role === "teacher"
      ? "TEACHER_ONLY"
      : role === "student"
        ? "STUDENT_SAFE"
        : "INTERNAL_RESEARCH_ONLY";
  const diagnostics = pack.experiment_results
    .flatMap((result) => result.diagnostics)
    .filter((diagnostic) => role === "teacher" || diagnostic.visibility === visibility);
  return {
    tenant_id,
    visibility,
    diagnostics,
    forbidden_fields: [...pack.role_visibility.student.forbidden_fields],
    source_scope: "BOUNDED_CANDIDATE"
  };
}
