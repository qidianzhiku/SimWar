import type {
  EvidenceAdoptionEpoch,
  EvidenceAdoptionProposal,
  EvidenceAdoptionRecord,
  EvidenceAdoptionReference,
  EvidenceAdoptionReview,
  EvidenceAdoptionState
} from "@simwar/shared-contracts";

export type HistoricalOutcomeStatus =
  | "PENDING_REVIEW"
  | "REVIEW_REJECTED"
  | "APPROVED_PENDING_DISPOSITION"
  | "DEFERRED_WITH_EXPIRY"
  | "REJECTED_CANDIDATE"
  | "REBASE_REQUIRED"
  | "READOPTED_FOR_FUTURE_ADMISSION";

export type HistoricalCurrentEffect =
  | "CURRENT"
  | "SUPERSEDED"
  | "NOT_APPLICABLE"
  | "REBASE_REQUIRED";

export type HistoricalConsistencyStatus = "CONSISTENT" | "LIMITED" | "BLOCKED" | "INCONSISTENT";

export interface ReadoptionHistoricalConsistencyInput {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly current_adoption: EvidenceAdoptionReference;
  readonly target_adoption: EvidenceAdoptionReference;
  readonly proposal: EvidenceAdoptionProposal | null;
  readonly review: EvidenceAdoptionReview | null;
  readonly disposition: EvidenceAdoptionRecord | null;
  readonly adoption_state: EvidenceAdoptionState;
}

export interface ReadoptionHistoricalConsistency {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly current_adoption: EvidenceAdoptionReference;
  readonly target_adoption: EvidenceAdoptionReference;
  readonly outcome_status: HistoricalOutcomeStatus;
  readonly historical_outcome: {
    readonly status: HistoricalOutcomeStatus;
    readonly resulting_adoption: EvidenceAdoptionReference | null;
  };
  readonly resulting_adoption: EvidenceAdoptionReference | null;
  readonly current_effect: HistoricalCurrentEffect;
  readonly qualification_consistency: HistoricalConsistencyStatus;
  readonly historical_consistency: HistoricalConsistencyStatus;
  readonly lineage: {
    readonly target_epoch: EvidenceAdoptionEpoch | null;
    readonly resulting_predecessor: EvidenceAdoptionReference | null;
    readonly new_adoption_identity: boolean;
    readonly historical_records_preserved: true;
  };
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

function resultingReference(
  record: EvidenceAdoptionRecord | null
): EvidenceAdoptionReference | null {
  return record
    ? { adoption_id: record.adoption_id, adoption_digest: record.adoption_digest }
    : null;
}

function effect(
  state: EvidenceAdoptionState,
  current: EvidenceAdoptionReference,
  result: EvidenceAdoptionReference | null
): HistoricalCurrentEffect {
  if (!result) {
    return state.selections.some((selection) => sameReference(selection, current))
      ? "CURRENT"
      : "REBASE_REQUIRED";
  }
  if (state.selections.some((selection) => sameReference(selection, result))) return "CURRENT";
  return state.selections.length > 0 ? "SUPERSEDED" : "NOT_APPLICABLE";
}

function base(
  input: ReadoptionHistoricalConsistencyInput,
  outcomeStatus: HistoricalOutcomeStatus,
  resulting: EvidenceAdoptionReference | null,
  currentEffect: HistoricalCurrentEffect,
  qualificationConsistency: HistoricalConsistencyStatus,
  historicalConsistency: HistoricalConsistencyStatus,
  targetEpoch: EvidenceAdoptionEpoch | null,
  resultingPredecessor: EvidenceAdoptionReference | null,
  newAdoptionIdentity: boolean,
  knownLimits: readonly string[]
): ReadoptionHistoricalConsistency {
  return {
    tenant_id: input.tenant_id,
    course_id: input.course_id,
    current_adoption: clone(input.current_adoption),
    target_adoption: clone(input.target_adoption),
    outcome_status: outcomeStatus,
    historical_outcome: { status: outcomeStatus, resulting_adoption: resulting },
    resulting_adoption: resulting,
    current_effect: currentEffect,
    qualification_consistency: qualificationConsistency,
    historical_consistency: historicalConsistency,
    lineage: {
      target_epoch: targetEpoch ? clone(targetEpoch) : null,
      resulting_predecessor: resultingPredecessor ? clone(resultingPredecessor) : null,
      new_adoption_identity: newAdoptionIdentity,
      historical_records_preserved: true
    },
    known_limits: [
      "This is a read-only historical consistency assessment; it never applies rollback or changes adoption.",
      "Historical success and current eligibility/effect are separate predicates.",
      ...knownLimits
    ],
    provider: "OFF",
    advisory_only: true,
    rollback_applied: false,
    adoption_mutation: false,
    official_truth_write: false,
    history_deleted: false,
    historical_receipt_rewritten: false
  };
}

/**
 * Pure O8 A2 leaf. It validates the immutable readoption lineage and reports
 * later supersession without rewriting the original A/B history.
 */
export function assessReadoptionHistoricalConsistency(
  input: ReadoptionHistoricalConsistencyInput
): ReadoptionHistoricalConsistency {
  if (
    input.tenant_id !== input.adoption_state.tenant_id ||
    input.course_id !== input.adoption_state.course_id ||
    sameReference(input.current_adoption, input.target_adoption)
  ) {
    return base(
      input,
      "REBASE_REQUIRED",
      null,
      "REBASE_REQUIRED",
      "BLOCKED",
      "INCONSISTENT",
      null,
      null,
      false,
      ["Current and target adoption must be distinct and scoped exactly."]
    );
  }

  const proposal = input.proposal;
  const targetRecord = input.adoption_state.records.find((record) =>
    sameReference(record, input.target_adoption)
  );
  if (
    !proposal ||
    !sameReference(proposal.expected_adoption, input.current_adoption) ||
    !targetRecord ||
    !sameEpoch(targetRecord.epoch, proposal.epoch)
  ) {
    return base(
      input,
      "REBASE_REQUIRED",
      null,
      effect(input.adoption_state, input.current_adoption, null),
      "BLOCKED",
      "INCONSISTENT",
      null,
      null,
      false,
      [
        "The exact linked proposal and target adoption lineage are required; no implicit selection is allowed."
      ]
    );
  }

  const proposalRecords = input.adoption_state.records.filter(
    (record) =>
      record.proposal_id === proposal.proposal_id &&
      record.proposal_digest === proposal.proposal_digest
  );
  if (proposalRecords.length > 1) {
    return base(
      input,
      "REBASE_REQUIRED",
      null,
      "REBASE_REQUIRED",
      "INCONSISTENT",
      "INCONSISTENT",
      null,
      null,
      false,
      ["Multiple records for one proposal are fail-closed."]
    );
  }

  const record = proposalRecords[0] ?? null;
  if (!input.review) {
    return base(
      input,
      "PENDING_REVIEW",
      null,
      effect(input.adoption_state, input.current_adoption, null),
      "LIMITED",
      "CONSISTENT",
      proposal.epoch,
      null,
      false,
      ["Pending review is not rejection and does not alter the current selection."]
    );
  }
  if (
    input.review.proposal_id !== proposal.proposal_id ||
    input.review.proposal_digest !== proposal.proposal_digest
  ) {
    return base(
      input,
      "REBASE_REQUIRED",
      null,
      "REBASE_REQUIRED",
      "INCONSISTENT",
      "INCONSISTENT",
      null,
      null,
      false,
      ["Review linkage does not match the exact proposal."]
    );
  }
  if (input.review.decision === "REJECTED") {
    return base(
      input,
      "REVIEW_REJECTED",
      null,
      effect(input.adoption_state, input.current_adoption, null),
      "CONSISTENT",
      "CONSISTENT",
      proposal.epoch,
      null,
      false,
      ["The proposal was explicitly rejected; A/B history remains unchanged."]
    );
  }
  if (!record || !input.disposition) {
    return base(
      input,
      "APPROVED_PENDING_DISPOSITION",
      null,
      effect(input.adoption_state, input.current_adoption, null),
      "LIMITED",
      "CONSISTENT",
      proposal.epoch,
      null,
      false,
      [
        "Approval alone does not produce a re-adoption; the existing O5 disposition is still required."
      ]
    );
  }
  if (
    input.disposition.adoption_id !== record.adoption_id ||
    input.disposition.adoption_digest !== record.adoption_digest ||
    !sameEpoch(record.epoch, proposal.epoch) ||
    record.review_id !== input.review.review_id ||
    record.review_digest !== input.review.review_digest
  ) {
    return base(
      input,
      "REBASE_REQUIRED",
      null,
      "REBASE_REQUIRED",
      "INCONSISTENT",
      "INCONSISTENT",
      null,
      null,
      false,
      ["Disposition does not preserve the exact proposal/review lineage."]
    );
  }

  const result =
    record?.disposition === "ADOPTED_FOR_FUTURE_ADMISSION" ? resultingReference(record) : null;
  if (record.disposition !== "ADOPTED_FOR_FUTURE_ADMISSION") {
    return base(
      input,
      record.disposition,
      result,
      effect(input.adoption_state, input.current_adoption, result),
      "CONSISTENT",
      "CONSISTENT",
      record.epoch,
      record.predecessor,
      false,
      ["A deferred, rejected, or rebase disposition is historical evidence only."]
    );
  }

  const lineageValid =
    sameReference(record.predecessor, input.current_adoption) &&
    !sameReference(result, input.current_adoption) &&
    !sameReference(result, input.target_adoption) &&
    sameReference(proposal.expected_adoption, input.current_adoption);
  if (!lineageValid) {
    return base(
      input,
      "REBASE_REQUIRED",
      result,
      "REBASE_REQUIRED",
      "INCONSISTENT",
      "INCONSISTENT",
      record.epoch,
      record.predecessor,
      false,
      [
        "Readoption C must be a new identity whose predecessor is current B and whose epoch is historical A."
      ]
    );
  }
  return base(
    input,
    "READOPTED_FOR_FUTURE_ADMISSION",
    result,
    effect(input.adoption_state, input.current_adoption, result),
    "CONSISTENT",
    "CONSISTENT",
    record.epoch,
    record.predecessor,
    true,
    [
      "A/B historical records remain immutable; a later selection may supersede C without rewriting its outcome."
    ]
  );
}
