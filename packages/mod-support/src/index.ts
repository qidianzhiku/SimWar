import { createHash } from "node:crypto";

export const MOD_SUPPORT_SCHEMA_VERSION = "mod-support-macro.v1" as const;
export * from "./next6-consumption.js";
export const MOD_MACRO_KEYS = ["R1", "R2", "R3", "R4", "R5", "R6"] as const;
export type ModMacroKey = (typeof MOD_MACRO_KEYS)[number];

export const MOD_MACRO_IDS: Record<ModMacroKey, string> = {
  R1: "SIMWAR-MOD-SH-O1-FULL-VERTICAL-MODEL-BINDING-REALITY-QUALIFICATION-MACRO-01-20260828",
  R2: "SIMWAR-MOD-GSI-O1-STAKEHOLDER-MODEL-RESPONSE-SHADOW-MACRO-01-20260828",
  R3: "SIMWAR-MOD-ESL-O1-EXECUTIVE-STRATEGY-EXPERIMENT-MATRIX-MACRO-01-20260828",
  R4: "SIMWAR-MOD-ESL-O2-ROBUSTNESS-UNCERTAINTY-TRADEOFF-MACRO-01-20260828",
  R5: "SIMWAR-MOD-RT-O1-REGIONAL-PORTABILITY-VERSION-EVOLUTION-MACRO-01-20260828",
  R6: "SIMWAR-MOD-RT-O2-RECALIBRATION-DRIFT-ROLLBACK-LIFECYCLE-MACRO-01-20260828"
};

const MACRO_CONFIG: Record<
  ModMacroKey,
  { candidate_type: string; consumer_id: string; minimum_fixture_count: number; need_by: string }
> = {
  R1: {
    candidate_type: "FullVerticalModelBindingCandidate",
    consumer_id: "MAIN-SH-FV-O1-GOVERNED-SHANGHAI-FULL-VERTICAL",
    minimum_fixture_count: 12,
    need_by: "MAIN-SH-FV E3/E4 before full-vertical model/readiness integration"
  },
  R2: {
    candidate_type: "StakeholderModelResponseShadowCandidate",
    consumer_id: "MAIN-GSI-O1-GOVERNED-STAKEHOLDER-SHADOW-PLANE",
    minimum_fixture_count: 15,
    need_by: "MAIN-GSI E3/E4 before typed stakeholder signals are consumed by diagnostics"
  },
  R3: {
    candidate_type: "ExecutiveExperimentManifest",
    consumer_id: "MAIN-ESL-O1-EXECUTIVE-STRATEGY-LAB",
    minimum_fixture_count: 18,
    need_by: "MAIN-ESL integration seam for bounded executive strategy comparison"
  },
  R4: {
    candidate_type: "RobustnessRegimeCandidate",
    consumer_id: "MAIN-ESL-O1-EXECUTIVE-STRATEGY-LAB",
    minimum_fixture_count: 18,
    need_by: "MAIN-ESL robustness and uncertainty evidence, only after fresh Need proof"
  },
  R5: {
    candidate_type: "RegionalTransferModelCandidate",
    consumer_id: "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION",
    minimum_fixture_count: 16,
    need_by: "MAIN-RT version compatibility seam for regional transfer and scenario evolution"
  },
  R6: {
    candidate_type: "RecalibrationDriftRollbackLifecycleCandidate",
    consumer_id: "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION",
    minimum_fixture_count: 15,
    need_by: "MAIN-RT lifecycle evidence, only after fresh executable lifecycle Need proof"
  }
};

export type ModCandidateVisibility =
  | "TEACHER_ONLY"
  | "STUDENT_SAFE"
  | "INTERNAL_RESEARCH_ONLY"
  | "RESTRICTED";
export type ModMacroStatus =
  | "JOIN"
  | "JOIN_WITH_LIMITS"
  | "SKIP_TOMBSTONED"
  | "EVIDENCE_INSUFFICIENT";
export type ModConfidence = "HIGH" | "MEDIUM" | "LOW" | "NOT_ESTABLISHED";

export interface ModExactRef {
  readonly resource_id: string;
  readonly resource_type: string;
  readonly version: string;
  readonly content_digest: string;
}

export type ModSignalStakeholder =
  | "CUSTOMER_FAMILY"
  | "REGULATOR_PAYER"
  | "BANK_INVESTOR"
  | "WORKFORCE"
  | "COMPETITOR_MARKET";
export type ModSignalQuality = "OBSERVED" | "CONFLICT" | "STALE" | "OUT_OF_DOMAIN";

export const MOD_EXPERIMENT_FAMILIES = ["WANT", "CAN", "DYNAMICS", "FINANCE", "PORTFOLIO"] as const;
export type ModExperimentFamily = (typeof MOD_EXPERIMENT_FAMILIES)[number];
export const MOD_MJP_RUNNER_VERSION = "mod-mjp-runner.v1" as const;

const SHADOW_SIGNAL_WEIGHTS: Record<ModSignalStakeholder, number> = {
  CUSTOMER_FAMILY: 0.25,
  REGULATOR_PAYER: 0.2,
  BANK_INVESTOR: 0.15,
  WORKFORCE: 0.2,
  COMPETITOR_MARKET: 0.1
};

const EXPERIMENT_FAMILY_OFFSETS: Record<ModExperimentFamily, number> = {
  WANT: 0.08,
  CAN: 0.05,
  DYNAMICS: 0.03,
  FINANCE: 0.02,
  PORTFOLIO: 0.01
};

export interface ModStakeholderSignal {
  readonly signal_id: string;
  readonly stakeholder: ModSignalStakeholder;
  readonly strength: number;
  readonly quality: ModSignalQuality;
  readonly provenance_ref: string;
}

export interface ModExperimentVariant {
  readonly variant_id: string;
  readonly family: ModExperimentFamily;
  readonly feasibility: "FEASIBLE" | "INFEASIBLE" | "UNKNOWN";
  readonly parameter_digest: string;
}

export interface ModRegionalTarget {
  readonly region_id: string;
  readonly geography_scope: string;
  readonly rights_status: "PUBLIC_SAFE" | "RESTRICTED" | "UNKNOWN";
  readonly expiry: string;
}

export interface ModLifecycleEvent {
  readonly event_id: string;
  readonly from: string;
  readonly to: string;
  readonly receipt_ref: string;
}

export interface ModMjpFixtureEvidence {
  readonly fixture_id: string;
  readonly macro_key: ModMacroKey;
  readonly input: Readonly<Record<string, unknown>>;
  readonly result: Readonly<Record<string, unknown>>;
  readonly input_digest: string;
  readonly result_digest: string;
}

export interface ModFreshNeedProof {
  readonly proof_id: string;
  readonly macro_key: ModMacroKey;
  readonly consumer_id: string;
  readonly need_statement: string;
  readonly issued_at: string;
  readonly expires_at: string;
  readonly source_refs: readonly ModExactRef[];
  readonly authority: "MAIN_NEED_REVIEW";
  readonly content_digest: string;
}

export interface ModMacroRequest {
  readonly macro_key: ModMacroKey;
  readonly mission_id: string;
  readonly consumer_id: string;
  readonly need_by: string;
  readonly exact_refs: readonly ModExactRef[];
  readonly source_classification: "SYNTHETIC_ONLY" | "REFERENCE_ONLY" | "MIXED";
  readonly requested_at: string;
  readonly fresh_need_proof: ModFreshNeedProof | null;
  readonly stakeholder_signals: readonly ModStakeholderSignal[];
  readonly experiment_variants: readonly ModExperimentVariant[];
  readonly regional_target: ModRegionalTarget;
  readonly lifecycle_events: readonly ModLifecycleEvent[];
  readonly mjp_fixtures: readonly ModMjpFixtureEvidence[];
}

export interface ModTransformationRecord {
  readonly input: readonly string[];
  readonly rule: string;
  readonly assumption: string;
  readonly output: string;
  readonly unit: string;
  readonly time_scope: string;
  readonly geography: string;
  readonly confidence: ModConfidence;
  readonly provenance: string;
}

export interface ModRoleVisibility {
  readonly teacher: { readonly visibility: "TEACHER_ONLY"; readonly fields: readonly string[] };
  readonly student: { readonly visibility: "STUDENT_SAFE"; readonly fields: readonly string[] };
  readonly admin: {
    readonly visibility: "INTERNAL_RESEARCH_ONLY";
    readonly fields: readonly string[];
  };
}

export interface ModMacroResult {
  readonly schema_version: typeof MOD_SUPPORT_SCHEMA_VERSION;
  readonly macro_key: ModMacroKey;
  readonly mission_id: string;
  readonly candidate_type: string;
  readonly candidate_digest: string;
  readonly status: ModMacroStatus;
  readonly state_transition: { readonly from: "STATE_A"; readonly to: "STATE_B" | "TOMBSTONED" };
  readonly exact_binding: {
    readonly binding_digest: string;
    readonly no_implicit_latest: true;
    readonly refs: readonly ModExactRef[];
  };
  readonly candidate: Record<string, unknown>;
  readonly evidence: {
    readonly inputs: readonly {
      readonly ref: ModExactRef;
      readonly role: ModCandidateVisibility;
    }[];
    readonly transformations: readonly ModTransformationRecord[];
    readonly conflicts: readonly { readonly signal_id: string; readonly reason: string }[];
    readonly differential: {
      readonly mode: "NON_OFFICIAL";
      readonly replay_truth_write: false;
      readonly official_result_overwrite: false;
    };
  };
  readonly mjp: {
    readonly status: "PASS" | "SKIP";
    readonly fixture_count: number;
    readonly minimum_fixture_count: number;
    readonly fixture_ids: readonly string[];
    readonly fixtures: readonly ModMjpFixtureEvidence[];
  };
  readonly role_visibility: ModRoleVisibility;
  readonly authority: {
    readonly candidate_writer: "MOD_SUPPORT_CANDIDATE_COMPILER";
    readonly formal_writer: "NONE";
    readonly official_truth_write: false;
    readonly settlement_write: false;
    readonly parameter_set_formal_write: false;
    readonly replay_truth_write: false;
    readonly provider: "OFF";
    readonly runtime_authority: "JSON_INTERNAL_ONLY";
  };
  readonly join_request: {
    readonly consumer_id: string;
    readonly need_by: string;
    readonly consumer_ready: false;
    readonly exact_binding_required: true;
    readonly join_gate:
      | "MAIN_REVIEW_REQUIRED"
      | "FRESH_NEED_PROOF_REQUIRED"
      | "REGIONAL_RIGHTS_AND_EXPIRY_REQUIRED";
    readonly requested_status: ModMacroStatus;
  };
  readonly known_limits: readonly string[];
}

export interface ModStakeholderShadowEvaluation {
  readonly diagnostic_responses: readonly Record<string, unknown>[];
  readonly abstentions: readonly { readonly signal_id: string; readonly reason: string }[];
  readonly conflicts: readonly { readonly signal_id: string; readonly reason: string }[];
}

export interface ModExperimentVariantEvaluation {
  readonly variant_id: string;
  readonly family: ModExperimentFamily;
  readonly feasibility: ModExperimentVariant["feasibility"];
  readonly execution_status:
    | "EXECUTED_SHADOW"
    | "SKIPPED_INFEASIBLE"
    | "ABSTAINED_UNKNOWN_FEASIBILITY";
  readonly mechanism_envelope: Readonly<Record<string, unknown>>;
  readonly state_envelope: Readonly<Record<string, unknown>>;
  readonly outcome_envelope: Readonly<Record<string, unknown>>;
}

const RESERVED_REFERENCE_TOKEN =
  /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved|wildcard)(?:$|[._:-])/i;
const ID_PATTERN = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeIdentity(value: string): boolean {
  return (
    value.trim() === value &&
    value.length > 0 &&
    ID_PATTERN.test(value) &&
    !RESERVED_REFERENCE_TOKEN.test(value)
  );
}

function isExactRef(value: unknown): value is ModExactRef {
  return (
    isRecord(value) &&
    typeof value.resource_id === "string" &&
    typeof value.resource_type === "string" &&
    typeof value.version === "string" &&
    typeof value.content_digest === "string" &&
    isSafeIdentity(value.resource_id) &&
    isSafeIdentity(value.resource_type) &&
    /^\d+\.\d+\.\d+$/u.test(value.version) &&
    !RESERVED_REFERENCE_TOKEN.test(value.version) &&
    DIGEST_PATTERN.test(value.content_digest)
  );
}

function isMjpFixtureEvidence(
  value: unknown,
  macro_key?: ModMacroKey
): value is ModMjpFixtureEvidence {
  const result = isRecord(value) && isRecord(value.result) ? value.result : null;
  const input = isRecord(value) && isRecord(value.input) ? value.input : null;
  const executionEvidence =
    result && isRecord(result.execution_evidence) ? result.execution_evidence : null;
  if (
    !isRecord(value) ||
    typeof value.fixture_id !== "string" ||
    typeof value.macro_key !== "string" ||
    !isRecord(value.input) ||
    !isRecord(value.result) ||
    typeof value.input_digest !== "string" ||
    typeof value.result_digest !== "string" ||
    !isSafeIdentity(value.fixture_id) ||
    !MOD_MACRO_KEYS.includes(value.macro_key as ModMacroKey) ||
    (macro_key !== undefined && value.macro_key !== macro_key) ||
    !DIGEST_PATTERN.test(value.input_digest) ||
    !DIGEST_PATTERN.test(value.result_digest) ||
    value.input_digest !== stableDigest(value.input) ||
    value.result_digest !== stableDigest(value.result) ||
    value.input.macro_key !== value.macro_key ||
    value.result.macro_key !== value.macro_key ||
    value.result.fixture_id !== value.fixture_id ||
    value.result.validation !== "PASSED" ||
    value.result.official_truth_write !== false ||
    value.result.settlement_write !== false ||
    !executionEvidence ||
    executionEvidence.runner_version !== MOD_MJP_RUNNER_VERSION ||
    executionEvidence.executed !== true ||
    !input ||
    stableStringify(executionEvidence) !== stableStringify(executeMjpFixture(input))
  ) {
    return false;
  }
  return true;
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (isRecord(value)) {
    return `{${[...Object.keys(value)]
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function stableDigest(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function createExactRef(
  input: Omit<ModExactRef, "content_digest"> & { content_digest: string }
): ModExactRef {
  if (
    !isSafeIdentity(input.resource_id) ||
    !isSafeIdentity(input.resource_type) ||
    !/^\d+\.\d+\.\d+$/u.test(input.version) ||
    RESERVED_REFERENCE_TOKEN.test(input.version) ||
    !DIGEST_PATTERN.test(input.content_digest)
  ) {
    throw new Error("MOD_EXACT_REF_INVALID");
  }
  return Object.freeze({ ...input });
}

function buildRef(resource_id: string, resource_type: string): ModExactRef {
  return createExactRef({
    resource_id,
    resource_type,
    version: "1.0.0",
    content_digest: stableDigest({ resource_id, resource_type, version: "1.0.0" })
  });
}

function roundBounded(value: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, Math.round(value * 1000) / 1000));
}

function isStakeholder(value: unknown): value is ModSignalStakeholder {
  return (
    typeof value === "string" && Object.prototype.hasOwnProperty.call(SHADOW_SIGNAL_WEIGHTS, value)
  );
}

function isSignalQuality(value: unknown): value is ModSignalQuality {
  return (
    value === "OBSERVED" || value === "CONFLICT" || value === "STALE" || value === "OUT_OF_DOMAIN"
  );
}

function signalFromUnknown(value: unknown): ModStakeholderSignal | null {
  if (
    !isRecord(value) ||
    typeof value.signal_id !== "string" ||
    !isSafeIdentity(value.signal_id) ||
    !isStakeholder(value.stakeholder) ||
    typeof value.strength !== "number" ||
    !Number.isFinite(value.strength) ||
    !isSignalQuality(value.quality) ||
    typeof value.provenance_ref !== "string" ||
    !isSafeIdentity(value.provenance_ref)
  ) {
    return null;
  }
  return value as unknown as ModStakeholderSignal;
}

/**
 * Deterministic, candidate-only stakeholder translation. Each stakeholder can
 * contribute at most one response. Invalid, stale, conflicting, or duplicate
 * evidence abstains instead of being aggregated into an official influence.
 */
export function evaluateStakeholderShadow(
  signals: readonly ModStakeholderSignal[]
): ModStakeholderShadowEvaluation {
  const seenIds = new Set<string>();
  const seenStakeholders = new Set<ModSignalStakeholder>();
  const diagnostic_responses: Record<string, unknown>[] = [];
  const abstentions: { signal_id: string; reason: string }[] = [];
  const conflicts: { signal_id: string; reason: string }[] = [];

  for (const signal of signals) {
    if (seenIds.has(signal.signal_id) || seenStakeholders.has(signal.stakeholder)) {
      abstentions.push({
        signal_id: signal.signal_id,
        reason: "DUPLICATE_STAKEHOLDER_ABSTENTION"
      });
      continue;
    }
    seenIds.add(signal.signal_id);
    seenStakeholders.add(signal.stakeholder);
    if (signal.quality !== "OBSERVED") {
      const reason = `${signal.quality}_ABSTENTION`;
      abstentions.push({ signal_id: signal.signal_id, reason });
      if (signal.quality === "CONFLICT") {
        conflicts.push({
          signal_id: signal.signal_id,
          reason: "CONFLICTING_EVIDENCE_NOT_SILENTLY_RESOLVED"
        });
      }
      continue;
    }
    diagnostic_responses.push({
      signal_id: signal.signal_id,
      stakeholder: signal.stakeholder,
      bounded_diagnostic_delta: roundBounded(
        signal.strength * SHADOW_SIGNAL_WEIGHTS[signal.stakeholder],
        -0.25,
        0.25
      ),
      confidence: "LOW",
      unit: "bounded diagnostic delta",
      provenance_ref: signal.provenance_ref
    });
  }
  return { diagnostic_responses, abstentions, conflicts };
}

function familyDelta(family: ModExperimentFamily, variantId: string): number {
  const variantNudge = ((variantId.length % 5) - 2) * 0.01;
  return roundBounded(EXPERIMENT_FAMILY_OFFSETS[family] + variantNudge, -0.25, 0.25);
}

/** Execute one bounded experiment comparison; it never writes formal state. */
export function evaluateExecutiveExperimentVariant(
  variant: ModExperimentVariant
): ModExperimentVariantEvaluation {
  const comparable = variant.feasibility === "FEASIBLE";
  const execution_status = comparable
    ? "EXECUTED_SHADOW"
    : variant.feasibility === "INFEASIBLE"
      ? "SKIPPED_INFEASIBLE"
      : "ABSTAINED_UNKNOWN_FEASIBILITY";
  const bounded_delta = comparable ? familyDelta(variant.family, variant.variant_id) : 0;
  return {
    variant_id: variant.variant_id,
    family: variant.family,
    feasibility: variant.feasibility,
    execution_status,
    mechanism_envelope: {
      bounded_delta,
      unit: "candidate index",
      confidence: comparable ? "LOW" : "NOT_ESTABLISHED",
      official: false
    },
    state_envelope: {
      status: execution_status,
      exact_parameter_digest: variant.parameter_digest,
      bounded: true,
      official: false
    },
    outcome_envelope: {
      comparable,
      mode: "NON_OFFICIAL_SHADOW",
      result_writer: "NONE",
      settlement_write: false,
      official: false
    }
  };
}

function regionalTargetUsable(input: ModMacroRequest): boolean {
  return (
    input.regional_target.rights_status === "PUBLIC_SAFE" &&
    Date.parse(input.regional_target.expiry) > Date.parse(input.requested_at)
  );
}

function derivedModelRef(source: ModExactRef, version: string): ModExactRef {
  return createExactRef({
    resource_id: `${source.resource_id}-target`,
    resource_type: source.resource_type,
    version,
    content_digest: stableDigest({
      source_ref: source,
      target_version: version,
      derivation: "MOD_R5_SYNTHETIC_PUBLIC_SAFE_HARNESS"
    })
  });
}

function evaluateR5Comparisons(
  input: ModMacroRequest,
  modelRef: ModExactRef
): Record<string, unknown> {
  const usable = regionalTargetUsable(input);
  const targetVersionRef = derivedModelRef(modelRef, "1.1.0");
  const status = usable ? "COMPATIBLE_WITH_LIMITS" : "NOT_JOINABLE";
  return {
    compatibility_matrix: [
      {
        comparison: "SAME_MODEL_DIFFERENT_REGION",
        source_region: "SHANGHAI",
        target_region: input.regional_target.region_id,
        source_model_ref: modelRef,
        target_model_ref: modelRef,
        status,
        materiality: "NOT_ESTABLISHED",
        bounded_delta: 0,
        unit: "candidate index"
      },
      {
        comparison: "SAME_REGION_DIFFERENT_MODEL_VERSION",
        source_region: "SHANGHAI",
        target_region: "SHANGHAI",
        source_model_ref: modelRef,
        target_model_ref: targetVersionRef,
        status: usable ? "VERSION_DRIFT_REQUIRES_REVIEW" : "NOT_JOINABLE",
        materiality: "NOT_ESTABLISHED",
        bounded_delta: 0,
        unit: "candidate index"
      }
    ],
    public_safe_harness: [
      {
        comparison: "SAME_MODEL_DIFFERENT_REGION",
        execution: "DETERMINISTIC_SYNTHETIC_COMPARISON",
        input_scope: "PUBLIC_SAFE_SYNTHETIC_ONLY",
        official: false,
        transfer_allowed: usable
      },
      {
        comparison: "SAME_REGION_DIFFERENT_MODEL_VERSION",
        execution: "DETERMINISTIC_SYNTHETIC_COMPARISON",
        input_scope: "PUBLIC_SAFE_SYNTHETIC_ONLY",
        official: false,
        transfer_allowed: usable
      }
    ],
    model_card: {
      consumer: "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION",
      source_model_ref: modelRef,
      output_unit: "candidate index",
      temporal_scope: "2026",
      calibration_status: "NOT_CALIBRATED",
      official_recommendation: false,
      rights_and_expiry_gate: usable ? "PASSED_WITH_LIMITS" : "FAIL_CLOSED"
    }
  };
}

function executeMjpFixture(input: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const macroKey = input.macro_key;
  const caseIndex = typeof input.case_index === "number" ? input.case_index : 0;
  if (macroKey === "R2") {
    const stakeholder = input.stakeholder;
    return {
      runner_version: MOD_MJP_RUNNER_VERSION,
      executed: true,
      assertion_set: ["bounded_delta", "official_influence_zero", "one_response_per_stakeholder"],
      stakeholder,
      bounded_delta: roundBounded((caseIndex % 5) * 0.01, -0.25, 0.25),
      official_influence: 0,
      candidate_only: true
    };
  }
  if (macroKey === "R3") {
    const family = MOD_EXPERIMENT_FAMILIES.includes(input.variant_family as ModExperimentFamily)
      ? (input.variant_family as ModExperimentFamily)
      : MOD_EXPERIMENT_FAMILIES[caseIndex % MOD_EXPERIMENT_FAMILIES.length];
    const feasibility =
      caseIndex % 7 === 0 ? "UNKNOWN" : caseIndex % 5 === 0 ? "INFEASIBLE" : "FEASIBLE";
    return {
      runner_version: MOD_MJP_RUNNER_VERSION,
      executed: true,
      assertion_set: ["exact_history", "no_official_recommendation", "unknown_fail_closed"],
      family,
      feasibility,
      comparable: feasibility === "FEASIBLE",
      official: false,
      result_writer: "NONE"
    };
  }
  if (macroKey === "R5") {
    const rights = input.rights_status;
    const expiry = typeof input.expiry === "string" ? Date.parse(input.expiry) : Number.NaN;
    const requestedAt =
      typeof input.requested_at === "string"
        ? Date.parse(input.requested_at)
        : Date.parse("2026-08-28T00:00:00.000Z");
    return {
      runner_version: MOD_MJP_RUNNER_VERSION,
      executed: true,
      assertion_set: ["public_safe_rights", "request_time_expiry", "transfer_fail_closed"],
      rights_status: rights,
      expiry_valid: Number.isFinite(expiry) && Number.isFinite(requestedAt) && expiry > requestedAt,
      transfer_allowed:
        rights === "PUBLIC_SAFE" &&
        Number.isFinite(expiry) &&
        Number.isFinite(requestedAt) &&
        expiry > requestedAt,
      official: false
    };
  }
  return {
    runner_version: MOD_MJP_RUNNER_VERSION,
    executed: true,
    assertion_set: ["exact_refs", "provider_off", "formal_writes_zero"],
    bounded: true,
    provider: "OFF",
    official_truth_write: false,
    settlement_write: false,
    candidate_only: true
  };
}

export function createDefaultModMacroRequest(
  macro_key: ModMacroKey,
  options: { readonly fresh_need_proof?: boolean } = {}
): ModMacroRequest {
  const refs = [
    buildRef("shanghai-scenario-package", "scenario_package"),
    buildRef("shanghai-parameter-set-candidate", "parameter_set_candidate"),
    buildRef("eldercare-model-candidate", "model_version_candidate"),
    buildRef("main-course-blueprint", "course_blueprint"),
    buildRef("main-run-binding", "run_binding"),
    buildRef("mod-source-register", "source_register")
  ];
  const freshNeedProof =
    options.fresh_need_proof === true ? createFreshNeedProof(macro_key, refs) : null;
  const stakeholder_signals: readonly ModStakeholderSignal[] = [
    {
      signal_id: "signal-customer-family",
      stakeholder: "CUSTOMER_FAMILY",
      strength: 0.8,
      quality: "OBSERVED",
      provenance_ref: "mod-source-register"
    },
    {
      signal_id: "signal-regulator-payer",
      stakeholder: "REGULATOR_PAYER",
      strength: 0.6,
      quality: "OBSERVED",
      provenance_ref: "mod-source-register"
    },
    {
      signal_id: "signal-bank-investor",
      stakeholder: "BANK_INVESTOR",
      strength: 0.5,
      quality: "OBSERVED",
      provenance_ref: "mod-source-register"
    },
    {
      signal_id: "signal-workforce",
      stakeholder: "WORKFORCE",
      strength: 0.7,
      quality: "OBSERVED",
      provenance_ref: "mod-source-register"
    },
    {
      signal_id: "signal-competitor-market",
      stakeholder: "COMPETITOR_MARKET",
      strength: 0.4,
      quality: "OBSERVED",
      provenance_ref: "mod-source-register"
    }
  ];
  const experiment_variants: readonly ModExperimentVariant[] = MOD_EXPERIMENT_FAMILIES.flatMap(
    (family, familyIndex) =>
      [0, 1].map((variantIndex) => {
        const variant_id = `variant-${family.toLowerCase()}-${variantIndex + 1}`;
        return {
          variant_id,
          family,
          feasibility:
            family === "DYNAMICS" && variantIndex === 1
              ? ("UNKNOWN" as const)
              : family === "FINANCE" && variantIndex === 1
                ? ("INFEASIBLE" as const)
                : ("FEASIBLE" as const),
          parameter_digest: stableDigest({ family, familyIndex, variantIndex, variant_id })
        };
      })
  );
  return {
    macro_key,
    mission_id: MOD_MACRO_IDS[macro_key],
    consumer_id: MACRO_CONFIG[macro_key].consumer_id,
    need_by: MACRO_CONFIG[macro_key].need_by,
    exact_refs: refs,
    source_classification: "SYNTHETIC_ONLY",
    requested_at: "2026-08-28T00:00:00.000Z",
    fresh_need_proof: freshNeedProof,
    stakeholder_signals,
    experiment_variants,
    regional_target: {
      region_id: "hangzhou",
      geography_scope: "ZHEJIANG_HANGZHOU",
      rights_status: "PUBLIC_SAFE",
      expiry: "2027-08-28"
    },
    lifecycle_events: [
      {
        event_id: "lifecycle-reference-eligible",
        from: "REFERENCE",
        to: "ELIGIBLE",
        receipt_ref: "mod-source-register"
      },
      {
        event_id: "lifecycle-eligible-candidate",
        from: "ELIGIBLE",
        to: "CALIBRATION_CANDIDATE",
        receipt_ref: "mod-source-register"
      },
      {
        event_id: "lifecycle-candidate-qualified",
        from: "CALIBRATION_CANDIDATE",
        to: "QUALIFIED_WITH_LIMITS",
        receipt_ref: "mod-source-register"
      }
    ],
    mjp_fixtures: createDefaultMjpFixtures(macro_key)
  };
}

function createDefaultMjpFixtures(macro_key: ModMacroKey): readonly ModMjpFixtureEvidence[] {
  return Array.from({ length: MACRO_CONFIG[macro_key].minimum_fixture_count }, (_, index) => {
    const fixture_id = `${macro_key.toLowerCase()}-fixture-${String(index + 1).padStart(2, "0")}`;
    const input = {
      fixture_id,
      macro_key,
      case_index: index + 1,
      source_classification: "SYNTHETIC_ONLY",
      bounded: true,
      stakeholder:
        macro_key === "R2"
          ? (
              [
                "CUSTOMER_FAMILY",
                "REGULATOR_PAYER",
                "BANK_INVESTOR",
                "WORKFORCE",
                "COMPETITOR_MARKET"
              ] as const
            )[index % 5]
          : undefined,
      variant_family: macro_key === "R3" ? MOD_EXPERIMENT_FAMILIES[index % 5] : undefined,
      rights_status: macro_key === "R5" ? "PUBLIC_SAFE" : undefined,
      expiry: macro_key === "R5" ? "2027-08-28" : undefined,
      requested_at: macro_key === "R5" ? "2026-08-28T00:00:00.000Z" : undefined
    };
    const result = {
      fixture_id,
      macro_key,
      validation: "PASSED",
      execution: "DETERMINISTIC_LOCAL_FIXTURE",
      candidate_only: true,
      official_truth_write: false,
      settlement_write: false,
      execution_evidence: executeMjpFixture(input)
    };
    return Object.freeze({
      fixture_id,
      macro_key,
      input,
      result,
      input_digest: stableDigest(input),
      result_digest: stableDigest(result)
    });
  });
}

function createFreshNeedProof(
  macro_key: ModMacroKey,
  refs: readonly ModExactRef[]
): ModFreshNeedProof {
  const base = {
    proof_id: `fresh-need-${macro_key.toLowerCase()}-20260828`,
    macro_key,
    consumer_id: MACRO_CONFIG[macro_key].consumer_id,
    need_statement: MACRO_CONFIG[macro_key].need_by,
    issued_at: "2026-08-28T00:00:00.000Z",
    expires_at: "2026-09-28T00:00:00.000Z",
    source_refs: refs.slice(0, 3),
    authority: "MAIN_NEED_REVIEW" as const
  };
  return { ...base, content_digest: stableDigest(base) };
}

function isExperimentVariant(value: unknown): value is ModExperimentVariant {
  return (
    isRecord(value) &&
    typeof value.variant_id === "string" &&
    isSafeIdentity(value.variant_id) &&
    typeof value.family === "string" &&
    MOD_EXPERIMENT_FAMILIES.includes(value.family as ModExperimentFamily) &&
    (value.feasibility === "FEASIBLE" ||
      value.feasibility === "INFEASIBLE" ||
      value.feasibility === "UNKNOWN") &&
    typeof value.parameter_digest === "string" &&
    DIGEST_PATTERN.test(value.parameter_digest)
  );
}

function isRegionalTarget(value: unknown): value is ModRegionalTarget {
  return (
    isRecord(value) &&
    typeof value.region_id === "string" &&
    isSafeIdentity(value.region_id) &&
    typeof value.geography_scope === "string" &&
    isSafeIdentity(value.geography_scope) &&
    (value.rights_status === "PUBLIC_SAFE" ||
      value.rights_status === "RESTRICTED" ||
      value.rights_status === "UNKNOWN") &&
    typeof value.expiry === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value.expiry)
  );
}

function assertRequest(input: ModMacroRequest): void {
  const config = MACRO_CONFIG[input.macro_key];
  if (
    !config ||
    input.mission_id !== MOD_MACRO_IDS[input.macro_key] ||
    input.consumer_id !== config.consumer_id
  ) {
    throw new Error("MOD_MACRO_IDENTITY_INVALID");
  }
  if (input.exact_refs.length < 4 || !input.exact_refs.every(isExactRef)) {
    throw new Error("MOD_EXACT_REF_INVALID");
  }
  if (
    !Array.isArray(input.stakeholder_signals) ||
    !input.stakeholder_signals.every((signal) => signalFromUnknown(signal) !== null)
  ) {
    throw new Error("MOD_SIGNAL_INVALID");
  }
  if (
    !Array.isArray(input.experiment_variants) ||
    !input.experiment_variants.every(isExperimentVariant) ||
    (input.macro_key === "R3" &&
      !MOD_EXPERIMENT_FAMILIES.every((family) =>
        input.experiment_variants.some((variant) => variant.family === family)
      ))
  ) {
    throw new Error("MOD_EXPERIMENT_VARIANT_INVALID");
  }
  if (!isRegionalTarget(input.regional_target)) {
    throw new Error("MOD_REGION_TARGET_INVALID");
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(input.requested_at)) {
    throw new Error("MOD_REQUEST_TIMESTAMP_INVALID");
  }
  const requestedAt = Date.parse(input.requested_at);
  const regionalExpiry = Date.parse(input.regional_target.expiry);
  if (!Number.isFinite(requestedAt) || !Number.isFinite(regionalExpiry)) {
    throw new Error("MOD_REGION_EXPIRY_INVALID");
  }
  if (
    !Array.isArray(input.mjp_fixtures) ||
    !input.mjp_fixtures.every((fixture) => isMjpFixtureEvidence(fixture, input.macro_key)) ||
    new Set(input.mjp_fixtures.map((fixture) => fixture.fixture_id)).size !==
      input.mjp_fixtures.length
  ) {
    throw new Error("MOD_MJP_FIXTURE_INVALID");
  }
  if (input.fresh_need_proof !== null) {
    if (
      !isFreshNeedProof(input.fresh_need_proof) ||
      input.fresh_need_proof.macro_key !== input.macro_key ||
      input.fresh_need_proof.consumer_id !== input.consumer_id ||
      input.fresh_need_proof.source_refs.some(
        (proofRef) =>
          !input.exact_refs.some((ref) => stableStringify(ref) === stableStringify(proofRef))
      ) ||
      requestedAt < Date.parse(input.fresh_need_proof.issued_at) ||
      requestedAt > Date.parse(input.fresh_need_proof.expires_at)
    ) {
      throw new Error("MOD_FRESH_NEED_PROOF_INVALID");
    }
  }
  if (
    input.stakeholder_signals.some(
      (signal) => !Number.isFinite(signal.strength) || signal.strength < -1 || signal.strength > 1
    )
  ) {
    throw new Error("MOD_SIGNAL_OUT_OF_DOMAIN");
  }
}

function isFreshNeedProof(value: unknown): value is ModFreshNeedProof {
  if (
    !isRecord(value) ||
    typeof value.proof_id !== "string" ||
    typeof value.macro_key !== "string" ||
    typeof value.consumer_id !== "string" ||
    typeof value.need_statement !== "string" ||
    typeof value.issued_at !== "string" ||
    typeof value.expires_at !== "string" ||
    !Array.isArray(value.source_refs) ||
    value.authority !== "MAIN_NEED_REVIEW" ||
    typeof value.content_digest !== "string" ||
    !MOD_MACRO_KEYS.includes(value.macro_key as ModMacroKey) ||
    !value.source_refs.every(isExactRef) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value.issued_at) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value.expires_at) ||
    !Number.isFinite(Date.parse(value.issued_at)) ||
    !Number.isFinite(Date.parse(value.expires_at)) ||
    Date.parse(value.expires_at) <= Date.parse(value.issued_at) ||
    !DIGEST_PATTERN.test(value.content_digest)
  ) {
    return false;
  }
  const { content_digest, ...withoutDigest } = value;
  return content_digest === stableDigest(withoutDigest);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function roleVisibility(): ModRoleVisibility {
  return {
    teacher: {
      visibility: "TEACHER_ONLY",
      fields: ["candidate", "provenance", "conflicts", "known_limits"]
    },
    student: {
      visibility: "STUDENT_SAFE",
      fields: ["candidate_type", "bounded_diagnostic", "confidence", "known_limits"]
    },
    admin: {
      visibility: "INTERNAL_RESEARCH_ONLY",
      fields: ["authority", "exact_binding", "hashes", "audit"]
    }
  };
}

function transformation(
  input: ModMacroRequest,
  output: string,
  rule: string
): ModTransformationRecord {
  return {
    input: input.exact_refs.map((ref) => ref.resource_id),
    rule,
    assumption:
      "Synthetic candidate input is descriptive and does not establish calibration or causality.",
    output,
    unit: "candidate index or bounded diagnostic delta",
    time_scope: "2026-01-01/2026-12-31",
    geography: "SHANGHAI_CN",
    confidence: "LOW",
    provenance: "MOD_SUPPORT_SYNTHETIC_ONLY"
  };
}

function baseCandidate(input: ModMacroRequest): Record<string, unknown> {
  return {
    input_classification: input.source_classification,
    exact_ref_count: input.exact_refs.length,
    official_influence: 0,
    provider_mode: "OFF",
    formal_activation: false
  };
}

function buildCandidate(input: ModMacroRequest): {
  readonly candidate: Record<string, unknown>;
  readonly transformations: readonly ModTransformationRecord[];
  readonly conflicts: readonly { readonly signal_id: string; readonly reason: string }[];
  readonly status: ModMacroStatus;
  readonly state_to: "STATE_B" | "TOMBSTONED";
} {
  const candidate = baseCandidate(input);
  const transformations = [
    transformation(input, `${input.macro_key}.candidate`, "exact refs -> bounded candidate payload")
  ];
  if ((input.macro_key === "R4" || input.macro_key === "R6") && input.fresh_need_proof === null) {
    return {
      candidate: {
        ...candidate,
        execution: "SKIPPED",
        reason: "NO_FRESH_NEED_PROOF",
        tombstone: true
      },
      transformations: [],
      conflicts: [],
      status: "SKIP_TOMBSTONED",
      state_to: "TOMBSTONED"
    };
  }
  if (input.macro_key === "R1") {
    return {
      candidate: {
        ...candidate,
        reuse_status: "CURRENT_MAIN_CAPABILITY_REUSED_WITH_LOCAL_EVIDENCE",
        consumer_evidence: {
          consumer_id: "MAIN-SH-FV-O1-GOVERNED-SHANGHAI-FULL-VERTICAL",
          route_mode: "READ_ONLY_COMPOSITION",
          current_surface: ["TEACHER", "STUDENT", "ADMIN"],
          exact_binding_guard: "ShanghaiFullVerticalService.requireExactBinding",
          shared_contract_guard: "isShanghaiFullVerticalBound",
          source_of_truth: "W5_GOVERNED_MODEL_SERVICE"
        },
        binding_kind: "WANT_CAN_DYNAMICS_FINANCE_MECHANISM",
        exact_component_refs: input.exact_refs.map((ref) => ({ ...ref })),
        qualification_status: "NOT_CALIBRATED",
        calibration_evidence: false,
        out_of_domain_action: "FAIL_CLOSED",
        expiry: "2027-08-28",
        fallback: "CORE_ELDERCARE_V1",
        model_handoff: {
          consumer: "MAIN-SH-FV-O1-GOVERNED-SHANGHAI-FULL-VERTICAL",
          unit: "readiness index",
          range: "0..1",
          confidence: "LOW",
          temporal_scope: "2026",
          calibration_evidence: false
        }
      },
      transformations,
      conflicts: [],
      status: "JOIN_WITH_LIMITS",
      state_to: "STATE_B"
    };
  }
  if (input.macro_key === "R2") {
    const evaluation = evaluateStakeholderShadow(input.stakeholder_signals);
    return {
      candidate: {
        ...candidate,
        signal_taxonomy: [
          "CUSTOMER_FAMILY",
          "REGULATOR_PAYER",
          "BANK_INVESTOR",
          "WORKFORCE",
          "COMPETITOR_MARKET"
        ],
        diagnostic_responses: evaluation.diagnostic_responses,
        abstentions: evaluation.abstentions,
        official_influence: 0,
        double_count_guard: "ON",
        ai_mode: "OFF",
        output_mode: "DIAGNOSTIC_SHADOW_ONLY",
        consumer_binding: {
          consumer_id: "MAIN-GSI-O1-GOVERNED-STAKEHOLDER-SHADOW-PLANE",
          runtime_status: "NOT_IMPLEMENTED_OR_PROVEN",
          revalidation_required: true
        }
      },
      transformations,
      conflicts: evaluation.conflicts,
      status: "JOIN_WITH_LIMITS",
      state_to: "STATE_B"
    };
  }
  if (input.macro_key === "R3") {
    const variants = input.experiment_variants.map((variant) => ({
      ...evaluateExecutiveExperimentVariant(variant),
      parameter_digest: variant.parameter_digest
    }));
    return {
      candidate: {
        ...candidate,
        experiment_history_manifest: input.exact_refs.map((ref) => ({ ...ref })),
        variants,
        families_covered: MOD_EXPERIMENT_FAMILIES.filter((family) =>
          input.experiment_variants.some((variant) => variant.family === family)
        ),
        comparison_scope: "WANT_CAN_DYNAMICS_FINANCE_PORTFOLIO",
        reproducibility: {
          replayable: true,
          official: false,
          history_digest: stableDigest(input.exact_refs),
          variant_digest: stableDigest(input.experiment_variants),
          no_implicit_latest: true
        },
        feasibility_policy: {
          infeasible: "NOT_EXECUTED",
          unknown: "ABSTAINED",
          comparable_only_when: "FEASIBLE"
        },
        consumer_binding: {
          consumer_id: "MAIN-ESL-O1-EXECUTIVE-STRATEGY-LAB",
          runtime_status: "NOT_IMPLEMENTED_OR_PROVEN",
          recommendation_writer: "NONE"
        }
      },
      transformations,
      conflicts: [],
      status: "JOIN_WITH_LIMITS",
      state_to: "STATE_B"
    };
  }
  if (input.macro_key === "R4") {
    const regimes = ["BASELINE", "DEMAND_STRESS", "CAPACITY_STRESS", "COMBINED_STRESS"].map(
      (regime_id, index) => ({
        regime_id,
        uncertainty_band: {
          lower: -0.1 - index * 0.02,
          upper: 0.1 + index * 0.02,
          unit: "candidate index"
        },
        sensitivity_evidence: "DESCRIPTIVE_ONLY",
        variance_band: 0.05 + index * 0.01,
        option_value_band: "NOT_ESTABLISHED"
      })
    );
    return {
      candidate: {
        ...candidate,
        robustness_status: "QUALIFIED_WITH_LIMITS",
        regimes,
        causal_claim: false,
        recommendation_status: "NOT_PRODUCED"
      },
      transformations,
      conflicts: [],
      status: "JOIN_WITH_LIMITS",
      state_to: "STATE_B"
    };
  }
  if (input.macro_key === "R5") {
    const modelRef = input.exact_refs[2];
    if (!modelRef) throw new Error("MOD_EXACT_REF_INVALID");
    const rightsIssue =
      input.regional_target.rights_status !== "PUBLIC_SAFE"
        ? "REGIONAL_RIGHTS_NOT_PUBLIC_SAFE"
        : Date.parse(input.regional_target.expiry) <= Date.parse(input.requested_at)
          ? "REGIONAL_TRANSFER_EXPIRED_BEFORE_REQUEST"
          : null;
    const comparisons = evaluateR5Comparisons(input, modelRef);
    return {
      candidate: {
        ...candidate,
        source_region: "SHANGHAI",
        target_region: input.regional_target.region_id,
        geography_scope: input.regional_target.geography_scope,
        rights_status: input.regional_target.rights_status,
        expiry: input.regional_target.expiry,
        ...comparisons,
        out_of_domain_action: "FAIL_CLOSED",
        calibration_status: "NOT_CALIBRATED",
        spatial_feature_status: "NOT_MATERIAL",
        fallback: "SOURCE_SCENARIO_CANDIDATE",
        regional_transfer_allowed: rightsIssue === null,
        compatibility_status: rightsIssue === null ? "COMPATIBLE_WITH_LIMITS" : "NOT_JOINABLE",
        consumer_binding: {
          consumer_id: "MAIN-RT-O1-REGIONAL-TRANSFER-AND-SCENARIO-EVOLUTION",
          runtime_status: "NOT_IMPLEMENTED_OR_PROVEN",
          activation_writer: "NONE"
        }
      },
      transformations,
      conflicts: rightsIssue
        ? [
            {
              signal_id: input.regional_target.region_id,
              reason: rightsIssue
            }
          ]
        : [],
      status: rightsIssue === null ? "JOIN_WITH_LIMITS" : "EVIDENCE_INSUFFICIENT",
      state_to: "STATE_B"
    };
  }
  return {
    candidate: {
      ...candidate,
      lifecycle: [
        "REFERENCE",
        "ELIGIBLE",
        "CALIBRATION_CANDIDATE",
        "QUALIFIED_WITH_LIMITS",
        "EXPIRED",
        "ROLLBACK_READY"
      ],
      lifecycle_events: input.lifecycle_events,
      data_quality: ["identity", "rights", "missingness", "drift", "holdout", "expiry"],
      lifecycle_gate_matrix: [
        { state: "REFERENCE", required: ["identity", "source_rights"] },
        { state: "ELIGIBLE", required: ["data_quality", "holdout"] },
        { state: "CALIBRATION_CANDIDATE", required: ["drift", "holdout"] },
        { state: "QUALIFIED_WITH_LIMITS", required: ["expiry", "rollback_receipt"] },
        { state: "EXPIRED", required: ["expiry"] },
        { state: "ROLLBACK_READY", required: ["rollback_receipt"] }
      ],
      activation_allowed: false,
      rollback_receipt: {
        status: "PROPOSED",
        runtime_activation: false,
        formal_writer: "NONE",
        from_version: "1.0.0",
        to_version: "1.0.0"
      },
      calibration_status: "NOT_ELIGIBLE_UNTIL_LAWFUL_EVIDENCE"
    },
    transformations,
    conflicts: [],
    status: "JOIN_WITH_LIMITS",
    state_to: "STATE_B"
  };
}

export function compileModMacro(input: ModMacroRequest): ModMacroResult {
  assertRequest(input);
  const config = MACRO_CONFIG[input.macro_key];
  const built = buildCandidate(input);
  const fixtureReady = input.mjp_fixtures.length >= config.minimum_fixture_count;
  const resultStatus: ModMacroStatus =
    built.status === "SKIP_TOMBSTONED"
      ? built.status
      : built.status === "EVIDENCE_INSUFFICIENT" || !fixtureReady
        ? "EVIDENCE_INSUFFICIENT"
        : built.status;
  const emittedFixtures = resultStatus === "JOIN_WITH_LIMITS" || resultStatus === "JOIN";
  const mjpFixtures = emittedFixtures ? input.mjp_fixtures : [];
  const exactBinding = {
    binding_digest: stableDigest({
      macro_key: input.macro_key,
      mission_id: input.mission_id,
      refs: input.exact_refs
    }),
    no_implicit_latest: true as const,
    refs: input.exact_refs
  };
  const resultWithoutDigest = {
    schema_version: MOD_SUPPORT_SCHEMA_VERSION,
    macro_key: input.macro_key,
    mission_id: input.mission_id,
    candidate_type: config.candidate_type,
    status: resultStatus,
    state_transition: { from: "STATE_A" as const, to: built.state_to },
    exact_binding: exactBinding,
    candidate: built.candidate,
    evidence: {
      inputs: input.exact_refs.map((ref, index) => ({
        ref,
        role: index === 0 ? ("TEACHER_ONLY" as const) : ("INTERNAL_RESEARCH_ONLY" as const)
      })),
      transformations: built.transformations,
      conflicts: built.conflicts,
      differential: {
        mode: "NON_OFFICIAL" as const,
        replay_truth_write: false as const,
        official_result_overwrite: false as const
      }
    },
    mjp: {
      status: emittedFixtures ? ("PASS" as const) : ("SKIP" as const),
      fixture_count: mjpFixtures.length,
      minimum_fixture_count: resultStatus === "SKIP_TOMBSTONED" ? 0 : config.minimum_fixture_count,
      fixture_ids: mjpFixtures.map((fixture) => fixture.fixture_id),
      fixtures: mjpFixtures
    },
    role_visibility: roleVisibility(),
    authority: {
      candidate_writer: "MOD_SUPPORT_CANDIDATE_COMPILER" as const,
      formal_writer: "NONE" as const,
      official_truth_write: false as const,
      settlement_write: false as const,
      parameter_set_formal_write: false as const,
      replay_truth_write: false as const,
      provider: "OFF" as const,
      runtime_authority: "JSON_INTERNAL_ONLY" as const
    },
    join_request: {
      consumer_id: input.consumer_id,
      need_by: input.need_by,
      consumer_ready: false as const,
      exact_binding_required: true as const,
      join_gate:
        built.status === "SKIP_TOMBSTONED"
          ? ("FRESH_NEED_PROOF_REQUIRED" as const)
          : built.status === "EVIDENCE_INSUFFICIENT" && input.macro_key === "R5"
            ? ("REGIONAL_RIGHTS_AND_EXPIRY_REQUIRED" as const)
            : ("MAIN_REVIEW_REQUIRED" as const),
      requested_status: resultStatus
    },
    known_limits: [
      "Candidate-only support evidence; no formal Truth, Settlement, ParameterSet, Model Governance, Registry, or Runtime write.",
      "Provider is OFF and all values are synthetic or reference-only; calibration is not proven.",
      "MAIN must revalidate exact binding, consumer need, role visibility, rights, expiry, and non-overwrite semantics before any integration.",
      ...(resultStatus === "EVIDENCE_INSUFFICIENT"
        ? [
            "MJP PASS is withheld until the configured number of verifiable fixture input/result pairs is supplied."
          ]
        : [])
    ]
  } satisfies Omit<ModMacroResult, "candidate_digest">;
  const candidate_digest = stableDigest(resultWithoutDigest);
  return deepFreeze({ ...resultWithoutDigest, candidate_digest });
}

export function assertModMacroResult(value: ModMacroResult): void {
  if (
    value.schema_version !== MOD_SUPPORT_SCHEMA_VERSION ||
    value.exact_binding.no_implicit_latest !== true ||
    !value.exact_binding.refs.every(isExactRef) ||
    value.authority.official_truth_write !== false ||
    value.authority.settlement_write !== false ||
    value.authority.parameter_set_formal_write !== false ||
    value.authority.replay_truth_write !== false ||
    value.authority.provider !== "OFF" ||
    value.authority.formal_writer !== "NONE" ||
    value.join_request.consumer_ready !== false ||
    value.join_request.exact_binding_required !== true
  ) {
    throw new Error("MOD_RESULT_AUTHORITY_OR_BINDING_INVALID");
  }
  if (
    !Array.isArray(value.mjp.fixtures) ||
    !value.mjp.fixtures.every((fixture) => isMjpFixtureEvidence(fixture, value.macro_key)) ||
    value.mjp.fixture_count !== value.mjp.fixtures.length ||
    value.mjp.fixture_ids.length !== value.mjp.fixtures.length ||
    value.mjp.fixture_ids.some(
      (fixtureId, index) => fixtureId !== value.mjp.fixtures[index]?.fixture_id
    )
  ) {
    throw new Error("MOD_MJP_FIXTURE_INVALID");
  }
  if (value.status === "SKIP_TOMBSTONED") {
    if (
      value.state_transition.to !== "TOMBSTONED" ||
      value.mjp.status !== "SKIP" ||
      value.mjp.fixture_count !== 0
    )
      throw new Error("MOD_TOMBSTONE_INVALID");
  } else {
    if (value.state_transition.to !== "STATE_B") throw new Error("MOD_STATE_B_OR_MJP_INVALID");
    if (value.status === "EVIDENCE_INSUFFICIENT") {
      if (value.mjp.status !== "SKIP" || value.mjp.fixture_count !== 0) {
        throw new Error("MOD_STATE_B_OR_MJP_INVALID");
      }
    } else if (
      value.mjp.status !== "PASS" ||
      value.mjp.fixture_count < value.mjp.minimum_fixture_count
    ) {
      throw new Error("MOD_STATE_B_OR_MJP_INVALID");
    }
  }
  if (value.join_request.requested_status !== value.status) {
    throw new Error("MOD_JOIN_STATUS_INVALID");
  }
  const student = JSON.stringify(value.role_visibility.student);
  if (
    /state_true|market_share|revenue|profit|cash_flow|score|rank|settlement|raw|secret|private/i.test(
      student
    )
  ) {
    throw new Error("MOD_STUDENT_VISIBILITY_INVALID");
  }
  const { candidate_digest, ...withoutDigest } = value;
  if (candidate_digest !== stableDigest(withoutDigest)) {
    throw new Error("MOD_CANDIDATE_DIGEST_INVALID");
  }
}

export function validateModMacroResult(value: unknown): value is ModMacroResult {
  try {
    assertModMacroResult(value as ModMacroResult);
    return true;
  } catch {
    return false;
  }
}
