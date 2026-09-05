import { describe, expect, it } from "vitest";
import type { W4StrategicPortfolioProjection } from "@simwar/shared-contracts";
import { ModelQualificationService } from "../../services/api/src/model-qualification-service";

const TENANT = "tenant-service";
const COURSE = "course-service";

function strategicPortfolio(): W4StrategicPortfolioProjection {
  return {
    schema_version: "w4-strategic-portfolio.v1",
    candidate_status: "DERIVED",
    portfolio_id: "w4-portfolio-service",
    portfolio_ref: {
      tenant_id: TENANT,
      course_id: COURSE,
      run_id: "run-service",
      team_id: "team-service",
      round_no: 1,
      portfolio_digest: "a".repeat(64)
    },
    exact_scope: {
      tenant_id: TENANT,
      course_id: COURSE,
      run_id: "run-service",
      team_id: "team-service",
      round_no: 1
    },
    members: [],
    allocations: [],
    constraints: {
      status: "WITHIN_LIMIT",
      cash_available: 100,
      covenant_min_cash: 0,
      total_project_cost: 0,
      allocated_capital_principal: 0,
      unfunded_project_cost: 0,
      dependency_project_entry_ids: []
    },
    persistence: {
      official_state_authority: "W4_ENTERPRISE_STATE_SERVICE",
      opening_state_ref: null,
      closing_state_ref: null,
      next_opening_state_ref: null,
      historical_decision_reentry: false
    },
    writer_authority: "SOLE_W4_ENTERPRISE_STATE_SERVICE",
    known_limits: []
  };
}

describe("SP-O2 ModelQualificationService integration", () => {
  it("returns the admin role projection from the canonical course and supplied W4 authorities", () => {
    const service = new ModelQualificationService();
    const result = service.getStrategicPortfolioModelGovernanceReadiness(
      { actor_id: "admin-service", role: "tenant_admin", tenant_id: TENANT },
      [{ course_id: COURSE, tenant_id: TENANT, title: "Service course" }],
      [strategicPortfolio()]
    );

    expect(result.role).toBe("admin");
    expect(result.visibility).toBe("TENANT_GOVERNANCE_DETAIL");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.exact_scope.course_id).toBe(COURSE);
    expect(result.entries[0]?.readiness).toBe("NO_QUALIFIED_MODEL");
    expect(result.query_only).toBe(true);
    expect(result.no_new_writer).toBe(true);
    expect(result.no_new_store).toBe(true);
    expect(result.no_new_registry).toBe(true);
    expect(result.writer_effect).toBe("NONE");
    expect(result.provider).toBe("OFF");
  });

  it("turns an exact stale portfolio expectation into REBASE_REQUIRED", () => {
    const service = new ModelQualificationService();
    const result = service.getStrategicPortfolioModelGovernanceReadiness(
      { actor_id: "admin-service", role: "tenant_admin", tenant_id: TENANT },
      [{ course_id: COURSE, tenant_id: TENANT, title: "Service course" }],
      [strategicPortfolio()],
      "f".repeat(64)
    );

    expect(result.readiness_status).toBe("REBASE_REQUIRED");
    expect(result.entries[0]?.blockers).toContain("PORTFOLIO_STATE_DIGEST_MISMATCH");
  });

  it("does not expose the tenant portfolio join to a non-admin service actor", () => {
    const service = new ModelQualificationService();
    expect(() =>
      service.getStrategicPortfolioModelGovernanceReadiness(
        { actor_id: "teacher-service", role: "teacher", tenant_id: TENANT },
        [{ course_id: COURSE, tenant_id: TENANT, title: "Service course" }],
        [strategicPortfolio()]
      )
    ).toThrow("MODEL_QUALIFICATION_SCOPE_CONFLICT");
  });
});
