import { describe, expect, it } from "vitest";
import type {
  EvidenceAdoptionCommandContext,
  EvidenceAdoptionEpoch,
  EvidenceAdoptionRecord,
  EvidenceAdoptionReference,
  EvidenceAdoptionState,
  ModelArtifactReference,
  ModelVersionReference,
  RequestEvidenceAdoption
} from "@simwar/shared-contracts";
import {
  EvidenceAdoptionError,
  createEvidenceEpoch,
  disposeEvidenceAdoption,
  emptyEvidenceAdoptionState,
  requestEvidenceAdoption,
  resolveFutureEvidenceAdoption,
  resolveHistoricalEvidenceAdoption,
  reviewEvidenceAdoption
} from "../../services/api/src/model-qualification-evidence-adoption";

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);
const DIGEST_C = "c".repeat(64);
const DIGEST_D = "d".repeat(64);
const TENANT_ID = "tenant-a1";
const COURSE_ID = "course-a1";
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

function epoch(
  overrides: Partial<Omit<EvidenceAdoptionEpoch, "epoch_digest">> = {}
): EvidenceAdoptionEpoch {
  return createEvidenceEpoch({
    calibration_dataset_content_digest: DIGEST_D,
    calibration_dataset_id: "dataset-a1",
    course_id: COURSE_ID,
    model_artifact_reference: { ...MODEL_ARTIFACT },
    model_version_reference: { ...MODEL_VERSION },
    qualification_content_digest: DIGEST_C,
    qualification_id: "qualification-a1",
    source_content_digest: DIGEST_A,
    source_expires_at: "2030-01-01T00:00:00Z",
    source_package_id: "source-a1",
    tenant_id: TENANT_ID,
    ...overrides
  });
}

function context(
  command_id: string,
  now = "2029-01-01T00:00:00Z",
  overrides: Partial<EvidenceAdoptionCommandContext> = {}
): EvidenceAdoptionCommandContext {
  return {
    actor_id: "teacher-a1",
    command_id,
    course_id: COURSE_ID,
    now,
    role: "teacher",
    tenant_id: TENANT_ID,
    ...overrides
  };
}

function expectEvidenceError(operation: () => unknown, code: string): void {
  try {
    operation();
    throw new Error("expected_evidence_adoption_error");
  } catch (error) {
    if (error instanceof Error && error.message === "expected_evidence_adoption_error") {
      throw error;
    }
    expect(error).toBeInstanceOf(EvidenceAdoptionError);
    expect((error as EvidenceAdoptionError).code).toBe(code);
    expect((error as Error).message).toBe(code);
  }
}

function request(
  state: EvidenceAdoptionState,
  command_id: string,
  requestedEpoch: EvidenceAdoptionEpoch,
  expected_adoption: EvidenceAdoptionReference | null = null,
  now = "2029-01-01T00:00:00Z"
) {
  const input: RequestEvidenceAdoption = {
    epoch: requestedEpoch,
    expected_adoption
  };
  return requestEvidenceAdoption(state, context(command_id, now), input);
}

function adopt(
  state: EvidenceAdoptionState,
  requestedEpoch: EvidenceAdoptionEpoch,
  suffix: string,
  expected_adoption: EvidenceAdoptionReference | null = null,
  options: {
    adoptedAt?: string;
    expires_at?: string | null;
    reviewDecision?: "APPROVED" | "REJECTED";
  } = {}
): {
  state: EvidenceAdoptionState;
  proposal: ReturnType<typeof requestEvidenceAdoption>["receipt"];
  record: EvidenceAdoptionRecord;
} {
  const requested = request(
    state,
    `${suffix}-request`,
    requestedEpoch,
    expected_adoption,
    options.adoptedAt ?? "2029-01-01T00:00:00Z"
  );
  const reviewed = reviewEvidenceAdoption(
    requested.state,
    context(`${suffix}-review`, options.adoptedAt ?? "2029-01-01T00:01:00Z", {
      role: "tenant_admin"
    }),
    {
      decision: options.reviewDecision ?? "APPROVED",
      note: "reviewed by governance",
      proposal_digest: requested.receipt.proposal_digest,
      proposal_id: requested.receipt.proposal_id
    }
  );
  const disposed = disposeEvidenceAdoption(
    reviewed.state,
    context(`${suffix}-dispose`, options.adoptedAt ?? "2029-01-01T00:02:00Z", {
      role: "tenant_admin"
    }),
    {
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: options.expires_at ?? null,
      note: "approved for future admission",
      proposal_digest: requested.receipt.proposal_digest,
      proposal_id: requested.receipt.proposal_id
    }
  );
  return { state: disposed.state, proposal: requested.receipt, record: disposed.receipt };
}

describe("model qualification evidence adoption pure domain", () => {
  it("creates a cloned exact epoch with a deterministic sorted-key digest", () => {
    const input = {
      calibration_dataset_content_digest: DIGEST_D,
      calibration_dataset_id: "dataset-a1",
      course_id: COURSE_ID,
      model_artifact_reference: { ...MODEL_ARTIFACT },
      model_version_reference: { ...MODEL_VERSION },
      qualification_content_digest: DIGEST_C,
      qualification_id: "qualification-a1",
      source_content_digest: DIGEST_A,
      source_expires_at: "2030-01-01T00:00:00Z",
      source_package_id: "source-a1",
      tenant_id: TENANT_ID
    };
    const reordered = {
      tenant_id: TENANT_ID,
      source_package_id: "source-a1",
      source_expires_at: "2030-01-01T00:00:00Z",
      source_content_digest: DIGEST_A,
      qualification_id: "qualification-a1",
      qualification_content_digest: DIGEST_C,
      model_version_reference: { ...MODEL_VERSION },
      model_artifact_reference: { ...MODEL_ARTIFACT },
      course_id: COURSE_ID,
      calibration_dataset_id: "dataset-a1",
      calibration_dataset_content_digest: DIGEST_D
    };

    const created = createEvidenceEpoch(input);
    const sameDigest = createEvidenceEpoch(reordered).epoch_digest;

    expect(created.epoch_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(created.epoch_digest).toBe(sameDigest);
    expect(created).not.toBe(input);
    expect(created.model_version_reference).not.toBe(input.model_version_reference);
    expect(input).not.toHaveProperty("epoch_digest");
    expect(Object.isFrozen(created)).toBe(true);
    expect(Object.isFrozen(created.model_artifact_reference)).toBe(true);
  });

  it("rejects malformed epoch dates, digests, implicit latest references, and scope values", () => {
    expectEvidenceError(
      () => createEvidenceEpoch({ ...epochWithoutDigest(), source_expires_at: "not-a-date" }),
      "EVIDENCE_ADOPTION_INPUT_INVALID"
    );
    expectEvidenceError(
      () => createEvidenceEpoch({ ...epochWithoutDigest(), source_content_digest: "latest" }),
      "EVIDENCE_ADOPTION_INPUT_INVALID"
    );
    expectEvidenceError(
      () =>
        createEvidenceEpoch({
          ...epochWithoutDigest(),
          model_version_reference: { ...MODEL_VERSION, version: "latest" }
        }),
      "EVIDENCE_ADOPTION_INPUT_INVALID"
    );
    expectEvidenceError(
      () => createEvidenceEpoch({ ...epochWithoutDigest(), tenant_id: " " }),
      "EVIDENCE_ADOPTION_INPUT_INVALID"
    );
  });

  it("starts a scoped empty state and preserves input state and epoch on request", () => {
    const initial = emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID);
    const requestedEpoch = epoch();
    const requested = request(initial, "request-1", requestedEpoch);

    expect(initial.proposals).toHaveLength(0);
    expect(initial.commands).toHaveLength(0);
    expect(requested.state.proposals).toHaveLength(1);
    expect(requested.state.reviews).toHaveLength(0);
    expect(requested.state.records).toHaveLength(0);
    expect(requested.state.selections).toHaveLength(0);
    expect(requested.receipt.epoch).not.toBe(requestedEpoch);
    expect(requested.receipt.epoch).toEqual(requestedEpoch);
    expect(requested.reused).toBe(false);
    expect(Object.isFrozen(requested.state)).toBe(true);
    expect(Object.isFrozen(requested.receipt)).toBe(true);
  });

  it("reuses the exact immutable proposal when only retry time changes", () => {
    const initial = emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID);
    const requestedEpoch = epoch();
    const first = request(initial, "request-retry", requestedEpoch, null, "2029-01-01T00:00:00Z");
    const retry = request(
      first.state,
      "request-retry",
      requestedEpoch,
      null,
      "2029-01-02T00:00:00Z"
    );

    expect(retry.reused).toBe(true);
    expect(retry.receipt).toEqual(first.receipt);
    expect(retry.state).toEqual(first.state);
    expect(retry.state.proposals).toHaveLength(1);
    expect(retry.state.commands).toHaveLength(1);
  });

  it("rejects command actor, action, and payload conflicts after scope authorization", () => {
    const initial = emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID);
    const first = request(initial, "request-conflict", epoch());

    expectEvidenceError(
      () =>
        requestEvidenceAdoption(
          first.state,
          context("request-conflict", "2029-01-02T00:00:00Z", { actor_id: "other-teacher" }),
          { epoch: first.receipt.epoch, expected_adoption: null }
        ),
      "EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT"
    );
    expectEvidenceError(
      () =>
        reviewEvidenceAdoption(first.state, context("request-conflict", "2029-01-02T00:00:00Z"), {
          decision: "APPROVED",
          note: "wrong action",
          proposal_digest: first.receipt.proposal_digest,
          proposal_id: first.receipt.proposal_id
        }),
      "EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT"
    );
    expectEvidenceError(
      () => request(first.state, "request-conflict", epoch({ source_package_id: "source-b" })),
      "EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT"
    );
    expectEvidenceError(
      () =>
        requestEvidenceAdoption(
          first.state,
          context("request-conflict", "2029-01-02T00:00:00Z", { role: "student" as never }),
          { epoch: first.receipt.epoch, expected_adoption: null }
        ),
      "EVIDENCE_ADOPTION_ACTOR_FORBIDDEN"
    );
  });

  it("rejects altered epoch evidence and wrong tenant/course before reduction", () => {
    const initial = emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID);
    const requestedEpoch = epoch();
    const altered = { ...requestedEpoch, source_package_id: "source-altered" };

    expectEvidenceError(
      () => request(initial, "request-altered", altered),
      "EVIDENCE_ADOPTION_EPOCH_DIGEST_MISMATCH"
    );
    expectEvidenceError(
      () =>
        requestEvidenceAdoption(
          initial,
          context("request-wrong-scope", "2029-01-01T00:00:00Z", { course_id: "other-course" }),
          { epoch: requestedEpoch, expected_adoption: null }
        ),
      "EVIDENCE_ADOPTION_SCOPE_MISMATCH"
    );
    expectEvidenceError(
      () =>
        requestEvidenceAdoption(
          initial,
          context("request-wrong-tenant", "2029-01-01T00:00:00Z", { tenant_id: "other-tenant" }),
          { epoch: requestedEpoch, expected_adoption: null }
        ),
      "EVIDENCE_ADOPTION_SCOPE_MISMATCH"
    );
  });

  it("records a review without changing the future-admission selection", () => {
    const requested = request(
      emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID),
      "review-request",
      epoch()
    );
    const reviewed = reviewEvidenceAdoption(
      requested.state,
      context("review-command", "2029-01-01T00:01:00Z", { role: "tenant_admin" }),
      {
        decision: "APPROVED",
        note: "approved evidence review",
        proposal_digest: requested.receipt.proposal_digest,
        proposal_id: requested.receipt.proposal_id
      }
    );

    expect(reviewed.reused).toBe(false);
    expect(reviewed.receipt.decision).toBe("APPROVED");
    expect(reviewed.state.reviews).toHaveLength(1);
    expect(reviewed.state.records).toHaveLength(0);
    expect(reviewed.state.selections).toHaveLength(0);
    expect(requested.state.reviews).toHaveLength(0);
  });

  it("allows adoption only after an approved review and advances only the exact pointer", () => {
    const requested = request(
      emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID),
      "adopt-request",
      epoch()
    );
    const reviewed = reviewEvidenceAdoption(
      requested.state,
      context("adopt-review", "2029-01-01T00:01:00Z", { role: "teacher" }),
      {
        decision: "APPROVED",
        note: "approved",
        proposal_digest: requested.receipt.proposal_digest,
        proposal_id: requested.receipt.proposal_id
      }
    );
    const disposed = disposeEvidenceAdoption(
      reviewed.state,
      context("adopt-dispose", "2029-01-01T00:02:00Z", { role: "tenant_admin" }),
      {
        disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
        expires_at: null,
        note: "adopted",
        proposal_digest: requested.receipt.proposal_digest,
        proposal_id: requested.receipt.proposal_id
      }
    );

    expect(disposed.receipt.disposition).toBe("ADOPTED_FOR_FUTURE_ADMISSION");
    expect(disposed.receipt.official_truth_write).toBe(false);
    expect(disposed.receipt.provider).toBe("OFF");
    expect(disposed.state.selections).toEqual([
      {
        adoption_digest: disposed.receipt.adoption_digest,
        adoption_id: disposed.receipt.adoption_id,
        model_artifact_reference: MODEL_ARTIFACT,
        model_version_reference: MODEL_VERSION
      }
    ]);
    expect(disposed.state.records).toHaveLength(1);
    expect(reviewed.state.selections).toHaveLength(0);
  });

  it("rejects an adopted disposition for a rejected review and requires future expiry for deferral", () => {
    const rejectedRequest = request(
      emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID),
      "rejected-request",
      epoch()
    );
    const rejectedReview = reviewEvidenceAdoption(
      rejectedRequest.state,
      context("rejected-review", "2029-01-01T00:01:00Z", { role: "tenant_admin" }),
      {
        decision: "REJECTED",
        note: "not ready",
        proposal_digest: rejectedRequest.receipt.proposal_digest,
        proposal_id: rejectedRequest.receipt.proposal_id
      }
    );

    expectEvidenceError(
      () =>
        disposeEvidenceAdoption(
          rejectedReview.state,
          context("rejected-dispose", "2029-01-01T00:02:00Z", { role: "tenant_admin" }),
          {
            disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
            expires_at: null,
            note: "must not adopt",
            proposal_digest: rejectedRequest.receipt.proposal_digest,
            proposal_id: rejectedRequest.receipt.proposal_id
          }
        ),
      "EVIDENCE_ADOPTION_REVIEW_REQUIRED"
    );

    const requested = request(
      emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID),
      "defer-request",
      epoch()
    );
    const reviewed = reviewEvidenceAdoption(
      requested.state,
      context("defer-review", "2029-01-01T00:01:00Z", { role: "tenant_admin" }),
      {
        decision: "REJECTED",
        note: "needs rebase",
        proposal_digest: requested.receipt.proposal_digest,
        proposal_id: requested.receipt.proposal_id
      }
    );
    expectEvidenceError(
      () =>
        disposeEvidenceAdoption(
          reviewed.state,
          context("defer-dispose-invalid", "2029-01-01T00:02:00Z", { role: "teacher" }),
          {
            disposition: "DEFERRED_WITH_EXPIRY",
            expires_at: null,
            note: "deferred",
            proposal_digest: requested.receipt.proposal_digest,
            proposal_id: requested.receipt.proposal_id
          }
        ),
      "EVIDENCE_ADOPTION_EXPIRY_INVALID"
    );
  });

  it("uses expected id and digest as an optimistic predecessor and never overwrites history", () => {
    const initial = emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID);
    const first = adopt(initial, epoch(), "epoch-a");
    const second = adopt(
      first.state,
      epoch({
        qualification_content_digest: DIGEST_D,
        qualification_id: "qualification-b1",
        source_content_digest: DIGEST_B,
        source_package_id: "source-b1"
      }),
      "epoch-b",
      { adoption_id: first.record.adoption_id, adoption_digest: first.record.adoption_digest }
    );

    expect(second.state.records).toHaveLength(2);
    expect(second.state.selections).toHaveLength(1);
    expect(second.state.selections[0]?.adoption_id).toBe(second.record.adoption_id);
    expect(second.record.predecessor).toEqual({
      adoption_id: first.record.adoption_id,
      adoption_digest: first.record.adoption_digest
    });
    expect(
      resolveHistoricalEvidenceAdoption(second.state, {
        adoption_digest: first.record.adoption_digest,
        adoption_id: first.record.adoption_id,
        course_id: COURSE_ID,
        epoch: first.record.epoch,
        tenant_id: TENANT_ID
      })
    ).toEqual(first.record);
    expectEvidenceError(
      () =>
        resolveFutureEvidenceAdoption(second.state, {
          adoption_digest: first.record.adoption_digest,
          adoption_id: first.record.adoption_id,
          course_id: COURSE_ID,
          epoch: first.record.epoch,
          now: "2029-01-03T00:00:00Z",
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_NOT_CURRENT"
    );
    expect(
      resolveFutureEvidenceAdoption(second.state, {
        adoption_digest: second.record.adoption_digest,
        adoption_id: second.record.adoption_id,
        course_id: COURSE_ID,
        epoch: second.record.epoch,
        now: "2029-01-03T00:00:00Z",
        tenant_id: TENANT_ID
      })
    ).toEqual(second.record);

    const staleRequested = request(
      first.state,
      "stale-request",
      epoch({
        qualification_content_digest: DIGEST_D,
        qualification_id: "qualification-stale",
        source_content_digest: DIGEST_C,
        source_package_id: "source-stale"
      }),
      { adoption_id: first.record.adoption_id, adoption_digest: first.record.adoption_digest }
    );
    const concurrentSecondRequested = request(
      staleRequested.state,
      "concurrent-second-request",
      epoch({
        qualification_content_digest: DIGEST_D,
        qualification_id: "qualification-concurrent",
        source_content_digest: DIGEST_B,
        source_package_id: "source-concurrent"
      }),
      { adoption_id: first.record.adoption_id, adoption_digest: first.record.adoption_digest },
      "2029-01-01T00:04:00Z"
    );
    const concurrentSecondReviewed = reviewEvidenceAdoption(
      concurrentSecondRequested.state,
      context("concurrent-second-review", "2029-01-01T00:05:00Z", { role: "teacher" }),
      {
        decision: "APPROVED",
        note: "concurrent candidate",
        proposal_digest: concurrentSecondRequested.receipt.proposal_digest,
        proposal_id: concurrentSecondRequested.receipt.proposal_id
      }
    );
    const concurrentSecondDisposed = disposeEvidenceAdoption(
      concurrentSecondReviewed.state,
      context("concurrent-second-dispose", "2029-01-01T00:06:00Z", { role: "tenant_admin" }),
      {
        disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
        expires_at: null,
        note: "concurrent candidate",
        proposal_digest: concurrentSecondRequested.receipt.proposal_digest,
        proposal_id: concurrentSecondRequested.receipt.proposal_id
      }
    );
    const staleReviewed = reviewEvidenceAdoption(
      concurrentSecondDisposed.state,
      context("stale-review", "2029-01-01T00:07:00Z", { role: "teacher" }),
      {
        decision: "APPROVED",
        note: "stale candidate",
        proposal_digest: staleRequested.receipt.proposal_digest,
        proposal_id: staleRequested.receipt.proposal_id
      }
    );
    const rejectedStale = disposeEvidenceAdoption(
      staleReviewed.state,
      context("stale-rejected-dispose", "2029-01-03T00:01:00Z", { role: "tenant_admin" }),
      {
        disposition: "REJECTED_CANDIDATE",
        expires_at: null,
        note: "rejected after pointer advanced",
        proposal_digest: staleRequested.receipt.proposal_digest,
        proposal_id: staleRequested.receipt.proposal_id
      }
    );
    expect(rejectedStale.receipt.predecessor).toEqual({
      adoption_id: first.record.adoption_id,
      adoption_digest: first.record.adoption_digest
    });
    expectEvidenceError(
      () =>
        disposeEvidenceAdoption(
          staleReviewed.state,
          context("stale-dispose", "2029-01-03T00:00:00Z", { role: "tenant_admin" }),
          {
            disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
            expires_at: null,
            note: "stale candidate",
            proposal_digest: staleRequested.receipt.proposal_digest,
            proposal_id: staleRequested.receipt.proposal_id
          }
        ),
      "EVIDENCE_ADOPTION_PREDECESSOR_CONFLICT"
    );
  });

  it("requires exact current evidence, pointer, and unexpired source/adoption for future resolution", () => {
    const first = adopt(emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID), epoch(), "expiry", null, {
      adoptedAt: "2029-01-01T00:00:00Z",
      expires_at: "2029-06-01T00:00:00Z"
    });

    expectEvidenceError(
      () =>
        resolveFutureEvidenceAdoption(first.state, {
          adoption_digest: first.record.adoption_digest,
          adoption_id: first.record.adoption_id,
          course_id: COURSE_ID,
          epoch: { ...first.record.epoch, qualification_id: "altered" },
          now: "2029-01-02T00:00:00Z",
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_EPOCH_DIGEST_MISMATCH"
    );
    expectEvidenceError(
      () =>
        resolveFutureEvidenceAdoption(first.state, {
          adoption_digest: "f".repeat(64),
          adoption_id: first.record.adoption_id,
          course_id: COURSE_ID,
          epoch: first.record.epoch,
          now: "2029-01-02T00:00:00Z",
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_DIGEST_MISMATCH"
    );
    expectEvidenceError(
      () =>
        resolveFutureEvidenceAdoption(first.state, {
          adoption_digest: first.record.adoption_digest,
          adoption_id: first.record.adoption_id,
          course_id: COURSE_ID,
          epoch: first.record.epoch,
          now: "2029-07-01T00:00:00Z",
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_EXPIRED"
    );
    expect(
      resolveHistoricalEvidenceAdoption(first.state, {
        adoption_digest: first.record.adoption_digest,
        adoption_id: first.record.adoption_id,
        course_id: COURSE_ID,
        epoch: first.record.epoch,
        tenant_id: TENANT_ID
      })
    ).toEqual(first.record);

    const retry = disposeEvidenceAdoption(
      first.state,
      context("expiry-dispose", "2031-01-01T00:00:00Z", { role: "tenant_admin" }),
      {
        disposition: first.record.disposition,
        expires_at: first.record.expires_at,
        note: first.record.note,
        proposal_digest: first.proposal.proposal_digest,
        proposal_id: first.proposal.proposal_id
      }
    );
    expect(retry.reused).toBe(true);
    expect(retry.receipt).toEqual(first.record);
  });

  it("fails closed on malformed runtime state, duplicate entity keys, duplicate selectors, and bad receipts", () => {
    const adopted = adopt(emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID), epoch(), "malformed");
    const duplicateProposal = {
      ...adopted.state,
      proposals: [...adopted.state.proposals, adopted.state.proposals[0]!]
    } as EvidenceAdoptionState;
    expectEvidenceError(
      () =>
        resolveHistoricalEvidenceAdoption(duplicateProposal, {
          adoption_digest: adopted.record.adoption_digest,
          adoption_id: adopted.record.adoption_id,
          course_id: COURSE_ID,
          epoch: adopted.record.epoch,
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );

    const duplicateSelection = {
      ...adopted.state,
      selections: [...adopted.state.selections, adopted.state.selections[0]!]
    } as EvidenceAdoptionState;
    expectEvidenceError(
      () =>
        resolveFutureEvidenceAdoption(duplicateSelection, {
          adoption_digest: adopted.record.adoption_digest,
          adoption_id: adopted.record.adoption_id,
          course_id: COURSE_ID,
          epoch: adopted.record.epoch,
          now: "2029-01-03T00:00:00Z",
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );

    const duplicateCommand = {
      ...adopted.state,
      commands: [...adopted.state.commands, adopted.state.commands[0]!]
    } as EvidenceAdoptionState;
    expectEvidenceError(
      () =>
        resolveHistoricalEvidenceAdoption(duplicateCommand, {
          adoption_digest: adopted.record.adoption_digest,
          adoption_id: adopted.record.adoption_id,
          course_id: COURSE_ID,
          epoch: adopted.record.epoch,
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );

    const malformed = { ...adopted.state, proposals: null } as unknown as EvidenceAdoptionState;
    expectEvidenceError(
      () =>
        resolveHistoricalEvidenceAdoption(malformed, {
          adoption_digest: adopted.record.adoption_digest,
          adoption_id: adopted.record.adoption_id,
          course_id: COURSE_ID,
          epoch: adopted.record.epoch,
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );

    const missingReceipt = {
      ...adopted.state,
      commands: adopted.state.commands.slice(0, -1)
    } as EvidenceAdoptionState;
    expectEvidenceError(
      () =>
        resolveHistoricalEvidenceAdoption(missingReceipt, {
          adoption_digest: adopted.record.adoption_digest,
          adoption_id: adopted.record.adoption_id,
          course_id: COURSE_ID,
          epoch: adopted.record.epoch,
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );
  });

  it("rejects historical source fallback and wrong historical scope", () => {
    const adopted = adopt(emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID), epoch(), "history");
    expectEvidenceError(
      () =>
        resolveHistoricalEvidenceAdoption(adopted.state, {
          adoption_digest: adopted.record.adoption_digest,
          adoption_id: "missing-adoption",
          course_id: COURSE_ID,
          epoch: adopted.record.epoch,
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_NOT_FOUND"
    );
    expectEvidenceError(
      () =>
        resolveHistoricalEvidenceAdoption(adopted.state, {
          adoption_digest: adopted.record.adoption_digest,
          adoption_id: adopted.record.adoption_id,
          course_id: "other-course",
          epoch: adopted.record.epoch,
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_SCOPE_MISMATCH"
    );
  });
});

function epochWithoutDigest(): Omit<EvidenceAdoptionEpoch, "epoch_digest"> {
  return {
    calibration_dataset_content_digest: DIGEST_D,
    calibration_dataset_id: "dataset-a1",
    course_id: COURSE_ID,
    model_artifact_reference: { ...MODEL_ARTIFACT },
    model_version_reference: { ...MODEL_VERSION },
    qualification_content_digest: DIGEST_C,
    qualification_id: "qualification-a1",
    source_content_digest: DIGEST_A,
    source_expires_at: "2030-01-01T00:00:00Z",
    source_package_id: "source-a1",
    tenant_id: TENANT_ID
  };
}
