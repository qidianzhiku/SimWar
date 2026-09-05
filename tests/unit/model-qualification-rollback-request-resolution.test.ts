import { describe, expect, it } from "vitest";
import { resolveRollbackRequestOutcome } from "../../services/api/src/model-qualification-rollback-request-resolution";
import {
  EVIDENCE_ADOPTION_ADMIN,
  EVIDENCE_ADOPTION_SCOPE,
  EVIDENCE_ADOPTION_TEACHER,
  adoptionReference,
  ModelQualificationEvidenceAdoptionFakePersistence,
  seedApprovedBoundChain
} from "../helpers/model-qualification-evidence-adoption-fixtures";
import { ModelQualificationService } from "../../services/api/src/model-qualification-service";
import {
  digestAdoptionOperationsPolicy,
  digestEvidenceAdoptionState
} from "../../services/api/src/model-qualification-adoption-drift-assessment";

function buildRequestFixture() {
  const persistence = new ModelQualificationEvidenceAdoptionFakePersistence();
  const service = new ModelQualificationService(
    { now: () => "2026-09-02T12:00:00.000Z" },
    persistence
  );
  const primary = seedApprovedBoundChain(
    service,
    EVIDENCE_ADOPTION_SCOPE,
    EVIDENCE_ADOPTION_TEACHER
  );
  const adopt = (
    qualificationId: string,
    command: string,
    expected: ReturnType<typeof adoptionReference> | null
  ) => {
    const proposal = service.requestEvidenceAdoption(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: `${command}-request`,
        qualification_id: qualificationId,
        expected_adoption: expected
      }
    ).proposal;
    service.reviewEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
      command_id: `${command}-review`,
      proposal_id: proposal.proposal_id,
      proposal_digest: proposal.proposal_digest,
      decision: "APPROVED",
      note: "O8 fixture review"
    });
    return service.disposeEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
      command_id: `${command}-dispose`,
      proposal_id: proposal.proposal_id,
      proposal_digest: proposal.proposal_digest,
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: "O8 fixture adoption"
    }).adoption;
  };
  const adoptionA = adopt(primary.qualificationA.qualification_id, "o8-a", null);
  const adoptionB = adopt(
    primary.qualificationB.qualification_id,
    "o8-b",
    adoptionReference(adoptionA)
  );
  const stateBefore = service.getEvidenceAdoptionState(
    EVIDENCE_ADOPTION_TEACHER,
    EVIDENCE_ADOPTION_SCOPE
  );
  const dryRun = service.dryRunEvidenceAdoptionRollback(
    EVIDENCE_ADOPTION_ADMIN,
    EVIDENCE_ADOPTION_SCOPE,
    {
      course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
      current_adoption: adoptionReference(adoptionB),
      predecessor_adoption: adoptionReference(adoptionA),
      expected_adoption_state_digest: digestEvidenceAdoptionState(stateBefore),
      expected_operations_policy_digest: digestAdoptionOperationsPolicy(),
      assessed_at: "2026-09-02T12:00:00.000Z"
    }
  );
  return { adoptionA, adoptionB, dryRun, primary, service };
}

function resolutionFor(fixture: ReturnType<typeof buildRequestFixture>) {
  const record = fixture.service.getRecordForScope(EVIDENCE_ADOPTION_SCOPE)!;
  return resolveRollbackRequestOutcome({
    tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
    course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
    request: record.governed_rollback_requests![0]!,
    adoption_state: fixture.service.getEvidenceAdoptionState(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE
    )
  });
}

describe("O8 rollback request outcome resolution", () => {
  it("resolves pending review without treating it as rejection", async () => {
    const fixture = buildRequestFixture();
    const dryRun = await fixture.dryRun;
    expect(dryRun).toMatchObject({
      status: "READY_WITH_LIMITS",
      future_admission_impact: "WOULD_SELECT_EXACT_PREDECESSOR",
      blockers: []
    });
    const receipt = await fixture.service.requestGovernedRollback(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "o8-outcome-pending",
        dry_run: dryRun,
        reason: "Resolve exact request outcome."
      }
    );
    const resolution = resolutionFor(fixture);
    expect(resolution.outcome_status).toBe("PENDING_REVIEW");
    expect(resolution.review).toBeNull();
    expect(resolution.historical_outcome.status).toBe("PENDING_REVIEW");
    expect(resolution.immutable_request_status).toBe("LINKED_PROPOSAL_PENDING_REVIEW");
    expect(receipt.request.rollback_request_id).toBe(resolution.rollback_request_id);
  });

  it("resolves rejected and approved-pending-disposition states from the exact proposal", async () => {
    const rejected = buildRequestFixture();
    const rejectedReceipt = await rejected.service.requestGovernedRollback(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "o8-outcome-rejected",
        dry_run: await rejected.dryRun,
        reason: "Reject exact request."
      }
    );
    await rejected.service.reviewEvidenceAdoption(
      EVIDENCE_ADOPTION_ADMIN,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "o8-outcome-rejected-review",
        proposal_id: rejectedReceipt.proposal.proposal_id,
        proposal_digest: rejectedReceipt.proposal.proposal_digest,
        decision: "REJECTED",
        note: "Rejected for this fixture."
      }
    );
    expect(resolutionFor(rejected).outcome_status).toBe("REVIEW_REJECTED");

    const approved = buildRequestFixture();
    const approvedReceipt = await approved.service.requestGovernedRollback(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "o8-outcome-approved",
        dry_run: await approved.dryRun,
        reason: "Approve exact request."
      }
    );
    await approved.service.reviewEvidenceAdoption(
      EVIDENCE_ADOPTION_ADMIN,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "o8-outcome-approved-review",
        proposal_id: approvedReceipt.proposal.proposal_id,
        proposal_digest: approvedReceipt.proposal.proposal_digest,
        decision: "APPROVED",
        note: "Approved for disposition."
      }
    );
    expect(resolutionFor(approved).outcome_status).toBe("APPROVED_PENDING_DISPOSITION");
  });

  it("derives readoption C and marks it superseded when later selection D is current", async () => {
    const fixture = buildRequestFixture();
    const receipt = await fixture.service.requestGovernedRollback(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "o8-outcome-readopted",
        dry_run: await fixture.dryRun,
        reason: "Readopt exact historical predecessor."
      }
    );
    await fixture.service.reviewEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
      command_id: "o8-outcome-readopted-review",
      proposal_id: receipt.proposal.proposal_id,
      proposal_digest: receipt.proposal.proposal_digest,
      decision: "APPROVED",
      note: "Approved."
    });
    await fixture.service.disposeEvidenceAdoption(
      EVIDENCE_ADOPTION_ADMIN,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "o8-outcome-readopted-dispose",
        proposal_id: receipt.proposal.proposal_id,
        proposal_digest: receipt.proposal.proposal_digest,
        disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
        expires_at: null,
        note: "Readopt through O5."
      }
    );
    const resolution = resolutionFor(fixture);
    const state = fixture.service.getEvidenceAdoptionState(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE
    );
    const selection = state.selections[0]!;
    const laterState = {
      ...state,
      selections: [
        {
          adoption_id: "adoption-d",
          adoption_digest: "d".repeat(64),
          model_version_reference: selection.model_version_reference,
          model_artifact_reference: selection.model_artifact_reference
        }
      ]
    };
    const record = fixture.service.getRecordForScope(EVIDENCE_ADOPTION_SCOPE)!;
    const laterResolution = resolveRollbackRequestOutcome({
      tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
      course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
      request: record.governed_rollback_requests![0]!,
      adoption_state: laterState
    });
    expect(resolution.outcome_status).toBe("READOPTED_FOR_FUTURE_ADMISSION");
    expect(resolution.resulting_adoption).not.toBeNull();
    expect(laterResolution.current_effect).toBe("SUPERSEDED");
    expect(laterResolution.historical_consistency).toBe("CONSISTENT");
    expect(laterResolution.request.current_selection_changed).toBe(false);
  });

  it("fails closed for ambiguous linkage and never leaks another scope", async () => {
    const fixture = buildRequestFixture();
    const receipt = await fixture.service.requestGovernedRollback(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "o8-outcome-ambiguous",
        dry_run: await fixture.dryRun,
        reason: "Ambiguous lineage fixture."
      }
    );
    const record = fixture.service.getRecordForScope(EVIDENCE_ADOPTION_SCOPE)!;
    const state = fixture.service.getEvidenceAdoptionState(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE
    );
    const ambiguous = {
      ...state,
      proposals: [...state.proposals, structuredClone(receipt.proposal)]
    };
    const resolution = resolveRollbackRequestOutcome({
      tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
      course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
      request: record.governed_rollback_requests![0]!,
      adoption_state: ambiguous
    });
    expect(resolution.outcome_status).toBe("REBASE_REQUIRED");
    expect(resolution.historical_consistency).toBe("INCONSISTENT");
    expect(resolution.known_limits.join(" ")).toContain("exactly one matching linked proposal");
  });
});
