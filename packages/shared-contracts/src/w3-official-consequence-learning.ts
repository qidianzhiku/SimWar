import {
  isOperatingWorldConsequenceTrace,
  type OperatingWorldConsequenceTrace
} from "./operating-world-consequence-trace.js";

export const W3_OFFICIAL_CONSEQUENCE_SCHEMA_VERSION =
  "w3-official-consequence-learning.v1" as const;

export const W3_CAUSAL_LABELS = ["model_conditioned_association", "causal_not_proven"] as const;
export type W3CausalLabel = (typeof W3_CAUSAL_LABELS)[number];

export const W3_PUBLICATION_STATUSES = ["SETTLED_UNPUBLISHED", "PUBLISHED"] as const;
export type W3PublicationStatus = (typeof W3_PUBLICATION_STATUSES)[number];

export const W3_LEARNING_STATUSES = ["MISSING", "DRAFT", "CONFIRMED"] as const;
export type W3LearningStatus = (typeof W3_LEARNING_STATUSES)[number];

export const W3_HYPOTHESIS_STATUSES = ["READY", "BLOCKED"] as const;
export type W3HypothesisStatus = (typeof W3_HYPOTHESIS_STATUSES)[number];

export const W3_REFERENCE_TYPES = [
  "canonical_decision",
  "course",
  "evidence_artifact",
  "learning_goal_version",
  "round",
  "run",
  "settlement_result",
  "student_learning_report",
  "teacher_confirmation_version",
  "transformation_rule"
] as const;
export type W3ReferenceType = (typeof W3_REFERENCE_TYPES)[number];

export interface W3ExactRef {
  readonly content_digest: string;
  readonly discriminator: "exact_ref";
  readonly resource_id: string;
  readonly resource_type: W3ReferenceType;
  readonly tenant_id: string;
  readonly version: string;
}

export interface W3OfficialConsequenceContext {
  readonly activity_id: string;
  readonly course_id: string;
  readonly role_key: string;
  readonly round_id: string;
  readonly round_no: number;
  readonly run_id: string;
  readonly team_id: string;
  readonly tenant_id: string;
}

export interface W3OfficialResultProjection {
  readonly outcome_label: "official_published" | "official_settled_unpublished";
  readonly profit_band: "loss" | "thin" | "healthy";
  readonly rank: number;
  readonly score: number;
  readonly team_id: string;
}

export interface W3DecisionStory {
  readonly consequence_summary: string;
  readonly decision_summary: string;
}

export interface W3CausalDebrief {
  readonly label: W3CausalLabel;
  readonly statements: readonly string[];
}

export interface W3CounterfactualProjection {
  readonly causal_label: W3CausalLabel;
  readonly changed_field:
    | "capacity_plan"
    | "cash_buffer_target"
    | "marketing_budget"
    | "pricing.base_price"
    | "service_quality_budget";
  readonly changed_value_digest: string;
  readonly comparison: {
    readonly official_score: number;
    readonly counterfactual_score: number;
    readonly score_delta: number;
    readonly official_rank: number;
    readonly counterfactual_rank: number;
    readonly rank_delta: number;
  };
  readonly counterfactual_id: string;
  readonly exact_context_ref: W3ExactRef;
  readonly official: false;
  readonly original_value_digest: string;
}

export interface W3ReflectionProjection {
  readonly ai_used: false;
  readonly advisory_only: true;
  readonly prompt_id: string;
  readonly reflection_id: string;
  readonly response: string;
  readonly status: "SUBMITTED";
}

export interface W3EvidenceSelectionProjection {
  readonly evidence_refs: readonly W3ExactRef[];
  readonly selection_id: string;
  readonly status: "SELECTED";
}

export interface W3LearningProjection {
  readonly evidence_selection_status: "NOT_SELECTED" | "SELECTED";
  readonly next_round_hypothesis_status: W3HypothesisStatus;
  readonly student_learning_report_ref?: W3ExactRef;
  readonly teacher_confirmation_ref?: W3ExactRef;
  readonly teacher_confirmation_status: W3LearningStatus;
}

export interface W3NextRoundHypothesis {
  readonly basis: string;
  readonly hypothesis: string;
  readonly status: W3HypothesisStatus;
}

export interface W3OfficialConsequenceRecord {
  readonly causal_debrief: W3CausalDebrief;
  readonly context: W3OfficialConsequenceContext;
  readonly counterfactual?: W3CounterfactualProjection;
  readonly decision_story: W3DecisionStory;
  readonly evidence_selection?: W3EvidenceSelectionProjection;
  readonly known_limits: readonly string[];
  readonly learning: W3LearningProjection;
  readonly operating_world_consequence_trace?: OperatingWorldConsequenceTrace;
  readonly next_round_hypothesis?: W3NextRoundHypothesis;
  readonly official_result: W3OfficialResultProjection;
  readonly publication: {
    readonly published_at?: string;
    readonly status: W3PublicationStatus;
  };
  readonly reflection?: W3ReflectionProjection;
  readonly record_id: string;
  readonly runtime_authority: "JSON_INTERNAL_ONLY";
  readonly schema_version: typeof W3_OFFICIAL_CONSEQUENCE_SCHEMA_VERSION;
  readonly source: {
    readonly canonical_decision_ref: W3ExactRef;
    readonly round_ref: W3ExactRef;
    readonly settlement_ref: W3ExactRef;
  };
}

export interface W3OfficialConsequenceResponse {
  readonly known_limits: readonly string[];
  readonly record: W3OfficialConsequenceRecord;
  readonly runtime_authority: "JSON_INTERNAL_ONLY";
  readonly visibility: "student_safe" | "teacher_safe";
}

export interface W3CounterfactualCommandInput {
  readonly changed_field: W3CounterfactualProjection["changed_field"];
  readonly changed_value: number | string;
  readonly context: W3OfficialConsequenceContext;
  readonly idempotency_key: string;
}

export interface W3ReflectionCommandInput {
  readonly context: W3OfficialConsequenceContext;
  readonly idempotency_key: string;
  readonly prompt_id: string;
  readonly response: string;
}

export interface W3EvidenceSelectionCommandInput {
  readonly context: W3OfficialConsequenceContext;
  readonly evidence_refs: readonly W3ExactRef[];
  readonly idempotency_key: string;
}

export interface W3HypothesisCommandInput {
  readonly context: W3OfficialConsequenceContext;
}

export function isW3ExactRef(value: unknown): value is W3ExactRef {
  if (!isRecord(value) || Object.keys(value).length !== 6) return false;
  return (
    value.discriminator === "exact_ref" &&
    typeof value.content_digest === "string" &&
    /^[a-f0-9]{64}$/.test(value.content_digest) &&
    typeof value.resource_id === "string" &&
    isIdentity(value.resource_id) &&
    typeof value.resource_type === "string" &&
    W3_REFERENCE_TYPES.includes(value.resource_type as W3ReferenceType) &&
    typeof value.tenant_id === "string" &&
    isIdentity(value.tenant_id) &&
    typeof value.version === "string" &&
    /^\d+\.\d+\.\d+$/.test(value.version)
  );
}

export function isW3OfficialConsequenceContext(
  value: unknown
): value is W3OfficialConsequenceContext {
  if (!isRecord(value) || Object.keys(value).length !== 8) return false;
  return (
    isIdentity(value.activity_id) &&
    isIdentity(value.course_id) &&
    isIdentity(value.role_key) &&
    isIdentity(value.round_id) &&
    Number.isInteger(value.round_no) &&
    Number(value.round_no) > 0 &&
    isIdentity(value.run_id) &&
    isIdentity(value.team_id) &&
    isIdentity(value.tenant_id)
  );
}

export function isW3OfficialConsequenceRecord(
  value: unknown
): value is W3OfficialConsequenceRecord {
  if (!isRecord(value)) return false;
  const keys = [
    "causal_debrief",
    "context",
    "counterfactual",
    "decision_story",
    "evidence_selection",
    "known_limits",
    "learning",
    "operating_world_consequence_trace",
    "next_round_hypothesis",
    "official_result",
    "publication",
    "reflection",
    "record_id",
    "runtime_authority",
    "schema_version",
    "source"
  ];
  if (Object.keys(value).some((key) => !keys.includes(key))) return false;
  if (
    value.schema_version !== W3_OFFICIAL_CONSEQUENCE_SCHEMA_VERSION ||
    value.runtime_authority !== "JSON_INTERNAL_ONLY" ||
    !isIdentity(value.record_id) ||
    !isW3OfficialConsequenceContext(value.context) ||
    !isW3CausalDebrief(value.causal_debrief) ||
    !isW3DecisionStory(value.decision_story) ||
    !isW3OfficialResult(value.official_result) ||
    !isW3Publication(value.publication) ||
    !isLearning(value.learning) ||
    !Array.isArray(value.known_limits) ||
    !value.known_limits.every((item) => typeof item === "string" && item.length > 0) ||
    !isSource(value.source)
  ) {
    return false;
  }
  if (value.counterfactual !== undefined && !isCounterfactual(value.counterfactual)) return false;
  if (
    value.operating_world_consequence_trace !== undefined &&
    !isOperatingWorldConsequenceTrace(value.operating_world_consequence_trace)
  )
    return false;
  if (value.reflection !== undefined && !isReflection(value.reflection)) return false;
  if (value.evidence_selection !== undefined && !isEvidenceSelection(value.evidence_selection))
    return false;
  if (value.next_round_hypothesis !== undefined && !isHypothesis(value.next_round_hypothesis))
    return false;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<const T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) &&
    !/(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  );
}

function isSafeText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.includes("<") &&
    !value.includes(">") &&
    !Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    })
  );
}

function isW3CausalDebrief(value: unknown): value is W3CausalDebrief {
  return (
    isRecord(value) &&
    isOneOf(W3_CAUSAL_LABELS, value.label) &&
    Array.isArray(value.statements) &&
    value.statements.length > 0 &&
    value.statements.every(isSafeText)
  );
}

function isW3DecisionStory(value: unknown): value is W3DecisionStory {
  return (
    isRecord(value) && isSafeText(value.consequence_summary) && isSafeText(value.decision_summary)
  );
}

function isW3OfficialResult(value: unknown): value is W3OfficialResultProjection {
  return (
    isRecord(value) &&
    isOneOf(["official_published", "official_settled_unpublished"], value.outcome_label) &&
    isOneOf(["loss", "thin", "healthy"], value.profit_band) &&
    Number.isInteger(value.rank) &&
    Number.isInteger(value.score) &&
    isIdentity(value.team_id)
  );
}

function isW3Publication(value: unknown): boolean {
  return (
    isRecord(value) &&
    isOneOf(W3_PUBLICATION_STATUSES, value.status) &&
    (value.published_at === undefined || typeof value.published_at === "string")
  );
}

function isLearning(value: unknown): value is W3LearningProjection {
  return (
    isRecord(value) &&
    isOneOf(["NOT_SELECTED", "SELECTED"], value.evidence_selection_status) &&
    isOneOf(W3_HYPOTHESIS_STATUSES, value.next_round_hypothesis_status) &&
    isOneOf(W3_LEARNING_STATUSES, value.teacher_confirmation_status) &&
    (value.teacher_confirmation_ref === undefined ||
      isW3ExactRef(value.teacher_confirmation_ref)) &&
    (value.student_learning_report_ref === undefined ||
      isW3ExactRef(value.student_learning_report_ref))
  );
}

function isSource(value: unknown): boolean {
  return (
    isRecord(value) &&
    isW3ExactRef(value.canonical_decision_ref) &&
    value.canonical_decision_ref.resource_type === "canonical_decision" &&
    isW3ExactRef(value.round_ref) &&
    value.round_ref.resource_type === "round" &&
    isW3ExactRef(value.settlement_ref) &&
    value.settlement_ref.resource_type === "settlement_result"
  );
}

function isCounterfactual(value: unknown): value is W3CounterfactualProjection {
  if (!isRecord(value)) return false;
  return (
    value.official === false &&
    isOneOf(W3_CAUSAL_LABELS, value.causal_label) &&
    typeof value.changed_field === "string" &&
    typeof value.changed_value_digest === "string" &&
    /^[a-f0-9]{64}$/.test(value.changed_value_digest) &&
    typeof value.original_value_digest === "string" &&
    /^[a-f0-9]{64}$/.test(value.original_value_digest) &&
    isIdentity(value.counterfactual_id) &&
    isW3ExactRef(value.exact_context_ref) &&
    isRecord(value.comparison) &&
    Object.values(value.comparison).every((item) => typeof item === "number")
  );
}

function isReflection(value: unknown): value is W3ReflectionProjection {
  return (
    isRecord(value) &&
    value.ai_used === false &&
    value.advisory_only === true &&
    value.status === "SUBMITTED" &&
    isIdentity(value.prompt_id) &&
    isIdentity(value.reflection_id) &&
    isSafeText(value.response)
  );
}

function isEvidenceSelection(value: unknown): value is W3EvidenceSelectionProjection {
  return (
    isRecord(value) &&
    value.status === "SELECTED" &&
    isIdentity(value.selection_id) &&
    Array.isArray(value.evidence_refs) &&
    value.evidence_refs.length > 0 &&
    value.evidence_refs.every(
      (item: unknown) => isW3ExactRef(item) && item.resource_type === "evidence_artifact"
    )
  );
}

function isHypothesis(value: unknown): value is W3NextRoundHypothesis {
  return (
    isRecord(value) &&
    isOneOf(W3_HYPOTHESIS_STATUSES, value.status) &&
    isSafeText(value.basis) &&
    isSafeText(value.hypothesis)
  );
}
