import { createHash } from "node:crypto";
import type {
  DisposeEvidenceAdoption,
  EvidenceAdoptionCommandContext,
  EvidenceAdoptionCommandReceipt,
  EvidenceAdoptionEpoch,
  EvidenceAdoptionProposal,
  EvidenceAdoptionRecord,
  EvidenceAdoptionReduction,
  EvidenceAdoptionReference,
  EvidenceAdoptionReview,
  EvidenceAdoptionState,
  FutureEvidenceAdoptionSelection,
  RequestEvidenceAdoption,
  ReviewEvidenceAdoption
} from "@simwar/shared-contracts";

const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const RESERVED_SELECTOR_PATTERN =
  /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/iu;
const ISO_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/u;

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
const MODEL_VERSION_REFERENCE_KEYS = ["content_digest", "model_version_id", "version"] as const;
const MODEL_ARTIFACT_REFERENCE_KEYS = [
  "artifact_id",
  "content_digest",
  "format",
  "source_ref"
] as const;
const REFERENCE_KEYS = ["adoption_id", "adoption_digest"] as const;
const STATE_KEYS = [
  "tenant_id",
  "course_id",
  "proposals",
  "reviews",
  "records",
  "selections",
  "commands"
] as const;
const PROPOSAL_KEYS = [
  "proposal_id",
  "proposal_digest",
  "epoch",
  "expected_adoption",
  "requested_by",
  "requested_at"
] as const;
const REVIEW_KEYS = [
  "review_id",
  "proposal_id",
  "proposal_digest",
  "decision",
  "note",
  "reviewed_by",
  "reviewed_at"
] as const;
const RECORD_KEYS = [
  "adoption_id",
  "adoption_digest",
  "proposal_id",
  "proposal_digest",
  "review_id",
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
const COMMAND_KEYS = [
  "command_id",
  "command_fingerprint",
  "actor_id",
  "action",
  "entity_id"
] as const;
const CONTEXT_KEYS = ["tenant_id", "course_id", "actor_id", "role", "command_id", "now"] as const;
const REQUEST_KEYS = ["epoch", "expected_adoption"] as const;
const REVIEW_INPUT_KEYS = ["proposal_id", "proposal_digest", "decision", "note"] as const;
const DISPOSE_INPUT_KEYS = [
  "proposal_id",
  "proposal_digest",
  "disposition",
  "expires_at",
  "note"
] as const;

type FailureCode = string;

export class EvidenceAdoptionError extends Error {
  readonly code: string;

  constructor(code: FailureCode) {
    super(code);
    this.code = code;
    this.name = "EvidenceAdoptionError";
  }
}

interface StateIndex {
  readonly state: EvidenceAdoptionState;
  readonly proposalsById: ReadonlyMap<string, EvidenceAdoptionProposal>;
  readonly reviewsById: ReadonlyMap<string, EvidenceAdoptionReview>;
  readonly reviewsByProposalId: ReadonlyMap<string, EvidenceAdoptionReview>;
  readonly recordsByAdoptionId: ReadonlyMap<string, EvidenceAdoptionRecord>;
  readonly recordsByProposalId: ReadonlyMap<string, EvidenceAdoptionRecord>;
  readonly selectionsByScope: ReadonlyMap<string, FutureEvidenceAdoptionSelection>;
}

function fail(code: FailureCode): never {
  throw new EvidenceAdoptionError(code);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isPlainRecord(value) || Object.getOwnPropertySymbols(value).length !== 0) return false;
  const actual = Object.keys(value);
  if (actual.length !== keys.length) return false;
  const expected = new Set(keys);
  return actual.every((key) => expected.has(key));
}

function isNonBlankText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    })
  );
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

function isExactVersion(value: unknown): value is string {
  return (
    isExactIdentifier(value) &&
    !/[\\^~*?]/u.test(value) &&
    !/^(?:[<>=]|\d+\.x|\d+\.\d+\.x)/iu.test(value)
  );
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

function timestampMs(value: string): number {
  return Date.parse(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function canonical(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("EVIDENCE_ADOPTION_INPUT_INVALID");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  if (!isPlainRecord(value)) fail("EVIDENCE_ADOPTION_INPUT_INVALID");
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

function without<T extends Record<string, unknown>, K extends keyof T>(
  value: T,
  key: K
): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function validateModelVersionReference(value: unknown, code: FailureCode): void {
  if (
    !hasExactKeys(value, MODEL_VERSION_REFERENCE_KEYS) ||
    !isDigest(value.content_digest) ||
    !isExactIdentifier(value.model_version_id) ||
    !isExactVersion(value.version)
  ) {
    fail(code);
  }
}

function validateModelArtifactReference(value: unknown, code: FailureCode): void {
  if (
    !hasExactKeys(value, MODEL_ARTIFACT_REFERENCE_KEYS) ||
    !isExactIdentifier(value.artifact_id) ||
    !isDigest(value.content_digest) ||
    !isNonBlankText(value.format) ||
    !isNonBlankText(value.source_ref)
  ) {
    fail(code);
  }
}

function validateReference(value: unknown, code: FailureCode): void {
  if (
    !hasExactKeys(value, REFERENCE_KEYS) ||
    !isExactIdentifier(value.adoption_id) ||
    !isDigest(value.adoption_digest)
  ) {
    fail(code);
  }
}

function validateEpoch(value: unknown, code: FailureCode, requireDigest: boolean): void {
  const keys = requireDigest ? EPOCH_KEYS : EPOCH_BODY_KEYS;
  if (
    !hasExactKeys(value, keys) ||
    !isExactIdentifier(value.tenant_id) ||
    !isExactIdentifier(value.course_id) ||
    !isExactIdentifier(value.source_package_id) ||
    !isDigest(value.source_content_digest) ||
    !isExactIdentifier(value.calibration_dataset_id) ||
    !isDigest(value.calibration_dataset_content_digest) ||
    !isExactIdentifier(value.qualification_id) ||
    !isDigest(value.qualification_content_digest) ||
    (value.source_expires_at !== null && !isIsoTimestamp(value.source_expires_at))
  ) {
    fail(code);
  }
  validateModelVersionReference(value.model_version_reference, code);
  validateModelArtifactReference(value.model_artifact_reference, code);
  if (requireDigest && !isDigest(value.epoch_digest)) fail(code);
}

function epochPayload(value: EvidenceAdoptionEpoch): Omit<EvidenceAdoptionEpoch, "epoch_digest"> {
  return without(value as unknown as Record<string, unknown>, "epoch_digest") as Omit<
    EvidenceAdoptionEpoch,
    "epoch_digest"
  >;
}

function epochDigest(
  value: EvidenceAdoptionEpoch | Omit<EvidenceAdoptionEpoch, "epoch_digest">
): string {
  const payload = "epoch_digest" in value ? epochPayload(value as EvidenceAdoptionEpoch) : value;
  return sha256(payload);
}

function validateInputEpoch(value: unknown): EvidenceAdoptionEpoch {
  validateEpoch(value, "EVIDENCE_ADOPTION_INPUT_INVALID", true);
  const epoch = value as EvidenceAdoptionEpoch;
  if (epoch.epoch_digest !== epochDigest(epoch)) fail("EVIDENCE_ADOPTION_EPOCH_DIGEST_MISMATCH");
  return epoch;
}

function validateStoredEpoch(value: unknown): EvidenceAdoptionEpoch {
  validateEpoch(value, "EVIDENCE_ADOPTION_STATE_INVALID", true);
  const epoch = value as EvidenceAdoptionEpoch;
  if (epoch.epoch_digest !== epochDigest(epoch)) fail("EVIDENCE_ADOPTION_STATE_INVALID");
  return epoch;
}

function sameReference(left: EvidenceAdoptionReference, right: EvidenceAdoptionReference): boolean {
  return left.adoption_id === right.adoption_id && left.adoption_digest === right.adoption_digest;
}

function sameModelVersionReference(
  left: EvidenceAdoptionEpoch["model_version_reference"],
  right: EvidenceAdoptionEpoch["model_version_reference"]
): boolean {
  return (
    left.model_version_id === right.model_version_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameModelArtifactReference(
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

function selectionScopeKey(epoch: EvidenceAdoptionEpoch): string {
  return canonical({
    model_artifact_reference: epoch.model_artifact_reference,
    model_version_reference: epoch.model_version_reference
  });
}

function validateDisposition(
  disposition: unknown,
  expiresAt: unknown,
  referenceTime: string,
  code: FailureCode,
  enforceFutureExpiry = true
): void {
  const validDisposition =
    disposition === "ADOPTED_FOR_FUTURE_ADMISSION" ||
    disposition === "DEFERRED_WITH_EXPIRY" ||
    disposition === "REJECTED_CANDIDATE" ||
    disposition === "REBASE_REQUIRED";
  if (!validDisposition || (expiresAt !== null && !isIsoTimestamp(expiresAt))) fail(code);
  if (disposition === "DEFERRED_WITH_EXPIRY") {
    if (
      expiresAt === null ||
      (enforceFutureExpiry && timestampMs(expiresAt) <= timestampMs(referenceTime))
    ) {
      fail(code);
    }
  } else if (disposition === "REJECTED_CANDIDATE" || disposition === "REBASE_REQUIRED") {
    if (expiresAt !== null) fail(code);
  } else if (
    enforceFutureExpiry &&
    expiresAt !== null &&
    timestampMs(expiresAt) <= timestampMs(referenceTime)
  ) {
    fail(code);
  }
}

function validateStoredProposal(value: unknown): EvidenceAdoptionProposal {
  if (
    !hasExactKeys(value, PROPOSAL_KEYS) ||
    !isExactIdentifier(value.proposal_id) ||
    !isDigest(value.proposal_digest) ||
    !isExactIdentifier(value.requested_by) ||
    !isIsoTimestamp(value.requested_at)
  ) {
    fail("EVIDENCE_ADOPTION_STATE_INVALID");
  }
  const epoch = validateStoredEpoch(value.epoch);
  if (value.expected_adoption !== null) {
    validateReference(value.expected_adoption, "EVIDENCE_ADOPTION_STATE_INVALID");
  }
  const proposal = value as unknown as EvidenceAdoptionProposal;
  if (
    proposal.proposal_digest !==
    sha256(without(proposal as unknown as Record<string, unknown>, "proposal_digest"))
  ) {
    fail("EVIDENCE_ADOPTION_STATE_INVALID");
  }
  return { ...proposal, epoch };
}

function validateStoredReview(value: unknown): EvidenceAdoptionReview {
  if (
    !hasExactKeys(value, REVIEW_KEYS) ||
    !isExactIdentifier(value.review_id) ||
    !isExactIdentifier(value.proposal_id) ||
    !isDigest(value.proposal_digest) ||
    (value.decision !== "APPROVED" && value.decision !== "REJECTED") ||
    !isNonBlankText(value.note) ||
    !isExactIdentifier(value.reviewed_by) ||
    !isIsoTimestamp(value.reviewed_at)
  ) {
    fail("EVIDENCE_ADOPTION_STATE_INVALID");
  }
  return value as unknown as EvidenceAdoptionReview;
}

function validateStoredRecord(value: unknown): EvidenceAdoptionRecord {
  if (
    !hasExactKeys(value, RECORD_KEYS) ||
    !isExactIdentifier(value.adoption_id) ||
    !isDigest(value.adoption_digest) ||
    !isExactIdentifier(value.proposal_id) ||
    !isDigest(value.proposal_digest) ||
    !isExactIdentifier(value.review_id) ||
    !isNonBlankText(value.note) ||
    !isExactIdentifier(value.decided_by) ||
    !isIsoTimestamp(value.decided_at) ||
    value.official_truth_write !== false ||
    value.provider !== "OFF"
  ) {
    fail("EVIDENCE_ADOPTION_STATE_INVALID");
  }
  validateStoredEpoch(value.epoch);
  validateDisposition(
    value.disposition,
    value.expires_at,
    value.decided_at,
    "EVIDENCE_ADOPTION_STATE_INVALID"
  );
  if (value.predecessor !== null) {
    validateReference(value.predecessor, "EVIDENCE_ADOPTION_STATE_INVALID");
  }
  const record = value as unknown as EvidenceAdoptionRecord;
  if (
    record.adoption_digest !==
    sha256(without(record as unknown as Record<string, unknown>, "adoption_digest"))
  ) {
    fail("EVIDENCE_ADOPTION_STATE_INVALID");
  }
  return record;
}

function validateStoredSelection(value: unknown): FutureEvidenceAdoptionSelection {
  if (
    !hasExactKeys(value, SELECTION_KEYS) ||
    !isExactIdentifier(value.adoption_id) ||
    !isDigest(value.adoption_digest)
  ) {
    fail("EVIDENCE_ADOPTION_STATE_INVALID");
  }
  validateModelVersionReference(value.model_version_reference, "EVIDENCE_ADOPTION_STATE_INVALID");
  validateModelArtifactReference(value.model_artifact_reference, "EVIDENCE_ADOPTION_STATE_INVALID");
  return value as unknown as FutureEvidenceAdoptionSelection;
}

function validateStoredCommand(value: unknown): EvidenceAdoptionCommandReceipt {
  if (
    !hasExactKeys(value, COMMAND_KEYS) ||
    !isExactIdentifier(value.command_id) ||
    !isDigest(value.command_fingerprint) ||
    !isExactIdentifier(value.actor_id) ||
    (value.action !== "REQUEST" && value.action !== "REVIEW" && value.action !== "DISPOSE") ||
    !isExactIdentifier(value.entity_id)
  ) {
    fail("EVIDENCE_ADOPTION_STATE_INVALID");
  }
  return value as unknown as EvidenceAdoptionCommandReceipt;
}

function validateState(value: unknown): StateIndex {
  try {
    if (!hasExactKeys(value, STATE_KEYS)) fail("EVIDENCE_ADOPTION_STATE_INVALID");
    const state = value as unknown as EvidenceAdoptionState;
    if (!isExactIdentifier(state.tenant_id) || !isExactIdentifier(state.course_id)) {
      fail("EVIDENCE_ADOPTION_STATE_INVALID");
    }
    if (
      !Array.isArray(state.proposals) ||
      !Array.isArray(state.reviews) ||
      !Array.isArray(state.records) ||
      !Array.isArray(state.selections) ||
      !Array.isArray(state.commands)
    ) {
      fail("EVIDENCE_ADOPTION_STATE_INVALID");
    }

    const globalEntityIds = new Set<string>();
    const proposalsById = new Map<string, EvidenceAdoptionProposal>();
    for (const rawProposal of state.proposals) {
      const proposal = validateStoredProposal(rawProposal);
      if (
        proposal.epoch.tenant_id !== state.tenant_id ||
        proposal.epoch.course_id !== state.course_id ||
        globalEntityIds.has(proposal.proposal_id) ||
        proposalsById.has(proposal.proposal_id)
      ) {
        fail("EVIDENCE_ADOPTION_STATE_INVALID");
      }
      globalEntityIds.add(proposal.proposal_id);
      proposalsById.set(proposal.proposal_id, proposal);
    }

    const reviewsById = new Map<string, EvidenceAdoptionReview>();
    const reviewsByProposalId = new Map<string, EvidenceAdoptionReview>();
    for (const rawReview of state.reviews) {
      const review = validateStoredReview(rawReview);
      const proposal = proposalsById.get(review.proposal_id);
      if (
        !proposal ||
        review.proposal_digest !== proposal.proposal_digest ||
        globalEntityIds.has(review.review_id) ||
        reviewsById.has(review.review_id) ||
        reviewsByProposalId.has(review.proposal_id)
      ) {
        fail("EVIDENCE_ADOPTION_STATE_INVALID");
      }
      globalEntityIds.add(review.review_id);
      reviewsById.set(review.review_id, review);
      reviewsByProposalId.set(review.proposal_id, review);
    }

    const recordsByAdoptionId = new Map<string, EvidenceAdoptionRecord>();
    const recordsByProposalId = new Map<string, EvidenceAdoptionRecord>();
    for (const rawRecord of state.records) {
      const record = validateStoredRecord(rawRecord);
      const proposal = proposalsById.get(record.proposal_id);
      const review = reviewsById.get(record.review_id);
      if (
        !proposal ||
        !review ||
        proposal.proposal_digest !== record.proposal_digest ||
        review.proposal_id !== record.proposal_id ||
        review.proposal_digest !== record.proposal_digest ||
        !sameEpoch(proposal.epoch, record.epoch) ||
        (record.predecessor === null) !== (proposal.expected_adoption === null) ||
        (record.predecessor !== null &&
          proposal.expected_adoption !== null &&
          !sameReference(record.predecessor, proposal.expected_adoption)) ||
        globalEntityIds.has(record.adoption_id) ||
        recordsByAdoptionId.has(record.adoption_id) ||
        recordsByProposalId.has(record.proposal_id)
      ) {
        fail("EVIDENCE_ADOPTION_STATE_INVALID");
      }
      globalEntityIds.add(record.adoption_id);
      recordsByAdoptionId.set(record.adoption_id, record);
      recordsByProposalId.set(record.proposal_id, record);
    }

    for (const proposal of proposalsById.values()) {
      if (proposal.expected_adoption !== null) {
        const predecessor = recordsByAdoptionId.get(proposal.expected_adoption.adoption_id);
        if (
          !predecessor ||
          predecessor.disposition !== "ADOPTED_FOR_FUTURE_ADMISSION" ||
          !sameReference(predecessor, proposal.expected_adoption) ||
          !sameModelVersionReference(
            predecessor.epoch.model_version_reference,
            proposal.epoch.model_version_reference
          ) ||
          !sameModelArtifactReference(
            predecessor.epoch.model_artifact_reference,
            proposal.epoch.model_artifact_reference
          )
        ) {
          fail("EVIDENCE_ADOPTION_STATE_INVALID");
        }
      }
    }

    for (const record of recordsByAdoptionId.values()) {
      if (record.predecessor !== null) {
        const predecessor = recordsByAdoptionId.get(record.predecessor.adoption_id);
        if (
          !predecessor ||
          predecessor.disposition !== "ADOPTED_FOR_FUTURE_ADMISSION" ||
          !sameReference(predecessor, record.predecessor) ||
          !sameModelVersionReference(
            predecessor.epoch.model_version_reference,
            record.epoch.model_version_reference
          ) ||
          !sameModelArtifactReference(
            predecessor.epoch.model_artifact_reference,
            record.epoch.model_artifact_reference
          ) ||
          predecessor.adoption_id === record.adoption_id
        ) {
          fail("EVIDENCE_ADOPTION_STATE_INVALID");
        }
      }
    }

    const selectionsByScope = new Map<string, FutureEvidenceAdoptionSelection>();
    for (const rawSelection of state.selections) {
      const selection = validateStoredSelection(rawSelection);
      const record = recordsByAdoptionId.get(selection.adoption_id);
      const scopeKey = canonical({
        model_artifact_reference: selection.model_artifact_reference,
        model_version_reference: selection.model_version_reference
      });
      if (
        !record ||
        record.disposition !== "ADOPTED_FOR_FUTURE_ADMISSION" ||
        !sameReference(record, selection) ||
        !sameModelVersionReference(
          record.epoch.model_version_reference,
          selection.model_version_reference
        ) ||
        !sameModelArtifactReference(
          record.epoch.model_artifact_reference,
          selection.model_artifact_reference
        ) ||
        selectionsByScope.has(scopeKey)
      ) {
        fail("EVIDENCE_ADOPTION_STATE_INVALID");
      }
      selectionsByScope.set(scopeKey, selection);
    }

    const commands = new Set<string>();
    const commandEntities = new Set<string>();
    const commandFingerprints = new Set<string>();
    const requestReceiptEntities = new Set<string>();
    const reviewReceiptEntities = new Set<string>();
    const disposeReceiptEntities = new Set<string>();
    for (const rawCommand of state.commands) {
      const command = validateStoredCommand(rawCommand);
      if (
        globalEntityIds.has(command.command_id) ||
        commands.has(command.command_id) ||
        commandEntities.has(`${command.action}:${command.entity_id}`) ||
        commandFingerprints.has(command.command_fingerprint)
      ) {
        fail("EVIDENCE_ADOPTION_STATE_INVALID");
      }
      globalEntityIds.add(command.command_id);
      commands.add(command.command_id);
      commandEntities.add(`${command.action}:${command.entity_id}`);
      commandFingerprints.add(command.command_fingerprint);
      if (command.action === "REQUEST") requestReceiptEntities.add(command.entity_id);
      if (command.action === "REVIEW") reviewReceiptEntities.add(command.entity_id);
      if (command.action === "DISPOSE") disposeReceiptEntities.add(command.entity_id);

      let expectedPayload: unknown;
      let expectedActor: string;
      if (command.action === "REQUEST") {
        const proposal = proposalsById.get(command.entity_id);
        if (!proposal) fail("EVIDENCE_ADOPTION_STATE_INVALID");
        expectedPayload = {
          epoch: proposal.epoch,
          expected_adoption: proposal.expected_adoption
        };
        expectedActor = proposal.requested_by;
      } else if (command.action === "REVIEW") {
        const review = reviewsById.get(command.entity_id);
        if (!review) fail("EVIDENCE_ADOPTION_STATE_INVALID");
        expectedPayload = {
          decision: review.decision,
          note: review.note,
          proposal_digest: review.proposal_digest,
          proposal_id: review.proposal_id
        };
        expectedActor = review.reviewed_by;
      } else {
        const record = recordsByAdoptionId.get(command.entity_id);
        if (!record) fail("EVIDENCE_ADOPTION_STATE_INVALID");
        expectedPayload = {
          disposition: record.disposition,
          expires_at: record.expires_at,
          note: record.note,
          proposal_digest: record.proposal_digest,
          proposal_id: record.proposal_id
        };
        expectedActor = record.decided_by;
      }
      if (
        command.actor_id !== expectedActor ||
        command.command_fingerprint !==
          commandFingerprint(command.command_id, command.actor_id, command.action, expectedPayload)
      ) {
        fail("EVIDENCE_ADOPTION_STATE_INVALID");
      }
    }
    for (const proposalId of proposalsById.keys()) {
      const proposal = proposalsById.get(proposalId);
      if (!proposal || !requestReceiptEntities.has(proposalId)) {
        fail("EVIDENCE_ADOPTION_STATE_INVALID");
      }
    }
    for (const reviewId of reviewsById.keys()) {
      const review = reviewsById.get(reviewId);
      if (!review || !reviewReceiptEntities.has(reviewId)) {
        fail("EVIDENCE_ADOPTION_STATE_INVALID");
      }
    }
    for (const adoptionId of recordsByAdoptionId.keys()) {
      const record = recordsByAdoptionId.get(adoptionId);
      if (!record || !disposeReceiptEntities.has(adoptionId)) {
        fail("EVIDENCE_ADOPTION_STATE_INVALID");
      }
    }

    return {
      state,
      proposalsById,
      reviewsById,
      reviewsByProposalId,
      recordsByAdoptionId,
      recordsByProposalId,
      selectionsByScope
    };
  } catch (error) {
    if (
      error instanceof EvidenceAdoptionError &&
      error.code === "EVIDENCE_ADOPTION_STATE_INVALID"
    ) {
      throw error;
    }
    fail("EVIDENCE_ADOPTION_STATE_INVALID");
  }
}

function validateContext(
  value: unknown,
  state: EvidenceAdoptionState
): EvidenceAdoptionCommandContext {
  try {
    if (
      !hasExactKeys(value, CONTEXT_KEYS) ||
      !isExactIdentifier(value.tenant_id) ||
      !isExactIdentifier(value.course_id) ||
      !isExactIdentifier(value.actor_id) ||
      !isExactIdentifier(value.command_id) ||
      !isIsoTimestamp(value.now)
    ) {
      fail("EVIDENCE_ADOPTION_INPUT_INVALID");
    }
    if (value.role !== "teacher" && value.role !== "tenant_admin") {
      fail("EVIDENCE_ADOPTION_ACTOR_FORBIDDEN");
    }
    if (value.tenant_id !== state.tenant_id || value.course_id !== state.course_id) {
      fail("EVIDENCE_ADOPTION_SCOPE_MISMATCH");
    }
    return value as unknown as EvidenceAdoptionCommandContext;
  } catch (error) {
    if (error instanceof EvidenceAdoptionError) throw error;
    fail("EVIDENCE_ADOPTION_INPUT_INVALID");
  }
}

function validateRequestInput(value: unknown): RequestEvidenceAdoption {
  try {
    if (!hasExactKeys(value, REQUEST_KEYS)) fail("EVIDENCE_ADOPTION_INPUT_INVALID");
    validateInputEpoch(value.epoch);
    if (value.expected_adoption !== null)
      validateReference(value.expected_adoption, "EVIDENCE_ADOPTION_INPUT_INVALID");
    return value as unknown as RequestEvidenceAdoption;
  } catch (error) {
    if (error instanceof EvidenceAdoptionError) throw error;
    fail("EVIDENCE_ADOPTION_INPUT_INVALID");
  }
}

function validateReviewInput(value: unknown): ReviewEvidenceAdoption {
  try {
    if (
      !hasExactKeys(value, REVIEW_INPUT_KEYS) ||
      !isExactIdentifier(value.proposal_id) ||
      !isDigest(value.proposal_digest) ||
      (value.decision !== "APPROVED" && value.decision !== "REJECTED") ||
      !isNonBlankText(value.note)
    ) {
      fail("EVIDENCE_ADOPTION_INPUT_INVALID");
    }
    return value as unknown as ReviewEvidenceAdoption;
  } catch (error) {
    if (error instanceof EvidenceAdoptionError) throw error;
    fail("EVIDENCE_ADOPTION_INPUT_INVALID");
  }
}

function validateDisposeInput(value: unknown, now: string): DisposeEvidenceAdoption {
  try {
    if (
      !hasExactKeys(value, DISPOSE_INPUT_KEYS) ||
      !isExactIdentifier(value.proposal_id) ||
      !isDigest(value.proposal_digest) ||
      !isNonBlankText(value.note)
    ) {
      fail("EVIDENCE_ADOPTION_INPUT_INVALID");
    }
    validateDisposition(
      value.disposition,
      value.expires_at,
      now,
      "EVIDENCE_ADOPTION_EXPIRY_INVALID",
      false
    );
    return value as unknown as DisposeEvidenceAdoption;
  } catch (error) {
    if (error instanceof EvidenceAdoptionError) throw error;
    fail("EVIDENCE_ADOPTION_INPUT_INVALID");
  }
}

function commandFingerprint(
  commandId: string,
  actorId: string,
  action: EvidenceAdoptionCommandReceipt["action"],
  payload: unknown
): string {
  return sha256({ action, actor_id: actorId, command_id: commandId, payload });
}

function findExistingCommand(
  index: StateIndex,
  context: EvidenceAdoptionCommandContext,
  action: EvidenceAdoptionCommandReceipt["action"],
  fingerprint: string
): EvidenceAdoptionCommandReceipt | null {
  const existing = index.state.commands.find(
    (command) => command.command_id === context.command_id
  );
  if (!existing) return null;
  if (
    existing.actor_id !== context.actor_id ||
    existing.action !== action ||
    existing.command_fingerprint !== fingerprint
  ) {
    fail("EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT");
  }
  return existing;
}

function entityForCommand(
  index: StateIndex,
  command: EvidenceAdoptionCommandReceipt
): EvidenceAdoptionProposal | EvidenceAdoptionReview | EvidenceAdoptionRecord {
  if (command.action === "REQUEST") {
    const proposal = index.proposalsById.get(command.entity_id);
    if (!proposal) fail("EVIDENCE_ADOPTION_STATE_INVALID");
    return proposal;
  }
  if (command.action === "REVIEW") {
    const review = index.reviewsById.get(command.entity_id);
    if (!review) fail("EVIDENCE_ADOPTION_STATE_INVALID");
    return review;
  }
  const record = index.recordsByAdoptionId.get(command.entity_id);
  if (!record) fail("EVIDENCE_ADOPTION_STATE_INVALID");
  return record;
}

function reduction<
  T extends EvidenceAdoptionProposal | EvidenceAdoptionReview | EvidenceAdoptionRecord
>(state: EvidenceAdoptionState, receipt: T, reused: boolean): EvidenceAdoptionReduction<T> {
  return deepFreeze({
    state: immutableClone(state),
    receipt: immutableClone(receipt),
    reused
  }) as EvidenceAdoptionReduction<T>;
}

function appendCommand(
  state: EvidenceAdoptionState,
  command: EvidenceAdoptionCommandReceipt
): EvidenceAdoptionState {
  return {
    ...state,
    commands: [...state.commands, command]
  };
}

function currentSelection(
  index: StateIndex,
  epoch: EvidenceAdoptionEpoch
): FutureEvidenceAdoptionSelection | null {
  return index.selectionsByScope.get(selectionScopeKey(epoch)) ?? null;
}

function assertExpectedPredecessor(
  current: FutureEvidenceAdoptionSelection | null,
  expected: EvidenceAdoptionReference | null
): void {
  const currentReference = current
    ? { adoption_id: current.adoption_id, adoption_digest: current.adoption_digest }
    : null;
  if (
    (currentReference === null && expected !== null) ||
    (currentReference !== null && expected === null) ||
    (currentReference !== null && expected !== null && !sameReference(currentReference, expected))
  ) {
    fail("EVIDENCE_ADOPTION_PREDECESSOR_CONFLICT");
  }
}

function ensureEpochScope(epoch: EvidenceAdoptionEpoch, state: EvidenceAdoptionState): void {
  if (epoch.tenant_id !== state.tenant_id || epoch.course_id !== state.course_id) {
    fail("EVIDENCE_ADOPTION_SCOPE_MISMATCH");
  }
}

export function createEvidenceEpoch(
  input: Omit<EvidenceAdoptionEpoch, "epoch_digest">
): EvidenceAdoptionEpoch {
  try {
    validateEpoch(input, "EVIDENCE_ADOPTION_INPUT_INVALID", false);
    const payload = clone(input);
    return immutableClone({ ...payload, epoch_digest: epochDigest(payload) });
  } catch (error) {
    if (error instanceof EvidenceAdoptionError) throw error;
    fail("EVIDENCE_ADOPTION_INPUT_INVALID");
  }
}

export function emptyEvidenceAdoptionState(
  tenant_id: string,
  course_id: string
): EvidenceAdoptionState {
  try {
    if (!isExactIdentifier(tenant_id) || !isExactIdentifier(course_id)) {
      fail("EVIDENCE_ADOPTION_INPUT_INVALID");
    }
    return immutableClone({
      tenant_id,
      course_id,
      proposals: [],
      reviews: [],
      records: [],
      selections: [],
      commands: []
    });
  } catch (error) {
    if (error instanceof EvidenceAdoptionError) throw error;
    fail("EVIDENCE_ADOPTION_INPUT_INVALID");
  }
}

export function requestEvidenceAdoption(
  stateInput: EvidenceAdoptionState,
  contextInput: EvidenceAdoptionCommandContext,
  inputInput: RequestEvidenceAdoption
): EvidenceAdoptionReduction<EvidenceAdoptionProposal> {
  const index = validateState(stateInput);
  const context = validateContext(contextInput, index.state);
  try {
    const input = validateRequestInput(inputInput);
    ensureEpochScope(input.epoch, index.state);
    const fingerprint = commandFingerprint(context.command_id, context.actor_id, "REQUEST", {
      epoch: input.epoch,
      expected_adoption: input.expected_adoption
    });
    const existing = findExistingCommand(index, context, "REQUEST", fingerprint);
    if (existing) {
      return reduction(
        index.state,
        entityForCommand(index, existing) as EvidenceAdoptionProposal,
        true
      );
    }

    assertExpectedPredecessor(currentSelection(index, input.epoch), input.expected_adoption);
    const proposalId = `proposal_${fingerprint}`;
    if (
      index.proposalsById.has(proposalId) ||
      index.reviewsById.has(proposalId) ||
      index.recordsByAdoptionId.has(proposalId)
    ) {
      fail("EVIDENCE_ADOPTION_STATE_INVALID");
    }
    const proposalWithoutDigest = {
      proposal_id: proposalId,
      epoch: immutableClone(input.epoch),
      expected_adoption:
        input.expected_adoption === null ? null : immutableClone(input.expected_adoption),
      requested_by: context.actor_id,
      requested_at: context.now
    };
    const proposal = immutableClone({
      ...proposalWithoutDigest,
      proposal_digest: sha256(proposalWithoutDigest)
    }) as EvidenceAdoptionProposal;
    const command = immutableClone({
      command_id: context.command_id,
      command_fingerprint: fingerprint,
      actor_id: context.actor_id,
      action: "REQUEST" as const,
      entity_id: proposal.proposal_id
    });
    const nextState = appendCommand(
      {
        ...index.state,
        proposals: [...index.state.proposals, proposal]
      },
      command
    );
    return reduction(nextState, proposal, false);
  } catch (error) {
    if (error instanceof EvidenceAdoptionError) throw error;
    fail("EVIDENCE_ADOPTION_INPUT_INVALID");
  }
}

export function reviewEvidenceAdoption(
  stateInput: EvidenceAdoptionState,
  contextInput: EvidenceAdoptionCommandContext,
  inputInput: ReviewEvidenceAdoption
): EvidenceAdoptionReduction<EvidenceAdoptionReview> {
  const index = validateState(stateInput);
  const context = validateContext(contextInput, index.state);
  try {
    const input = validateReviewInput(inputInput);
    const fingerprint = commandFingerprint(context.command_id, context.actor_id, "REVIEW", input);
    const existing = findExistingCommand(index, context, "REVIEW", fingerprint);
    if (existing) {
      return reduction(
        index.state,
        entityForCommand(index, existing) as EvidenceAdoptionReview,
        true
      );
    }
    const proposal = index.proposalsById.get(input.proposal_id);
    if (!proposal) fail("EVIDENCE_ADOPTION_NOT_FOUND");
    if (proposal.proposal_digest !== input.proposal_digest) {
      fail("EVIDENCE_ADOPTION_DIGEST_MISMATCH");
    }
    if (index.reviewsByProposalId.has(input.proposal_id)) {
      fail("EVIDENCE_ADOPTION_IMMUTABLE_CONFLICT");
    }
    const reviewId = `review_${fingerprint}`;
    const review = immutableClone({
      review_id: reviewId,
      proposal_id: proposal.proposal_id,
      proposal_digest: proposal.proposal_digest,
      decision: input.decision,
      note: input.note,
      reviewed_by: context.actor_id,
      reviewed_at: context.now
    }) as EvidenceAdoptionReview;
    const command = immutableClone({
      command_id: context.command_id,
      command_fingerprint: fingerprint,
      actor_id: context.actor_id,
      action: "REVIEW" as const,
      entity_id: review.review_id
    });
    const nextState = appendCommand(
      {
        ...index.state,
        reviews: [...index.state.reviews, review]
      },
      command
    );
    return reduction(nextState, review, false);
  } catch (error) {
    if (error instanceof EvidenceAdoptionError) throw error;
    fail("EVIDENCE_ADOPTION_INPUT_INVALID");
  }
}

export function disposeEvidenceAdoption(
  stateInput: EvidenceAdoptionState,
  contextInput: EvidenceAdoptionCommandContext,
  inputInput: DisposeEvidenceAdoption
): EvidenceAdoptionReduction<EvidenceAdoptionRecord> {
  const index = validateState(stateInput);
  const context = validateContext(contextInput, index.state);
  try {
    const input = validateDisposeInput(inputInput, context.now);
    const fingerprint = commandFingerprint(context.command_id, context.actor_id, "DISPOSE", input);
    const existing = findExistingCommand(index, context, "DISPOSE", fingerprint);
    if (existing) {
      return reduction(
        index.state,
        entityForCommand(index, existing) as EvidenceAdoptionRecord,
        true
      );
    }
    validateDisposition(
      input.disposition,
      input.expires_at,
      context.now,
      "EVIDENCE_ADOPTION_EXPIRY_INVALID"
    );
    const proposal = index.proposalsById.get(input.proposal_id);
    if (!proposal) fail("EVIDENCE_ADOPTION_NOT_FOUND");
    if (proposal.proposal_digest !== input.proposal_digest) {
      fail("EVIDENCE_ADOPTION_DIGEST_MISMATCH");
    }
    const review = index.reviewsByProposalId.get(proposal.proposal_id);
    if (!review) fail("EVIDENCE_ADOPTION_REVIEW_REQUIRED");
    if (index.recordsByProposalId.has(proposal.proposal_id)) {
      fail("EVIDENCE_ADOPTION_IMMUTABLE_CONFLICT");
    }
    if (input.disposition === "ADOPTED_FOR_FUTURE_ADMISSION" && review.decision !== "APPROVED") {
      fail("EVIDENCE_ADOPTION_REVIEW_REQUIRED");
    }

    const previousSelection = currentSelection(index, proposal.epoch);
    if (input.disposition === "ADOPTED_FOR_FUTURE_ADMISSION") {
      assertExpectedPredecessor(previousSelection, proposal.expected_adoption);
    }
    const predecessor =
      proposal.expected_adoption === null ? null : immutableClone(proposal.expected_adoption);
    const adoptionId = `adoption_${fingerprint}`;
    if (
      index.proposalsById.has(adoptionId) ||
      index.reviewsById.has(adoptionId) ||
      index.recordsByAdoptionId.has(adoptionId)
    ) {
      fail("EVIDENCE_ADOPTION_STATE_INVALID");
    }
    const recordWithoutDigest = {
      adoption_id: adoptionId,
      proposal_id: proposal.proposal_id,
      proposal_digest: proposal.proposal_digest,
      review_id: review.review_id,
      epoch: immutableClone(proposal.epoch),
      predecessor,
      disposition: input.disposition,
      expires_at: input.expires_at,
      note: input.note,
      decided_by: context.actor_id,
      decided_at: context.now,
      official_truth_write: false as const,
      provider: "OFF" as const
    };
    const record = immutableClone({
      ...recordWithoutDigest,
      adoption_digest: sha256(recordWithoutDigest)
    }) as EvidenceAdoptionRecord;
    const command = immutableClone({
      command_id: context.command_id,
      command_fingerprint: fingerprint,
      actor_id: context.actor_id,
      action: "DISPOSE" as const,
      entity_id: record.adoption_id
    });
    const selections = [...index.state.selections];
    if (input.disposition === "ADOPTED_FOR_FUTURE_ADMISSION") {
      const selection: FutureEvidenceAdoptionSelection = immutableClone({
        adoption_id: record.adoption_id,
        adoption_digest: record.adoption_digest,
        model_version_reference: record.epoch.model_version_reference,
        model_artifact_reference: record.epoch.model_artifact_reference
      });
      const scopeKey = selectionScopeKey(record.epoch);
      const existingIndex = selections.findIndex(
        (candidate) =>
          canonical({
            model_artifact_reference: candidate.model_artifact_reference,
            model_version_reference: candidate.model_version_reference
          }) === scopeKey
      );
      if (existingIndex >= 0) selections[existingIndex] = selection;
      else selections.push(selection);
    }
    const nextState = appendCommand(
      {
        ...index.state,
        records: [...index.state.records, record],
        selections
      },
      command
    );
    return reduction(nextState, record, false);
  } catch (error) {
    if (error instanceof EvidenceAdoptionError) throw error;
    fail("EVIDENCE_ADOPTION_INPUT_INVALID");
  }
}

interface FutureResolutionInput {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly adoption_id: string;
  readonly adoption_digest: string;
  readonly epoch: EvidenceAdoptionEpoch;
  readonly now: string;
}

interface HistoricalResolutionInput {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly adoption_id: string;
  readonly adoption_digest: string;
  readonly epoch: EvidenceAdoptionEpoch;
}

function validateFutureResolutionInput(value: unknown): FutureResolutionInput {
  if (
    !hasExactKeys(value, [
      "tenant_id",
      "course_id",
      "adoption_id",
      "adoption_digest",
      "epoch",
      "now"
    ]) ||
    !isExactIdentifier(value.tenant_id) ||
    !isExactIdentifier(value.course_id) ||
    !isExactIdentifier(value.adoption_id) ||
    !isDigest(value.adoption_digest) ||
    !isIsoTimestamp(value.now)
  ) {
    fail("EVIDENCE_ADOPTION_INPUT_INVALID");
  }
  validateInputEpoch(value.epoch);
  return value as unknown as FutureResolutionInput;
}

function validateHistoricalResolutionInput(value: unknown): HistoricalResolutionInput {
  if (
    !hasExactKeys(value, ["tenant_id", "course_id", "adoption_id", "adoption_digest", "epoch"]) ||
    !isExactIdentifier(value.tenant_id) ||
    !isExactIdentifier(value.course_id) ||
    !isExactIdentifier(value.adoption_id) ||
    !isDigest(value.adoption_digest)
  ) {
    fail("EVIDENCE_ADOPTION_INPUT_INVALID");
  }
  validateInputEpoch(value.epoch);
  return value as unknown as HistoricalResolutionInput;
}

function validateResolutionScope(
  input: { tenant_id: string; course_id: string },
  state: EvidenceAdoptionState
): void {
  if (input.tenant_id !== state.tenant_id || input.course_id !== state.course_id) {
    fail("EVIDENCE_ADOPTION_SCOPE_MISMATCH");
  }
}

function resolveRecord(
  index: StateIndex,
  input: { adoption_id: string; adoption_digest: string; epoch: EvidenceAdoptionEpoch }
): EvidenceAdoptionRecord {
  const record = index.recordsByAdoptionId.get(input.adoption_id);
  if (!record) fail("EVIDENCE_ADOPTION_NOT_FOUND");
  if (record.adoption_digest !== input.adoption_digest) fail("EVIDENCE_ADOPTION_DIGEST_MISMATCH");
  if (!sameEpoch(record.epoch, input.epoch)) fail("EVIDENCE_ADOPTION_EPOCH_MISMATCH");
  return record;
}

export function resolveFutureEvidenceAdoption(
  stateInput: EvidenceAdoptionState,
  inputInput: FutureResolutionInput
): EvidenceAdoptionRecord {
  const index = validateState(stateInput);
  try {
    const input = validateFutureResolutionInput(inputInput);
    validateResolutionScope(input, index.state);
    ensureEpochScope(input.epoch, index.state);
    const record = resolveRecord(index, input);
    if (record.disposition !== "ADOPTED_FOR_FUTURE_ADMISSION")
      fail("EVIDENCE_ADOPTION_NOT_CURRENT");
    const selection = currentSelection(index, record.epoch);
    if (
      !selection ||
      selection.adoption_id !== record.adoption_id ||
      selection.adoption_digest !== record.adoption_digest
    ) {
      fail("EVIDENCE_ADOPTION_NOT_CURRENT");
    }
    if (timestampMs(record.decided_at) > timestampMs(input.now)) {
      fail("EVIDENCE_ADOPTION_NOT_CURRENT");
    }
    if (
      record.epoch.source_expires_at !== null &&
      timestampMs(record.epoch.source_expires_at) <= timestampMs(input.now)
    ) {
      fail("EVIDENCE_ADOPTION_EXPIRED");
    }
    if (record.expires_at !== null && timestampMs(record.expires_at) <= timestampMs(input.now)) {
      fail("EVIDENCE_ADOPTION_EXPIRED");
    }
    return immutableClone(record);
  } catch (error) {
    if (error instanceof EvidenceAdoptionError) throw error;
    fail("EVIDENCE_ADOPTION_INPUT_INVALID");
  }
}

export function resolveHistoricalEvidenceAdoption(
  stateInput: EvidenceAdoptionState,
  inputInput: HistoricalResolutionInput
): EvidenceAdoptionRecord {
  const index = validateState(stateInput);
  try {
    const input = validateHistoricalResolutionInput(inputInput);
    validateResolutionScope(input, index.state);
    ensureEpochScope(input.epoch, index.state);
    const record = resolveRecord(index, input);
    if (record.disposition !== "ADOPTED_FOR_FUTURE_ADMISSION")
      fail("EVIDENCE_ADOPTION_NOT_ADOPTED");
    return immutableClone(record);
  } catch (error) {
    if (error instanceof EvidenceAdoptionError) throw error;
    fail("EVIDENCE_ADOPTION_INPUT_INVALID");
  }
}
