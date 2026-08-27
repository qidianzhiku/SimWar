import { describe, expect, it } from "vitest";
import type {
  M2P5DecisionLearningContext,
  M2P5DecisionLearningResponse,
  TeachingClosureDto
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

type DependenciesWithTeachingClosure = M2P5DecisionLearningDependencies & {
  readonly getTeachingClosure: () => Promise<TeachingClosureDto>;
};

type ExpectedLearningLoop = {
  readonly schema_version: "m2p6-teacher-debrief-learning-transfer.v1";
  readonly status: "READY" | "BLOCKED" | "CONFLICT" | "UNKNOWN";
  readonly teacher_debrief_availability: "AVAILABLE" | "BLOCKED" | "UNKNOWN";
  readonly student_learning_report_status: "MISSING" | "CONFIRMED";
  readonly reflection_status: "MISSING" | "SUBMITTED";
  readonly what_if_availability: "AVAILABLE" | "NOT_GENERATED" | "BLOCKED";
  readonly transfer_status: "READY" | "BLOCKED";
  readonly next_opening_state_readiness: "ENTRY_READY" | "READY_TO_CONTINUE" | "BLOCKED";
  readonly blockers: readonly string[];
  readonly allowed_actions: readonly string[];
  readonly recovery_state: "EXACT_CONTEXT_RESTORED";
  readonly teacher_confirmation_ref?: unknown;
  readonly source_receipts: readonly unknown[];
  readonly provenance_refs: readonly unknown[];
};

function learningLoop(result: M2P5DecisionLearningResponse): ExpectedLearningLoop {
  return (result as M2P5DecisionLearningResponse & { learning_loop: ExpectedLearningLoop })
    .learning_loop;
}

function fixtureDependencies(
  overrides: Partial<DependenciesWithTeachingClosure> = {}
): DependenciesWithTeachingClosure {
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
      counterfactual: {
        causal_label: "causal_not_proven" as const,
        changed_field: "capacity_plan" as const,
        changed_value_digest: "1".repeat(64),
        comparison: {
          official_score: 80,
          counterfactual_score: 82,
          score_delta: 2,
          official_rank: 1,
          counterfactual_rank: 1,
          rank_delta: 0
        },
        counterfactual_id: "counterfactual_m2p5",
        exact_context_ref: {
          content_digest: "d".repeat(64),
          discriminator: "exact_ref" as const,
          resource_id: context.round_id,
          resource_type: "round" as const,
          tenant_id: context.tenant_id,
          version: "1.0.0"
        },
        official: false as const,
        original_value_digest: "2".repeat(64)
      },
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
        teacher_confirmation_ref: {
          content_digest: "3".repeat(64),
          discriminator: "exact_ref" as const,
          resource_id: "confirmation_m2p5",
          resource_type: "teacher_confirmation_version" as const,
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
  const dependencies: DependenciesWithTeachingClosure = {
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
        },
        teacher_confirmation_ref: {
          content_digest: "3".repeat(64),
          discriminator: "exact_ref",
          resource_id: "confirmation_m2p5",
          resource_type: "teacher_confirmation_version",
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
    getTeachingClosure: async () => ({
      context: {
        activity_id: context.activity_id,
        course_id: context.course_id,
        role_key: context.role_key,
        run_id: context.run_id,
        team_id: context.team_id
      },
      course_report_available: true,
      export_formats: ["json", "markdown"],
      known_limits: ["read only"],
      queue_item: {
        claim_status: "AVAILABLE",
        confirmation_status: "CONFIRMED",
        context: {
          activity_id: context.activity_id,
          course_id: context.course_id,
          role_key: context.role_key,
          run_id: context.run_id,
          team_id: context.team_id
        },
        eligible_event_count: 1,
        evidence_count: 1,
        known_limits: ["read only"],
        missing: [],
        outcome_status: "CONFIRMED"
      },
      runtime_authority: "JSON_INTERNAL_ONLY",
      schema_version: "teaching-closure.v1",
      student_safe_preview: {
        criterion_count: 1,
        evidence_count: 1,
        next_focus: "transfer",
        status: "CONFIRMED",
        visibility: "student_safe"
      }
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
  return { ...dependencies, ...overrides };
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
    expect(learningLoop(result)).toMatchObject({
      schema_version: "m2p6-teacher-debrief-learning-transfer.v1",
      status: "READY",
      teacher_debrief_availability: "AVAILABLE",
      student_learning_report_status: "CONFIRMED",
      reflection_status: "SUBMITTED",
      what_if_availability: "AVAILABLE",
      transfer_status: "READY",
      next_opening_state_readiness: "ENTRY_READY",
      blockers: [],
      recovery_state: "EXACT_CONTEXT_RESTORED"
    });
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
    expect(learningLoop(result)).toMatchObject({
      status: "CONFLICT",
      blockers: ["STUDENT_LEARNING_REPORT_EXACT_CONTEXT_CONFLICT"]
    });
  });

  it("blocks transfer when the required AI-off reflection is missing", async () => {
    const base = fixtureDependencies();
    const getOfficialConsequence = base.getOfficialConsequence;
    const service = new M2P5DecisionLearningCrossRoundService({
      ...base,
      getOfficialConsequence: async (...args) => {
        const official = await getOfficialConsequence(...args);
        return { ...official, record: { ...official.record, reflection: undefined } };
      }
    });
    const result = await service.getJourney({
      actor: { roles: ["teacher"], tenant_id: context.tenant_id, user_id: "usr_teacher" },
      context,
      surface: "teacher"
    });

    expect(learningLoop(result)).toMatchObject({
      status: "BLOCKED",
      reflection_status: "MISSING",
      transfer_status: "BLOCKED"
    });
    expect(learningLoop(result).blockers).toContain("REFLECTION_REQUIRED");
  });

  it("reports UNKNOWN when the exact teacher debrief read is unavailable", async () => {
    const service = new M2P5DecisionLearningCrossRoundService(
      fixtureDependencies({
        getTeachingClosure: async () => {
          throw new Error("TEACHING_CLOSURE_UNAVAILABLE");
        }
      })
    );
    const result = await service.getJourney({
      actor: { roles: ["teacher"], tenant_id: context.tenant_id, user_id: "usr_teacher" },
      context,
      surface: "teacher"
    });

    expect(learningLoop(result)).toMatchObject({
      status: "UNKNOWN",
      teacher_debrief_availability: "UNKNOWN"
    });
    expect(learningLoop(result).blockers).toContain("TEACHING_CLOSURE_UNAVAILABLE");
  });

  it("reports CONFLICT when W4 closing and opening lineage do not match", async () => {
    const base = fixtureDependencies();
    const service = new M2P5DecisionLearningCrossRoundService({
      ...base,
      validateNextRoundOpening: async (input) => {
        const valid = await base.validateNextRoundOpening(input);
        return {
          ...valid,
          source_closing_state_ref: {
            ...valid.source_closing_state_ref,
            state_digest: "9".repeat(64)
          }
        };
      }
    });
    const result = await service.getJourney({
      actor: { roles: ["teacher"], tenant_id: context.tenant_id, user_id: "usr_teacher" },
      context,
      surface: "teacher"
    });

    expect(learningLoop(result)).toMatchObject({
      status: "CONFLICT",
      next_opening_state_readiness: "BLOCKED"
    });
    expect(learningLoop(result).blockers).toContain("W4_CLOSING_OPENING_LINEAGE_CONFLICT");
  });

  it("keeps the student learning loop free of teacher-only references", async () => {
    let teachingClosureCalls = 0;
    const base = fixtureDependencies({
      getTeachingClosure: async () => {
        teachingClosureCalls += 1;
        throw new Error("student must not call Teaching Closure");
      }
    });
    const getOfficialConsequence = base.getOfficialConsequence;
    const service = new M2P5DecisionLearningCrossRoundService({
      ...base,
      getOfficialConsequence: async (...args) => {
        const official = await getOfficialConsequence(...args);
        return { ...official, visibility: "student_safe" as const };
      }
    });
    const result = await service.getJourney({
      actor: {
        roles: ["student"],
        team_id: context.team_id,
        tenant_id: context.tenant_id,
        user_id: "usr_student"
      },
      context,
      surface: "student"
    });

    const serialized = JSON.stringify(result);
    const learningSurface = JSON.stringify({
      learning: result.learning,
      learning_loop: learningLoop(result)
    });
    expect(teachingClosureCalls).toBe(0);
    expect(learningLoop(result).allowed_actions).toContain("ENTER_NEXT_ROUND");
    expect(learningLoop(result).teacher_confirmation_ref).toBeUndefined();
    expect(result.learning.teacher_confirmation_ref).toBeUndefined();
    expect(learningSurface).not.toContain('"teacher_confirmation_ref"');
    expect(serialized).not.toContain("decision_batch_hash");
    expect(serialized).not.toContain("json_runtime_source_digest");
    expect(serialized).not.toContain("canonical_evidence_digest");
    expect(serialized).not.toContain("replay_input_manifest");
    expect(serialized).not.toContain("authority_diagnostics");
  });

  it("does not allow student entry while the transfer gate is not ready", async () => {
    const base = fixtureDependencies();
    const getOfficialConsequence = base.getOfficialConsequence;
    const service = new M2P5DecisionLearningCrossRoundService({
      ...base,
      getOfficialConsequence: async (...args) => {
        const official = await getOfficialConsequence(...args);
        return {
          ...official,
          visibility: "student_safe" as const,
          record: { ...official.record, counterfactual: undefined }
        }
      },
    });

    const result = await service.getJourney({
      actor: {
        roles: ["student"],
        team_id: context.team_id,
        tenant_id: context.tenant_id,
        user_id: "usr_student"
      },
      context,
      surface: "student"
    });

    expect(learningLoop(result).status).toBe("BLOCKED");
    expect(learningLoop(result).allowed_actions).not.toContain("ENTER_NEXT_ROUND");
    expect(learningLoop(result).blockers).toContain("WHAT_IF_REQUIRED");
  });

  it("fails closed when the inherited official consequence is not bound to the exact round", async () => {
    const base = fixtureDependencies();
    const getOfficialConsequence = base.getOfficialConsequence;
    const service = new M2P5DecisionLearningCrossRoundService({
      ...base,
      getOfficialConsequence: async (...args) => {
        const official = await getOfficialConsequence(...args);
        return {
          ...official,
          record: {
            ...official.record,
            context: { ...official.record.context, round_id: "round_m2p5_other" }
          }
        };
      }
    });

    await expect(
      service.getJourney({
        actor: { roles: ["teacher"], tenant_id: context.tenant_id, user_id: "usr_teacher" },
        context,
        surface: "teacher"
      })
    ).rejects.toMatchObject({ code: "M2P5_OUTPUT_INVALID" });
  });

  it("rejects a forbidden truth key inherited from any read model", async () => {
    const base = fixtureDependencies();
    const getOfficialConsequence = base.getOfficialConsequence;
    const service = new M2P5DecisionLearningCrossRoundService({
      ...base,
      getOfficialConsequence: async (...args) => {
        const official = await getOfficialConsequence(...args);
        return {
          ...official,
          record: { ...official.record, state_true: { cash_flow: 1 } }
        } as never;
      }
    });

    await expect(
      service.getJourney({
        actor: { roles: ["teacher"], tenant_id: context.tenant_id, user_id: "usr_teacher" },
        context,
        surface: "teacher"
      })
    ).rejects.toMatchObject({ code: "M2P5_OUTPUT_INVALID" });
  });
});
