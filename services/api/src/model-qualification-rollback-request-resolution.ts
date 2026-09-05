import type {
  EvidenceAdoptionProposal,
  EvidenceAdoptionRecord,
  EvidenceAdoptionReference,
  EvidenceAdoptionReview,
  EvidenceAdoptionState,
  GovernedRollbackRequest
} from "@simwar/shared-contracts";
import { isPersistedGovernedRollbackRequest } from "./model-qualification-governed-rollback-request.js";
import { stableSha256 } from "./model-qualification-adoption-drift-assessment.js";

export type RollbackRequestOutcomeStatus =
  | "PENDING_REVIEW"
  | "REVIEW_REJECTED"
  | "APPROVED_PENDING_DISPOSITION"
  | "DEFERRED_WITH_EXPIRY"
  | "REJECTED_CANDIDATE"
  | "REBASE_REQUIRED"
  | "READOPTED_FOR_FUTURE_ADMISSION";

export type RollbackRequestCurrentEffect =
  | "CURRENT"
  | "SUPERSEDED"
  | "NOT_APPLICABLE"
  | "REBASE_REQUIRED";

export type RollbackRequestConsistencyStatus =
  | "CONSISTENT"
  | "LIMITED"
  | "BLOCKED"
  | "INCONSISTENT";

export class RollbackRequestOutcomeResolutionError extends Error {
  readonly code = "ROLLBACK_REQUEST_OUTCOME_INTEGRITY_FAILURE" as const;

  constructor() {
    super("ROLLBACK_REQUEST_OUTCOME_INTEGRITY_FAILURE");
    this.name = "RollbackRequestOutcomeResolutionError";
  }
}

export interface RollbackRequestOutcomeResolutionInput {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly request: GovernedRollbackRequest;
  readonly adoption_state: EvidenceAdoptionState;
}

export interface RollbackRequestOutcomeResolution {
  readonly resolution_id: string;
  readonly resolution_digest: string;
  readonly tenant_id: string;
  readonly course_id: string;
  readonly rollback_request_id: string;
  readonly rollback_request_digest: string;
  /** The request's persisted status is intentionally not rewritten by O8. */
  readonly immutable_request_status: GovernedRollbackRequest["status"];
  readonly request: GovernedRollbackRequest;
  readonly linked_proposal: EvidenceAdoptionProposal | null;
  readonly review: EvidenceAdoptionReview | null;
  readonly disposition: EvidenceAdoptionRecord | null;
  readonly resulting_adoption: EvidenceAdoptionReference | null;
  readonly outcome_status: RollbackRequestOutcomeStatus;
  readonly historical_outcome: {
    readonly status: RollbackRequestOutcomeStatus;
    readonly request_status: GovernedRollbackRequest["status"];
    readonly resulting_adoption: EvidenceAdoptionReference | null;
  };
  readonly current_effect: RollbackRequestCurrentEffect;
  readonly qualification_consistency: RollbackRequestConsistencyStatus;
  readonly historical_consistency: RollbackRequestConsistencyStatus;
  readonly known_limits: readonly string[];
  readonly provider: "OFF";
  readonly advisory_only: true;
  readonly rollback_applied: false;
  readonly adoption_mutation: false;
  readonly official_truth_write: false;
  readonly history_deleted: false;
  readonly historical_receipt_rewritten: false;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
    .join(",")}}`;
}

function sameReference(
  left: EvidenceAdoptionReference | null | undefined,
  right: EvidenceAdoptionReference | null | undefined
): boolean {
  return Boolean(
    left &&
    right &&
    left.adoption_id === right.adoption_id &&
    left.adoption_digest === right.adoption_digest
  );
}

function sameEpoch(left: unknown, right: unknown): boolean {
  return stable(left) === stable(right);
}

function resolutionDigest(resolution: Omit<RollbackRequestOutcomeResolution, "resolution_digest">) {
  return stableSha256(resolution);
}

function commonLimits(): string[] {
  return [
    "O8 is a derived query-only resolution; it never writes an outcome, adoption, Run, settlement, or official truth.",
    "Historical outcome is immutable evidence and is separate from current eligibility/effect.",
    "Provider is OFF; automatic/formal rollback is not performed."
  ];
}

function currentEffect(
  request: GovernedRollbackRequest,
  disposition: EvidenceAdoptionRecord | null,
  state: EvidenceAdoptionState
): RollbackRequestCurrentEffect {
  const resulting = disposition
    ? {
        adoption_id: disposition.adoption_id,
        adoption_digest: disposition.adoption_digest
      }
    : null;
  if (resulting) {
    if (state.selections.some((selection) => sameReference(selection, resulting))) return "CURRENT";
    return state.selections.length > 0 ? "SUPERSEDED" : "NOT_APPLICABLE";
  }
  return state.selections.some((selection) => sameReference(selection, request.current_adoption))
    ? "CURRENT"
    : "REBASE_REQUIRED";
}

function buildResolution(
  input: RollbackRequestOutcomeResolutionInput,
  linkedProposal: EvidenceAdoptionProposal | null,
  review: EvidenceAdoptionReview | null,
  disposition: EvidenceAdoptionRecord | null,
  outcomeStatus: RollbackRequestOutcomeStatus,
  qualificationConsistency: RollbackRequestConsistencyStatus,
  historicalConsistency: RollbackRequestConsistencyStatus,
  knownLimits: readonly string[]
): RollbackRequestOutcomeResolution {
  const resultingAdoption = disposition
    ? {
        adoption_id: disposition.adoption_id,
        adoption_digest: disposition.adoption_digest
      }
    : null;
  const body: Omit<RollbackRequestOutcomeResolution, "resolution_digest"> = {
    resolution_id: `rollback_outcome_${input.request.rollback_request_id}`,
    tenant_id: input.tenant_id,
    course_id: input.course_id,
    rollback_request_id: input.request.rollback_request_id,
    rollback_request_digest: input.request.rollback_request_digest,
    immutable_request_status: input.request.status,
    request: clone(input.request),
    linked_proposal: linkedProposal ? clone(linkedProposal) : null,
    review: review ? clone(review) : null,
    disposition: disposition ? clone(disposition) : null,
    resulting_adoption: resultingAdoption,
    outcome_status: outcomeStatus,
    historical_outcome: {
      status: outcomeStatus,
      request_status: input.request.status,
      resulting_adoption: resultingAdoption
    },
    current_effect: currentEffect(input.request, disposition, input.adoption_state),
    qualification_consistency: qualificationConsistency,
    historical_consistency: historicalConsistency,
    known_limits: [...commonLimits(), ...knownLimits],
    provider: "OFF",
    advisory_only: true,
    rollback_applied: false,
    adoption_mutation: false,
    official_truth_write: false,
    history_deleted: false,
    historical_receipt_rewritten: false
  };
  return { ...body, resolution_digest: resolutionDigest(body) };
}

/**
 * Resolve the exact immutable O7 request through the existing O5 chain.
 * This function is pure: it reads the supplied state and never mutates it.
 */
export function resolveRollbackRequestOutcome(
  input: RollbackRequestOutcomeResolutionInput
): RollbackRequestOutcomeResolution {
  const { request, adoption_state: state } = input;
  if (
    input.tenant_id !== state.tenant_id ||
    input.course_id !== state.course_id ||
    request.tenant_id !== input.tenant_id ||
    request.course_id !== input.course_id ||
    !isPersistedGovernedRollbackRequest(request)
  ) {
    throw new RollbackRequestOutcomeResolutionError();
  }

  const proposals = state.proposals.filter(
    (proposal) =>
      proposal.proposal_id === request.linked_proposal.proposal_id &&
      proposal.proposal_digest === request.linked_proposal.proposal_digest
  );
  if (proposals.length !== 1) {
    return buildResolution(input, null, null, null, "REBASE_REQUIRED", "BLOCKED", "INCONSISTENT", [
      "The immutable request does not have exactly one matching linked proposal."
    ]);
  }

  const proposal = proposals[0]!;
  const proposalIntegrity =
    sameEpoch(proposal.epoch, request.predecessor_epoch) &&
    sameReference(proposal.expected_adoption, request.current_adoption) &&
    proposal.requested_by === request.requested_by &&
    proposal.requested_at === request.requested_at;
  if (!proposalIntegrity) {
    return buildResolution(
      input,
      proposal,
      null,
      null,
      "REBASE_REQUIRED",
      "INCONSISTENT",
      "INCONSISTENT",
      ["The linked proposal identity or expected adoption conflicts with the immutable request."]
    );
  }

  const reviews = state.reviews.filter(
    (candidate) =>
      candidate.proposal_id === proposal.proposal_id &&
      candidate.proposal_digest === proposal.proposal_digest
  );
  const dispositions = state.records.filter(
    (candidate) =>
      candidate.proposal_id === proposal.proposal_id &&
      candidate.proposal_digest === proposal.proposal_digest
  );
  if (
    reviews.length > 1 ||
    dispositions.length > 1 ||
    (dispositions.length > 0 && reviews.length === 0)
  ) {
    return buildResolution(
      input,
      proposal,
      reviews.length === 1 ? reviews[0]! : null,
      dispositions.length === 1 ? dispositions[0]! : null,
      "REBASE_REQUIRED",
      "INCONSISTENT",
      "INCONSISTENT",
      ["Multiple or incomplete review/disposition linkage is fail-closed."]
    );
  }

  const review = reviews[0] ?? null;
  const disposition = dispositions[0] ?? null;
  if (disposition && review?.decision !== "APPROVED") {
    return buildResolution(
      input,
      proposal,
      review,
      disposition,
      "REBASE_REQUIRED",
      "INCONSISTENT",
      "INCONSISTENT",
      ["A disposition without one approved review cannot be treated as a valid outcome."]
    );
  }

  if (!review) {
    return buildResolution(input, proposal, null, null, "PENDING_REVIEW", "LIMITED", "CONSISTENT", [
      "No review exists yet; pending is not rejection and no adoption has changed."
    ]);
  }
  if (review.decision === "REJECTED") {
    return buildResolution(
      input,
      proposal,
      review,
      null,
      "REVIEW_REJECTED",
      "CONSISTENT",
      "CONSISTENT",
      ["The linked proposal was explicitly rejected; current selection remains unchanged."]
    );
  }
  if (!disposition) {
    return buildResolution(
      input,
      proposal,
      review,
      null,
      "APPROVED_PENDING_DISPOSITION",
      "LIMITED",
      "CONSISTENT",
      ["Review is approved, but the existing O5 disposition has not completed."]
    );
  }

  const dispositionMatches =
    sameEpoch(disposition.epoch, proposal.epoch) &&
    sameReference(proposal.expected_adoption, request.current_adoption) &&
    disposition.review_id === review.review_id &&
    disposition.review_digest === review.review_digest;
  if (!dispositionMatches) {
    return buildResolution(
      input,
      proposal,
      review,
      disposition,
      "REBASE_REQUIRED",
      "INCONSISTENT",
      "INCONSISTENT",
      ["The disposition does not preserve the exact proposal/review lineage."]
    );
  }
  const status: RollbackRequestOutcomeStatus =
    disposition.disposition === "ADOPTED_FOR_FUTURE_ADMISSION"
      ? "READOPTED_FOR_FUTURE_ADMISSION"
      : disposition.disposition;
  return buildResolution(
    input,
    proposal,
    review,
    disposition,
    status,
    "CONSISTENT",
    "CONSISTENT",
    status === "READOPTED_FOR_FUTURE_ADMISSION"
      ? [
          "The new adoption identity is resolved through the existing O5 disposition path; historical records remain read-only."
        ]
      : [
          "The recorded O5 disposition is historical evidence and does not apply rollback automatically."
        ]
  );
}
