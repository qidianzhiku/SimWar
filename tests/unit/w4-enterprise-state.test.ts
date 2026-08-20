import { describe, expect, it } from "vitest";
import {
  createEnterpriseStateStrategicEvolutionService,
  createInMemoryW4Repository,
  W4EnterpriseStateError
} from "../../services/api/src/w4-enterprise-state";
import type {
  W4CanonicalStrategicDecision,
  W4EnterpriseState,
  W4ReplayInputManifest,
  W4ScopeContext
} from "../../packages/shared-contracts/src";

const scope: W4ScopeContext = {
  actor_id: "usr_student",
  tenant_id: "tenant_demo",
  course_id: "course_demo",
  run_id: "run_w4",
  team_id: "team_alpha",
  round_id: "round_w4_1",
  round_no: 1,
  role_key: "CEO",
  activity_id: "w4-strategic-evolution"
};

const newProjectDecision: W4CanonicalStrategicDecision = {
  decision_id: "decision_w4_project_1",
  tenant_id: scope.tenant_id,
  course_id: scope.course_id,
  run_id: scope.run_id,
  round_id: scope.round_id,
  round_no: scope.round_no,
  team_id: scope.team_id,
  kind: "new_project",
  version: 1,
  status: "canonical",
  admission: {
    policy: "LEGACY_DIRECT_EXPLICIT",
    authority: "synthetic_run_creation_marker",
    canonical_decision_id: null,
    merge_commit_id: null,
    team_confirmation_id: null
  },
  payload: {
    project_name: "新区康养中心",
    cost: 300,
    cycle_rounds: 3,
    area: 12000,
    beds: 120,
    bed_mix: { standard: 72, memory_care: 36, premium: 12 },
    ramp: 0.4,
    lead_time_rounds: 2
  }
};

function initialState(): W4EnterpriseState {
  return {
    enterprise_state_id: "state_w4_0",
    team_id: scope.team_id,
    tenant_id: scope.tenant_id,
    course_id: scope.course_id,
    run_id: scope.run_id,
    round_id: scope.round_id,
    round_no: scope.round_no,
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

function replayManifest(
  openingStateRef: Parameters<
    ReturnType<typeof createEnterpriseStateStrategicEvolutionService>["settleRound"]
  >[1]["opening_state_ref"],
  roundId = scope.round_id,
  roundNo = scope.round_no
): W4ReplayInputManifest {
  return {
    manifest_id: `manifest_${scope.run_id}_${scope.team_id}_${roundNo}`,
    tenant_id: scope.tenant_id,
    course_id: scope.course_id,
    run_id: scope.run_id,
    team_id: scope.team_id,
    round_id: roundId,
    opening_state_ref: structuredClone(openingStateRef),
    decision_ids: [newProjectDecision.decision_id],
    scenario_package_id: "scenario_w4",
    parameter_set_id: "parameters_w4",
    engine_id: "toy_logit_wellness_v1",
    plugin_ids: ["plugin_wellness_stub"],
    seed: 42
  };
}

describe("W4 Enterprise State / Strategic Evolution authority", () => {
  it("creates an exact immutable state identity and digest", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const created = await service.createInitialState(scope, initialState());

    expect(created.state_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(created.state_ref).toEqual({
      tenant_id: scope.tenant_id,
      course_id: scope.course_id,
      run_id: scope.run_id,
      team_id: scope.team_id,
      round_id: scope.round_id,
      enterprise_state_id: "state_w4_0",
      version: 1,
      state_digest: created.state_digest
    });
    expect(created.state.parent_state_ref).toBeNull();
  });

  it("keeps state and idempotent outcomes isolated per team", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const alphaOpening = await service.createInitialState(scope, initialState());
    const betaScope = { ...scope, actor_id: "usr_student_beta", team_id: "team_beta" };
    const betaOpening = await service.createInitialState(betaScope, {
      ...initialState(),
      enterprise_state_id: "state_w4_beta_0",
      team_id: "team_beta"
    });

    const alphaOutcome = await service.settleRound(scope, {
      opening_state_ref: alphaOpening.state_ref,
      decision_id: null,
      replay_input_manifest: replayManifest(alphaOpening.state_ref)
    });
    const betaOutcome = await service.settleRound(betaScope, {
      opening_state_ref: betaOpening.state_ref,
      decision_id: null,
      replay_input_manifest: {
        ...replayManifest(betaOpening.state_ref),
        manifest_id: "manifest_run_w4_team_beta_1",
        team_id: "team_beta",
        decision_ids: []
      }
    });

    expect(betaOutcome.outcome_id).not.toBe(alphaOutcome.outcome_id);
    expect(betaOutcome.closing_state_ref.team_id).toBe("team_beta");
    expect(repository.snapshot().outcomes).toHaveLength(2);
  });

  it("compiles New Project through Commitment and governed Initiative with lead time", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    await service.createInitialState(scope, initialState());
    const compiled = await service.commitStrategicDecision(scope, newProjectDecision);

    expect(compiled.commitment.status).toBe("active");
    expect(compiled.commitment.cost).toBe(300);
    expect(compiled.initiative.status).toBe("in_progress");
    expect(compiled.initiative.remaining_lead_time_rounds).toBe(2);
    expect(compiled.initiative.project.area).toBe(12000);
    expect(compiled.initiative.project.bed_mix).toEqual({
      standard: 72,
      memory_care: 36,
      premium: 12
    });
  });

  it("proves Tier B adjustments use the same generic commitment/effect/initiative framework", async () => {
    const kinds = [
      "product_line_adjustment",
      "positioning_adjustment",
      "organization_adjustment"
    ] as const;
    for (const [index, kind] of kinds.entries()) {
      const repository = createInMemoryW4Repository();
      const service = createEnterpriseStateStrategicEvolutionService(repository);
      const decision: W4CanonicalStrategicDecision = {
        ...newProjectDecision,
        decision_id: `decision_w4_generic_${index}`,
        kind,
        payload: { change: `generic-${kind}`, rationale: "bounded framework proof" }
      };
      await service.createInitialState(scope, initialState());
      const compiled = await service.commitStrategicDecision(scope, decision);

      expect(compiled.commitment.kind).toBe(kind);
      expect(compiled.initiative.kind).toBe(kind);
      expect(compiled.effect.commitment_id).toBe(compiled.commitment.commitment_id);
      expect(repository.snapshot().outcomes).toHaveLength(0);
    }
  });

  it("advances lead time and activates the project only at its governed round", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const opening = await service.createInitialState(scope, initialState());
    const compiled = await service.commitStrategicDecision(scope, newProjectDecision);
    const roundOne = await service.settleRound(scope, {
      opening_state_ref: opening.state_ref,
      decision_id: newProjectDecision.decision_id,
      replay_input_manifest: replayManifest(opening.state_ref)
    });
    expect(repository.snapshot().initiatives[0]?.remaining_lead_time_rounds).toBe(2);

    const openingTwo = await service.createNextRoundOpening({
      ...scope,
      round_id: "round_w4_2",
      round_no: 2,
      opening_state_ref: roundOne.closing_state_ref
    });
    const roundTwo = await service.settleRound(
      { ...scope, round_id: "round_w4_2", round_no: 2 },
      {
        opening_state_ref: openingTwo.state_ref,
        decision_id: null,
        replay_input_manifest: replayManifest(openingTwo.state_ref, "round_w4_2", 2)
      }
    );
    expect(repository.snapshot().initiatives[0]?.status).toBe("in_progress");
    expect(repository.snapshot().initiatives[0]?.remaining_lead_time_rounds).toBe(1);

    const openingThree = await service.createNextRoundOpening({
      ...scope,
      round_id: "round_w4_3",
      round_no: 3,
      opening_state_ref: roundTwo.closing_state_ref
    });
    await service.settleRound(
      { ...scope, round_id: "round_w4_3", round_no: 3 },
      {
        opening_state_ref: openingThree.state_ref,
        decision_id: null,
        replay_input_manifest: replayManifest(openingThree.state_ref, "round_w4_3", 3)
      }
    );
    expect(repository.snapshot().initiatives[0]?.status).toBe("active");
    expect(repository.snapshot().effects[0]?.status).toBe("active");
    expect(compiled.initiative.activation_round_no).toBe(3);
  });

  it("rejects invalid lifecycle transitions, duplicate commands, and stale state refs", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    await service.createInitialState(scope, initialState());
    await expect(
      service.commitStrategicDecision(scope, {
        ...newProjectDecision,
        admission: undefined as never
      })
    ).rejects.toMatchObject({ code: "W4_DECISION_ADMISSION_REQUIRED" });
    await service.commitStrategicDecision(scope, newProjectDecision);

    await expect(service.commitStrategicDecision(scope, newProjectDecision)).rejects.toMatchObject({
      code: "W4_DUPLICATE_COMMAND"
    });
    await expect(
      service.advanceInitiative(scope, "initiative_missing", "completed")
    ).rejects.toMatchObject({ code: "W4_INITIATIVE_NOT_FOUND" });
    await expect(
      service.createNextRoundOpening({
        ...scope,
        round_id: "round_w4_2",
        round_no: 2,
        opening_state_ref: {
          tenant_id: scope.tenant_id,
          course_id: scope.course_id,
          run_id: scope.run_id,
          team_id: scope.team_id,
          round_id: scope.round_id,
          enterprise_state_id: "state_missing",
          version: 1,
          state_digest: "0".repeat(64)
        }
      })
    ).rejects.toMatchObject({ code: "W4_STATE_REF_CONFLICT" });
  });

  it("rejects a non-sequential next-round context even when the closing ref is valid", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const opening = await service.createInitialState(scope, initialState());
    await service.commitStrategicDecision(scope, newProjectDecision);
    const settled = await service.settleRound(scope, {
      opening_state_ref: opening.state_ref,
      decision_id: newProjectDecision.decision_id,
      replay_input_manifest: replayManifest(opening.state_ref)
    });

    await expect(
      service.createNextRoundOpening({
        ...scope,
        round_id: "round_w4_99",
        round_no: 99,
        opening_state_ref: settled.closing_state_ref
      })
    ).rejects.toMatchObject({ code: "W4_ROUND_SCOPE_CONFLICT" });
  });

  it("rejects a state reference whose digest matches but whose identity fields were tampered", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const opening = await service.createInitialState(scope, initialState());

    await expect(
      service.settleRound(scope, {
        opening_state_ref: { ...opening.state_ref, round_id: "round_tampered" },
        decision_id: null,
        replay_input_manifest: replayManifest({
          ...opening.state_ref,
          round_id: "round_tampered"
        })
      })
    ).rejects.toMatchObject({ code: "W4_STATE_REF_CONFLICT" });
  });

  it("provides typed policy seams without an instant enterprise-state or outcome write", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    await service.createInitialState(scope, initialState());
    const kinds = [
      "merger_acquisition",
      "asset_backed_securitization",
      "initial_public_offering",
      "project_sale",
      "project_closure"
    ] as const;

    for (const [index, kind] of kinds.entries()) {
      const seam = await service.createPolicySeam(scope, {
        policy_seam_id: `policy_seam_${index}`,
        kind,
        payload: { status: "requires-policy-review" }
      });
      expect(seam.kind).toBe(kind);
      expect(seam.status).toBe("proposed");
      expect(seam.requires_policy_approval).toBe(true);
      expect(seam.may_write_enterprise_state).toBe(false);
      expect(seam.may_write_official_outcome).toBe(false);
    }

    await expect(service.advancePolicySeam(scope, "policy_seam_0", "closed")).rejects.toMatchObject(
      {
        code: "W4_INVALID_POLICY_SEAM_TRANSITION"
      }
    );
    await service.advancePolicySeam(scope, "policy_seam_0", "under_review");
    await service.advancePolicySeam(scope, "policy_seam_0", "approved");
    const closed = await service.advancePolicySeam(scope, "policy_seam_0", "closed");
    expect(closed.status).toBe("closed");
    expect(repository.snapshot().states).toHaveLength(1);
    expect(repository.snapshot().outcomes).toHaveLength(0);
  });

  it("uses persistent effects without re-executing the historical decision", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const opening = await service.createInitialState(scope, initialState());
    await service.commitStrategicDecision(scope, newProjectDecision);

    const settled = await service.settleRound(scope, {
      opening_state_ref: opening.state_ref,
      decision_id: newProjectDecision.decision_id,
      replay_input_manifest: replayManifest(opening.state_ref)
    });
    const next = await service.createNextRoundOpening({
      ...scope,
      round_id: "round_w4_2",
      round_no: 2,
      opening_state_ref: settled.closing_state_ref
    });
    const nextSettlement = await service.settleRound(
      { ...scope, round_id: "round_w4_2", round_no: 2 },
      {
        opening_state_ref: next.state_ref,
        decision_id: null,
        replay_input_manifest: replayManifest(next.state_ref, "round_w4_2", 2)
      }
    );

    expect(nextSettlement.reexecuted_decision_ids).toEqual([]);
    expect(nextSettlement.persistent_effect_ids.length).toBeGreaterThan(0);
    expect(nextSettlement.closing_state_ref.parent_state_ref).toEqual(next.state_ref);
  });

  it("commits Official Outcome plus Closing State atomically and never applies Shadow Replay", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const opening = await service.createInitialState(scope, initialState());
    await service.commitStrategicDecision(scope, newProjectDecision);

    repository.failNextCommit = true;
    await expect(
      service.settleRound(scope, {
        opening_state_ref: opening.state_ref,
        decision_id: newProjectDecision.decision_id,
        replay_input_manifest: replayManifest(opening.state_ref)
      })
    ).rejects.toMatchObject({ code: "W4_ATOMIC_COMMIT_FAILED" });
    expect(repository.snapshot().outcomes).toHaveLength(0);
    expect(repository.snapshot().states).toHaveLength(1);

    const settled = await service.settleRound(scope, {
      opening_state_ref: opening.state_ref,
      decision_id: newProjectDecision.decision_id,
      replay_input_manifest: replayManifest(opening.state_ref)
    });
    expect(repository.snapshot().outcomes[0]?.replay_input_manifest).toMatchObject({
      manifest_id: `manifest_${scope.run_id}_${scope.team_id}_1`,
      decision_ids: [newProjectDecision.decision_id],
      engine_id: "toy_logit_wellness_v1"
    });
    const before = repository.snapshot();
    const shadow = await service.shadowReplay(scope, settled.outcome_id);
    expect(shadow.applied).toBe(false);
    expect(repository.snapshot()).toEqual(before);

    const replay = await service.replay(scope, settled.outcome_id);
    expect(replay.replay_writes_formal_results).toBe(false);
    expect(replay.path_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.snapshot().replayEvidence).toHaveLength(1);
    expect(repository.snapshot().outcomes).toEqual(before.outcomes);
  });
});

void W4EnterpriseStateError;
