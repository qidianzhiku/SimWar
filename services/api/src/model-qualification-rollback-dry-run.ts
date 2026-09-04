import { createHash } from "node:crypto";
import type {
  AdoptionDriftAssessment,
  AdoptionRollbackDryRun,
  AdoptionRollbackDryRunBlocker,
  AdoptionRollbackDryRunRequest,
  AdoptionRollbackDryRunStatus,
  EvidenceAdoptionEpoch,
  EvidenceAdoptionRecord,
  EvidenceAdoptionReference,
  EvidenceAdoptionState
} from "@simwar/shared-contracts";

/**
 * Inputs are deliberately materialized by the caller. This leaf does not
 * read a store, discover a current record, or perform an adoption mutation.
 */
export interface AdoptionRollbackDryRunInput extends AdoptionRollbackDryRunRequest {
  readonly adoption_state: EvidenceAdoptionState;
  readonly actual_adoption_state_digest: string;
  readonly actual_operations_policy_digest: string;
  readonly predecessor_assessment: AdoptionDriftAssessment;
}

const DRY_RUN_LIMITS = [
  "This is a pure dry-run candidate; it does not call a writer or mutate adoption state.",
  "Current and predecessor identities are exact adoption id and digest bindings.",
  "No implicit latest, current, default, fallback, or array-position selector is evaluated.",
  "The predecessor drift assessment is supplied evidence and is not recomputed by this leaf."
] as const;

function canonical(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? "undefined" : encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function clone<T>(value: T): T {
  return structuredClone(value);
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

function sameEpoch(left: EvidenceAdoptionEpoch, right: EvidenceAdoptionEpoch): boolean {
  return canonical(left) === canonical(right);
}

function isInStateScope(record: EvidenceAdoptionRecord, state: EvidenceAdoptionState): boolean {
  return record.epoch.tenant_id === state.tenant_id && record.epoch.course_id === state.course_id;
}

function isActiveCurrent(record: EvidenceAdoptionRecord, assessedAt: string): boolean {
  if (record.disposition !== "ADOPTED_FOR_FUTURE_ADMISSION") return false;
  const assessedTime = Date.parse(assessedAt);
  const decidedTime = Date.parse(record.decided_at);
  if (!Number.isFinite(assessedTime) || !Number.isFinite(decidedTime) || decidedTime > assessedTime) {
    return false;
  }
  for (const expiry of [record.expires_at, record.epoch.source_expires_at]) {
    if (expiry === null) continue;
    const expiryTime = Date.parse(expiry);
    if (!Number.isFinite(expiryTime) || expiryTime <= assessedTime) return false;
  }
  return true;
}

function selectionMatchesCurrent(
  state: EvidenceAdoptionState,
  currentRecord: EvidenceAdoptionRecord,
  current: EvidenceAdoptionReference
): boolean {
  const matchingTuple = state.selections.filter(
    (selection) =>
      canonical(selection.model_version_reference) ===
        canonical(currentRecord.epoch.model_version_reference) &&
      canonical(selection.model_artifact_reference) ===
        canonical(currentRecord.epoch.model_artifact_reference)
  );
  return matchingTuple.length === 1 && sameReference(matchingTuple[0], current);
}

function assessmentIsSafeAndHealthy(
  assessment: AdoptionDriftAssessment,
  assessedAt: string
): boolean {
  return (
    assessment.status === "HEALTHY" &&
    assessment.future_admission_impact === "UNCHANGED" &&
    assessment.issue_codes.length === 0 &&
    assessment.assessed_at === assessedAt &&
    assessment.provider === "OFF" &&
    assessment.advisory_only === true &&
    assessment.adoption_mutation === false &&
    assessment.official_truth_write === false
  );
}

function makeResult(
  input: AdoptionRollbackDryRunInput,
  outcome: {
    readonly status: AdoptionRollbackDryRunStatus;
    readonly predecessor_epoch: EvidenceAdoptionEpoch | null;
    readonly predecessor_currently_eligible: boolean;
    readonly future_admission_impact: AdoptionRollbackDryRun["future_admission_impact"];
    readonly blockers: readonly AdoptionRollbackDryRunBlocker[];
  }
): AdoptionRollbackDryRun {
  const identity = {
    assessed_at: input.assessed_at,
    current_adoption: input.current_adoption,
    predecessor_adoption: input.predecessor_adoption,
    expected_adoption_state_digest: input.expected_adoption_state_digest,
    expected_operations_policy_digest: input.expected_operations_policy_digest,
    actual_adoption_state_digest: input.actual_adoption_state_digest,
    actual_operations_policy_digest: input.actual_operations_policy_digest,
    predecessor_assessment: {
      assessment_id: input.predecessor_assessment.assessment_id,
      assessment_digest: input.predecessor_assessment.assessment_digest,
      adoption: input.predecessor_assessment.adoption,
      epoch: input.predecessor_assessment.epoch,
      adoption_state_digest: input.predecessor_assessment.adoption_state_digest,
      operations_policy_digest: input.predecessor_assessment.operations_policy_digest,
      status: input.predecessor_assessment.status
    },
    outcome
  };
  const body = {
    dry_run_id: `adoption-rollback-dry-run-${digest(identity)}`,
    assessed_at: input.assessed_at,
    current_adoption: clone(input.current_adoption),
    predecessor_adoption: clone(input.predecessor_adoption),
    predecessor_epoch: outcome.predecessor_epoch === null ? null : clone(outcome.predecessor_epoch),
    adoption_state_digest: input.actual_adoption_state_digest,
    operations_policy_digest: input.actual_operations_policy_digest,
    status: outcome.status,
    predecessor_currently_eligible: outcome.predecessor_currently_eligible,
    future_admission_impact: outcome.future_admission_impact,
    blockers: [...outcome.blockers],
    known_limits: [...DRY_RUN_LIMITS],
    provider: "OFF" as const,
    advisory_only: true as const,
    rollback_applied: false as const,
    adoption_mutation: false as const,
    official_truth_write: false as const,
    history_deleted: false as const,
    historical_receipt_rewritten: false as const
  } satisfies Omit<AdoptionRollbackDryRun, "dry_run_digest"> & { readonly dry_run_id: string };
  return clone({ ...body, dry_run_digest: digest(body) });
}

/**
 * Pure O6 rollback candidate evaluation. Every non-ready result is fail-closed;
 * this function never returns an instruction to mutate or rewrite history.
 */
export function runAdoptionRollbackDryRun(
  input: AdoptionRollbackDryRunInput
): AdoptionRollbackDryRun {
  const blockers: AdoptionRollbackDryRunBlocker[] = [];
  let requiresRebase = false;
  const addBlocker = (blocker: AdoptionRollbackDryRunBlocker): void => {
    if (!blockers.includes(blocker)) blockers.push(blocker);
  };

  if (input.expected_adoption_state_digest !== input.actual_adoption_state_digest) {
    addBlocker("ADOPTION_STATE_DIGEST_CHANGED");
    requiresRebase = true;
  }
  if (input.expected_operations_policy_digest !== input.actual_operations_policy_digest) {
    addBlocker("OPERATIONS_POLICY_DIGEST_CHANGED");
    requiresRebase = true;
  }

  const currentRecords = input.adoption_state.records.filter(
    (record) => record.adoption_id === input.current_adoption.adoption_id
  );
  const currentRecord =
    currentRecords.length === 1 &&
    sameReference(currentRecords[0], input.current_adoption) &&
    isInStateScope(currentRecords[0]!, input.adoption_state)
      ? currentRecords[0]!
      : undefined;

  if (currentRecord === undefined) {
    addBlocker("CURRENT_ADOPTION_NOT_FOUND");
  } else {
    if (!isActiveCurrent(currentRecord, input.assessed_at)) {
      addBlocker("CURRENT_ADOPTION_NOT_ACTIVE");
    }
    if (!selectionMatchesCurrent(input.adoption_state, currentRecord, input.current_adoption)) {
      addBlocker("ADOPTION_NOT_CURRENT");
      requiresRebase = true;
    }
    if (!sameReference(currentRecord.predecessor, input.predecessor_adoption)) {
      addBlocker("PREDECESSOR_REFERENCE_MISMATCH");
    }
  }

  const predecessorRecords = input.adoption_state.records.filter(
    (record) => record.adoption_id === input.predecessor_adoption.adoption_id
  );
  let predecessorRecord: EvidenceAdoptionRecord | undefined;
  let predecessorEpoch: EvidenceAdoptionEpoch | null = null;
  if (predecessorRecords.length === 0) {
    addBlocker("PREDECESSOR_NOT_FOUND");
  } else if (
    predecessorRecords.length !== 1 ||
    !sameReference(predecessorRecords[0], input.predecessor_adoption) ||
    !isInStateScope(predecessorRecords[0]!, input.adoption_state)
  ) {
    addBlocker("PREDECESSOR_REFERENCE_MISMATCH");
  } else {
    predecessorRecord = predecessorRecords[0]!;
    predecessorEpoch = clone(predecessorRecord.epoch);
    if (sameReference(predecessorRecord, input.current_adoption)) {
      addBlocker("PREDECESSOR_REFERENCE_MISMATCH");
    }
    if (predecessorRecord.disposition !== "ADOPTED_FOR_FUTURE_ADMISSION") {
      addBlocker("PREDECESSOR_NOT_HISTORICALLY_ADOPTED");
    } else if (!isActiveCurrent(predecessorRecord, input.assessed_at)) {
      addBlocker("PREDECESSOR_NOT_CURRENTLY_ELIGIBLE");
    }
  }

  if (predecessorRecord !== undefined) {
    const assessment = input.predecessor_assessment;
    const assessmentIdentityMatches =
      sameReference(assessment.adoption, input.predecessor_adoption) &&
      sameEpoch(assessment.epoch, predecessorRecord.epoch);
    if (!assessmentIdentityMatches) {
      addBlocker("PREDECESSOR_REFERENCE_MISMATCH");
    } else {
      if (assessment.adoption_state_digest !== input.expected_adoption_state_digest) {
        addBlocker("ADOPTION_STATE_DIGEST_CHANGED");
        requiresRebase = true;
      }
      if (assessment.operations_policy_digest !== input.expected_operations_policy_digest) {
        addBlocker("OPERATIONS_POLICY_DIGEST_CHANGED");
        requiresRebase = true;
      }
      if (assessment.status === "REBASE_REQUIRED" || assessment.future_admission_impact === "REBASE_REQUIRED") {
        requiresRebase = true;
      }
      if (!assessmentIsSafeAndHealthy(assessment, input.assessed_at)) {
        for (const issueCode of assessment.issue_codes) addBlocker(issueCode);
        addBlocker("PREDECESSOR_NOT_CURRENTLY_ELIGIBLE");
      }
    }
  }

  const missingPredecessor = blockers.includes("PREDECESSOR_NOT_FOUND");
  const status: AdoptionRollbackDryRunStatus = requiresRebase
    ? "REBASE_REQUIRED"
    : missingPredecessor
      ? "NO_PREDECESSOR"
      : blockers.length > 0
        ? "BLOCKED"
        : "READY_WITH_LIMITS";
  const predecessorCurrentlyEligible = status === "READY_WITH_LIMITS";
  const futureAdmissionImpact: AdoptionRollbackDryRun["future_admission_impact"] =
    status === "READY_WITH_LIMITS"
      ? "WOULD_SELECT_EXACT_PREDECESSOR"
      : status === "REBASE_REQUIRED"
        ? "REBASE_REQUIRED"
        : "BLOCKED";

  return makeResult(input, {
    status,
    predecessor_epoch: predecessorEpoch,
    predecessor_currently_eligible: predecessorCurrentlyEligible,
    future_admission_impact: futureAdmissionImpact,
    blockers
  });
}
