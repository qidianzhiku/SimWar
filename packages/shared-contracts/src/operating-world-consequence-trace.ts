import type { OperatingWorldEffectClass } from "./operating-world.js";

export const OPERATING_WORLD_CONSEQUENCE_TRACE_SCHEMA_VERSION =
  "operating-world-consequence-trace.v1" as const;

export type OperatingWorldConsequenceOfficialDelta = "NONE" | "WHITELISTED_ONLY";
export type OperatingWorldConsequenceCausalAuthority = "DETERMINISTIC_SYSTEM_FACTS";
export type OperatingWorldConsequencePublicationStatus = "SETTLED_UNPUBLISHED" | "PUBLISHED";

export interface OperatingWorldConsequenceEffect {
  readonly family: "SH-17";
  readonly key: "capital_cost";
  readonly classification: OperatingWorldEffectClass;
  readonly input_bucket: "0.00-0.25" | "0.25-0.50" | "0.50-0.75" | "0.75-1.00" | "UNKNOWN";
  readonly consumer: "W4_CAPITAL_ACTION_OR_NEW_PROJECT_ADMISSION";
  readonly outcome_field: "rate_or_cost_bps";
  readonly effect_direction: "constrains" | "increases" | "decreases" | "unchanged";
}

export interface OperatingWorldConsequenceTrace {
  readonly schema_version: typeof OPERATING_WORLD_CONSEQUENCE_TRACE_SCHEMA_VERSION;
  readonly trace_id: string;
  readonly scope: {
    readonly tenant_id: string;
    readonly course_id: string;
    readonly run_id: string;
    readonly round_no: number;
    readonly team_id: string;
  };
  readonly operating_world_binding_digest: string;
  readonly canonical_decision_ref: string;
  readonly w4_action_ref?: string;
  readonly w4_replay_manifest_ref?: string;
  readonly settlement_result_ref: string;
  readonly replay_relevant_digest: string;
  readonly publication: {
    readonly status: OperatingWorldConsequencePublicationStatus;
    readonly published_at?: string;
  };
  readonly allowed_effects: readonly OperatingWorldConsequenceEffect[];
  readonly constraints: readonly string[];
  readonly known_limits: readonly string[];
  readonly source_classification: OperatingWorldEffectClass;
  readonly official_delta: OperatingWorldConsequenceOfficialDelta;
  readonly writes_official_state: false;
  readonly causal_authority: OperatingWorldConsequenceCausalAuthority;
  readonly ai_generated: false;
}

export function isOperatingWorldConsequenceTrace(
  value: unknown
): value is OperatingWorldConsequenceTrace {
  if (!isRecord(value)) return false;
  const scope = isRecord(value.scope) ? value.scope : undefined;
  const keys = [
    "schema_version",
    "trace_id",
    "scope",
    "operating_world_binding_digest",
    "canonical_decision_ref",
    "w4_action_ref",
    "w4_replay_manifest_ref",
    "settlement_result_ref",
    "replay_relevant_digest",
    "publication",
    "allowed_effects",
    "constraints",
    "known_limits",
    "source_classification",
    "official_delta",
    "writes_official_state",
    "causal_authority",
    "ai_generated"
  ];
  if (Object.keys(value).some((key) => !keys.includes(key))) return false;
  if (
    value.schema_version !== OPERATING_WORLD_CONSEQUENCE_TRACE_SCHEMA_VERSION ||
    !isIdentity(value.trace_id) ||
    !scope ||
    !isIdentity(scope.tenant_id) ||
    !isIdentity(scope.course_id) ||
    !isIdentity(scope.run_id) ||
    typeof scope.round_no !== "number" ||
    !Number.isInteger(scope.round_no) ||
    scope.round_no < 1 ||
    !isIdentity(scope.team_id) ||
    !isDigest(value.operating_world_binding_digest) ||
    !isIdentity(value.canonical_decision_ref) ||
    !isIdentity(value.settlement_result_ref) ||
    !isDigest(value.replay_relevant_digest) ||
    !isPublication(value.publication) ||
    !Array.isArray(value.allowed_effects) ||
    !value.allowed_effects.every(isEffect) ||
    !isTextArray(value.constraints) ||
    !isTextArray(value.known_limits) ||
    !isOneOf(
      ["OFFICIAL_CONSUMER_ELIGIBLE", "SHADOW_ONLY", "INFORMATION_ONLY", "BLOCKED"],
      value.source_classification
    ) ||
    !isOneOf(["NONE", "WHITELISTED_ONLY"], value.official_delta) ||
    value.writes_official_state !== false ||
    value.causal_authority !== "DETERMINISTIC_SYSTEM_FACTS" ||
    value.ai_generated !== false
  ) {
    return false;
  }
  return (
    (value.w4_action_ref === undefined || isIdentity(value.w4_action_ref)) &&
    (value.w4_replay_manifest_ref === undefined || isIdentity(value.w4_replay_manifest_ref))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) &&
    !/(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  );
}

function isTextArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        typeof item === "string" &&
        item.length > 0 &&
        !item.includes("<") &&
        !item.includes(">") &&
        !Array.from(item).some((character) => character.charCodeAt(0) < 0x20)
    )
  );
}

function isOneOf<const T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isPublication(value: unknown): value is OperatingWorldConsequenceTrace["publication"] {
  return (
    isRecord(value) &&
    isOneOf(["SETTLED_UNPUBLISHED", "PUBLISHED"], value.status) &&
    (value.published_at === undefined || typeof value.published_at === "string")
  );
}

function isEffect(value: unknown): value is OperatingWorldConsequenceEffect {
  return (
    isRecord(value) &&
    value.family === "SH-17" &&
    value.key === "capital_cost" &&
    isOneOf(
      ["OFFICIAL_CONSUMER_ELIGIBLE", "SHADOW_ONLY", "INFORMATION_ONLY", "BLOCKED"],
      value.classification
    ) &&
    isOneOf(["0.00-0.25", "0.25-0.50", "0.50-0.75", "0.75-1.00", "UNKNOWN"], value.input_bucket) &&
    value.consumer === "W4_CAPITAL_ACTION_OR_NEW_PROJECT_ADMISSION" &&
    value.outcome_field === "rate_or_cost_bps" &&
    isOneOf(["constrains", "increases", "decreases", "unchanged"], value.effect_direction)
  );
}
