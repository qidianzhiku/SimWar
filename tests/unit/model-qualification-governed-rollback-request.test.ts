import { describe, expect, it } from "vitest";
import type {
  AdoptionDriftAssessment,
  AdoptionRollbackDryRun,
  EvidenceAdoptionRecord,
  EvidenceAdoptionState
} from "@simwar/shared-contracts";
import { stableSha256 } from "../../services/api/src/model-qualification-adoption-drift-assessment";
import { runAdoptionRollbackDryRun } from "../../services/api/src/model-qualification-rollback-dry-run";
import {
  createGovernedRollbackRequest,
  GovernedRollbackRequestError,
  type GovernedRollbackRequestInput
} from "../../services/api/src/model-qualification-governed-rollback-request";
import {
  EVIDENCE_ADOPTION_NOW,
  EVIDENCE_ADOPTION_SCOPE,
  EVIDENCE_ADOPTION_TEACHER,
  adoptionReference,
  createEvidenceAdoptionServiceFixture
} from "../helpers/model-qualification-evidence-adoption-fixtures";

const ADOPTION_STATE_DIGEST = "a".repeat(64);
const OPERATIONS_POLICY_DIGEST = "b".repeat(64);

interface AdoptionHistory {
  readonly state: EvidenceAdoptionState;
  readonly adoptionA: EvidenceAdoptionRecord;
  readonly adoptionB: EvidenceAdoptionRecord;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createAdoptedHistory(): AdoptionHistory {
  const { primary, service } = createEvidenceAdoptionServiceFixture();
  const adopt = (
    qualificationId: string,
    commandPrefix: string,
    expectedAdoption: EvidenceAdoptionRecord | null
  ): EvidenceAdoptionRecord => {
    const proposal = service.requestEvidenceAdoption(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: `${commandPrefix}-request`,
        qualification_id: qualificationId,
        expected_adoption: expectedAdoption ? adoptionReference(expectedAdoption) : null
      }
    ).proposal;
    service.reviewEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, EVIDENCE_ADOPTION_SCOPE, {
      command_id: `${commandPrefix}-review`,
      proposal_id: proposal.proposal_id,
      proposal_digest: proposal.proposal_digest,
      decision: "APPROVED",
      note: `Approve ${commandPrefix}.`
    });
    return service.disposeEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, EVIDENCE_ADOPTION_SCOPE, {
      command_id: `${commandPrefix}-dispose`,
      proposal_id: proposal.proposal_id,
      proposal_digest: proposal.proposal_digest,
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: `Adopt ${commandPrefix} for future admission.`
    }).adoption;
  };

  const adoptionA = adopt(primary.qualificationA.qualification_id, "rollback-a", null);
  const adoptionB = adopt(primary.qualificationB.qualification_id, "rollback-b", adoptionA);
  return {
    adoptionA,
    adoptionB,
    state: service.getEvidenceAdoptionState(primary.actor, primary.scope)
  };
}

function createHealthyPredecessorAssessment(history: AdoptionHistory): AdoptionDriftAssessment {
  const body: Omit<AdoptionDriftAssessment, "assessment_digest"> = {
    assessment_id: "assessment-predecessor-a",
    assessed_at: EVIDENCE_ADOPTION_NOW,
    adoption: adoptionReference(history.adoptionA),
    adoption_state_digest: ADOPTION_STATE_DIGEST,
    epoch: clone(history.adoptionA.epoch),
    operations_policy_digest: OPERATIONS_POLICY_DIGEST,
    status: "HEALTHY",
    future_admission_impact: "UNCHANGED",
    issue_codes: [],
    known_limits: ["A1 test assessment is supplied O6 evidence."],
    provider: "OFF",
    advisory_only: true,
    adoption_mutation: false,
    official_truth_write: false
  };
  return { ...body, assessment_digest: stableSha256(body) };
}

function createReadyDryRun(history: AdoptionHistory): AdoptionRollbackDryRun {
  return runAdoptionRollbackDryRun({
    current_adoption: adoptionReference(history.adoptionB),
    predecessor_adoption: adoptionReference(history.adoptionA),
    expected_adoption_state_digest: ADOPTION_STATE_DIGEST,
    expected_operations_policy_digest: OPERATIONS_POLICY_DIGEST,
    assessed_at: EVIDENCE_ADOPTION_NOW,
    adoption_state: clone(history.state),
    actual_adoption_state_digest: ADOPTION_STATE_DIGEST,
    actual_operations_policy_digest: OPERATIONS_POLICY_DIGEST,
    predecessor_assessment: createHealthyPredecessorAssessment(history)
  });
}

function createInput(
  history: AdoptionHistory,
  dryRun = createReadyDryRun(history),
  overrides: Partial<GovernedRollbackRequestInput> = {}
): GovernedRollbackRequestInput {
  return {
    tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
    course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
    actor_id: EVIDENCE_ADOPTION_TEACHER.actor_id,
    role: "teacher",
    command_id: "o7-governed-rollback-request",
    requested_at: EVIDENCE_ADOPTION_NOW,
    reason: "Re-adopt exact historical epoch A after governed review.",
    current_adoption: adoptionReference(history.adoptionB),
    predecessor_adoption: adoptionReference(history.adoptionA),
    adoption_state_digest: ADOPTION_STATE_DIGEST,
    operations_policy_digest: OPERATIONS_POLICY_DIGEST,
    actual_adoption_state_digest: ADOPTION_STATE_DIGEST,
    actual_operations_policy_digest: OPERATIONS_POLICY_DIGEST,
    dry_run: dryRun,
    ...overrides
  };
}

function resignDryRun(
  dryRun: AdoptionRollbackDryRun,
  changes: Partial<AdoptionRollbackDryRun>
): AdoptionRollbackDryRun {
  const unsigned = { ...dryRun, ...changes };
  const body = Object.fromEntries(
    Object.entries(unsigned).filter(([key]) => key !== "dry_run_digest")
  ) as Omit<AdoptionRollbackDryRun, "dry_run_digest">;
  return { ...body, dry_run_digest: stableSha256(body) };
}

function expectFailure(
  input: GovernedRollbackRequestInput,
  code: GovernedRollbackRequestError["code"]
): void {
  try {
    createGovernedRollbackRequest(input);
    throw new Error("expected governed rollback request failure");
  } catch (error) {
    expect(error).toBeInstanceOf(GovernedRollbackRequestError);
    expect((error as GovernedRollbackRequestError).code).toBe(code);
  }
}

describe("O7 governed rollback request domain leaf", () => {
  it("binds exact B to exact predecessor A and predicts one standard O5 proposal without effects", () => {
    const history = createAdoptedHistory();
    const result = createGovernedRollbackRequest(createInput(history));

    expect(result.request).toMatchObject({
      tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
      course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
      requested_by: EVIDENCE_ADOPTION_TEACHER.actor_id,
      requester_role: "teacher",
      command_id: "o7-governed-rollback-request",
      requested_at: EVIDENCE_ADOPTION_NOW,
      reason: "Re-adopt exact historical epoch A after governed review.",
      dry_run_id: result.request.dry_run_id,
      dry_run_digest: result.request.dry_run_digest,
      current_adoption: adoptionReference(history.adoptionB),
      predecessor_adoption: adoptionReference(history.adoptionA),
      predecessor_epoch: history.adoptionA.epoch,
      adoption_state_digest: ADOPTION_STATE_DIGEST,
      operations_policy_digest: OPERATIONS_POLICY_DIGEST,
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
    });
    expect(result.request.dry_run_id).toBe(createReadyDryRun(history).dry_run_id);
    expect(result.request.dry_run_digest).toBe(createReadyDryRun(history).dry_run_digest);
    expect(result.request.linked_proposal_id).toBe(result.proposal.proposal_id);
    expect(result.request.linked_proposal_digest).toBe(result.proposal.proposal_digest);
    expect(result.request.request_id).toMatch(/^rollback_request_[a-f0-9]{64}$/u);
    expect(result.request.request_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.request.idempotency_fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.proposal).toMatchObject({
      epoch: history.adoptionA.epoch,
      expected_adoption: adoptionReference(history.adoptionB),
      requested_by: EVIDENCE_ADOPTION_TEACHER.actor_id,
      requested_at: EVIDENCE_ADOPTION_NOW
    });
    expect(result.proposal.proposal_id).toMatch(/^proposal_[a-f0-9]{64}$/u);
    expect(result.proposal.proposal_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(history.state.selections).toEqual([
      expect.objectContaining(adoptionReference(history.adoptionB))
    ]);
  });

  it("is deterministic for the same exact input and does not mutate its input", () => {
    const history = createAdoptedHistory();
    const input = createInput(history);
    const before = clone(input);

    const first = createGovernedRollbackRequest(input);
    const second = createGovernedRollbackRequest(clone(input));

    expect(second).toEqual(first);
    expect(input).toEqual(before);
  });

  it("changes the idempotency fingerprint when the request payload changes", () => {
    const history = createAdoptedHistory();
    const first = createGovernedRollbackRequest(createInput(history));
    const changed = createGovernedRollbackRequest(
      createInput(history, undefined, {
        reason: "A different governed reason changes the request payload."
      })
    );

    expect(changed.request.idempotency_fingerprint).not.toBe(first.request.idempotency_fingerprint);
    expect(changed.request.request_id).not.toBe(first.request.request_id);
  });

  it.each([
    ["BLOCKED", "ROLLBACK_DRY_RUN_NOT_READY"],
    ["NO_PREDECESSOR", "ROLLBACK_DRY_RUN_NOT_READY"],
    ["REBASE_REQUIRED", "ROLLBACK_REQUEST_REBASE_REQUIRED"]
  ] as const)("rejects a %s O6 dry-run", (status, code) => {
    const history = createAdoptedHistory();
    const dryRun = resignDryRun(createReadyDryRun(history), { status });

    expectFailure(createInput(history, dryRun), code);
  });

  it("rejects a stale current selection or moved state/policy digest", () => {
    const history = createAdoptedHistory();
    const ready = createReadyDryRun(history);

    expectFailure(
      createInput(history, ready, {
        current_adoption: {
          ...adoptionReference(history.adoptionB),
          adoption_digest: "c".repeat(64)
        }
      }),
      "ROLLBACK_REQUEST_REBASE_REQUIRED"
    );
    expectFailure(
      createInput(history, ready, { actual_adoption_state_digest: "d".repeat(64) }),
      "ROLLBACK_REQUEST_REBASE_REQUIRED"
    );
    expectFailure(
      createInput(history, ready, { actual_operations_policy_digest: "e".repeat(64) }),
      "ROLLBACK_REQUEST_REBASE_REQUIRED"
    );
  });

  it("rejects wrong scope, forbidden role, reserved selectors, and an ineligible/null predecessor", () => {
    const history = createAdoptedHistory();
    const ready = createReadyDryRun(history);

    expectFailure(
      createInput(history, ready, { course_id: "course_other" }),
      "ROLLBACK_REQUEST_SCOPE_CONFLICT"
    );
    expectFailure(
      createInput(history, ready, { role: "student" as "teacher" }),
      "ROLLBACK_REQUEST_ROLE_FORBIDDEN"
    );
    expectFailure(
      createInput(history, ready, { command_id: "latest" }),
      "ROLLBACK_REQUEST_SELECTOR_INVALID"
    );
    expectFailure(
      createInput(history, resignDryRun(ready, { predecessor_currently_eligible: false })),
      "ROLLBACK_PREDECESSOR_NOT_ELIGIBLE"
    );
    expectFailure(
      createInput(history, resignDryRun(ready, { predecessor_epoch: null })),
      "ROLLBACK_PREDECESSOR_NOT_ELIGIBLE"
    );
  });

  it("rejects a tampered dry-run digest and malformed adoption selectors", () => {
    const history = createAdoptedHistory();
    const ready = createReadyDryRun(history);

    expectFailure(
      createInput(history, { ...ready, dry_run_digest: "0".repeat(64) }),
      "ROLLBACK_REQUEST_DIGEST_CONFLICT"
    );
    expectFailure(
      createInput(history, ready, {
        predecessor_adoption: { adoption_id: "", adoption_digest: "0".repeat(64) }
      }),
      "ROLLBACK_REQUEST_SELECTOR_INVALID"
    );
  });
});
