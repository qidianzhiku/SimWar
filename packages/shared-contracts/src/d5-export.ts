export const D5_EXPORT_SCHEMA_VERSION = "d5-export.v1" as const;
export const D5_EXPORT_RUNTIME_AUTHORITY = "JSON_INTERNAL_ONLY" as const;

export const D5_EXPORT_RESOURCE_TYPES = [
  "student_learning_report",
  "role_workflow_event",
  "course_package_version",
  "learning_goal_version",
  "rubric_version",
  "teacher_confirmation_version",
  "evidence_artifact",
  "xapi_profile_version",
  "learning_export_policy_version",
  "destination_profile_version",
  "xapi_statement_batch_version",
  "aol_export_dataset_version",
  "learning_export_bundle_version",
  "learning_export_job",
  "export_delivery_attempt",
  "export_delivery_receipt",
  "transformation_rule"
] as const;
export type D5ExportResourceType = (typeof D5_EXPORT_RESOURCE_TYPES)[number];

export const D5_EXPORT_KNOWN_LIMITS = [
  "D5 delivers only to an in-process or localhost Mock LRS.",
  "D5 does not become a learning-assessment, business-outcome, Truth, or Replay authority.",
  "JSON_INTERNAL_ONLY is the active runtime authority; durable delivery is not proven.",
  "Human Validation is not performed.",
  "Issue #111 remains an open known limit.",
  "PostgreSQL, external LRS, Pilot, and Production are not active or authorized."
] as const;

export interface D5ExactRef {
  readonly content_digest: string;
  readonly discriminator: "exact_ref";
  readonly resource_id: string;
  readonly resource_type: D5ExportResourceType;
  readonly tenant_id: string;
  readonly version: string;
}

export interface LearningExportPolicyVersion {
  readonly content_digest: string;
  readonly known_limits: readonly string[];
  readonly minimum_cohort_size: 5;
  readonly policy_ref: D5ExactRef;
  readonly raw_evidence_allowed: false;
  readonly schema_version: typeof D5_EXPORT_SCHEMA_VERSION;
  readonly student_email_allowed: false;
  readonly student_free_text_allowed: false;
  readonly status: "ACTIVE";
  readonly visibility: "teacher_admin_only";
}

export interface XapiStatementTemplate {
  readonly object_type: "Activity";
  readonly template_id: string;
  readonly verb_id: string;
}

export interface XapiProfileVersion {
  readonly content_digest: string;
  readonly known_limits: readonly string[];
  readonly patterns: readonly string[];
  readonly profile_iri: string;
  readonly profile_ref: D5ExactRef;
  readonly schema_version: typeof D5_EXPORT_SCHEMA_VERSION;
  readonly statement_templates: readonly XapiStatementTemplate[];
  readonly status: "ACTIVE";
}

export interface DestinationProfileVersion {
  readonly content_digest: string;
  readonly credential_required: false;
  readonly destination_ref: D5ExactRef;
  readonly kind: "MOCK_LRS";
  readonly known_limits: readonly string[];
  readonly schema_version: typeof D5_EXPORT_SCHEMA_VERSION;
  readonly transport: "IN_PROCESS" | "LOCALHOST";
}

export interface XapiStatement {
  readonly actor: {
    readonly account: { readonly home_page: string; readonly name: string };
  };
  readonly context: {
    readonly extensions: {
      readonly course_id: string;
      readonly learning_goal_ref: D5ExactRef;
      readonly report_ref: D5ExactRef;
      readonly rubric_ref: D5ExactRef;
    };
  };
  readonly id: string;
  readonly object: {
    readonly definition: { readonly name: string; readonly type: "Activity" };
    readonly id: string;
  };
  readonly result: {
    readonly completion: true;
    readonly extensions: { readonly status: "CONFIRMED" | "AMENDED" };
  };
  readonly timestamp: string;
  readonly verb: { readonly display: { readonly "en-US": string }; readonly id: string };
}

export interface XapiStatementBatchVersion {
  readonly batch_ref: D5ExactRef;
  readonly content_digest: string;
  readonly created_at: string;
  readonly destination_ref: D5ExactRef;
  readonly known_limits: readonly string[];
  readonly policy_ref: D5ExactRef;
  readonly profile_ref: D5ExactRef;
  readonly runtime_authority: typeof D5_EXPORT_RUNTIME_AUTHORITY;
  readonly schema_version: typeof D5_EXPORT_SCHEMA_VERSION;
  readonly source_report_refs: readonly D5ExactRef[];
  readonly statements: readonly XapiStatement[];
  readonly visibility: "teacher_admin_only";
}

export interface AoLExportRow {
  readonly coarsened: boolean;
  readonly criterion_count: number;
  readonly group_key: string;
  readonly level_distribution: Readonly<Record<string, number>>;
  readonly sample_size: number;
  readonly suppressed: boolean;
}

export interface AoLExportDatasetVersion {
  readonly content_digest: string;
  readonly created_at: string;
  readonly dataset_ref: D5ExactRef;
  readonly known_limits: readonly string[];
  readonly policy_ref: D5ExactRef;
  readonly rows: readonly AoLExportRow[];
  readonly runtime_authority: typeof D5_EXPORT_RUNTIME_AUTHORITY;
  readonly schema_version: typeof D5_EXPORT_SCHEMA_VERSION;
  readonly source_report_refs: readonly D5ExactRef[];
  readonly visibility: "teacher_admin_only";
}

export interface LearningExportBundleVersion {
  readonly aol_dataset: AoLExportDatasetVersion;
  readonly bundle_digest: string;
  readonly bundle_ref: D5ExactRef;
  readonly created_by: string;
  readonly known_limits: readonly string[];
  readonly sealed_at: string;
  readonly schema_version: typeof D5_EXPORT_SCHEMA_VERSION;
  readonly statement_batch: XapiStatementBatchVersion;
  readonly status: "SEALED";
  readonly visibility: "teacher_admin_only";
}

export const D5_EXPORT_JOB_STATUSES = [
  "QUEUED",
  "DELIVERING",
  "DELIVERED",
  "PARTIAL",
  "RETRYABLE",
  "CANCELLED",
  "FAILED"
] as const;
export type D5ExportJobStatus = (typeof D5_EXPORT_JOB_STATUSES)[number];

export interface LearningExportJob {
  readonly attempt_count: number;
  readonly bundle_ref: D5ExactRef;
  readonly created_at: string;
  readonly destination_ref: D5ExactRef;
  readonly idempotency_key: string;
  readonly job_ref: D5ExactRef;
  readonly known_limits: readonly string[];
  readonly status: D5ExportJobStatus;
  readonly updated_at: string;
}

export const D5_DELIVERY_OUTCOMES = [
  "ACCEPTED",
  "TIMEOUT",
  "CLIENT_ERROR",
  "RATE_LIMITED",
  "SERVER_ERROR",
  "PARTIAL"
] as const;
export type D5DeliveryOutcome = (typeof D5_DELIVERY_OUTCOMES)[number];

export interface ExportStatementResult {
  readonly statement_id: string;
  readonly status: "ACCEPTED" | "REJECTED";
}

export interface ExportDeliveryAttempt {
  readonly attempt_no: number;
  readonly attempt_ref: D5ExactRef;
  readonly finished_at: string;
  readonly job_ref: D5ExactRef;
  readonly outcome: D5DeliveryOutcome;
  readonly sealed_payload_digest: string;
  readonly started_at: string;
  readonly statement_results: readonly ExportStatementResult[];
}

export interface ExportDeliveryReceipt {
  readonly attempt_no: number;
  readonly bundle_ref: D5ExactRef;
  readonly created_at: string;
  readonly destination_ref: D5ExactRef;
  readonly job_ref: D5ExactRef;
  readonly known_limits: readonly string[];
  readonly outcome: D5DeliveryOutcome;
  readonly receipt_ref: D5ExactRef;
  readonly runtime_authority: typeof D5_EXPORT_RUNTIME_AUTHORITY;
  readonly sealed_payload_digest: string;
  readonly statement_results: readonly ExportStatementResult[];
}

export interface D5ExportPreview {
  readonly aol_dataset: AoLExportDatasetVersion;
  readonly destination: DestinationProfileVersion;
  readonly known_limits: readonly string[];
  readonly policy: LearningExportPolicyVersion;
  readonly profile: XapiProfileVersion;
  readonly source_report_refs: readonly D5ExactRef[];
  readonly statements: readonly XapiStatement[];
}

export interface D5ExportBundleListDto {
  readonly bundles: readonly LearningExportBundleVersion[];
  readonly jobs: readonly LearningExportJob[];
  readonly known_limits: readonly string[];
  readonly receipts: readonly ExportDeliveryReceipt[];
  readonly runtime_authority: typeof D5_EXPORT_RUNTIME_AUTHORITY;
}

export type D5ExportFailureCode =
  | "D5_REPORT_NOT_ELIGIBLE"
  | "D5_EXACT_REFERENCE_INVALID"
  | "D5_EXPORT_SCOPE_VIOLATION"
  | "D5_EXPORT_PROFILE_INVALID"
  | "D5_EXPORT_POLICY_INVALID"
  | "D5_EXPORT_DUPLICATE_CONFLICT"
  | "D5_EXPORT_DESTINATION_FORBIDDEN"
  | "D5_EXPORT_JOB_NOT_FOUND"
  | "D5_EXPORT_JOB_NOT_RETRYABLE"
  | "D5_EXPORT_ALREADY_DELIVERED"
  | "D5_EXPORT_CANCEL_FORBIDDEN"
  | "D5_EXPORT_OUTPUT_INVALID";

const ID_PATTERN = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const RESERVED_PATTERN = /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isIdentity(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && ID_PATTERN.test(value) && !RESERVED_PATTERN.test(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !TIMESTAMP_PATTERN.test(value)) return false;
  const parsed = new Date(value);
  const canonical = value.includes(".") ? value : `${value.slice(0, -1)}.000Z`;
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === canonical;
}

export function isD5ExactRef(value: unknown): value is D5ExactRef {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["content_digest", "discriminator", "resource_id", "resource_type", "tenant_id", "version"]) &&
    value.discriminator === "exact_ref" &&
    DIGEST_PATTERN.test(String(value.content_digest)) &&
    isIdentity(value.resource_id) &&
    isIdentity(value.tenant_id) &&
    isIdentity(value.version) &&
    D5_EXPORT_RESOURCE_TYPES.includes(value.resource_type as D5ExportResourceType)
  );
}

export function canonicalizeD5(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeD5).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeD5(value[key])}`).join(",")}}`;
  }
  throw new Error("d5_value_not_serializable");
}

export function isXapiStatement(value: unknown): value is XapiStatement {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, ["actor", "context", "id", "object", "result", "timestamp", "verb"])) return false;
  if (!isRecord(value.actor) || !isRecord(value.context) || !isRecord(value.object) || !isRecord(value.result) || !isRecord(value.verb)) return false;
  const actor = value.actor;
  const account = actor.account;
  const context = value.context;
  const extensions = context.extensions;
  const object = value.object;
  const definition = object.definition;
  const result = value.result;
  const resultExtensions = result.extensions;
  const verb = value.verb;
  const display = verb.display;
  if (!isRecord(account) || !isRecord(extensions) || !isRecord(definition) || !isRecord(resultExtensions) || !isRecord(display)) return false;
  return (
    hasOnlyKeys(actor, ["account"]) && hasOnlyKeys(account, ["home_page", "name"]) &&
    account.home_page === "https://simwar.local/actor" && isIdentity(account.name) &&
    hasOnlyKeys(context, ["extensions"]) && hasOnlyKeys(extensions, ["course_id", "learning_goal_ref", "report_ref", "rubric_ref"]) &&
    isIdentity(extensions.course_id) && isD5ExactRef(extensions.learning_goal_ref) &&
    isD5ExactRef(extensions.report_ref) && isD5ExactRef(extensions.rubric_ref) &&
    typeof value.id === "string" && /^stmt_[A-Za-z0-9]+$/.test(value.id) && isTimestamp(value.timestamp) &&
    hasOnlyKeys(object, ["definition", "id"]) && typeof object.id === "string" && /^https:\/\/simwar\.local\/learning-report\//.test(object.id) &&
    hasOnlyKeys(definition, ["name", "type"]) && typeof definition.name === "string" &&
    definition.name.length > 0 && definition.type === "Activity" &&
    hasOnlyKeys(result, ["completion", "extensions"]) && result.completion === true &&
    hasOnlyKeys(resultExtensions, ["status"]) && (resultExtensions.status === "CONFIRMED" || resultExtensions.status === "AMENDED") &&
    hasOnlyKeys(verb, ["display", "id"]) && verb.id === "https://adlnet.gov/expapi/verbs/completed" &&
    hasOnlyKeys(display, ["en-US"]) && display["en-US"] === "completed"
  );
}

export function isLearningExportBundleVersion(value: unknown): value is LearningExportBundleVersion {
  if (!isRecord(value) || !hasOnlyKeys(value, ["aol_dataset", "bundle_digest", "bundle_ref", "created_by", "known_limits", "sealed_at", "schema_version", "statement_batch", "status", "visibility"])) return false;
  const batch = value.statement_batch as Record<string, unknown>;
  const dataset = value.aol_dataset as Record<string, unknown>;
  return (
    value.schema_version === D5_EXPORT_SCHEMA_VERSION && value.status === "SEALED" && value.visibility === "teacher_admin_only" &&
    isD5ExactRef(value.bundle_ref) && value.bundle_ref.resource_type === "learning_export_bundle_version" &&
    DIGEST_PATTERN.test(String(value.bundle_digest)) && isIdentity(value.created_by) && isTimestamp(value.sealed_at) &&
    Array.isArray(value.known_limits) && value.known_limits.length > 0 &&
    isRecord(batch) && isRecord(dataset) && isD5ExactRef(batch.batch_ref) && batch.batch_ref.resource_type === "xapi_statement_batch_version" &&
    isD5ExactRef(dataset.dataset_ref) && dataset.dataset_ref.resource_type === "aol_export_dataset_version" &&
    batch.schema_version === D5_EXPORT_SCHEMA_VERSION && dataset.schema_version === D5_EXPORT_SCHEMA_VERSION &&
    Array.isArray(batch.statements) && batch.statements.every(isXapiStatement) &&
    Array.isArray(batch.source_report_refs) && batch.source_report_refs.every(isD5ExactRef) &&
    Array.isArray(dataset.source_report_refs) && dataset.source_report_refs.every(isD5ExactRef) &&
    Array.isArray(dataset.rows) && dataset.rows.every((row) => isRecord(row) && hasOnlyKeys(row, ["coarsened", "criterion_count", "group_key", "level_distribution", "sample_size", "suppressed"]))
  );
}

export function isLearningExportJob(value: unknown): value is LearningExportJob {
  return isRecord(value) && hasOnlyKeys(value, ["attempt_count", "bundle_ref", "created_at", "destination_ref", "idempotency_key", "job_ref", "known_limits", "status", "updated_at"]) &&
    typeof value.attempt_count === "number" && Number.isInteger(value.attempt_count) && value.attempt_count >= 0 &&
    isD5ExactRef(value.bundle_ref) && value.bundle_ref.resource_type === "learning_export_bundle_version" &&
    isD5ExactRef(value.destination_ref) && value.destination_ref.resource_type === "destination_profile_version" &&
    isD5ExactRef(value.job_ref) && value.job_ref.resource_type === "learning_export_job" && isIdentity(value.idempotency_key) &&
    isTimestamp(value.created_at) && isTimestamp(value.updated_at) && D5_EXPORT_JOB_STATUSES.includes(value.status as D5ExportJobStatus);
}

export function isExportDeliveryReceipt(value: unknown): value is ExportDeliveryReceipt {
  return isRecord(value) && hasOnlyKeys(value, ["attempt_no", "bundle_ref", "created_at", "destination_ref", "job_ref", "known_limits", "outcome", "receipt_ref", "runtime_authority", "sealed_payload_digest", "statement_results"]) &&
    typeof value.attempt_no === "number" && Number.isInteger(value.attempt_no) && value.attempt_no > 0 &&
    isD5ExactRef(value.bundle_ref) && isD5ExactRef(value.destination_ref) && isD5ExactRef(value.job_ref) && isD5ExactRef(value.receipt_ref) &&
    value.receipt_ref.resource_type === "export_delivery_receipt" && isTimestamp(value.created_at) &&
    value.runtime_authority === D5_EXPORT_RUNTIME_AUTHORITY && DIGEST_PATTERN.test(String(value.sealed_payload_digest)) &&
    D5_DELIVERY_OUTCOMES.includes(value.outcome as D5DeliveryOutcome) && Array.isArray(value.known_limits) && Array.isArray(value.statement_results);
}
