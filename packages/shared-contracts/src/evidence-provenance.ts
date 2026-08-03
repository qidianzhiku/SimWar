export const D2_EVIDENCE_SCHEMA_VERSION = "evidence-provenance.v1" as const;

export const D2_ELIGIBLE_EVENT_TYPES = ["section_ready", "merge_created", "team_confirmed"] as const;
export type D2EligibleEventType = (typeof D2_ELIGIBLE_EVENT_TYPES)[number];

export const D2_PROVENANCE_RELATIONS = ["derived_from", "supported_by"] as const;
export type D2ProvenanceRelation = (typeof D2_PROVENANCE_RELATIONS)[number];

export const D2_REFERENCE_RESOURCE_TYPES = [
  "course_package_version",
  "learning_goal_version",
  "rubric_version",
  "role_workflow_event",
  "evidence_artifact",
  "transformation_rule"
] as const;
export type D2ReferenceResourceType = (typeof D2_REFERENCE_RESOURCE_TYPES)[number];

export interface D2ExactRef {
  readonly content_digest: string;
  readonly discriminator: "exact_ref";
  readonly resource_id: string;
  readonly resource_type: D2ReferenceResourceType;
  readonly tenant_id: string;
  readonly version: string;
}

export interface D2BoundedContext {
  readonly activity_id: string;
  readonly course_id: string;
  readonly role_key: string;
  readonly run_id: string;
  readonly team_id: string;
}

export interface D2EvidenceArtifactVersion {
  readonly artifact_digest: string;
  readonly artifact_kind: "observation";
  readonly artifact_ref: D2ExactRef;
  readonly captured_at: string;
  readonly captured_by: string;
  readonly context: D2BoundedContext;
  readonly course_package_ref: D2ExactRef;
  readonly discriminator: "d2_evidence_artifact_version";
  readonly idempotency_key: string;
  readonly known_limits: readonly string[];
  readonly learning_goal_ref: D2ExactRef;
  readonly rubric_ref: D2ExactRef;
  readonly schema_version: typeof D2_EVIDENCE_SCHEMA_VERSION;
  readonly source_event_ref: D2ExactRef;
  readonly transformation_rule_ref: D2ExactRef;
  readonly visibility: "teacher_only";
}

export interface D2ProvenanceEdge {
  readonly discriminator: "d2_provenance_edge";
  readonly relation: D2ProvenanceRelation;
  readonly source_ref: D2ExactRef;
  readonly target_ref: D2ExactRef;
}

export interface D2SourceEventScope {
  readonly course_id: string;
  readonly role_key: string;
  readonly run_id: string;
  readonly team_id: string;
}

export interface D2SourceEventDto {
  readonly created_at: string;
  readonly event_id: string;
  readonly event_type: D2EligibleEventType;
  readonly eligibility: "eligible";
  readonly source_event_ref: D2ExactRef;
  readonly scope: D2SourceEventScope;
}

export interface D2EvidenceQuery {
  readonly course_id: string;
  readonly run_id: string;
  readonly team_id: string;
  readonly role_key: string;
  readonly activity_id: string;
}

export interface D2EvidenceListDto {
  readonly artifacts: readonly D2EvidenceArtifactVersion[];
  readonly eligible_events: readonly D2SourceEventDto[];
  readonly known_limits: readonly string[];
  readonly provenance_edges: readonly D2ProvenanceEdge[];
  readonly runtime_authority: "JSON_INTERNAL_ONLY";
}

export interface D2EvidenceCaptureInput extends D2EvidenceQuery {
  readonly course_package_ref: D2ExactRef;
  readonly learning_goal_ref: D2ExactRef;
  readonly rubric_ref: D2ExactRef;
  readonly source_event_id: string;
}

export interface D2CaptureReceipt {
  readonly data: {
    readonly artifact: D2EvidenceArtifactVersion;
    readonly provenance_edges: readonly D2ProvenanceEdge[];
    readonly status: "generated" | "reused";
  };
  readonly formal_truth_write: false;
  readonly known_limits: readonly string[];
  readonly request_id: string;
  readonly schema_version: typeof D2_EVIDENCE_SCHEMA_VERSION;
}

const ID_PATTERN = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const RESERVED = /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isIdentity(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && ID_PATTERN.test(value) && !RESERVED.test(value);
}

function isVersion(value: unknown): value is string {
  return isIdentity(value) && !/(?:^|[._:-])[xX*](?:$|[._:-])/.test(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_PATTERN.test(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !TIMESTAMP_PATTERN.test(value)) return false;
  const parsed = new Date(value);
  const canonical = value.includes(".") ? value : `${value.slice(0, -1)}.000Z`;
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === canonical;
}

function refsMatch(left: D2ExactRef, right: D2ExactRef): boolean {
  return (
    left.content_digest === right.content_digest &&
    left.resource_id === right.resource_id &&
    left.resource_type === right.resource_type &&
    left.tenant_id === right.tenant_id &&
    left.version === right.version
  );
}

export function isD2ExactRef(value: unknown): value is D2ExactRef {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["content_digest", "discriminator", "resource_id", "resource_type", "tenant_id", "version"]) &&
    value.discriminator === "exact_ref" &&
    isDigest(value.content_digest) &&
    isIdentity(value.resource_id) &&
    isIdentity(value.tenant_id) &&
    isVersion(value.version) &&
    D2_REFERENCE_RESOURCE_TYPES.includes(value.resource_type as D2ReferenceResourceType)
  );
}

function isBoundedContext(value: unknown): value is D2BoundedContext {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["activity_id", "course_id", "role_key", "run_id", "team_id"]) &&
    [value.activity_id, value.course_id, value.role_key, value.run_id, value.team_id].every(isIdentity)
  );
}

export function isD2ProvenanceEdge(value: unknown): value is D2ProvenanceEdge {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["discriminator", "relation", "source_ref", "target_ref"]) &&
    value.discriminator === "d2_provenance_edge" &&
    D2_PROVENANCE_RELATIONS.includes(value.relation as D2ProvenanceRelation) &&
    isD2ExactRef(value.source_ref) &&
    isD2ExactRef(value.target_ref) &&
    value.source_ref.tenant_id === value.target_ref.tenant_id &&
    !refsMatch(value.source_ref, value.target_ref)
  );
}

export function isD2EvidenceArtifactVersion(value: unknown): value is D2EvidenceArtifactVersion {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "artifact_digest", "artifact_kind", "artifact_ref", "captured_at", "captured_by", "context",
      "course_package_ref", "discriminator", "idempotency_key", "known_limits", "learning_goal_ref",
      "rubric_ref", "schema_version", "source_event_ref", "transformation_rule_ref", "visibility"
    ]) ||
    value.discriminator !== "d2_evidence_artifact_version" ||
    value.schema_version !== D2_EVIDENCE_SCHEMA_VERSION ||
    value.artifact_kind !== "observation" ||
    value.visibility !== "teacher_only" ||
    !isD2ExactRef(value.artifact_ref) ||
    value.artifact_ref.resource_type !== "evidence_artifact" ||
    !isDigest(value.artifact_digest) ||
    value.artifact_digest !== value.artifact_ref.content_digest ||
    !isTimestamp(value.captured_at) ||
    !isIdentity(value.captured_by) ||
    !isBoundedContext(value.context) ||
    !isIdentity(value.idempotency_key) ||
    !Array.isArray(value.known_limits) ||
    value.known_limits.length === 0 ||
    value.known_limits.some((limit) => typeof limit !== "string" || limit.trim() !== limit || limit.length === 0) ||
    !isD2ExactRef(value.course_package_ref) ||
    value.course_package_ref.resource_type !== "course_package_version" ||
    !isD2ExactRef(value.learning_goal_ref) ||
    value.learning_goal_ref.resource_type !== "learning_goal_version" ||
    !isD2ExactRef(value.rubric_ref) ||
    value.rubric_ref.resource_type !== "rubric_version" ||
    !isD2ExactRef(value.source_event_ref) ||
    value.source_event_ref.resource_type !== "role_workflow_event" ||
    !isD2ExactRef(value.transformation_rule_ref) ||
    value.transformation_rule_ref.resource_type !== "transformation_rule"
  ) {
    return false;
  }
  const artifactRef = value.artifact_ref as D2ExactRef;
  const refs = [
    artifactRef,
    value.course_package_ref as D2ExactRef,
    value.learning_goal_ref as D2ExactRef,
    value.rubric_ref as D2ExactRef,
    value.source_event_ref as D2ExactRef,
    value.transformation_rule_ref as D2ExactRef
  ];
  return refs.every((ref) => ref.tenant_id === artifactRef.tenant_id);
}

export function isD2SourceEventDto(value: unknown): value is D2SourceEventDto {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["created_at", "event_id", "event_type", "eligibility", "source_event_ref", "scope"]) &&
    isTimestamp(value.created_at) &&
    isIdentity(value.event_id) &&
    D2_ELIGIBLE_EVENT_TYPES.includes(value.event_type as D2EligibleEventType) &&
    value.eligibility === "eligible" &&
    isD2ExactRef(value.source_event_ref) &&
    value.source_event_ref.resource_type === "role_workflow_event" &&
    isRecord(value.scope) &&
    hasOnlyKeys(value.scope, ["course_id", "role_key", "run_id", "team_id"]) &&
    [value.scope.course_id, value.scope.role_key, value.scope.run_id, value.scope.team_id].every(isIdentity)
  );
}

export function isD2CaptureReceipt(value: unknown): value is D2CaptureReceipt {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["data", "formal_truth_write", "known_limits", "request_id", "schema_version"]) ||
    value.formal_truth_write !== false ||
    value.schema_version !== D2_EVIDENCE_SCHEMA_VERSION ||
    !isIdentity(value.request_id) ||
    !Array.isArray(value.known_limits) ||
    value.known_limits.length === 0 ||
    !isRecord(value.data) ||
    !hasOnlyKeys(value.data, ["artifact", "provenance_edges", "status"]) ||
    !isD2EvidenceArtifactVersion(value.data.artifact) ||
    !Array.isArray(value.data.provenance_edges) ||
    value.data.provenance_edges.some((edge) => !isD2ProvenanceEdge(edge)) ||
    !["generated", "reused"].includes(value.data.status as string)
  ) {
    return false;
  }
  return value.known_limits.every((limit) => typeof limit === "string" && limit.trim() === limit && limit.length > 0);
}
