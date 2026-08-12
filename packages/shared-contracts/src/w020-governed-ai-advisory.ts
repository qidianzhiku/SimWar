import type { CoachOutput, ModelCallLog } from "./index.js";

export const W020_ADVISORY_SCHEMA_VERSION = "w020.governed.ai.advisory.v1" as const;
export const W020_TRANSFORMATION_VERSION = "w020-role-safe-context-v1" as const;

export type W020AdvisorySurface = "student_role" | "teacher_debrief";
export type W020AdvisoryStatus = "generated" | "reused";
export type W020RoleKey = "CEO" | "CFO" | "CMO" | "COO";

interface W020AdvisoryRequestBase {
  discriminator: "w020_advisory_request";
  surface: W020AdvisorySurface;
  run_id: string;
  round_id: string;
  team_id: string;
  idempotency_key: string;
}

export interface W020StudentRoleAdvisoryRequest extends W020AdvisoryRequestBase {
  surface: "student_role";
  role_key: W020RoleKey;
}

export interface W020TeacherDebriefAdvisoryRequest extends W020AdvisoryRequestBase {
  surface: "teacher_debrief";
  role_key: W020RoleKey;
  activity_id: string;
}

export type W020AdvisoryRequest =
  | W020StudentRoleAdvisoryRequest
  | W020TeacherDebriefAdvisoryRequest;

export interface W020TeacherSafeSource {
  source_schema_version: "teaching-closure.v1";
  activity_id: string;
  role_key: W020RoleKey;
  course_report_available: true;
  confirmation_status: "CONFIRMED";
  outcome_status: "CONFIRMED";
  eligible_event_count: number;
  evidence_count: number;
  missing: [];
  student_safe_preview: {
    criterion_count: number;
    evidence_count: number;
    next_focus: string;
    status: "CONFIRMED";
    visibility: "student_safe";
  };
  runtime_authority: "JSON_INTERNAL_ONLY";
  known_limits: string[];
}

export interface W020AdvisoryContext {
  discriminator: "w020_role_safe_context";
  actor_role: "student" | "teacher" | "admin";
  actor_id_hash: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  role_key: W020RoleKey;
  activity_id?: string;
  teacher_safe_source?: W020TeacherSafeSource;
  advisory_scopes: string[];
  source_event_ids: string[];
  source_event_types: string[];
  context_digest: string;
  transformation_version: typeof W020_TRANSFORMATION_VERSION;
}

export interface W020AdvisoryProjection {
  advisory_only: true;
  surface: W020AdvisorySurface;
  title: string;
  recommendations: string[];
  evidence_refs: string[];
  known_limits: string[];
  teacher_debrief?: {
    activity_id: string;
    role_key: W020RoleKey;
    discussion_prompts: string[];
    explanations: string[];
    tradeoffs: string[];
    next_focus: string;
  };
}

export type W020CoachOutput = CoachOutput & {
  team_id: string;
  role_key: W020RoleKey;
  output_type: "advisory";
  model_call_log_id: string;
};

export interface W020AdvisoryReceipt {
  discriminator: "w020_advisory_receipt";
  status: W020AdvisoryStatus;
  request_id: string;
  request_digest: string;
  context: W020AdvisoryContext;
  projection: W020AdvisoryProjection;
  formal_truth_write: false;
  known_limits: string[];
}

export interface W020AdvisoryRecord {
  discriminator: "w020_advisory_record";
  tenant_id: string;
  idempotency_key: string;
  request_digest: string;
  surface: W020AdvisorySurface;
  context: W020AdvisoryContext;
  coach_output: W020CoachOutput;
  model_call_log: ModelCallLog;
  created_at: string;
}

export interface W020AdvisoryAuditRecord {
  discriminator: "w020_advisory_audit_record";
  tenant_id: string;
  idempotency_key: string;
  request_digest: string;
  surface: W020AdvisorySurface;
  context_digest: string;
  model_call_log: ModelCallLog;
  created_at: string;
}

export interface W020AdvisoryAuditDto {
  model_call_log_id: string;
  tenant_id: string;
  provider: string;
  model: string;
  purpose: ModelCallLog["purpose"];
  status: ModelCallLog["status"];
  input_hash: string;
  output_hash: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  latency_ms: number;
  created_at: string;
  surface: W020AdvisorySurface;
  context_digest: string;
}

export interface W020CoachOutputScope {
  tenant_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  role_key: W020RoleKey;
  evidence_refs: readonly string[];
}

const W020_ROLE_KEYS = new Set<W020RoleKey>(["CEO", "CFO", "CMO", "COO"]);
const W020_ADVISORY_SURFACES = new Set<W020AdvisorySurface>(["student_role", "teacher_debrief"]);
const W020_ACTOR_ROLES = new Set<W020AdvisoryContext["actor_role"]>([
  "student",
  "teacher",
  "admin"
]);
const W020_MODEL_CALL_PURPOSES = new Set<ModelCallLog["purpose"]>([
  "coach_advice",
  "debrief",
  "learning_support"
]);
const W020_MODEL_CALL_STATUSES = new Set<ModelCallLog["status"]>([
  "succeeded",
  "failed",
  "rejected"
]);
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const INEXACT_IDENTIFIER_TOKENS = new Set(["latest", "default", "fallback", "unresolved"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
): boolean {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return (
    keys.length >= required.length &&
    required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    keys.every((key) => allowed.has(key))
  );
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    IDENTIFIER_PATTERN.test(value) &&
    !INEXACT_IDENTIFIER_TOKENS.has(value.toLowerCase())
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_PATTERN.test(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function isStringArray(
  value: unknown,
  options: { identifiers?: boolean; nonEmpty?: boolean; maxItems?: number } = {}
): value is string[] {
  if (!Array.isArray(value)) return false;
  if (options.nonEmpty && value.length === 0) return false;
  if (options.maxItems !== undefined && value.length > options.maxItems) return false;
  return value.every((item) => (options.identifiers ? isIdentifier(item) : isNonBlankString(item)));
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isW020RoleKey(value: unknown): value is W020RoleKey {
  return typeof value === "string" && W020_ROLE_KEYS.has(value as W020RoleKey);
}

function isCoachOutputScope(
  value: W020AdvisoryContext | W020CoachOutputScope
): W020CoachOutputScope {
  if ("source_event_ids" in value) {
    return {
      evidence_refs: value.source_event_ids,
      role_key: value.role_key,
      round_id: value.round_id,
      run_id: value.run_id,
      team_id: value.team_id,
      tenant_id: value.tenant_id
    };
  }
  return value;
}

export function isW020AdvisoryRequest(value: unknown): value is W020AdvisoryRequest {
  if (!isRecord(value)) return false;
  const required = [
    "discriminator",
    "surface",
    "run_id",
    "round_id",
    "team_id",
    "role_key",
    "idempotency_key"
  ];
  const optional = value.surface === "teacher_debrief" ? ["activity_id"] : [];
  if (!hasExactKeys(value, required, optional)) return false;
  if (
    value.discriminator !== "w020_advisory_request" ||
    !W020_ADVISORY_SURFACES.has(value.surface as W020AdvisorySurface)
  )
    return false;
  if (![value.run_id, value.round_id, value.team_id, value.idempotency_key].every(isIdentifier))
    return false;
  if (!isW020RoleKey(value.role_key)) return false;
  if (value.surface === "teacher_debrief") return isIdentifier(value.activity_id);
  return value.activity_id === undefined;
}

function isW020TeacherSafeSource(value: unknown): value is W020TeacherSafeSource {
  if (!isRecord(value)) return false;
  const required = [
    "source_schema_version",
    "activity_id",
    "role_key",
    "course_report_available",
    "confirmation_status",
    "outcome_status",
    "eligible_event_count",
    "evidence_count",
    "missing",
    "student_safe_preview",
    "runtime_authority",
    "known_limits"
  ];
  if (!hasExactKeys(value, required) || !isRecord(value.student_safe_preview)) return false;
  const preview = value.student_safe_preview;
  if (
    !hasExactKeys(preview, [
      "criterion_count",
      "evidence_count",
      "next_focus",
      "status",
      "visibility"
    ])
  )
    return false;
  return (
    value.source_schema_version === "teaching-closure.v1" &&
    isIdentifier(value.activity_id) &&
    isW020RoleKey(value.role_key) &&
    value.course_report_available === true &&
    value.confirmation_status === "CONFIRMED" &&
    value.outcome_status === "CONFIRMED" &&
    Number.isInteger(value.eligible_event_count) &&
    (value.eligible_event_count as number) > 0 &&
    Number.isInteger(value.evidence_count) &&
    (value.evidence_count as number) > 0 &&
    Array.isArray(value.missing) &&
    value.missing.length === 0 &&
    preview.status === "CONFIRMED" &&
    preview.visibility === "student_safe" &&
    Number.isInteger(preview.criterion_count) &&
    (preview.criterion_count as number) > 0 &&
    Number.isInteger(preview.evidence_count) &&
    (preview.evidence_count as number) > 0 &&
    isNonBlankString(preview.next_focus) &&
    value.runtime_authority === "JSON_INTERNAL_ONLY" &&
    isStringArray(value.known_limits, { nonEmpty: true })
  );
}

export function isW020AdvisoryContext(value: unknown): value is W020AdvisoryContext {
  if (!isRecord(value)) return false;
  const required = [
    "discriminator",
    "actor_role",
    "actor_id_hash",
    "tenant_id",
    "course_id",
    "run_id",
    "round_id",
    "team_id",
    "advisory_scopes",
    "source_event_ids",
    "source_event_types",
    "context_digest",
    "transformation_version"
  ];
  if (!hasExactKeys(value, [...required, "role_key"], ["activity_id", "teacher_safe_source"]))
    return false;
  if (
    value.discriminator !== "w020_role_safe_context" ||
    !W020_ACTOR_ROLES.has(value.actor_role as W020AdvisoryContext["actor_role"])
  )
    return false;
  if (!isDigest(value.actor_id_hash) || !isDigest(value.context_digest)) return false;
  if (
    ![value.tenant_id, value.course_id, value.run_id, value.round_id, value.team_id].every(
      isIdentifier
    )
  )
    return false;
  if (!isStringArray(value.advisory_scopes, { identifiers: true, nonEmpty: true })) return false;
  if (!isStringArray(value.source_event_ids, { identifiers: true, maxItems: 50 })) return false;
  if (!isStringArray(value.source_event_types, { identifiers: true, maxItems: 50 })) return false;
  if (value.source_event_ids.length !== value.source_event_types.length) return false;
  if (value.transformation_version !== W020_TRANSFORMATION_VERSION) return false;
  if (!isW020RoleKey(value.role_key)) return false;
  if (value.actor_role === "student") {
    return value.activity_id === undefined && value.teacher_safe_source === undefined;
  }
  return (
    isIdentifier(value.activity_id) &&
    isW020TeacherSafeSource(value.teacher_safe_source) &&
    value.teacher_safe_source.activity_id === value.activity_id &&
    value.teacher_safe_source.role_key === value.role_key
  );
}

export function isW020CoachOutput(
  value: unknown,
  expected?: W020AdvisoryContext | W020CoachOutputScope
): value is W020CoachOutput {
  if (!isRecord(value)) return false;
  const required = [
    "coach_output_id",
    "tenant_id",
    "run_id",
    "round_id",
    "team_id",
    "output_type",
    "advisory_only",
    "advisory_text",
    "evidence_refs",
    "created_at",
    "model_call_log_id"
  ];
  if (!hasExactKeys(value, [...required, "role_key"])) return false;
  if (!isIdentifier(value.coach_output_id) || !isIdentifier(value.model_call_log_id)) return false;
  if (![value.tenant_id, value.run_id, value.round_id, value.team_id].every(isIdentifier))
    return false;
  if (value.output_type !== "advisory" || value.advisory_only !== true) return false;
  if (!isNonBlankString(value.advisory_text) || !isTimestamp(value.created_at)) return false;
  if (!isStringArray(value.evidence_refs, { identifiers: true, maxItems: 50 })) return false;
  if (!isW020RoleKey(value.role_key)) return false;

  if (!expected) return true;
  const scope = isCoachOutputScope(expected);
  if (
    value.tenant_id !== scope.tenant_id ||
    value.run_id !== scope.run_id ||
    value.round_id !== scope.round_id ||
    value.team_id !== scope.team_id
  )
    return false;
  if (value.role_key !== scope.role_key) return false;
  return sameStringArray(value.evidence_refs, scope.evidence_refs);
}

export function validateW020CoachOutput(
  value: unknown,
  expected?: W020AdvisoryContext | W020CoachOutputScope
): value is W020CoachOutput {
  return isW020CoachOutput(value, expected);
}

export function isW020CoachOutputForContext(
  value: unknown,
  context: W020AdvisoryContext
): value is W020CoachOutput {
  return isW020CoachOutput(value, context);
}

export function isW020ModelCallLog(
  value: unknown,
  expected: { tenant_id?: string; model_call_log_id?: string; status?: ModelCallLog["status"] } = {}
): value is ModelCallLog {
  if (!isRecord(value)) return false;
  const required = [
    "model_call_log_id",
    "tenant_id",
    "provider",
    "model",
    "purpose",
    "status",
    "advisory_only",
    "input_hash",
    "output_hash",
    "prompt_tokens",
    "completion_tokens",
    "cost_usd",
    "latency_ms",
    "created_at"
  ];
  if (!hasExactKeys(value, required)) return false;
  if (!isIdentifier(value.model_call_log_id) || !isIdentifier(value.tenant_id)) return false;
  if (!isNonBlankString(value.provider) || !isNonBlankString(value.model)) return false;
  if (
    !W020_MODEL_CALL_PURPOSES.has(value.purpose as ModelCallLog["purpose"]) ||
    !W020_MODEL_CALL_STATUSES.has(value.status as ModelCallLog["status"])
  )
    return false;
  if (value.advisory_only !== true || !isDigest(value.input_hash) || !isDigest(value.output_hash))
    return false;
  if (!Number.isInteger(value.prompt_tokens) || (value.prompt_tokens as number) < 0) return false;
  if (!Number.isInteger(value.completion_tokens) || (value.completion_tokens as number) < 0)
    return false;
  if (typeof value.cost_usd !== "number" || !Number.isFinite(value.cost_usd) || value.cost_usd < 0)
    return false;
  if (
    !Number.isInteger(value.latency_ms) ||
    (value.latency_ms as number) < 0 ||
    !isTimestamp(value.created_at)
  )
    return false;
  if (expected.tenant_id !== undefined && value.tenant_id !== expected.tenant_id) return false;
  if (
    expected.model_call_log_id !== undefined &&
    value.model_call_log_id !== expected.model_call_log_id
  )
    return false;
  return expected.status === undefined || value.status === expected.status;
}

function isW020AdvisoryProjection(
  value: unknown,
  context: W020AdvisoryContext
): value is W020AdvisoryProjection {
  if (!isRecord(value)) return false;
  const required = [
    "advisory_only",
    "surface",
    "title",
    "recommendations",
    "evidence_refs",
    "known_limits"
  ];
  if (!hasExactKeys(value, required, ["teacher_debrief"])) return false;
  if (
    value.advisory_only !== true ||
    !W020_ADVISORY_SURFACES.has(value.surface as W020AdvisorySurface)
  )
    return false;
  if (!isNonBlankString(value.title)) return false;
  if (
    !isStringArray(value.recommendations, { nonEmpty: true }) ||
    !isStringArray(value.evidence_refs, { identifiers: true, maxItems: 50 }) ||
    !isStringArray(value.known_limits, { nonEmpty: true })
  )
    return false;
  if (!sameStringArray(value.evidence_refs, context.source_event_ids)) return false;
  if (value.surface === "student_role") {
    return context.actor_role === "student" && value.teacher_debrief === undefined;
  }
  if (context.actor_role === "student" || !isRecord(value.teacher_debrief)) return false;
  const teacherDebrief = value.teacher_debrief;
  if (
    !hasExactKeys(teacherDebrief, [
      "activity_id",
      "role_key",
      "discussion_prompts",
      "explanations",
      "tradeoffs",
      "next_focus"
    ])
  )
    return false;
  return (
    teacherDebrief.activity_id === context.activity_id &&
    teacherDebrief.role_key === context.role_key &&
    isStringArray(teacherDebrief.discussion_prompts, { nonEmpty: true }) &&
    isStringArray(teacherDebrief.explanations, { nonEmpty: true }) &&
    isStringArray(teacherDebrief.tradeoffs, { nonEmpty: true }) &&
    isNonBlankString(teacherDebrief.next_focus)
  );
}

export function isW020AdvisoryReceipt(value: unknown): value is W020AdvisoryReceipt {
  if (!isRecord(value)) return false;
  const required = [
    "discriminator",
    "status",
    "request_id",
    "request_digest",
    "context",
    "projection",
    "formal_truth_write",
    "known_limits"
  ];
  if (!hasExactKeys(value, required)) return false;
  if (
    value.discriminator !== "w020_advisory_receipt" ||
    (value.status !== "generated" && value.status !== "reused")
  )
    return false;
  if (
    !isIdentifier(value.request_id) ||
    !isDigest(value.request_digest) ||
    value.formal_truth_write !== false
  )
    return false;
  if (!isStringArray(value.known_limits, { nonEmpty: true })) return false;
  if (!isW020AdvisoryContext(value.context)) return false;
  return isW020AdvisoryProjection(value.projection, value.context);
}
