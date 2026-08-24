import { describe, expect, it } from "vitest";
import type {
  M2P5DecisionLearningContext,
  M2P5DecisionLearningResponse
} from "@simwar/shared-contracts";
import {
  M2P5DecisionLearningCrossRoundService,
  type M2P5DecisionLearningDependencies
} from "../../services/api/src/m2p5-decision-learning-crossround";

const context: M2P5DecisionLearningContext = {
  activity_id: "activity_consequence",
  course_id: "course_m2p5",
  role_key: "CEO",
  round_id: "round_m2p5_1",
  round_no: 1,
  run_id: "run_m2p5",
  team_id: "team_alpha",
  tenant_id: "tenant_demo"
};

function fixtureDependencies(): M2P5DecisionLearningDependencies {
  const closing = {
    tenant_id: context.tenant_id,
    course_id: context.course_id,
    run_id: context.run_id,
    team_id: context.team_id,
    round_id: context.round_id,
    enterprise_state_id: "state_m2p5_1",
    version: 2,
    state_digest: "a".repeat(64)
  };
  const next = {
    round_id: "round_m2p5_2",
    round_no: 2,
    run_id: context.run_id,
    status: "open" as const,
    tenant_id: context.tenant_id
  };
  const response = {
    known_limits: [],
    runtime_authority: "JSON_INTERNAL_ONLY" as const,
    visibility: "teacher_safe" as const,
    record: {
      causal_debrief: {
        label: "model_conditioned_association" as const,
        statements: ["bounded"]
      },
      context,
      decision_story: { consequence_summary: "published", decision_summary: "canonical" },
      known_limits: [],
      learning: {
        evidence_selection_status: "SELECTED" as const,
        next_round_hypothesis_status: "READY" as const,
        student_learning_report_ref: {
          content_digest: "b".repeat(64),
          discriminator: "exact_ref" as const,
          resource_id: "report_m2p5",
          resource_type: "student_learning_report" as const,
          tenant_id: context.tenant_id,
          version: "1.0.0"
        },
        teacher_confirmation_status: "CONFIRMED" as const
      },
      operating_world_consequence_trace: {
        schema_version: "operating-world-consequence-trace.v1",
        trace_id: "operating_world_trace_m2p5",
        scope: {
          tenant_id: context.tenant_id,
          course_id: context.course_id,
          run_id: context.run_id,
          round_no: context.round_no,
          team_id: context.team_id
        },
        operating_world_binding_digest: "a".repeat(64),
        canonical_decision_ref: "decision_m2p5",
        settlement_result_ref: "settlement_m2p5",
        replay_relevant_digest: "e".repeat(64),
        publication: { status: "PUBLISHED" as const },
        allowed_effects: [],
        constraints: ["bounded"],
        known_limits: ["projection only"],
        source_classification: "SHADOW_ONLY" as const,
        official_delta: "NONE" as const,
        writes_official_state: false as const,
        causal_authority: "DETERMINISTIC_SYSTEM_FACTS" as const,
        ai_generated: false as const
      },
      next_round_hypothesis: {
        basis: "confirmed",
        hypothesis: "test one bounded change",
        status: "READY" as const
      },
      official_result: {
        outcome_label: "official_published" as const,
        profit_band: "healthy" as const,
        rank: 1,
        score: 80,
        team_id: context.team_id
      },
      publication: { status: "PUBLISHED" as const },
      reflection: {
        ai_used: false as const,
        advisory_only: true as const,
        prompt_id: "w3-reflection-off-v1",
        reflection_id: "reflection_m2p5",
        response: "confirmed",
        status: "SUBMITTED" as const
      },
      record_id: "w3_m2p5",
      runtime_authority: "JSON_INTERNAL_ONLY" as const,
      schema_version: "w3-official-consequence-learning.v1" as const,
      source: {
        canonical_decision_ref: {
          content_digest: "c".repeat(64),
          discriminator: "exact_ref" as const,
          resource_id: "decision_m2p5",
          resource_type: "canonical_decision" as const,
          tenant_id: context.tenant_id,
          version: "1.0.0"
        },
        round_ref: {
          content_digest: "d".repeat(64),
          discriminator: "exact_ref" as const,
          resource_id: context.round_id,
          resource_type: "round" as const,
          tenant_id: context.tenant_id,
          version: "1.0.0"
        },
        settlement_ref: {
          content_digest: "e".repeat(64),
          discriminator: "exact_ref" as const,
          resource_id: "settlement_m2p5",
          resource_type: "settlement_result" as const,
          tenant_id: context.tenant_id,
          version: "1.0.0"
        }
      }
    }
  } as unknown as M2P5DecisionLearningDependencies["getOfficialConsequence"] extends (
    ...args: never[]
  ) => Promise<infer T>
    ? T
    : never;
  return {
    getExactRound: async () => ({
      round_id: context.round_id,
      round_no: 1,
      run_id: context.run_id,
      status: "published",
      tenant_id: context.tenant_id
    }),
    getNextRound: async () => next,
    getOfficialConsequence: async () => response,
    getLearningReport: async () =>
      ({
        context: {
          course_id: context.course_id,
          run_id: context.run_id,
          team_id: context.team_id,
          role_key: context.role_key,
          round_id: context.round_id,
          round_no: context.round_no
        },
        report_digest: "b".repeat(64),
        report_ref: {
          content_digest: "b".repeat(64),
          discriminator: "exact_ref",
          resource_id: "report_m2p5",
          resource_type: "student_learning_report",
          tenant_id: context.tenant_id,
          version: "1.0.0"
        }
      }) as never,
    getProjectContext: async () => ({
      status: "RESOLVED" as const,
      project_profile_reference: {
        content_digest: "f".repeat(64),
        project_profile_id: "profile_m2p5",
        tenant_id: context.tenant_id,
        version: "2026-08-23.v1"
      },
      title: "Shanghai care project"
    }),
    getW4Projection: async () => ({
      closing_state_ref: closing,
      opening_state_ref: null
    }),
    validateNextRoundOpening: async () => ({
      state_ref: closing,
      source_closing_state_ref: closing
    })
  };
}

describe("M2-P5 decision learning cross-round composition", () => {
  it("joins the published consequence to confirmed learning and exact next-round lineage", async () => {
    const service = new M2P5DecisionLearningCrossRoundService(fixtureDependencies());
    const result: M2P5DecisionLearningResponse = await service.getJourney({
      actor: {
        roles: ["teacher"],
        tenant_id: context.tenant_id,
        user_id: "usr_teacher"
      },
      context,
      surface: "teacher"
    });

    expect(result.learning.gate).toBe("READY");
    expect(result.project_context.status).toBe("RESOLVED");
    expect(result.cross_round.status).toBe("ENTRY_READY");
    expect(result.official_consequence.record.operating_world_consequence_trace?.trace_id).toBe(
      "operating_world_trace_m2p5"
    );
    expect(result.cross_round.next_round?.source_closing_state_ref).toEqual(
      result.cross_round.predecessor_closing_state_ref
    );
    expect(JSON.stringify(result)).not.toContain("state_true");
    expect(JSON.stringify(result)).not.toContain("replay_hash");
  });

  it("blocks a learning report that is not explicitly bound to the published round", async () => {
    const dependencies = {
      ...fixtureDependencies(),
      getLearningReport: async () =>
        ({
          context: {
            course_id: context.course_id,
            run_id: context.run_id,
            team_id: context.team_id,
            role_key: context.role_key
          }
        }) as never
    };
    const service = new M2P5DecisionLearningCrossRoundService(dependencies);
    const result = await service.getJourney({
      actor: {
        roles: ["teacher"],
        tenant_id: context.tenant_id,
        user_id: "usr_teacher"
      },
      context,
      surface: "teacher"
    });

    expect(result.learning.student_learning_report_status).toBe("MISSING");
    expect(result.learning.gate).toBe("BLOCKED");
    expect(result.cross_round.status).toBe("BLOCKED");
  });
});
