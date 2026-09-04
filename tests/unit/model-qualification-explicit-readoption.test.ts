import { describe, expect, it } from "vitest";
import type {
  EvidenceAdoptionEpoch,
  EvidenceAdoptionRecord,
  EvidenceAdoptionReference,
  EvidenceAdoptionState,
  ModelArtifactReference,
  ModelVersionReference
} from "@simwar/shared-contracts";
import {
  createEvidenceEpoch,
  disposeEvidenceAdoption,
  emptyEvidenceAdoptionState,
  requestEvidenceAdoption,
  reviewEvidenceAdoption
} from "../../services/api/src/model-qualification-evidence-adoption";
import {
  EXPLICIT_READOPTION_ERROR_CODES,
  ExplicitReadoptionError,
  classifyExplicitReadoptionTarget,
  predictExplicitReadoption,
  type ExplicitReadoptionPredictionInput,
  type ExplicitReadoptionRollbackBasis
} from "../../services/api/src/model-qualification-explicit-readoption";

const TENANT_ID = "tenant-a1";
const COURSE_ID = "course-a1";
const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);
const DIGEST_C = "c".repeat(64);
const DIGEST_D = "d".repeat(64);
const DIGEST_E = "e".repeat(64);

const MODEL_VERSION: ModelVersionReference = {
  content_digest: DIGEST_A,
  model_version_id: "model-v1",
  version: "1.0.0"
};

const MODEL_ARTIFACT: ModelArtifactReference = {
  artifact_id: "artifact-v1",
  content_digest: DIGEST_B,
  format: "onnx",
  source_ref: "artifact://model-v1"
};

interface AdoptionHistory {
  readonly state: EvidenceAdoptionState;
  readonly adoptionA: EvidenceAdoptionRecord;
  readonly adoptionB: EvidenceAdoptionRecord;
}

function epoch(version: "A" | "B" | "C" | "NEW"): EvidenceAdoptionEpoch {
  const suffix = version.toLowerCase();
  return createEvidenceEpoch({
    calibration_dataset_content_digest: DIGEST_D,
    calibration_dataset_id: `dataset-${suffix}`,
    course_id: COURSE_ID,
    model_artifact_reference: { ...MODEL_ARTIFACT },
    model_version_reference: { ...MODEL_VERSION },
    qualification_content_digest: DIGEST_C,
    qualification_id: `qualification-${suffix}`,
    source_content_digest: DIGEST_A,
    source_expires_at: "2030-01-01T00:00:00Z",
    source_package_id: `source-${suffix}`,
    tenant_id: TENANT_ID
  });
}

function adoptionReference(record: EvidenceAdoptionRecord): EvidenceAdoptionReference {
  return {
    adoption_digest: record.adoption_digest,
    adoption_id: record.adoption_id
  };
}

function context(command_id: string, now: string, role: "teacher" | "tenant_admin") {
  return {
    actor_id: role === "teacher" ? "teacher-a1" : "admin-a1",
    command_id,
    course_id: COURSE_ID,
    now,
    role,
    tenant_id: TENANT_ID
  } as const;
}

function adopt(
  state: EvidenceAdoptionState,
  requestedEpoch: EvidenceAdoptionEpoch,
  suffix: string,
  expected_adoption: EvidenceAdoptionReference | null = null
): { readonly state: EvidenceAdoptionState; readonly record: EvidenceAdoptionRecord } {
  const requested = requestEvidenceAdoption(
    state,
    context(`${suffix}-request`, "2029-01-01T00:00:00Z", "teacher"),
    { epoch: requestedEpoch, expected_adoption }
  );
  const reviewed = reviewEvidenceAdoption(
    requested.state,
    context(`${suffix}-review`, "2029-01-01T00:01:00Z", "tenant_admin"),
    {
      decision: "APPROVED",
      note: `${suffix} reviewed`,
      proposal_digest: requested.receipt.proposal_digest,
      proposal_id: requested.receipt.proposal_id
    }
  );
  const disposed = disposeEvidenceAdoption(
    reviewed.state,
    context(`${suffix}-dispose`, "2029-01-01T00:02:00Z", "tenant_admin"),
    {
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: `${suffix} adopted`,
      proposal_digest: requested.receipt.proposal_digest,
      proposal_id: requested.receipt.proposal_id
    }
  );
  return { record: disposed.receipt, state: disposed.state };
}

function createHistory(): AdoptionHistory {
  const first = adopt(emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID), epoch("A"), "a");
  const second = adopt(first.state, epoch("B"), "b", adoptionReference(first.record));
  return { adoptionA: first.record, adoptionB: second.record, state: second.state };
}

function basis(
  history: AdoptionHistory,
  overrides: Partial<ExplicitReadoptionRollbackBasis> = {}
): ExplicitReadoptionRollbackBasis {
  return {
    course_id: COURSE_ID,
    current_adoption: adoptionReference(history.adoptionB),
    linked_proposal_digest: DIGEST_E,
    linked_proposal_id: "proposal-readoption-a",
    rollback_request_digest: DIGEST_D,
    rollback_request_id: "rollback-request-a",
    target_adoption: adoptionReference(history.adoptionA),
    tenant_id: TENANT_ID,
    ...overrides
  };
}

function input(
  history: AdoptionHistory,
  overrides: Partial<ExplicitReadoptionPredictionInput> = {}
): ExplicitReadoptionPredictionInput {
  return {
    adoption_state: history.state,
    course_id: COURSE_ID,
    current_adoption: adoptionReference(history.adoptionB),
    rollback_basis: basis(history),
    target: {
      adoption: adoptionReference(history.adoptionA),
      epoch: history.adoptionA.epoch
    },
    tenant_id: TENANT_ID,
    ...overrides
  };
}

function expectReadoptionError(operation: () => unknown, code: string): void {
  try {
    operation();
    throw new Error("expected_explicit_readoption_error");
  } catch (error) {
    if (error instanceof Error && error.message === "expected_explicit_readoption_error") {
      throw error;
    }
    expect(error).toBeInstanceOf(ExplicitReadoptionError);
    expect((error as ExplicitReadoptionError).code).toBe(code);
    expect((error as Error).message).toBe(code);
  }
}

describe("O7 explicit readoption transition pure domain", () => {
  it("classifies genuinely new evidence as eligible for the ordinary O5 request path", () => {
    const history = createHistory();
    const result = classifyExplicitReadoptionTarget({
      adoption_state: history.state,
      course_id: COURSE_ID,
      current_adoption: adoptionReference(history.adoptionB),
      target: { adoption: null, epoch: epoch("NEW") },
      tenant_id: TENANT_ID
    });

    expect(result).toMatchObject({
      classification: "ORDINARY_NEW_EVIDENCE",
      historical_lineage: false,
      requires_rollback_request: false,
      standard_o5_request_allowed: true,
      target_adoption: null
    });
  });

  it("classifies exact adopted A behind current B and blocks generic historical readoption", () => {
    const history = createHistory();
    const result = classifyExplicitReadoptionTarget({
      adoption_state: history.state,
      course_id: COURSE_ID,
      current_adoption: adoptionReference(history.adoptionB),
      target: {
        adoption: adoptionReference(history.adoptionA),
        epoch: history.adoptionA.epoch
      },
      tenant_id: TENANT_ID
    });

    expect(result).toMatchObject({
      classification: "HISTORICAL_ADOPTED_LINEAGE",
      historical_lineage: true,
      immediate_predecessor: true,
      requires_rollback_request: true,
      standard_o5_request_allowed: false,
      target_adoption: adoptionReference(history.adoptionA)
    });
    expectReadoptionError(
      () => predictExplicitReadoption(input(history, { rollback_basis: null })),
      EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_REQUEST_REQUIRED
    );
  });

  it("predicts a new C identity with predecessor B and historical A epoch without mutation", () => {
    const history = createHistory();
    const before = structuredClone(history.state);
    const result = predictExplicitReadoption(input(history));
    const current = adoptionReference(history.adoptionB);
    const target = adoptionReference(history.adoptionA);

    expect(result).toMatchObject({
      classification: "HISTORICAL_ADOPTED_LINEAGE",
      current_adoption: current,
      target_adoption: target,
      request_changes_current_selection: false,
      rollback_applied: false,
      adoption_mutation: false,
      official_truth_write: false,
      history_deleted: false,
      historical_receipt_rewritten: false,
      provider: "OFF",
      advisory_only: true
    });
    expect(result.predicted_adoption).toMatchObject({
      adoption_id: expect.not.stringMatching(history.adoptionA.adoption_id),
      adoption_digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      epoch: history.adoptionA.epoch,
      predecessor: current
    });
    expect(result.predicted_adoption.adoption_id).not.toBe(history.adoptionB.adoption_id);
    expect(result.predicted_adoption.adoption_digest).not.toBe(history.adoptionA.adoption_digest);
    expect(result.predicted_adoption.adoption_digest).not.toBe(history.adoptionB.adoption_digest);
    expect(result.proposal_input).toEqual({
      epoch: history.adoptionA.epoch,
      expected_adoption: current
    });
    expect(result.future_run).toEqual({
      adoption: {
        adoption_id: result.predicted_adoption.adoption_id,
        adoption_digest: result.predicted_adoption.adoption_digest
      },
      uses_predicted_adoption: true
    });
    expect(result.historical_records).toEqual({
      adoption_a: target,
      adoption_b: current,
      remain_immutable: true
    });
    expect(result.review_performed).toBe(false);
    expect(result.disposition_performed).toBe(false);
    expect(result.writer_called).toBe(false);
    expect(result.store_called).toBe(false);
    expect(result.registry_called).toBe(false);
    expect(history.state).toEqual(before);
  });

  it("is deterministic and changes C identity when the linked proposal identity changes", () => {
    const history = createHistory();
    const first = predictExplicitReadoption(input(history));
    const retry = predictExplicitReadoption(input(history));
    const conflictingProposal = predictExplicitReadoption(
      input(history, {
        rollback_basis: basis(history, {
          linked_proposal_digest: "f".repeat(64),
          linked_proposal_id: "proposal-readoption-b"
        })
      })
    );

    expect(retry).toEqual(first);
    expect(conflictingProposal.predicted_adoption.adoption_id).not.toBe(
      first.predicted_adoption.adoption_id
    );
    expect(conflictingProposal.predicted_adoption.adoption_digest).not.toBe(
      first.predicted_adoption.adoption_digest
    );
  });

  it("rejects wrong scope, stale current digest, and a moved current selection", () => {
    const history = createHistory();
    expectReadoptionError(
      () => classifyExplicitReadoptionTarget(input(history, { tenant_id: "other-tenant" })),
      EXPLICIT_READOPTION_ERROR_CODES.SCOPE_CONFLICT
    );
    expectReadoptionError(
      () =>
        classifyExplicitReadoptionTarget(
          input(history, {
            current_adoption: {
              adoption_digest: "0".repeat(64),
              adoption_id: history.adoptionB.adoption_id
            }
          })
        ),
      EXPLICIT_READOPTION_ERROR_CODES.CURRENT_ADOPTION_DIGEST_MISMATCH
    );

    const third = adopt(history.state, epoch("C"), "c", adoptionReference(history.adoptionB));
    expectReadoptionError(
      () =>
        classifyExplicitReadoptionTarget(
          input(history, {
            adoption_state: third.state
          })
        ),
      EXPLICIT_READOPTION_ERROR_CODES.CURRENT_ADOPTION_MOVED
    );
  });

  it("rejects malformed or reserved exact selectors before any lineage inference", () => {
    const history = createHistory();
    expectReadoptionError(
      () =>
        classifyExplicitReadoptionTarget(
          input(history, {
            current_adoption: {
              adoption_digest: history.adoptionB.adoption_digest,
              adoption_id: "latest"
            }
          })
        ),
      EXPLICIT_READOPTION_ERROR_CODES.INPUT_INVALID
    );
    expectReadoptionError(
      () =>
        predictExplicitReadoption(
          input(history, {
            rollback_basis: basis(history, { rollback_request_id: "request-default" })
          })
        ),
      EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_INVALID
    );
  });

  it("requires the exact immediate predecessor and rejects current-identity reuse", () => {
    const history = createHistory();
    const third = adopt(history.state, epoch("C"), "c", adoptionReference(history.adoptionB));
    const grandparentInput = input(
      {
        adoptionA: history.adoptionA,
        adoptionB: third.record,
        state: third.state
      },
      {
        target: {
          adoption: adoptionReference(history.adoptionA),
          epoch: history.adoptionA.epoch
        },
        rollback_basis: {
          ...basis(history),
          current_adoption: adoptionReference(third.record)
        }
      }
    );
    expectReadoptionError(
      () => predictExplicitReadoption(grandparentInput),
      EXPLICIT_READOPTION_ERROR_CODES.TARGET_NOT_IMMEDIATE_PREDECESSOR
    );

    expectReadoptionError(
      () =>
        predictExplicitReadoption(
          input(history, {
            target: {
              adoption: adoptionReference(history.adoptionB),
              epoch: history.adoptionB.epoch
            }
          })
        ),
      EXPLICIT_READOPTION_ERROR_CODES.TARGET_IS_CURRENT
    );
  });

  it("requires rollback basis scope, exact A/B bindings, and linked proposal identity", () => {
    const history = createHistory();
    expectReadoptionError(
      () =>
        predictExplicitReadoption(
          input(history, {
            rollback_basis: basis(history, { course_id: "other-course" })
          })
        ),
      EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_SCOPE_CONFLICT
    );
    expectReadoptionError(
      () =>
        predictExplicitReadoption(
          input(history, {
            rollback_basis: basis(history, {
              current_adoption: { ...adoptionReference(history.adoptionA) }
            })
          })
        ),
      EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_CURRENT_CONFLICT
    );
    expectReadoptionError(
      () =>
        predictExplicitReadoption(
          input(history, {
            rollback_basis: basis(history, {
              target_adoption: { ...adoptionReference(history.adoptionB) }
            })
          })
        ),
      EXPLICIT_READOPTION_ERROR_CODES.ROLLBACK_BASIS_TARGET_CONFLICT
    );

    const {
      linked_proposal_digest: _proposalDigest,
      linked_proposal_id: _proposalId,
      ...withoutProposal
    } = basis(history);
    void _proposalDigest;
    void _proposalId;
    expectReadoptionError(
      () =>
        predictExplicitReadoption(
          input(history, {
            rollback_basis: withoutProposal as ExplicitReadoptionRollbackBasis
          })
        ),
      EXPLICIT_READOPTION_ERROR_CODES.LINKED_PROPOSAL_REQUIRED
    );
  });

  it("rejects a target digest/epoch mismatch instead of treating altered history as new evidence", () => {
    const history = createHistory();
    expectReadoptionError(
      () =>
        predictExplicitReadoption(
          input(history, {
            target: {
              adoption: adoptionReference(history.adoptionA),
              epoch: { ...history.adoptionA.epoch, source_content_digest: "0".repeat(64) }
            }
          })
        ),
      EXPLICIT_READOPTION_ERROR_CODES.TARGET_EPOCH_DIGEST_MISMATCH
    );
    expectReadoptionError(
      () =>
        predictExplicitReadoption(
          input(history, {
            target: {
              adoption: {
                adoption_digest: "0".repeat(64),
                adoption_id: history.adoptionA.adoption_id
              },
              epoch: history.adoptionA.epoch
            }
          })
        ),
      EXPLICIT_READOPTION_ERROR_CODES.TARGET_ADOPTION_DIGEST_MISMATCH
    );
  });
});
