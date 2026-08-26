import { describe, expect, it } from "vitest";
import {
  isW3OfficialConsequenceRecord,
  type W3OfficialConsequenceRecord
} from "../../packages/shared-contracts/src/w3-official-consequence-learning.js";
import type {
  Decision,
  SettlementResult,
  StudentLearningReport,
  StudentLearningReportExactRef,
  TeacherConfirmationExactRef,
  TeacherConfirmationVersion
} from "@simwar/shared-contracts";
import { W3OfficialConsequenceLearningService } from "../../services/api/src/w3-official-consequence-learning.js";

const digest = "a".repeat(64);

function exactRef(
  resource_type: W3OfficialConsequenceRecord["source"]["round_ref"]["resource_type"],
  resource_id: string
) {
  return {
    content_digest: digest,
    discriminator: "exact_ref" as const,
    resource_id,
    resource_type,
    tenant_id: "tenant_w3",
    version: "1.0.0"
  };
}

function validRecord(): W3OfficialConsequenceRecord {
  return {
    causal_debrief: {
      label: "model_conditioned_association",
      statements: ["Observed outcome is compared with the bounded model context."]
    },
    context: {
      activity_id: "activity_consequence",
      course_id: "course_w3",
      role_key: "CEO",
      round_id: "round_w3",
      round_no: 1,
      run_id: "run_w3",
      team_id: "team_w3",
      tenant_id: "tenant_w3"
    },
    decision_story: {
      consequence_summary: "The published result is available in the safe result layer.",
      decision_summary: "The canonical Decision was admitted through W027."
    },
    known_limits: ["Human Validation is not performed."],
    learning: {
      evidence_selection_status: "NOT_SELECTED",
      next_round_hypothesis_status: "BLOCKED",
      teacher_confirmation_status: "MISSING"
    },
    official_result: {
      outcome_label: "official_published",
      profit_band: "healthy",
      rank: 1,
      score: 80,
      team_id: "team_w3"
    },
    publication: {
      published_at: "2026-08-18T00:00:00.000Z",
      status: "PUBLISHED"
    },
    record_id: "w3_record_1",
    schema_version: "w3-official-consequence-learning.v1",
    source: {
      canonical_decision_ref: exactRef("canonical_decision", "decision_w3"),
      round_ref: exactRef("round", "round_w3"),
      settlement_ref: exactRef("settlement_result", "settlement_w3")
    },
    runtime_authority: "JSON_INTERNAL_ONLY"
  };
}

const learningContext = {
  activity_id: "activity_consequence",
  course_id: "course_w3",
  role_key: "CEO",
  run_id: "run_w3",
  team_id: "team_w3",
  tenant_id: "tenant_w3"
} as const;

function teacherConfirmationRef(
  resource_type: TeacherConfirmationExactRef["resource_type"],
  resource_id: string,
  version = "1.0.0"
): TeacherConfirmationExactRef {
  return {
    content_digest: digest,
    discriminator: "exact_ref",
    resource_id,
    resource_type,
    tenant_id: learningContext.tenant_id,
    version
  };
}

function studentReportRef(
  resource_type: StudentLearningReportExactRef["resource_type"],
  resource_id: string,
  version = "1.0.0"
): StudentLearningReportExactRef {
  return {
    content_digest: digest,
    discriminator: "exact_ref",
    resource_id,
    resource_type,
    tenant_id: learningContext.tenant_id,
    version
  };
}

function confirmation(
  confirmationId: string,
  round: { readonly round_id: string; readonly round_no: number },
  version: string,
  createdAt: string
): TeacherConfirmationVersion {
  return {
    audit_receipt: {
      action: "teacher_confirmation.confirm",
      actor_id: "usr_teacher",
      audit_id: `audit_${confirmationId}`,
      recorded_at: createdAt,
      request_id: `request_${confirmationId}`
    },
    confirmation_ref: teacherConfirmationRef(
      "teacher_confirmation_version",
      confirmationId,
      version
    ),
    content_digest: digest,
    context: { ...learningContext, ...round },
    course_package_ref: teacherConfirmationRef("course_package_version", "package_w3"),
    created_at: createdAt,
    created_by: "usr_teacher",
    criterion_decisions: [{ criterion_id: "criterion_w3", level_ordinal: 2 }],
    discriminator: "teacher_confirmation_version",
    evidence_refs: [teacherConfirmationRef("evidence_artifact", `artifact_${confirmationId}`)],
    idempotency_key: `idem_${confirmationId}`,
    known_limits: ["D3 teacher-only"],
    learning_goal_ref: teacherConfirmationRef("learning_goal_version", "goal_w3"),
    rubric_ref: teacherConfirmationRef("rubric_version", "rubric_w3"),
    schema_version: "teacher-confirmation.v1",
    status: "CONFIRMED",
    teacher_feedback: "The evidence is bounded and reviewable."
  };
}

function report(source: TeacherConfirmationVersion, reportId: string): StudentLearningReport {
  return {
    business_outcome: {
      status: "SEPARATE_SAFE_OUTCOME",
      summary: "Published business outcome remains in its separate safe result layer."
    },
    context: source.context,
    course_package_ref: studentReportRef("course_package_version", "package_w3"),
    generated_at: source.created_at,
    evidence_refs: [
      studentReportRef("evidence_artifact", `artifact_${source.confirmation_ref.resource_id}`)
    ],
    known_limits: ["D4 student-safe"],
    learning_goal_ref: studentReportRef("learning_goal_version", "goal_w3"),
    learning_evidence: {
      criterion_results: [{ criterion_id: "criterion_w3", level_ordinal: 2 }],
      provenance_chain: [],
      student_visible_feedback: []
    },
    report_digest: digest,
    report_ref: studentReportRef("student_learning_report", reportId),
    rubric_ref: studentReportRef("rubric_version", "rubric_w3"),
    runtime_authority: "JSON_INTERNAL_ONLY",
    schema_version: "student-learning-report.v1",
    source_confirmation_digest: source.content_digest,
    status: "CONFIRMED",
    student_scope: {
      team_id: source.context.team_id,
      tenant_id: learningContext.tenant_id,
      user_id: "usr_teacher"
    },
    teacher_confirmation_ref: studentReportRef(
      "teacher_confirmation_version",
      source.confirmation_ref.resource_id,
      source.confirmation_ref.version
    ),
    visibility: "student_safe"
  };
}

function learningReadService(
  confirmations: readonly TeacherConfirmationVersion[],
  reports: readonly StudentLearningReport[]
): W3OfficialConsequenceLearningService {
  const decision: Decision = {
    canonical_source: "role_merge_commit",
    decision_id: "decision_w3",
    payload: {
      cash_buffer_target: 0.2,
      capacity_plan: "hold",
      marketing_budget: 100000,
      pricing: { base_price: 12000 },
      service_quality_budget: 100000,
      strategy_statement: "bounded W3 learning read"
    },
    round_id: "round_w3",
    round_no: 1,
    run_id: "run_w3",
    status: "submitted",
    submitted_by: "usr_teacher",
    team_id: "team_w3",
    tenant_id: "tenant_w3",
    validation_report: [],
    version: 1
  };
  const settlement: SettlementResult = {
    parameter_set_id: "params_w3",
    replay_hash: digest,
    round_id: "round_w3",
    round_no: 1,
    run_id: "run_w3",
    scenario_package_id: "scenario_w3",
    settlement_result_id: "settlement_w3",
    team_results: [
      {
        state_est: {
          explanation: "bounded",
          next_round_risk: "balanced",
          recommended_focus: "observe"
        },
        state_obs: {
          demand_band: "medium",
          profit_band: "healthy",
          rank: 1,
          revenue: 1,
          score: 80,
          served_demand: 1
        },
        state_true: {
          cash_flow: 1,
          cost: 1,
          demand: 1,
          market_share: 1,
          profit: 1,
          rank: 1,
          revenue: 1,
          score: 80,
          served_demand: 1,
          settlement_status: "settled"
        },
        team_id: "team_w3",
        team_name: "W3"
      }
    ],
    tenant_id: "tenant_w3"
  };
  const reportList = (scope: "student_team" | "tenant_preview") => ({
    known_limits: ["D4 projection"],
    reports,
    report_schema_version: "student-learning-report.v1" as const,
    runtime_authority: "JSON_INTERNAL_ONLY" as const,
    scope
  });

  return new W3OfficialConsequenceLearningService({
    confirmations: {
      list: async () => [...confirmations]
    },
    evidence: {
      listEvidenceArtifacts: async () => [],
      listProvenanceEdges: async () => []
    },
    idGenerator: { createAuditLogId: () => "audit_w3" },
    reports: {
      listPreview: async () => reportList("tenant_preview"),
      listStudent: async () => reportList("student_team")
    },
    repository: {
      auditLogs: {
        appendAuditLog: async () => undefined,
        listAuditLogs: async () => []
      },
      decisions: {
        getCanonicalDecisionForTeamRound: async () => decision,
        listDecisionsForRound: async () => []
      },
      parameterSets: { getParameterSet: async () => null },
      rounds: {
        listRoundsForRun: async () => [
          {
            round_id: "round_w3",
            round_no: 1,
            run_id: "run_w3",
            status: "published",
            tenant_id: "tenant_w3"
          }
        ]
      },
      runs: {
        getRun: async () => ({
          course_id: "course_w3",
          parameter_set_id: "params_w3",
          run_id: "run_w3",
          scenario_package_id: "scenario_w3",
          seed: 1,
          status: "active",
          tenant_id: "tenant_w3"
        })
      },
      scenarios: { getScenarioPackage: async () => null },
      settlements: {
        listSettlementResultsForRound: async () => [settlement]
      },
      teams: {
        getTeam: async () => ({
          course_id: "course_w3",
          members: [{ user_id: "usr_teacher" }],
          team_id: "team_w3",
          tenant_id: "tenant_w3"
        }),
        listTeamsForRun: async () => []
      }
    }
  });
}

describe("W3 official consequence contract", () => {
  it("accepts the bounded published record", () => {
    expect(isW3OfficialConsequenceRecord(validRecord())).toBe(true);
  });

  it("rejects raw private payloads and causal claims without bounded labels", () => {
    const candidate = validRecord() as unknown as Record<string, unknown>;
    candidate.raw_private_payload = "must never be projected";
    (candidate.causal_debrief as Record<string, unknown>).label = "causal_fact";
    expect(isW3OfficialConsequenceRecord(candidate)).toBe(false);
  });
});

describe("W3 counterfactual firewall", () => {
  it("rejects a counterfactual before official publication", async () => {
    const service = new W3OfficialConsequenceLearningService({
      repository: {
        runs: {
          getRun: async () => ({
            run_id: "run_w3",
            tenant_id: "tenant_w3",
            course_id: "course_w3",
            scenario_package_id: "scenario_w3",
            parameter_set_id: "params_w3",
            seed: 1,
            status: "active"
          })
        },
        rounds: {
          listRoundsForRun: async () => [
            {
              round_id: "round_w3",
              run_id: "run_w3",
              tenant_id: "tenant_w3",
              round_no: 1,
              status: "settled"
            }
          ]
        },
        teams: {
          getTeam: async () => ({
            team_id: "team_w3",
            tenant_id: "tenant_w3",
            course_id: "course_w3",
            name: "W3",
            captain_user_id: "usr_student",
            members: [{ user_id: "usr_student", display_name: "Student", role_slot: "CEO" }]
          }),
          listTeamsForRun: async () => []
        },
        decisions: {
          getCanonicalDecisionForTeamRound: async () => ({
            decision_id: "decision_w3",
            tenant_id: "tenant_w3",
            run_id: "run_w3",
            round_id: "round_w3",
            round_no: 1,
            team_id: "team_w3",
            status: "submitted",
            version: 1,
            payload: {
              pricing: { base_price: 12000 },
              marketing_budget: 100000,
              service_quality_budget: 100000,
              capacity_plan: "hold",
              cash_buffer_target: 0.2,
              strategy_statement: "bounded W3 test decision"
            },
            validation_report: [],
            submitted_by: "usr_student",
            canonical_source: "role_merge_commit"
          }),
          listDecisionsForRound: async () => []
        },
        settlements: {
          listSettlementResultsForRound: async () => [
            {
              settlement_result_id: "settlement_w3",
              tenant_id: "tenant_w3",
              run_id: "run_w3",
              round_id: "round_w3",
              round_no: 1,
              parameter_set_id: "params_w3",
              scenario_package_id: "scenario_w3",
              replay_hash: digest,
              team_results: [
                {
                  team_id: "team_w3",
                  state_true: {
                    cash_flow: 1,
                    demand: 1,
                    market_share: 1,
                    profit: 1,
                    served_demand: 1
                  },
                  state_obs: {
                    demand_band: "medium",
                    served_demand: 1,
                    revenue: 1,
                    profit_band: "healthy",
                    score: 80,
                    rank: 1
                  },
                  state_est: {
                    next_round_risk: "balanced",
                    explanation: "bounded",
                    recommended_focus: "observe"
                  }
                }
              ]
            }
          ]
        },
        scenarios: { getScenarioPackage: async () => null },
        parameterSets: { getParameterSet: async () => null },
        auditLogs: { listAuditLogs: async () => [], appendAuditLog: async () => undefined }
      },
      evidence: { listEvidenceArtifacts: async () => [], listProvenanceEdges: async () => [] },
      confirmations: { list: async () => [] },
      reports: {
        listStudent: async () => ({
          reports: [],
          known_limits: [],
          report_schema_version: "student-learning-report.v1",
          runtime_authority: "JSON_INTERNAL_ONLY",
          scope: "student_team"
        }),
        listPreview: async () => ({
          reports: [],
          known_limits: [],
          report_schema_version: "student-learning-report.v1",
          runtime_authority: "JSON_INTERNAL_ONLY",
          scope: "teacher_preview"
        })
      },
      idGenerator: { createAuditLogId: () => "audit_w3" },
      now: () => "2026-08-18T00:00:00.000Z"
    });

    await expect(
      service.createCounterfactual(
        { user_id: "usr_teacher", tenant_id: "tenant_w3", roles: ["teacher"] },
        {
          context: {
            activity_id: "activity_consequence",
            course_id: "course_w3",
            role_key: "CEO",
            round_id: "round_w3",
            round_no: 1,
            run_id: "run_w3",
            team_id: "team_w3",
            tenant_id: "tenant_w3"
          },
          changed_field: "capacity_plan",
          changed_value: "expand",
          idempotency_key: "cf_w3"
        },
        "req_w3"
      )
    ).rejects.toMatchObject({ code: "W3_OFFICIAL_RESULT_NOT_PUBLISHED" });
  });
});

describe("W3 exact-round learning reads", () => {
  it("selects the confirmation and learning report for the requested exact round", async () => {
    const roundOne = { round_id: "round_w3", round_no: 1 } as const;
    const roundTwo = { round_id: "round_w3_2", round_no: 2 } as const;
    const confirmationA = confirmation(
      "confirmation_round_1",
      roundOne,
      "1.0.0",
      "2026-08-18T00:00:00.000Z"
    );
    const confirmationB = confirmation(
      "confirmation_round_2",
      roundTwo,
      "9.0.0",
      "2026-08-19T00:00:00.000Z"
    );
    const reportA = report(confirmationA, "report_round_1");
    const reportB = report(confirmationB, "report_round_2");
    const service = learningReadService([confirmationA, confirmationB], [reportB, reportA]);

    const result = await service.getConsequenceExact(
      { roles: ["teacher"], tenant_id: "tenant_w3", user_id: "usr_teacher" },
      { ...learningContext, ...roundOne },
      "teacher"
    );

    expect(result.record.learning.teacher_confirmation_ref?.resource_id).toBe(
      "confirmation_round_1"
    );
    expect(result.record.learning.student_learning_report_ref?.resource_id).toBe("report_round_1");
  });
});
