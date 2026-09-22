import { describe, expect, it } from "vitest";
import { isDecisionThreadEvidenceSpineRoute } from "../../services/api/src/routes/decision-thread-evidence-spine-routes.js";

describe("Decision Thread Evidence Spine route", () => {
  it("accepts only the three existing role BFF surfaces", () => {
    expect(
      isDecisionThreadEvidenceSpineRoute(
        "GET",
        new URL("http://localhost/api/v1/bff/teacher/decision-thread/evidence-spine")
      )
    ).toBe(true);
    expect(
      isDecisionThreadEvidenceSpineRoute(
        "GET",
        new URL("http://localhost/api/v1/bff/student/decision-thread/evidence-spine")
      )
    ).toBe(true);
    expect(
      isDecisionThreadEvidenceSpineRoute(
        "GET",
        new URL("http://localhost/api/v1/bff/admin/decision-thread/evidence-spine")
      )
    ).toBe(true);
    expect(
      isDecisionThreadEvidenceSpineRoute(
        "POST",
        new URL("http://localhost/api/v1/bff/admin/decision-thread/evidence-spine")
      )
    ).toBe(false);
  });
});
