import { describe, expect, it } from "vitest";
import type { PublicResultView } from "../../packages/shared-contracts/src";
import { createInstructorIntelligenceKit } from "../../services/api/src/instructor-intelligence";

const asset = {
  asset_id: "asset_001",
  course_blueprint_ref: {
    content_digest: "a".repeat(64),
    discriminator: "exact_ref" as const,
    resource_id: "blueprint_001",
    resource_type: "course_blueprint" as const,
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  created_at: "2026-08-01T12:00:00.000Z",
  created_by: "teacher_demo",
  fact_digest: "b".repeat(64),
  status: "teacher_published" as const,
  tenant_id: "tenant_demo",
  title: "Debrief",
  updated_at: "2026-08-01T12:00:00.000Z"
};

describe("createInstructorIntelligenceKit", () => {
  it("is deterministic, AI-off, known-limit-aware, and marks a first round without result as baseline unavailable", () => {
    const input = {
      asset,
      result_view: {
        classroom_debrief_prompts: [],
        result_label: "M1",
        results: [],
        round_no: 1,
        run_id: "run_001",
        runtime_boundary: "current_json_active_runtime",
        runtime_limitations: [],
        status: "open" as const
      },
      round: {
        round_id: "round_001",
        round_no: 1,
        run_id: "run_001",
        status: "open" as const,
        tenant_id: "tenant_demo"
      }
    };
    const first = createInstructorIntelligenceKit(input);
    const second = createInstructorIntelligenceKit(input);
    expect(first.deterministic_fact_digest).toBe(second.deterministic_fact_digest);
    expect(first.anomaly_status).toBe("baseline_unavailable");
    expect(first.result_delta).toEqual({ current_team_count: 0 });
    expect(first.ai_status).toBe("off");
    expect(first.known_limits).toContain("not_postgresql_active_runtime");
    expect(JSON.stringify(first)).not.toContain("state_true");
  });

  it("derives deterministic, safe material deltas only from published observed result fields", () => {
    const previous: PublicResultView = {
      classroom_debrief_prompts: [],
      result_label: "M1 Teaching-Official Result under Current JSON Active Runtime",
      results: [
        {
          state_est: {
            explanation: "Observed only",
            next_round_risk: "balanced",
            recommended_focus: "Observe"
          },
          state_obs: {
            demand_band: "medium",
            profit_band: "thin",
            rank: 1,
            revenue: 100,
            score: 50,
            served_demand: 10
          },
          team_id: "team_001",
          team_name: "Team One"
        }
      ],
      round_no: 1,
      run_id: "run_001",
      runtime_boundary: "current_json_active_runtime",
      runtime_limitations: [],
      status: "published"
    };
    const current: PublicResultView = {
      ...previous,
      results: [
        {
          ...previous.results[0]!,
          state_obs: { ...previous.results[0]!.state_obs, rank: 2, score: 62 }
        }
      ],
      round_no: 2
    };
    const kit = createInstructorIntelligenceKit({
      asset,
      previous_result_view: previous,
      result_view: current,
      round: {
        round_id: "round_002",
        round_no: 2,
        run_id: "run_001",
        status: "published",
        tenant_id: "tenant_demo"
      }
    });

    expect(kit.anomaly_status).toBe("material_delta");
    expect(kit.result_delta).toEqual({
      average_score_delta: 12,
      baseline_round_no: 1,
      baseline_team_count: 1,
      current_team_count: 1,
      rank_change_count: 1
    });
    expect(JSON.stringify(kit)).not.toContain("state_true");
  });
});
