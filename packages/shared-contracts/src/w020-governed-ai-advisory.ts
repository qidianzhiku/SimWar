import type { CoachOutput, ModelCallLog } from "./index.js";

export const W020_ADVISORY_SCHEMA_VERSION = "w020.governed.ai.advisory.v1" as const;
export const W020_TRANSFORMATION_VERSION = "w020-role-safe-context-v1" as const;

export type W020AdvisorySurface =
  | "student_role"
  | "student_coach"
  | "teacher_copilot"
  | "teacher_debrief"
  | "rubric_assistant"
  | "competitive_challenge"
  | "stakeholder_challenge";
export type W020AdvisoryStatus = "generated" | "reused";
export type W020RoleKey = "CEO" | "CFO" | "CMO" | "COO" | "CHRO";

export interface W020EvidenceCitation {
  citation_id: string;
  label: string;
  source_id: string;
  source_type: "governed_context" | "workflow_event";
}

export interface W020AdvisoryPolicy {
  formal_truth_write: false;
  human_final_authority: true;
  pre_publish_student_exposure: false;
  provider: "OFF";
}

export interface W020AdvisoryEvaluation {
  checks: string[];
  fallback: "abstain_no_source_evidence" | "deterministic_rule";
  status: "abstained" | "passed";
}

export interface W020AdvisoryRequest {
  discriminator: "w020_advisory_request";
  surface: W020AdvisorySurface;
  run_id: string;
  round_id: string;
  team_id: string;
  role_key?: W020RoleKey;
  idempotency_key: string;
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
  role_key?: W020RoleKey;
  advisory_scopes: string[];
  source_event_ids: string[];
  source_event_types: string[];
  context_digest: string;
  transformation_version: typeof W020_TRANSFORMATION_VERSION;
}

export interface W020AdvisoryProjection {
  advisory_only: true;
  evidence_citations: W020EvidenceCitation[];
  evaluation: W020AdvisoryEvaluation;
  policy: W020AdvisoryPolicy;
  surface: W020AdvisorySurface;
  title: string;
  recommendations: string[];
  evidence_refs: string[];
  known_limits: string[];
}

export interface W020AdvisoryReceipt {
  discriminator: "w020_advisory_receipt";
  status: W020AdvisoryStatus;
  request_id: string;
  request_digest: string;
  context: W020AdvisoryContext;
  coach_output: CoachOutput;
  model_call_log: ModelCallLog;
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
  coach_output: CoachOutput;
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

const W020_ROLE_KEYS = new Set<W020RoleKey>(["CEO", "CFO", "CMO", "COO", "CHRO"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isW020AdvisoryRequest(value: unknown): value is W020AdvisoryRequest {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  const expected = ["discriminator", "idempotency_key", "round_id", "run_id", "surface", "team_id"];
  const roleKeys = keys.filter((key) => key === "role_key");
  if (keys.filter((key) => key !== "role_key").join("|") !== expected.join("|")) return false;
  if (roleKeys.length > 1 || value.discriminator !== "w020_advisory_request") return false;
  const surface = value.surface;
  if (
    typeof surface !== "string" ||
    ![
      "student_role",
      "student_coach",
      "teacher_copilot",
      "teacher_debrief",
      "rubric_assistant",
      "competitive_challenge",
      "stakeholder_challenge"
    ].includes(surface)
  )
    return false;
  if (
    ![value.run_id, value.round_id, value.team_id, value.idempotency_key].every(
      (item) => typeof item === "string" && item.length > 0
    )
  )
    return false;
  return (
    value.role_key === undefined ||
    (typeof value.role_key === "string" && W020_ROLE_KEYS.has(value.role_key as W020RoleKey))
  );
}

export function isW020AdvisoryReceipt(value: unknown): value is W020AdvisoryReceipt {
  if (!isRecord(value)) return false;
  return (
    value.discriminator === "w020_advisory_receipt" &&
    (value.status === "generated" || value.status === "reused") &&
    value.formal_truth_write === false &&
    typeof value.request_id === "string" &&
    typeof value.request_digest === "string" &&
    isRecord(value.context) &&
    isRecord(value.coach_output) &&
    isRecord(value.model_call_log) &&
    isRecord(value.projection) &&
    Array.isArray(value.known_limits)
  );
}
