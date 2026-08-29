import { describe, expect, it } from "vitest";
import type {
  CurrentUser,
  ESLAlternativePath,
  M4MultipathCounterfactualResponse,
  W4CapitalAction,
  W4ProjectionBase
} from "@simwar/shared-contracts";
import {
  ExecutiveStrategyLabError,
  ExecutiveStrategyLabService
} from "../../services/api/src/executive-strategy-lab-service.js";

const teacher: CurrentUser = {
  display_name: "Teacher",
  permissions: ["course:read"],
  roles: ["teacher"],
  tenant_id: "tenant_demo",
  user_id: "usr_teacher"
};

const request = {
  discriminator: "esl_strategy_lab_request" as const,
  exact_binding: {
    tenant_id: "tenant_demo",
    course_id: "course_demo",
    run_id: "run_demo",
    team_id: "team_alpha",
    round_id: "round_demo_1",
    round_no: 1,
    scenario_package_id: "scenario_demo",
    scenario_version: "1.0.0",
    parameter_set_id: "parameter_demo",
    parameter_set_version: "1.0.0",
    model_version_id: "model_demo",
    model_version: "1.0.0",
    model_artifact_id: "artifact_demo",
    model_artifact_version: "1.0.0",
    engine_id: "toy_logit_wellness_v1",
    plugin_ids: ["plugin_wellness_stub"],
    seed: 79
  },
  paths: [
    { path_id: "path_a", label: "优先投资", decision_ids: ["decision_a"] },
    { path_id: "path_b", label: "保守运营", decision_ids: ["decision_b"] }
  ],
  transfer_hypothesis: "下一轮先验证服务质量与现金缓冲的平衡。",
  idempotency_key: "esl-service-001"
};

function projection(): W4ProjectionBase {
  return {
    scope: {
      tenant_id: "tenant_demo",
      course_id: "course_demo",
      run_id: "run_demo",
      team_id: "team_alpha"
    },
    opening_state_ref: {
      tenant_id: "tenant_demo",
      course_id: "course_demo",
      run_id: "run_demo",
      team_id: "team_alpha",
      round_id: "round_demo_1",
      enterprise_state_id: "state_demo",
      version: 1,
      state_digest: "a".repeat(64)
    },
    closing_state_ref: {
      tenant_id: "tenant_demo",
      course_id: "course_demo",
      run_id: "run_demo",
      team_id: "team_alpha",
      round_id: "round_demo_1",
      enterprise_state_id: "state_demo_close",
      version: 1,
      state_digest: "b".repeat(64)
    },
    state: {
      cash: 900,
      capacity: 100,
      product_lines: ["core-care"],
      positioning: "trusted-care",
      organization: { team_size: 4 },
      operating_units: [],
      portfolio: { projects: [], facilities: [] }
    },
    initiatives: [],
    project_portfolio: [],
    project_transactions: [],
    capital_actions: [],
    strategic_portfolio: {} as W4ProjectionBase["strategic_portfolio"],
    commitments: [],
    effects: [],
    latest_strategic_action: null,
    evidence: [],
    path_evidence: {
      opening_vs_closing: null,
      initiative_timeline: [],
      persistent_effect_ids: [],
      portfolio_hierarchy: {
        group_tenant_id: "tenant_demo",
        portfolio_projects: [],
        portfolio_facilities: [],
        operating_unit_ids: []
      },
      official_replay_path: {
        official_outcome_id: "outcome_demo",
        replay_ids: [],
        path_digests: [],
        replay_writes_formal_results: false
      },
      same_current_decision_different_history: {
        status: "not_observed",
        current_decision_ids: [],
        comparison_count: 0
      }
    },
    finance_accounting_bases: {
      path_a: {
        source_ref: "w4-finance-evidence",
        path_id: "path_a",
        source_scope: {
          tenant_id: "tenant_demo",
          course_id: "course_demo",
          run_id: "run_demo",
          team_id: "team_alpha",
          round_id: "round_demo_1"
        },
        source_digest: "f".repeat(64),
        currency: "SIMWAR_UNITS",
        time_period: "HORIZON",
        capex: 100,
        opex: 50,
        operating_cash_flow: 180,
        amortization: 40,
        capital_budget: 250
      }
    }
  };
}

function m4CapitalAction(): W4CapitalAction {
  return {
    capital_action_id: "m4-capital-action",
    decision_id: "decision_a",
    decision_payload_digest: "1".repeat(64),
    tenant_id: "tenant_demo",
    course_id: "course_demo",
    run_id: "run_demo",
    team_id: "team_alpha",
    kind: "debt",
    status: "active",
    principal: 300,
    term_rounds: 3,
    rate_or_cost_bps: 500,
    cost_source: "m4-test",
    covenant_min_cash: 500,
    fees: 5,
    obligation: "term_debt",
    project_entry_id: null,
    initiative_id: null,
    policy_seam_id: null,
    created_round_no: 2,
    effective_round_no: 2,
    maturity_round_no: 5
  };
}

function m4Response(): M4MultipathCounterfactualResponse {
  return {
    schema_version: "m4-multipath-counterfactual-transfer.v1",
    runtime_authority: "JSON_INTERNAL_ONLY",
    visibility: "teacher_safe",
    exact_binding: {
      source_state_ref: projection().closing_state_ref!,
      source_outcome_id: "outcome_demo",
      horizon_rounds: 1,
      scenario_package_id: "scenario_demo",
      parameter_set_id: "parameter_demo",
      engine_id: "toy_logit_wellness_v1",
      plugin_ids: ["plugin_wellness_stub"],
      seed: 79
    },
    official_path: {
      officiality: "OFFICIAL",
      unchanged: true,
      outcome_id: "outcome_demo",
      opening_state_ref: projection().opening_state_ref!,
      closing_state_ref: projection().closing_state_ref!,
      decision_ids: [],
      replay_writes_formal_results: false
    },
    lineage: {
      source_round_id: "round_demo_1",
      source_section_ids: [],
      preserved_dissent_role_keys: [],
      resolution_status: "NOT_PRESENT",
      history_event_types: [],
      historical_decision_reentry_blocked: true
    },
    paths: [
      {
        path_id: "path_a",
        label: "优先投资",
        officiality: "NON_OFFICIAL",
        decision_ids: ["decision_a"],
        decision_payload_bindings: [],
        capital_actions: [m4CapitalAction()],
        path_digest: "c".repeat(64),
        rounds: [],
        mechanism_differential: {
          changed_paths: ["state.cash"],
          changed_path_count: 1,
          interpretation: "DETERMINISTIC_STATE_TRANSITION_DIFFERENTIAL"
        },
        outcome_differential: {
          baseline: "OFFICIAL_SOURCE_CLOSING_STATE",
          cash_delta: -100,
          capacity_delta: 10,
          product_line_count_delta: 0,
          operating_unit_count_delta: 0,
          project_count_delta: 1,
          facility_count_delta: 0,
          terminal_state_ref: projection().closing_state_ref!,
          terminal_state_digest: "d".repeat(64)
        }
      },
      {
        path_id: "path_b",
        label: "保守运营",
        officiality: "NON_OFFICIAL",
        decision_ids: ["decision_b"],
        decision_payload_bindings: [],
        capital_actions: [],
        path_digest: "e".repeat(64),
        rounds: [],
        mechanism_differential: {
          changed_paths: ["state.capacity"],
          changed_path_count: 1,
          interpretation: "DETERMINISTIC_STATE_TRANSITION_DIFFERENTIAL"
        },
        outcome_differential: {
          baseline: "OFFICIAL_SOURCE_CLOSING_STATE",
          cash_delta: -50,
          capacity_delta: 0,
          product_line_count_delta: 0,
          operating_unit_count_delta: 0,
          project_count_delta: 0,
          facility_count_delta: 0,
          terminal_state_ref: projection().closing_state_ref!,
          terminal_state_digest: "f".repeat(64)
        }
      }
    ],
    teacher_debrief: {
      available: true,
      learning_points: [],
      apply_to_next_round: false
    },
    student_transfer: {
      role_safe: true,
      visible_path_ids: ["path_a", "path_b"],
      explanation: "bounded",
      excluded_fields: []
    },
    transfer: {
      status: "READY",
      apply_to_next_round: false,
      source_official_state_ref: projection().closing_state_ref!
    },
    invariants: {
      official_decision_writes: false,
      official_settlement_writes: false,
      official_state_writes: false,
      apply_to_next_round: false,
      replay_writes_formal_results: false
    },
    known_limits: []
  } as M4MultipathCounterfactualResponse;
}

function service() {
  return new ExecutiveStrategyLabService({
    getRun: async () => ({
      course_id: "course_demo",
      scenario_package_id: "scenario_demo",
      parameter_set_id: "parameter_demo"
    }),
    getRound: async () => ({
      tenant_id: "tenant_demo",
      run_id: "run_demo",
      round_id: "round_demo_1",
      round_no: 1
    }),
    getW4Projection: async () => projection(),
    createM4Candidate: async () => m4Response(),
    roleWorkflow: {
      readRoleWorkflow: async () =>
        ({ assignments: [{ status: "active", user_id: "usr_student", role_key: "CEO" }] }) as never
    }
  });
}

describe("Executive Strategy Lab service", () => {
  it("composes official W4, bounded M4 alternatives, mechanisms, and transfer without writes", async () => {
    const result = await service().createCandidate(teacher, request);
    expect(result.candidate_id).toMatch(/^esl_candidate_[a-f0-9]{16}$/);
    expect(result.official_baseline.officiality).toBe("OFFICIAL");
    expect(result.paths).toHaveLength(2);
    expect(result.paths.every((path) => path.officiality === "NON_OFFICIAL")).toBe(true);
    expect(result.transfer.applies_to_next_round).toBe(false);
    expect(result.authority.formal_truth_write).toBe(false);
    expect(result.authority.settlement_write).toBe(false);
    const firstPath = result.paths[0] as ESLAlternativePath;
    expect(firstPath.finance_feasibility.model).toMatchObject({
      source_kind: "BUILT_IN_DETERMINISTIC_CALCULATOR",
      source_ref: "services/simulation-core/src/executive-capital-feasibility.ts",
      model_version_id: "esl-finance-projector"
    });
    expect(firstPath.finance_feasibility.source_refs).toContain(
      "w4_capital_action:m4-capital-action@" + "1".repeat(64)
    );
    expect(firstPath.finance_feasibility.source_refs).toContain(
      "accounting:w4-finance-evidence@" + "f".repeat(64)
    );
  });

  it("redacts decision and source provenance for the assigned Student", async () => {
    const instance = service();
    const candidate = await instance.createCandidate(teacher, request);
    const student: CurrentUser = {
      display_name: "Student",
      permissions: ["course:read"],
      roles: ["student"],
      team_id: "team_alpha",
      tenant_id: "tenant_demo",
      user_id: "usr_student"
    };
    const projection = await instance.getStudent(student, candidate.candidate_id);
    expect(projection.surface).toBe("student");
    expect(projection.student_projection?.role_key).toBe("CEO");
    expect(projection.paths.every((path) => !Object.hasOwn(path, "decision_ids"))).toBe(true);
    expect(projection.paths.every((path) => path.finance_feasibility.official === false)).toBe(
      true
    );
    expect(projection.source_refs.m4_candidate_digests).toEqual([]);
    expect(projection.official_baseline.state_ref).toBeNull();
    expect(projection.official_baseline).not.toHaveProperty("state_summary");
    expect(projection.official_baseline).not.toHaveProperty("changed_paths");
    expect(projection).not.toHaveProperty("teacher_projection");
  });

  it("keeps the original creator in the Admin audit projection", async () => {
    const instance = service();
    const candidate = await instance.createCandidate(teacher, request);
    const admin: CurrentUser = {
      display_name: "Admin",
      permissions: ["course:read"],
      roles: ["tenant_admin"],
      tenant_id: "tenant_demo",
      user_id: "usr_admin"
    };

    const projection = await instance.getAdmin(admin, candidate.candidate_id);

    expect(projection.admin_projection?.audit.generated_by).toBe("usr_teacher");
  });

  it("rejects a nonexistent exact round before W4 fallback can run", async () => {
    const failing = new ExecutiveStrategyLabService({
      getRun: async () => ({ course_id: "course_demo" }),
      getRound: async () => null,
      getW4Projection: async () => projection(),
      createM4Candidate: async () => m4Response(),
      roleWorkflow: { readRoleWorkflow: async () => ({ assignments: [] }) as never }
    });

    await expect(failing.createCandidate(teacher, request)).rejects.toEqual(
      new ExecutiveStrategyLabError("ESL_ROUND_NOT_FOUND")
    );
  });

  it("rejects a missing official baseline instead of fabricating a product candidate", async () => {
    const failing = new ExecutiveStrategyLabService({
      getRun: async () => ({ course_id: "course_demo" }),
      getRound: async () => ({
        tenant_id: "tenant_demo",
        run_id: "run_demo",
        round_id: "round_demo_1",
        round_no: 1
      }),
      getW4Projection: async () => ({
        ...projection(),
        closing_state_ref: null,
        path_evidence: {
          ...projection().path_evidence,
          official_replay_path: {
            ...projection().path_evidence.official_replay_path,
            official_outcome_id: null
          }
        }
      }),
      createM4Candidate: async () => m4Response(),
      roleWorkflow: { readRoleWorkflow: async () => ({ assignments: [] }) as never }
    });
    await expect(failing.createCandidate(teacher, request)).rejects.toEqual(
      new ExecutiveStrategyLabError("ESL_OFFICIAL_BASELINE_REQUIRED")
    );
  });
});
