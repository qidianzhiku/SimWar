/**
 * Closed compatibility shapes for exchanging immutable references and their
 * provenance. Validators only classify caller-provided data: they do not
 * resolve bindings, persist events, or write truth, settlement, score, rank,
 * model, learning, course, or role-workflow authority.
 */
export type ExactRefResourceType =
  | "course_blueprint"
  | "instructor_artifact"
  | "model_artifact"
  | "evidence_artifact"
  | "decision_thread";

export interface ExactRef {
  readonly content_digest: string;
  readonly discriminator: "exact_ref";
  readonly resource_id: string;
  readonly resource_type: ExactRefResourceType;
  readonly tenant_id: string;
  readonly version: string;
}

export type CompatibilityMode = "reference_only" | "advisory_only" | "evidence_only";

export interface ModeBinding {
  readonly discriminator: "mode_binding";
  readonly mode: CompatibilityMode;
  readonly subject_ref: ExactRef;
}

export type EvidenceArtifactKind = "document" | "observation" | "model_output";

export interface EvidenceArtifact {
  readonly artifact_kind: EvidenceArtifactKind;
  readonly artifact_ref: ExactRef;
  readonly captured_at: string;
  readonly discriminator: "evidence_artifact";
  readonly mode_binding: ModeBinding;
}

export type ProvenanceRelation = "derived_from" | "supported_by" | "cites";

export interface ProvenanceEdge {
  readonly discriminator: "provenance_edge";
  readonly relation: ProvenanceRelation;
  readonly source_ref: ExactRef;
  readonly target_ref: ExactRef;
}

export interface DecisionThreadAlias {
  readonly alias: string;
  readonly discriminator: "decision_thread_alias";
  readonly target_ref: ExactRef;
}

export interface DecisionThreadRef {
  readonly aliases: readonly DecisionThreadAlias[];
  readonly discriminator: "decision_thread_ref";
  readonly thread_ref: ExactRef;
}

export type DomainEventType = "reference_recorded" | "evidence_linked" | "decision_thread_linked";

interface DomainEventEnvelopeBase {
  readonly discriminator: "domain_event_envelope";
  readonly event_id: string;
  readonly event_type: DomainEventType;
  readonly mode_binding: ModeBinding;
  readonly occurred_at: string;
  readonly provenance_edge: ProvenanceEdge;
  readonly subject_ref: ExactRef;
}

export interface ReferenceRecordedEventEnvelope extends DomainEventEnvelopeBase {
  readonly event_type: "reference_recorded";
}

export interface EvidenceLinkedEventEnvelope extends DomainEventEnvelopeBase {
  readonly event_type: "evidence_linked";
  readonly evidence_artifact: EvidenceArtifact;
}

export interface DecisionThreadLinkedEventEnvelope extends DomainEventEnvelopeBase {
  readonly decision_thread_ref: DecisionThreadRef;
  readonly event_type: "decision_thread_linked";
}

export type DomainEventEnvelope =
  | ReferenceRecordedEventEnvelope
  | EvidenceLinkedEventEnvelope
  | DecisionThreadLinkedEventEnvelope;

const EXACT_REF_RESOURCE_TYPES = new Set<ExactRefResourceType>([
  "course_blueprint",
  "instructor_artifact",
  "model_artifact",
  "evidence_artifact",
  "decision_thread"
]);
const COMPATIBILITY_MODES = new Set<CompatibilityMode>([
  "reference_only",
  "advisory_only",
  "evidence_only"
]);
const EVIDENCE_ARTIFACT_KINDS = new Set<EvidenceArtifactKind>([
  "document",
  "observation",
  "model_output"
]);
const PROVENANCE_RELATIONS = new Set<ProvenanceRelation>(["derived_from", "supported_by", "cites"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const valueKeys = Object.keys(value);
  return valueKeys.length === keys.length && valueKeys.every((key) => keys.includes(key));
}

function isNonBlank(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function isExactVersion(value: unknown): value is string {
  return (
    isNonBlank(value) &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) &&
    !["latest", "next"].includes(value.toLowerCase()) &&
    !/^\d+(?:\.(?:x|\*))+$/i.test(value)
  );
}

function isExactDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function exactRefsMatch(left: ExactRef, right: ExactRef): boolean {
  return (
    left.content_digest === right.content_digest &&
    left.resource_id === right.resource_id &&
    left.resource_type === right.resource_type &&
    left.tenant_id === right.tenant_id &&
    left.version === right.version
  );
}

export function isExactRef(value: unknown): value is ExactRef {
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
    isNonBlank(value.tenant_id) &&
    isNonBlank(value.resource_id) &&
    isExactVersion(value.version) &&
    EXACT_REF_RESOURCE_TYPES.has(value.resource_type as ExactRefResourceType) &&
    isExactDigest(value.content_digest)
  );
}

export function isModeBinding(value: unknown): value is ModeBinding {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["discriminator", "mode", "subject_ref"]) &&
    value.discriminator === "mode_binding" &&
    COMPATIBILITY_MODES.has(value.mode as CompatibilityMode) &&
    isExactRef(value.subject_ref)
  );
}

export function isEvidenceArtifact(value: unknown): value is EvidenceArtifact {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "artifact_kind",
      "artifact_ref",
      "captured_at",
      "discriminator",
      "mode_binding"
    ]) &&
    value.discriminator === "evidence_artifact" &&
    EVIDENCE_ARTIFACT_KINDS.has(value.artifact_kind as EvidenceArtifactKind) &&
    isExactRef(value.artifact_ref) &&
    value.artifact_ref.resource_type === "evidence_artifact" &&
    isTimestamp(value.captured_at) &&
    isModeBinding(value.mode_binding) &&
    exactRefsMatch(value.artifact_ref, value.mode_binding.subject_ref)
  );
}

export function isProvenanceEdge(value: unknown): value is ProvenanceEdge {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["discriminator", "relation", "source_ref", "target_ref"]) &&
    value.discriminator === "provenance_edge" &&
    PROVENANCE_RELATIONS.has(value.relation as ProvenanceRelation) &&
    isExactRef(value.source_ref) &&
    isExactRef(value.target_ref) &&
    !exactRefsMatch(value.source_ref, value.target_ref)
  );
}

export function isDecisionThreadRef(value: unknown): value is DecisionThreadRef {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["aliases", "discriminator", "thread_ref"]) ||
    value.discriminator !== "decision_thread_ref" ||
    !isExactRef(value.thread_ref) ||
    value.thread_ref.resource_type !== "decision_thread" ||
    !Array.isArray(value.aliases) ||
    value.aliases.length === 0
  ) {
    return false;
  }

  const threadRef = value.thread_ref;
  const aliases = new Set<string>();
  return value.aliases.every((alias) => {
    if (
      !isRecord(alias) ||
      !hasOnlyKeys(alias, ["alias", "discriminator", "target_ref"]) ||
      alias.discriminator !== "decision_thread_alias" ||
      !isNonBlank(alias.alias) ||
      aliases.has(alias.alias) ||
      !isExactRef(alias.target_ref) ||
      !exactRefsMatch(threadRef, alias.target_ref)
    ) {
      return false;
    }

    aliases.add(alias.alias);
    return true;
  });
}

export function isDomainEventEnvelope(value: unknown): value is DomainEventEnvelope {
  if (
    !isRecord(value) ||
    value.discriminator !== "domain_event_envelope" ||
    !isNonBlank(value.event_id) ||
    !isTimestamp(value.occurred_at) ||
    !isExactRef(value.subject_ref) ||
    !isModeBinding(value.mode_binding) ||
    !isProvenanceEdge(value.provenance_edge) ||
    !exactRefsMatch(value.subject_ref, value.mode_binding.subject_ref) ||
    !exactRefsMatch(value.subject_ref, value.provenance_edge.source_ref)
  ) {
    return false;
  }

  switch (value.event_type) {
    case "reference_recorded":
      return hasOnlyKeys(value, [
        "discriminator",
        "event_id",
        "event_type",
        "mode_binding",
        "occurred_at",
        "provenance_edge",
        "subject_ref"
      ]);
    case "evidence_linked":
      return (
        hasOnlyKeys(value, [
          "discriminator",
          "event_id",
          "event_type",
          "evidence_artifact",
          "mode_binding",
          "occurred_at",
          "provenance_edge",
          "subject_ref"
        ]) &&
        isEvidenceArtifact(value.evidence_artifact) &&
        exactRefsMatch(value.provenance_edge.target_ref, value.evidence_artifact.artifact_ref)
      );
    case "decision_thread_linked":
      return (
        hasOnlyKeys(value, [
          "decision_thread_ref",
          "discriminator",
          "event_id",
          "event_type",
          "mode_binding",
          "occurred_at",
          "provenance_edge",
          "subject_ref"
        ]) &&
        isDecisionThreadRef(value.decision_thread_ref) &&
        exactRefsMatch(value.provenance_edge.target_ref, value.decision_thread_ref.thread_ref)
      );
    default:
      return false;
  }
}
