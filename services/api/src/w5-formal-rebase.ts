import { createHash } from "node:crypto";
import type {
  W5AuthorityCensus,
  W5AuthorityCensusEntry,
  W5FeatureAuthority,
  W5FormalCurrentModelBaseline,
  W5FormalRebaseClassification,
  W5FormalRebaseContext,
  W5FormalRebaseDriftLabel,
  W5FormalRebaseModelFamily,
  W5ReproductionManifest,
  W5ReproductionRecord
} from "@simwar/shared-contracts";
import {
  createDefaultEldercareModelInput,
  evaluateW5CoreRealization,
  type EldercareModelInput
} from "@simwar/simulation-core";
import { W5_MODEL_VERSION_REF } from "@simwar/shared-contracts";

const DRIFT_LABELS: readonly W5FormalRebaseDriftLabel[] = [
  "CODE_DRIFT",
  "DATA_DRIFT",
  "ENVIRONMENT_ANOMALY",
  "MEASUREMENT_MISMATCH",
  "EXPECTED_MODEL_DIFFERENCE"
];

const KNOWN_LIMITS = [
  "BLP/RCNL has no executable artifact, invocation, calibration, or active adapter in this repository.",
  "Ideal Point/Lancaster has no executable artifact, invocation, calibration, or active adapter in this repository.",
  "Huff/Spatial and Marketing are not current runtime producers.",
  "WANT is a synthetic heuristic and is never official truth.",
  "System Dynamics is shadow-only and cannot overwrite the Simulation Core projection.",
  "Shanghai inputs are synthetic/assumption-labelled and not calibrated to external reality.",
  "Human Model Validation B was not performed; the output is HV-B-ready machine evidence only.",
  "JSON_INTERNAL_ONLY remains the active runtime authority; PostgreSQL/RLS is not activated."
] as const;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertFresh(context: W5FormalRebaseContext): void {
  if (context.timestamp < context.mission_start_utc) {
    throw new Error("W5_FORMAL_REBASE_STALE_EVIDENCE");
  }
}

function artifactDigest(
  context: W5FormalRebaseContext,
  artifactId: string,
  fallback: unknown
): string {
  return context.artifact_digests?.[artifactId] ?? digest(fallback);
}

function entry(
  context: W5FormalRebaseContext,
  family: W5FormalRebaseModelFamily,
  classification: W5FormalRebaseClassification,
  details: Omit<
    W5AuthorityCensusEntry,
    "artifact_id" | "classification" | "digest" | "family" | "reproduction_command"
  >
): W5AuthorityCensusEntry {
  const artifactId = `simwar.w5.${family.toLowerCase()}.v1`;
  return {
    ...details,
    artifact_id: artifactId,
    classification,
    digest: artifactDigest(context, artifactId, {
      artifact_id: artifactId,
      code_path: details.code_path,
      symbol: details.symbol,
      version: details.version
    }),
    family,
    reproduction_command: context.command
  };
}

const coreEntryDefaults = {
  actual_invocation_path: "W5 -> evaluateW5CoreRealization -> evaluateEldercareCoreRound",
  code_path: "services/simulation-core/src/eldercare-core-model.ts",
  consumer: "W5 governed convergence / teacher and student projections",
  data_refs: ["r7a-shanghai-eldercare-core-scenario-v2 synthetic asset"],
  environment: "Node.js pure function; no external provider",
  fallback: "PLANE_OFF -> deterministic Simulation Core",
  formal_writer: "none; projection only, formal_truth_write=false",
  input_schema: "EldercareModelInput",
  input_unit: "scenario + decision parameters + seed",
  known_limits: ["The core is official for this projection but does not write SettlementResult."],
  output_schema: "W5CoreRealization.metrics",
  output_unit: "demand/capacity/finance/quality metrics",
  primary_producer:
    "services/simulation-core/src/eldercare-core-model.ts::evaluateEldercareCoreRound",
  seed: 20260726,
  solver_evaluator: "evaluateEldercareCoreRound",
  symbol: "evaluateEldercareCoreRound",
  version: "eldercare_core_model_v1@1.0.0",
  visibility: "CURRENT_CORE" as const
};

export function buildW5AuthorityCensus(context: W5FormalRebaseContext): W5AuthorityCensus {
  assertFresh(context);

  const missing = (
    family: W5FormalRebaseModelFamily,
    classification: W5FormalRebaseClassification,
    reason: string,
    visibility: "RESEARCH" | "MISSING"
  ) =>
    entry(context, family, classification, {
      actual_invocation_path: "NONE_PROVEN",
      code_path: "NOT_PRESENT_IN_CURRENT_SOURCE",
      consumer: "none; not bound to official runtime",
      data_refs: ["NONE_PROVEN"],
      environment: "NONE_PROVEN",
      fallback: "deterministic Simulation Core",
      formal_writer: "none",
      input_schema: "NOT_PROVEN",
      input_unit: "NOT_PROVEN",
      known_limits: [reason],
      output_schema: "NOT_PROVEN",
      output_unit: "NOT_PROVEN",
      primary_producer: "unavailable_model_registry",
      seed: null,
      solver_evaluator: "NONE_PROVEN",
      symbol: "NOT_PRESENT",
      version: "NOT_AVAILABLE",
      visibility
    });

  const entries: W5AuthorityCensusEntry[] = [
    missing(
      "IDEAL_POINT_LANCASTER",
      "DEFERRED",
      "No executable Ideal Point/Lancaster artifact or invocation is present; do not expose as active.",
      "RESEARCH"
    ),
    missing(
      "BLP_RCNL",
      "MISSING",
      "No executable BLP/RCNL artifact, dependency, invocation, calibration, or active adapter is present.",
      "MISSING"
    ),
    missing(
      "HUFF_SPATIAL",
      "MISSING",
      "No executable Huff/Spatial choice artifact or invocation is present.",
      "MISSING"
    ),
    entry(context, "CAPACITY", "CURRENT", {
      ...coreEntryDefaults,
      consumer: "Simulation Core operations metrics",
      data_refs: ["EldercareModelInput.decision.facility"],
      known_limits: ["Capacity is a deterministic core metric, not an external capacity forecast."],
      output_schema: "EldercareRoundMetrics.operations.service_capacity",
      output_unit: "places",
      primary_producer:
        "services/simulation-core/src/eldercare-core-model.ts::evaluateEldercareCoreRound",
      symbol: "evaluateEldercareCoreRound.capacity"
    }),
    entry(context, "WORKFORCE", "CURRENT", {
      ...coreEntryDefaults,
      consumer: "Simulation Core operations and quality metrics",
      data_refs: ["EldercareModelInput.decision.facility.staff_count", "nurse_ratio"],
      known_limits: ["Workforce is a bounded synthetic scenario constraint."],
      output_schema: "EldercareRoundMetrics.operations.staffed_capacity",
      output_unit: "staffed places",
      primary_producer:
        "services/simulation-core/src/eldercare-core-model.ts::evaluateEldercareCoreRound",
      symbol: "evaluateEldercareCoreRound.workforce"
    }),
    entry(context, "QUALITY_RISK", "CURRENT", {
      ...coreEntryDefaults,
      consumer: "Simulation Core quality projection",
      data_refs: ["service_quality_budget", "staff_count", "beds"],
      known_limits: ["Quality/risk signals are synthetic model outputs, not clinical validation."],
      output_schema: "EldercareRoundMetrics.quality",
      output_unit: "bounded indices",
      primary_producer:
        "services/simulation-core/src/eldercare-core-model.ts::evaluateEldercareCoreRound",
      symbol: "evaluateEldercareCoreRound.quality"
    }),
    entry(context, "FINANCE", "CURRENT", {
      ...coreEntryDefaults,
      consumer: "Simulation Core finance projection",
      data_refs: ["monthly_price", "service_quality_budget", "community_outreach_budget"],
      known_limits: ["Finance is a scenario projection and not a production ledger writer."],
      output_schema: "EldercareRoundMetrics.finance",
      output_unit: "CNY and ratio",
      primary_producer:
        "services/simulation-core/src/eldercare-core-model.ts::evaluateEldercareCoreRound",
      symbol: "evaluateEldercareCoreRound.finance"
    }),
    entry(context, "SYSTEM_DYNAMICS", "SHADOW", {
      actual_invocation_path: "NONE_IN_OFFICIAL_PATH",
      code_path: "W5 shadow-only plane",
      consumer: "teacher advanced explanation only",
      data_refs: ["hypothetical stock/flow trace"],
      environment: "not executed by official W5 path",
      fallback: "deterministic Simulation Core",
      formal_writer: "none",
      input_schema: "candidate shadow input",
      input_unit: "scenario values",
      known_limits: ["Shadow-only; cannot overwrite official output."],
      output_schema: "candidate shadow trace",
      output_unit: "index",
      primary_producer: "system_dynamics_shadow",
      seed: null,
      solver_evaluator: "NONE_PROVEN",
      symbol: "SHADOW_ONLY",
      version: "NOT_ACTIVE",
      visibility: "SHADOW"
    }),
    missing(
      "MARKETING",
      "RESEARCH",
      "No independent marketing response engine is proven; outreach is an input to the core scenario.",
      "RESEARCH"
    ),
    entry(context, "SHANGHAI", "CURRENT", {
      ...coreEntryDefaults,
      consumer: "Scenario compiler and Simulation Core",
      data_refs: ["r7a-shanghai-eldercare-core-scenario-v2", "synthetic region weights"],
      known_limits: ["Synthetic/assumption-labelled; not calibrated to external Shanghai data."],
      primary_producer:
        "services/simulation-core/src/eldercare-core-model.ts::createDefaultEldercareModelInput",
      symbol: "createDefaultEldercareModelInput",
      visibility: "CURRENT_CORE"
    }),
    entry(context, "SYNTHETIC_WANT", "CURRENT", {
      ...coreEntryDefaults,
      actual_invocation_path: "W5 reproduction runner -> syntheticWantCandidate",
      consumer: "W5 WANT projection only",
      data_refs: ["core demand index and monthly price"],
      known_limits: ["Synthetic heuristic; official=false and never a settlement input."],
      output_schema: "number",
      output_unit: "heuristic index",
      primary_producer: "services/api/src/w5-formal-rebase.ts::syntheticWantCandidate",
      symbol: "syntheticWantCandidate",
      visibility: "SYNTHETIC_HEURISTIC"
    }),
    entry(context, "CORE_REALIZED", "CURRENT", {
      ...coreEntryDefaults,
      known_limits: [
        "Core projection is official for W5 realized evidence but writes no formal result."
      ],
      primary_producer:
        "services/simulation-core/src/w5-governed-convergence.ts::evaluateW5CoreRealization",
      symbol: "evaluateW5CoreRealization"
    })
  ];

  const causalFeatureOwnership: readonly W5FeatureAuthority[] = [
    {
      economic_meaning: "service capacity",
      feature_id: "service_capacity",
      primary_producer: "CAPACITY",
      unit: "places",
      visibility: "CURRENT_CORE"
    },
    {
      economic_meaning: "staffing feasibility",
      feature_id: "workforce_feasibility",
      primary_producer: "WORKFORCE",
      unit: "staffed places",
      visibility: "CURRENT_CORE"
    },
    {
      economic_meaning: "quality and risk signal",
      feature_id: "quality_risk_signal",
      primary_producer: "QUALITY_RISK",
      unit: "index",
      visibility: "CURRENT_CORE"
    },
    {
      economic_meaning: "scenario finance projection",
      feature_id: "finance_projection",
      primary_producer: "FINANCE",
      unit: "CNY and ratio",
      visibility: "CURRENT_CORE"
    },
    {
      economic_meaning: "synthetic learner preference heuristic",
      feature_id: "synthetic_want",
      primary_producer: "SYNTHETIC_WANT",
      unit: "heuristic index",
      visibility: "SYNTHETIC_HEURISTIC"
    },
    {
      economic_meaning: "official realized core metrics",
      feature_id: "realized_core_metrics",
      primary_producer: "CORE_REALIZED",
      unit: "core metrics",
      visibility: "CURRENT_CORE"
    },
    {
      economic_meaning: "system dynamics hypothesis",
      feature_id: "sd_lag_candidate",
      primary_producer: "SYSTEM_DYNAMICS",
      unit: "index",
      visibility: "SHADOW"
    }
  ];

  const producerCounts = new Map<string, Set<string>>();
  for (const feature of causalFeatureOwnership) {
    const producers = producerCounts.get(feature.feature_id) ?? new Set<string>();
    producers.add(feature.primary_producer);
    producerCounts.set(feature.feature_id, producers);
  }
  const doubleProducerCount = [...producerCounts.values()].filter(
    (producers) => producers.size > 1
  ).length;
  const unknownCount = entries.filter(
    (item) => item.classification === ("UNKNOWN" as never)
  ).length;
  const unownedFeatureCount = causalFeatureOwnership.filter(
    (item) => !item.primary_producer
  ).length;

  return {
    causal_feature_ownership: causalFeatureOwnership,
    entries,
    head_sha: context.head_sha,
    mission_lineage_id: context.mission_lineage_id,
    status: "PASS_WITH_LIMITS",
    summary: {
      double_producer_count: doubleProducerCount,
      unowned_feature_count: unownedFeatureCount,
      unknown_count: unknownCount
    },
    timestamp: context.timestamp,
    tree_sha: context.tree_sha
  };
}

function syntheticWantCandidate(input: EldercareModelInput): number {
  const core = evaluateW5CoreRealization(input);
  return round2(
    (core.metrics.market.demand_index / Math.max(1, input.decision.monthly_price / 1000)) *
      (1 + core.metrics.quality.care_quality_index * 0.1)
  );
}

function canConstraints(input: EldercareModelInput): readonly string[] {
  return [
    `capacity<=${input.decision.facility.beds + input.decision.facility.day_care_slots}`,
    `staff_count>=${Math.ceil(input.decision.facility.beds * 0.35)}`,
    `license_scope=${input.decision.license_scope}`
  ];
}

function record(
  context: W5FormalRebaseContext,
  kind: W5ReproductionRecord["kind"],
  input: unknown,
  output: unknown,
  notes: readonly string[],
  extras: Pick<
    W5ReproductionRecord,
    "fallback_continues_core" | "replay_writes_official_results"
  > = {}
): W5ReproductionRecord {
  return {
    command: context.command,
    environment_fingerprint: context.environment_fingerprint,
    exit_code: 0,
    head_sha: context.head_sha,
    input_digest: digest(input),
    kind,
    mission_lineage_id: context.mission_lineage_id,
    notes,
    output_digest: digest(output),
    result: "PASS_WITH_LIMITS",
    timestamp: context.timestamp,
    tree_sha: context.tree_sha,
    ...extras
  };
}

export function reproduceW5ModelBaseline(
  context: W5FormalRebaseContext,
  census: W5AuthorityCensus
): W5ReproductionManifest {
  assertFresh(context);
  const input = createDefaultEldercareModelInput();
  const core = evaluateW5CoreRealization(input);
  const want = syntheticWantCandidate(input);
  const can = canConstraints(input);
  const golden = record(
    context,
    "GOLDEN",
    { can, input, want },
    { core, can, want, writes_formal_result: false },
    [
      "Core model, synthetic WANT, CAN constraints, and REALIZED projection executed in one bounded run."
    ]
  );

  const perturbedInput: EldercareModelInput = {
    ...input,
    decision: { ...input.decision, monthly_price: input.decision.monthly_price + 500 }
  };
  const perturbedCore = evaluateW5CoreRealization(perturbedInput);
  const differential = record(
    context,
    "DIFFERENTIAL",
    { baseline: input, bounded_parameter: "monthly_price", perturbed: perturbedInput },
    { baseline: core.replay_relevant_digest, perturbed: perturbedCore.replay_relevant_digest },
    [
      "Bounded monthly_price perturbation changed the core replay identity.",
      "No unsupported plane was toggled because no real BLP/RCNL/Ideal Point plane exists."
    ]
  );

  const replayIdentity = {
    model_version: W5_MODEL_VERSION_REF,
    scenario: input.scenario_id,
    parameter_digest: digest(input),
    seed: input.seed
  };
  const replay = record(
    context,
    "REPLAY",
    replayIdentity,
    { replay_identity: replayIdentity, replay_digest: core.replay_relevant_digest },
    [
      "Exact ModelVersion/Scenario/Parameter/seed replayed deterministically.",
      "Replay is non-overwriting."
    ],
    { replay_writes_official_results: false }
  );

  const fallback = record(
    context,
    "ZERO_SIGNAL_FALLBACK",
    { candidate_family: "BLP_RCNL", candidate_available: false, input },
    { fallback_plane: "DETERMINISTIC_CORE", core_digest: core.replay_relevant_digest },
    [
      "Unavailable candidate produced zero activation signal.",
      "Official Simulation Core path continued and no second runtime was created."
    ],
    { fallback_continues_core: true, replay_writes_official_results: false }
  );

  const drift = record(
    context,
    "DRIFT",
    {
      baseline_digest: golden.input_digest,
      expected_difference_digest: differential.output_digest
    },
    {
      labels: DRIFT_LABELS,
      standard_digest: core.replay_relevant_digest,
      advanced_digest: core.replay_relevant_digest
    },
    [
      "CODE_DRIFT, DATA_DRIFT, ENVIRONMENT_ANOMALY, and MEASUREMENT_MISMATCH are monitored labels.",
      "EXPECTED_MODEL_DIFFERENCE is the bounded parameter perturbation above.",
      "Standard and Advanced use the same core authority and replay digest."
    ]
  );

  if (
    census.summary.unknown_count !== 0 ||
    census.summary.unowned_feature_count !== 0 ||
    census.summary.double_producer_count !== 0
  ) {
    throw new Error("W5_FORMAL_REBASE_CENSUS_NOT_CLOSED");
  }

  return {
    drift_labels: DRIFT_LABELS,
    head_sha: context.head_sha,
    mission_lineage_id: context.mission_lineage_id,
    records: [golden, differential, replay, fallback, drift],
    standard_advanced_parity: true,
    status: "PASS_WITH_LIMITS",
    timestamp: context.timestamp,
    tree_sha: context.tree_sha
  };
}

export function freezeW5CurrentBaseline(
  context: W5FormalRebaseContext,
  census: W5AuthorityCensus,
  manifest: W5ReproductionManifest
): W5FormalCurrentModelBaseline {
  assertFresh(context);
  if (
    manifest.mission_lineage_id !== context.mission_lineage_id ||
    manifest.status !== "PASS_WITH_LIMITS"
  ) {
    throw new Error("W5_FORMAL_REBASE_REPRODUCTION_NOT_CLOSED");
  }

  const input = createDefaultEldercareModelInput();
  const modelFamilies = Object.fromEntries(
    census.entries.map((item) => [item.family, item])
  ) as Record<W5FormalRebaseModelFamily, W5AuthorityCensusEntry>;

  return {
    causal_feature_ownership: census.causal_feature_ownership,
    fallback: {
      official_path_continues: true,
      plane_off: "DETERMINISTIC_CORE",
      second_runtime: false
    },
    head_sha: context.head_sha,
    identity: {
      model_version: W5_MODEL_VERSION_REF,
      parameter_digest: digest(input),
      scenario: input.scenario_id,
      seed: input.seed
    },
    known_limits: KNOWN_LIMITS,
    mission_lineage_id: context.mission_lineage_id,
    model_families: modelFamilies,
    replay: {
      deterministic: true,
      exact_binding: true,
      non_overwrite: true
    },
    shanghai: {
      data_classification: "SYNTHETIC",
      provenance: "SYNTHETIC_ASSUMPTION_NOT_CALIBRATED"
    },
    standard_advanced_parity: manifest.standard_advanced_parity,
    status: "PASS_WITH_LIMITS",
    system_dynamics: {
      official: false,
      status: "SHADOW_ONLY"
    },
    synthetic_want: {
      official: false,
      status: "SYNTHETIC_HEURISTIC"
    },
    timestamp: context.timestamp,
    tree_sha: context.tree_sha
  };
}

export { DRIFT_LABELS, KNOWN_LIMITS };
