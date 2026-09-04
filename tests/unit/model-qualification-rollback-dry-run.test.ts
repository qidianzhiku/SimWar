import { describe, expect, it } from "vitest";
import type {
  AdoptionDriftAssessment,
  AdoptionRollbackDryRun,
  EvidenceAdoptionRecord,
  EvidenceAdoptionState
} from "@simwar/shared-contracts";
import {
  runAdoptionRollbackDryRun,
  type AdoptionRollbackDryRunInput
} from "../../services/api/src/model-qualification-rollback-dry-run";
import {
  EVIDENCE_ADOPTION_NOW,
  EVIDENCE_ADOPTION_SCOPE,
  EVIDENCE_ADOPTION_TEACHER,
  adoptionReference,
  createEvidenceAdoptionServiceFixture
} from "../helpers/model-qualification-evidence-adoption-fixtures";

const STATE_DIGEST = "a".repeat(64);
const POLICY_DIGEST = "b".repeat(64);

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

function createAssessment(
  history: AdoptionHistory,
  overrides: Partial<AdoptionDriftAssessment> = {}
): AdoptionDriftAssessment {
  return {
    assessment_id: "assessment-predecessor-a",
    assessment_digest: "c".repeat(64),
    assessed_at: EVIDENCE_ADOPTION_NOW,
    adoption: adoptionReference(history.adoptionA),
    adoption_state_digest: STATE_DIGEST,
    epoch: clone(history.adoptionA.epoch),
    operations_policy_digest: POLICY_DIGEST,
    status: "HEALTHY",
    future_admission_impact: "UNCHANGED",
    issue_codes: [],
    known_limits: ["A2 is a dry-run candidate only."],
    provider: "OFF",
    advisory_only: true,
    adoption_mutation: false,
    official_truth_write: false,
    ...overrides
  };
}

function createInput(
  history: AdoptionHistory,
  overrides: Partial<AdoptionRollbackDryRunInput> = {}
): AdoptionRollbackDryRunInput {
  return {
    current_adoption: adoptionReference(history.adoptionB),
    predecessor_adoption: adoptionReference(history.adoptionA),
    expected_adoption_state_digest: STATE_DIGEST,
    expected_operations_policy_digest: POLICY_DIGEST,
    assessed_at: EVIDENCE_ADOPTION_NOW,
    adoption_state: clone(history.state),
    actual_adoption_state_digest: STATE_DIGEST,
    actual_operations_policy_digest: POLICY_DIGEST,
    predecessor_assessment: createAssessment(history),
    ...overrides
  };
}

function expectDryRunSafety(result: AdoptionRollbackDryRun): void {
  expect(result.provider).toBe("OFF");
  expect(result.advisory_only).toBe(true);
  expect(result.rollback_applied).toBe(false);
  expect(result.adoption_mutation).toBe(false);
  expect(result.official_truth_write).toBe(false);
  expect(result.history_deleted).toBe(false);
  expect(result.historical_receipt_rewritten).toBe(false);
  expect(result.dry_run_digest).toMatch(/^[a-f0-9]{64}$/u);
}

describe("O6 adoption rollback dry-run leaf", () => {
  it("returns a ready dry-run only for the exact active current adoption and healthy predecessor", () => {
    const history = createAdoptedHistory();
    const result = runAdoptionRollbackDryRun(createInput(history));

    expect(result).toMatchObject({
      current_adoption: adoptionReference(history.adoptionB),
      predecessor_adoption: adoptionReference(history.adoptionA),
      predecessor_epoch: history.adoptionA.epoch,
      adoption_state_digest: STATE_DIGEST,
      operations_policy_digest: POLICY_DIGEST,
      status: "READY_WITH_LIMITS",
      predecessor_currently_eligible: true,
      future_admission_impact: "WOULD_SELECT_EXACT_PREDECESSOR",
      blockers: []
    });
    expectDryRunSafety(result);
  });

  it("returns NO_PREDECESSOR when the requested exact predecessor is absent", () => {
    const history = createAdoptedHistory();
    const missing = { adoption_id: "adoption-missing", adoption_digest: "d".repeat(64) };
    const result = runAdoptionRollbackDryRun(
      createInput(history, { predecessor_adoption: missing })
    );

    expect(result.status).toBe("NO_PREDECESSOR");
    expect(result.blockers).toContain("PREDECESSOR_NOT_FOUND");
    expect(result.predecessor_epoch).toBeNull();
    expect(result.future_admission_impact).toBe("BLOCKED");
    expectDryRunSafety(result);
  });

  it("blocks when the current adoption predecessor reference is not the requested exact predecessor", () => {
    const history = createAdoptedHistory();
    const result = runAdoptionRollbackDryRun(
      createInput(history, { predecessor_adoption: adoptionReference(history.adoptionB) })
    );

    expect(result.status).toBe("BLOCKED");
    expect(result.blockers).toContain("PREDECESSOR_REFERENCE_MISMATCH");
    expectDryRunSafety(result);
  });

  it("blocks an inactive current adoption even when its selection pointer still names it", () => {
    const history = createAdoptedHistory();
    const inactiveState: EvidenceAdoptionState = {
      ...history.state,
      records: history.state.records.map((record) =>
        record.adoption_id === history.adoptionB.adoption_id
          ? { ...record, disposition: "REBASE_REQUIRED" as const }
          : record
      )
    };

    const result = runAdoptionRollbackDryRun(
      createInput(history, { adoption_state: inactiveState })
    );

    expect(result.status).toBe("BLOCKED");
    expect(result.blockers).toContain("CURRENT_ADOPTION_NOT_ACTIVE");
    expectDryRunSafety(result);
  });

  it("requires the exact predecessor record to be historically ADOPTED", () => {
    const history = createAdoptedHistory();
    const nonAdoptedState: EvidenceAdoptionState = {
      ...history.state,
      records: history.state.records.map((record) =>
        record.adoption_id === history.adoptionA.adoption_id
          ? { ...record, disposition: "DEFERRED_WITH_EXPIRY" as const }
          : record
      )
    };

    const result = runAdoptionRollbackDryRun(
      createInput(history, { adoption_state: nonAdoptedState })
    );

    expect(result.status).toBe("BLOCKED");
    expect(result.blockers).toContain("PREDECESSOR_NOT_HISTORICALLY_ADOPTED");
    expectDryRunSafety(result);
  });

  it("blocks an expired predecessor even when a supplied assessment falsely says HEALTHY", () => {
    const history = createAdoptedHistory();
    const stalePredecessor: EvidenceAdoptionRecord = {
      ...history.adoptionA,
      epoch: {
        ...history.adoptionA.epoch,
        source_expires_at: "2026-01-01T00:00:00.000Z"
      }
    };
    const staleHistory: AdoptionHistory = {
      ...history,
      adoptionA: stalePredecessor,
      state: {
        ...history.state,
        records: history.state.records.map((record) =>
          record.adoption_id === stalePredecessor.adoption_id ? stalePredecessor : record
        )
      }
    };

    const result = runAdoptionRollbackDryRun(createInput(staleHistory));

    expect(result.status).toBe("BLOCKED");
    expect(result.blockers).toContain("PREDECESSOR_NOT_CURRENTLY_ELIGIBLE");
    expectDryRunSafety(result);
  });

  it.each([
    { status: "REVIEW_REQUIRED" as const, issue_codes: ["SOURCE_NOT_FRESH" as const] },
    {
      status: "FUTURE_ADMISSION_BLOCKED" as const,
      issue_codes: ["REQUALIFICATION_UNRESOLVED" as const]
    }
  ])("blocks a predecessor whose supplied assessment is $status", ({ status, issue_codes }) => {
    const history = createAdoptedHistory();
    const result = runAdoptionRollbackDryRun(
      createInput(history, {
        predecessor_assessment: createAssessment(history, {
          status,
          future_admission_impact: "BLOCKED",
          issue_codes
        })
      })
    );

    expect(result.status).toBe("BLOCKED");
    expect(result.predecessor_currently_eligible).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([...issue_codes, "PREDECESSOR_NOT_CURRENTLY_ELIGIBLE"])
    );
    expectDryRunSafety(result);
  });

  it("blocks an assessment that names a different predecessor instead of trusting historical readability", () => {
    const history = createAdoptedHistory();
    const result = runAdoptionRollbackDryRun(
      createInput(history, {
        predecessor_assessment: createAssessment(history, {
          adoption: adoptionReference(history.adoptionB),
          epoch: clone(history.adoptionB.epoch)
        })
      })
    );

    expect(result.status).toBe("BLOCKED");
    expect(result.blockers).toContain("PREDECESSOR_REFERENCE_MISMATCH");
    expectDryRunSafety(result);
  });

  it("returns REBASE_REQUIRED when the adoption state digest moved", () => {
    const history = createAdoptedHistory();
    const result = runAdoptionRollbackDryRun(
      createInput(history, { actual_adoption_state_digest: "e".repeat(64) })
    );

    expect(result.status).toBe("REBASE_REQUIRED");
    expect(result.future_admission_impact).toBe("REBASE_REQUIRED");
    expect(result.blockers).toContain("ADOPTION_STATE_DIGEST_CHANGED");
    expect(result.adoption_state_digest).toBe("e".repeat(64));
    expectDryRunSafety(result);
  });

  it("returns REBASE_REQUIRED when the versioned operations policy digest moved", () => {
    const history = createAdoptedHistory();
    const result = runAdoptionRollbackDryRun(
      createInput(history, { actual_operations_policy_digest: "f".repeat(64) })
    );

    expect(result.status).toBe("REBASE_REQUIRED");
    expect(result.future_admission_impact).toBe("REBASE_REQUIRED");
    expect(result.blockers).toContain("OPERATIONS_POLICY_DIGEST_CHANGED");
    expect(result.operations_policy_digest).toBe("f".repeat(64));
    expectDryRunSafety(result);
  });

  it("returns REBASE_REQUIRED when the supplied predecessor assessment has a stale state digest", () => {
    const history = createAdoptedHistory();
    const result = runAdoptionRollbackDryRun(
      createInput(history, {
        predecessor_assessment: createAssessment(history, {
          adoption_state_digest: "e".repeat(64)
        })
      })
    );

    expect(result.status).toBe("REBASE_REQUIRED");
    expect(result.future_admission_impact).toBe("REBASE_REQUIRED");
    expect(result.blockers).toContain("ADOPTION_STATE_DIGEST_CHANGED");
    expectDryRunSafety(result);
  });

  it("returns REBASE_REQUIRED when the exact active selection has moved away from current adoption", () => {
    const history = createAdoptedHistory();
    const movedState: EvidenceAdoptionState = {
      ...history.state,
      selections: history.state.selections.map((candidate) =>
        candidate.adoption_id === history.adoptionB.adoption_id
          ? {
              ...candidate,
              adoption_id: history.adoptionA.adoption_id,
              adoption_digest: history.adoptionA.adoption_digest
            }
          : candidate
      )
    };

    const result = runAdoptionRollbackDryRun(
      createInput(history, {
        adoption_state: movedState
      })
    );

    expect(result.status).toBe("REBASE_REQUIRED");
    expect(result.future_admission_impact).toBe("REBASE_REQUIRED");
    expect(result.blockers).toContain("ADOPTION_NOT_CURRENT");
    expectDryRunSafety(result);
  });

  it.each([
    {
      name: "duplicate predecessor record",
      mutate: (state: EvidenceAdoptionState, history: AdoptionHistory): EvidenceAdoptionState => ({
        ...state,
        records: [...state.records, clone(history.adoptionA)]
      })
    },
    {
      name: "conflicting predecessor record digest",
      mutate: (state: EvidenceAdoptionState, history: AdoptionHistory): EvidenceAdoptionState => ({
        ...state,
        records: [
          ...state.records,
          { ...clone(history.adoptionA), adoption_digest: "f".repeat(64) }
        ]
      })
    }
  ])("blocks a $name instead of choosing one record by array position", ({ mutate }) => {
    const history = createAdoptedHistory();
    const conflictingState = mutate(clone(history.state), history);

    const result = runAdoptionRollbackDryRun(
      createInput(history, { adoption_state: conflictingState })
    );

    expect(result.status).toBe("BLOCKED");
    expect(result.blockers).toContain("PREDECESSOR_REFERENCE_MISMATCH");
    expectDryRunSafety(result);
  });

  it("is deterministic for an identical retry", () => {
    const history = createAdoptedHistory();
    const input = createInput(history);

    expect(runAdoptionRollbackDryRun(input)).toEqual(runAdoptionRollbackDryRun(clone(input)));
  });

  it("does not mutate the request, assessment, state, or nested historical records", () => {
    const history = createAdoptedHistory();
    const input = createInput(history);
    const before = clone(input);

    runAdoptionRollbackDryRun(input);

    expect(input).toEqual(before);
  });
});
