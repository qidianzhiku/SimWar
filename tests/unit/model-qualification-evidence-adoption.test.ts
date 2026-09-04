import { createHash } from "node:crypto";
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
  assertEvidenceAdoptionState,
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

function canonicalForTest(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalForTest(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalForTest(record[key])}`)
    .join(",")}}`;
}

function digestForTest(value: unknown): string {
  return createHash("sha256").update(canonicalForTest(value), "utf8").digest("hex");
}

function withoutKeyForTest(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function commandFingerprintForTest(
  commandId: string,
  actorId: string,
  action: "REVIEW" | "DISPOSE",
  payload: unknown
): string {
  return digestForTest({ action, actor_id: actorId, command_id: commandId, payload });
}

function combineBranchStates(
  primary: EvidenceAdoptionState,
  secondary: EvidenceAdoptionState
): EvidenceAdoptionState {
  const proposalIds = new Set(primary.proposals.map((proposal) => proposal.proposal_id));
  const reviewIds = new Set(primary.reviews.map((review) => review.review_id));
  const recordIds = new Set(primary.records.map((record) => record.adoption_id));
  const commandIds = new Set(primary.commands.map((command) => command.command_id));
  return {
    ...primary,
    proposals: [
      ...primary.proposals,
      ...secondary.proposals.filter((proposal) => !proposalIds.has(proposal.proposal_id))
    ],
    reviews: [
      ...primary.reviews,
      ...secondary.reviews.filter((review) => !reviewIds.has(review.review_id))
    ],
    records: [
      ...primary.records,
      ...secondary.records.filter((record) => !recordIds.has(record.adoption_id))
    ],
    selections: [...primary.selections],
    commands: [
      ...primary.commands,
      ...secondary.commands.filter((command) => !commandIds.has(command.command_id))
    ]
  };
}

function rewriteRecordForTest(
  state: EvidenceAdoptionState,
  record: EvidenceAdoptionRecord,
  changes: Partial<EvidenceAdoptionRecord>
): EvidenceAdoptionState {
  const rewrittenBody = { ...record, ...changes };
  const rewritten = {
    ...rewrittenBody,
    adoption_digest: digestForTest(withoutKeyForTest(rewrittenBody, "adoption_digest"))
  } as EvidenceAdoptionRecord;
  return {
    ...state,
    records: state.records.map((candidate) =>
      candidate.adoption_id === record.adoption_id ? rewritten : candidate
    ),
    commands: state.commands.map((command) =>
      command.action === "DISPOSE" && command.entity_id === record.adoption_id
        ? {
            ...command,
            command_fingerprint: commandFingerprintForTest(
              command.command_id,
              command.actor_id,
              "DISPOSE",
              {
                disposition: rewritten.disposition,
                expires_at: rewritten.expires_at,
                note: rewritten.note,
                proposal_digest: rewritten.proposal_digest,
                proposal_id: rewritten.proposal_id
              }
            )
          }
        : command
    )
  };
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

  it("validates read projections through the pure state assertion without mutation", () => {
    const adopted = adopt(emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID), epoch(), "read-state");
    const stateSnapshot = JSON.stringify(adopted.state);

    expect(() => assertEvidenceAdoptionState(adopted.state)).not.toThrow();
    expect(() =>
      assertEvidenceAdoptionState({ ...adopted.state, selections: [] } as EvidenceAdoptionState)
    ).toThrowError(EvidenceAdoptionError);
    expectEvidenceError(
      () =>
        assertEvidenceAdoptionState({ ...adopted.state, selections: [] } as EvidenceAdoptionState),
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );
    expect(JSON.stringify(adopted.state)).toBe(stateSnapshot);
  });

  it("rejects command ids colliding with prior proposal, review, and adoption ids in each reducer", () => {
    const root = adopt(emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID), epoch(), "collision-root");
    const nextEpoch = epoch({
      qualification_id: "qualification-collision-b",
      source_package_id: "source-collision-b"
    });
    const expectedRoot = {
      adoption_digest: root.record.adoption_digest,
      adoption_id: root.record.adoption_id
    };

    for (const collisionId of [root.proposal.proposal_id, root.record.adoption_id]) {
      expectEvidenceError(
        () => request(root.state, collisionId, nextEpoch, expectedRoot),
        "EVIDENCE_ADOPTION_STATE_INVALID"
      );
    }

    const requested = request(root.state, "collision-b-request", nextEpoch, expectedRoot);
    expectEvidenceError(
      () =>
        reviewEvidenceAdoption(
          requested.state,
          context(root.record.adoption_id, "2029-01-02T00:01:00Z"),
          {
            decision: "APPROVED",
            note: "collision review",
            proposal_digest: requested.receipt.proposal_digest,
            proposal_id: requested.receipt.proposal_id
          }
        ),
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );

    const reviewed = reviewEvidenceAdoption(
      requested.state,
      context("collision-b-review", "2029-01-02T00:01:00Z"),
      {
        decision: "APPROVED",
        note: "collision review",
        proposal_digest: requested.receipt.proposal_digest,
        proposal_id: requested.receipt.proposal_id
      }
    );
    expectEvidenceError(
      () =>
        disposeEvidenceAdoption(
          reviewed.state,
          context(root.record.review_id, "2029-01-02T00:02:00Z", { role: "tenant_admin" }),
          {
            disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
            expires_at: null,
            note: "collision adoption",
            proposal_digest: requested.receipt.proposal_digest,
            proposal_id: requested.receipt.proposal_id
          }
        ),
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );
  });

  it("binds reviewed_at and review fields to an immutable review digest", () => {
    const requested = request(
      emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID),
      "review-digest-request",
      epoch()
    );
    const reviewed = reviewEvidenceAdoption(
      requested.state,
      context("review-digest-review", "2029-01-01T00:01:00Z"),
      {
        decision: "APPROVED",
        note: "signed review",
        proposal_digest: requested.receipt.proposal_digest,
        proposal_id: requested.receipt.proposal_id
      }
    );

    expect(reviewed.receipt.review_digest).toMatch(/^[a-f0-9]{64}$/);
    const tampered = {
      ...reviewed.state,
      reviews: [{ ...reviewed.receipt, reviewed_at: "2029-01-01T00:02:00Z" }]
    } as EvidenceAdoptionState;
    expectEvidenceError(
      () =>
        requestEvidenceAdoption(tampered, context("review-digest-state-check"), {
          epoch: requested.receipt.epoch,
          expected_adoption: null
        }),
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );
  });

  it("rejects a validly re-signed adopted record linked to a rejected review", () => {
    const requested = request(
      emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID),
      "approval-link-request",
      epoch()
    );
    const reviewed = reviewEvidenceAdoption(
      requested.state,
      context("approval-link-review", "2029-01-01T00:01:00Z"),
      {
        decision: "REJECTED",
        note: "not approved",
        proposal_digest: requested.receipt.proposal_digest,
        proposal_id: requested.receipt.proposal_id
      }
    );
    const disposed = disposeEvidenceAdoption(
      reviewed.state,
      context("approval-link-dispose", "2029-01-01T00:02:00Z", { role: "tenant_admin" }),
      {
        disposition: "REJECTED_CANDIDATE",
        expires_at: null,
        note: "candidate rejected",
        proposal_digest: requested.receipt.proposal_digest,
        proposal_id: requested.receipt.proposal_id
      }
    );
    const invalid = rewriteRecordForTest(disposed.state, disposed.receipt, {
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION"
    });

    expectEvidenceError(
      () =>
        resolveHistoricalEvidenceAdoption(invalid, {
          adoption_digest: invalid.records[0]!.adoption_digest,
          adoption_id: invalid.records[0]!.adoption_id,
          course_id: COURSE_ID,
          epoch: invalid.records[0]!.epoch,
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );
  });

  it("requires one acyclic non-forking chain and an explicit selection of its unique tip", () => {
    const root = adopt(emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID), epoch(), "graph-root");
    const branchB = adopt(
      root.state,
      epoch({
        qualification_id: "qualification-graph-b",
        source_package_id: "source-graph-b"
      }),
      "graph-b",
      { adoption_id: root.record.adoption_id, adoption_digest: root.record.adoption_digest }
    );
    const branchC = adopt(
      root.state,
      epoch({
        qualification_id: "qualification-graph-c",
        source_package_id: "source-graph-c"
      }),
      "graph-c",
      { adoption_id: root.record.adoption_id, adoption_digest: root.record.adoption_digest }
    );

    const reordered = {
      ...branchB.state,
      proposals: [...branchB.state.proposals].reverse(),
      reviews: [...branchB.state.reviews].reverse(),
      records: [...branchB.state.records].reverse(),
      commands: [...branchB.state.commands].reverse()
    };
    expect(
      resolveFutureEvidenceAdoption(reordered, {
        adoption_digest: branchB.record.adoption_digest,
        adoption_id: branchB.record.adoption_id,
        course_id: COURSE_ID,
        epoch: branchB.record.epoch,
        now: "2029-01-03T00:00:00Z",
        tenant_id: TENANT_ID
      })
    ).toEqual(branchB.record);

    const forked = combineBranchStates(branchB.state, branchC.state);
    expectEvidenceError(
      () =>
        resolveHistoricalEvidenceAdoption(forked, {
          adoption_digest: branchB.record.adoption_digest,
          adoption_id: branchB.record.adoption_id,
          course_id: COURSE_ID,
          epoch: branchB.record.epoch,
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );

    const stalePointer = {
      ...branchB.state,
      selections: [root.state.selections[0]!]
    } as EvidenceAdoptionState;
    expectEvidenceError(
      () =>
        resolveHistoricalEvidenceAdoption(stalePointer, {
          adoption_digest: branchB.record.adoption_digest,
          adoption_id: branchB.record.adoption_id,
          course_id: COURSE_ID,
          epoch: branchB.record.epoch,
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );

    const missingPointer = { ...branchB.state, selections: [] } as EvidenceAdoptionState;
    expectEvidenceError(
      () =>
        resolveHistoricalEvidenceAdoption(missingPointer, {
          adoption_digest: branchB.record.adoption_digest,
          adoption_id: branchB.record.adoption_id,
          course_id: COURSE_ID,
          epoch: branchB.record.epoch,
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );

    const cyclic = {
      ...root.state,
      records: [
        {
          ...root.record,
          predecessor: {
            adoption_digest: root.record.adoption_digest,
            adoption_id: root.record.adoption_id
          }
        }
      ]
    } as EvidenceAdoptionState;
    expectEvidenceError(
      () =>
        resolveHistoricalEvidenceAdoption(cyclic, {
          adoption_digest: root.record.adoption_digest,
          adoption_id: root.record.adoption_id,
          course_id: COURSE_ID,
          epoch: root.record.epoch,
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_STATE_INVALID"
    );
  });

  it("keeps independent model and artifact scopes separately selected", () => {
    const first = adopt(emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID), epoch(), "scope-a");
    const second = adopt(
      first.state,
      epoch({
        model_version_reference: {
          ...MODEL_VERSION,
          content_digest: DIGEST_C,
          model_version_id: "model-v2",
          version: "2.0.0"
        },
        model_artifact_reference: {
          ...MODEL_ARTIFACT,
          artifact_id: "artifact-v2",
          content_digest: DIGEST_D,
          source_ref: "artifact://model-v2"
        },
        qualification_id: "qualification-scope-b",
        source_package_id: "source-scope-b"
      }),
      "scope-b"
    );

    expect(second.state.selections).toHaveLength(2);
    expect(
      resolveFutureEvidenceAdoption(second.state, {
        adoption_digest: first.record.adoption_digest,
        adoption_id: first.record.adoption_id,
        course_id: COURSE_ID,
        epoch: first.record.epoch,
        now: "2029-01-03T00:00:00Z",
        tenant_id: TENANT_ID
      })
    ).toEqual(first.record);
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
  });

  it("reuses review and disposition across changed-now retries and rejects all intent conflicts", () => {
    const requested = request(
      emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID),
      "retry-review-dispose-request",
      epoch()
    );
    const reviewInput = {
      decision: "APPROVED" as const,
      note: "retry-safe review",
      proposal_digest: requested.receipt.proposal_digest,
      proposal_id: requested.receipt.proposal_id
    };
    const reviewed = reviewEvidenceAdoption(
      requested.state,
      context("retry-review", "2029-01-01T00:01:00Z"),
      reviewInput
    );
    const reviewRetry = reviewEvidenceAdoption(
      reviewed.state,
      context("retry-review", "2029-01-02T00:01:00Z"),
      reviewInput
    );
    expect(reviewRetry.reused).toBe(true);
    expect(reviewRetry.receipt).toEqual(reviewed.receipt);
    expect(reviewRetry.receipt.reviewed_at).toBe("2029-01-01T00:01:00Z");

    expectEvidenceError(
      () =>
        reviewEvidenceAdoption(
          reviewed.state,
          context("retry-review", "2029-01-02T00:02:00Z", { actor_id: "other-teacher" }),
          reviewInput
        ),
      "EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT"
    );
    expectEvidenceError(
      () =>
        reviewEvidenceAdoption(reviewed.state, context("retry-review", "2029-01-02T00:02:00Z"), {
          ...reviewInput,
          note: "changed payload"
        }),
      "EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT"
    );
    expectEvidenceError(
      () =>
        requestEvidenceAdoption(reviewed.state, context("retry-review", "2029-01-02T00:02:00Z"), {
          epoch: requested.receipt.epoch,
          expected_adoption: null
        }),
      "EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT"
    );

    const disposeInput = {
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION" as const,
      expires_at: null,
      note: "retry-safe adoption",
      proposal_digest: requested.receipt.proposal_digest,
      proposal_id: requested.receipt.proposal_id
    };
    const disposed = disposeEvidenceAdoption(
      reviewed.state,
      context("retry-dispose", "2029-01-01T00:02:00Z", { role: "tenant_admin" }),
      disposeInput
    );
    const disposeRetry = disposeEvidenceAdoption(
      disposed.state,
      context("retry-dispose", "2029-01-02T00:02:00Z", { role: "tenant_admin" }),
      disposeInput
    );
    expect(disposeRetry.reused).toBe(true);
    expect(disposeRetry.receipt).toEqual(disposed.receipt);
    expect(disposeRetry.receipt.decided_at).toBe("2029-01-01T00:02:00Z");

    expectEvidenceError(
      () =>
        disposeEvidenceAdoption(
          disposed.state,
          context("retry-dispose", "2029-01-02T00:03:00Z", {
            actor_id: "other-admin",
            role: "tenant_admin"
          }),
          disposeInput
        ),
      "EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT"
    );
    expectEvidenceError(
      () =>
        disposeEvidenceAdoption(disposed.state, context("retry-dispose", "2029-01-02T00:03:00Z"), {
          ...disposeInput,
          note: "changed payload"
        }),
      "EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT"
    );
    expectEvidenceError(
      () =>
        reviewEvidenceAdoption(disposed.state, context("retry-dispose", "2029-01-02T00:03:00Z"), {
          ...reviewInput
        }),
      "EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT"
    );
  });

  it("does not mutate caller state, context, epoch, review, or disposition inputs", () => {
    const initial = emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID);
    const requestedEpoch = epoch();
    const requestContext = context("immutability-request");
    const requestInput = { epoch: requestedEpoch, expected_adoption: null };
    const initialSnapshot = JSON.stringify(initial);
    const requestContextSnapshot = JSON.stringify(requestContext);
    const requestInputSnapshot = JSON.stringify(requestInput);
    const requested = requestEvidenceAdoption(initial, requestContext, requestInput);

    expect(JSON.stringify(initial)).toBe(initialSnapshot);
    expect(JSON.stringify(requestContext)).toBe(requestContextSnapshot);
    expect(JSON.stringify(requestInput)).toBe(requestInputSnapshot);

    const reviewContext = context("immutability-review", "2029-01-01T00:01:00Z");
    const reviewInput = {
      decision: "APPROVED" as const,
      note: "immutable review",
      proposal_digest: requested.receipt.proposal_digest,
      proposal_id: requested.receipt.proposal_id
    };
    const reviewContextSnapshot = JSON.stringify(reviewContext);
    const reviewInputSnapshot = JSON.stringify(reviewInput);
    const reviewed = reviewEvidenceAdoption(requested.state, reviewContext, reviewInput);

    expect(JSON.stringify(reviewContext)).toBe(reviewContextSnapshot);
    expect(JSON.stringify(reviewInput)).toBe(reviewInputSnapshot);

    const disposeContext = context("immutability-dispose", "2029-01-01T00:02:00Z", {
      role: "tenant_admin"
    });
    const disposeInput = {
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION" as const,
      expires_at: null,
      note: "immutable disposition",
      proposal_digest: requested.receipt.proposal_digest,
      proposal_id: requested.receipt.proposal_id
    };
    const disposeContextSnapshot = JSON.stringify(disposeContext);
    const disposeInputSnapshot = JSON.stringify(disposeInput);
    disposeEvidenceAdoption(reviewed.state, disposeContext, disposeInput);

    expect(JSON.stringify(disposeContext)).toBe(disposeContextSnapshot);
    expect(JSON.stringify(disposeInput)).toBe(disposeInputSnapshot);
  });

  it("resolves expired historical A after B while current resolution follows B", () => {
    const first = adopt(
      emptyEvidenceAdoptionState(TENANT_ID, COURSE_ID),
      epoch({ source_expires_at: "2029-01-02T00:00:00Z" }),
      "historical-a",
      null,
      { adoptedAt: "2029-01-01T00:00:00Z", expires_at: "2029-01-02T00:00:00Z" }
    );
    const second = adopt(
      first.state,
      epoch({
        qualification_id: "qualification-historical-b",
        source_package_id: "source-historical-b"
      }),
      "historical-b",
      { adoption_id: first.record.adoption_id, adoption_digest: first.record.adoption_digest },
      { adoptedAt: "2029-01-03T00:00:00Z" }
    );

    expectEvidenceError(
      () =>
        resolveFutureEvidenceAdoption(second.state, {
          adoption_digest: first.record.adoption_digest,
          adoption_id: first.record.adoption_id,
          course_id: COURSE_ID,
          epoch: first.record.epoch,
          now: "2029-02-01T00:00:00Z",
          tenant_id: TENANT_ID
        }),
      "EVIDENCE_ADOPTION_NOT_CURRENT"
    );
    expect(
      resolveHistoricalEvidenceAdoption(second.state, {
        adoption_digest: first.record.adoption_digest,
        adoption_id: first.record.adoption_id,
        course_id: COURSE_ID,
        epoch: first.record.epoch,
        tenant_id: TENANT_ID
      })
    ).toEqual(first.record);
    expect(
      resolveFutureEvidenceAdoption(second.state, {
        adoption_digest: second.record.adoption_digest,
        adoption_id: second.record.adoption_id,
        course_id: COURSE_ID,
        epoch: second.record.epoch,
        now: "2029-02-01T00:00:00Z",
        tenant_id: TENANT_ID
      })
    ).toEqual(second.record);
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
