import { describe, expect, it } from "vitest";
import { TeacherConfirmationWorkClaimService } from "../../services/api/src/teacher-confirmation-work-claim.js";

describe("D3 exclusive work claim", () => {
  it("allows one teacher to reuse a claim but rejects another teacher", () => {
    const service = new TeacherConfirmationWorkClaimService();
    const input = {
      tenant_id: "tenant_demo",
      context: { course_id: "course_1", run_id: "run_1", team_id: "team_1", role_key: "marketing" },
      evidence_set_digest: "a".repeat(64),
      claimed_by: "usr_teacher",
      now: "2026-08-03T00:00:00.000Z"
    };
    const first = service.claim(input);
    expect(service.claim(input).claim_id).toBe(first.claim_id);
    expect(() => service.claim({ ...input, claimed_by: "usr_other_teacher" })).toThrow(
      "D3_WORK_CLAIM_CONFLICT"
    );
    expect(service.release(first.claim_id, "usr_teacher").status).toBe("RELEASED");
  });

  it("fails closed for expired or mismatched write claims", () => {
    const service = new TeacherConfirmationWorkClaimService();
    const input = {
      tenant_id: "tenant_demo",
      context: { course_id: "course_1", run_id: "run_1", team_id: "team_1", role_key: "marketing" },
      evidence_set_digest: "a".repeat(64),
      claimed_by: "usr_teacher",
      now: "2026-08-03T00:00:00.000Z",
      ttl_seconds: 1
    };
    const claim = service.claim(input);
    expect(() =>
      service.assertActive({
        claim_id: claim.claim_id,
        actor_id: "usr_teacher",
        tenant_id: "tenant_demo",
        context: input.context,
        evidence_set_digest: input.evidence_set_digest,
        now: "2026-08-03T00:00:02.000Z"
      })
    ).toThrow("D3_WORK_CLAIM_EXPIRED");
    expect(service.get(claim.claim_id, "usr_teacher", "2026-08-03T00:00:02.000Z").status).toBe(
      "EXPIRED"
    );
  });

  it("normalizes context identity and rejects invalid ttl or context values", () => {
    const service = new TeacherConfirmationWorkClaimService();
    const input = {
      tenant_id: "tenant_demo",
      context: { course_id: "c", run_id: "r", team_id: "t", role_key: "role" },
      evidence_set_digest: "a".repeat(64),
      claimed_by: "usr_teacher",
      now: "2026-08-03T00:00:00.000Z"
    };
    expect(() => service.claim({ ...input, ttl_seconds: 0 })).toThrow("D3_INPUT_INVALID");
    expect(() =>
      service.claim({
        ...input,
        context: { course_id: "c", run_id: "r", team_id: "t", role_key: "" }
      })
    ).toThrow("D3_INPUT_INVALID");
    expect(() =>
      service.claim({
        ...input,
        context: { course_id: "latest", run_id: "r", team_id: "t", role_key: "role" }
      })
    ).toThrow("D3_INPUT_INVALID");

    const first = service.claim(input);
    const reorderedContext = Object.fromEntries([
      ["role_key", "role"],
      ["team_id", "t"],
      ["run_id", "r"],
      ["course_id", "c"]
    ]);
    const second = service.claim({ ...input, context: reorderedContext });
    expect(second.claim_id).toBe(first.claim_id);
  });
});
