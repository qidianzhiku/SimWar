import { describe, expect, it } from "vitest";
import {
  createEnterpriseStateStrategicEvolutionService,
  createInMemoryW4Repository,
  createW4DecisionPayloadDigest,
  W4EnterpriseStateError
} from "../../services/api/src/w4-enterprise-state";
import type {
  W4CanonicalStrategicDecision,
  W4EnterpriseState,
  W4ReplayInputManifest,
  W4ScopeContext,
  W4StateRef
} from "../../packages/shared-contracts/src";

const profile = {
  tenant_id: "tenant_demo",
  project_profile_id: "matched-profile",
  version: "1.0.0",
  content_digest: "a".repeat(64)
};

function scope(teamId: string, roundNo = 1, roundId = `round_${teamId}_${roundNo}`): W4ScopeContext {
  return {
    actor_id: `${teamId}-actor`,
    tenant_id: "tenant_demo",
    course_id: "course_demo",
    run_id: "w4-path-run",
    team_id: teamId,
    round_id: roundId,
    round_no: roundNo,
    role_key: "CEO",
    activity_id: "w4-enterprise-state-strategic-evolution"
  };
}

function initialState(teamId: string): W4EnterpriseState {
  const currentScope = scope(teamId);
  return {
    enterprise_state_id: `state_${teamId}_initial`,
    tenant_id: currentScope.tenant_id,
    course_id: currentScope.course_id,
    run_id: currentScope.run_id,
    team_id: currentScope.team_id,
    round_id: currentScope.round_id,
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
  };
}

function decision(teamId: string, decisionId: string, roundNo: number): W4CanonicalStrategicDecision {
  const currentScope = scope(teamId, roundNo);
  const payload = {
    project_name: `${teamId} project`,
    cost: teamId === "team_alpha" ? 100 : 200,
    cycle_rounds: 2,
    area: 1000,
    beds: 10,
    bed_mix: { standard: 10 },
    ramp: 0.5,
    lead_time_rounds: 0
  };
  return {
    decision_id: decisionId,
    tenant_id: currentScope.tenant_id,
    course_id: currentScope.course_id,
    run_id: currentScope.run_id,
    round_id: currentScope.round_id,
    round_no: currentScope.round_no,
    team_id: currentScope.team_id,
    kind: "new_project",
    version: 1,
    status: "canonical",
    payload,
    admission: {
      policy: "LEGACY_DIRECT_EXPLICIT",
      authority: "synthetic_run_creation_marker",
      canonical_decision_id: null,
      merge_commit_id: null,
      team_confirmation_id: null,
      decision_payload_digest: createW4DecisionPayloadDigest("new_project", payload)
    }
  };
}

function capitalDecision(
  teamId: string,
  decisionId: string,
  roundNo: number
): W4CanonicalStrategicDecision {
  const currentScope = scope(teamId, roundNo);
  const payload = {
    capital_action_kind: "debt" as const,
    principal: 200,
    term_rounds: 3,
    rate_or_cost_bps: 100,
    cost_source: "scenario",
    covenant_min_cash: 0,
    fees: 0,
    obligation: "term_debt" as const,
    rationale: "fund a future strategic expansion",
    reversible: false,
    dependencies: [],
    kpi_hypothesis: "preserve runway for the next project cycle",
    lead_time_rounds: 0
  };
  return {
    decision_id: decisionId,
    tenant_id: currentScope.tenant_id,
    course_id: currentScope.course_id,
    run_id: currentScope.run_id,
    round_id: currentScope.round_id,
    round_no: currentScope.round_no,
    team_id: currentScope.team_id,
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

function replayManifest(
  openingStateRef: W4StateRef,
  currentScope: W4ScopeContext,
  decisionIds: string[],
  decisionPayloadDigests: string[] = []
): W4ReplayInputManifest {
  return {
    manifest_id: `manifest_${currentScope.team_id}_${currentScope.round_no}`,
    tenant_id: currentScope.tenant_id,
    course_id: currentScope.course_id,
    run_id: currentScope.run_id,
    team_id: currentScope.team_id,
    round_id: currentScope.round_id,
    opening_state_ref: structuredClone(openingStateRef),
    decision_ids: decisionIds,
    decision_payload_bindings: decisionIds.map((decisionId) => ({
      decision_id: decisionId,
      decision_payload_digest: decisionPayloadDigests[decisionIds.indexOf(decisionId)] ?? "0".repeat(64)
    })),
    scenario_package_id: "scenario_w4_path",
    parameter_set_id: "parameters_w4_path",
    engine_id: "toy_logit_wellness_v1",
    plugin_ids: ["plugin_wellness_stub"],
    seed: 41
  };
}

describe("W4 cross-round path, matched arena, and counterfactual boundaries", () => {
  it("proves exact cross-round lineage and isolates matched ProjectProfile paths", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const alpha = scope("team_alpha");
    const beta = scope("team_beta");
    const alphaInitial = await service.createInitialState(alpha, initialState("team_alpha"));
    const betaInitial = await service.createInitialState(beta, initialState("team_beta"));
    const alphaDecision = await service.commitStrategicDecision(
      alpha,
      decision("team_alpha", "decision_alpha_1", 1)
    );
    const betaDecision = await service.commitStrategicDecision(
      beta,
      decision("team_beta", "decision_beta_1", 1)
    );
    await service.addProjectToPortfolio(alpha, {
      project_entry_id: "entry_alpha",
      initiative_id: alphaDecision.initiative.initiative_id,
      project_profile_reference: profile,
      source_assignment_id: "assignment_alpha",
      project_name: "Matched Project"
    });
    await service.addProjectToPortfolio(beta, {
      project_entry_id: "entry_beta",
      initiative_id: betaDecision.initiative.initiative_id,
      project_profile_reference: profile,
      source_assignment_id: "assignment_beta",
      project_name: "Matched Project"
    });
    const alphaOutcome = await service.settleRound(alpha, {
      opening_state_ref: alphaInitial.state_ref,
      decision_id: alphaDecision.decision.decision_id,
      replay_input_manifest: replayManifest(
        alphaInitial.state_ref,
        alpha,
        [alphaDecision.decision.decision_id],
        [alphaDecision.decision.admission.decision_payload_digest]
      )
    });
    const betaOutcome = await service.settleRound(beta, {
      opening_state_ref: betaInitial.state_ref,
      decision_id: betaDecision.decision.decision_id,
      replay_input_manifest: replayManifest(
        betaInitial.state_ref,
        beta,
        [betaDecision.decision.decision_id],
        [betaDecision.decision.admission.decision_payload_digest]
      )
    });

    const matched = await service.getMatchedArena(alpha, profile);
    expect(matched.state_isolation_proven).toBe(true);
    expect(matched.team_ids).toEqual(["team_alpha", "team_beta"]);
    expect(matched.teams.map((team) => team.project_portfolio_entry_ids)).toEqual([
      ["entry_alpha"],
      ["entry_beta"]
    ]);
    expect(matched.different_history_observed).toBe(true);
    expect(matched.teams[0]?.state_refs[0]?.team_id).toBe("team_alpha");
    expect(matched.teams[1]?.state_refs[0]?.team_id).toBe("team_beta");
    await expect(service.getMatchedArena(alpha, profile, ["team_gamma"])).rejects.toMatchObject({
      code: "W4_MATCHED_ARENA_TEAM_CONFLICT"
    });

    const nextScope = scope("team_alpha", 2, "round_team_alpha_2");
    await expect(
      service.settleRound(nextScope, {
        opening_state_ref: alphaInitial.state_ref,
        decision_id: null,
        replay_input_manifest: replayManifest(alphaInitial.state_ref, nextScope, [])
      })
    ).rejects.toMatchObject<W4EnterpriseStateError>({
      code: "W4_OPENING_STATE_LINEAGE_CONFLICT"
    });
    expect(alphaOutcome.closing_state_ref.team_id).toBe("team_alpha");
    expect(betaOutcome.closing_state_ref.team_id).toBe("team_beta");
  });

  it("forks bounded multi-round evidence with fixed runtime identity and no writes", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const firstRound = scope("team_alpha");
    const initial = await service.createInitialState(firstRound, initialState("team_alpha"));
    const firstDecision = decision("team_alpha", "decision_path_1", 1);
    const firstCompiled = await service.commitStrategicDecision(firstRound, firstDecision);
    const firstManifest = replayManifest(
      initial.state_ref,
      firstRound,
      [firstDecision.decision_id],
      [firstDecision.admission.decision_payload_digest]
    );
    const settled = await service.settleRound(firstRound, {
      opening_state_ref: initial.state_ref,
      decision_id: firstDecision.decision_id,
      replay_input_manifest: firstManifest
    });
    const secondRound = scope("team_alpha", 2, "round_team_alpha_2");
    const secondDecision = decision("team_alpha", "decision_path_2", 2);
    await service.commitStrategicDecision(secondRound, secondDecision);
    const before = repository.snapshot();
    const input = {
      source_state_ref: settled.closing_state_ref,
      source_outcome_id: settled.outcome_id,
      decision_ids: [secondDecision.decision_id],
      horizon_rounds: 2,
      scenario_package_id: firstManifest.scenario_package_id,
      parameter_set_id: firstManifest.parameter_set_id,
      engine_id: firstManifest.engine_id,
      plugin_ids: firstManifest.plugin_ids,
      seed: firstManifest.seed
    } as const;
    const evidence = await service.counterfactual(secondRound, input);
    const repeated = await service.counterfactual(secondRound, input);

    expect(evidence.counterfactual_id).toBe(repeated.counterfactual_id);
    expect(evidence.rounds).toHaveLength(2);
    expect(evidence.rounds[0]?.opening_state_ref).toEqual(settled.closing_state_ref);
    expect(evidence.rounds[1]?.opening_state_ref).toEqual(
      evidence.rounds[0]?.closing_state_ref
    );
    expect(evidence.official_decision_writes).toBe(false);
    expect(evidence.official_settlement_writes).toBe(false);
    expect(evidence.official_state_writes).toBe(false);
    expect(evidence.apply_to_next_round).toBe(false);
    expect(evidence.replay_writes_formal_results).toBe(false);
    expect(repository.snapshot()).toEqual(before);
    expect(firstCompiled.commitment.created_round_no).toBe(1);
    await expect(
      service.counterfactual(secondRound, {
        ...input,
        source_state_ref: initial.state_ref
      })
    ).rejects.toMatchObject({ code: "W4_COUNTERFACTUAL_SOURCE_LINEAGE_CONFLICT" });
  });

  it("uses a source-bound capital snapshot when live action status has advanced", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const firstRound = scope("team_alpha");
    const initial = await service.createInitialState(firstRound, initialState("team_alpha"));
    const firstDecision = decision("team_alpha", "decision_capital_source", 1);
    await service.commitStrategicDecision(firstRound, firstDecision);
    const firstManifest = replayManifest(
      initial.state_ref,
      firstRound,
      [firstDecision.decision_id],
      [firstDecision.admission.decision_payload_digest]
    );
    const settled = await service.settleRound(firstRound, {
      opening_state_ref: initial.state_ref,
      decision_id: firstDecision.decision_id,
      replay_input_manifest: firstManifest
    });

    const secondRound = scope("team_alpha", 2, "round_team_alpha_2");
    const futureCapitalDecision = capitalDecision("team_alpha", "decision_capital_future", 2);
    await service.commitStrategicDecision(secondRound, futureCapitalDecision);
    const mutated = repository.snapshot();
    const liveAction = mutated.capitalActions.find(
      (action) => action.decision_id === futureCapitalDecision.decision_id
    );
    expect(liveAction).toBeDefined();
    liveAction!.status = "completed";
    await repository.commit(mutated);

    const evidence = await service.counterfactual(secondRound, {
      source_state_ref: settled.closing_state_ref,
      source_outcome_id: settled.outcome_id,
      decision_ids: [futureCapitalDecision.decision_id],
      horizon_rounds: 1,
      scenario_package_id: firstManifest.scenario_package_id,
      parameter_set_id: firstManifest.parameter_set_id,
      engine_id: firstManifest.engine_id,
      plugin_ids: firstManifest.plugin_ids,
      seed: firstManifest.seed
    });

    expect(evidence.rounds[0]?.closing_state.capital?.debt_principal).toBe(200);
    expect(evidence.official_state_writes).toBe(false);
  });
});
