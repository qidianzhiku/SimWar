export const STUDENT_LEARNING_REPORT_SCHEMA_VERSION = "student-learning-report.v1" as const;

export const STUDENT_LEARNING_REPORT_STATUSES = ["CONFIRMED", "AMENDED"] as const;
export type StudentLearningReportStatus = (typeof STUDENT_LEARNING_REPORT_STATUSES)[number];

export const STUDENT_LEARNING_REPORT_REFERENCE_TYPES = [
  "course_package_version",
  "learning_goal_version",
  "rubric_version",
  "evidence_artifact",
  "teacher_confirmation_version",
  "role_workflow_event",
  "transformation_rule",
  "student_learning_report"
] as const;
export type StudentLearningReportReferenceType =
  (typeof STUDENT_LEARNING_REPORT_REFERENCE_TYPES)[number];

export interface StudentLearningReportExactRef {
  readonly content_digest: string;
  readonly discriminator: "exact_ref";
  readonly resource_id: string;
  readonly resource_type: StudentLearningReportReferenceType;
  readonly tenant_id: string;
  readonly version: string;
}

export interface StudentLearningReportContext {
  readonly course_id: string;
  readonly run_id: string;
  readonly team_id: string;
  readonly role_key: string;
  readonly round_id?: string;
  readonly round_no?: number;
}

export interface StudentLearningReportCriterionResult {
  readonly criterion_id: string;
  readonly level_ordinal: number;
}

export interface StudentLearningReportFeedback {
  readonly feedback_id: string;
  readonly text: string;
}

export interface StudentLearningReportProvenanceEdge {
  readonly discriminator: "d4_provenance_edge";
  readonly relation: "derived_from" | "supported_by";
  readonly source_ref: StudentLearningReportExactRef;
  readonly target_ref: StudentLearningReportExactRef;
}

export interface StudentLearningReportLearningEvidence {
  readonly criterion_results: readonly StudentLearningReportCriterionResult[];
  readonly provenance_chain: readonly StudentLearningReportProvenanceEdge[];
  readonly student_visible_feedback: readonly StudentLearningReportFeedback[];
}

export interface StudentLearningReportBusinessOutcome {
  readonly status: "SEPARATE_SAFE_OUTCOME";
  readonly summary: string;
}

export interface StudentLearningReport {
  readonly business_outcome: StudentLearningReportBusinessOutcome;
  readonly context: StudentLearningReportContext;
  readonly course_package_ref: StudentLearningReportExactRef;
  readonly generated_at: string;
  readonly evidence_refs: readonly StudentLearningReportExactRef[];
  readonly known_limits: readonly string[];
  readonly learning_goal_ref: StudentLearningReportExactRef;
  readonly learning_evidence: StudentLearningReportLearningEvidence;
  readonly report_digest: string;
  readonly report_ref: StudentLearningReportExactRef;
  readonly rubric_ref: StudentLearningReportExactRef;
  readonly runtime_authority: "JSON_INTERNAL_ONLY";
  readonly schema_version: typeof STUDENT_LEARNING_REPORT_SCHEMA_VERSION;
  readonly status: StudentLearningReportStatus;
  readonly source_confirmation_digest: string;
  readonly student_scope: {
    readonly team_id: string;
    readonly tenant_id: string;
    readonly user_id: string;
  };
  readonly teacher_confirmation_ref: StudentLearningReportExactRef;
  readonly visibility: "student_safe";
}

export interface StudentLearningReportListDto {
  readonly known_limits: readonly string[];
  readonly reports: readonly StudentLearningReport[];
  readonly report_schema_version: typeof STUDENT_LEARNING_REPORT_SCHEMA_VERSION;
  readonly runtime_authority: "JSON_INTERNAL_ONLY";
  readonly scope: "student_team" | "tenant_preview";
}

export const STUDENT_LEARNING_REPORT_FAILURE_CODES = [
  "D4_REPORT_NOT_FOUND",
  "D4_REPORT_SCOPE_VIOLATION",
  "D4_REPORT_NOT_AVAILABLE",
  "D4_REPORT_OUTPUT_INVALID",
  "D4_REPORT_REFERENCE_INVALID"
] as const;
export type StudentLearningReportFailureCode =
  (typeof STUDENT_LEARNING_REPORT_FAILURE_CODES)[number];

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

export function isStudentLearningReportExactRef(
  value: unknown
): value is StudentLearningReportExactRef {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "content_digest",
      "discriminator",
      "resource_id",
      "resource_type",
      "tenant_id",
      "version"
    ]) &&
    value.discriminator === "exact_ref" &&
    typeof value.content_digest === "string" &&
    DIGEST_PATTERN.test(value.content_digest) &&
    isIdentity(value.resource_id) &&
    isIdentity(value.tenant_id) &&
    isVersion(value.version) &&
    STUDENT_LEARNING_REPORT_REFERENCE_TYPES.includes(
      value.resource_type as StudentLearningReportReferenceType
    )
  );
}

function isContext(value: unknown): value is StudentLearningReportContext {
  if (!isRecord(value)) return false;
  const allowed = ["course_id", "run_id", "team_id", "role_key", "round_id", "round_no"];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return false;
  return (
    [value.course_id, value.run_id, value.team_id, value.role_key].every(isIdentity) &&
    (value.round_id === undefined || isIdentity(value.round_id)) &&
    (value.round_no === undefined ||
      (typeof value.round_no === "number" &&
        Number.isInteger(value.round_no) &&
        value.round_no >= 1))
  );
}

function isCriterionResult(value: unknown): value is StudentLearningReportCriterionResult {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["criterion_id", "level_ordinal"]) &&
    isIdentity(value.criterion_id) &&
    typeof value.level_ordinal === "number" &&
    Number.isInteger(value.level_ordinal) &&
    value.level_ordinal >= 1
  );
}

function isFeedback(value: unknown): value is StudentLearningReportFeedback {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["feedback_id", "text"]) &&
    isIdentity(value.feedback_id) &&
    typeof value.text === "string" &&
    value.text.trim() === value.text &&
    value.text.length > 0 &&
    value.text.length <= 2000
  );
}

function isProvenanceEdge(value: unknown): value is StudentLearningReportProvenanceEdge {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["discriminator", "relation", "source_ref", "target_ref"]) &&
    value.discriminator === "d4_provenance_edge" &&
    (value.relation === "derived_from" || value.relation === "supported_by") &&
    isStudentLearningReportExactRef(value.source_ref) &&
    isStudentLearningReportExactRef(value.target_ref) &&
    value.source_ref.tenant_id === value.target_ref.tenant_id
  );
}

function isBusinessOutcome(value: unknown): value is StudentLearningReportBusinessOutcome {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["status", "summary"]) &&
    value.status === "SEPARATE_SAFE_OUTCOME" &&
    typeof value.summary === "string" &&
    value.summary.trim() === value.summary &&
    value.summary.length > 0 &&
    !/(?:score|rank|state_true|settlement_payload)/i.test(value.summary)
  );
}

function isStudentScope(value: unknown): value is StudentLearningReport["student_scope"] {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["team_id", "tenant_id", "user_id"]) &&
    isIdentity(value.team_id) &&
    isIdentity(value.tenant_id) &&
    isIdentity(value.user_id)
  );
}

export function isStudentLearningReport(value: unknown): value is StudentLearningReport {
  if (!isRecord(value)) return false;
  const keys = [
    "business_outcome",
    "context",
    "course_package_ref",
    "generated_at",
    "evidence_refs",
    "known_limits",
    "learning_goal_ref",
    "learning_evidence",
    "report_digest",
    "report_ref",
    "rubric_ref",
    "runtime_authority",
    "schema_version",
    "status",
    "source_confirmation_digest",
    "student_scope",
    "teacher_confirmation_ref",
    "visibility"
  ];
  if (
    !hasOnlyKeys(value, keys) ||
    value.schema_version !== STUDENT_LEARNING_REPORT_SCHEMA_VERSION ||
    !STUDENT_LEARNING_REPORT_STATUSES.includes(value.status as StudentLearningReportStatus) ||
    value.runtime_authority !== "JSON_INTERNAL_ONLY" ||
    value.visibility !== "student_safe" ||
    !isStudentLearningReportExactRef(value.report_ref) ||
    value.report_ref.resource_type !== "student_learning_report" ||
    !isStudentLearningReportExactRef(value.course_package_ref) ||
    value.course_package_ref.resource_type !== "course_package_version" ||
    !isStudentLearningReportExactRef(value.learning_goal_ref) ||
    value.learning_goal_ref.resource_type !== "learning_goal_version" ||
    !isStudentLearningReportExactRef(value.rubric_ref) ||
    value.rubric_ref.resource_type !== "rubric_version" ||
    !isStudentLearningReportExactRef(value.teacher_confirmation_ref) ||
    value.teacher_confirmation_ref.resource_type !== "teacher_confirmation_version" ||
    !Array.isArray(value.evidence_refs) ||
    value.evidence_refs.some(
      (reference) =>
        !isStudentLearningReportExactRef(reference) ||
        reference.resource_type !== "evidence_artifact"
    ) ||
    !isTimestamp(value.generated_at) ||
    typeof value.source_confirmation_digest !== "string" ||
    !DIGEST_PATTERN.test(value.source_confirmation_digest) ||
    typeof value.report_digest !== "string" ||
    !DIGEST_PATTERN.test(value.report_digest) ||
    !isContext(value.context) ||
    !isStudentScope(value.student_scope) ||
    !isBusinessOutcome(value.business_outcome) ||
    !isRecord(value.learning_evidence) ||
    !hasOnlyKeys(value.learning_evidence, [
      "criterion_results",
      "provenance_chain",
      "student_visible_feedback"
    ]) ||
    !Array.isArray(value.learning_evidence.criterion_results) ||
    value.learning_evidence.criterion_results.some((item) => !isCriterionResult(item)) ||
    !Array.isArray(value.learning_evidence.provenance_chain) ||
    value.learning_evidence.provenance_chain.some((item) => !isProvenanceEdge(item)) ||
    !Array.isArray(value.learning_evidence.student_visible_feedback) ||
    value.learning_evidence.student_visible_feedback.some((item) => !isFeedback(item)) ||
    !Array.isArray(value.known_limits) ||
    value.known_limits.length === 0 ||
    value.known_limits.some((item) => typeof item !== "string" || item.trim() !== item || !item)
  ) {
    return false;
  }
  const refs = [
    value.report_ref,
    value.course_package_ref,
    value.learning_goal_ref,
    value.rubric_ref,
    value.teacher_confirmation_ref,
    ...value.evidence_refs
  ] as StudentLearningReportExactRef[];
  const studentScope = value.student_scope as StudentLearningReport["student_scope"];
  return refs.every((reference) => reference.tenant_id === studentScope.tenant_id);
}

export function isStudentLearningReportListDto(
  value: unknown
): value is StudentLearningReportListDto {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "known_limits",
      "reports",
      "report_schema_version",
      "runtime_authority",
      "scope"
    ]) &&
    value.report_schema_version === STUDENT_LEARNING_REPORT_SCHEMA_VERSION &&
    value.runtime_authority === "JSON_INTERNAL_ONLY" &&
    (value.scope === "student_team" || value.scope === "tenant_preview") &&
    Array.isArray(value.reports) &&
    value.reports.every(isStudentLearningReport) &&
    Array.isArray(value.known_limits) &&
    value.known_limits.length > 0 &&
    value.known_limits.every(
      (item) => typeof item === "string" && item.trim() === item && item.length > 0
    )
  );
}
