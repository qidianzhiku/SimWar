import { describe, expect, it } from "vitest";
import type {
  W4CanonicalStrategicDecision,
  W4EnterpriseState,
  W4ScopeContext
} from "../../packages/shared-contracts/src";
import {
  createEnterpriseStateStrategicEvolutionService,
  createInMemoryW4Repository,
  createW4DecisionPayloadDigest
} from "../../services/api/src/w4-enterprise-state";

const scope: W4ScopeContext = {
  actor_id: "teacher-capital-lifecycle",
  tenant_id: "tenant-capital-lifecycle",
  course_id: "course-capital-lifecycle",
  run_id: "run-capital-lifecycle",
  team_id: "team-capital-lifecycle",
  round_id: "round-capital-lifecycle-1",
  round_no: 1,
  role_key: "teacher",
  activity_id: "w4-enterprise-state-strategic-evolution"
};

const initialState = (): W4EnterpriseState => ({
  enterprise_state_id: "state-capital-lifecycle-0",
  tenant_id: scope.tenant_id,
  course_id: scope.course_id,
  run_id: scope.run_id,
  team_id: scope.team_id,
  round_id: scope.round_id,
  round_no: 1,
  version: 1,
  parent_state_ref: null,
  state_digest: "",
  state: {
    cash: 1000,
    capacity: 100,
    product_lines: ["core-care"],
    positioning: "trusted-care",
    organization: { team_size: 4 },
    operating_units: [],
    portfolio: { projects: [], facilities: [] }
  }
});

const payload = {
  rationale: "protect the bounded project ramp",
  lead_time_rounds: 1,
  reversible: true,
  dependencies: ["approved-cash-plan"],
  kpi_hypothesis: "preserve cash above the operating covenant",
  capital_action_kind: "debt" as const,
  principal: 400,
  term_rounds: 2,
  rate_or_cost_bps: 250,
  cost_source: "scenario-capital-cost-v1",
  covenant_min_cash: 500,
  fees: 10,
  obligation: "term_debt" as const
};

function decision(): W4CanonicalStrategicDecision {
  return {
    decision_id: "decision-capital-lifecycle",
    tenant_id: scope.tenant_id,
    course_id: scope.course_id,
    run_id: scope.run_id,
    round_id: scope.round_id,
    round_no: scope.round_no,
    team_id: scope.team_id,
    kind: "capital_action",
    version: 1,
    status: "canonical",
    payload,
    admission: {
      policy: "LEGACY_DIRECT_EXPLICIT",
      authority: "synthetic_run_creation_marker",
      canonical_decision_id: null,
      merge_commit_id: null,
      team_confirmation_id: null,
      decision_payload_digest: createW4DecisionPayloadDigest("capital_action", payload)
    }
  };
}

describe("R1 governed capital transaction lifecycle", () => {
  it("moves an exact-scoped proposal through approval and execution with deterministic receipt", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    await service.createInitialState(scope, initialState());
    const compiled = await service.commitStrategicDecision(scope, decision());

    const proposed = await service.proposeCapitalLifecycle(scope, {
      command_id: "capital-command-propose-1",
      lifecycle_id: "capital-lifecycle-1",
      decision_id: compiled.decision.decision_id,
      instrument: "loan",
      principal: payload.principal,
      cost_bps: payload.rate_or_cost_bps,
      fee: payload.fees,
      term_rounds: payload.term_rounds,
      covenant_min_cash: payload.covenant_min_cash,
      source_digest: "capital-source-digest-1"
    });
    expect(proposed).toMatchObject({
      lifecycle_id: "capital-lifecycle-1",
      status: "PROPOSED",
      decision_id: compiled.decision.decision_id,
      writer_authority: "SOLE_W4_ENTERPRISE_STATE_SERVICE"
    });
    expect(proposed.transition_history.map((item) => item.status)).toEqual([
      "ELIGIBLE",
      "PROPOSED"
    ]);
    expect(proposed.source_digest).toMatch(/^[a-f0-9]{64}$/);

    const retry = await service.proposeCapitalLifecycle(scope, {
      command_id: "capital-command-propose-1",
      lifecycle_id: "capital-lifecycle-1",
      decision_id: compiled.decision.decision_id,
      instrument: "loan",
      principal: payload.principal,
      cost_bps: payload.rate_or_cost_bps,
      fee: payload.fees,
      term_rounds: payload.term_rounds,
      covenant_min_cash: payload.covenant_min_cash,
      source_digest: "capital-source-digest-1"
    });
    expect(retry).toEqual(proposed);

    const approved = await service.approveCapitalLifecycle(
      scope,
      proposed.lifecycle_id,
      "capital-command-approve-1"
    );
    expect(approved.status).toBe("APPROVED");
    const executing = await service.executeCapitalLifecycle(
      scope,
      approved.lifecycle_id,
      compiled.decision.decision_id,
      "capital-command-execute-1"
    );
    expect(executing.status).toBe("EXECUTING");
    expect(repository.snapshot().states).toHaveLength(1);
    expect(repository.snapshot().outcomes).toHaveLength(0);
  });

  it("supports explicit withdrawal and default outcomes without writing official state", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    await service.createInitialState(scope, initialState());
    const compiled = await service.commitStrategicDecision(scope, decision());
    const proposed = await service.proposeCapitalLifecycle(scope, {
      command_id: "capital-command-propose-failure",
      lifecycle_id: "capital-lifecycle-failure",
      decision_id: compiled.decision.decision_id,
      instrument: "refinancing",
      principal: payload.principal,
      cost_bps: payload.rate_or_cost_bps,
      fee: payload.fees,
      term_rounds: payload.term_rounds,
      covenant_min_cash: payload.covenant_min_cash,
      source_digest: "capital-source-digest-failure"
    });

    const withdrawn = await service.withdrawCapitalLifecycle(
      scope,
      proposed.lifecycle_id,
      "capital-command-withdraw",
      "assumption changed"
    );
    expect(withdrawn.status).toBe("WITHDRAWN");
    await expect(
      service.approveCapitalLifecycle(scope, withdrawn.lifecycle_id, "late-approval")
    ).rejects.toMatchObject({ code: "W4_CAPITAL_LIFECYCLE_TRANSITION_INVALID" });

    const defaulted = await service
      .recordCapitalDefault(
        scope,
        proposed.lifecycle_id,
        "capital-command-default",
        "covenant breach"
      )
      .catch((error: unknown) => error);
    expect(defaulted).toMatchObject({ code: "W4_CAPITAL_LIFECYCLE_TRANSITION_INVALID" });
    expect(repository.snapshot().states).toHaveLength(1);
    expect(repository.snapshot().outcomes).toHaveLength(0);
  });

  it("rejects stale and cross-team lifecycle commands", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    await service.createInitialState(scope, initialState());
    const compiled = await service.commitStrategicDecision(scope, decision());
    const input = {
      command_id: "capital-command-scope",
      lifecycle_id: "capital-lifecycle-scope",
      decision_id: compiled.decision.decision_id,
      instrument: "loan" as const,
      principal: payload.principal,
      cost_bps: payload.rate_or_cost_bps,
      fee: payload.fees,
      term_rounds: payload.term_rounds,
      covenant_min_cash: payload.covenant_min_cash,
      source_digest: "capital-source-digest-scope"
    };
    await expect(
      service.proposeCapitalLifecycle({ ...scope, round_no: 2, round_id: "round-stale" }, input)
    ).rejects.toMatchObject({ code: "W4_CAPITAL_LIFECYCLE_ROUND_CONFLICT" });
    await expect(
      service.proposeCapitalLifecycle({ ...scope, team_id: "team-other" }, input)
    ).rejects.toMatchObject({ code: "W4_CAPITAL_LIFECYCLE_SCOPE_CONFLICT" });
  });
});
