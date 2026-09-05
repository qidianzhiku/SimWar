import { describe, expect, it } from "vitest";
import {
  EVIDENCE_ADOPTION_ADMIN,
  EVIDENCE_ADOPTION_SCOPE,
  EVIDENCE_ADOPTION_STUDENT,
  EVIDENCE_ADOPTION_TEACHER,
  ModelQualificationEvidenceAdoptionFakePersistence,
  adoptionReference,
  seedApprovedBoundChain
} from "../helpers/model-qualification-evidence-adoption-fixtures";
import { ModelQualificationService } from "../../services/api/src/model-qualification-service";
import { stableSha256 } from "../../services/api/src/model-qualification-adoption-drift-assessment";
import {
  digestAdoptionOperationsPolicy,
  digestEvidenceAdoptionState
} from "../../services/api/src/model-qualification-adoption-drift-assessment";

function createFixture() {
  const service = new ModelQualificationService(
    { now: () => "2026-09-02T12:00:00.000Z" },
    new ModelQualificationEvidenceAdoptionFakePersistence()
  );
  const chain = seedApprovedBoundChain(service, EVIDENCE_ADOPTION_SCOPE, EVIDENCE_ADOPTION_TEACHER);
  const adopt = (
    qualificationId: string,
    suffix: string,
    expected: ReturnType<typeof adoptionReference> | null
  ) => {
    const proposal = service.requestEvidenceAdoption(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: `o8-integration-${suffix}-request`,
        qualification_id: qualificationId,
        expected_adoption: expected
      }
    ).proposal;
    service.reviewEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
      command_id: `o8-integration-${suffix}-review`,
      proposal_id: proposal.proposal_id,
      proposal_digest: proposal.proposal_digest,
      decision: "APPROVED",
      note: "O8 integration fixture review"
    });
    return service.disposeEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
      command_id: `o8-integration-${suffix}-dispose`,
      proposal_id: proposal.proposal_id,
      proposal_digest: proposal.proposal_digest,
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: "O8 integration fixture adoption"
    }).adoption;
  };
  const adoptionA = adopt(chain.qualificationA.qualification_id, "a", null);
  const adoptionB = adopt(chain.qualificationB.qualification_id, "b", adoptionReference(adoptionA));
  return { adoptionA, adoptionB, chain, service };
}

async function createRollbackRequest(fixture: ReturnType<typeof createFixture>) {
  const state = fixture.service.getEvidenceAdoptionState(
    EVIDENCE_ADOPTION_TEACHER,
    EVIDENCE_ADOPTION_SCOPE
  );
  const dryRun = await fixture.service.dryRunEvidenceAdoptionRollback(
    EVIDENCE_ADOPTION_ADMIN,
    EVIDENCE_ADOPTION_SCOPE,
    {
      course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
      current_adoption: adoptionReference(fixture.adoptionB),
      predecessor_adoption: adoptionReference(fixture.adoptionA),
      expected_adoption_state_digest: digestEvidenceAdoptionState(state),
      expected_operations_policy_digest: digestAdoptionOperationsPolicy(),
      assessed_at: "2026-09-02T12:00:00.000Z"
    }
  );
  return fixture.service.requestGovernedRollback(
    EVIDENCE_ADOPTION_TEACHER,
    EVIDENCE_ADOPTION_SCOPE,
    { command_id: "o8-integration-rollback-request", dry_run: dryRun, reason: "O8 exact outcome." }
  );
}

async function readoptRollbackRequest(
  fixture: ReturnType<typeof createFixture>,
  existingRequest?: Awaited<ReturnType<typeof createRollbackRequest>>
) {
  const request = existingRequest ?? (await createRollbackRequest(fixture));
  await fixture.service.reviewEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
    command_id: "o8-integration-rollback-review",
    proposal_id: request.proposal.proposal_id,
    proposal_digest: request.proposal.proposal_digest,
    decision: "APPROVED",
    note: "O8 explicit review"
  });
  await fixture.service.disposeEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
    command_id: "o8-integration-rollback-disposition",
    proposal_id: request.proposal.proposal_id,
    proposal_digest: request.proposal.proposal_digest,
    disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
    expires_at: null,
    note: "O8 explicit readoption"
  });
  return request;
}

describe("O8 rollback outcome service integration", () => {
  it("resolves the immutable request through pending and readopted outcomes", async () => {
    const fixture = createFixture();
    const request = await createRollbackRequest(fixture);
    const pending = await fixture.service.getRollbackRequestOutcome(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      request.request.rollback_request_id
    );
    expect(pending).toMatchObject({
      schema_version: "model-qualification-rollback-outcome.v1",
      outcome_status: "PENDING_REVIEW",
      immutable_request_status: "LINKED_PROPOSAL_PENDING_REVIEW",
      visibility: "TEACHER_ADMIN_DETAIL",
      rollback_applied: false,
      adoption_mutation: false,
      official_truth_write: false
    });

    await readoptRollbackRequest(fixture, request);

    const resolved = await fixture.service.getRollbackRequestOutcome(
      EVIDENCE_ADOPTION_ADMIN,
      EVIDENCE_ADOPTION_SCOPE,
      request.request.rollback_request_id
    );
    expect(resolved.outcome_status).toBe("READOPTED_FOR_FUTURE_ADMISSION");
    expect(resolved.current_effect).toBe("CURRENT");
    expect(resolved.disposition?.predecessor).toEqual(adoptionReference(fixture.adoptionB));
    expect(resolved.disposition?.epoch).toEqual(fixture.adoptionA.epoch);
    expect(resolved.request.status).toBe("LINKED_PROPOSAL_PENDING_REVIEW");

    const { resolution_digest: digest, ...digestBody } = resolved;
    expect(digest).toBe(stableSha256(digestBody));
  });

  it("reports live qualification degradation instead of stale consistent status", async () => {
    const fixture = createFixture();
    const request = await readoptRollbackRequest(fixture);
    const record = fixture.service.getRecordForScope(EVIDENCE_ADOPTION_SCOPE)!;
    const staleRecord = {
      ...record,
      qualifications: record.qualifications.map((qualification) =>
        qualification.qualification_id === fixture.chain.qualificationA.qualification_id
          ? { ...qualification, decision: "DRAFT" as const }
          : qualification
      )
    };
    const staleService = new ModelQualificationService(
      { now: () => "2026-09-02T12:00:00.000Z" },
      new ModelQualificationEvidenceAdoptionFakePersistence([staleRecord])
    );

    const resolved = await staleService.getRollbackRequestOutcome(
      EVIDENCE_ADOPTION_ADMIN,
      EVIDENCE_ADOPTION_SCOPE,
      request.request.rollback_request_id
    );
    expect(resolved.outcome_status).toBe("READOPTED_FOR_FUTURE_ADMISSION");
    expect(resolved.qualification_consistency).toBe("BLOCKED");
  });

  it("returns only aggregate-safe outcome fields to Student", async () => {
    const fixture = createFixture();
    await createRollbackRequest(fixture);
    const summaries = await fixture.service.getStudentRollbackOutcomeSummaries(
      EVIDENCE_ADOPTION_STUDENT,
      EVIDENCE_ADOPTION_SCOPE
    );
    expect(summaries).toHaveLength(1);
    const summary = summaries[0]!;
    expect(summary).toMatchObject({
      schema_version: "model-qualification-rollback-outcome.v1",
      operation_id: "MODEL_QUALIFICATION_ROLLBACK_OUTCOME_STUDENT_GET_V1",
      applicability: "CURRENT",
      historical_consistency: "CONSISTENT",
      visibility: "ROLE_SAFE_STUDENT",
      provider: "OFF",
      advisory_only: true,
      rollback_applied: false,
      official_truth_write: false
    });
    expect(summary).not.toHaveProperty("rollback_request_id");
    expect(summary).not.toHaveProperty("proposal_id");
    expect(summary).not.toHaveProperty("adoption_id");
    expect(JSON.stringify(summary)).not.toContain("O8 exact outcome");
  });
});
