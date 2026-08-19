import { describe, expect, it } from "vitest";
import {
  isW3OfficialConsequenceRecord,
  type W3OfficialConsequenceRecord
} from "../../packages/shared-contracts/src/w3-official-consequence-learning.js";
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
