/**
 * Cross-slice integration contracts for the R3 Golden Teaching Journey.
 * These are closed, projection-only shapes. They do not create or resolve
 * runtime authority and cannot write Truth, Settlement, Score, Rank, or Replay.
 */
export const R3_GOLDEN_SCHEMA_VERSION = "r3-golden-journey.v1" as const;
export const R3_GOLDEN_RUNTIME_AUTHORITY = "JSON_INTERNAL_ONLY" as const;

export const R3_GOLDEN_SLICES = ["D1", "R7", "M1", "D2", "D3", "D4", "D5", "D6", "R3"] as const;
export type R3GoldenSlice = (typeof R3_GOLDEN_SLICES)[number];

export const R3_GOLDEN_ACTIONS = [
  "view_context",
  "view_allowed_actions",
  "view_receipts",
  "view_provenance",
  "view_teacher_facts",
  "view_student_safe_report",
  "recover_journey",
  "abort_journey",
  "reset_journey",
  "cleanup_journey"
] as const;
export type R3GoldenAction = (typeof R3_GOLDEN_ACTIONS)[number];

export const R3_GOLDEN_ROLES = ["teacher", "student", "admin"] as const;
export type R3GoldenRole = (typeof R3_GOLDEN_ROLES)[number];

export const R3_GOLDEN_STATUSES = [
  "not_started",
  "ready",
  "in_progress",
  "generated",
  "published",
  "complete",
  "aborted",
  "reset",
  "failed"
] as const;
export type R3GoldenJourneyStatus = (typeof R3_GOLDEN_STATUSES)[number];

export const R3_GOLDEN_RECEIPT_STATUSES = ["PASS", "KNOWN_LIMIT", "BLOCKED", "NOT_RUN"] as const;
export type R3GoldenReceiptStatus = (typeof R3_GOLDEN_RECEIPT_STATUSES)[number];

export const R3_GOLDEN_REFERENCE_TYPES = [
  "course_package_version",
  "learning_goal_version",
  "rubric_version",
  "scenario_package_version",
  "parameter_set_version",
  "plugin_release_version",
  "course",
  "run",
  "round",
  "team",
  "role",
  "activity",
  "role_workflow_event",
  "evidence_artifact",
  "teacher_confirmation",
  "learning_report",
  "transfer_research_design",
  "result",
  "receipt",
  "transformation_rule"
] as const;
export type R3GoldenReferenceType = (typeof R3_GOLDEN_REFERENCE_TYPES)[number];

export interface GoldenJourneyExactRef {
  readonly content_digest: string;
  readonly discriminator: "exact_ref";
  readonly resource_id: string;
  readonly resource_type: R3GoldenReferenceType;
  readonly tenant_id: string;
  readonly version: string;
}

export interface GoldenJourneyContextDto {
  readonly correlation_id: string;
  readonly course_id: string;
  readonly course_package_ref: GoldenJourneyExactRef;
  readonly discriminator: "golden_journey_context";
  readonly journey_id: string;
  readonly known_limits: readonly string[];
  readonly learning_goal_ref?: GoldenJourneyExactRef;
  readonly rubric_ref?: GoldenJourneyExactRef;
  readonly request_id: string;
  readonly role_keys: readonly string[];
  readonly run_id?: string;
  readonly runtime_authority: typeof R3_GOLDEN_RUNTIME_AUTHORITY;
  readonly schema_version: typeof R3_GOLDEN_SCHEMA_VERSION;
  readonly status: R3GoldenJourneyStatus;
  readonly team_id?: string;
  readonly tenant_id: string;
}

export interface GoldenJourneyAllowedActionsDto {
  readonly allowed_actions: readonly R3GoldenAction[];
  readonly blocked_reasons: readonly string[];
  readonly correlation_id: string;
  readonly discriminator: "golden_journey_allowed_actions";
  readonly journey_id: string;
  readonly request_id: string;
  readonly role: R3GoldenRole;
  readonly schema_version: typeof R3_GOLDEN_SCHEMA_VERSION;
}

export interface CrossSliceReceiptEntry {
  readonly exact_refs: readonly GoldenJourneyExactRef[];
  readonly receipt_id?: string;
  readonly slice: R3GoldenSlice;
  readonly status: R3GoldenReceiptStatus;
}

export interface CrossSliceReceiptIndex {
  readonly chain_digest: string;
  readonly correlation_id: string;
  readonly discriminator: "cross_slice_receipt_index";
  readonly entries: readonly CrossSliceReceiptEntry[];
  readonly journey_id: string;
  readonly request_id: string;
  readonly schema_version: typeof R3_GOLDEN_SCHEMA_VERSION;
}

export interface CorrelationChainStep {
  readonly correlation_id?: string;
  readonly exact_refs: readonly GoldenJourneyExactRef[];
  readonly operation: string;
  readonly request_id?: string;
  readonly slice: R3GoldenSlice;
}

export interface CorrelationChainDto {
  readonly correlation_id: string;
  readonly discriminator: "correlation_chain";
  readonly journey_id: string;
  readonly request_id: string;
  readonly schema_version: typeof R3_GOLDEN_SCHEMA_VERSION;
  readonly status: "complete" | "partial" | "unavailable";
  readonly steps: readonly CorrelationChainStep[];
}

export interface GoldenJourneyStatusDto {
  readonly allowed_actions: GoldenJourneyAllowedActionsDto;
  readonly context: GoldenJourneyContextDto;
  readonly correlation_chain: CorrelationChainDto;
  readonly discriminator: "golden_journey_status";
  readonly formal_truth_write: false;
  readonly receipt_index: CrossSliceReceiptIndex;
  readonly runtime_authority: typeof R3_GOLDEN_RUNTIME_AUTHORITY;
  readonly schema_version: typeof R3_GOLDEN_SCHEMA_VERSION;
  readonly student_private_fields_exposed: false;
}

export interface GoldenFixtureManifest {
  readonly course_package_ref: GoldenJourneyExactRef;
  readonly discriminator: "golden_fixture_manifest";
  readonly fixture_id: string;
  readonly journey_id: string;
  readonly learning_goal_ref?: GoldenJourneyExactRef;
  readonly rubric_ref?: GoldenJourneyExactRef;
  readonly schema_version: typeof R3_GOLDEN_SCHEMA_VERSION;
  readonly seed: string;
  readonly team_id: string;
  readonly tenant_id: string;
}

export interface GoldenJourneyErrorEnvelope {
  readonly code: string;
  readonly correlation_id: string;
  readonly details: readonly { readonly field: string; readonly reason: string }[];
  readonly discriminator: "golden_journey_error";
  readonly message: string;
  readonly request_id: string;
  readonly schema_version: typeof R3_GOLDEN_SCHEMA_VERSION;
}

const ID_PATTERN = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const RESERVED = /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length >= required.length &&
    keys.every((key) => required.includes(key) || optional.includes(key)) &&
    required.every((key) => keys.includes(key))
  );
}

function identity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    ID_PATTERN.test(value) &&
    !RESERVED.test(value)
  );
}

function digest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_PATTERN.test(value);
}

function exactRef(value: unknown): value is GoldenJourneyExactRef {
  return (
    record(value) &&
    exactKeys(value, [
      "content_digest",
      "discriminator",
      "resource_id",
      "resource_type",
      "tenant_id",
      "version"
    ]) &&
    Object.keys(value).length === 6 &&
    value.discriminator === "exact_ref" &&
    digest(value.content_digest) &&
    identity(value.resource_id) &&
    identity(value.tenant_id) &&
    identity(value.version) &&
    R3_GOLDEN_REFERENCE_TYPES.includes(value.resource_type as R3GoldenReferenceType)
  );
}

function strings(value: unknown, allowEmpty = false): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && (allowEmpty || item.length > 0))
  );
}

export function isGoldenJourneyContextDto(value: unknown): value is GoldenJourneyContextDto {
  if (
    !record(value) ||
    !exactKeys(
      value,
      [
        "correlation_id",
        "course_id",
        "course_package_ref",
        "discriminator",
        "journey_id",
        "known_limits",
        "request_id",
        "role_keys",
        "runtime_authority",
        "schema_version",
        "status",
        "tenant_id"
      ],
      ["learning_goal_ref", "rubric_ref", "run_id", "team_id"]
    )
  )
    return false;
  return (
    identity(value.correlation_id) &&
    identity(value.course_id) &&
    exactRef(value.course_package_ref) &&
    value.discriminator === "golden_journey_context" &&
    identity(value.journey_id) &&
    strings(value.known_limits) &&
    (value.learning_goal_ref === undefined || exactRef(value.learning_goal_ref)) &&
    (value.rubric_ref === undefined || exactRef(value.rubric_ref)) &&
    identity(value.request_id) &&
    strings(value.role_keys) &&
    value.runtime_authority === R3_GOLDEN_RUNTIME_AUTHORITY &&
    value.schema_version === R3_GOLDEN_SCHEMA_VERSION &&
    R3_GOLDEN_STATUSES.includes(value.status as R3GoldenJourneyStatus) &&
    (value.run_id === undefined || identity(value.run_id)) &&
    (value.team_id === undefined || identity(value.team_id)) &&
    identity(value.tenant_id) &&
    [value.course_package_ref, value.learning_goal_ref, value.rubric_ref]
      .filter(Boolean)
      .every((ref) => (ref as GoldenJourneyExactRef).tenant_id === value.tenant_id)
  );
}

export function isGoldenJourneyAllowedActionsDto(
  value: unknown
): value is GoldenJourneyAllowedActionsDto {
  if (
    !record(value) ||
    !exactKeys(value, [
      "allowed_actions",
      "blocked_reasons",
      "correlation_id",
      "discriminator",
      "journey_id",
      "request_id",
      "role",
      "schema_version"
    ]) ||
    Object.keys(value).length !== 8
  )
    return false;
  return (
    strings(value.blocked_reasons, true) &&
    Array.isArray(value.allowed_actions) &&
    value.allowed_actions.every((action) => R3_GOLDEN_ACTIONS.includes(action as R3GoldenAction)) &&
    identity(value.correlation_id) &&
    value.discriminator === "golden_journey_allowed_actions" &&
    identity(value.journey_id) &&
    identity(value.request_id) &&
    R3_GOLDEN_ROLES.includes(value.role as R3GoldenRole) &&
    value.schema_version === R3_GOLDEN_SCHEMA_VERSION
  );
}

function isReceiptEntry(value: unknown): value is CrossSliceReceiptEntry {
  if (!record(value) || !exactKeys(value, ["exact_refs", "slice", "status"], ["receipt_id"]))
    return false;
  return (
    Array.isArray(value.exact_refs) &&
    value.exact_refs.every(exactRef) &&
    R3_GOLDEN_SLICES.includes(value.slice as R3GoldenSlice) &&
    R3_GOLDEN_RECEIPT_STATUSES.includes(value.status as R3GoldenReceiptStatus) &&
    (value.receipt_id === undefined || identity(value.receipt_id))
  );
}

export function isCrossSliceReceiptIndex(value: unknown): value is CrossSliceReceiptIndex {
  if (
    !record(value) ||
    !exactKeys(value, [
      "chain_digest",
      "correlation_id",
      "discriminator",
      "entries",
      "journey_id",
      "request_id",
      "schema_version"
    ]) ||
    Object.keys(value).length !== 7
  )
    return false;
  return (
    digest(value.chain_digest) &&
    identity(value.correlation_id) &&
    value.discriminator === "cross_slice_receipt_index" &&
    Array.isArray(value.entries) &&
    value.entries.every(isReceiptEntry) &&
    identity(value.journey_id) &&
    identity(value.request_id) &&
    value.schema_version === R3_GOLDEN_SCHEMA_VERSION
  );
}

function isChainStep(value: unknown): value is CorrelationChainStep {
  if (
    !record(value) ||
    !exactKeys(value, ["exact_refs", "operation", "slice"], ["correlation_id", "request_id"])
  )
    return false;
  return (
    Array.isArray(value.exact_refs) &&
    value.exact_refs.every(exactRef) &&
    identity(value.operation) &&
    R3_GOLDEN_SLICES.includes(value.slice as R3GoldenSlice) &&
    (value.correlation_id === undefined || identity(value.correlation_id)) &&
    (value.request_id === undefined || identity(value.request_id))
  );
}

export function isCorrelationChainDto(value: unknown): value is CorrelationChainDto {
  if (
    !record(value) ||
    !exactKeys(value, [
      "correlation_id",
      "discriminator",
      "journey_id",
      "request_id",
      "schema_version",
      "status",
      "steps"
    ]) ||
    Object.keys(value).length !== 7
  )
    return false;
  return (
    identity(value.correlation_id) &&
    value.discriminator === "correlation_chain" &&
    identity(value.journey_id) &&
    identity(value.request_id) &&
    value.schema_version === R3_GOLDEN_SCHEMA_VERSION &&
    ["complete", "partial", "unavailable"].includes(value.status as string) &&
    Array.isArray(value.steps) &&
    value.steps.every(isChainStep)
  );
}

export function isGoldenJourneyStatusDto(value: unknown): value is GoldenJourneyStatusDto {
  if (
    !record(value) ||
    !exactKeys(value, [
      "allowed_actions",
      "context",
      "correlation_chain",
      "discriminator",
      "formal_truth_write",
      "receipt_index",
      "runtime_authority",
      "schema_version",
      "student_private_fields_exposed"
    ]) ||
    Object.keys(value).length !== 9
  )
    return false;
  return (
    isGoldenJourneyAllowedActionsDto(value.allowed_actions) &&
    isGoldenJourneyContextDto(value.context) &&
    isCorrelationChainDto(value.correlation_chain) &&
    value.discriminator === "golden_journey_status" &&
    value.formal_truth_write === false &&
    isCrossSliceReceiptIndex(value.receipt_index) &&
    value.runtime_authority === R3_GOLDEN_RUNTIME_AUTHORITY &&
    value.schema_version === R3_GOLDEN_SCHEMA_VERSION &&
    value.student_private_fields_exposed === false
  );
}

export function toGoldenJourneyError(input: {
  code: string;
  correlation_id: string;
  details?: readonly { readonly field: string; readonly reason: string }[];
  message: string;
  request_id: string;
}): GoldenJourneyErrorEnvelope {
  return {
    code: input.code,
    correlation_id: input.correlation_id,
    details: [...(input.details ?? [])],
    discriminator: "golden_journey_error",
    message: input.message,
    request_id: input.request_id,
    schema_version: R3_GOLDEN_SCHEMA_VERSION
  };
}
