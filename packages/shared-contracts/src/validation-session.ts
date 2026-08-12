export const VALIDATION_SESSION_SCHEMA_VERSION = "validation-session.v1" as const;

export const VALIDATION_SESSION_STATUSES = [
  "DRAFT",
  "PREFLIGHT_READY",
  "LIVE",
  "CLOSED",
  "ABORTED"
] as const;
export type ValidationSessionStatus = (typeof VALIDATION_SESSION_STATUSES)[number];

export const VALIDATION_SESSION_DUTIES = [
  "TEACHER",
  "LEARNER",
  "MODERATOR",
  "OBSERVER",
  "RECORDER"
] as const;
export type ValidationSessionDuty = (typeof VALIDATION_SESSION_DUTIES)[number];

export type ValidationSessionExecutionMode = "SYNTHETIC_REHEARSAL";
export type ValidationSessionSeverity = "LOW" | "MEDIUM" | "HIGH";
export type ValidationSessionIncidentState = "OPEN" | "RESOLVED";

export interface ValidationSessionParticipant {
  participant_id: string;
  session_duty: ValidationSessionDuty;
  participant_kind: "SYNTHETIC" | "EXTERNAL_SESSION_ONLY";
  product_user_id?: string;
  team_id?: string;
  role_key?: "CEO" | "CFO" | "CMO" | "COO";
}

export interface ValidationSessionObservation {
  observation_id: string;
  session_id: string;
  participant_id: string;
  session_duty: ValidationSessionDuty;
  captured_at: string;
  phase: string;
  category: string;
  narrative: string;
  evidence_refs: string[];
}

export interface ValidationSessionIncident {
  incident_id: string;
  session_id: string;
  severity: ValidationSessionSeverity;
  phase: string;
  description: string;
  evidence_refs: string[];
  resolution_state: ValidationSessionIncidentState;
  created_at: string;
  resolved_at?: string;
}

export interface ValidationSessionTransition {
  at: string;
  from: ValidationSessionStatus | null;
  to: ValidationSessionStatus;
  actor_id: string;
  request_id: string;
}

export interface ValidationSessionPreflight {
  evaluated_at: string;
  status: "BLOCKED" | "PREFLIGHT_READY";
  reasons: string[];
  source_product_merge_sha: string;
  exact_context: { tenant_id: string; course_id: string; run_id: string };
  w022_admission_status: "READY_FOR_MACHINE_E4" | "BLOCKED" | "NOT_RECHECKED";
  cleanup_ready: boolean;
}

export interface ValidationSessionEvidenceBundle {
  schema_version: typeof VALIDATION_SESSION_SCHEMA_VERSION;
  session: Omit<ValidationSessionRecord, "evidence_bundle">;
  evidence_digest: string;
  execution_mode: "SYNTHETIC_REHEARSAL";
  human_validation: "NOT_PERFORMED";
  teaching_effectiveness: "NOT_PROVEN";
  real_human_attestation: "NOT_PROVEN";
  markdown_report: string;
}

export interface ValidationSessionRecord {
  schema_version: typeof VALIDATION_SESSION_SCHEMA_VERSION;
  session_id: string;
  execution_mode: ValidationSessionExecutionMode;
  source_product_merge_sha: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  machine_admission_reference: string;
  machine_admission_digest: string;
  idempotency_key: string;
  status: ValidationSessionStatus;
  created_by: string;
  created_at: string;
  started_at?: string;
  closed_at?: string;
  aborted_at?: string;
  participants: ValidationSessionParticipant[];
  preflight?: ValidationSessionPreflight;
  transitions: ValidationSessionTransition[];
  observations: ValidationSessionObservation[];
  incidents: ValidationSessionIncident[];
  cleanup_receipt?: { cleanup_id: string; status: "READY" | "COMPLETED"; at: string };
  evidence_bundle?: ValidationSessionEvidenceBundle;
}

export interface ValidationSessionListDto {
  sessions: ValidationSessionRecord[];
  known_limits: string[];
  runtime_authority: "JSON_INTERNAL_ONLY";
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;

export function isValidationSessionId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

export function isValidationSessionRecord(value: unknown): value is ValidationSessionRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<ValidationSessionRecord>;
  return (
    record.schema_version === VALIDATION_SESSION_SCHEMA_VERSION &&
    isValidationSessionId(record.session_id) &&
    record.execution_mode === "SYNTHETIC_REHEARSAL" &&
    typeof record.source_product_merge_sha === "string" &&
    SHA.test(record.source_product_merge_sha) &&
    typeof record.tenant_id === "string" &&
    typeof record.course_id === "string" &&
    typeof record.run_id === "string" &&
    typeof record.machine_admission_reference === "string" &&
    DIGEST.test(record.machine_admission_digest ?? "") &&
    isValidationSessionId(record.idempotency_key) &&
    typeof record.created_by === "string" &&
    typeof record.created_at === "string" &&
    VALIDATION_SESSION_STATUSES.includes(record.status as ValidationSessionStatus) &&
    Array.isArray(record.participants) &&
    Array.isArray(record.transitions) &&
    Array.isArray(record.observations) &&
    Array.isArray(record.incidents)
  );
}

export function assertValidationSessionRecord(
  value: unknown
): asserts value is ValidationSessionRecord {
  if (!isValidationSessionRecord(value)) throw new Error("validation_session_invalid");
}
