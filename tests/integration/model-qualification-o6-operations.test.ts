import { describe, expect, it } from "vitest";
import type {
  AdoptionDriftAssessment,
  AdoptionRollbackDryRun,
  CurrentUser,
  EvidenceAdoptionRecord,
  EvidenceAdoptionReference,
  ModelQualificationAdoptionOperationsStudentProjection,
  ModelQualificationAdoptionOperationsTeacherProjection
} from "@simwar/shared-contracts";
import {
  MODEL_QUALIFICATION_ADOPTION_OPERATIONS_POLICY_V1,
  digestAdoptionOperationsPolicy,
  digestEvidenceAdoptionState
} from "../../services/api/src/model-qualification-adoption-drift-assessment";
import {
  ModelQualificationService,
  type ModelQualificationActor,
  type ModelQualificationScope
} from "../../services/api/src/model-qualification-service";
import { serviceActor } from "../../services/api/src/routes/model-qualification-routes";
import {
  EVIDENCE_ADOPTION_ADMIN,
  EVIDENCE_ADOPTION_NOW,
  EVIDENCE_ADOPTION_SCOPE,
  EVIDENCE_ADOPTION_STUDENT,
  EVIDENCE_ADOPTION_TEACHER,
  ModelQualificationEvidenceAdoptionFakePersistence,
  adoptionReference,
  createEvidenceAdoptionServiceFixture,
  seedApprovedBoundChain
} from "../helpers/model-qualification-evidence-adoption-fixtures";

type O6Service = ModelQualificationService & {
  assessEvidenceAdoptionDrift(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: {
      course_id: string;
      expected_adoption: EvidenceAdoptionReference;
      expected_adoption_state_digest: string;
      expected_operations_policy_digest: string;
      assessed_at: string;
    }
  ): Promise<AdoptionDriftAssessment>;
  dryRunEvidenceAdoptionRollback(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    input: {
      course_id: string;
      current_adoption: EvidenceAdoptionReference;
      predecessor_adoption: EvidenceAdoptionReference;
      expected_adoption_state_digest: string;
      expected_operations_policy_digest: string;
      assessed_at: string;
    }
  ): Promise<AdoptionRollbackDryRun>;
  getAdoptionOperationsProjection(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope
  ): Promise<ModelQualificationAdoptionOperationsTeacherProjection>;
  getStudentAdoptionOperationsProjection(
    actor: ModelQualificationActor,
    scope: ModelQualificationScope,
    qualificationId: string
  ): Promise<ModelQualificationAdoptionOperationsStudentProjection>;
};

function adopt(
  service: ModelQualificationService,
  qualificationId: string,
  suffix: string,
  expected: EvidenceAdoptionReference | null
): EvidenceAdoptionRecord {
  const proposal = service.requestEvidenceAdoption(
    EVIDENCE_ADOPTION_TEACHER,
    EVIDENCE_ADOPTION_SCOPE,
    {
      command_id: `o6-${suffix}-request`,
      qualification_id: qualificationId,
      expected_adoption: expected
    }
  ).proposal;
  service.reviewEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
    command_id: `o6-${suffix}-review`,
    proposal_id: proposal.proposal_id,
    proposal_digest: proposal.proposal_digest,
    decision: "APPROVED",
    note: "O6 exact evidence operations fixture"
  });
  return service.disposeEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
    command_id: `o6-${suffix}-dispose`,
    proposal_id: proposal.proposal_id,
    proposal_digest: proposal.proposal_digest,
    disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
    expires_at: null,
    note: "Adopt exact epoch for future admission"
  }).adoption;
}

describe("O6 model qualification adoption operations integration", () => {
  it("binds a multi-role actor to the exact requested BFF role instead of role-array order", () => {
    const actor: CurrentUser = {
      user_id: "multi-role-user",
      tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
      display_name: "Multi Role",
      roles: ["learner", "teacher", "tenant_admin"]
    };

    expect(serviceActor(actor, "teacher").role).toBe("teacher");
    expect(serviceActor(actor, "admin").role).toBe("tenant_admin");
    expect(serviceActor(actor, "student").role).toBe("learner");
  });

  it("assesses the exact current adoption and previews only an eligible exact predecessor", async () => {
    const assessedAt = "2026-09-02T12:00:00.000Z";
    const persistence = new ModelQualificationEvidenceAdoptionFakePersistence();
    const service = new ModelQualificationService(
      { now: () => assessedAt },
      persistence
    ) as O6Service;
    const primary = seedApprovedBoundChain(
      service,
      EVIDENCE_ADOPTION_SCOPE,
      EVIDENCE_ADOPTION_TEACHER
    );
    const adoptedA = adopt(service, primary.qualificationA.qualification_id, "a", null);
    const adoptedB = adopt(
      service,
      primary.qualificationB.qualification_id,
      "b",
      adoptionReference(adoptedA)
    );
    const stateBefore = service.getEvidenceAdoptionState(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE
    );
    const serializedBefore = JSON.stringify(persistence.listRecords());
    const stateDigest = digestEvidenceAdoptionState(stateBefore);
    const policyDigest = digestAdoptionOperationsPolicy(
      MODEL_QUALIFICATION_ADOPTION_OPERATIONS_POLICY_V1
    );

    const assessment = await service.assessEvidenceAdoptionDrift(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
        expected_adoption: adoptionReference(adoptedB),
        expected_adoption_state_digest: stateDigest,
        expected_operations_policy_digest: policyDigest,
        assessed_at: assessedAt
      }
    );
    expect(assessment).toMatchObject({
      adoption: adoptionReference(adoptedB),
      adoption_state_digest: stateDigest,
      operations_policy_digest: policyDigest,
      status: "HEALTHY",
      future_admission_impact: "UNCHANGED",
      provider: "OFF",
      advisory_only: true,
      adoption_mutation: false,
      official_truth_write: false
    });

    const rollback = await service.dryRunEvidenceAdoptionRollback(
      EVIDENCE_ADOPTION_ADMIN,
      EVIDENCE_ADOPTION_SCOPE,
      {
        course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
        current_adoption: adoptionReference(adoptedB),
        predecessor_adoption: adoptionReference(adoptedA),
        expected_adoption_state_digest: stateDigest,
        expected_operations_policy_digest: policyDigest,
        assessed_at: assessedAt
      }
    );
    expect(rollback).toMatchObject({
      current_adoption: adoptionReference(adoptedB),
      predecessor_adoption: adoptionReference(adoptedA),
      adoption_state_digest: stateDigest,
      operations_policy_digest: policyDigest,
      status: "READY_WITH_LIMITS",
      predecessor_currently_eligible: true,
      future_admission_impact: "WOULD_SELECT_EXACT_PREDECESSOR",
      rollback_applied: false,
      adoption_mutation: false,
      official_truth_write: false,
      history_deleted: false,
      historical_receipt_rewritten: false
    });
    expect(JSON.stringify(persistence.listRecords())).toBe(serializedBefore);
  });

  it("fails closed on stale selectors, role/tenant violations, and concurrent adoption movement", async () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const service = fixture.service as O6Service;
    const adoptedA = adopt(service, fixture.primary.qualificationA.qualification_id, "a2", null);
    const state = service.getEvidenceAdoptionState(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE
    );
    const stateDigest = digestEvidenceAdoptionState(state);
    const policyDigest = digestAdoptionOperationsPolicy(
      MODEL_QUALIFICATION_ADOPTION_OPERATIONS_POLICY_V1
    );
    const staleStateDigest = "f".repeat(64);

    await expect(
      service.assessEvidenceAdoptionDrift(EVIDENCE_ADOPTION_TEACHER, EVIDENCE_ADOPTION_SCOPE, {
        course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
        expected_adoption: adoptionReference(adoptedA),
        expected_adoption_state_digest: staleStateDigest,
        expected_operations_policy_digest: policyDigest,
        assessed_at: EVIDENCE_ADOPTION_NOW
      })
    ).resolves.toMatchObject({ status: "REBASE_REQUIRED" });
    await expect(
      service.getAdoptionOperationsProjection(EVIDENCE_ADOPTION_STUDENT, EVIDENCE_ADOPTION_SCOPE)
    ).rejects.toThrow();
    await expect(
      service.getAdoptionOperationsProjection(
        { ...EVIDENCE_ADOPTION_TEACHER, tenant_id: "tenant_foreign" },
        EVIDENCE_ADOPTION_SCOPE
      )
    ).rejects.toThrow();

    let blockedMutation = false;
    await fixture.service.withEvidenceAdmission(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      async () => {
        try {
          fixture.service.requestEvidenceAdoption(
            EVIDENCE_ADOPTION_TEACHER,
            EVIDENCE_ADOPTION_SCOPE,
            {
              command_id: "o6-concurrent-adoption",
              qualification_id: fixture.primary.qualificationB.qualification_id,
              expected_adoption: adoptionReference(adoptedA)
            }
          );
        } catch (error) {
          blockedMutation = String(error).includes("IN_PROGRESS");
        }
      }
    );
    expect(blockedMutation).toBe(true);
    expect(
      digestEvidenceAdoptionState(
        service.getEvidenceAdoptionState(EVIDENCE_ADOPTION_TEACHER, EVIDENCE_ADOPTION_SCOPE)
      )
    ).toBe(stateDigest);

    const safe = await service.getStudentAdoptionOperationsProjection(
      EVIDENCE_ADOPTION_STUDENT,
      EVIDENCE_ADOPTION_SCOPE,
      fixture.primary.qualificationA.qualification_id
    );
    expect(safe).toMatchObject({
      operation_id: "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_STUDENT_GET_V1",
      visibility: "ROLE_SAFE_STUDENT",
      provider: "OFF",
      advisory_only: true,
      rollback_applied: false,
      official_truth_write: false
    });
    expect(safe).not.toHaveProperty("adoption_state_digest");
    expect(safe).not.toHaveProperty("operations_policy_digest");
    expect(safe).not.toHaveProperty("predecessor_adoption");
  });

  it("normalizes inconsistent persisted epoch identity for every O6 GET projection", async () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const adopted = adopt(
      fixture.service,
      fixture.primary.qualificationA.qualification_id,
      "projection-tamper",
      null
    );
    const current = fixture.service.getRecordForScope(EVIDENCE_ADOPTION_SCOPE);
    expect(current).not.toBeNull();
    const persistence = new ModelQualificationEvidenceAdoptionFakePersistence([
      {
        ...current!,
        qualifications: current!.qualifications.map((qualification) =>
          qualification.qualification_id === fixture.primary.qualificationA.qualification_id
            ? { ...qualification, source_package_id: "source-tampered" }
            : qualification
        )
      }
    ]);
    const service = new ModelQualificationService(
      { now: () => EVIDENCE_ADOPTION_NOW },
      persistence
    ) as O6Service;

    await expect(
      service.getAdoptionOperationsProjection(EVIDENCE_ADOPTION_TEACHER, EVIDENCE_ADOPTION_SCOPE)
    ).rejects.toMatchObject({
      code: "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_INVALID"
    });
    await expect(
      service.getStudentAdoptionOperationsProjection(
        EVIDENCE_ADOPTION_STUDENT,
        EVIDENCE_ADOPTION_SCOPE,
        fixture.primary.qualificationA.qualification_id
      )
    ).rejects.toMatchObject({
      code: "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_INVALID"
    });
    expect(adopted.adoption_id).toBeTruthy();
  });
});
