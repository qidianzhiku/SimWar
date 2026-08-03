export const TEACHER_CONFIRMATION_SCHEMA_VERSION = "teacher-confirmation.v1" as const;

export const TEACHER_CONFIRMATION_STATUSES = ["DRAFT", "CONFIRMED", "REJECTED"] as const;
export type TeacherConfirmationStatus = (typeof TEACHER_CONFIRMATION_STATUSES)[number];

export const TEACHER_CONFIRMATION_REFERENCE_TYPES = [
  "course_package_version",
  "learning_goal_version",
  "rubric_version",
  "evidence_artifact",
  "teacher_confirmation_version"
] as const;
export type TeacherConfirmationReferenceType =
  (typeof TEACHER_CONFIRMATION_REFERENCE_TYPES)[number];

export interface TeacherConfirmationExactRef {
  readonly content_digest: string;
  readonly discriminator: "exact_ref";
  readonly resource_id: string;
  readonly resource_type: TeacherConfirmationReferenceType;
  readonly tenant_id: string;
  readonly version: string;
}

export interface TeacherConfirmationContext {
  readonly course_id: string;
  readonly run_id: string;
  readonly team_id: string;
  readonly role_key: string;
}

export interface TeacherConfirmationCriterionDecision {
  readonly criterion_id: string;
  readonly level_ordinal: number;
}

export interface TeacherConfirmationAuditReceipt {
  readonly action: string;
  readonly actor_id: string;
  readonly audit_id: string;
  readonly recorded_at: string;
  readonly request_id: string;
}

export interface TeacherConfirmationVersion {
  readonly audit_receipt: TeacherConfirmationAuditReceipt;
  readonly confirmation_ref: TeacherConfirmationExactRef;
  readonly content_digest: string;
  readonly context: TeacherConfirmationContext;
  readonly course_package_ref: TeacherConfirmationExactRef;
  readonly created_at: string;
  readonly created_by: string;
  readonly criterion_decisions: readonly TeacherConfirmationCriterionDecision[];
  readonly discriminator: "teacher_confirmation_version";
  readonly evidence_refs: readonly TeacherConfirmationExactRef[];
  readonly idempotency_key: string;
  readonly known_limits: readonly string[];
  readonly learning_goal_ref: TeacherConfirmationExactRef;
  readonly rubric_ref: TeacherConfirmationExactRef;
  readonly schema_version: typeof TEACHER_CONFIRMATION_SCHEMA_VERSION;
  readonly status: TeacherConfirmationStatus;
  readonly teacher_feedback: string;
  readonly rejection_reason?: string;
  readonly supersedes_ref?: TeacherConfirmationExactRef;
}

export interface TeacherConfirmationCommandInput {
  readonly confirmation_id: string;
  readonly course_package_ref: TeacherConfirmationExactRef;
  readonly learning_goal_ref: TeacherConfirmationExactRef;
  readonly rubric_ref: TeacherConfirmationExactRef;
  readonly evidence_refs: readonly TeacherConfirmationExactRef[];
  readonly context: TeacherConfirmationContext;
  readonly criterion_decisions: readonly TeacherConfirmationCriterionDecision[];
  readonly teacher_feedback: string;
  readonly idempotency_key: string;
}

export interface TeacherConfirmationRejectInput {
  readonly rejection_reason: string;
}

export type TeacherConfirmationClaimStatus = "CLAIMED" | "RELEASED" | "EXPIRED";

export interface TeacherConfirmationWorkClaim {
  readonly claim_id: string;
  readonly tenant_id: string;
  readonly context: TeacherConfirmationContext;
  readonly evidence_set_digest: string;
  readonly claimed_by: string;
  readonly claimed_at: string;
  readonly expires_at: string;
  readonly status: TeacherConfirmationClaimStatus;
}

export interface TeacherConfirmationTeacherDto {
  readonly confirmation: TeacherConfirmationVersion;
  readonly known_limits: readonly string[];
  readonly runtime_authority: "JSON_INTERNAL_ONLY";
}

const ID_PATTERN = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const RESERVED_PATTERN =
  /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    ID_PATTERN.test(value) &&
    !RESERVED_PATTERN.test(value)
  );
}

function isVersion(value: unknown): value is string {
  return isIdentity(value) && !/(?:^|[._:-])[xX*](?:$|[._:-])/.test(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !TIMESTAMP_PATTERN.test(value)) return false;
  const parsed = new Date(value);
  const canonical = value.includes(".") ? value : `${value.slice(0, -1)}.000Z`;
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === canonical;
}

export function isTeacherConfirmationExactRef(
  value: unknown
): value is TeacherConfirmationExactRef {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "content_digest",
      "discriminator",
      "resource_id",
      "resource_type",
      "tenant_id",
      "version"
    ]) ||
    value.discriminator !== "exact_ref" ||
    typeof value.content_digest !== "string" ||
    !DIGEST_PATTERN.test(value.content_digest) ||
    !isIdentity(value.resource_id) ||
    !isIdentity(value.tenant_id) ||
    !isVersion(value.version) ||
    !TEACHER_CONFIRMATION_REFERENCE_TYPES.includes(
      value.resource_type as TeacherConfirmationReferenceType
    )
  ) {
    return false;
  }
  return true;
}

function isContext(value: unknown): value is TeacherConfirmationContext {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["course_id", "run_id", "team_id", "role_key"]) &&
    [value.course_id, value.run_id, value.team_id, value.role_key].every(isIdentity)
  );
}

function isCriterionDecision(value: unknown): value is TeacherConfirmationCriterionDecision {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["criterion_id", "level_ordinal"]) &&
    isIdentity(value.criterion_id) &&
    typeof value.level_ordinal === "number" &&
    Number.isInteger(value.level_ordinal) &&
    value.level_ordinal >= 1
  );
}

function isAuditReceipt(value: unknown): value is TeacherConfirmationAuditReceipt {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["action", "actor_id", "audit_id", "recorded_at", "request_id"]) &&
    isIdentity(value.action) &&
    isIdentity(value.actor_id) &&
    isIdentity(value.audit_id) &&
    isTimestamp(value.recorded_at) &&
    isIdentity(value.request_id)
  );
}

export function isTeacherConfirmationVersion(value: unknown): value is TeacherConfirmationVersion {
  if (!isRecord(value)) return false;
  const keys = [
    "audit_receipt",
    "confirmation_ref",
    "content_digest",
    "context",
    "course_package_ref",
    "created_at",
    "created_by",
    "criterion_decisions",
    "discriminator",
    "evidence_refs",
    "idempotency_key",
    "known_limits",
    "learning_goal_ref",
    "rejection_reason",
    "rubric_ref",
    "schema_version",
    "status",
    "teacher_feedback",
    "supersedes_ref"
  ];
  if (
    Object.keys(value).some((key) => !keys.includes(key)) ||
    value.discriminator !== "teacher_confirmation_version" ||
    value.schema_version !== TEACHER_CONFIRMATION_SCHEMA_VERSION ||
    !TEACHER_CONFIRMATION_STATUSES.includes(value.status as TeacherConfirmationStatus) ||
    !isTeacherConfirmationExactRef(value.confirmation_ref) ||
    value.confirmation_ref.resource_type !== "teacher_confirmation_version" ||
    !isTeacherConfirmationExactRef(value.course_package_ref) ||
    value.course_package_ref.resource_type !== "course_package_version" ||
    !isTeacherConfirmationExactRef(value.learning_goal_ref) ||
    value.learning_goal_ref.resource_type !== "learning_goal_version" ||
    !isTeacherConfirmationExactRef(value.rubric_ref) ||
    value.rubric_ref.resource_type !== "rubric_version" ||
    !Array.isArray(value.evidence_refs) ||
    value.evidence_refs.length === 0 ||
    value.evidence_refs.some(
      (ref) => !isTeacherConfirmationExactRef(ref) || ref.resource_type !== "evidence_artifact"
    ) ||
    !isContext(value.context) ||
    !Array.isArray(value.criterion_decisions) ||
    value.criterion_decisions.length === 0 ||
    value.criterion_decisions.some((decision) => !isCriterionDecision(decision)) ||
    new Set(
      (value.criterion_decisions as TeacherConfirmationCriterionDecision[]).map(
        (decision) => decision.criterion_id
      )
    ).size !== value.criterion_decisions.length ||
    !isIdentity(value.idempotency_key) ||
    !Array.isArray(value.known_limits) ||
    value.known_limits.length === 0 ||
    value.known_limits.some(
      (limit) => typeof limit !== "string" || limit.trim() !== limit || limit.length === 0
    ) ||
    typeof value.teacher_feedback !== "string" ||
    value.teacher_feedback.length > 2000 ||
    hasUnsafeText(value.teacher_feedback) ||
    typeof value.content_digest !== "string" ||
    !DIGEST_PATTERN.test(value.content_digest) ||
    !isIdentity(value.created_by) ||
    !isTimestamp(value.created_at) ||
    !isAuditReceipt(value.audit_receipt)
  ) {
    return false;
  }
  if (
    value.rejection_reason !== undefined &&
    (typeof value.rejection_reason !== "string" ||
      value.rejection_reason.length === 0 ||
      value.rejection_reason.length > 500 ||
      hasUnsafeText(value.rejection_reason))
  )
    return false;
  if (value.status === "REJECTED" && value.rejection_reason === undefined) return false;
  if (value.status !== "REJECTED" && value.rejection_reason !== undefined) return false;
  const confirmationRef = value.confirmation_ref as TeacherConfirmationExactRef;
  const refs = [
    confirmationRef,
    value.course_package_ref as TeacherConfirmationExactRef,
    value.learning_goal_ref as TeacherConfirmationExactRef,
    value.rubric_ref as TeacherConfirmationExactRef,
    ...(value.evidence_refs as TeacherConfirmationExactRef[])
  ];
  if (refs.some((ref) => ref.tenant_id !== confirmationRef.tenant_id)) return false;
  if (
    value.supersedes_ref !== undefined &&
    (!isTeacherConfirmationExactRef(value.supersedes_ref) ||
      value.supersedes_ref.tenant_id !== confirmationRef.tenant_id)
  )
    return false;
  return true;
}

function hasUnsafeText(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return character === "<" || character === ">" || code < 0x20 || code === 0x7f;
  });
}
