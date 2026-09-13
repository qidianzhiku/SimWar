import { describe, expect, it } from "vitest";
import type {
  DdtAdminEvidenceSpineResponse,
  DdtStudentEvidenceSpineResponse,
  DdtTeacherEvidenceSpineResponse
} from "@simwar/shared-contracts";
import { DECISION_THREAD_EVIDENCE_SPINE_SCHEMA_VERSION } from "@simwar/shared-contracts";

const exactContext = {
  tenant_id: "tenant-001",
  course_id: "course-001",
  run_id: "run-001",
  team_id: "team-001",
  round_id: "round-002",
  round_no: 2,
  role_key: "CEO",
  activity_id: "activity-ddt"
} as const;

describe("Decision Thread Evidence Spine contract", () => {
  it("freezes the exact-context and read-only policy envelope", () => {
    const response: DdtTeacherEvidenceSpineResponse = {
      schema_version: DECISION_THREAD_EVIDENCE_SPINE_SCHEMA_VERSION,
      surface: "teacher",
      exact_context: exactContext,
      sources: [],
      known_limits: ["derived evidence only"],
      provider: "OFF",
      non_causal: true,
      causal_proof: false,
      official_truth_write: false,
      formal_write_count: 0
    };

    expect(response.exact_context).toEqual(exactContext);
    expect(response.provider).toBe("OFF");
    expect(response.non_causal).toBe(true);
    expect(response.causal_proof).toBe(false);
    expect(response.official_truth_write).toBe(false);
    expect(response.formal_write_count).toBe(0);
  });

  it("requires explicit role-specific response types", () => {
    const student: DdtStudentEvidenceSpineResponse = {
      schema_version: DECISION_THREAD_EVIDENCE_SPINE_SCHEMA_VERSION,
      surface: "student",
      exact_context: {
        course_id: exactContext.course_id,
        run_id: exactContext.run_id,
        team_id: exactContext.team_id,
        round_id: exactContext.round_id,
        round_no: exactContext.round_no,
        role_key: "student"
      },
      sources: [],
      known_limits: [],
      provider: "OFF",
      non_causal: true,
      causal_proof: false,
      official_truth_write: false,
      formal_write_count: 0
    };
    const admin: DdtAdminEvidenceSpineResponse = {
      schema_version: DECISION_THREAD_EVIDENCE_SPINE_SCHEMA_VERSION,
      surface: "admin",
      exact_context: exactContext,
      sources: [],
      known_limits: [],
      provider: "OFF",
      non_causal: true,
      causal_proof: false,
      official_truth_write: false,
      formal_write_count: 0
    };

    expect("tenant_id" in student.exact_context).toBe(false);
    expect(admin.exact_context.tenant_id).toBe("tenant-001");
  });
});
