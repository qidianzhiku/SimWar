import { describe, expect, it, vi } from "vitest";
import type {
  EvidenceAdoptionState,
  ModelArtifactReference,
  ModelVersionReference
} from "@simwar/shared-contracts";
import { ModelQualificationService } from "../../services/api/src/model-qualification-service";
import {
  EVIDENCE_ADOPTION_ADMIN,
  EVIDENCE_ADOPTION_FOREIGN_SCOPE,
  EVIDENCE_ADOPTION_FOREIGN_TEACHER,
  EVIDENCE_ADOPTION_OTHER_SCOPE,
  EVIDENCE_ADOPTION_OTHER_TEACHER,
  EVIDENCE_ADOPTION_SCOPE,
  EVIDENCE_ADOPTION_STUDENT,
  EVIDENCE_ADOPTION_TEACHER,
  asEvidenceAdoptionService,
  adoptionReference,
  createEvidenceAdoptionClock,
  createEvidenceAdoptionServiceFixture,
  recordForScope,
  type EvidenceAdoptionServiceFixture,
  type ModelQualificationRecordWithEvidenceAdoption
} from "../helpers/model-qualification-evidence-adoption-fixtures";

describe("model qualification evidence adoption service integration", () => {
  it("adopts exact evidence A then B, persists the state, and reloads the current pointer", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const adoption = asEvidenceAdoptionService(fixture.service);
    const { primary } = fixture;

    const requestA = adoption.requestEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, primary.scope, {
      command_id: "adoption-request-a",
      expected_adoption: null,
      qualification_id: primary.qualificationA.qualification_id
    });
    expect(requestA.reused).toBe(false);
    expect(requestA.proposal).toMatchObject({
      epoch: {
        calibration_dataset_content_digest: primary.datasetA.content_digest,
        calibration_dataset_id: primary.datasetA.calibration_dataset_id,
        course_id: primary.scope.course_id,
        model_artifact_reference: primary.qualificationA.artifact,
        model_version_reference: primary.qualificationA.model_version_reference,
        qualification_content_digest: primary.qualificationA.content_digest,
        qualification_id: primary.qualificationA.qualification_id,
        source_content_digest: primary.sourceA.content_digest,
        source_expires_at: primary.sourceA.expires_at,
        source_package_id: primary.sourceA.source_package_id,
        tenant_id: primary.scope.tenant_id
      },
      expected_adoption: null,
      requested_by: EVIDENCE_ADOPTION_TEACHER.actor_id
    });
    expect(requestA.proposal.epoch.epoch_digest).toMatch(/^[a-f0-9]{64}$/);

    const reviewA = adoption.reviewEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, primary.scope, {
      command_id: "adoption-review-a",
      decision: "APPROVED",
      note: "Review exact A source, dataset, qualification, and model tuple.",
      proposal_digest: requestA.proposal.proposal_digest,
      proposal_id: requestA.proposal.proposal_id
    });
    expect(reviewA.reused).toBe(false);
    expect(reviewA.review.proposal_id).toBe(requestA.proposal.proposal_id);
    expect(
      adoption.getEvidenceAdoptionState(EVIDENCE_ADOPTION_TEACHER, primary.scope)
    ).toMatchObject({
      records: [],
      selections: []
    });

    const disposedA = adoption.disposeEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, primary.scope, {
      command_id: "adoption-dispose-a",
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: "Admit exact A for future runs.",
      proposal_digest: requestA.proposal.proposal_digest,
      proposal_id: requestA.proposal.proposal_id
    });
    expect(disposedA.reused).toBe(false);
    const stateA = adoption.getEvidenceAdoptionState(EVIDENCE_ADOPTION_ADMIN, primary.scope);
    expect(stateA.records).toHaveLength(1);
    expect(stateA.records[0]).toMatchObject({
      adoption_id: disposedA.adoption.adoption_id,
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      epoch: { qualification_id: primary.qualificationA.qualification_id },
      predecessor: null
    });
    expect(reviewA.review).toMatchObject({
      proposal_id: requestA.proposal.proposal_id,
      proposal_digest: requestA.proposal.proposal_digest
    });
    expect(reviewA.review).toHaveProperty("review_digest", expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(disposedA.adoption).toMatchObject({
      proposal_id: requestA.proposal.proposal_id,
      proposal_digest: requestA.proposal.proposal_digest,
      review_id: reviewA.review.review_id,
      predecessor: null
    });
    expect(disposedA.adoption).toHaveProperty(
      "review_digest",
      expect.stringMatching(/^[a-f0-9]{64}$/)
    );
    expect(ownPropertyValue(disposedA.adoption, "review_digest")).toBe(
      ownPropertyValue(reviewA.review, "review_digest")
    );

    const requestB = adoption.requestEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, primary.scope, {
      command_id: "adoption-request-b",
      expected_adoption: adoptionReference(disposedA.adoption),
      qualification_id: primary.qualificationB.qualification_id
    });
    const reviewB = adoption.reviewEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, primary.scope, {
      command_id: "adoption-review-b",
      decision: "APPROVED",
      note: "Review exact B source, dataset, qualification, and model tuple.",
      proposal_digest: requestB.proposal.proposal_digest,
      proposal_id: requestB.proposal.proposal_id
    });
    expect(reviewB.review.proposal_id).toBe(requestB.proposal.proposal_id);
    expect(reviewB.review).toMatchObject({
      proposal_id: requestB.proposal.proposal_id,
      proposal_digest: requestB.proposal.proposal_digest
    });
    expect(reviewB.review).toHaveProperty("review_digest", expect.stringMatching(/^[a-f0-9]{64}$/));
    const disposedB = adoption.disposeEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, primary.scope, {
      command_id: "adoption-dispose-b",
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: "Advance the exact future-admission pointer to B.",
      proposal_digest: requestB.proposal.proposal_digest,
      proposal_id: requestB.proposal.proposal_id
    });
    expect(disposedB.adoption).toMatchObject({
      proposal_id: requestB.proposal.proposal_id,
      proposal_digest: requestB.proposal.proposal_digest,
      review_id: reviewB.review.review_id
    });
    expect(disposedB.adoption.predecessor).toEqual(adoptionReference(disposedA.adoption));
    expect(disposedB.adoption).toHaveProperty(
      "review_digest",
      expect.stringMatching(/^[a-f0-9]{64}$/)
    );
    expect(ownPropertyValue(disposedB.adoption, "review_digest")).toBe(
      ownPropertyValue(reviewB.review, "review_digest")
    );

    const stateB = adoption.getEvidenceAdoptionState(EVIDENCE_ADOPTION_TEACHER, primary.scope);
    expect(stateB.proposals).toHaveLength(2);
    expect(stateB.reviews).toHaveLength(2);
    expect(stateB.records).toHaveLength(2);
    const currentSelection = selectionForQualification(stateB, primary.qualificationB);
    expect(currentSelection).toMatchObject({
      adoption_digest: disposedB.adoption.adoption_digest,
      adoption_id: disposedB.adoption.adoption_id
    });
    expect(
      stateB.selections.filter(
        (selection) =>
          selection.model_version_reference.model_version_id ===
            primary.qualificationB.model_version_reference.model_version_id &&
          selection.model_artifact_reference.artifact_id ===
            primary.qualificationB.artifact.artifact_id
      )
    ).toHaveLength(1);

    const persisted = recordForScope(fixture.persistence, primary.scope);
    expect(persisted.evidence_adoption).toEqual(stateB);

    const reloadedService = new ModelQualificationService(
      createEvidenceAdoptionClock(),
      fixture.persistence
    );
    const reloadedAdoption = asEvidenceAdoptionService(reloadedService);
    const reloadedState = reloadedAdoption.getEvidenceAdoptionState(
      EVIDENCE_ADOPTION_ADMIN,
      primary.scope
    );
    expect(reloadedState).toEqual(stateB);

    const reloadedRecord = recordForScope(fixture.persistence, primary.scope);
    const reloadedA = historicalQualificationSlice(reloadedRecord, primary);
    expect(JSON.stringify(reloadedA)).toBe(primary.originalSerializedA);
    const historyDeleted = !reloadedRecord.qualifications.some(
      (qualification) => qualification.qualification_id === primary.qualificationA.qualification_id
    );
    expect(historyDeleted).toBe(false);
    const historicalReceiptRewritten = JSON.stringify(reloadedA) !== primary.originalSerializedA;
    expect(historicalReceiptRewritten).toBe(false);
  });

  it("keeps review-only state unselected and preserves A for defer, reject, and rebase", () => {
    const dispositions = [
      { disposition: "DEFERRED_WITH_EXPIRY" as const, expires_at: "2026-09-10T00:00:00.000Z" },
      { disposition: "REJECTED_CANDIDATE" as const, expires_at: null },
      { disposition: "REBASE_REQUIRED" as const, expires_at: null }
    ];

    for (const candidate of dispositions) {
      const fixture = createEvidenceAdoptionServiceFixture();
      const adoption = asEvidenceAdoptionService(fixture.service);
      const adoptedA = adoptA(fixture);
      const reviewedState = adoption.getEvidenceAdoptionState(
        EVIDENCE_ADOPTION_TEACHER,
        fixture.primary.scope
      );
      expect(
        selectionForQualification(reviewedState, fixture.primary.qualificationA)
      ).toMatchObject({
        adoption_id: adoptedA.adoption.adoption_id
      });

      const requestB = adoption.requestEvidenceAdoption(
        EVIDENCE_ADOPTION_TEACHER,
        fixture.primary.scope,
        {
          command_id: `unchanged-pointer-request-${candidate.disposition}`,
          expected_adoption: adoptionReference(adoptedA.adoption),
          qualification_id: fixture.primary.qualificationB.qualification_id
        }
      );
      const reviewB = adoption.reviewEvidenceAdoption(
        EVIDENCE_ADOPTION_TEACHER,
        fixture.primary.scope,
        {
          command_id: `unchanged-pointer-review-${candidate.disposition}`,
          decision: "APPROVED",
          note: `Review candidate before ${candidate.disposition}.`,
          proposal_digest: requestB.proposal.proposal_digest,
          proposal_id: requestB.proposal.proposal_id
        }
      );
      const disposedB = adoption.disposeEvidenceAdoption(
        EVIDENCE_ADOPTION_TEACHER,
        fixture.primary.scope,
        {
          command_id: `unchanged-pointer-dispose-${candidate.disposition}`,
          disposition: candidate.disposition,
          expires_at: candidate.expires_at,
          note: `Keep A selected after ${candidate.disposition}.`,
          proposal_digest: requestB.proposal.proposal_digest,
          proposal_id: requestB.proposal.proposal_id
        }
      );
      expect(reviewB.review.proposal_id).toBe(requestB.proposal.proposal_id);
      expect(disposedB.adoption.disposition).toBe(candidate.disposition);

      const finalState = adoption.getEvidenceAdoptionState(
        EVIDENCE_ADOPTION_ADMIN,
        fixture.primary.scope
      );
      expect(selectionForQualification(finalState, fixture.primary.qualificationA)).toMatchObject({
        adoption_id: adoptedA.adoption.adoption_id,
        adoption_digest: adoptedA.adoption.adoption_digest
      });
      const selectionForBModelScope = selectionForQualification(
        finalState,
        fixture.primary.qualificationB
      );
      expect(selectionForBModelScope).toMatchObject({
        adoption_id: adoptedA.adoption.adoption_id,
        adoption_digest: adoptedA.adoption.adoption_digest
      });
      expect(selectionForBModelScope?.adoption_id).not.toBe(disposedB.adoption.adoption_id);
    }
  });

  it("denies a student read and write, with write denial before state lookup", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const adoption = asEvidenceAdoptionService(fixture.service);
    const persistedBefore = recordForScope(fixture.persistence, EVIDENCE_ADOPTION_SCOPE);
    const auditsBefore = JSON.stringify(fixture.persistence.audits);
    const getStateSpy = vi.spyOn(adoption, "getEvidenceAdoptionState");

    expectNamedServiceError(
      () =>
        adoption.requestEvidenceAdoption(EVIDENCE_ADOPTION_STUDENT, EVIDENCE_ADOPTION_SCOPE, {
          command_id: "student-must-not-adopt",
          expected_adoption: null,
          qualification_id: fixture.primary.qualificationA.qualification_id
        }),
      /^EVIDENCE_ADOPTION_ROLE_DENIED$/
    );
    expect(getStateSpy).not.toHaveBeenCalled();
    expect(recordForScope(fixture.persistence, EVIDENCE_ADOPTION_SCOPE)).toEqual(persistedBefore);
    expect(JSON.stringify(fixture.persistence.audits)).toBe(auditsBefore);
    getStateSpy.mockRestore();

    expectNamedServiceError(
      () => adoption.getEvidenceAdoptionState(EVIDENCE_ADOPTION_STUDENT, EVIDENCE_ADOPTION_SCOPE),
      /^EVIDENCE_ADOPTION_ROLE_DENIED$/
    );
    expect(recordForScope(fixture.persistence, EVIDENCE_ADOPTION_SCOPE)).toEqual(persistedBefore);
    expect(JSON.stringify(fixture.persistence.audits)).toBe(auditsBefore);
  });

  it("scopes exact idempotency by tenant and course and rejects actor or payload conflicts", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const adoption = asEvidenceAdoptionService(fixture.service);
    const command_id = "same-command-across-scopes";

    const first = adoption.requestEvidenceAdoption(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id,
        expected_adoption: null,
        qualification_id: fixture.primary.qualificationA.qualification_id
      }
    );
    const retry = adoption.requestEvidenceAdoption(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id,
        expected_adoption: null,
        qualification_id: fixture.primary.qualificationA.qualification_id
      }
    );
    expect(retry.reused).toBe(true);
    expect(retry.proposal).toEqual(first.proposal);

    const beforeActorConflict = recordForScope(fixture.persistence, EVIDENCE_ADOPTION_SCOPE);
    const auditsBeforeActorConflict = JSON.stringify(fixture.persistence.audits);
    expectNamedServiceError(
      () =>
        adoption.requestEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
          command_id,
          expected_adoption: null,
          qualification_id: fixture.primary.qualificationA.qualification_id
        }),
      /^EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT$/
    );
    expect(recordForScope(fixture.persistence, EVIDENCE_ADOPTION_SCOPE)).toEqual(
      beforeActorConflict
    );
    expect(JSON.stringify(fixture.persistence.audits)).toBe(auditsBeforeActorConflict);

    const otherCourse = adoption.requestEvidenceAdoption(
      EVIDENCE_ADOPTION_OTHER_TEACHER,
      EVIDENCE_ADOPTION_OTHER_SCOPE,
      {
        command_id,
        expected_adoption: null,
        qualification_id: fixture.secondary.qualificationA.qualification_id
      }
    );
    expect(otherCourse.reused).toBe(false);
    expect(otherCourse.proposal.proposal_id).not.toBe(first.proposal.proposal_id);

    const otherTenant = adoption.requestEvidenceAdoption(
      EVIDENCE_ADOPTION_FOREIGN_TEACHER,
      EVIDENCE_ADOPTION_FOREIGN_SCOPE,
      {
        command_id,
        expected_adoption: null,
        qualification_id: fixture.foreign.qualificationA.qualification_id
      }
    );
    expect(otherTenant.reused).toBe(false);
    expect(otherTenant.proposal.proposal_id).not.toBe(first.proposal.proposal_id);

    expectNamedServiceError(
      () =>
        adoption.requestEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, EVIDENCE_ADOPTION_SCOPE, {
          command_id,
          expected_adoption: null,
          qualification_id: fixture.primary.qualificationB.qualification_id
        }),
      /^EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT$/
    );
    expect(
      adoption.getEvidenceAdoptionState(EVIDENCE_ADOPTION_TEACHER, EVIDENCE_ADOPTION_SCOPE).commands
    ).toHaveLength(1);
    expect(
      adoption.getEvidenceAdoptionState(
        EVIDENCE_ADOPTION_OTHER_TEACHER,
        EVIDENCE_ADOPTION_OTHER_SCOPE
      ).commands
    ).toHaveLength(1);
    expect(
      adoption.getEvidenceAdoptionState(
        EVIDENCE_ADOPTION_FOREIGN_TEACHER,
        EVIDENCE_ADOPTION_FOREIGN_SCOPE
      ).commands
    ).toHaveLength(1);
  });

  it("rejects a mismatched actor tenant for scoped get and write without persistence changes", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const adoption = asEvidenceAdoptionService(fixture.service);
    const persistedBefore = recordForScope(fixture.persistence, EVIDENCE_ADOPTION_SCOPE);
    const auditsBefore = JSON.stringify(fixture.persistence.audits);

    expectNamedServiceError(
      () =>
        adoption.getEvidenceAdoptionState(
          EVIDENCE_ADOPTION_FOREIGN_TEACHER,
          EVIDENCE_ADOPTION_SCOPE
        ),
      /^MODEL_QUALIFICATION_SCOPE_CONFLICT$/
    );
    expect(recordForScope(fixture.persistence, EVIDENCE_ADOPTION_SCOPE)).toEqual(persistedBefore);
    expect(JSON.stringify(fixture.persistence.audits)).toBe(auditsBefore);

    expectNamedServiceError(
      () =>
        adoption.requestEvidenceAdoption(
          EVIDENCE_ADOPTION_FOREIGN_TEACHER,
          EVIDENCE_ADOPTION_SCOPE,
          {
            command_id: "foreign-tenant-write",
            expected_adoption: null,
            qualification_id: fixture.primary.qualificationA.qualification_id
          }
        ),
      /^MODEL_QUALIFICATION_SCOPE_CONFLICT$/
    );
    expect(recordForScope(fixture.persistence, EVIDENCE_ADOPTION_SCOPE)).toEqual(persistedBefore);
    expect(JSON.stringify(fixture.persistence.audits)).toBe(auditsBefore);
  });

  it("rejects A proposal and qualification references in B course without membership RBAC", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const adoption = asEvidenceAdoptionService(fixture.service);
    const requestA = adoption.requestEvidenceAdoption(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "course-a-request",
        expected_adoption: null,
        qualification_id: fixture.primary.qualificationA.qualification_id
      }
    );
    const primaryBefore = recordForScope(fixture.persistence, EVIDENCE_ADOPTION_SCOPE);
    const secondaryBefore = recordForScope(fixture.persistence, EVIDENCE_ADOPTION_OTHER_SCOPE);
    const auditsBefore = JSON.stringify(fixture.persistence.audits);

    expect(
      adoption.getEvidenceAdoptionState(
        EVIDENCE_ADOPTION_OTHER_TEACHER,
        EVIDENCE_ADOPTION_OTHER_SCOPE
      )
    ).toMatchObject({
      commands: [],
      course_id: EVIDENCE_ADOPTION_OTHER_SCOPE.course_id,
      proposals: [],
      records: [],
      reviews: [],
      selections: [],
      tenant_id: EVIDENCE_ADOPTION_OTHER_SCOPE.tenant_id
    });

    expectNamedServiceError(
      () =>
        adoption.requestEvidenceAdoption(
          EVIDENCE_ADOPTION_OTHER_TEACHER,
          EVIDENCE_ADOPTION_OTHER_SCOPE,
          {
            command_id: "course-a-qualification-reference",
            expected_adoption: null,
            qualification_id: fixture.primary.qualificationA.qualification_id
          }
        ),
      /^EVIDENCE_ADOPTION_EXACT_SOURCE_REQUIRED$/
    );
    expectNamedServiceError(
      () =>
        adoption.reviewEvidenceAdoption(
          EVIDENCE_ADOPTION_OTHER_TEACHER,
          EVIDENCE_ADOPTION_OTHER_SCOPE,
          {
            command_id: "course-a-request",
            decision: "APPROVED",
            note: "A proposal must not be reviewable in B course.",
            proposal_digest: requestA.proposal.proposal_digest,
            proposal_id: requestA.proposal.proposal_id
          }
        ),
      /^EVIDENCE_ADOPTION_NOT_FOUND$/
    );
    expect(recordForScope(fixture.persistence, EVIDENCE_ADOPTION_SCOPE)).toEqual(primaryBefore);
    expect(recordForScope(fixture.persistence, EVIDENCE_ADOPTION_OTHER_SCOPE)).toEqual(
      secondaryBefore
    );
    expect(JSON.stringify(fixture.persistence.audits)).toBe(auditsBefore);
  });

  it("reuses service request, review, and disposition commands without creating duplicates", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const adoption = asEvidenceAdoptionService(fixture.service);
    const chain = fixture.primary;
    const requestInput = {
      command_id: "service-idempotent-request",
      expected_adoption: null,
      qualification_id: chain.qualificationA.qualification_id
    } as const;
    const requested = adoption.requestEvidenceAdoption(
      EVIDENCE_ADOPTION_TEACHER,
      chain.scope,
      requestInput
    );
    const retriedRequest = adoption.requestEvidenceAdoption(
      EVIDENCE_ADOPTION_TEACHER,
      chain.scope,
      requestInput
    );
    expect(retriedRequest.reused).toBe(true);
    expect(retriedRequest.proposal).toEqual(requested.proposal);
    expectNamedServiceError(
      () =>
        adoption.requestEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, chain.scope, {
          ...requestInput,
          qualification_id: chain.qualificationB.qualification_id
        }),
      /^EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT$/
    );

    const reviewInput = {
      command_id: "service-idempotent-review",
      decision: "APPROVED" as const,
      note: "Review exact service proposal once.",
      proposal_digest: requested.proposal.proposal_digest,
      proposal_id: requested.proposal.proposal_id
    };
    const reviewed = adoption.reviewEvidenceAdoption(
      EVIDENCE_ADOPTION_TEACHER,
      chain.scope,
      reviewInput
    );
    const retriedReview = adoption.reviewEvidenceAdoption(
      EVIDENCE_ADOPTION_TEACHER,
      chain.scope,
      reviewInput
    );
    expect(retriedReview.reused).toBe(true);
    expect(retriedReview.review).toEqual(reviewed.review);
    expectNamedServiceError(
      () =>
        adoption.reviewEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, chain.scope, {
          ...reviewInput,
          note: "Conflicting service review intent."
        }),
      /^EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT$/
    );

    const disposeInput = {
      command_id: "service-idempotent-dispose",
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION" as const,
      expires_at: null,
      note: "Adopt exact service proposal.",
      proposal_digest: requested.proposal.proposal_digest,
      proposal_id: requested.proposal.proposal_id
    };
    const disposed = adoption.disposeEvidenceAdoption(
      EVIDENCE_ADOPTION_ADMIN,
      chain.scope,
      disposeInput
    );
    const retriedDispose = adoption.disposeEvidenceAdoption(
      EVIDENCE_ADOPTION_ADMIN,
      chain.scope,
      disposeInput
    );
    expect(retriedDispose.reused).toBe(true);
    expect(retriedDispose.adoption).toEqual(disposed.adoption);
    expectNamedServiceError(
      () =>
        adoption.disposeEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, chain.scope, {
          ...disposeInput,
          disposition: "REJECTED_CANDIDATE"
        }),
      /^EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT$/
    );
    expect(
      adoption.getEvidenceAdoptionState(EVIDENCE_ADOPTION_ADMIN, chain.scope).commands
    ).toHaveLength(3);
  });

  it.each([
    {
      label: "expired source",
      errorPattern: /^EVIDENCE_ADOPTION_SOURCE_NOT_ELIGIBLE$/,
      update: (
        source: ModelQualificationRecordWithEvidenceAdoption["source_packages"][number]
      ) => ({
        ...source,
        expires_at: "2026-09-02T00:00:00.000Z"
      })
    },
    {
      label: "invalid source rights",
      errorPattern: /^EVIDENCE_ADOPTION_SOURCE_NOT_ELIGIBLE$/,
      update: (
        source: ModelQualificationRecordWithEvidenceAdoption["source_packages"][number]
      ) => ({
        ...source,
        rights_status: "RESTRICTED" as const
      })
    }
  ])(
    "rejects $label when deriving an adoption epoch from current records",
    ({ errorPattern, update }) => {
      const fixture = createEvidenceAdoptionServiceFixture();
      const existingAuditCount = fixture.persistence.audits.length;
      const altered = JSON.parse(
        JSON.stringify(fixture.primary.record)
      ) as ModelQualificationRecordWithEvidenceAdoption;
      altered.source_packages = altered.source_packages.map((source) =>
        source.source_package_id === fixture.primary.sourceA.source_package_id
          ? update(source)
          : source
      );
      fixture.persistence.replaceRecord(altered);
      const reloadedService = new ModelQualificationService(
        createEvidenceAdoptionClock(),
        fixture.persistence
      );
      const adoption = asEvidenceAdoptionService(reloadedService);

      expectNamedServiceError(
        () =>
          adoption.requestEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, fixture.primary.scope, {
            command_id: "invalid-current-evidence",
            expected_adoption: null,
            qualification_id: fixture.primary.qualificationA.qualification_id
          }),
        errorPattern
      );
      expect(fixture.persistence.audits).toHaveLength(existingAuditCount);
    }
  );

  it("does not adopt a candidate while an unresolved O3 requalification preview blocks it", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const preview = fixture.service.createRequalificationPreview(
      EVIDENCE_ADOPTION_TEACHER,
      fixture.primary.scope,
      {
        baseline_source_package_id: fixture.primary.sourceA.source_package_id,
        candidate_source_package_id: fixture.primary.sourceB.source_package_id
      }
    );
    expect(preview.preview).toMatchObject({ resolution: "PENDING", status: "REBASE_REQUIRED" });

    const adoption = asEvidenceAdoptionService(fixture.service);
    expectNamedServiceError(
      () =>
        adoption.requestEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, fixture.primary.scope, {
          command_id: "unresolved-o3-preview",
          expected_adoption: null,
          qualification_id: fixture.primary.qualificationB.qualification_id
        }),
      /^EVIDENCE_ADOPTION_REQUALIFICATION_UNRESOLVED$/
    );
    expect(
      recordForScope(fixture.persistence, fixture.primary.scope).evidence_adoption
    ).toBeUndefined();
  });

  it("rejects a stale expected predecessor id or digest before creating B", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const adoption = asEvidenceAdoptionService(fixture.service);
    const adoptedA = adoptA(fixture);

    expectNamedServiceError(
      () =>
        adoption.requestEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, fixture.primary.scope, {
          command_id: "stale-predecessor-id",
          expected_adoption: {
            adoption_digest: adoptedA.adoption.adoption_digest,
            adoption_id: "adoption-not-a"
          },
          qualification_id: fixture.primary.qualificationB.qualification_id
        }),
      /^EVIDENCE_ADOPTION_PREDECESSOR_CONFLICT$/
    );
    expectNamedServiceError(
      () =>
        adoption.requestEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, fixture.primary.scope, {
          command_id: "stale-predecessor-digest",
          expected_adoption: {
            adoption_digest: "f".repeat(64),
            adoption_id: adoptedA.adoption.adoption_id
          },
          qualification_id: fixture.primary.qualificationB.qualification_id
        }),
      /^EVIDENCE_ADOPTION_PREDECESSOR_CONFLICT$/
    );
    expect(
      adoption.getEvidenceAdoptionState(EVIDENCE_ADOPTION_ADMIN, fixture.primary.scope).proposals
    ).toHaveLength(1);
  });
});

function adoptA(fixture: EvidenceAdoptionServiceFixture) {
  const adoption = asEvidenceAdoptionService(fixture.service);
  const request = adoption.requestEvidenceAdoption(
    EVIDENCE_ADOPTION_TEACHER,
    fixture.primary.scope,
    {
      command_id: "shared-adopt-a",
      expected_adoption: null,
      qualification_id: fixture.primary.qualificationA.qualification_id
    }
  );
  adoption.reviewEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, fixture.primary.scope, {
    command_id: "shared-review-a",
    decision: "APPROVED",
    note: "Review exact A evidence.",
    proposal_digest: request.proposal.proposal_digest,
    proposal_id: request.proposal.proposal_id
  });
  return adoption.disposeEvidenceAdoption(EVIDENCE_ADOPTION_TEACHER, fixture.primary.scope, {
    command_id: "shared-dispose-a",
    disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
    expires_at: null,
    note: "Adopt exact A evidence.",
    proposal_digest: request.proposal.proposal_digest,
    proposal_id: request.proposal.proposal_id
  });
}

function selectionForQualification(
  state: EvidenceAdoptionState,
  qualification: {
    model_version_reference: ModelVersionReference;
    artifact: ModelArtifactReference;
  }
) {
  return state.selections.find(
    (selection) =>
      selection.model_version_reference.model_version_id ===
        qualification.model_version_reference.model_version_id &&
      selection.model_version_reference.version === qualification.model_version_reference.version &&
      selection.model_version_reference.content_digest ===
        qualification.model_version_reference.content_digest &&
      selection.model_artifact_reference.artifact_id === qualification.artifact.artifact_id &&
      selection.model_artifact_reference.content_digest === qualification.artifact.content_digest
  );
}

function historicalQualificationSlice(
  record: ModelQualificationRecordWithEvidenceAdoption,
  chain: EvidenceAdoptionServiceFixture["primary"]
) {
  const source = record.source_packages.find(
    (candidate) => candidate.source_package_id === chain.sourceA.source_package_id
  );
  const dataset = record.calibration_datasets.find(
    (candidate) => candidate.calibration_dataset_id === chain.datasetA.calibration_dataset_id
  );
  const qualification = record.qualifications.find(
    (candidate) => candidate.qualification_id === chain.qualificationA.qualification_id
  );
  if (!source || !dataset || !qualification)
    throw new Error("historical A chain missing after reload");
  return { dataset, qualification, source };
}

function ownPropertyValue(value: object, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(value, key) ? Reflect.get(value, key) : undefined;
}

function expectNamedServiceError(action: () => unknown, codePattern: RegExp): void {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect(thrown instanceof Error ? thrown.message : undefined).toMatch(codePattern);
}
