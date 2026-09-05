import { describe, expect, it } from "vitest";
import {
  buildPerCourseGovernedHandoffs,
  PerCourseGovernedHandoffError
} from "../../services/api/src/model-qualification-per-course-governed-handoff";

const REQUEST = {
  request_id: "o10-request-1",
  request_digest: "a".repeat(64),
  tenant_id: "tenant-demo",
  status: "READY" as const
};

function course(
  courseId: string,
  status:
    | "KEEP_CURRENT"
    | "REVIEW_EXISTING"
    | "REQUALIFY_CURRENT"
    | "REQUEST_GOVERNED_ROLLBACK"
    | "REBASE_REQUIRED"
    | "BLOCKED"
    | "NO_ACTIONABLE_ADOPTION"
) {
  return {
    course_id: courseId,
    current_adoption: { adoption_id: `adoption-${courseId}`, adoption_digest: "b".repeat(64) },
    current_course_state_digest: "c".repeat(64),
    selected_course_state_digest: "c".repeat(64),
    status,
    reasons: []
  } as const;
}

describe("O10 per-course governed handoff leaf", () => {
  it("maps existing readiness to exact existing course-scoped seams without mutation", () => {
    const first = buildPerCourseGovernedHandoffs(REQUEST, [
      course("course-a", "KEEP_CURRENT"),
      course("course-b", "REVIEW_EXISTING"),
      course("course-c", "REQUALIFY_CURRENT"),
      course("course-d", "REQUEST_GOVERNED_ROLLBACK")
    ]);
    const second = buildPerCourseGovernedHandoffs(REQUEST, [
      course("course-a", "KEEP_CURRENT"),
      course("course-b", "REVIEW_EXISTING"),
      course("course-c", "REQUALIFY_CURRENT"),
      course("course-d", "REQUEST_GOVERNED_ROLLBACK")
    ]);
    expect(first).toEqual(second);
    expect(first.map((item) => item.existing_governance_seam?.operation_id)).toEqual([
      "MODEL_QUALIFICATION_ADMIN_AUDIT_GET_V1",
      "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_ADMIN_GET_V1",
      "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_ADMIN_GET_V1",
      "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_ADMIN_ROLLBACK_DRY_RUN_V1"
    ]);
    expect(first.every((item) => item.handoff_executed === false)).toBe(true);
    expect(first.every((item) => item.apply === false)).toBe(true);
    expect(first.every((item) => item.bulk_apply === false)).toBe(true);
    expect(first.every((item) => item.existing_governance_seam?.mutates === false)).toBe(true);
  });

  it("converts a stale or blocked request into an explicit non-action state", () => {
    const stale = buildPerCourseGovernedHandoffs({ ...REQUEST, status: "REBASE_REQUIRED" }, [
      course("course-a", "KEEP_CURRENT")
    ])[0]!;
    expect(stale.status).toBe("REBASE_REQUIRED");
    expect(stale.existing_governance_seam).toBeNull();

    const blocked = buildPerCourseGovernedHandoffs({ ...REQUEST, status: "BLOCKED" }, [
      course("course-a", "REVIEW_EXISTING")
    ])[0]!;
    expect(blocked.status).toBe("BLOCKED");
    expect(blocked.existing_governance_seam).toBeNull();

    const noAction = buildPerCourseGovernedHandoffs(REQUEST, [
      course("course-a", "NO_ACTIONABLE_ADOPTION")
    ])[0]!;
    expect(noAction.status).toBe("NO_ACTION");
    expect(noAction.existing_governance_seam).toBeNull();
  });

  it("fails closed for duplicate courses or stale course identity", () => {
    expect(() =>
      buildPerCourseGovernedHandoffs(REQUEST, [
        course("course-a", "KEEP_CURRENT"),
        course("course-a", "KEEP_CURRENT")
      ])
    ).toThrowError(PerCourseGovernedHandoffError);
    expect(() =>
      buildPerCourseGovernedHandoffs(REQUEST, [
        { ...course("course-a", "KEEP_CURRENT"), selected_course_state_digest: "d".repeat(64) }
      ])
    ).toThrowError(PerCourseGovernedHandoffError);
  });
});
