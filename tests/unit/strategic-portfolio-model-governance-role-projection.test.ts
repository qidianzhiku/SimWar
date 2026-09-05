import { describe, expect, it } from "vitest";
import {
  projectStrategicPortfolioModelGovernanceReadiness,
  type StrategicPortfolioModelGovernanceRoleProjectionInput
} from "../../services/api/src/strategic-portfolio-model-governance-role-projection";

const input: StrategicPortfolioModelGovernanceRoleProjectionInput = {
  tenant_id: "tenant_demo",
  readiness_policy_digest: "a".repeat(64),
  portfolio_state_digest: "b".repeat(64),
  readiness_digest: "c".repeat(64),
  readiness_status: "READY",
  known_limits: ["Provider is OFF"],
  entries: [
    {
      course: { course_id: "course_demo", tenant_id: "tenant_demo", title: "Demo" },
      exact_scope: {
        tenant_id: "tenant_demo",
        course_id: "course_demo",
        run_id: "run_demo",
        team_id: "team_demo",
        round_no: 1
      },
      portfolio_id: "w4_portfolio_demo",
      portfolio_digest: "d".repeat(64),
      model_qualification_portfolio_state_digest: "e".repeat(64),
      adoption_state_digest: "f".repeat(64),
      current_adoption: { adoption_id: "adoption_demo", adoption_digest: "1".repeat(64) },
      qualification: { qualification_id: "qualification_demo", content_digest: "2".repeat(64) },
      blockers: [],
      known_limits: [],
      readiness: "READY",
      readiness_digest: "3".repeat(64)
    }
  ]
};

describe("SP-O2 role-safe readiness projection", () => {
  it("keeps exact governance evidence for teacher and admin", () => {
    const result = projectStrategicPortfolioModelGovernanceReadiness(input, "admin");
    expect(result.visibility).toBe("TENANT_GOVERNANCE_DETAIL");
    expect(result.entries[0]?.current_adoption?.adoption_id).toBe("adoption_demo");
    expect(result.entries[0]?.qualification?.qualification_id).toBe("qualification_demo");
    expect(result.derived).toBe(true);
    expect(result.query_only).toBe(true);
    expect(result.writer_effect).toBe("NONE");
  });

  it("strips tenant portfolio and governance identities from the student projection", () => {
    const result = projectStrategicPortfolioModelGovernanceReadiness(input, "student");
    const serialized = JSON.stringify(result);
    expect(result.visibility).toBe("ROLE_SAFE_STUDENT");
    expect(serialized).not.toContain("adoption_demo");
    expect(serialized).not.toContain("qualification_demo");
    expect(serialized).not.toContain("tenant_demo");
    expect(serialized).toContain("course_demo");
    expect(result.entries[0]).toMatchObject({ applicability: "READY", advisory_only: true, provider: "OFF" });
  });

  it("maps review and rebase states to safe applicability without changing readiness", () => {
    const result = projectStrategicPortfolioModelGovernanceReadiness(
      {
        ...input,
        readiness_status: "BLOCKED",
        entries: [
          { ...input.entries[0]!, readiness: "REVIEW_REQUIRED" },
          { ...input.entries[0]!, exact_scope: { ...input.entries[0]!.exact_scope, run_id: "run_2" }, readiness: "REBASE_REQUIRED" }
        ]
      },
      "student"
    );
    expect(result.entries.map((entry) => entry.applicability)).toEqual(["LIMITED", "UNAVAILABLE"]);
    expect(result.entries.map((entry) => entry.readiness)).toEqual(["REVIEW_REQUIRED", "REBASE_REQUIRED"]);
  });

  it("does not expose a state-changing operation or create a new authority", () => {
    const result = projectStrategicPortfolioModelGovernanceReadiness(input, "teacher");
    expect(result).toMatchObject({
      no_new_writer: true,
      no_new_store: true,
      no_new_registry: true,
      provider: "OFF",
      query_only: true
    });
    expect(Object.keys(result)).not.toContain("apply");
    expect(Object.keys(result)).not.toContain("write");
  });
});
