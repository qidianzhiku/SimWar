import { describe, expect, it } from "vitest";
import type {
  W4CanonicalStrategicDecision,
  W4EnterpriseState,
  W4ReplayInputManifest,
  W4StateRef,
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

const initialState = (targetScope: W4ScopeContext = scope): W4EnterpriseState => ({
  enterprise_state_id: `state-${targetScope.tenant_id}-${targetScope.team_id}-0`,
  tenant_id: targetScope.tenant_id,
  course_id: targetScope.course_id,
  run_id: targetScope.run_id,
  team_id: targetScope.team_id,
  round_id: targetScope.round_id,
  round_no: targetScope.round_no,
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

function decisionFor(
  targetScope: W4ScopeContext,
  decisionId = "decision-capital-lifecycle"
): W4CanonicalStrategicDecision {
  return {
    decision_id: decisionId,
    tenant_id: targetScope.tenant_id,
    course_id: targetScope.course_id,
    run_id: targetScope.run_id,
    round_id: targetScope.round_id,
    round_no: targetScope.round_no,
    team_id: targetScope.team_id,
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

function decision(): W4CanonicalStrategicDecision {
  return decisionFor(scope);
}

function replayManifest(
  targetScope: W4ScopeContext,
  openingStateRef: W4StateRef
): W4ReplayInputManifest {
  return {
    manifest_id: `manifest-${targetScope.run_id}-${targetScope.team_id}-${targetScope.round_no}`,
    tenant_id: targetScope.tenant_id,
    course_id: targetScope.course_id,
    run_id: targetScope.run_id,
    team_id: targetScope.team_id,
    round_id: targetScope.round_id,
    opening_state_ref: openingStateRef,
    decision_ids: [],
    decision_payload_bindings: [],
    scenario_package_id: "scenario-capital-lifecycle",
    parameter_set_id: "parameter-capital-lifecycle",
    engine_id: "toy_logit_wellness_v1",
    plugin_ids: [],
    seed: 1
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

  it("does not replay a command receipt across tenant or team scope", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const otherTenantScope = {
      ...scope,
      actor_id: "teacher-other-tenant",
      tenant_id: "tenant-other",
      run_id: "run-other-tenant",
      team_id: "team-other-tenant"
    };
    const otherTeamScope = {
      ...scope,
      actor_id: "teacher-other-team",
      team_id: "team-other"
    };
    await service.createInitialState(scope, initialState(scope));
    await service.createInitialState(otherTenantScope, initialState(otherTenantScope));
    await service.createInitialState(otherTeamScope, initialState(otherTeamScope));
    const firstDecision = await service.commitStrategicDecision(
      scope,
      decisionFor(scope, "decision-command-scope-first")
    );
    const otherTenantDecision = await service.commitStrategicDecision(
      otherTenantScope,
      decisionFor(otherTenantScope, "decision-command-scope-tenant")
    );
    const otherTeamDecision = await service.commitStrategicDecision(
      otherTeamScope,
      decisionFor(otherTeamScope, "decision-command-scope-team")
    );
    const makeInput = (lifecycleId: string, decisionId: string) => ({
      command_id: "reused-command-id",
      lifecycle_id: lifecycleId,
      decision_id: decisionId,
      instrument: "loan" as const,
      principal: payload.principal,
      cost_bps: payload.rate_or_cost_bps,
      fee: payload.fees,
      term_rounds: payload.term_rounds,
      covenant_min_cash: payload.covenant_min_cash,
      source_digest: `source-${lifecycleId}`
    });

    await service.proposeCapitalLifecycle(
      scope,
      makeInput("lifecycle-command-scope-first", firstDecision.decision.decision_id)
    );
    const otherTenantLifecycle = await service.proposeCapitalLifecycle(
      otherTenantScope,
      makeInput("lifecycle-command-scope-tenant", otherTenantDecision.decision.decision_id)
    );
    const otherTeamLifecycle = await service.proposeCapitalLifecycle(
      otherTeamScope,
      makeInput("lifecycle-command-scope-team", otherTeamDecision.decision.decision_id)
    );

    expect(otherTenantLifecycle.tenant_id).toBe(otherTenantScope.tenant_id);
    expect(otherTenantLifecycle.team_id).toBe(otherTenantScope.team_id);
    expect(otherTeamLifecycle.team_id).toBe(otherTeamScope.team_id);
    expect(repository.snapshot().capitalLifecycles).toHaveLength(3);
  });

  it("fails closed when a same-scope command id is reused with a different fingerprint", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    await service.createInitialState(scope, initialState());
    const compiled = await service.commitStrategicDecision(scope, decision());
    const firstInput = {
      command_id: "same-scope-command-conflict",
      lifecycle_id: "capital-lifecycle-command-conflict",
      decision_id: compiled.decision.decision_id,
      instrument: "loan" as const,
      principal: payload.principal,
      cost_bps: payload.rate_or_cost_bps,
      fee: payload.fees,
      term_rounds: payload.term_rounds,
      covenant_min_cash: payload.covenant_min_cash,
      source_digest: "source-fingerprint-a"
    };
    await service.proposeCapitalLifecycle(scope, firstInput);
    await expect(
      service.proposeCapitalLifecycle(scope, {
        ...firstInput,
        source_digest: "source-fingerprint-b"
      })
    ).rejects.toMatchObject({ code: "W4_DUPLICATE_COMMAND" });
  });

  it("rejects an instrument that does not match the canonical capital action kind", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    await service.createInitialState(scope, initialState());
    const compiled = await service.commitStrategicDecision(scope, decision());
    await expect(
      service.proposeCapitalLifecycle(scope, {
        command_id: "instrument-mismatch-command",
        lifecycle_id: "instrument-mismatch-lifecycle",
        decision_id: compiled.decision.decision_id,
        instrument: "ipo",
        principal: payload.principal,
        cost_bps: payload.rate_or_cost_bps,
        fee: payload.fees,
        term_rounds: payload.term_rounds,
        covenant_min_cash: payload.covenant_min_cash,
        source_digest: "instrument-mismatch-source"
      })
    ).rejects.toMatchObject({ code: "W4_CAPITAL_LIFECYCLE_DECISION_REQUIRED" });
  });

  it("accepts a later-round proposal from the authoritative predecessor closing reference", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const initial = await service.createInitialState(scope, initialState());
    const firstRound = await service.settleRound(scope, {
      opening_state_ref: initial.state_ref,
      decision_id: null,
      replay_input_manifest: replayManifest(scope, initial.state_ref)
    });
    const laterScope = { ...scope, round_id: "round-capital-lifecycle-2", round_no: 2 };
    const laterDecision = await service.commitStrategicDecision(
      laterScope,
      decisionFor(laterScope, "decision-capital-lifecycle-later")
    );
    const opening = await service.createNextRoundOpening({
      ...laterScope,
      opening_state_ref: firstRound.closing_state_ref
    });
    const proposed = await service.proposeCapitalLifecycle(laterScope, {
      command_id: "capital-command-later-round",
      lifecycle_id: "capital-lifecycle-later-round",
      decision_id: laterDecision.decision.decision_id,
      instrument: "loan",
      principal: payload.principal,
      cost_bps: payload.rate_or_cost_bps,
      fee: payload.fees,
      term_rounds: payload.term_rounds,
      covenant_min_cash: payload.covenant_min_cash,
      source_digest: "capital-source-later-round"
    });
    expect(opening.source_closing_state_ref).toEqual(firstRound.closing_state_ref);
    expect(proposed.status).toBe("PROPOSED");
    expect(proposed.round_no).toBe(2);
  });
});
