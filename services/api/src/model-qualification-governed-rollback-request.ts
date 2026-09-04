import type {
  AdoptionRollbackDryRun,
  EvidenceAdoptionEpoch,
  EvidenceAdoptionProposal,
  EvidenceAdoptionReference
} from "@simwar/shared-contracts";
import { stableSha256 } from "./model-qualification-adoption-drift-assessment.js";

export type GovernedRollbackRequesterRole = "teacher" | "tenant_admin";

export type GovernedRollbackRequestFailureCode =
  | "ROLLBACK_REQUEST_INPUT_INVALID"
  | "ROLLBACK_REQUEST_SELECTOR_INVALID"
  | "ROLLBACK_REQUEST_ROLE_FORBIDDEN"
  | "ROLLBACK_REQUEST_SCOPE_CONFLICT"
  | "ROLLBACK_REQUEST_DIGEST_CONFLICT"
  | "ROLLBACK_REQUEST_REBASE_REQUIRED"
  | "ROLLBACK_DRY_RUN_NOT_READY"
  | "ROLLBACK_PREDECESSOR_NOT_ELIGIBLE";

export class GovernedRollbackRequestError extends Error {
  readonly code: GovernedRollbackRequestFailureCode;

  constructor(code: GovernedRollbackRequestFailureCode) {
    super(code);
    this.code = code;
    this.name = "GovernedRollbackRequestError";
  }
}

export interface GovernedRollbackRequestInput {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly actor_id: string;
  readonly role: GovernedRollbackRequesterRole;
  readonly command_id: string;
  readonly requested_at: string;
  readonly reason: string;
  readonly current_adoption: EvidenceAdoptionReference;
  readonly predecessor_adoption: EvidenceAdoptionReference;
  readonly adoption_state_digest: string;
  readonly operations_policy_digest: string;
  /** Fresh values read at request time; they must still equal the dry-run bindings. */
  readonly actual_adoption_state_digest: string;
  readonly actual_operations_policy_digest: string;
  readonly dry_run: AdoptionRollbackDryRun;
}

export type GovernedRollbackProposalIntent = EvidenceAdoptionProposal;

export interface GovernedRollbackRequest {
  readonly request_id: string;
  readonly request_digest: string;
  readonly idempotency_fingerprint: string;
  readonly tenant_id: string;
  readonly course_id: string;
  readonly requested_by: string;
  readonly requester_role: GovernedRollbackRequesterRole;
  readonly command_id: string;
  readonly requested_at: string;
  readonly reason: string;
  readonly dry_run_id: string;
  readonly dry_run_digest: string;
  readonly current_adoption: EvidenceAdoptionReference;
  readonly predecessor_adoption: EvidenceAdoptionReference;
  readonly predecessor_epoch: EvidenceAdoptionEpoch;
  readonly predecessor_qualification: Pick<
    EvidenceAdoptionEpoch,
    "qualification_id" | "qualification_content_digest"
  >;
  readonly adoption_state_digest: string;
  readonly operations_policy_digest: string;
  readonly linked_proposal_id: string;
  readonly linked_proposal_digest: string;
  readonly status: "LINKED_PROPOSAL_PENDING_REVIEW";
  readonly current_selection_changed: false;
  readonly rollback_applied: false;
  readonly adoption_mutation: false;
  readonly official_truth_write: false;
  readonly history_deleted: false;
  readonly historical_receipt_rewritten: false;
  readonly provider: "OFF";
  readonly advisory_only: true;
  readonly writer_effect: "NONE";
}

export interface GovernedRollbackRequestCandidate {
  readonly request: GovernedRollbackRequest;
  /** Predicted standard O5 proposal; the existing O5 writer must persist it. */
  readonly proposal: GovernedRollbackProposalIntent;
}

export type GovernedRollbackRequestResult = GovernedRollbackRequestCandidate;

const INPUT_KEYS = [
  "tenant_id",
  "course_id",
  "actor_id",
  "role",
  "command_id",
  "requested_at",
  "reason",
  "current_adoption",
  "predecessor_adoption",
  "adoption_state_digest",
  "operations_policy_digest",
  "actual_adoption_state_digest",
  "actual_operations_policy_digest",
  "dry_run"
] as const;
const REFERENCE_KEYS = ["adoption_id", "adoption_digest"] as const;
const EPOCH_KEYS = [
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
  "source_expires_at",
  "epoch_digest"
] as const;
const MODEL_VERSION_KEYS = ["content_digest", "model_version_id", "version"] as const;
const MODEL_ARTIFACT_KEYS = ["artifact_id", "content_digest", "format", "source_ref"] as const;
const DRY_RUN_KEYS = [
  "dry_run_id",
  "dry_run_digest",
  "assessed_at",
  "current_adoption",
  "predecessor_adoption",
  "predecessor_epoch",
  "adoption_state_digest",
  "operations_policy_digest",
  "status",
  "predecessor_currently_eligible",
  "future_admission_impact",
  "blockers",
  "known_limits",
  "provider",
  "advisory_only",
  "rollback_applied",
  "adoption_mutation",
  "official_truth_write",
  "history_deleted",
  "historical_receipt_rewritten"
] as const;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const RESERVED_SELECTOR_PATTERN =
  /(?:^|[._:-])(?:any|current|default|fallback|first|last|latest|newest|next|unresolved)(?:$|[._:-])/iu;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const ISO_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/u;

function fail(code: GovernedRollbackRequestFailureCode): never {
  throw new GovernedRollbackRequestError(code);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isPlainRecord(value) || Object.getOwnPropertySymbols(value).length !== 0) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
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

function isReference(value: unknown): value is EvidenceAdoptionReference {
  return (
    hasExactKeys(value, REFERENCE_KEYS) &&
    isExactIdentifier(value.adoption_id) &&
    isDigest(value.adoption_digest)
  );
}

function isModelVersionReference(value: unknown): boolean {
  return (
    hasExactKeys(value, MODEL_VERSION_KEYS) &&
    isExactIdentifier(value.model_version_id) &&
    isExactIdentifier(value.version) &&
    isDigest(value.content_digest)
  );
}

function isModelArtifactReference(value: unknown): boolean {
  return (
    hasExactKeys(value, MODEL_ARTIFACT_KEYS) &&
    isExactIdentifier(value.artifact_id) &&
    isDigest(value.content_digest) &&
    isNonBlankText(value.format) &&
    isNonBlankText(value.source_ref)
  );
}

function isEpochShape(value: unknown): value is EvidenceAdoptionEpoch {
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
    !isModelVersionReference(value.model_version_reference) ||
    !isModelArtifactReference(value.model_artifact_reference) ||
    !isDigest(value.epoch_digest)
  ) {
    return false;
  }
  return true;
}

function hasValidEpochDigest(epoch: EvidenceAdoptionEpoch): boolean {
  const { epoch_digest: _ignoredDigest, ...body } = epoch;
  return stableSha256(body) === epoch.epoch_digest;
}

function isDryRunShape(value: unknown): value is AdoptionRollbackDryRun {
  if (
    !hasExactKeys(value, DRY_RUN_KEYS) ||
    !isExactIdentifier(value.dry_run_id) ||
    !isDigest(value.dry_run_digest) ||
    !isIsoTimestamp(value.assessed_at) ||
    !isReference(value.current_adoption) ||
    !isReference(value.predecessor_adoption) ||
    (value.predecessor_epoch !== null && !isEpochShape(value.predecessor_epoch)) ||
    !isDigest(value.adoption_state_digest) ||
    !isDigest(value.operations_policy_digest) ||
    !["READY_WITH_LIMITS", "BLOCKED", "REBASE_REQUIRED", "NO_PREDECESSOR"].includes(
      value.status as AdoptionRollbackDryRun["status"]
    ) ||
    typeof value.predecessor_currently_eligible !== "boolean" ||
    !["WOULD_SELECT_EXACT_PREDECESSOR", "BLOCKED", "REBASE_REQUIRED"].includes(
      value.future_admission_impact as AdoptionRollbackDryRun["future_admission_impact"]
    ) ||
    !Array.isArray(value.blockers) ||
    !value.blockers.every((blocker) => typeof blocker === "string") ||
    !Array.isArray(value.known_limits) ||
    !value.known_limits.every((limit) => isNonBlankText(limit)) ||
    value.provider !== "OFF" ||
    value.advisory_only !== true ||
    value.rollback_applied !== false ||
    value.adoption_mutation !== false ||
    value.official_truth_write !== false ||
    value.history_deleted !== false ||
    value.historical_receipt_rewritten !== false
  ) {
    return false;
  }
  return true;
}

function hasValidDryRunDigest(dryRun: AdoptionRollbackDryRun): boolean {
  const { dry_run_digest: _ignoredDigest, ...body } = dryRun;
  return stableSha256(body) === dryRun.dry_run_digest;
}

function validateDryRun(value: unknown): asserts value is AdoptionRollbackDryRun {
  if (!isDryRunShape(value)) fail("ROLLBACK_REQUEST_INPUT_INVALID");
  if (value.predecessor_epoch !== null && !hasValidEpochDigest(value.predecessor_epoch)) {
    fail("ROLLBACK_REQUEST_DIGEST_CONFLICT");
  }
  if (!hasValidDryRunDigest(value)) fail("ROLLBACK_REQUEST_DIGEST_CONFLICT");
}

function validateInput(input: GovernedRollbackRequestInput): void {
  if (!hasExactKeys(input, INPUT_KEYS)) {
    fail("ROLLBACK_REQUEST_INPUT_INVALID");
  }
  if (input.role !== "teacher" && input.role !== "tenant_admin") {
    fail("ROLLBACK_REQUEST_ROLE_FORBIDDEN");
  }
  if (
    !isExactIdentifier(input.tenant_id) ||
    !isExactIdentifier(input.course_id) ||
    !isExactIdentifier(input.actor_id) ||
    !isExactIdentifier(input.command_id) ||
    !isReference(input.current_adoption) ||
    !isReference(input.predecessor_adoption)
  ) {
    fail("ROLLBACK_REQUEST_SELECTOR_INVALID");
  }
  if (
    !isIsoTimestamp(input.requested_at) ||
    !isNonBlankText(input.reason) ||
    !isDigest(input.adoption_state_digest) ||
    !isDigest(input.operations_policy_digest) ||
    !isDigest(input.actual_adoption_state_digest) ||
    !isDigest(input.actual_operations_policy_digest)
  ) {
    fail("ROLLBACK_REQUEST_INPUT_INVALID");
  }
  validateDryRun(input.dry_run);
}

function sameReference(left: EvidenceAdoptionReference, right: EvidenceAdoptionReference): boolean {
  return left.adoption_id === right.adoption_id && left.adoption_digest === right.adoption_digest;
}

function proposalIntent(
  input: GovernedRollbackRequestInput,
  predecessorEpoch: EvidenceAdoptionEpoch
): GovernedRollbackProposalIntent {
  const expectedAdoption = input.current_adoption;
  const proposalCommandFingerprint = stableSha256({
    action: "REQUEST",
    actor_id: input.actor_id,
    command_id: input.command_id,
    payload: {
      epoch: predecessorEpoch,
      expected_adoption: expectedAdoption
    }
  });
  const proposalBody: Omit<EvidenceAdoptionProposal, "proposal_digest"> = {
    proposal_id: `proposal_${proposalCommandFingerprint}`,
    epoch: clone(predecessorEpoch),
    expected_adoption: clone(expectedAdoption),
    requested_by: input.actor_id,
    requested_at: input.requested_at
  };
  return clone({ ...proposalBody, proposal_digest: stableSha256(proposalBody) });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function buildCandidate(input: GovernedRollbackRequestInput): GovernedRollbackRequestCandidate {
  const dryRun = input.dry_run;
  if (dryRun.status === "REBASE_REQUIRED") fail("ROLLBACK_REQUEST_REBASE_REQUIRED");
  if (dryRun.status !== "READY_WITH_LIMITS") fail("ROLLBACK_DRY_RUN_NOT_READY");
  if (
    dryRun.future_admission_impact !== "WOULD_SELECT_EXACT_PREDECESSOR" ||
    dryRun.blockers.length !== 0 ||
    dryRun.predecessor_currently_eligible !== true
  ) {
    fail("ROLLBACK_PREDECESSOR_NOT_ELIGIBLE");
  }
  if (dryRun.predecessor_epoch === null) fail("ROLLBACK_PREDECESSOR_NOT_ELIGIBLE");
  if (
    input.tenant_id !== dryRun.predecessor_epoch.tenant_id ||
    input.course_id !== dryRun.predecessor_epoch.course_id
  ) {
    fail("ROLLBACK_REQUEST_SCOPE_CONFLICT");
  }
  if (
    !sameReference(input.current_adoption, dryRun.current_adoption) ||
    !sameReference(input.predecessor_adoption, dryRun.predecessor_adoption) ||
    sameReference(input.current_adoption, input.predecessor_adoption)
  ) {
    fail("ROLLBACK_REQUEST_REBASE_REQUIRED");
  }
  if (
    input.adoption_state_digest !== input.actual_adoption_state_digest ||
    input.operations_policy_digest !== input.actual_operations_policy_digest ||
    dryRun.adoption_state_digest !== input.adoption_state_digest ||
    dryRun.operations_policy_digest !== input.operations_policy_digest
  ) {
    fail("ROLLBACK_REQUEST_REBASE_REQUIRED");
  }

  const predecessorEpoch = dryRun.predecessor_epoch;
  const proposal = proposalIntent(input, predecessorEpoch);
  const idempotencyFingerprint = stableSha256({
    action: "GOVERNED_ROLLBACK_REQUEST",
    actor_id: input.actor_id,
    command_id: input.command_id,
    tenant_id: input.tenant_id,
    course_id: input.course_id,
    reason: input.reason,
    current_adoption: input.current_adoption,
    predecessor_adoption: input.predecessor_adoption,
    dry_run_id: dryRun.dry_run_id,
    dry_run_digest: dryRun.dry_run_digest,
    adoption_state_digest: input.adoption_state_digest,
    operations_policy_digest: input.operations_policy_digest,
    predecessor_epoch: predecessorEpoch,
    linked_proposal_id: proposal.proposal_id
  });
  const requestBody: Omit<GovernedRollbackRequest, "request_digest"> = {
    request_id: `rollback_request_${idempotencyFingerprint}`,
    idempotency_fingerprint: idempotencyFingerprint,
    tenant_id: input.tenant_id,
    course_id: input.course_id,
    requested_by: input.actor_id,
    requester_role: input.role,
    command_id: input.command_id,
    requested_at: input.requested_at,
    reason: input.reason,
    dry_run_id: dryRun.dry_run_id,
    dry_run_digest: dryRun.dry_run_digest,
    current_adoption: clone(input.current_adoption),
    predecessor_adoption: clone(input.predecessor_adoption),
    predecessor_epoch: clone(predecessorEpoch),
    predecessor_qualification: {
      qualification_id: predecessorEpoch.qualification_id,
      qualification_content_digest: predecessorEpoch.qualification_content_digest
    },
    adoption_state_digest: input.adoption_state_digest,
    operations_policy_digest: input.operations_policy_digest,
    linked_proposal_id: proposal.proposal_id,
    linked_proposal_digest: proposal.proposal_digest,
    status: "LINKED_PROPOSAL_PENDING_REVIEW",
    current_selection_changed: false,
    rollback_applied: false,
    adoption_mutation: false,
    official_truth_write: false,
    history_deleted: false,
    historical_receipt_rewritten: false,
    provider: "OFF",
    advisory_only: true,
    writer_effect: "NONE"
  };
  const request = clone({
    ...requestBody,
    request_digest: stableSha256(requestBody)
  });
  return { request, proposal };
}

/**
 * Pure O7 request candidate builder. The returned O5 proposal is an intent,
 * not a persisted proposal; the existing MAIN_MODEL_GOVERNANCE writer must
 * perform the later atomic request-plus-proposal commit.
 */
export function createGovernedRollbackRequest(
  input: GovernedRollbackRequestInput
): GovernedRollbackRequestCandidate {
  try {
    validateInput(input);
    return buildCandidate(input);
  } catch (error) {
    if (error instanceof GovernedRollbackRequestError) throw error;
    fail("ROLLBACK_REQUEST_INPUT_INVALID");
  }
}

/** Integration-friendly alias; both names share the same pure implementation. */
export const buildGovernedRollbackRequest = createGovernedRollbackRequest;
