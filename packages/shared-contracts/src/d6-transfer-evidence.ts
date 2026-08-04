export const D6_TRANSFER_SCHEMA_VERSION = "d6-transfer-evidence.v1" as const;
export const D6_RUNTIME_AUTHORITY = "JSON_INTERNAL_ONLY" as const;
export const D6_FORMAL_TRANSFER_CLAIM_WRITE = false as const;

export const D6_STUDY_STATES = [
  "DRAFT",
  "VALIDATING",
  "READY_WITH_LIMITS",
  "FROZEN",
  "RETIRED"
] as const;
export type D6StudyState = (typeof D6_STUDY_STATES)[number];
export const D6_SOURCE_TYPES = [
  "LEARNER_SELF_REPORT",
  "SUPERVISOR_OBSERVATION",
  "WORK_ARTIFACT_REVIEW",
  "SYSTEM_EVENT",
  "PEER_OR_CUSTOMER_FEEDBACK"
] as const;
export type D6SourceType = (typeof D6_SOURCE_TYPES)[number];
export const D6_TRANSFER_STATES = [
  "NOT_ASSESSED",
  "OPPORTUNITY_NOT_AVAILABLE",
  "ATTEMPTED_APPLICATION",
  "OBSERVED_APPLICATION",
  "SUSTAINED_APPLICATION",
  "GENERALIZED_APPLICATION",
  "INSUFFICIENT_EVIDENCE"
] as const;
export type D6TransferState = (typeof D6_TRANSFER_STATES)[number];
export const D6_OBSERVER_RELATIONS = ["SELF", "SUPERVISOR", "PEER", "CUSTOMER", "SYSTEM"] as const;
export type D6ObserverRelation = (typeof D6_OBSERVER_RELATIONS)[number];
export const D6_OBSERVER_CONFLICT_STATUSES = [
  "NOT_ASSESSED",
  "NO_KNOWN_CONFLICT",
  "POTENTIAL_CONFLICT"
] as const;
export type D6ObserverConflictStatus = (typeof D6_OBSERVER_CONFLICT_STATUSES)[number];
export const D6_PARTICIPATION_STATUSES = ["NOT_ESTABLISHED", "CONSENTED", "WITHDRAWN"] as const;
export type D6ParticipationStatus = (typeof D6_PARTICIPATION_STATUSES)[number];
export const D6_SUPPRESSION_STATUSES = [
  "NOT_EVALUATED",
  "VISIBLE_ABOVE_THRESHOLD",
  "SUPPRESSED_BELOW_THRESHOLD"
] as const;
export type D6SuppressionStatus = (typeof D6_SUPPRESSION_STATUSES)[number];
export const D6_DELETION_MODES = ["DELETE_ON_EXPIRY", "MANUAL_REVIEW_REQUIRED"] as const;
export type D6DeletionMode = (typeof D6_DELETION_MODES)[number];
export const D6_OPPORTUNITY_STATUS = ["AVAILABLE", "NOT_AVAILABLE", "UNKNOWN"] as const;
export type D6OpportunityStatus = (typeof D6_OPPORTUNITY_STATUS)[number];
export const D6_MISSINGNESS_STATUS = ["OBSERVED", "MISSING", "NOT_APPLICABLE", "WITHHELD"] as const;
export type D6MissingnessStatus = (typeof D6_MISSINGNESS_STATUS)[number];
export const D6_RECORD_TYPES = [
  "TRANSFER_OPPORTUNITY_RECORD",
  "TRANSFER_SELF_REPORT_RECORD",
  "TRANSFER_OBSERVATION_RECORD",
  "TRANSFER_ARTIFACT_RECORD",
  "TRANSFER_SYSTEM_EVENT_RECORD",
  "TRANSFER_CONTEXT_RECORD"
] as const;
export type D6RecordType = (typeof D6_RECORD_TYPES)[number];
export const D6_EVIDENCE_STRENGTHS = [
  "SOURCE_ONLY",
  "CORROBORATED",
  "TRIANGULATED",
  "INSUFFICIENT"
] as const;
export type D6EvidenceStrength = (typeof D6_EVIDENCE_STRENGTHS)[number];

export interface D6ExactRef {
  readonly content_digest: string;
  readonly discriminator: "exact_ref";
  readonly resource_id: string;
  readonly resource_type: string;
  readonly tenant_id: string;
  readonly version: string;
}

export interface TransferResearchQuestion {
  readonly prompt: string;
  readonly question_id: string;
}

export interface TransferResearchScope {
  readonly activity_id: string;
  readonly course_id: string;
  readonly role_key: string;
  readonly run_id: string;
  readonly team_id: string;
}

export interface TransferObservationWindowDefinition {
  readonly code: "W0_BASELINE" | "W1_IMMEDIATE" | "W2_30D" | "W3_60D" | "W4_90D";
  readonly offset_days: number;
  readonly tolerance_days: number;
}

export interface TransferOutcomeMeasureDefinition {
  readonly code: string;
  readonly allowed_states: readonly D6TransferState[];
  readonly missing_is_not_negative: true;
  readonly role: "PRIMARY" | "SECONDARY";
}

export interface TransferEvidenceSourcePolicy {
  readonly allowed_source_types: readonly D6SourceType[];
  readonly minimum_source_types: number;
  readonly required_provenance_complete: true;
  readonly small_cohort_minimum: number;
  readonly retention_days: number;
  readonly deletion_mode: D6DeletionMode;
}

export interface TransferInstrumentVersion {
  readonly content_digest: string;
  readonly instrument_ref: D6ExactRef;
  readonly items: readonly {
    readonly item_id: string;
    readonly prompt: string;
    readonly response_type: "TEXT" | "BOOLEAN" | "ENUM" | "NUMBER";
  }[];
  readonly schema_version: typeof D6_TRANSFER_SCHEMA_VERSION;
  readonly source_type: D6SourceType;
  readonly status: "DRAFT" | "FROZEN" | "RETIRED";
  readonly visibility: "teacher_admin_only";
}

export interface TransferAnalysisPlanVersion {
  readonly analysis_plan_ref: D6ExactRef;
  readonly claim_mode: "DESCRIPTIVE_ONLY" | "ASSOCIATIONAL_ONLY";
  readonly content_digest: string;
  readonly causal_claim: false;
  readonly baseline_required: true;
  readonly missing_data_policy: "MISSING_NOT_NEGATIVE";
  readonly outcome_codes: readonly string[];
  readonly schema_version: typeof D6_TRANSFER_SCHEMA_VERSION;
  readonly small_cell_suppression: number;
}

export interface TransferStudyDefinitionVersion {
  readonly analysis_plan_ref: D6ExactRef;
  readonly content_digest: string;
  readonly course_package_ref: D6ExactRef;
  readonly created_at: string;
  readonly d4_source_ref: D6ExactRef;
  readonly d4_reference_only: true;
  readonly d5_source_ref: D6ExactRef;
  readonly d5_reference_only: true;
  readonly formal_transfer_claim_write: false;
  readonly instrument_refs: readonly D6ExactRef[];
  readonly lifecycle: D6StudyState;
  readonly context_factors: readonly string[];
  readonly observation_windows: readonly TransferObservationWindowDefinition[];
  readonly outcome_measures: readonly TransferOutcomeMeasureDefinition[];
  readonly provenance_source_policy: TransferEvidenceSourcePolicy;
  readonly research_questions: readonly TransferResearchQuestion[];
  readonly rubric_ref: D6ExactRef;
  readonly schema_version: typeof D6_TRANSFER_SCHEMA_VERSION;
  readonly study_ref: D6ExactRef;
  readonly title: string;
  readonly learning_goal_ref: D6ExactRef;
  readonly scope: TransferResearchScope;
  readonly supersedes_ref?: D6ExactRef;
  readonly visibility: "teacher_admin_only";
}

export interface TransferEvidenceProvenanceEdge {
  readonly discriminator: "d6_transfer_provenance_edge";
  readonly relation: "derived_from" | "supported_by";
  readonly source_ref: D6ExactRef;
  readonly target_ref: D6ExactRef;
}

export interface TransferEvidenceRecordCandidate {
  readonly candidate_ref: D6ExactRef;
  readonly content_digest: string;
  readonly context_snapshot: {
    readonly factors: readonly string[];
    readonly opportunity_status: D6OpportunityStatus;
  };
  readonly created_at: string;
  readonly formal_transfer_claim_write: false;
  readonly instrument_ref: D6ExactRef;
  readonly missingness_status: D6MissingnessStatus;
  readonly observer_relation: D6ObserverRelation;
  readonly observer_conflict_status: D6ObserverConflictStatus;
  readonly participation_status: D6ParticipationStatus;
  readonly participant_ref: D6ExactRef;
  readonly provenance_edges: readonly TransferEvidenceProvenanceEdge[];
  readonly record_type: D6RecordType;
  readonly runtime_status: "SYNTHETIC_ONLY";
  readonly schema_version: typeof D6_TRANSFER_SCHEMA_VERSION;
  readonly source_type: D6SourceType;
  readonly scope: TransferResearchScope;
  readonly suppression_status: D6SuppressionStatus;
  readonly study_ref: D6ExactRef;
  readonly transfer_state: D6TransferState;
  readonly visibility: "teacher_admin_only";
  readonly window_ref: D6ExactRef;
}

export interface TransferResearchReceipt {
  readonly created_at: string;
  readonly formal_transfer_claim_write: false;
  readonly known_limits: readonly string[];
  readonly runtime_authority: typeof D6_RUNTIME_AUTHORITY;
  readonly schema_version: typeof D6_TRANSFER_SCHEMA_VERSION;
  readonly status: "PREVIEWED" | "FROZEN" | "REUSED";
  readonly study_ref: D6ExactRef;
}

export interface TransferResearchDesignListDto {
  readonly known_limits: readonly string[];
  readonly runtime_authority: typeof D6_RUNTIME_AUTHORITY;
  readonly studies: readonly TransferStudyDefinitionVersion[];
  readonly synthetic_previews: readonly TransferEvidenceRecordCandidate[];
}

export interface TransferResearchDesignBundle {
  readonly analysis_plan: TransferAnalysisPlanVersion;
  readonly instrument: TransferInstrumentVersion;
  readonly receipt: TransferResearchReceipt;
  readonly study: TransferStudyDefinitionVersion;
  readonly synthetic_preview: TransferEvidenceRecordCandidate;
}
export interface TransferResearchDesignInput {
  readonly analysis_plan_ref: D6ExactRef;
  readonly course_package_ref: D6ExactRef;
  readonly d4_source_ref: D6ExactRef;
  readonly d5_source_ref: D6ExactRef;
  readonly instrument: Omit<
    TransferInstrumentVersion,
    "content_digest" | "instrument_ref" | "schema_version" | "status" | "visibility"
  >;
  readonly context_factors: readonly string[];
  readonly learning_goal_ref: D6ExactRef;
  readonly observation_windows: readonly TransferObservationWindowDefinition[];
  readonly outcome_measures: readonly TransferOutcomeMeasureDefinition[];
  readonly provenance_source_policy: TransferEvidenceSourcePolicy;
  readonly research_questions: readonly TransferResearchQuestion[];
  readonly rubric_ref: D6ExactRef;
  readonly scope: TransferResearchScope;
  readonly title: string;
}

const ID_PATTERN = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const RESERVED =
  /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved|wildcard)(?:$|[._:-])/i;
const keys = (value: Record<string, unknown>, expected: readonly string[]) => {
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const isTransferResearchScope = (value: unknown): value is TransferResearchScope =>
  record(value) &&
  keys(value, ["activity_id", "course_id", "role_key", "run_id", "team_id"]) &&
  [value.activity_id, value.course_id, value.role_key, value.run_id, value.team_id].every(identity);
const isTransferResearchQuestion = (value: unknown): value is TransferResearchQuestion =>
  record(value) &&
  keys(value, ["prompt", "question_id"]) &&
  identity(value.question_id) &&
  typeof value.prompt === "string" &&
  value.prompt.trim() === value.prompt &&
  value.prompt.length > 0;
const identity = (value: unknown) =>
  typeof value === "string" &&
  value.trim() === value &&
  ID_PATTERN.test(value) &&
  !RESERVED.test(value);
const version = (value: unknown) =>
  typeof value === "string" && identity(value) && !/(?:^|[._:-])[xX*](?:$|[._:-])/.test(value);
const timestamp = (value: unknown) => {
  if (typeof value !== "string" || !TIMESTAMP_PATTERN.test(value)) return false;
  const parsed = new Date(value);
  const canonical = value.includes(".") ? value : `${value.slice(0, -1)}.000Z`;
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === canonical;
};
const digest = (value: unknown) => typeof value === "string" && DIGEST_PATTERN.test(value);

export function isD6ExactRef(value: unknown): value is D6ExactRef {
  return (
    record(value) &&
    keys(value, [
      "content_digest",
      "discriminator",
      "resource_id",
      "resource_type",
      "tenant_id",
      "version"
    ]) &&
    value.discriminator === "exact_ref" &&
    digest(value.content_digest) &&
    identity(value.resource_id) &&
    identity(value.resource_type) &&
    identity(value.tenant_id) &&
    version(value.version)
  );
}

export function isTransferObservationWindowDefinition(
  value: unknown
): value is TransferObservationWindowDefinition {
  return (
    record(value) &&
    keys(value, ["code", "offset_days", "tolerance_days"]) &&
    ["W0_BASELINE", "W1_IMMEDIATE", "W2_30D", "W3_60D", "W4_90D"].includes(value.code as string) &&
    Number.isInteger(value.offset_days) &&
    Number.isInteger(value.tolerance_days) &&
    Number(value.offset_days) >= 0 &&
    Number(value.tolerance_days) >= 0
  );
}

export function isTransferOutcomeMeasureDefinition(
  value: unknown
): value is TransferOutcomeMeasureDefinition {
  return (
    record(value) &&
    keys(value, ["code", "allowed_states", "missing_is_not_negative", "role"]) &&
    identity(value.code) &&
    value.missing_is_not_negative === true &&
    ["PRIMARY", "SECONDARY"].includes(value.role as string) &&
    Array.isArray(value.allowed_states) &&
    value.allowed_states.length > 0 &&
    value.allowed_states.every((state) => D6_TRANSFER_STATES.includes(state as D6TransferState))
  );
}

export function isTransferEvidenceSourcePolicy(
  value: unknown
): value is TransferEvidenceSourcePolicy {
  return (
    record(value) &&
    keys(value, [
      "allowed_source_types",
      "minimum_source_types",
      "required_provenance_complete",
      "small_cohort_minimum",
      "retention_days",
      "deletion_mode"
    ]) &&
    Array.isArray(value.allowed_source_types) &&
    value.allowed_source_types.length > 0 &&
    value.allowed_source_types.every((source) =>
      D6_SOURCE_TYPES.includes(source as D6SourceType)
    ) &&
    Number.isInteger(value.minimum_source_types) &&
    Number(value.minimum_source_types) >= 2 &&
    Number(value.minimum_source_types) <= value.allowed_source_types.length &&
    value.required_provenance_complete === true &&
    Number.isInteger(value.small_cohort_minimum) &&
    Number(value.small_cohort_minimum) >= 3 &&
    Number.isInteger(value.retention_days) &&
    Number(value.retention_days) > 0 &&
    D6_DELETION_MODES.includes(value.deletion_mode as D6DeletionMode)
  );
}

function refsSameTenant(refs: readonly D6ExactRef[]) {
  return refs.length > 0 && refs.every((ref) => ref.tenant_id === refs[0]?.tenant_id);
}

export function isTransferInstrumentVersion(value: unknown): value is TransferInstrumentVersion {
  if (
    !record(value) ||
    !keys(value, [
      "content_digest",
      "instrument_ref",
      "items",
      "schema_version",
      "source_type",
      "status",
      "visibility"
    ]) ||
    !digest(value.content_digest) ||
    !isD6ExactRef(value.instrument_ref) ||
    value.instrument_ref.resource_type !== "transfer_instrument_version" ||
    value.instrument_ref.content_digest !== value.content_digest ||
    value.schema_version !== D6_TRANSFER_SCHEMA_VERSION ||
    !D6_SOURCE_TYPES.includes(value.source_type as D6SourceType) ||
    !["DRAFT", "FROZEN", "RETIRED"].includes(value.status as string) ||
    value.visibility !== "teacher_admin_only" ||
    !Array.isArray(value.items) ||
    value.items.length === 0
  )
    return false;
  return value.items.every(
    (item) =>
      record(item) &&
      keys(item, ["item_id", "prompt", "response_type"]) &&
      identity(item.item_id) &&
      typeof item.prompt === "string" &&
      item.prompt.trim().length > 0 &&
      ["TEXT", "BOOLEAN", "ENUM", "NUMBER"].includes(item.response_type as string)
  );
}

export function isTransferAnalysisPlanVersion(
  value: unknown
): value is TransferAnalysisPlanVersion {
  return (
    record(value) &&
    keys(value, [
      "analysis_plan_ref",
      "claim_mode",
      "content_digest",
      "causal_claim",
      "baseline_required",
      "missing_data_policy",
      "outcome_codes",
      "schema_version",
      "small_cell_suppression"
    ]) &&
    isD6ExactRef(value.analysis_plan_ref) &&
    value.analysis_plan_ref.resource_type === "transfer_analysis_plan_version" &&
    digest(value.content_digest) &&
    value.analysis_plan_ref.content_digest === value.content_digest &&
    ["DESCRIPTIVE_ONLY", "ASSOCIATIONAL_ONLY"].includes(value.claim_mode as string) &&
    value.causal_claim === false &&
    value.baseline_required === true &&
    value.missing_data_policy === "MISSING_NOT_NEGATIVE" &&
    Array.isArray(value.outcome_codes) &&
    value.outcome_codes.length > 0 &&
    value.outcome_codes.every(identity) &&
    value.schema_version === D6_TRANSFER_SCHEMA_VERSION &&
    Number.isInteger(value.small_cell_suppression) &&
    Number(value.small_cell_suppression) >= 3
  );
}

export function isTransferEvidenceProvenanceEdge(
  value: unknown
): value is TransferEvidenceProvenanceEdge {
  return (
    record(value) &&
    keys(value, ["discriminator", "relation", "source_ref", "target_ref"]) &&
    value.discriminator === "d6_transfer_provenance_edge" &&
    ["derived_from", "supported_by"].includes(value.relation as string) &&
    isD6ExactRef(value.source_ref) &&
    isD6ExactRef(value.target_ref) &&
    value.source_ref.tenant_id === value.target_ref.tenant_id &&
    JSON.stringify(value.source_ref) !== JSON.stringify(value.target_ref)
  );
}

export function isTransferStudyDefinitionVersion(
  value: unknown
): value is TransferStudyDefinitionVersion {
  if (
    !record(value) ||
    !keys(value, [
      "analysis_plan_ref",
      "content_digest",
      "course_package_ref",
      "created_at",
      "d4_source_ref",
      "d4_reference_only",
      "d5_source_ref",
      "d5_reference_only",
      "formal_transfer_claim_write",
      "instrument_refs",
      "lifecycle",
      "context_factors",
      "observation_windows",
      "outcome_measures",
      "provenance_source_policy",
      "research_questions",
      "rubric_ref",
      "schema_version",
      "study_ref",
      "title",
      "learning_goal_ref",
      "scope",
      "visibility",
      ...(value.supersedes_ref === undefined ? [] : ["supersedes_ref"])
    ])
  )
    return false;
  const refs = [
    value.study_ref,
    value.course_package_ref,
    value.d4_source_ref,
    value.d5_source_ref,
    value.learning_goal_ref,
    value.rubric_ref,
    value.analysis_plan_ref,
    ...(Array.isArray(value.instrument_refs) ? value.instrument_refs : [])
  ];
  return (
    digest(value.content_digest) &&
    isD6ExactRef(value.study_ref) &&
    value.study_ref.resource_type === "transfer_study_definition_version" &&
    value.study_ref.content_digest === value.content_digest &&
    isD6ExactRef(value.course_package_ref) &&
    isD6ExactRef(value.d4_source_ref) &&
    isD6ExactRef(value.d5_source_ref) &&
    isD6ExactRef(value.learning_goal_ref) &&
    isD6ExactRef(value.rubric_ref) &&
    isD6ExactRef(value.analysis_plan_ref) &&
    Array.isArray(value.instrument_refs) &&
    value.instrument_refs.length > 0 &&
    value.instrument_refs.every(isD6ExactRef) &&
    Array.isArray(value.context_factors) &&
    value.context_factors.length > 0 &&
    value.context_factors.every(identity) &&
    Array.isArray(value.observation_windows) &&
    value.observation_windows.length >= 2 &&
    value.observation_windows.some((window) => window.code === "W0_BASELINE") &&
    value.observation_windows.every(isTransferObservationWindowDefinition) &&
    Array.isArray(value.outcome_measures) &&
    value.outcome_measures.length > 0 &&
    value.outcome_measures.every(isTransferOutcomeMeasureDefinition) &&
    value.outcome_measures.filter((measure) => measure.role === "PRIMARY").length === 1 &&
    isTransferEvidenceSourcePolicy(value.provenance_source_policy) &&
    Array.isArray(value.research_questions) &&
    value.research_questions.length > 0 &&
    value.research_questions.every(isTransferResearchQuestion) &&
    timestamp(value.created_at) &&
    D6_STUDY_STATES.includes(value.lifecycle as D6StudyState) &&
    value.d4_reference_only === true &&
    value.d5_reference_only === true &&
    value.formal_transfer_claim_write === false &&
    value.schema_version === D6_TRANSFER_SCHEMA_VERSION &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    isTransferResearchScope(value.scope) &&
    value.visibility === "teacher_admin_only" &&
    (value.supersedes_ref === undefined || isD6ExactRef(value.supersedes_ref)) &&
    refs.every((ref): ref is D6ExactRef => isD6ExactRef(ref)) &&
    refsSameTenant(refs)
  );
}

export function isTransferEvidenceRecordCandidate(
  value: unknown
): value is TransferEvidenceRecordCandidate {
  if (
    !record(value) ||
    !keys(value, [
      "candidate_ref",
      "content_digest",
      "context_snapshot",
      "created_at",
      "formal_transfer_claim_write",
      "instrument_ref",
      "missingness_status",
      "observer_relation",
      "observer_conflict_status",
      "participation_status",
      "participant_ref",
      "provenance_edges",
      "record_type",
      "runtime_status",
      "schema_version",
      "source_type",
      "suppression_status",
      "scope",
      "study_ref",
      "transfer_state",
      "visibility",
      "window_ref"
    ])
  )
    return false;
  const refs = [
    value.candidate_ref,
    value.instrument_ref,
    value.participant_ref,
    value.study_ref,
    value.window_ref
  ];
  return (
    refs.every(isD6ExactRef) &&
    refsSameTenant(refs as D6ExactRef[]) &&
    isD6ExactRef(value.candidate_ref) &&
    value.candidate_ref.resource_type === "transfer_evidence_record_candidate" &&
    digest(value.content_digest) &&
    value.candidate_ref.content_digest === value.content_digest &&
    isD6ExactRef(value.instrument_ref) &&
    value.instrument_ref.resource_type === "transfer_instrument_version" &&
    isD6ExactRef(value.participant_ref) &&
    value.participant_ref.resource_type === "pseudonymous_participant" &&
    isD6ExactRef(value.study_ref) &&
    value.study_ref.resource_type === "transfer_study_definition_version" &&
    isD6ExactRef(value.window_ref) &&
    value.window_ref.resource_type === "transfer_observation_window" &&
    record(value.context_snapshot) &&
    keys(value.context_snapshot, ["factors", "opportunity_status"]) &&
    Array.isArray(value.context_snapshot.factors) &&
    value.context_snapshot.factors.every(identity) &&
    D6_OPPORTUNITY_STATUS.includes(
      value.context_snapshot.opportunity_status as D6OpportunityStatus
    ) &&
    timestamp(value.created_at) &&
    value.formal_transfer_claim_write === false &&
    D6_MISSINGNESS_STATUS.includes(value.missingness_status as D6MissingnessStatus) &&
    D6_OBSERVER_RELATIONS.includes(value.observer_relation as D6ObserverRelation) &&
    D6_OBSERVER_CONFLICT_STATUSES.includes(
      value.observer_conflict_status as D6ObserverConflictStatus
    ) &&
    D6_PARTICIPATION_STATUSES.includes(value.participation_status as D6ParticipationStatus) &&
    Array.isArray(value.provenance_edges) &&
    value.provenance_edges.length > 0 &&
    value.provenance_edges.every(isTransferEvidenceProvenanceEdge) &&
    D6_RECORD_TYPES.includes(value.record_type as D6RecordType) &&
    value.runtime_status === "SYNTHETIC_ONLY" &&
    value.schema_version === D6_TRANSFER_SCHEMA_VERSION &&
    D6_SOURCE_TYPES.includes(value.source_type as D6SourceType) &&
    D6_SUPPRESSION_STATUSES.includes(value.suppression_status as D6SuppressionStatus) &&
    isTransferResearchScope(value.scope) &&
    D6_TRANSFER_STATES.includes(value.transfer_state as D6TransferState) &&
    value.visibility === "teacher_admin_only"
  );
}

export function isTransferResearchReceipt(value: unknown): value is TransferResearchReceipt {
  return (
    record(value) &&
    keys(value, [
      "created_at",
      "formal_transfer_claim_write",
      "known_limits",
      "runtime_authority",
      "schema_version",
      "status",
      "study_ref"
    ]) &&
    timestamp(value.created_at) &&
    value.formal_transfer_claim_write === false &&
    Array.isArray(value.known_limits) &&
    value.known_limits.length > 0 &&
    value.known_limits.every((limit) => typeof limit === "string" && limit.trim().length > 0) &&
    value.runtime_authority === D6_RUNTIME_AUTHORITY &&
    value.schema_version === D6_TRANSFER_SCHEMA_VERSION &&
    ["PREVIEWED", "FROZEN", "REUSED"].includes(value.status as string) &&
    isD6ExactRef(value.study_ref)
  );
}
