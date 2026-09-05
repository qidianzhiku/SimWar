import { describe, expect, it } from "vitest";
import { assessReadoptionHistoricalConsistency } from "../../services/api/src/model-qualification-readoption-historical-consistency";
import {
  EVIDENCE_ADOPTION_ADMIN,
  EVIDENCE_ADOPTION_SCOPE,
  EVIDENCE_ADOPTION_TEACHER,
  ModelQualificationEvidenceAdoptionFakePersistence,
  adoptionReference,
  seedApprovedBoundChain
} from "../helpers/model-qualification-evidence-adoption-fixtures";
import { ModelQualificationService } from "../../services/api/src/model-qualification-service";
import {
  digestAdoptionOperationsPolicy,
  digestEvidenceAdoptionState
} from "../../services/api/src/model-qualification-adoption-drift-assessment";

function buildReadoptionFixture() {
  const service = new ModelQualificationService(
    { now: () => "2026-09-02T12:00:00.000Z" },
    new ModelQualificationEvidenceAdoptionFakePersistence()
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
      note: "O8 A2 fixture review"
    });
    return service.disposeEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
      command_id: `${command}-dispose`,
      proposal_id: proposal.proposal_id,
      proposal_digest: proposal.proposal_digest,
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: "O8 A2 fixture adoption"
    }).adoption;
  };

  const adoptionA = adopt(primary.qualificationA.qualification_id, "o8-a2-a", null);
  const adoptionB = adopt(
    primary.qualificationB.qualification_id,
    "o8-a2-b",
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
  return { adoptionA, adoptionB, dryRun, service };
}

describe("O8 readoption historical consistency", () => {
  it("preserves A/B history and derives a new C identity from the exact lineage", async () => {
    const fixture = buildReadoptionFixture();
    const requestReceipt = await fixture.service.requestGovernedRollback(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "o8-a2-request",
        dry_run: await fixture.dryRun,
        reason: "A2 exact lineage fixture."
      }
    );
    await fixture.service.reviewEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
      command_id: "o8-a2-request-review",
      proposal_id: requestReceipt.proposal.proposal_id,
      proposal_digest: requestReceipt.proposal.proposal_digest,
      decision: "APPROVED",
      note: "A2 approved"
    });
    await fixture.service.disposeEvidenceAdoption(
      EVIDENCE_ADOPTION_ADMIN,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "o8-a2-request-dispose",
        proposal_id: requestReceipt.proposal.proposal_id,
        proposal_digest: requestReceipt.proposal.proposal_digest,
        disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
        expires_at: null,
        note: "A2 readoption C"
      }
    );

    const state = fixture.service.getEvidenceAdoptionState(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE
    );
    const proposal = state.proposals.find(
      (item) => item.proposal_id === requestReceipt.proposal.proposal_id
    )!;
    const review = state.reviews.find((item) => item.proposal_id === proposal.proposal_id)!;
    const disposition = state.records.find((item) => item.proposal_id === proposal.proposal_id)!;
    const result = assessReadoptionHistoricalConsistency({
      tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
      course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
      current_adoption: adoptionReference(fixture.adoptionB),
      target_adoption: adoptionReference(fixture.adoptionA),
      proposal,
      review,
      disposition,
      adoption_state: state
    });

    expect(result.outcome_status).toBe("READOPTED_FOR_FUTURE_ADMISSION");
    expect(result.lineage.new_adoption_identity).toBe(true);
    expect(result.lineage.resulting_predecessor).toEqual(adoptionReference(fixture.adoptionB));
    expect(result.lineage.target_epoch).toEqual(fixture.adoptionA.epoch);
    expect(result.lineage.historical_records_preserved).toBe(true);
    expect(result.current_effect).toBe("CURRENT");
    expect(result.historical_receipt_rewritten).toBe(false);
    expect(result.rollback_applied).toBe(false);
  });

  it("marks a later D selection as superseding C without changing the historical outcome", async () => {
    const fixture = buildReadoptionFixture();
    const requestReceipt = await fixture.service.requestGovernedRollback(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "o8-a2-superseded",
        dry_run: await fixture.dryRun,
        reason: "A2 supersession fixture."
      }
    );
    await fixture.service.reviewEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
      command_id: "o8-a2-superseded-review",
      proposal_id: requestReceipt.proposal.proposal_id,
      proposal_digest: requestReceipt.proposal.proposal_digest,
      decision: "APPROVED",
      note: "A2 approved"
    });
    await fixture.service.disposeEvidenceAdoption(
      EVIDENCE_ADOPTION_ADMIN,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "o8-a2-superseded-dispose",
        proposal_id: requestReceipt.proposal.proposal_id,
        proposal_digest: requestReceipt.proposal.proposal_digest,
        disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
        expires_at: null,
        note: "A2 readoption C"
      }
    );
    const state = fixture.service.getEvidenceAdoptionState(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE
    );
    const proposal = state.proposals.find(
      (item) => item.proposal_id === requestReceipt.proposal.proposal_id
    )!;
    const review = state.reviews.find((item) => item.proposal_id === proposal.proposal_id)!;
    const disposition = state.records.find((item) => item.proposal_id === proposal.proposal_id)!;
    const laterState = {
      ...state,
      selections: [
        {
          adoption_id: "adoption-d",
          adoption_digest: "d".repeat(64),
          model_version_reference: fixture.adoptionB.epoch.model_version_reference,
          model_artifact_reference: fixture.adoptionB.epoch.model_artifact_reference
        }
      ]
    };
    const result = assessReadoptionHistoricalConsistency({
      tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
      course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
      current_adoption: adoptionReference(fixture.adoptionB),
      target_adoption: adoptionReference(fixture.adoptionA),
      proposal,
      review,
      disposition,
      adoption_state: laterState
    });

    expect(result.outcome_status).toBe("READOPTED_FOR_FUTURE_ADMISSION");
    expect(result.current_effect).toBe("SUPERSEDED");
    expect(result.historical_consistency).toBe("CONSISTENT");
    expect(result.lineage.historical_records_preserved).toBe(true);
  });

  it("fails closed when the proposal expected adoption is tampered", async () => {
    const fixture = buildReadoptionFixture();
    const requestReceipt = await fixture.service.requestGovernedRollback(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      { command_id: "o8-a2-tamper", dry_run: await fixture.dryRun, reason: "A2 tamper fixture." }
    );
    const state = fixture.service.getEvidenceAdoptionState(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE
    );
    const proposal = state.proposals.find(
      (item) => item.proposal_id === requestReceipt.proposal.proposal_id
    )!;
    const result = assessReadoptionHistoricalConsistency({
      tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
      course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
      current_adoption: adoptionReference(fixture.adoptionB),
      target_adoption: adoptionReference(fixture.adoptionA),
      proposal: { ...proposal, expected_adoption: adoptionReference(fixture.adoptionA) },
      review: null,
      disposition: null,
      adoption_state: state
    });

    expect(result.outcome_status).toBe("REBASE_REQUIRED");
    expect(result.historical_consistency).toBe("INCONSISTENT");
    expect(result.known_limits.join(" ")).toContain("exact linked proposal");
  });
});
