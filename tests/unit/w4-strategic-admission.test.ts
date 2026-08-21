import { describe, expect, it } from "vitest";
import type { Decision } from "../../packages/shared-contracts/src";
import { assertFormalW4DecisionMatchesCanonical } from "../../services/api/src/w4-enterprise-state";

describe("W4 strategic action formal admission", () => {
  const projectPayload = {
    project_name: "Confirmed project",
    cost: 300,
    cycle_rounds: 3,
    area: 12000,
    beds: 120,
    bed_mix: { standard: 72, memory_care: 36, premium: 12 },
    ramp: 0.4,
    lead_time_rounds: 2
  };

  it("rejects a W4 payload that differs from the formally confirmed canonical Decision", () => {
    const canonical: Decision = {
      canonical_source: "role_merge_commit",
      decision_id: "decision-formal-001",
      merge_commit_id: "merge-formal-001",
      payload: {
        capacity_plan: "hold",
        cash_buffer_target: 0.2,
        marketing_budget: 100000,
        pricing: { base_price: 12000 },
        service_quality_budget: 100000,
        strategy_statement: "Confirmed strategic direction"
      },
      round_id: "round-formal-001",
      round_no: 1,
      run_id: "run-formal-001",
      status: "submitted",
      submitted_by: "user-ceo",
      team_confirmation_id: "confirmation-formal-001",
      team_id: "team-formal-001",
      tenant_id: "tenant-formal-001",
      validation_report: [],
      version: 1
    };

    const submitted = {
      decision_id: "w4-strategic-001",
      tenant_id: canonical.tenant_id,
      course_id: "course-formal-001",
      run_id: canonical.run_id,
      round_id: canonical.round_id,
      round_no: canonical.round_no,
      team_id: canonical.team_id,
      kind: "new_project" as const,
      version: 1,
      status: "canonical" as const,
      payload: {
        project_name: "Unconfirmed alternate project",
        cost: 300,
        cycle_rounds: 3,
        area: 12000,
        beds: 120,
        bed_mix: { standard: 72, memory_care: 36, premium: 12 },
        ramp: 0.4,
        lead_time_rounds: 2
      }
    };

    expect(() => assertFormalW4DecisionMatchesCanonical(submitted, canonical)).toThrowError(
      expect.objectContaining({ code: "W4_DECISION_PAYLOAD_BINDING_CONFLICT" })
    );
  });

  it("accepts only an exact versioned W4 action envelope", () => {
    const canonical: Decision = {
      canonical_source: "role_merge_commit",
      decision_id: "decision-formal-002",
      merge_commit_id: "merge-formal-002",
      payload: {
        w4_strategic_action: { kind: "new_project", version: 1, payload: projectPayload }
      },
      round_id: "round-formal-002",
      round_no: 1,
      run_id: "run-formal-002",
      status: "submitted",
      submitted_by: "user-ceo",
      team_confirmation_id: "confirmation-formal-002",
      team_id: "team-formal-002",
      tenant_id: "tenant-formal-002",
      validation_report: [],
      version: 1
    };
    const submitted = {
      kind: "new_project" as const,
      version: 1,
      payload: projectPayload
    };

    expect(() => assertFormalW4DecisionMatchesCanonical(submitted, canonical)).not.toThrow();
  });
});
