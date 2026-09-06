import { describe, expect, it, vi } from "vitest";
import type {
  M4MultipathCounterfactualInput,
  M4MultipathCounterfactualResponse,
  W4ScopeContext,
  W4StrategicPortfolioProjection
} from "@simwar/shared-contracts";
import { isStrategicPortfolioDivergenceRequest } from "@simwar/shared-contracts";
import {
  StrategicPortfolioDivergenceService,
  StrategicPortfolioDivergenceServiceError
} from "../../services/api/src/strategic-portfolio-divergence-service";

const scope = {
  tenant_id: "tenant_demo",
  course_id: "course_demo",
  run_id: "run_demo",
  team_id: "team_demo",
  round_id: "round_demo",
  round_no: 2
} as const;

const baseline: W4StrategicPortfolioProjection = {
  schema_version: "w4-strategic-portfolio.v1",
  candidate_status: "DERIVED",
  portfolio_id: "portfolio_demo",
  portfolio_ref: { ...scope, portfolio_digest: "portfolio_digest_1" },
  exact_scope: scope,
  members: [],
  allocations: [],
  constraints: {
    status: "WITHIN_LIMIT",
    cash_available: 1_000,
    covenant_min_cash: 100,
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
  known_limits: ["fixture baseline"]
};

function m4Response(seed = 7): M4MultipathCounterfactualResponse {
  const stateRef = {
    tenant_id: scope.tenant_id,
    course_id: scope.course_id,
    run_id: scope.run_id,
    team_id: scope.team_id,
    round_id: scope.round_id,
    enterprise_state_id: "state_source",
    version: 1,
    state_digest: "state_digest"
  };
  const path = (pathId: string) => ({
    path_id: pathId,
    label: pathId,
    officiality: "NON_OFFICIAL" as const,
    decision_ids: [`decision_${pathId}`],
    decision_payload_bindings: [],
    path_digest: `${pathId}_digest`,
    rounds: [],
    mechanism_differential: {
      changed_paths: [`changed_${pathId}`],
      changed_path_count: 1,
      interpretation: "DETERMINISTIC_STATE_TRANSITION_DIFFERENTIAL" as const
    },
    outcome_differential: {
      baseline: "OFFICIAL_SOURCE_CLOSING_STATE" as const,
      cash_delta: seed * -1,
      capacity_delta: seed,
      product_line_count_delta: 0,
      operating_unit_count_delta: 0,
      project_count_delta: 1,
      facility_count_delta: 0,
      terminal_state_ref: stateRef,
      terminal_state_digest: `${pathId}_terminal_digest`
    }
  });
  return {
    schema_version: "m4-multipath-counterfactual-transfer.v1",
    runtime_authority: "JSON_INTERNAL_ONLY",
    visibility: "teacher_safe",
    exact_binding: {
      source_state_ref: stateRef,
      source_outcome_id: "outcome_source",
      horizon_rounds: 1,
      scenario_package_id: "scenario_demo",
      parameter_set_id: "parameter_demo",
      engine_id: "engine_demo",
      plugin_ids: ["plugin_demo"],
      seed
    },
    official_path: {
      officiality: "OFFICIAL",
      unchanged: true,
      outcome_id: "outcome_source",
      opening_state_ref: stateRef,
      closing_state_ref: stateRef,
      decision_ids: [],
      replay_writes_formal_results: false
    },
    lineage: {
      source_round_id: scope.round_id,
      source_section_ids: [],
      preserved_dissent_role_keys: [],
      resolution_status: "NOT_PRESENT",
      history_event_types: [],
      historical_decision_reentry_blocked: true
    },
    paths: [path("path_a"), path("path_b")],
    teacher_debrief: { available: true, learning_points: [], apply_to_next_round: false },
    student_transfer: {
      role_safe: true,
      visible_path_ids: ["path_a", "path_b"],
      explanation: "bounded",
      excluded_fields: ["raw_state"]
    },
    transfer: {
      status: "READY",
      apply_to_next_round: false,
      source_official_state_ref: stateRef
    },
    invariants: {
      official_decision_writes: false,
      official_settlement_writes: false,
      official_state_writes: false,
      apply_to_next_round: false,
      replay_writes_formal_results: false
    },
    known_limits: ["fixture response"]
  };
}

function request(seed = 7) {
  return {
    discriminator: "strategic_portfolio_divergence_request" as const,
    exact_binding: { ...scope },
    counterfactual: {
      source_state_ref: {
        tenant_id: scope.tenant_id,
        course_id: scope.course_id,
        run_id: scope.run_id,
        team_id: scope.team_id,
        round_id: scope.round_id,
        enterprise_state_id: "state_source",
        version: 1,
        state_digest: "state_digest"
      },
      source_outcome_id: "outcome_source",
      paths: [
        { path_id: "path_a", label: "path_a", decision_ids: ["decision_a"] },
        { path_id: "path_b", label: "path_b", decision_ids: ["decision_b"] }
      ],
      horizon_rounds: 1,
      scenario_package_id: "scenario_demo",
      parameter_set_id: "parameter_demo",
      engine_id: "engine_demo",
      plugin_ids: ["plugin_demo"],
      seed
    },
    expected_portfolio_state_digest: "portfolio_digest_1",
    divergence_policy_digest: "policy_digest_1",
    idempotency_key: "request_1"
  };
}

function arrange() {
  const getPortfolio = vi.fn(async (_scope: W4ScopeContext) => structuredClone(baseline));
  const createM4Candidate = vi.fn(
    async (_scope: W4ScopeContext, input: M4MultipathCounterfactualInput, _surface: "teacher") =>
      m4Response(input.seed)
  );
  const service = new StrategicPortfolioDivergenceService({ getPortfolio, createM4Candidate });
  return { service, getPortfolio, createM4Candidate };
}

describe("SP-O3 divergence service", () => {
  it("reuses an exact tenant/course/run request and rejects a conflicting retry", async () => {
    const arranged = arrange();
    const actor = { user_id: "teacher_1", tenant_id: scope.tenant_id, roles: ["teacher"] };
    const first = await arranged.service.createCandidate(actor, request());
    const repeated = await arranged.service.createCandidate(actor, request());

    expect(repeated).toEqual(first);
    expect(arranged.getPortfolio).toHaveBeenCalledTimes(1);
    expect(arranged.createM4Candidate).toHaveBeenCalledTimes(1);
    await expect(
      arranged.service.createCandidate(actor, request(8))
    ).rejects.toMatchObject<StrategicPortfolioDivergenceServiceError>({
      code: "SP_O3_IDEMPOTENCY_CONFLICT"
    });
  });

  it("returns detailed admin data but an allowlisted student reflection", async () => {
    const arranged = arrange();
    const teacher = { user_id: "teacher_1", tenant_id: scope.tenant_id, roles: ["teacher"] };
    const candidate = await arranged.service.createCandidate(teacher, request());
    const admin = await arranged.service.getAdmin(
      { user_id: "admin_1", tenant_id: scope.tenant_id, roles: ["tenant_admin"] },
      candidate.candidate_id
    );
    const student = await arranged.service.getStudent(
      {
        user_id: "student_1",
        tenant_id: scope.tenant_id,
        team_id: scope.team_id,
        roles: ["student"]
      },
      candidate.candidate_id
    );

    expect(admin.surface).toBe("admin");
    expect(admin.envelope.exact_portfolio.portfolio_digest).toBe("portfolio_digest_1");
    expect(student.role_safe).toBe(true);
    expect(student.reflection.path_count).toBe(2);
    expect(JSON.stringify(student)).not.toContain("portfolio_digest_1");
    expect(JSON.stringify(student)).not.toContain("path_a");
    await expect(
      arranged.service.getStudent(
        {
          user_id: "student_2",
          tenant_id: "tenant_other",
          team_id: scope.team_id,
          roles: ["student"]
        },
        candidate.candidate_id
      )
    ).rejects.toMatchObject<StrategicPortfolioDivergenceServiceError>({ code: "SP_O3_NOT_FOUND" });
  });

  it("rejects forged round identity and mismatched source-state scope", async () => {
    const arranged = arrange();
    const actor = { user_id: "teacher_1", tenant_id: scope.tenant_id, roles: ["teacher"] };

    const forgedRound = request();
    forgedRound.exact_binding = { ...forgedRound.exact_binding, round_id: "round_forged" };
    await expect(
      arranged.service.createCandidate(actor, forgedRound)
    ).rejects.toMatchObject<StrategicPortfolioDivergenceServiceError>({
      code: "SP_O3_INPUT_SCOPE_CONFLICT"
    });

    const mismatchedSource = request();
    mismatchedSource.counterfactual.source_state_ref = {
      ...mismatchedSource.counterfactual.source_state_ref,
      round_id: "round_forged"
    };
    await expect(
      arranged.service.createCandidate(actor, mismatchedSource)
    ).rejects.toMatchObject<StrategicPortfolioDivergenceServiceError>({
      code: "SP_O3_INPUT_SCOPE_CONFLICT"
    });
  });

  it("translates a stale portfolio digest into the service rebase error", async () => {
    const arranged = arrange();
    const actor = { user_id: "teacher_1", tenant_id: scope.tenant_id, roles: ["teacher"] };
    const stale = request();
    stale.expected_portfolio_state_digest = "portfolio_digest_stale";

    const rejection = arranged.service.createCandidate(actor, stale);
    await expect(rejection).rejects.toBeInstanceOf(StrategicPortfolioDivergenceServiceError);
    await expect(rejection).rejects.toMatchObject({ code: "SP_O3_REBASE_REQUIRED" });
  });

  it("rejects malformed counterfactual path entries at the request boundary", () => {
    const malformed = request() as unknown as Record<string, unknown>;
    const counterfactual = malformed.counterfactual as Record<string, unknown>;
    counterfactual.paths = [{}, {}];

    expect(isStrategicPortfolioDivergenceRequest(malformed)).toBe(false);
  });
});
