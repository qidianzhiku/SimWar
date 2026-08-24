import type {
  OperatingWorldConsequenceTrace,
  OperatingWorldEffectClass,
  W3ExactRef
} from "@simwar/shared-contracts";

const DIGEST = /^[a-f0-9]{64}$/;
const CONSUMER = "W4_CAPITAL_ACTION_OR_NEW_PROJECT_ADMISSION" as const;
const TRACE_KNOWN_LIMITS = [
  "Trace is a post-result projection and never an official state or settlement writer.",
  "Only the existing W4 capital-action consumer is official-consumer eligible in R3.",
  "Input buckets are bounded public projections; private coefficients and raw source paths are excluded.",
  "AI is not used as causal authority."
] as const;

export interface OperatingWorldConsequenceTraceInput {
  readonly scope: OperatingWorldConsequenceTrace["scope"];
  readonly operating_world_binding_digest: string;
  readonly canonical_decision_ref: string;
  readonly settlement_result_ref: W3ExactRef;
  readonly replay_relevant_digest: string;
  readonly publication: OperatingWorldConsequenceTrace["publication"];
  readonly source_classification: OperatingWorldEffectClass;
  readonly w4_action?: {
    readonly capital_action_id: string;
    readonly cost_source: string;
    readonly rate_or_cost_bps?: number;
  };
  readonly w4_replay_manifest?: {
    readonly manifest_id: string;
    readonly operating_world_binding_digest?: string;
  };
}

export function resolveOperatingWorldBindingDigest(
  costSource: string | undefined
): string | undefined {
  if (!costSource?.startsWith("operating-world:")) return undefined;
  const digest = costSource.slice("operating-world:".length);
  return DIGEST.test(digest) ? digest : undefined;
}

function inputBucket(
  rateOrCostBps: number | undefined
): "0.00-0.25" | "0.25-0.50" | "0.50-0.75" | "0.75-1.00" | "UNKNOWN" {
  if (typeof rateOrCostBps !== "number" || !Number.isFinite(rateOrCostBps)) return "UNKNOWN";
  const value = rateOrCostBps / 10000;
  if (value < 0 || value > 1) return "UNKNOWN";
  if (value < 0.25) return "0.00-0.25";
  if (value < 0.5) return "0.25-0.50";
  if (value < 0.75) return "0.50-0.75";
  return "0.75-1.00";
}

function ensureDigest(value: string, field: string): void {
  if (!DIGEST.test(value)) throw new Error(`${field}_invalid`);
}

function settlementReference(ref: W3ExactRef): string {
  if (ref.resource_type !== "settlement_result") throw new Error("settlement_result_ref_invalid");
  return ref.resource_id;
}

export function createOperatingWorldConsequenceTrace(
  input: OperatingWorldConsequenceTraceInput
): OperatingWorldConsequenceTrace {
  ensureDigest(input.operating_world_binding_digest, "operating_world_binding_digest");
  ensureDigest(input.replay_relevant_digest, "replay_relevant_digest");
  const settlementResultRef = settlementReference(input.settlement_result_ref);
  const isOfficial = input.source_classification === "OFFICIAL_CONSUMER_ELIGIBLE";
  const actionDigest = resolveOperatingWorldBindingDigest(input.w4_action?.cost_source);
  const manifestDigest = input.w4_replay_manifest?.operating_world_binding_digest;

  if (isOfficial) {
    if (!input.w4_action || !input.w4_replay_manifest || !actionDigest || !manifestDigest) {
      throw new Error("operating_world_official_evidence_required");
    }
    if (
      actionDigest !== input.operating_world_binding_digest ||
      manifestDigest !== input.operating_world_binding_digest
    ) {
      throw new Error("operating_world_binding_digest_mismatch");
    }
  }

  const trace: OperatingWorldConsequenceTrace = {
    schema_version: "operating-world-consequence-trace.v1",
    trace_id: `operating_world_trace_${input.scope.run_id}_${input.scope.round_no}_${input.scope.team_id}`,
    scope: { ...input.scope },
    operating_world_binding_digest: input.operating_world_binding_digest,
    canonical_decision_ref: input.canonical_decision_ref,
    ...(isOfficial && input.w4_action ? { w4_action_ref: input.w4_action.capital_action_id } : {}),
    ...(isOfficial && input.w4_replay_manifest
      ? { w4_replay_manifest_ref: input.w4_replay_manifest.manifest_id }
      : {}),
    settlement_result_ref: settlementResultRef,
    replay_relevant_digest: input.replay_relevant_digest,
    publication: { ...input.publication },
    allowed_effects: isOfficial
      ? [
          {
            family: "SH-17",
            key: "capital_cost",
            classification: "OFFICIAL_CONSUMER_ELIGIBLE",
            input_bucket: inputBucket(input.w4_action?.rate_or_cost_bps),
            consumer: CONSUMER,
            outcome_field: "rate_or_cost_bps",
            effect_direction: "constrains"
          }
        ]
      : [],
    constraints: isOfficial
      ? ["Only the existing W4 capital-action admission consumer may apply this effect."]
      : ["This Operating World input produced no official W4 or Settlement delta."],
    known_limits: [...TRACE_KNOWN_LIMITS],
    source_classification: input.source_classification,
    official_delta: isOfficial ? "WHITELISTED_ONLY" : "NONE",
    writes_official_state: false,
    causal_authority: "DETERMINISTIC_SYSTEM_FACTS",
    ai_generated: false
  };

  return trace;
}

export function projectOperatingWorldConsequenceTrace(
  trace: OperatingWorldConsequenceTrace,
  surface: "student" | "teacher"
): OperatingWorldConsequenceTrace {
  if (surface === "teacher") return structuredClone(trace);
  const {
    w4_action_ref: _w4ActionRef,
    w4_replay_manifest_ref: _w4ReplayManifestRef,
    ...studentTrace
  } = trace;
  void _w4ActionRef;
  void _w4ReplayManifestRef;
  return structuredClone(studentTrace);
}
