import { describe, expect, it } from "vitest";
import type { Course } from "@simwar/shared-contracts";
import {
  buildModelQualificationCoursePortfolio,
  type ModelQualificationCoursePortfolioInput
} from "../../services/api/src/model-qualification-course-portfolio";
import {
  EVIDENCE_ADOPTION_ADMIN,
  EVIDENCE_ADOPTION_OTHER_SCOPE,
  EVIDENCE_ADOPTION_OTHER_TEACHER,
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

const NOW = "2026-09-02T12:00:00.000Z";

function course(courseId: string, tenantId: string, title: string): Course {
  return {
    course_id: courseId,
    created_by: "teacher_demo",
    parameter_set_id: "parameter_demo",
    scenario_package_id: "scenario_demo",
    status: "published",
    tenant_id: tenantId,
    title
  };
}

function adoptedPrimaryFixture() {
  const persistence = new ModelQualificationEvidenceAdoptionFakePersistence();
  const service = new ModelQualificationService({ now: () => NOW }, persistence);
  const primary = seedApprovedBoundChain(
    service,
    EVIDENCE_ADOPTION_SCOPE,
    EVIDENCE_ADOPTION_TEACHER
  );
  const proposal = service.requestEvidenceAdoption(
    EVIDENCE_ADOPTION_TEACHER,
    EVIDENCE_ADOPTION_SCOPE,
    {
      command_id: "o9-course-portfolio-request",
      qualification_id: primary.qualificationA.qualification_id,
      expected_adoption: null
    }
  ).proposal;
  const review = service.reviewEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
    command_id: "o9-course-portfolio-review",
    decision: "APPROVED",
    note: "O9 course portfolio fixture",
    proposal_digest: proposal.proposal_digest,
    proposal_id: proposal.proposal_id
  }).review;
  const adoption = service.disposeEvidenceAdoption(
    EVIDENCE_ADOPTION_ADMIN,
    EVIDENCE_ADOPTION_SCOPE,
    {
      command_id: "o9-course-portfolio-dispose",
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: "O9 course portfolio fixture",
      proposal_digest: proposal.proposal_digest,
      proposal_id: proposal.proposal_id
    }
  ).adoption;
  const record = service.getRecordForScope(EVIDENCE_ADOPTION_SCOPE);
  if (!record?.evidence_adoption) throw new Error("adoption fixture missing state");
  return { adoption, primary, record, review, service };
}

function input(
  overrides: Partial<ModelQualificationCoursePortfolioInput>
): ModelQualificationCoursePortfolioInput {
  return {
    authorized_courses: [],
    governance_records: [],
    tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
    ...overrides
  };
}

describe("O9 model qualification course portfolio query leaf", () => {
  it("projects only canonical tenant courses and binds exact qualification/adoption identity", () => {
    const fixture = adoptedPrimaryFixture();
    const secondary = seedApprovedBoundChain(
      fixture.service,
      EVIDENCE_ADOPTION_OTHER_SCOPE,
      EVIDENCE_ADOPTION_OTHER_TEACHER
    );
    const foreign = seedApprovedBoundChain(
      fixture.service,
      { ...EVIDENCE_ADOPTION_SCOPE, tenant_id: "tenant_foreign" },
      { ...EVIDENCE_ADOPTION_TEACHER, tenant_id: "tenant_foreign" }
    );

    const result = buildModelQualificationCoursePortfolio(
      input({
        authorized_courses: [course("course_demo", "tenant_demo", "Canonical course")],
        governance_records: [fixture.record, secondary.record, foreign.record]
      })
    );

    expect(result.courses).toHaveLength(1);
    expect(result.courses[0]?.course).toEqual({
      course_id: "course_demo",
      tenant_id: "tenant_demo",
      title: "Canonical course"
    });
    expect(result.courses[0]?.qualification?.qualification_id).toBe(
      fixture.primary.qualificationA.qualification_id
    );
    expect(result.courses[0]?.qualification?.content_digest).toBe(
      fixture.primary.qualificationA.content_digest
    );
    expect(result.courses[0]?.current_adoption).toEqual(adoptionReference(fixture.adoption));
    expect(result.courses[0]?.adoption_state_digest).toBe(
      digestEvidenceAdoptionState(fixture.record.evidence_adoption)
    );
    expect(result.courses[0]?.qualification_consistency).toBe("CONSISTENT");
    expect(result.courses[0]?.blockers).toEqual([]);
    expect(result.blockers.map((blocker) => blocker.code)).toEqual(
      expect.arrayContaining(["ORPHAN_GOVERNANCE_RECORD", "SCOPE_MISMATCH"])
    );
    expect(result.courses.map((entry) => entry.course.course_id)).not.toContain("course_other");
    expect(result.provider).toBe("OFF");
    expect(result.derived).toBe(true);
    expect(result.query_only).toBe(true);
    expect(result.no_new_writer).toBe(true);
    expect(result.no_new_store).toBe(true);
    expect(result.no_new_registry).toBe(true);
    expect(result.official_truth_write).toBe(false);
    expect(result.writes_formal_truth).toBe(false);
    expect(result.portfolio_state_digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("blocks duplicate governance records instead of selecting one", () => {
    const fixture = adoptedPrimaryFixture();
    const result = buildModelQualificationCoursePortfolio(
      input({
        authorized_courses: [course("course_demo", "tenant_demo", "Canonical course")],
        governance_records: [fixture.record, structuredClone(fixture.record)]
      })
    );

    expect(result.portfolio_status).toBe("BLOCKED");
    expect(result.courses[0]?.qualification).toBeNull();
    expect(result.courses[0]?.current_adoption).toBeNull();
    expect(result.courses[0]?.blockers.map((blocker) => blocker.code)).toContain(
      "AMBIGUOUS_GOVERNANCE_RECORD"
    );
  });

  it("does not choose first, last, latest, or timestamp-newest qualification when no exact adoption binds one", () => {
    const fixture = adoptedPrimaryFixture();
    const withoutAdoption = structuredClone(fixture.record);
    delete withoutAdoption.evidence_adoption;
    const reversed = {
      ...withoutAdoption,
      qualifications: [...withoutAdoption.qualifications].reverse()
    };
    const canonicalCourse = course("course_demo", "tenant_demo", "Canonical course");

    const first = buildModelQualificationCoursePortfolio(
      input({ authorized_courses: [canonicalCourse], governance_records: [withoutAdoption] })
    );
    const second = buildModelQualificationCoursePortfolio(
      input({ authorized_courses: [canonicalCourse], governance_records: [reversed] })
    );

    expect(first.courses[0]?.qualification).toBeNull();
    expect(first.courses[0]?.qualification_candidates).toHaveLength(2);
    expect(first.courses[0]?.blockers.map((blocker) => blocker.code)).toContain(
      "AMBIGUOUS_QUALIFICATION"
    );
    expect(first.portfolio_state_digest).toBe(second.portfolio_state_digest);
  });

  it("returns a blocking result for malformed embedded qualification data", () => {
    const fixture = adoptedPrimaryFixture();
    const malformed = {
      ...structuredClone(fixture.record),
      qualifications: [null]
    } as never;

    expect(() =>
      buildModelQualificationCoursePortfolio(
        input({
          authorized_courses: [course("course_demo", "tenant_demo", "Canonical course")],
          governance_records: [malformed]
        })
      )
    ).not.toThrow();
    const result = buildModelQualificationCoursePortfolio(
      input({
        authorized_courses: [course("course_demo", "tenant_demo", "Canonical course")],
        governance_records: [malformed]
      })
    );
    expect(result.portfolio_status).toBe("BLOCKED");
    expect(result.courses[0]?.blockers.map((blocker) => blocker.code)).toContain(
      "GOVERNANCE_RECORD_MALFORMED"
    );
  });

  it("derives an exact O8 outcome/current-effect summary from the supplied governance record", async () => {
    const fixture = adoptedPrimaryFixture();
    const proposal = fixture.service.requestEvidenceAdoption(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "o9-course-portfolio-o8-request",
        qualification_id: fixture.primary.qualificationB.qualification_id,
        expected_adoption: adoptionReference(fixture.adoption)
      }
    ).proposal;
    fixture.service.reviewEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
      command_id: "o9-course-portfolio-o8-review",
      decision: "APPROVED",
      note: "O9 course portfolio O8 fixture",
      proposal_digest: proposal.proposal_digest,
      proposal_id: proposal.proposal_id
    });
    const adoptionB = fixture.service.disposeEvidenceAdoption(
      EVIDENCE_ADOPTION_ADMIN,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "o9-course-portfolio-o8-dispose",
        disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
        expires_at: null,
        note: "O9 course portfolio O8 fixture",
        proposal_digest: proposal.proposal_digest,
        proposal_id: proposal.proposal_id
      }
    ).adoption;
    const state = fixture.service.getEvidenceAdoptionState(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE
    );
    const dryRun = await fixture.service.dryRunEvidenceAdoptionRollback(
      EVIDENCE_ADOPTION_ADMIN,
      EVIDENCE_ADOPTION_SCOPE,
      {
        assessed_at: NOW,
        course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
        current_adoption: adoptionReference(adoptionB),
        expected_adoption_state_digest: digestEvidenceAdoptionState(state),
        expected_operations_policy_digest: digestAdoptionOperationsPolicy(),
        predecessor_adoption: adoptionReference(fixture.adoption)
      }
    );
    await fixture.service.requestGovernedRollback(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        command_id: "o9-course-portfolio-o8-rollback",
        dry_run: dryRun,
        reason: "O9 course portfolio O8 fixture"
      }
    );
    const record = fixture.service.getRecordForScope(EVIDENCE_ADOPTION_SCOPE);
    if (!record) throw new Error("O8 record fixture missing");
    const request = record.governed_rollback_requests?.[0];
    if (!request) throw new Error("O8 request fixture missing");
    const outcome = await fixture.service.getRollbackRequestOutcome(
      EVIDENCE_ADOPTION_ADMIN,
      EVIDENCE_ADOPTION_SCOPE,
      request.rollback_request_id
    );

    const result = buildModelQualificationCoursePortfolio(
      input({
        authorized_courses: [course("course_demo", "tenant_demo", "Canonical course")],
        governance_records: [record]
      })
    );

    expect(result.courses[0]?.o8_outcomes).toEqual([
      expect.objectContaining({
        current_effect: outcome.current_effect,
        historical_consistency: outcome.historical_consistency,
        outcome_status: outcome.outcome_status,
        qualification_consistency: outcome.qualification_consistency,
        resolution_digest: outcome.resolution_digest,
        resolution_id: outcome.resolution_id,
        resulting_adoption: outcome.resulting_adoption,
        rollback_request_digest: outcome.rollback_request_digest,
        rollback_request_id: outcome.rollback_request_id
      })
    ]);
  });
});
