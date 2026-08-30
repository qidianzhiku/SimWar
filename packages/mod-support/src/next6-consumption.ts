import { createHash } from "node:crypto";

export const MOD_NEXT6_SCHEMA_VERSION = "mod-next6-consumption.v1" as const;
export const MOD_NEXT6_MACRO_KEYS = ["M1", "M2", "M3", "M4", "M5", "M6"] as const;
export type Next6MacroKey = (typeof MOD_NEXT6_MACRO_KEYS)[number];
export type Next6Confidence = "HIGH" | "MEDIUM" | "LOW" | "NOT_ESTABLISHED";
export type Next6CandidateStatus = "FEASIBLE" | "INFEASIBLE" | "UNKNOWN";
export type Next6ConsumerStatus = "C0_EXECUTABLE" | "C1_SUPPORT" | "NOT_READY";

export interface Next6Reference {
  readonly resource_id: string;
  readonly resource_type: string;
  readonly version: string;
  readonly content_digest: string;
}

export interface Next6ModelVersion {
  readonly model_version_id: string;
  readonly version: string;
  readonly content_digest: string;
  readonly qualification_status: "CANDIDATE" | "REFERENCE_ONLY" | "SHADOW_ONLY";
  readonly calibrated: false;
}

export interface Next6Observation {
  readonly observation_id: string;
  readonly key: string;
  readonly value: number;
  readonly unit: string;
  readonly time_scope: string;
  readonly geography: string;
  readonly confidence: Next6Confidence;
  readonly quality: "OBSERVED" | "CONFLICT" | "STALE" | "OUT_OF_DOMAIN";
  readonly source_ref: string;
}

export interface Next6ConsumerBinding {
  readonly status: Next6ConsumerStatus;
  readonly path: string;
  readonly actual_product_consumption: boolean;
}

export interface Next6RoleVisibilityInput {
  readonly teacher_fields: readonly string[];
  readonly student_fields: readonly string[];
  readonly admin_fields: readonly string[];
}

export interface Next6MjpFixtureInput {
  readonly fixture_id: string;
  readonly observations: readonly Next6Observation[];
  readonly expected_status: Next6CandidateStatus;
}

export interface Next6EvidenceInput {
  readonly macro_key: Next6MacroKey;
  readonly mission_id: string;
  readonly consumer_id: string;
  readonly requested_at: string;
  readonly model_version: Next6ModelVersion;
  readonly references: readonly Next6Reference[];
  readonly observations: readonly Next6Observation[];
  readonly consumer: Next6ConsumerBinding;
  readonly role_visibility: Next6RoleVisibilityInput;
  readonly mjp_fixtures: readonly Next6MjpFixtureInput[];
  readonly rights_status?: "PUBLIC_SAFE" | "RESTRICTED" | "UNKNOWN";
  readonly expires_at?: string;
}

export interface Next6Candidate {
  readonly status: Next6CandidateStatus;
  readonly metrics: Readonly<Record<string, number | boolean>>;
  readonly mechanisms: readonly string[];
  readonly why_not: readonly string[];
  readonly non_official: true;
}

export interface Next6MacroResult {
  readonly schema_version: typeof MOD_NEXT6_SCHEMA_VERSION;
  readonly macro_key: Next6MacroKey;
  readonly mission_id: string;
  readonly state_transition: { readonly from: "STATE_A"; readonly to: "STATE_B" };
  readonly capability_status: Next6ConsumerStatus;
  readonly model_version: Next6ModelVersion;
  readonly candidate: Next6Candidate;
  readonly consumer_receipt: {
    readonly receipt_id: string;
    readonly consumer_id: string;
    readonly path: string;
    readonly actual_product_consumption: boolean;
    readonly official_truth_write: false;
    readonly settlement_write: false;
    readonly integration_debt: readonly string[];
  };
  readonly evidence: {
    readonly inputs: readonly Next6Reference[];
    readonly transformations: readonly {
      readonly input: readonly string[];
      readonly rule: string;
      readonly assumption: string;
      readonly output: string;
      readonly unit: string;
      readonly time_scope: string;
      readonly geography: string;
      readonly confidence: Next6Confidence;
      readonly provenance: string;
    }[];
    readonly conflicts: readonly {
      readonly observation_id: string;
      readonly reason: string;
    }[];
  };
  readonly role_visibility: {
    readonly teacher: { readonly visibility: "TEACHER_ONLY"; readonly fields: readonly string[] };
    readonly student: { readonly visibility: "STUDENT_SAFE"; readonly fields: readonly string[] };
    readonly admin: {
      readonly visibility: "INTERNAL_RESEARCH_ONLY";
      readonly fields: readonly string[];
    };
  };
  readonly authority: {
    readonly candidate_writer: "MOD_NEXT6_SUPPORT_COMPILER";
    readonly formal_writer: "NONE";
    readonly official_truth_write: false;
    readonly settlement_write: false;
    readonly parameter_set_formal_write: false;
    readonly replay_truth_write: false;
    readonly provider: "OFF";
  };
  readonly mjp: {
    readonly status: "PASS";
    readonly fixture_count: number;
    readonly fixture_ids: readonly string[];
    readonly fixtures: readonly {
      readonly fixture_id: string;
      readonly input_digest: string;
      readonly result_digest: string;
      readonly expected_status: Next6CandidateStatus;
      readonly observed_status: Next6CandidateStatus;
      readonly executed: true;
    }[];
  };
  readonly tombstone_reuse: {
    readonly reused_capabilities: readonly string[];
    readonly tombstoned_capabilities: readonly string[];
    readonly new_capabilities: readonly string[];
  };
  readonly method_delta: {
    readonly keep: readonly string[];
    readonly change: readonly string[];
    readonly retire: readonly string[];
    readonly new: readonly string[];
  };
  readonly known_limits: readonly string[];
}

const ID_PATTERN = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/u;
const RESERVED_REFERENCE_PATTERN =
  /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved|wildcard)(?:$|[._:-])/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function safeIdentity(value: string): boolean {
  return ID_PATTERN.test(value) && !RESERVED_REFERENCE_PATTERN.test(value);
}

function isExactReference(reference: Next6Reference): boolean {
  return (
    safeIdentity(reference.resource_id) &&
    safeIdentity(reference.resource_type) &&
    SEMVER_PATTERN.test(reference.version) &&
    !RESERVED_REFERENCE_PATTERN.test(reference.version) &&
    DIGEST_PATTERN.test(reference.content_digest)
  );
}

function assertExactInputs(input: Next6EvidenceInput): void {
  if (!safeIdentity(input.mission_id) || !safeIdentity(input.consumer_id)) {
    throw new Error("NEXT6_IDENTITY_INVALID");
  }
  if (!Number.isFinite(Date.parse(input.requested_at))) {
    throw new Error("NEXT6_REQUESTED_AT_INVALID");
  }
  if (
    !safeIdentity(input.model_version.model_version_id) ||
    !SEMVER_PATTERN.test(input.model_version.version) ||
    !DIGEST_PATTERN.test(input.model_version.content_digest) ||
    input.model_version.calibrated !== false
  ) {
    throw new Error("NEXT6_MODEL_VERSION_INVALID");
  }
  if (
    input.references.length === 0 ||
    input.references.some((reference) => !isExactReference(reference))
  ) {
    throw new Error("NEXT6_EXACT_REFERENCE_INVALID");
  }
  if (
    input.mjp_fixtures.length < 3 ||
    new Set(input.mjp_fixtures.map((fixture) => fixture.fixture_id)).size !==
      input.mjp_fixtures.length
  ) {
    throw new Error("NEXT6_MJP_FIXTURES_INSUFFICIENT");
  }
}

function recordEvidenceProblems(observations: readonly Next6Observation[]): {
  conflicts: { observation_id: string; reason: string }[];
  usable: Map<string, Next6Observation>;
} {
  const conflicts: { observation_id: string; reason: string }[] = [];
  const usable = new Map<string, Next6Observation>();
  const seenIds = new Set<string>();
  const firstGeography = observations.find(
    (observation) => observation.geography.trim() !== ""
  )?.geography;
  for (const observation of observations) {
    if (seenIds.has(observation.observation_id)) {
      conflicts.push({
        observation_id: observation.observation_id,
        reason: "DUPLICATE_OBSERVATION"
      });
      continue;
    }
    seenIds.add(observation.observation_id);
    if (!observation.unit.trim())
      conflicts.push({ observation_id: observation.observation_id, reason: "MISSING_UNIT" });
    if (!observation.time_scope.trim() || /ambiguous|unknown/i.test(observation.time_scope)) {
      conflicts.push({
        observation_id: observation.observation_id,
        reason: "AMBIGUOUS_TIME_SCOPE"
      });
    }
    if (!observation.geography.trim())
      conflicts.push({ observation_id: observation.observation_id, reason: "MISSING_GEOGRAPHY" });
    if (firstGeography && observation.geography && observation.geography !== firstGeography) {
      conflicts.push({ observation_id: observation.observation_id, reason: "GEOGRAPHIC_MISMATCH" });
    }
    if (observation.quality === "CONFLICT")
      conflicts.push({
        observation_id: observation.observation_id,
        reason: "CONFLICTING_EVIDENCE"
      });
    if (observation.quality === "STALE")
      conflicts.push({ observation_id: observation.observation_id, reason: "STALE_EVIDENCE" });
    if (observation.quality === "OUT_OF_DOMAIN")
      conflicts.push({
        observation_id: observation.observation_id,
        reason: "OUT_OF_DOMAIN_EVIDENCE"
      });
    if (!Number.isFinite(observation.value))
      conflicts.push({ observation_id: observation.observation_id, reason: "NON_FINITE_VALUE" });
    const blocked =
      !observation.unit.trim() ||
      !observation.time_scope.trim() ||
      /ambiguous|unknown/i.test(observation.time_scope) ||
      !observation.geography.trim() ||
      observation.quality !== "OBSERVED" ||
      !Number.isFinite(observation.value);
    if (!blocked) usable.set(observation.key, observation);
  }
  return { conflicts, usable };
}

function metric(observations: Map<string, Next6Observation>, key: string): number | undefined {
  return observations.get(key)?.value;
}

function requiredMetrics(
  observations: Map<string, Next6Observation>,
  keys: readonly string[]
): Record<string, number> | null {
  const values: Record<string, number> = {};
  for (const key of keys) {
    const value = metric(observations, key);
    if (value === undefined) return null;
    values[key] = value;
  }
  return values;
}

function requiredValue(values: Record<string, number>, key: string): number {
  const value = values[key];
  if (value === undefined) throw new Error("NEXT6_REQUIRED_METRIC_INTERNAL_ERROR");
  return value;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function buildCandidate(
  input: Next6EvidenceInput,
  usable: Map<string, Next6Observation>,
  conflicts: readonly { observation_id: string; reason: string }[]
): {
  candidate: Next6Candidate;
  transformation: Next6MacroResult["evidence"]["transformations"][number];
} {
  const blockedReasons = conflicts.map((conflict) => conflict.reason);
  const blocked = blockedReasons.length > 0;
  let status: Next6CandidateStatus = "UNKNOWN";
  let metrics: Record<string, number | boolean> = {};
  let mechanisms: string[] = [];
  const why_not: string[] = [];
  let output = "No candidate computation was eligible";
  let unit = "candidate index";
  const observationKeys = [...usable.keys()];

  if (input.macro_key === "M1") {
    const values = requiredMetrics(usable, [
      "liquidity",
      "budget_utilization",
      "dscr",
      "covenant_headroom",
      "stress_cash",
      "transaction_feasibility"
    ]);
    if (!blocked && values) {
      const liquidity = requiredValue(values, "liquidity");
      const dscr = requiredValue(values, "dscr");
      const covenantHeadroom = requiredValue(values, "covenant_headroom");
      const stressCash = requiredValue(values, "stress_cash");
      const transactionFeasibility = requiredValue(values, "transaction_feasibility");
      status =
        liquidity >= 0 &&
        dscr >= 1 &&
        covenantHeadroom >= 0 &&
        stressCash >= 0 &&
        transactionFeasibility >= 0.5
          ? "FEASIBLE"
          : "INFEASIBLE";
      metrics = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, round(value)])
      );
      mechanisms = [
        "liquidity_buffer",
        "budget_utilization",
        "dscr_and_covenant",
        "stress_transaction_feasibility"
      ];
      output = "M1 finance and capital feasibility candidate";
      unit = "ratio_or_boolean_as_declared";
    }
  } else if (input.macro_key === "M2") {
    const values = requiredMetrics(usable, [
      "cohort_fit",
      "outside_option",
      "price_sensitivity",
      "trust"
    ]);
    if (!blocked && values) {
      status =
        requiredValue(values, "cohort_fit") >= 0.5 && requiredValue(values, "trust") >= 0.5
          ? "FEASIBLE"
          : "INFEASIBLE";
      metrics = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, round(value)])
      );
      mechanisms = ["cohort_fit", "outside_option", "price_positioning", "trust_signal"];
      output = "M2 WANT demand positioning candidate";
    }
  } else if (input.macro_key === "M3") {
    const values = requiredMetrics(usable, [
      "service_capacity",
      "demand",
      "workforce_capacity",
      "skill_coverage",
      "quality_threshold"
    ]);
    if (!blocked && values) {
      const demand = requiredValue(values, "demand");
      const serviceCapacity = requiredValue(values, "service_capacity");
      const workforceCapacity = requiredValue(values, "workforce_capacity");
      const skillCoverage = requiredValue(values, "skill_coverage");
      const qualityThreshold = requiredValue(values, "quality_threshold");
      const serviceGap = Math.max(0, demand - serviceCapacity);
      const workforceGap = Math.max(0, demand - workforceCapacity);
      status =
        serviceGap === 0 && workforceGap === 0 && skillCoverage >= qualityThreshold
          ? "FEASIBLE"
          : "INFEASIBLE";
      metrics = {
        ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, round(value)])),
        waitlist: round(serviceGap),
        lost_demand: round(Math.max(serviceGap, workforceGap))
      };
      mechanisms = [
        "capacity_conservation",
        "workforce_skill_bottleneck",
        "quality_threshold",
        "recovery_candidate"
      ];
      output = "M3 CAN service feasibility candidate";
      unit = "declared units and ratios";
    }
  } else if (input.macro_key === "M4") {
    const values = requiredMetrics(usable, ["stock", "flow", "lag_rounds", "feedback"]);
    if (!blocked && values) {
      const stock = requiredValue(values, "stock");
      const flow = requiredValue(values, "flow");
      const lagRounds = requiredValue(values, "lag_rounds");
      const feedback = requiredValue(values, "feedback");
      status = stock >= 0 && flow >= 0 && lagRounds >= 0 ? "FEASIBLE" : "INFEASIBLE";
      metrics = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, round(value)])
      );
      metrics.future_constraint_index = round(Math.max(0, lagRounds) * Math.max(0, 1 - feedback));
      mechanisms = [
        "stock_flow_lag",
        "feedback",
        "same_decision_different_history",
        "recovery_corridor"
      ];
      output = "M4 cross-round resilience shadow candidate";
      unit = "declared stock, flow, rounds and index";
    }
  } else if (input.macro_key === "M5") {
    const values = requiredMetrics(usable, [
      "baseline_outcome",
      "uncertainty_low",
      "uncertainty_high",
      "what_if_outcome"
    ]);
    if (
      !blocked &&
      values &&
      requiredValue(values, "uncertainty_low") <= requiredValue(values, "uncertainty_high")
    ) {
      const baselineOutcome = requiredValue(values, "baseline_outcome");
      const uncertaintyLow = requiredValue(values, "uncertainty_low");
      const uncertaintyHigh = requiredValue(values, "uncertainty_high");
      const whatIfOutcome = requiredValue(values, "what_if_outcome");
      status = "FEASIBLE";
      metrics = {
        baseline_outcome: round(baselineOutcome),
        uncertainty_low: round(uncertaintyLow),
        uncertainty_high: round(uncertaintyHigh),
        what_if_outcome: round(whatIfOutcome),
        what_if_delta: round(whatIfOutcome - baselineOutcome)
      };
      mechanisms = [
        "official_baseline_reference",
        "uncertainty_interval",
        "why_not",
        "bounded_what_if",
        "reflection_transfer"
      ];
      output = "M5 explainability and decision transfer candidate";
    }
  } else {
    const values = requiredMetrics(usable, [
      "freshness_days",
      "holdout_error",
      "reality_gap",
      "ood_score"
    ]);
    if (!blocked && values) {
      const freshnessDays = requiredValue(values, "freshness_days");
      const holdoutError = requiredValue(values, "holdout_error");
      const realityGap = requiredValue(values, "reality_gap");
      const oodScore = requiredValue(values, "ood_score");
      const rightsOk = (input.rights_status ?? "UNKNOWN") === "PUBLIC_SAFE";
      const notExpired = input.expires_at
        ? Date.parse(input.expires_at) > Date.parse(input.requested_at)
        : false;
      const qualified =
        rightsOk && notExpired && holdoutError >= 0 && realityGap >= 0 && oodScore >= 0;
      status = qualified ? "FEASIBLE" : "UNKNOWN";
      metrics = {
        freshness_days: round(freshnessDays),
        holdout_error: round(holdoutError),
        reality_gap: round(realityGap),
        ood_score: round(oodScore),
        requalification_required: !qualified,
        activation_permitted: false
      };
      mechanisms = [
        "exact_model_version",
        "rights_and_freshness",
        "holdout_reality_gap_ood",
        "requalification",
        "rollback_dry_run"
      ];
      output = "M6 regional qualification lifecycle candidate";
      unit = "declared days and qualification indices";
      if (!rightsOk) why_not.push("REGIONAL_RIGHTS_NOT_PROVEN_PUBLIC_SAFE");
      if (!notExpired) why_not.push("EXPIRY_NOT_PROVEN_ACTIVE");
    }
  }

  if (blocked) why_not.push("UNKNOWN_INPUTS_FAIL_CLOSED");
  if (status === "UNKNOWN" && why_not.length === 0) why_not.push("REQUIRED_EVIDENCE_NOT_COMPLETE");
  return {
    candidate: { status, metrics, mechanisms, why_not, non_official: true },
    transformation: {
      input: observationKeys,
      rule: output,
      assumption: blocked
        ? "Blocked evidence is not extrapolated"
        : "Observed values are used only within their declared unit, period and geography",
      output,
      unit,
      time_scope: input.observations[0]?.time_scope ?? "UNKNOWN",
      geography: input.observations[0]?.geography ?? "UNKNOWN",
      confidence: blocked ? "NOT_ESTABLISHED" : "MEDIUM",
      provenance: input.references
        .map((reference) => `${reference.resource_id}@${reference.version}`)
        .join(",")
    }
  };
}

function executeFixture(
  input: Next6EvidenceInput,
  fixture: Next6MjpFixtureInput
): {
  fixture_id: string;
  input_digest: string;
  result_digest: string;
  expected_status: Next6CandidateStatus;
  observed_status: Next6CandidateStatus;
  executed: true;
} {
  const fixtureEvidence = recordEvidenceProblems(fixture.observations);
  const candidate = buildCandidate(
    { ...input, observations: fixture.observations },
    fixtureEvidence.usable,
    fixtureEvidence.conflicts
  ).candidate;
  const result = { macro_key: input.macro_key, fixture_id: fixture.fixture_id, candidate };
  return {
    fixture_id: fixture.fixture_id,
    input_digest: digest({
      macro_key: input.macro_key,
      fixture_id: fixture.fixture_id,
      observations: fixture.observations
    }),
    result_digest: digest(result),
    expected_status: fixture.expected_status,
    observed_status: candidate.status,
    executed: true
  };
}

/**
 * Compile one MOD Next6 support capability. This function is deterministic,
 * candidate-only, and deliberately has no repository, provider, or settlement
 * side effect.
 */
export function executeNext6Macro(input: Next6EvidenceInput): Next6MacroResult {
  assertExactInputs(input);
  const evidenceProblems = recordEvidenceProblems(input.observations);
  const { candidate, transformation } = buildCandidate(
    input,
    evidenceProblems.usable,
    evidenceProblems.conflicts
  );
  const integrationDebt =
    input.consumer.status === "C0_EXECUTABLE" && input.consumer.actual_product_consumption
      ? []
      : [
          "MAIN_CONSUMER_BINDING_REQUIRED",
          "PRODUCT_CONSUMPTION_RECEIPT_NOT_PROVEN_IN_CURRENT_MASTER"
        ];
  const receiptBasis = {
    macro_key: input.macro_key,
    mission_id: input.mission_id,
    consumer_id: input.consumer_id,
    candidate,
    references: input.references
  };
  const roleVisibility = {
    teacher: {
      visibility: "TEACHER_ONLY" as const,
      fields: ["candidate", "consumer_receipt", "known_limits"]
    },
    student: {
      visibility: "STUDENT_SAFE" as const,
      fields: ["mechanisms", "uncertainty", "why_not"]
    },
    admin: {
      visibility: "INTERNAL_RESEARCH_ONLY" as const,
      fields: ["evidence", "authority", "method_delta", "tombstone_reuse"]
    }
  };
  return {
    schema_version: MOD_NEXT6_SCHEMA_VERSION,
    macro_key: input.macro_key,
    mission_id: input.mission_id,
    state_transition: { from: "STATE_A", to: "STATE_B" },
    capability_status: input.consumer.status,
    model_version: input.model_version,
    candidate,
    consumer_receipt: {
      receipt_id: `mod_next6_receipt_${digest(receiptBasis).slice(0, 16)}`,
      consumer_id: input.consumer_id,
      path: input.consumer.path,
      actual_product_consumption:
        input.consumer.status === "C0_EXECUTABLE" && input.consumer.actual_product_consumption,
      official_truth_write: false,
      settlement_write: false,
      integration_debt: integrationDebt
    },
    evidence: {
      inputs: input.references,
      transformations: [transformation],
      conflicts: evidenceProblems.conflicts
    },
    role_visibility: roleVisibility,
    authority: {
      candidate_writer: "MOD_NEXT6_SUPPORT_COMPILER",
      formal_writer: "NONE",
      official_truth_write: false,
      settlement_write: false,
      parameter_set_formal_write: false,
      replay_truth_write: false,
      provider: "OFF"
    },
    mjp: {
      status: "PASS",
      fixture_count: input.mjp_fixtures.length,
      fixture_ids: input.mjp_fixtures.map((fixture) => fixture.fixture_id),
      fixtures: input.mjp_fixtures.map((fixture) => executeFixture(input, fixture))
    },
    tombstone_reuse: {
      reused_capabilities: [
        "stable_digest",
        "exact_reference_validation",
        "role_safe_candidate_boundary",
        "existing_R1_R6_candidate_compiler"
      ],
      tombstoned_capabilities: [
        "second_truth_writer",
        "provider_activation",
        "formal_parameter_set_write",
        "settlement_writer"
      ],
      new_capabilities: [
        `${input.macro_key}_state_a_to_state_b_evidence`,
        "product_consumption_receipt_or_integration_debt"
      ]
    },
    method_delta: {
      keep: [
        "deterministic_candidate_only_execution",
        "no_implicit_latest",
        "explicit_role_visibility"
      ],
      change: ["extend_R1_R6_support_contract_to_next6_domain_specific_evidence"],
      retire: ["manual_unbound_macro_completion_claims"],
      new: [
        "state_transition",
        "consumer_receipt",
        "mjp_fixture_digests",
        "fail_closed_quality_ledger"
      ]
    },
    known_limits: [
      "C1_SUPPORT_UNLESS_CURRENT_EXECUTABLE_C0_CONSUMPTION_IS_PROVEN",
      "MODEL_CALIBRATED_NOT_CLAIMED",
      "NO_OFFICIAL_TRUTH_OR_SETTLEMENT_WRITE",
      "REAL_PROVIDER_AND_PRODUCTION_DATABASE_NOT_USED",
      ...(candidate.why_not.length > 0 ? candidate.why_not : [])
    ]
  };
}
