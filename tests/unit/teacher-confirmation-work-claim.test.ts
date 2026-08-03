import { describe, expect, it } from "vitest";
import { TeacherConfirmationWorkClaimService } from "../../services/api/src/teacher-confirmation-work-claim.js";

describe("D3 exclusive work claim", () => {
  it("allows one teacher to reuse a claim but rejects another teacher", () => {
    const service = new TeacherConfirmationWorkClaimService();
    const input = { tenant_id: "tenant_demo", context: { course_id: "course_1", run_id: "run_1", team_id: "team_1", role_key: "marketing" }, evidence_set_digest: "a".repeat(64), claimed_by: "usr_teacher", now: "2026-08-03T00:00:00.000Z" };
    const first = service.claim(input);
    expect(service.claim(input).claim_id).toBe(first.claim_id);
    expect(() => service.claim({ ...input, claimed_by: "usr_other_teacher" })).toThrow("D3_WORK_CLAIM_CONFLICT");
    expect(service.release(first.claim_id, "usr_teacher").status).toBe("RELEASED");
  });
});
