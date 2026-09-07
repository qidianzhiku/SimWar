import { describe, expect, it } from "vitest";
import {
  EVIDENCE_ADOPTION_SCOPE,
  EVIDENCE_ADOPTION_STUDENT,
  EVIDENCE_ADOPTION_TEACHER,
  createEvidenceAdoptionServiceFixture
} from "../helpers/model-qualification-evidence-adoption-fixtures";

const exactContext = {
  run_id: "run-im-o2",
  team_id: "team-im-o2",
  round_id: "round-im-o2",
  scenario_package_id: "scenario-im-o2",
  parameter_set_id: "parameter-im-o2"
};

describe("IM-O2 Industry Model Reality Join", () => {
  it("joins exact diagnostic readiness with bounded M4/M5/M29 support evidence", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const result = fixture.service.getIndustryModelRealityJoin(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        ...exactContext,
        qualification_id: fixture.primary.qualificationA.qualification_id
      }
    );
    expect(result.role).toBe("teacher");
    expect(result.readiness_status).toBe("BLOCKED");
    expect(result.support_evidence).toMatchObject({
      portability: {
        status: "PORTABILITY_EVIDENCE_WITH_LIMITS",
        external_validity: "NOT_PROVEN"
      },
      holdout: { status: "NOT_ELIGIBLE", eligibility: "NOT_ELIGIBLE" },
      shanghai: {
        consumption_status: "LOOKAHEAD_READY",
        qualification_status: "LIMITED",
        calibration_evidence: "NOT_PROVEN",
        formal_binding_eligible: false
      }
    });
    expect(result.known_limits).toContain("M4 portability compatibility is not external validity.");
    expect(result.known_limits).toContain("M5 holdout and qualification remain NOT_ELIGIBLE.");
    expect(result.official_truth_write).toBe(false);
    expect(result.provider).toBe("OFF");
  });

  it("returns a role-safe student projection without internal evidence identity", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const result = fixture.service.getIndustryModelRealityJoin(
      EVIDENCE_ADOPTION_STUDENT,
      EVIDENCE_ADOPTION_SCOPE,
      {
        ...exactContext,
        qualification_id: fixture.primary.qualificationA.qualification_id
      }
    );
    expect(result.role).toBe("student");
    expect(result.exact_context).toEqual({
      course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
      run_id: exactContext.run_id,
      team_id: exactContext.team_id,
      round_id: exactContext.round_id
    });
    expect(result.recovery).toBe("NONE");
    expect(result).not.toHaveProperty("support_evidence");
    expect(result).not.toHaveProperty("diagnostic_evidence_digest");
    expect(result).not.toHaveProperty("qualification");
  });

  it("fails closed to REBASE_REQUIRED when the exact join digest moves", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const result = fixture.service.getIndustryModelRealityJoin(
      EVIDENCE_ADOPTION_STUDENT,
      EVIDENCE_ADOPTION_SCOPE,
      {
        ...exactContext,
        qualification_id: fixture.primary.qualificationA.qualification_id,
        expected_reality_join_digest: "0".repeat(64)
      }
    );
    expect(result.readiness_status).toBe("REBASE_REQUIRED");
    expect(result.rebase_required).toBe(true);
    expect(result.recovery).toBe("RELOAD_EXACT_CONTEXT");
    expect(result.known_limits).toContain("REALITY_JOIN_IDENTITY_MOVED_REQUIRES_REBASE");
  });

  it("keeps the service actor boundary on the existing qualification authority", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const result = fixture.service.getIndustryModelRealityJoin(
      EVIDENCE_ADOPTION_STUDENT,
      EVIDENCE_ADOPTION_SCOPE,
      {
        ...exactContext,
        qualification_id: fixture.primary.qualificationA.qualification_id
      }
    );
    expect(result.role).toBe("student");
    expect(result.provider).toBe("OFF");
  });
});
