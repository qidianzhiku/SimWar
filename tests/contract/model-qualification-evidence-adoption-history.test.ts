import { describe, expect, it } from "vitest";
import type {
  EvidenceAdoptionEpoch,
  EvidenceAdoptionRecord,
  EvidenceAdoptionState,
  ModelQualificationRecord
} from "@simwar/shared-contracts";
import {
  createEvidenceEpoch,
  disposeEvidenceAdoption,
  emptyEvidenceAdoptionState,
  requestEvidenceAdoption,
  resolveFutureEvidenceAdoption,
  resolveHistoricalEvidenceAdoption,
  reviewEvidenceAdoption
} from "../../services/api/src/model-qualification-evidence-adoption";
import { resolveQualifiedRunAdmission } from "../../services/api/src/model-qualification-run-admission";
import {
  EVIDENCE_ADOPTION_AFTER_A_EXPIRES,
  EVIDENCE_ADOPTION_AFTER_B_EXPIRES,
  EVIDENCE_ADOPTION_ADMIN,
  EVIDENCE_ADOPTION_NOW,
  EVIDENCE_ADOPTION_TEACHER,
  adoptionReference,
  createEvidenceAdoptionContext,
  createEvidenceAdoptionEpochInput,
  createEvidenceAdoptionServiceFixture,
  type EvidenceAdoptionEpochInput,
  type SeededEvidenceQualificationChain
} from "../helpers/model-qualification-evidence-adoption-fixtures";
import { createQualifiedRunAdmissionFixture } from "../helpers/model-qualification-run-admission-fixtures";

describe("model qualification evidence adoption history contract", () => {
  it("resolves current B from the explicit selection while retaining exact historical A", () => {
    const history = createAdoptedHistory();

    const currentB = resolveFutureEvidenceAdoption(history.stateB, {
      adoption_digest: history.adoptionB.adoption_digest,
      adoption_id: history.adoptionB.adoption_id,
      course_id: history.chain.scope.course_id,
      epoch: history.epochB,
      now: EVIDENCE_ADOPTION_NOW,
      tenant_id: history.chain.scope.tenant_id
    });
    const historicalA = resolveHistoricalEvidenceAdoption(history.stateB, {
      adoption_digest: history.adoptionA.adoption_digest,
      adoption_id: history.adoptionA.adoption_id,
      course_id: history.chain.scope.course_id,
      epoch: history.epochA,
      tenant_id: history.chain.scope.tenant_id
    });

    expect(currentB).toEqual(history.adoptionB);
    expect(historicalA).toEqual(history.adoptionA);
    expect(JSON.stringify(historicalA.epoch)).toBe(JSON.stringify(history.epochA));
    expect(selectionForEpoch(history.stateB, history.epochB)).toMatchObject({
      adoption_digest: history.adoptionB.adoption_digest,
      adoption_id: history.adoptionB.adoption_id
    });
    expect(selectionForEpoch(history.stateB, history.epochA)).toBeUndefined();

    const historyDeleted = !history.stateB.records.some(
      (record) => record.adoption_id === history.adoptionA.adoption_id
    );
    expect(historyDeleted).toBe(false);
    const historicalReceiptRewritten =
      JSON.stringify(historicalA) !== JSON.stringify(history.adoptionA);
    expect(historicalReceiptRewritten).toBe(false);
  });

  it("keeps review separate from adoption and does not mutate reducer inputs", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const chain = fixture.primary;
    const epoch = createEvidenceEpoch(createEvidenceAdoptionEpochInput(chain, "A"));
    const state = emptyEvidenceAdoptionState(chain.scope.tenant_id, chain.scope.course_id);
    const requestContext = createEvidenceAdoptionContext(
      chain.scope,
      EVIDENCE_ADOPTION_TEACHER,
      "review-separation-request"
    );
    const requestInput = { epoch, expected_adoption: null } as const;
    const originalState = cloneJson(state);
    const originalRequestInput = cloneJson(requestInput);
    const originalContext = cloneJson(requestContext);

    const requested = requestEvidenceAdoption(state, requestContext, requestInput);
    expect(state).toEqual(originalState);
    expect(requestInput).toEqual(originalRequestInput);
    expect(requestContext).toEqual(originalContext);

    const reviewed = reviewEvidenceAdoption(
      requested.state,
      createEvidenceAdoptionContext(
        chain.scope,
        EVIDENCE_ADOPTION_ADMIN,
        "review-separation-review"
      ),
      {
        decision: "APPROVED",
        note: "Review without selecting a future-admission pointer.",
        proposal_digest: requested.receipt.proposal_digest,
        proposal_id: requested.receipt.proposal_id
      }
    );
    expect(reviewed.state.proposals).toHaveLength(1);
    expect(reviewed.state.reviews).toHaveLength(1);
    expect(reviewed.state.records).toEqual([]);
    expect(reviewed.state.selections).toEqual([]);
    expect(reviewed.receipt.proposal_id).toBe(requested.receipt.proposal_id);
  });

  it.each([
    { disposition: "DEFERRED_WITH_EXPIRY" as const, expires_at: "2026-09-10T00:00:00.000Z" },
    { disposition: "REJECTED_CANDIDATE" as const, expires_at: null },
    { disposition: "REBASE_REQUIRED" as const, expires_at: null }
  ])("does not move the selected pointer for $disposition", ({ disposition, expires_at }) => {
    const history = createAdoptedHistory();
    const pointerBefore = cloneJson(history.stateA.selections);
    const requestB = requestEvidenceAdoption(
      history.stateA,
      createEvidenceAdoptionContext(
        history.chain.scope,
        EVIDENCE_ADOPTION_TEACHER,
        `unchanged-pointer-request-${disposition}`
      ),
      {
        epoch: history.epochB,
        expected_adoption: adoptionReference(history.adoptionA)
      }
    );
    const reviewedB = reviewEvidenceAdoption(
      requestB.state,
      createEvidenceAdoptionContext(
        history.chain.scope,
        EVIDENCE_ADOPTION_TEACHER,
        `unchanged-pointer-review-${disposition}`
      ),
      {
        decision: "APPROVED",
        note: `Review candidate before ${disposition}.`,
        proposal_digest: requestB.receipt.proposal_digest,
        proposal_id: requestB.receipt.proposal_id
      }
    );
    const disposedB = disposeEvidenceAdoption(
      reviewedB.state,
      createEvidenceAdoptionContext(
        history.chain.scope,
        EVIDENCE_ADOPTION_ADMIN,
        `unchanged-pointer-dispose-${disposition}`
      ),
      {
        disposition,
        expires_at,
        note: `Keep A selected after ${disposition}.`,
        proposal_digest: requestB.receipt.proposal_digest,
        proposal_id: requestB.receipt.proposal_id
      }
    );

    expect(disposedB.receipt.disposition).toBe(disposition);
    expect(disposedB.state.selections).toEqual(pointerBefore);
    expect(selectionForEpoch(disposedB.state, history.epochA)).toMatchObject({
      adoption_digest: history.adoptionA.adoption_digest,
      adoption_id: history.adoptionA.adoption_id
    });
    expect(selectionForEpoch(disposedB.state, history.epochB)).toBeUndefined();
    expect(
      resolveFutureEvidenceAdoption(disposedB.state, {
        adoption_digest: history.adoptionA.adoption_digest,
        adoption_id: history.adoptionA.adoption_id,
        course_id: history.chain.scope.course_id,
        epoch: history.epochA,
        now: EVIDENCE_ADOPTION_NOW,
        tenant_id: history.chain.scope.tenant_id
      })
    ).toEqual(history.adoptionA);
  });

  it("reuses exact commands without time in the fingerprint and rejects conflicts after scope validation", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const chain = fixture.primary;
    const epochA = createEvidenceEpoch(createEvidenceAdoptionEpochInput(chain, "A"));
    const epochB = createEvidenceEpoch(createEvidenceAdoptionEpochInput(chain, "B"));
    const state = emptyEvidenceAdoptionState(chain.scope.tenant_id, chain.scope.course_id);
    const requestInput = { epoch: epochA, expected_adoption: null } as const;
    const requestContext = createEvidenceAdoptionContext(
      chain.scope,
      EVIDENCE_ADOPTION_TEACHER,
      "idempotent-request",
      EVIDENCE_ADOPTION_NOW
    );
    const requested = requestEvidenceAdoption(state, requestContext, requestInput);
    const retriedRequest = requestEvidenceAdoption(
      requested.state,
      createEvidenceAdoptionContext(
        chain.scope,
        EVIDENCE_ADOPTION_TEACHER,
        "idempotent-request",
        EVIDENCE_ADOPTION_AFTER_A_EXPIRES
      ),
      requestInput
    );
    expect(retriedRequest.reused).toBe(true);
    expect(retriedRequest.receipt).toEqual(requested.receipt);
    expect(retriedRequest.state).toEqual(requested.state);

    expect(() =>
      requestEvidenceAdoption(requested.state, requestContext, {
        epoch: epochB,
        expected_adoption: null
      })
    ).toThrow();
    expect(() =>
      requestEvidenceAdoption(
        requested.state,
        {
          ...requestContext,
          actor_id: "teacher-foreign",
          tenant_id: "tenant_foreign"
        },
        requestInput
      )
    ).toThrow();
    expect(() =>
      reviewEvidenceAdoption(
        requested.state,
        createEvidenceAdoptionContext(chain.scope, EVIDENCE_ADOPTION_TEACHER, "idempotent-request"),
        {
          decision: "APPROVED",
          note: "Action must not change for an existing request command.",
          proposal_digest: requested.receipt.proposal_digest,
          proposal_id: requested.receipt.proposal_id
        }
      )
    ).toThrow();

    const reviewInput = {
      decision: "APPROVED" as const,
      note: "Review exact proposal once.",
      proposal_digest: requested.receipt.proposal_digest,
      proposal_id: requested.receipt.proposal_id
    };
    const reviewed = reviewEvidenceAdoption(
      requested.state,
      createEvidenceAdoptionContext(chain.scope, EVIDENCE_ADOPTION_TEACHER, "idempotent-review"),
      reviewInput
    );
    const retriedReview = reviewEvidenceAdoption(
      reviewed.state,
      createEvidenceAdoptionContext(
        chain.scope,
        EVIDENCE_ADOPTION_TEACHER,
        "idempotent-review",
        EVIDENCE_ADOPTION_AFTER_A_EXPIRES
      ),
      reviewInput
    );
    expect(retriedReview.reused).toBe(true);
    expect(retriedReview.receipt).toEqual(reviewed.receipt);
    expect(() =>
      reviewEvidenceAdoption(
        reviewed.state,
        createEvidenceAdoptionContext(chain.scope, EVIDENCE_ADOPTION_TEACHER, "idempotent-review"),
        {
          ...reviewInput,
          note: "Conflicting normalized review intent."
        }
      )
    ).toThrow();

    const disposeInput = {
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION" as const,
      expires_at: null,
      note: "Adopt exact evidence.",
      proposal_digest: requested.receipt.proposal_digest,
      proposal_id: requested.receipt.proposal_id
    };
    const disposed = disposeEvidenceAdoption(
      reviewed.state,
      createEvidenceAdoptionContext(chain.scope, EVIDENCE_ADOPTION_ADMIN, "idempotent-dispose"),
      disposeInput
    );
    const retriedDispose = disposeEvidenceAdoption(
      disposed.state,
      createEvidenceAdoptionContext(
        chain.scope,
        EVIDENCE_ADOPTION_ADMIN,
        "idempotent-dispose",
        EVIDENCE_ADOPTION_AFTER_A_EXPIRES
      ),
      disposeInput
    );
    expect(retriedDispose.reused).toBe(true);
    expect(retriedDispose.receipt).toEqual(disposed.receipt);
    expect(() =>
      disposeEvidenceAdoption(
        disposed.state,
        createEvidenceAdoptionContext(chain.scope, EVIDENCE_ADOPTION_ADMIN, "idempotent-dispose"),
        {
          ...disposeInput,
          disposition: "REJECTED_CANDIDATE"
        }
      )
    ).toThrow();
  });

  it("fails closed for wrong scope, adoption digest, evidence digest, exact tuple, and floating selectors", () => {
    const history = createAdoptedHistory();
    const currentInput = {
      adoption_digest: history.adoptionB.adoption_digest,
      adoption_id: history.adoptionB.adoption_id,
      course_id: history.chain.scope.course_id,
      epoch: history.epochB,
      now: EVIDENCE_ADOPTION_NOW,
      tenant_id: history.chain.scope.tenant_id
    } as const;
    const historicalInput = {
      adoption_digest: history.adoptionA.adoption_digest,
      adoption_id: history.adoptionA.adoption_id,
      course_id: history.chain.scope.course_id,
      epoch: history.epochA,
      tenant_id: history.chain.scope.tenant_id
    } as const;

    const wrongSourceEpoch = createEvidenceEpoch({
      ...withoutEpochDigest(history.epochB),
      source_package_id: "source-not-b"
    });
    const wrongDatasetEpoch = createEvidenceEpoch({
      ...withoutEpochDigest(history.epochB),
      calibration_dataset_id: "dataset-not-b"
    });
    const wrongQualificationEpoch = createEvidenceEpoch({
      ...withoutEpochDigest(history.epochB),
      qualification_id: "qualification-not-b"
    });
    const tamperedDigestEpoch = {
      ...history.epochB,
      source_content_digest: "f".repeat(64)
    };

    const invalidCurrentCases: Array<() => unknown> = [
      () =>
        resolveFutureEvidenceAdoption(history.stateB, {
          ...currentInput,
          tenant_id: "tenant_foreign"
        }),
      () =>
        resolveFutureEvidenceAdoption(history.stateB, {
          ...currentInput,
          course_id: "course_other"
        }),
      () =>
        resolveFutureEvidenceAdoption(history.stateB, {
          ...currentInput,
          adoption_digest: "f".repeat(64)
        }),
      () =>
        resolveFutureEvidenceAdoption(history.stateB, {
          ...currentInput,
          epoch: tamperedDigestEpoch
        }),
      () =>
        resolveFutureEvidenceAdoption(history.stateB, { ...currentInput, epoch: wrongSourceEpoch }),
      () =>
        resolveFutureEvidenceAdoption(history.stateB, {
          ...currentInput,
          epoch: wrongDatasetEpoch
        }),
      () =>
        resolveFutureEvidenceAdoption(history.stateB, {
          ...currentInput,
          epoch: wrongQualificationEpoch
        }),
      () =>
        resolveHistoricalEvidenceAdoption(history.stateB, {
          ...historicalInput,
          tenant_id: "tenant_foreign"
        }),
      () =>
        resolveHistoricalEvidenceAdoption(history.stateB, {
          ...historicalInput,
          course_id: "course_other"
        }),
      () =>
        resolveHistoricalEvidenceAdoption(history.stateB, {
          ...historicalInput,
          adoption_digest: "f".repeat(64)
        }),
      () =>
        resolveHistoricalEvidenceAdoption(history.stateB, {
          ...historicalInput,
          epoch: wrongSourceEpoch
        })
    ];
    for (const invalidCase of invalidCurrentCases) expect(invalidCase).toThrow();

    const currentSelection = selectionForEpoch(history.stateB, history.epochB);
    if (!currentSelection) throw new Error("B selection missing from adopted history fixture");
    const floatingState: EvidenceAdoptionState = {
      ...history.stateB,
      selections: [
        {
          ...currentSelection,
          adoption_digest: "f".repeat(64),
          adoption_id: "adoption-floating"
        }
      ]
    };
    expect(() => resolveFutureEvidenceAdoption(floatingState, currentInput)).toThrow();

    const duplicateState: EvidenceAdoptionState = {
      ...history.stateB,
      selections: [...history.stateB.selections, { ...currentSelection }]
    };
    expect(() => resolveFutureEvidenceAdoption(duplicateState, currentInput)).toThrow();
  });

  it("rejects expired or not-yet-valid current resolution but still resolves retained historical A", () => {
    const history = createAdoptedHistory();
    const historicalA = resolveHistoricalEvidenceAdoption(history.stateB, {
      adoption_digest: history.adoptionA.adoption_digest,
      adoption_id: history.adoptionA.adoption_id,
      course_id: history.chain.scope.course_id,
      epoch: history.epochA,
      tenant_id: history.chain.scope.tenant_id
    });
    expect(historicalA).toEqual(history.adoptionA);

    expect(() =>
      resolveFutureEvidenceAdoption(history.stateA, {
        adoption_digest: history.adoptionA.adoption_digest,
        adoption_id: history.adoptionA.adoption_id,
        course_id: history.chain.scope.course_id,
        epoch: history.epochA,
        now: EVIDENCE_ADOPTION_AFTER_A_EXPIRES,
        tenant_id: history.chain.scope.tenant_id
      })
    ).toThrow();
    expect(() =>
      resolveFutureEvidenceAdoption(history.stateB, {
        adoption_digest: history.adoptionB.adoption_digest,
        adoption_id: history.adoptionB.adoption_id,
        course_id: history.chain.scope.course_id,
        epoch: history.epochB,
        now: EVIDENCE_ADOPTION_AFTER_B_EXPIRES,
        tenant_id: history.chain.scope.tenant_id
      })
    ).toThrow();
    expect(() =>
      resolveFutureEvidenceAdoption(history.stateB, {
        adoption_digest: history.adoptionB.adoption_digest,
        adoption_id: history.adoptionB.adoption_id,
        course_id: history.chain.scope.course_id,
        epoch: history.epochB,
        now: "2026-09-02T00:00:00.000Z",
        tenant_id: history.chain.scope.tenant_id
      })
    ).toThrow();
  });

  it("leaves an existing v1 qualified-run admission receipt and record unchanged", () => {
    const fixture = createQualifiedRunAdmissionFixture();
    const originalRecord = cloneJson(fixture.qualification_record as ModelQualificationRecord);
    const originalReceipt = resolveQualifiedRunAdmission(fixture);

    // Exercise the vNext history reducer separately, then re-read the v1
    // fixture to guard against accidental receipt or record rewriting.
    createAdoptedHistory();

    const rereadReceipt = resolveQualifiedRunAdmission(fixture);
    expect(rereadReceipt).toEqual(originalReceipt);
    expect(rereadReceipt).toMatchObject({
      official_truth_write: false,
      provider: "OFF",
      writer_effect: "NONE"
    });
    expect(fixture.qualification_record).toEqual(originalRecord);
  });
});

interface AdoptedHistory {
  readonly chain: SeededEvidenceQualificationChain;
  readonly epochA: EvidenceAdoptionEpoch;
  readonly epochB: EvidenceAdoptionEpoch;
  readonly adoptionA: EvidenceAdoptionRecord;
  readonly adoptionB: EvidenceAdoptionRecord;
  readonly stateA: EvidenceAdoptionState;
  readonly stateB: EvidenceAdoptionState;
}

function createAdoptedHistory(): AdoptedHistory {
  const fixture = createEvidenceAdoptionServiceFixture();
  const chain = fixture.primary;
  const epochA = createEvidenceEpoch(createEvidenceAdoptionEpochInput(chain, "A"));
  const epochB = createEvidenceEpoch(createEvidenceAdoptionEpochInput(chain, "B"));
  const empty = emptyEvidenceAdoptionState(chain.scope.tenant_id, chain.scope.course_id);
  const requestedA = requestEvidenceAdoption(
    empty,
    createEvidenceAdoptionContext(chain.scope, EVIDENCE_ADOPTION_TEACHER, "history-request-a"),
    { epoch: epochA, expected_adoption: null }
  );
  const reviewedA = reviewEvidenceAdoption(
    requestedA.state,
    createEvidenceAdoptionContext(chain.scope, EVIDENCE_ADOPTION_TEACHER, "history-review-a"),
    {
      decision: "APPROVED",
      note: "Review exact A evidence.",
      proposal_digest: requestedA.receipt.proposal_digest,
      proposal_id: requestedA.receipt.proposal_id
    }
  );
  const disposedA = disposeEvidenceAdoption(
    reviewedA.state,
    createEvidenceAdoptionContext(chain.scope, EVIDENCE_ADOPTION_ADMIN, "history-dispose-a"),
    {
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: "Adopt exact A evidence.",
      proposal_digest: requestedA.receipt.proposal_digest,
      proposal_id: requestedA.receipt.proposal_id
    }
  );
  const requestedB = requestEvidenceAdoption(
    disposedA.state,
    createEvidenceAdoptionContext(chain.scope, EVIDENCE_ADOPTION_TEACHER, "history-request-b"),
    {
      epoch: epochB,
      expected_adoption: adoptionReference(disposedA.receipt)
    }
  );
  const reviewedB = reviewEvidenceAdoption(
    requestedB.state,
    createEvidenceAdoptionContext(chain.scope, EVIDENCE_ADOPTION_ADMIN, "history-review-b"),
    {
      decision: "APPROVED",
      note: "Review exact B evidence.",
      proposal_digest: requestedB.receipt.proposal_digest,
      proposal_id: requestedB.receipt.proposal_id
    }
  );
  const disposedB = disposeEvidenceAdoption(
    reviewedB.state,
    createEvidenceAdoptionContext(chain.scope, EVIDENCE_ADOPTION_ADMIN, "history-dispose-b"),
    {
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: "Advance the exact future-admission pointer to B.",
      proposal_digest: requestedB.receipt.proposal_digest,
      proposal_id: requestedB.receipt.proposal_id
    }
  );
  return {
    adoptionA: disposedA.receipt,
    adoptionB: disposedB.receipt,
    chain,
    epochA,
    epochB,
    stateA: disposedA.state,
    stateB: disposedB.state
  };
}

function selectionForEpoch(state: EvidenceAdoptionState, epoch: EvidenceAdoptionEpoch) {
  return state.selections.find(
    (selection) =>
      selection.model_version_reference.model_version_id ===
        epoch.model_version_reference.model_version_id &&
      selection.model_version_reference.version === epoch.model_version_reference.version &&
      selection.model_version_reference.content_digest ===
        epoch.model_version_reference.content_digest &&
      selection.model_artifact_reference.artifact_id ===
        epoch.model_artifact_reference.artifact_id &&
      selection.model_artifact_reference.content_digest ===
        epoch.model_artifact_reference.content_digest
  );
}

function withoutEpochDigest(epoch: EvidenceAdoptionEpoch): EvidenceAdoptionEpochInput {
  return {
    calibration_dataset_content_digest: epoch.calibration_dataset_content_digest,
    calibration_dataset_id: epoch.calibration_dataset_id,
    course_id: epoch.course_id,
    model_artifact_reference: { ...epoch.model_artifact_reference },
    model_version_reference: { ...epoch.model_version_reference },
    qualification_content_digest: epoch.qualification_content_digest,
    qualification_id: epoch.qualification_id,
    source_content_digest: epoch.source_content_digest,
    source_expires_at: epoch.source_expires_at,
    source_package_id: epoch.source_package_id,
    tenant_id: epoch.tenant_id
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
