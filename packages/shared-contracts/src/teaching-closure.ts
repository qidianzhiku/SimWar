export const TEACHING_CLOSURE_SCHEMA_VERSION = "teaching-closure.v1" as const;

export const TEACHING_CLOSURE_CONFIRMATION_STATUSES = [
  "MISSING",
  "DRAFT",
  "REJECTED",
  "CONFIRMED"
] as const;
export type TeachingClosureConfirmationStatus =
  (typeof TEACHING_CLOSURE_CONFIRMATION_STATUSES)[number];

export const TEACHING_CLOSURE_OUTCOME_STATUSES = ["UNAVAILABLE", "PENDING", "CONFIRMED"] as const;
export type TeachingClosureOutcomeStatus = (typeof TEACHING_CLOSURE_OUTCOME_STATUSES)[number];

export interface TeachingClosureContext {
  readonly activity_id: string;
  readonly course_id: string;
  readonly role_key: string;
  readonly run_id: string;
  readonly team_id: string;
}

export interface TeachingClosureQueueItem {
  readonly claim_expires_at?: string;
  readonly claim_owner?: string;
  readonly claim_status: "AVAILABLE" | "CLAIMED" | "EXPIRED";
  readonly confirmation_status: TeachingClosureConfirmationStatus;
  readonly context: TeachingClosureContext;
  readonly eligible_event_count: number;
  readonly evidence_count: number;
  readonly known_limits: readonly string[];
  readonly missing: readonly ("eligible_event" | "evidence_artifact" | "confirmation")[];
  readonly outcome_status: TeachingClosureOutcomeStatus;
}

export interface TeachingClosureStudentSafePreview {
  readonly criterion_count: number;
  readonly evidence_count: number;
  readonly next_focus: string;
  readonly status: TeachingClosureOutcomeStatus;
  readonly visibility: "student_safe";
}

export interface TeachingClosureDto {
  readonly context: TeachingClosureContext;
  readonly course_report_available: boolean;
  readonly export_formats: readonly ["json", "markdown"];
  readonly known_limits: readonly string[];
  readonly queue_item: TeachingClosureQueueItem;
  readonly runtime_authority: "JSON_INTERNAL_ONLY";
  readonly schema_version: typeof TEACHING_CLOSURE_SCHEMA_VERSION;
  readonly student_safe_preview: TeachingClosureStudentSafePreview;
}

const ID_PATTERN = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/;
const RESERVED_PATTERN =
  /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    ID_PATTERN.test(value) &&
    !RESERVED_PATTERN.test(value)
  );
}

function isContext(value: unknown): value is TeachingClosureContext {
  return (
    isRecord(value) &&
    Object.keys(value).length === 5 &&
    Object.keys(value).every((key) =>
      ["activity_id", "course_id", "role_key", "run_id", "team_id"].includes(key)
    ) &&
    isIdentity(value.activity_id) &&
    isIdentity(value.course_id) &&
    isIdentity(value.role_key) &&
    isIdentity(value.run_id) &&
    isIdentity(value.team_id)
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
}

export function isTeachingClosureDto(value: unknown): value is TeachingClosureDto {
  if (!isRecord(value)) return false;
  const queueItem = isRecord(value.queue_item) ? value.queue_item : undefined;
  const preview = isRecord(value.student_safe_preview) ? value.student_safe_preview : undefined;
  const queueKeys = new Set([
    "claim_expires_at",
    "claim_owner",
    "claim_status",
    "confirmation_status",
    "context",
    "eligible_event_count",
    "evidence_count",
    "known_limits",
    "missing",
    "outcome_status"
  ]);
  const previewKeys = new Set(["criterion_count", "evidence_count", "next_focus", "status", "visibility"]);
  if (
    Object.keys(value).sort().join(",") !==
      [
        "context",
        "course_report_available",
        "export_formats",
        "known_limits",
        "queue_item",
        "runtime_authority",
        "schema_version",
        "student_safe_preview"
      ]
        .sort()
        .join(",") ||
    value.schema_version !== TEACHING_CLOSURE_SCHEMA_VERSION ||
    value.runtime_authority !== "JSON_INTERNAL_ONLY" ||
    !isContext(value.context) ||
    typeof value.course_report_available !== "boolean" ||
    !Array.isArray(value.export_formats) ||
    value.export_formats.length !== 2 ||
    value.export_formats[0] !== "json" ||
    value.export_formats[1] !== "markdown" ||
    !isStringArray(value.known_limits) ||
    !queueItem ||
    Object.keys(queueItem).some((key) => !queueKeys.has(key)) ||
    !isContext(queueItem.context) ||
    !["AVAILABLE", "CLAIMED", "EXPIRED"].includes(queueItem.claim_status as string) ||
    !TEACHING_CLOSURE_CONFIRMATION_STATUSES.includes(
      queueItem.confirmation_status as TeachingClosureConfirmationStatus
    ) ||
    !TEACHING_CLOSURE_OUTCOME_STATUSES.includes(
      queueItem.outcome_status as TeachingClosureOutcomeStatus
    ) ||
    !Number.isInteger(queueItem.eligible_event_count) ||
    (queueItem.eligible_event_count as number) < 0 ||
    !Number.isInteger(queueItem.evidence_count) ||
    (queueItem.evidence_count as number) < 0 ||
    !isStringArray(queueItem.known_limits) ||
    !Array.isArray(queueItem.missing) ||
    queueItem.missing.some(
      (item) => !["eligible_event", "evidence_artifact", "confirmation"].includes(item as string)
    ) ||
    (queueItem.claim_owner !== undefined && !isIdentity(queueItem.claim_owner)) ||
    (queueItem.claim_expires_at !== undefined && typeof queueItem.claim_expires_at !== "string") ||
    !preview ||
    Object.keys(preview).some((key) => !previewKeys.has(key)) ||
    preview.visibility !== "student_safe" ||
    !TEACHING_CLOSURE_OUTCOME_STATUSES.includes(preview.status as TeachingClosureOutcomeStatus) ||
    !Number.isInteger(preview.criterion_count) ||
    (preview.criterion_count as number) < 0 ||
    !Number.isInteger(preview.evidence_count) ||
    (preview.evidence_count as number) < 0 ||
    typeof preview.next_focus !== "string" ||
    preview.next_focus.length === 0
  ) {
    return false;
  }
  return (
    JSON.stringify(queueItem.context) === JSON.stringify(value.context) &&
    JSON.stringify(queueItem.known_limits) === JSON.stringify(value.known_limits)
  );
}
