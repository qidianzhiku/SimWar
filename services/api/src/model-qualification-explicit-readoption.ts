import { createHash } from "node:crypto";
import type {
  EvidenceAdoptionEpoch,
  EvidenceAdoptionRecord,
  EvidenceAdoptionReference,
  EvidenceAdoptionState,
  RequestEvidenceAdoption
} from "@simwar/shared-contracts";

const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const RESERVED_SELECTOR_PATTERN =
  /(?:^|[._:-])(?:any|current|default|fallback|first|last|latest|newest|next|unresolved)(?:$|[._:-])/iu;
const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/u;

const EPOCH_BODY_KEYS = [
  "tenant_id",
  "course_id",
  "source_package_id",
  "source_content_digest",
  "calibration_dataset_id",
  "calibration_dataset_content_digest",
  "qualification_id",
  "qualification_content_digest",
  "model_version_reference",
  "model_artifact_reference",
  "source_expires_at"
] as const;
const EPOCH_KEYS = [...EPOCH_BODY_KEYS, "epoch_digest"] as const;
const MODEL_VERSION_KEYS = ["content_digest", "model_version_id", "version"] as const;
const MODEL_ARTIFACT_KEYS = ["artifact_id", "content_digest", "format", "source_ref"] as const;
const REFERENCE_KEYS = ["adoption_id", "adoption_digest"] as const;
const RECORD_KEYS = [
  "adoption_id",
  "adoption_digest",
  "proposal_id",
  "proposal_digest",
  "review_id",
  "review_digest",
  "epoch",
  "predecessor",
  "disposition",
  "expires_at",
  "note",
  "decided_by",
  "decided_at",
  "official_truth_write",
  "provider"
] as const;
const SELECTION_KEYS = [
  "adoption_id",
  "adoption_digest",
  "model_version_reference",
  "model_artifact_reference"
] as const;

/** Stable failure vocabulary for callers that need a typed fail-closed branch. */
export const EXPLICIT_READOPTION_ERROR_CODES = {
  INPUT_INVALID: "READOPTION_INPUT_INVALID",
  STATE_INVALID: "READOPTION_STATE_INVALID",
  SCOPE_CONFLICT: "READOPTION_SCOPE_CONFLICT",
  CURRENT_ADOPTION_REQUIRED: "CURRENT_ADOPTION_REQUIRED",
  CURRENT_ADOPTION_NOT_FOUND: "CURRENT_ADOPTION_NOT_FOUND",
  CURRENT_ADOPTION_DIGEST_MISMATCH: "CURRENT_ADOPTION_DIGEST_MISMATCH",
  CURRENT_ADOPTION_NOT_ACTIVE: "CURRENT_ADOPTION_NOT_ACTIVE",
  CURRENT_ADOPTION_MOVED: "CURRENT_ADOPTION_MOVED",
  TARGET_ADOPTION_REQUIRED: "TARGET_ADOPTION_REQUIRED",
  TARGET_ADOPTION_NOT_FOUND: "TARGET_ADOPTION_NOT_FOUND",
  TARGET_ADOPTION_DIGEST_MISMATCH: "TARGET_ADOPTION_DIGEST_MISMATCH",
  TARGET_EPOCH_MISMATCH: "TARGET_EPOCH_MISMATCH",
  TARGET_EPOCH_DIGEST_MISMATCH: "TARGET_EPOCH_DIGEST_MISMATCH",
  TARGET_NOT_HISTORICALLY_ADOPTED: "TARGET_NOT_HISTORICALLY_ADOPTED",
  TARGET_NOT_IMMEDIATE_PREDECESSOR: "TARGET_NOT_IMMEDIATE_PREDECESSOR",
  TARGET_IS_CURRENT: "TARGET_IS_CURRENT",
  TARGET_NOT_HISTORICAL: "TARGET_NOT_HISTORICAL",
  AMBIGUOUS_HISTORY: "AMBIGUOUS_HISTORY",
  ROLLBACK_REQUEST_REQUIRED: "ROLLBACK_REQUEST_REQUIRED",
  ROLLBACK_BASIS_INVALID: "ROLLBACK_BASIS_INVALID",
  ROLLBACK_BASIS_SCOPE_CONFLICT: "ROLLBACK_BASIS_SCOPE_CONFLICT",
  ROLLBACK_BASIS_CURRENT_CONFLICT: "ROLLBACK_BASIS_CURRENT_CONFLICT",
  ROLLBACK_BASIS_TARGET_CONFLICT: "ROLLBACK_BASIS_TARGET_CONFLICT",
  ROLLBACK_BASIS_DIGEST_CONFLICT: "ROLLBACK_BASIS_DIGEST_CONFLICT",
  LINKED_PROPOSAL_REQUIRED: "LINKED_PROPOSAL_REQUIRED",
  LINKED_PROPOSAL_CONFLICT: "LINKED_PROPOSAL_CONFLICT",
  READOPTION_IDENTITY_CONFLICT: "READOPTION_IDENTITY_CONFLICT"
} as const;

export type ExplicitReadoptionErrorCode =
  (typeof EXPLICIT_READOPTION_ERROR_CODES)[keyof typeof EXPLICIT_READOPTION_ERROR_CODES];

export class ExplicitReadoptionError extends Error {
  readonly code: ExplicitReadoptionErrorCode;

  constructor(code: ExplicitReadoptionErrorCode) {
    super(code);
    this.name = "ExplicitReadoptionError";
    this.code = code;
  }
}

/** A target is explicit even when its adoption reference is intentionally absent for a new epoch. */
export interface ExplicitReadoptionTarget {
  readonly epoch: EvidenceAdoptionEpoch;
  readonly adoption: EvidenceAdoptionReference | null;
}

/**
 * Structural input keeps the leaf independent of the not-yet-present A1 type.
 * `state`, `current`, and the top-level target fields are compatibility aliases
 * for the integrator; callers should prefer the `adoption_state`,
 * `current_adoption`, and `target` forms.
 */
export interface ExplicitReadoptionClassificationInput {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly adoption_state?: EvidenceAdoptionState;
  readonly state?: EvidenceAdoptionState;
  readonly current_adoption?: EvidenceAdoptionReference;
  readonly current?: EvidenceAdoptionReference;
  readonly target?: ExplicitReadoptionTarget;
  readonly target_epoch?: EvidenceAdoptionEpoch;
  readonly target_adoption?: EvidenceAdoptionReference | null;
  readonly target_reference?: EvidenceAdoptionReference | null;
}

export interface ExplicitReadoptionLinkedProposalIdentity {
  readonly proposal_id: string;
  readonly proposal_digest: string;
  readonly expected_adoption?: EvidenceAdoptionReference;
  readonly epoch?: EvidenceAdoptionEpoch;
}

/**
 * The basis is intentionally structural. A1 may expose `predecessor_adoption`
 * and `request_id`, while the canonical names below make the A/B binding clear.
 */
export interface ExplicitReadoptionRollbackBasis {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly current_adoption?: EvidenceAdoptionReference;
  readonly current?: EvidenceAdoptionReference;
  readonly target_adoption?: EvidenceAdoptionReference;
  readonly predecessor_adoption?: EvidenceAdoptionReference;
  readonly target?: EvidenceAdoptionReference;
  readonly request_id?: string;
  readonly rollback_request_id?: string;
  readonly request_digest?: string;
  readonly rollback_request_digest?: string;
  readonly linked_proposal_id?: string;
  readonly linked_proposal_digest?: string;
  readonly linked_proposal?: ExplicitReadoptionLinkedProposalIdentity;
  readonly proposal_id?: string;
  readonly proposal_digest?: string;
  readonly rollback_request?: Record<string, unknown>;
  readonly governed_rollback_request?: Record<string, unknown>;
}

export interface ExplicitReadoptionPredictionInput extends ExplicitReadoptionClassificationInput {
  readonly rollback_basis?: ExplicitReadoptionRollbackBasis | null;
  readonly rollback_request?: ExplicitReadoptionRollbackBasis | null;
  readonly governed_rollback_request?: ExplicitReadoptionRollbackBasis | null;
}

export type ExplicitReadoptionTargetClassification =
  | "ORDINARY_NEW_EVIDENCE"
  | "HISTORICAL_ADOPTED_LINEAGE";

export interface ExplicitReadoptionClassification {
  readonly classification: ExplicitReadoptionTargetClassification;
  readonly target_classification: ExplicitReadoptionTargetClassification;
  readonly kind: ExplicitReadoptionTargetClassification;
  readonly historical_lineage: boolean;
  readonly requires_rollback_request: boolean;
  readonly standard_o5_request_allowed: boolean;
  readonly immediate_predecessor: boolean;
  readonly current_adoption: EvidenceAdoptionReference;
  readonly target_adoption: EvidenceAdoptionReference | null;
  readonly target_epoch: EvidenceAdoptionEpoch;
}

export interface ExplicitReadoptionPredictedAdoption {
  readonly adoption_id: string;
  readonly adoption_digest: string;
  readonly predecessor: EvidenceAdoptionReference;
  readonly epoch: EvidenceAdoptionEpoch;
  readonly disposition: "ADOPTED_FOR_FUTURE_ADMISSION";
}

export interface ExplicitReadoptionPrediction {
  readonly status: "READY_WITH_LIMITS";
  readonly classification: "HISTORICAL_ADOPTED_LINEAGE";
  readonly target_classification: "HISTORICAL_ADOPTED_LINEAGE";
  readonly current_adoption: EvidenceAdoptionReference;
  readonly target_adoption: EvidenceAdoptionReference;
  readonly target_epoch: EvidenceAdoptionEpoch;
  readonly proposal_input: Pick<RequestEvidenceAdoption, "epoch" | "expected_adoption">;
  readonly linked_o5_proposal_input: Pick<
    RequestEvidenceAdoption,
    "epoch" | "expected_adoption"
  >;
  readonly predicted_adoption: ExplicitReadoptionPredictedAdoption;
  readonly future_run: {
    readonly adoption: EvidenceAdoptionReference;
    readonly uses_predicted_adoption: true;
  };
  readonly historical_records: {
    readonly adoption_a: EvidenceAdoptionReference;
    readonly adoption_b: EvidenceAdoptionReference;
    readonly remain_immutable: true;
  };
  readonly request_changes_current_selection: false;
  readonly rollback_applied: false;
  readonly automatic_rollback: false;
  readonly formal_rollback: false;
  readonly adoption_mutation: false;
  readonly official_truth_write: false;
  readonly history_deleted: false;
  readonly historical_receipt_rewritten: false;
  readonly review_performed: false;
  readonly disposition_performed: false;
  readonly writer_called: false;
  readonly store_called: false;
  readonly registry_called: false;
  readonly provider: "OFF";
  readonly advisory_only: true;
  readonly known_limits: readonly string[];
}

interface StateIndex {
  readonly state: EvidenceAdoptionState;
  readonly recordsById: ReadonlyMap<string, EvidenceAdoptionRecord>;
}

interface NormalizedClassificationInput {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly adoption_state: EvidenceAdoptionState;
  readonly current_adoption: EvidenceAdoptionReference;
  readonly target: ExplicitReadoptionTarget;
}

interface NormalizedRollbackBasis {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly current_adoption: EvidenceAdoptionReference;
  readonly target_adoption: EvidenceAdoptionReference;
  readonly request_id: string;
  readonly request_digest: string;
  readonly linked_proposal_id: string;
  readonly linked_proposal_digest: string;
  readonly linked_proposal: ExplicitReadoptionLinkedProposalIdentity | null;
}

function fail(code: ExplicitReadoptionErrorCode): never {
  throw new ExplicitReadoptionError(code);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isPlainRecord(value) || Object.getOwnPropertySymbols(value).length !== 0) return false;
  const expected = new Set(keys);
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => expected.has(key));
}

function isExactIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    IDENTIFIER_PATTERN.test(value) &&
    !RESERVED_SELECTOR_PATTERN.test(value)
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_PATTERN.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = value.match(ISO_TIMESTAMP_PATTERN);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = match[7] ? Number(match[7]) : 0;
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  const parsed = new Date(value);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day &&
    parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute &&
    parsed.getUTCSeconds() === second &&
    parsed.getUTCMilliseconds() === millisecond
  );
}

function canonical(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(EXPLICIT_READOPTION_ERROR_CODES.INPUT_INVALID);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  if (!isPlainRecord(value)) fail(EXPLICIT_READOPTION_ERROR_CODES.INPUT_INVALID);
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function immutableClone<T>(value: T): T {
  return deepFreeze(clone(value));
}

function withoutKey(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function sameReference(
  left: EvidenceAdoptionReference | null | undefined,
  right: EvidenceAdoptionReference | null | undefined
): boolean {
  return (
    left !== null &&
    left !== undefined &&
    right !== null &&
    right !== undefined &&
    left.adoption_id === right.adoption_id &&
    left.adoption_digest === right.adoption_digest
  );
}

function sameModelVersion(
  left: EvidenceAdoptionEpoch["model_version_reference"],
  right: EvidenceAdoptionEpoch["model_version_reference"]
): boolean {
  return (
    left.model_version_id === right.model_version_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameModelArtifact(
  left: EvidenceAdoptionEpoch["model_artifact_reference"],
  right: EvidenceAdoptionEpoch["model_artifact_reference"]
): boolean {
  return (
    left.artifact_id === right.artifact_id &&
    left.content_digest === right.content_digest &&
    left.format === right.format &&
    left.source_ref === right.source_ref
  );
}

function sameEpoch(left: EvidenceAdoptionEpoch, right: EvidenceAdoptionEpoch): boolean {
  return canonical(left) === canonical(right);
}

function validateModelVersion(value: unknown, code: ExplicitReadoptionErrorCode): void {
  if (
    !hasExactKeys(value, MODEL_VERSION_KEYS) ||
    !isDigest(value.content_digest) ||
    !isExactIdentifier(value.model_version_id) ||
    !isExactIdentifier(value.version) ||
    /[\\^~*?]/u.test(value.version)
  ) {
    fail(code);
  }
}

function validateModelArtifact(value: unknown, code: ExplicitReadoptionErrorCode): void {
  if (
    !hasExactKeys(value, MODEL_ARTIFACT_KEYS) ||
    !isExactIdentifier(value.artifact_id) ||
    !isDigest(value.content_digest) ||
    typeof value.format !== "string" ||
    value.format.trim().length === 0 ||
    typeof value.source_ref !== "string" ||
    value.source_ref.trim().length === 0
  ) {
    fail(code);
  }
}

function validateReference(
  value: unknown,
  code: ExplicitReadoptionErrorCode
): value is EvidenceAdoptionReference {
  if (
    !hasExactKeys(value, REFERENCE_KEYS) ||
    !isExactIdentifier(value.adoption_id) ||
    !isDigest(value.adoption_digest)
  ) {
    fail(code);
  }
  return true;
}

function optionalCandidate<T>(value: T | undefined): { readonly present: boolean; readonly value: T } {
  return { present: value !== undefined, value: value as T };
}

function validateEpoch(
  value: unknown,
  code: ExplicitReadoptionErrorCode,
  digestCode: ExplicitReadoptionErrorCode
): EvidenceAdoptionEpoch {
  if (
    !hasExactKeys(value, EPOCH_KEYS) ||
    !isExactIdentifier(value.tenant_id) ||
    !isExactIdentifier(value.course_id) ||
    !isExactIdentifier(value.source_package_id) ||
    !isDigest(value.source_content_digest) ||
    !isExactIdentifier(value.calibration_dataset_id) ||
    !isDigest(value.calibration_dataset_content_digest) ||
    !isExactIdentifier(value.qualification_id) ||
    !isDigest(value.qualification_content_digest) ||
    (value.source_expires_at !== null && !isIsoTimestamp(value.source_expires_at)) ||
    !isDigest(value.epoch_digest)
  ) {
    fail(code);
  }
  validateModelVersion(value.model_version_reference, code);
  validateModelArtifact(value.model_artifact_reference, code);
  if (digest(valueWithoutEpochDigest(value)) !== value.epoch_digest) fail(digestCode);
  return value as unknown as EvidenceAdoptionEpoch;
}

function valueWithoutEpochDigest(value: Record<string, unknown>): Record<string, unknown> {
  return withoutKey(value, "epoch_digest");
}

function validateRecord(value: unknown): EvidenceAdoptionRecord {
  if (
    !hasExactKeys(value, RECORD_KEYS) ||
    !isExactIdentifier(value.adoption_id) ||
    !isDigest(value.adoption_digest) ||
    !isExactIdentifier(value.proposal_id) ||
    !isDigest(value.proposal_digest) ||
    !isExactIdentifier(value.review_id) ||
    !isDigest(value.review_digest) ||
    (value.disposition !== "ADOPTED_FOR_FUTURE_ADMISSION" &&
      value.disposition !== "DEFERRED_WITH_EXPIRY" &&
      value.disposition !== "REJECTED_CANDIDATE" &&
      value.disposition !== "REBASE_REQUIRED") ||
    (value.expires_at !== null && !isIsoTimestamp(value.expires_at)) ||
    typeof value.note !== "string" ||
    value.note.trim().length === 0 ||
    !isExactIdentifier(value.decided_by) ||
    !isIsoTimestamp(value.decided_at) ||
    value.official_truth_write !== false ||
    value.provider !== "OFF"
  ) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.STATE_INVALID);
  }
  const epoch = validateEpoch(
    value.epoch,
    EXPLICIT_READOPTION_ERROR_CODES.STATE_INVALID,
    EXPLICIT_READOPTION_ERROR_CODES.STATE_INVALID
  );
  if (value.predecessor !== null) validateReference(value.predecessor, EXPLICIT_READOPTION_ERROR_CODES.STATE_INVALID);
  const record = value as unknown as EvidenceAdoptionRecord;
  if (digest(withoutKey(value, "adoption_digest")) !== record.adoption_digest) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.STATE_INVALID);
  }
  return { ...record, epoch };
}

function validateSelection(value: unknown): void {
  if (
    !hasExactKeys(value, SELECTION_KEYS) ||
    !isExactIdentifier(value.adoption_id) ||
    !isDigest(value.adoption_digest)
  ) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.STATE_INVALID);
  }
  validateModelVersion(value.model_version_reference, EXPLICIT_READOPTION_ERROR_CODES.STATE_INVALID);
  validateModelArtifact(value.model_artifact_reference, EXPLICIT_READOPTION_ERROR_CODES.STATE_INVALID);
}

function validateState(value: unknown): StateIndex {
  if (
    !hasExactKeys(value, ["tenant_id", "course_id", "proposals", "reviews", "records", "selections", "commands"]) ||
    !isExactIdentifier((value as Record<string, unknown>).tenant_id) ||
    !isExactIdentifier((value as Record<string, unknown>).course_id)
  ) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.STATE_INVALID);
  }
  const state = value as unknown as EvidenceAdoptionState;
  if (
    !Array.isArray(state.proposals) ||
    !Array.isArray(state.reviews) ||
    !Array.isArray(state.records) ||
    !Array.isArray(state.selections) ||
    !Array.isArray(state.commands)
  ) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.STATE_INVALID);
  }

  const recordsById = new Map<string, EvidenceAdoptionRecord>();
  for (const rawRecord of state.records) {
    const record = validateRecord(rawRecord);
    if (record.epoch.tenant_id !== state.tenant_id || record.epoch.course_id !== state.course_id) {
      fail(EXPLICIT_READOPTION_ERROR_CODES.SCOPE_CONFLICT);
    }
    if (recordsById.has(record.adoption_id)) fail(EXPLICIT_READOPTION_ERROR_CODES.AMBIGUOUS_HISTORY);
    recordsById.set(record.adoption_id, record);
  }

  for (const record of recordsById.values()) {
    if (record.predecessor === null) continue;
    const predecessor = recordsById.get(record.predecessor.adoption_id);
    if (
      !predecessor ||
      !sameReference(predecessor, record.predecessor) ||
      predecessor.disposition !== "ADOPTED_FOR_FUTURE_ADMISSION" ||
      !sameModelVersion(predecessor.epoch.model_version_reference, record.epoch.model_version_reference) ||
      !sameModelArtifact(predecessor.epoch.model_artifact_reference, record.epoch.model_artifact_reference) ||
      predecessor.adoption_id === record.adoption_id
    ) {
      fail(EXPLICIT_READOPTION_ERROR_CODES.STATE_INVALID);
    }
  }

  const selectionScopes = new Set<string>();
  for (const rawSelection of state.selections) {
    validateSelection(rawSelection);
    const selection = rawSelection as EvidenceAdoptionState["selections"][number];
    const record = recordsById.get(selection.adoption_id);
    if (
      !record ||
      record.disposition !== "ADOPTED_FOR_FUTURE_ADMISSION" ||
      !sameReference(record, selection) ||
      !sameModelVersion(record.epoch.model_version_reference, selection.model_version_reference) ||
      !sameModelArtifact(record.epoch.model_artifact_reference, selection.model_artifact_reference)
    ) {
      fail(EXPLICIT_READOPTION_ERROR_CODES.STATE_INVALID);
    }
    const scope = canonical({
      model_artifact_reference: selection.model_artifact_reference,
      model_version_reference: selection.model_version_reference
    });
    if (selectionScopes.has(scope)) fail(EXPLICIT_READOPTION_ERROR_CODES.AMBIGUOUS_HISTORY);
    selectionScopes.add(scope);
  }
  return { recordsById, state };
}

function equalOrFail<T>(
  values: readonly { readonly present: boolean; readonly value: T }[],
  conflictCode: ExplicitReadoptionErrorCode,
  missingCode: ExplicitReadoptionErrorCode
): T {
  const present = values.filter((candidate) => candidate.present);
  if (present.length === 0) fail(missingCode);
  const first = present[0]!;
  for (const candidate of present.slice(1)) {
    if (canonical(candidate.value) !== canonical(first.value)) fail(conflictCode);
  }
  return first.value;
}

function normalizeInput(input: ExplicitReadoptionClassificationInput): NormalizedClassificationInput {
  if (!isPlainRecord(input)) fail(EXPLICIT_READOPTION_ERROR_CODES.INPUT_INVALID);
  if (!isExactIdentifier(input.tenant_id) || !isExactIdentifier(input.course_id)) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.INPUT_INVALID);
  }
  const state = equalOrFail(
    [
      { present: input.adoption_state !== undefined, value: input.adoption_state },
      { present: input.state !== undefined, value: input.state }
    ],
    EXPLICIT_READOPTION_ERROR_CODES.INPUT_INVALID,
    EXPLICIT_READOPTION_ERROR_CODES.INPUT_INVALID
  );
  const current = equalOrFail(
    [
      { present: input.current_adoption !== undefined, value: input.current_adoption },
      { present: input.current !== undefined, value: input.current }
    ],
    EXPLICIT_READOPTION_ERROR_CODES.INPUT_INVALID,
    EXPLICIT_READOPTION_ERROR_CODES.CURRENT_ADOPTION_REQUIRED
  );
  validateReference(current, EXPLICIT_READOPTION_ERROR_CODES.INPUT_INVALID);

  const targetEpoch = equalOrFail(
    [
      { present: input.target?.epoch !== undefined, value: input.target?.epoch },
      { present: input.target_epoch !== undefined, value: input.target_epoch }
    ],
    EXPLICIT_READOPTION_ERROR_CODES.INPUT_INVALID,
    EXPLICIT_READOPTION_ERROR_CODES.INPUT_INVALID
  );
  const targetAdoption = equalOrFail(
    [
      { present: input.target !== undefined && input.target.adoption !== undefined, value: input.target?.adoption },
      { present: input.target_adoption !== undefined, value: input.target_adoption },
      { present: input.target_reference !== undefined, value: input.target_reference }
    ],
    EXPLICIT_READOPTION_ERROR_CODES.INPUT_INVALID,
    EXPLICIT_READOPTION_ERROR_CODES.INPUT_INVALID
  );
  const validatedState = validateState(state);
  if (validatedState.state.tenant_id !== input.tenant_id || validatedState.state.course_id !== input.course_id) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.SCOPE_CONFLICT);
  }
  const epoch = validateEpoch(
    targetEpoch,
    EXPLICIT_READOPTION_ERROR_CODES.INPUT_INVALID,
    EXPLICIT_READOPTION_ERROR_CODES.TARGET_EPOCH_DIGEST_MISMATCH
  );
  if (epoch.tenant_id !== input.tenant_id || epoch.course_id !== input.course_id) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.SCOPE_CONFLICT);
  }
  if (targetAdoption !== null && targetAdoption !== undefined) {
    validateReference(targetAdoption, EXPLICIT_READOPTION_ERROR_CODES.INPUT_INVALID);
  }
  return {
    adoption_state: validatedState.state,
    course_id: input.course_id,
    current_adoption: current,
    target: { adoption: targetAdoption ?? null, epoch },
    tenant_id: input.tenant_id
  };
}

function currentRecordFor(
  index: StateIndex,
  current: EvidenceAdoptionReference
): EvidenceAdoptionRecord {
  const record = index.recordsById.get(current.adoption_id);
  if (!record) fail(EXPLICIT_READOPTION_ERROR_CODES.CURRENT_ADOPTION_NOT_FOUND);
  if (record.adoption_digest !== current.adoption_digest) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.CURRENT_ADOPTION_DIGEST_MISMATCH);
  }
  if (record.disposition !== "ADOPTED_FOR_FUTURE_ADMISSION") {
    fail(EXPLICIT_READOPTION_ERROR_CODES.CURRENT_ADOPTION_NOT_ACTIVE);
  }
  const selections = index.state.selections.filter(
    (selection) =>
      sameModelVersion(selection.model_version_reference, record.epoch.model_version_reference) &&
      sameModelArtifact(selection.model_artifact_reference, record.epoch.model_artifact_reference)
  );
  if (selections.length !== 1) fail(EXPLICIT_READOPTION_ERROR_CODES.AMBIGUOUS_HISTORY);
  if (!sameReference(selections[0], current)) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.CURRENT_ADOPTION_MOVED);
  }
  return record;
}

function targetRecordFor(
  index: StateIndex,
  target: ExplicitReadoptionTarget
): EvidenceAdoptionRecord | undefined {
  if (target.adoption !== null) {
    const record = index.recordsById.get(target.adoption.adoption_id);
    if (!record) fail(EXPLICIT_READOPTION_ERROR_CODES.TARGET_ADOPTION_NOT_FOUND);
    if (record.adoption_digest !== target.adoption.adoption_digest) {
      fail(EXPLICIT_READOPTION_ERROR_CODES.TARGET_ADOPTION_DIGEST_MISMATCH);
    }
    if (!sameEpoch(record.epoch, target.epoch)) {
      fail(EXPLICIT_READOPTION_ERROR_CODES.TARGET_EPOCH_MISMATCH);
    }
    return record;
  }
  const matches = [...index.recordsById.values()].filter((record) => sameEpoch(record.epoch, target.epoch));
  if (matches.length > 1) fail(EXPLICIT_READOPTION_ERROR_CODES.AMBIGUOUS_HISTORY);
  return matches[0];
}

/**
 * Classify an exact target without selecting a historical record implicitly.
 * A target epoch not retained as an adopted record remains an ordinary O5
 * candidate; a retained adopted epoch is explicitly marked as governed lineage.
 */
export function classifyExplicitReadoptionTarget(
  input: ExplicitReadoptionClassificationInput
): ExplicitReadoptionClassification {
  const normalized = normalizeInput(input);
  const index = validateState(normalized.adoption_state);
  const currentRecord = currentRecordFor(index, normalized.current_adoption);
  const targetRecord = targetRecordFor(index, normalized.target);
  if (!targetRecord) {
    return immutableClone({
      classification: "ORDINARY_NEW_EVIDENCE" as const,
      current_adoption: normalized.current_adoption,
      historical_lineage: false,
      immediate_predecessor: false,
      kind: "ORDINARY_NEW_EVIDENCE" as const,
      requires_rollback_request: false,
      standard_o5_request_allowed: true,
      target_adoption: null,
      target_classification: "ORDINARY_NEW_EVIDENCE" as const,
      target_epoch: normalized.target.epoch
    });
  }
  if (targetRecord.disposition !== "ADOPTED_FOR_FUTURE_ADMISSION") {
    fail(EXPLICIT_READOPTION_ERROR_CODES.TARGET_NOT_HISTORICALLY_ADOPTED);
  }
  const targetReference = {
    adoption_digest: targetRecord.adoption_digest,
    adoption_id: targetRecord.adoption_id
  } satisfies EvidenceAdoptionReference;
  const immediate = sameReference(currentRecord.predecessor, targetReference);
  return immutableClone({
    classification: "HISTORICAL_ADOPTED_LINEAGE" as const,
    current_adoption: normalized.current_adoption,
    historical_lineage: true,
    immediate_predecessor: immediate,
    kind: "HISTORICAL_ADOPTED_LINEAGE" as const,
    requires_rollback_request: true,
    standard_o5_request_allowed: false,
    target_adoption: targetReference,
    target_classification: "HISTORICAL_ADOPTED_LINEAGE" as const,
    target_epoch: targetRecord.epoch
  });
}

function normalizeBasis(value: ExplicitReadoptionRollbackBasis): NormalizedRollbackBasis {
  if (!isPlainRecord(value)) fail(EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_INVALID);
  if (!isExactIdentifier(value.tenant_id) || !isExactIdentifier(value.course_id)) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_INVALID);
  }

  const nestedRequest =
    isPlainRecord(value.rollback_request) && value.rollback_request !== null
      ? value.rollback_request
      : isPlainRecord(value.governed_rollback_request) && value.governed_rollback_request !== null
        ? value.governed_rollback_request
        : undefined;
  const linkedProposal =
    isPlainRecord(value.linked_proposal) && value.linked_proposal !== null
      ? value.linked_proposal
      : isPlainRecord(nestedRequest?.linked_proposal) && nestedRequest?.linked_proposal !== null
        ? nestedRequest.linked_proposal
        : undefined;

  const current = equalOrFail<EvidenceAdoptionReference>(
    [
      optionalCandidate(value.current_adoption as EvidenceAdoptionReference | undefined),
      optionalCandidate(value.current as EvidenceAdoptionReference | undefined),
      optionalCandidate(nestedRequest?.current_adoption as EvidenceAdoptionReference | undefined),
      optionalCandidate(nestedRequest?.current as EvidenceAdoptionReference | undefined)
    ],
    EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_CURRENT_CONFLICT,
    EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_INVALID
  );
  const target = equalOrFail<EvidenceAdoptionReference>(
    [
      optionalCandidate(value.target_adoption as EvidenceAdoptionReference | undefined),
      optionalCandidate(value.predecessor_adoption as EvidenceAdoptionReference | undefined),
      optionalCandidate(value.target as EvidenceAdoptionReference | undefined),
      optionalCandidate(nestedRequest?.target_adoption as EvidenceAdoptionReference | undefined),
      optionalCandidate(nestedRequest?.predecessor_adoption as EvidenceAdoptionReference | undefined)
    ],
    EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_TARGET_CONFLICT,
    EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_INVALID
  );
  validateReference(current, EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_INVALID);
  validateReference(target, EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_INVALID);

  const requestId = equalOrFail<string>(
    [
      optionalCandidate(value.rollback_request_id as string | undefined),
      optionalCandidate(value.request_id as string | undefined),
      optionalCandidate(nestedRequest?.rollback_request_id as string | undefined),
      optionalCandidate(nestedRequest?.request_id as string | undefined)
    ],
    EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_DIGEST_CONFLICT,
    EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_INVALID
  );
  const requestDigest = equalOrFail<string>(
    [
      optionalCandidate(value.rollback_request_digest as string | undefined),
      optionalCandidate(value.request_digest as string | undefined),
      optionalCandidate(nestedRequest?.rollback_request_digest as string | undefined),
      optionalCandidate(nestedRequest?.request_digest as string | undefined)
    ],
    EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_DIGEST_CONFLICT,
    EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_INVALID
  );
  if (!isExactIdentifier(requestId) || !isDigest(requestDigest)) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_INVALID);
  }

  const proposalId = equalOrFail<string>(
    [
      optionalCandidate(value.linked_proposal_id as string | undefined),
      optionalCandidate(value.proposal_id as string | undefined),
      optionalCandidate(linkedProposal?.proposal_id as string | undefined),
      optionalCandidate(linkedProposal?.linked_proposal_id as string | undefined)
    ],
    EXPLICIT_READOPTION_ERROR_CODES.LINKED_PROPOSAL_CONFLICT,
    EXPLICIT_READOPTION_ERROR_CODES.LINKED_PROPOSAL_REQUIRED
  );
  const proposalDigest = equalOrFail<string>(
    [
      optionalCandidate(value.linked_proposal_digest as string | undefined),
      optionalCandidate(value.proposal_digest as string | undefined),
      optionalCandidate(linkedProposal?.proposal_digest as string | undefined),
      optionalCandidate(linkedProposal?.linked_proposal_digest as string | undefined)
    ],
    EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_DIGEST_CONFLICT,
    EXPLICIT_READOPTION_ERROR_CODES.LINKED_PROPOSAL_REQUIRED
  );
  if (!isExactIdentifier(proposalId) || !isDigest(proposalDigest)) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.LINKED_PROPOSAL_REQUIRED);
  }
  if (
    value.tenant_id !== (nestedRequest?.tenant_id ?? value.tenant_id) ||
    value.course_id !== (nestedRequest?.course_id ?? value.course_id)
  ) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_SCOPE_CONFLICT);
  }
  let linkedProposalIdentity: ExplicitReadoptionLinkedProposalIdentity | null = null;
  if (linkedProposal) {
    let expectedAdoption: EvidenceAdoptionReference | undefined;
    if (linkedProposal.expected_adoption !== undefined) {
      if (!validateReference(linkedProposal.expected_adoption, EXPLICIT_READOPTION_ERROR_CODES.LINKED_PROPOSAL_CONFLICT)) {
        fail(EXPLICIT_READOPTION_ERROR_CODES.LINKED_PROPOSAL_CONFLICT);
      }
      expectedAdoption = linkedProposal.expected_adoption;
    }
    if (expectedAdoption !== undefined && !sameReference(expectedAdoption, current)) {
      fail(EXPLICIT_READOPTION_ERROR_CODES.LINKED_PROPOSAL_CONFLICT);
    }
    linkedProposalIdentity = {
      proposal_digest: proposalDigest,
      proposal_id: proposalId,
      ...(expectedAdoption !== undefined ? { expected_adoption: expectedAdoption } : {}),
      ...(linkedProposal.epoch !== undefined ? { epoch: linkedProposal.epoch as EvidenceAdoptionEpoch } : {})
    };
  }
  return {
    course_id: value.course_id,
    current_adoption: current,
    linked_proposal: linkedProposalIdentity,
    linked_proposal_digest: proposalDigest,
    linked_proposal_id: proposalId,
    request_digest: requestDigest,
    request_id: requestId,
    target_adoption: target,
    tenant_id: value.tenant_id
  };
}

function rollbackBasisFor(input: ExplicitReadoptionPredictionInput): ExplicitReadoptionRollbackBasis | null {
  const candidates = [input.rollback_basis, input.rollback_request, input.governed_rollback_request].filter(
    (candidate): candidate is ExplicitReadoptionRollbackBasis | null => candidate !== undefined
  );
  if (candidates.length === 0 || candidates[0] === null) return null;
  const first = candidates[0]!;
  for (const candidate of candidates.slice(1)) {
    if (candidate === null || canonical(candidate) !== canonical(first)) {
      fail(EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_DIGEST_CONFLICT);
    }
  }
  return first;
}

/**
 * Validate the exact O7 bridge and predict C. This function only returns
 * immutable candidate data; it never reviews, disposes, writes, or changes a
 * selection/history record.
 */
export function predictExplicitReadoption(
  input: ExplicitReadoptionPredictionInput
): ExplicitReadoptionPrediction {
  const classification = classifyExplicitReadoptionTarget(input);
  if (classification.classification === "ORDINARY_NEW_EVIDENCE") {
    fail(EXPLICIT_READOPTION_ERROR_CODES.TARGET_NOT_HISTORICAL);
  }
  if (classification.target_adoption === null) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_REQUEST_REQUIRED);
  }
  if (sameReference(classification.current_adoption, classification.target_adoption)) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.TARGET_IS_CURRENT);
  }
  if (!classification.immediate_predecessor) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.TARGET_NOT_IMMEDIATE_PREDECESSOR);
  }
  const rawBasis = rollbackBasisFor(input);
  if (rawBasis === null) fail(EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_REQUEST_REQUIRED);
  const basis = normalizeBasis(rawBasis);
  if (basis.tenant_id !== input.tenant_id || basis.course_id !== input.course_id) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_SCOPE_CONFLICT);
  }
  if (!sameReference(basis.current_adoption, classification.current_adoption)) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_CURRENT_CONFLICT);
  }
  if (!sameReference(basis.target_adoption, classification.target_adoption)) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_TARGET_CONFLICT);
  }
  if (basis.linked_proposal?.epoch !== undefined) {
    const proposalEpoch = validateEpoch(
      basis.linked_proposal.epoch,
      EXPLICIT_READOPTION_ERROR_CODES.LINKED_PROPOSAL_CONFLICT,
      EXPLICIT_READOPTION_ERROR_CODES.LINKED_PROPOSAL_CONFLICT
    );
    if (!sameEpoch(proposalEpoch, classification.target_epoch)) {
      fail(EXPLICIT_READOPTION_ERROR_CODES.LINKED_PROPOSAL_CONFLICT);
    }
  }

  const proposalInput = {
    epoch: clone(classification.target_epoch),
    expected_adoption: clone(classification.current_adoption)
  } satisfies Pick<RequestEvidenceAdoption, "epoch" | "expected_adoption">;
  const identity = {
    course_id: input.course_id,
    current_adoption: classification.current_adoption,
    linked_proposal_digest: basis.linked_proposal_digest,
    linked_proposal_id: basis.linked_proposal_id,
    predecessor: classification.current_adoption,
    request_digest: basis.request_digest,
    request_id: basis.request_id,
    target_adoption: classification.target_adoption,
    target_epoch: classification.target_epoch,
    tenant_id: input.tenant_id
  };
  const adoptionId = `adoption_readoption_${digest(identity)}`;
  const adoptionBody = {
    adoption_id: adoptionId,
    disposition: "ADOPTED_FOR_FUTURE_ADMISSION" as const,
    epoch: classification.target_epoch,
    predecessor: classification.current_adoption,
    source_current_adoption: classification.current_adoption,
    source_target_adoption: classification.target_adoption
  };
  const adoptionDigest = digest(adoptionBody);
  if (
    adoptionId === classification.current_adoption.adoption_id ||
    adoptionId === classification.target_adoption.adoption_id ||
    adoptionDigest === classification.current_adoption.adoption_digest ||
    adoptionDigest === classification.target_adoption.adoption_digest
  ) {
    fail(EXPLICIT_READOPTION_ERROR_CODES.READOPTION_IDENTITY_CONFLICT);
  }
  const predictedAdoption: ExplicitReadoptionPredictedAdoption = {
    adoption_digest: adoptionDigest,
    adoption_id: adoptionId,
    disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
    epoch: clone(classification.target_epoch),
    predecessor: clone(classification.current_adoption)
  };
  const predictedReference: EvidenceAdoptionReference = {
    adoption_digest: adoptionDigest,
    adoption_id: adoptionId
  };
  return immutableClone({
    adoption_mutation: false as const,
    advisory_only: true as const,
    automatic_rollback: false as const,
    classification: "HISTORICAL_ADOPTED_LINEAGE" as const,
    current_adoption: classification.current_adoption,
    disposition_performed: false as const,
    formal_rollback: false as const,
    future_run: {
      adoption: predictedReference,
      uses_predicted_adoption: true as const
    },
    historical_receipt_rewritten: false as const,
    historical_records: {
      adoption_a: classification.target_adoption,
      adoption_b: classification.current_adoption,
      remain_immutable: true as const
    },
    history_deleted: false as const,
    known_limits: [
      "Prediction only; review, disposition, persistence, and formal rollback remain outside this leaf.",
      "C is a new adoption identity even when its epoch equals historical A.",
      "No latest, current, default, fallback, first, last, or newest selector is evaluated."
    ],
    linked_o5_proposal_input: proposalInput,
    official_truth_write: false as const,
    predicted_adoption: predictedAdoption,
    proposal_input: proposalInput,
    provider: "OFF" as const,
    registry_called: false as const,
    request_changes_current_selection: false as const,
    rollback_applied: false as const,
    status: "READY_WITH_LIMITS" as const,
    store_called: false as const,
    target_adoption: classification.target_adoption,
    target_classification: "HISTORICAL_ADOPTED_LINEAGE" as const,
    target_epoch: classification.target_epoch,
    writer_called: false as const,
    review_performed: false as const
  });
}

// Explicit aliases make the leaf convenient for the RED integrator without
// forcing it to depend on the eventual A1 structural type name.
export {
  classifyExplicitReadoptionTarget as classifyExplicitReadoption,
  predictExplicitReadoption as predictExplicitReadoptionTransition,
  predictExplicitReadoption as validateAndPredictExplicitReadoption
};
