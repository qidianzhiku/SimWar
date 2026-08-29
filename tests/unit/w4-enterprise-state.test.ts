import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  createW4DecisionPayloadDigest,
  createEnterpriseStateStrategicEvolutionService,
  createInMemoryW4Repository,
  createJsonW4Repository,
  W4EnterpriseStateError
} from "../../services/api/src/w4-enterprise-state";
import { createP1Store } from "../../services/api/src/store";
import type {
  W4CanonicalStrategicDecision,
  W4OfficialOutcome,
  W4EnterpriseState,
  W4ReplayInputManifest,
  W4ScopeContext,
  W4StoreState
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
    team_confirmation_id: null,
    decision_payload_digest: createW4DecisionPayloadDigest("new_project", {
      project_name: "新区康养中心",
      cost: 300,
      cycle_rounds: 3,
      area: 12000,
      beds: 120,
      bed_mix: { standard: 72, memory_care: 36, premium: 12 },
      ramp: 0.4,
      lead_time_rounds: 2
    })
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
  roundNo = scope.round_no,
  decisionIds: string[] = []
): W4ReplayInputManifest {
  return {
    manifest_id: `manifest_${scope.run_id}_${scope.team_id}_${roundNo}`,
    tenant_id: scope.tenant_id,
    course_id: scope.course_id,
    run_id: scope.run_id,
    team_id: scope.team_id,
    round_id: roundId,
    opening_state_ref: structuredClone(openingStateRef),
    decision_ids: decisionIds,
    decision_payload_bindings: decisionIds.map((decisionId) => ({
      decision_id: decisionId,
      decision_payload_digest: createW4DecisionPayloadDigest("new_project", {
        project_name: "新区康养中心",
        cost: 300,
        cycle_rounds: 3,
        area: 12000,
        beds: 120,
        bed_mix: { standard: 72, memory_care: 36, premium: 12 },
        ramp: 0.4,
        lead_time_rounds: 2
      })
    })),
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
      replay_input_manifest: replayManifest(
        alphaOpening.state_ref,
        scope.round_id,
        scope.round_no,
        []
      )
    });
    const betaOutcome = await service.settleRound(betaScope, {
      opening_state_ref: betaOpening.state_ref,
      decision_id: null,
      replay_input_manifest: {
        ...replayManifest(betaOpening.state_ref, scope.round_id, scope.round_no, []),
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

  it("binds the admitted decision payload to every state-changing and replay artifact", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const opening = await service.createInitialState(scope, initialState());
    const compiled = await service.commitStrategicDecision(scope, newProjectDecision);

    expect(compiled.decision.admission.decision_payload_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(compiled.commitment.decision_payload_digest).toBe(
      compiled.decision.admission.decision_payload_digest
    );
    expect(compiled.effect.decision_payload_digest).toBe(
      compiled.decision.admission.decision_payload_digest
    );

    const binding = {
      decision_id: newProjectDecision.decision_id,
      decision_payload_digest: compiled.decision.admission.decision_payload_digest
    };
    const settled = await service.settleRound(scope, {
      opening_state_ref: opening.state_ref,
      decision_id: newProjectDecision.decision_id,
      replay_input_manifest: {
        ...replayManifest(opening.state_ref, scope.round_id, scope.round_no, [
          newProjectDecision.decision_id
        ]),
        decision_payload_bindings: [binding]
      }
    });
    const outcome = repository.snapshot().outcomes[0] as W4OfficialOutcome;
    expect(outcome.replay_input_manifest.decision_payload_bindings).toEqual([binding]);

    await expect(
      service.settleRound(scope, {
        opening_state_ref: opening.state_ref,
        decision_id: newProjectDecision.decision_id,
        replay_input_manifest: {
          ...outcome.replay_input_manifest,
          decision_payload_bindings: [{ ...binding, decision_payload_digest: "0".repeat(64) }]
        }
      })
    ).rejects.toMatchObject({ code: "W4_REPLAY_DECISION_BINDING_CONFLICT" });

    const replay = await service.replay(scope, settled.outcome_id);
    expect(replay.decision_payload_bindings).toEqual([binding]);
  });

  it("rejects payloads that are not admitted, stale, or exact for the requested decision", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    await service.createInitialState(scope, initialState());

    await expect(
      service.commitStrategicDecision(scope, {
        ...newProjectDecision,
        admission: {
          ...newProjectDecision.admission,
          decision_payload_digest: "0".repeat(64)
        }
      })
    ).rejects.toMatchObject({ code: "W4_DECISION_PAYLOAD_BINDING_CONFLICT" });

    await expect(
      service.commitStrategicDecision(scope, {
        ...newProjectDecision,
        round_id: "round_w4_stale",
        round_no: 2
      })
    ).rejects.toMatchObject({ code: "W4_SCOPE_CONFLICT" });

    await service.commitStrategicDecision(scope, newProjectDecision);
    await expect(
      service.commitStrategicDecision(scope, {
        ...newProjectDecision,
        payload: { ...newProjectDecision.payload, project_name: "different" }
      })
    ).rejects.toMatchObject({ code: "W4_DECISION_PAYLOAD_BINDING_CONFLICT" });
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
      const payload =
        kind === "product_line_adjustment"
          ? {
              dependencies: [],
              kpi_hypothesis: "Product line adoption improves capacity utilization",
              lead_time_rounds: 1,
              operation: "update" as const,
              product_line_id: "core-care",
              rationale: "bounded framework proof",
              reversible: true,
              target_value: `generic-${kind}`
            }
          : kind === "positioning_adjustment"
            ? {
                dependencies: [],
                kpi_hypothesis: "Positioning improves qualified demand",
                lead_time_rounds: 1,
                positioning: `generic-${kind}`,
                rationale: "bounded framework proof",
                reversible: true
              }
            : {
                dependencies: [],
                headcount_delta: 1,
                kpi_hypothesis: "Organization change improves delivery",
                lead_time_rounds: 1,
                rationale: "bounded framework proof",
                reversible: true,
                unit_name: `generic-${kind}`
              };
      const decision: W4CanonicalStrategicDecision = {
        ...newProjectDecision,
        decision_id: `decision_w4_generic_${index}`,
        kind,
        payload,
        admission: {
          ...newProjectDecision.admission,
          decision_payload_digest: createW4DecisionPayloadDigest(kind, payload)
        }
      };
      await service.createInitialState(scope, initialState());
      const compiled = await service.commitStrategicDecision(scope, decision);

      expect(compiled.commitment.kind).toBe(kind);
      expect(compiled.initiative.kind).toBe(kind);
      expect(compiled.commitment.cost).toBe(0);
      expect(compiled.effect.status).toBe("pending");
      expect(compiled.effect.effective_round_no).toBe(2);
      expect(compiled.initiative.status).toBe("in_progress");
      expect(compiled.initiative.remaining_lead_time_rounds).toBe(1);
      expect(compiled.initiative.activation_round_no).toBe(2);
      expect(compiled.effect.commitment_id).toBe(compiled.commitment.commitment_id);
      expect(repository.snapshot().outcomes).toHaveLength(0);
    }
  });

  it("rejects open-ended or unknown-key adjustment payloads", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    await service.createInitialState(scope, initialState());
    const payload = { change: "legacy-open-payload", rationale: "must be closed" };
    const decision: W4CanonicalStrategicDecision = {
      ...newProjectDecision,
      decision_id: "decision_w4_invalid_adjustment",
      kind: "positioning_adjustment",
      payload,
      admission: {
        ...newProjectDecision.admission,
        decision_payload_digest: createW4DecisionPayloadDigest("positioning_adjustment", payload)
      }
    };

    await expect(service.commitStrategicDecision(scope, decision)).rejects.toMatchObject({
      code: "W4_STRATEGIC_ACTION_INVALID"
    });
  });

  it("advances a project through the governed portfolio lifecycle without a second writer", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    await service.createInitialState(scope, initialState());
    const compiled = await service.commitStrategicDecision(scope, newProjectDecision);

    expect(compiled.initiative.project_lifecycle_status).toBe("Feasibility");
    await expect(
      service.advanceProjectLifecycle(scope, compiled.initiative.initiative_id, "Negotiation")
    ).rejects.toMatchObject({ code: "W4_INVALID_PROJECT_LIFECYCLE_TRANSITION" });

    for (const target of ["DueDiligence", "Negotiation", "TermSheet", "Operating"] as const) {
      if (target === "Operating") {
        await service.advanceProjectLifecycle(
          { ...scope, round_id: "round_w4_3", round_no: 3 },
          compiled.initiative.initiative_id,
          target
        );
      } else {
        await service.advanceProjectLifecycle(scope, compiled.initiative.initiative_id, target);
      }
    }
    const operating = repository.snapshot().initiatives[0];
    expect(operating?.project_lifecycle_status).toBe("Operating");
    expect(operating?.commitment_id).toBe(compiled.commitment.commitment_id);
    expect(repository.snapshot().states).toHaveLength(1);
  });

  it("advances lead time and activates the project only at its governed round", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const opening = await service.createInitialState(scope, initialState());
    const compiled = await service.commitStrategicDecision(scope, newProjectDecision);
    const roundOne = await service.settleRound(scope, {
      opening_state_ref: opening.state_ref,
      decision_id: newProjectDecision.decision_id,
      replay_input_manifest: replayManifest(opening.state_ref, scope.round_id, scope.round_no, [
        newProjectDecision.decision_id
      ])
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
        replay_input_manifest: replayManifest(openingTwo.state_ref, "round_w4_2", 2, [])
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
        replay_input_manifest: replayManifest(openingThree.state_ref, "round_w4_3", 3, [])
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
      replay_input_manifest: replayManifest(opening.state_ref, scope.round_id, scope.round_no, [
        newProjectDecision.decision_id
      ])
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
        replay_input_manifest: replayManifest(
          { ...opening.state_ref, round_id: "round_tampered" },
          "round_tampered",
          scope.round_no,
          []
        )
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
      replay_input_manifest: replayManifest(opening.state_ref, scope.round_id, scope.round_no, [
        newProjectDecision.decision_id
      ])
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
        replay_input_manifest: replayManifest(next.state_ref, "round_w4_2", 2, [])
      }
    );

    expect(nextSettlement.reexecuted_decision_ids).toEqual([]);
    expect(nextSettlement.persistent_effect_ids.length).toBeGreaterThan(0);
    expect(nextSettlement.closing_state_ref.parent_state_ref).toEqual(next.state_ref);
    const nextOutcome = repository
      .snapshot()
      .outcomes.find((outcome) => outcome.official_outcome_id === nextSettlement.outcome_id);
    expect(nextOutcome?.replay_input_manifest.decision_ids).toEqual([
      newProjectDecision.decision_id
    ]);
    expect(nextOutcome?.replay_input_manifest.decision_payload_bindings).toEqual([
      {
        decision_id: newProjectDecision.decision_id,
        decision_payload_digest: newProjectDecision.admission.decision_payload_digest
      }
    ]);
    const nextReplay = await service.replay(
      { ...scope, round_id: "round_w4_2", round_no: 2 },
      nextSettlement.outcome_id
    );
    expect(nextReplay.decision_ids).toEqual(
      nextReplay.decision_payload_bindings.map((item) => item.decision_id)
    );
  });

  it("normalizes legacy W4 snapshots before enforcing payload bindings", async () => {
    const store = createP1Store();
    const repository = createJsonW4Repository(store);
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const opening = await service.createInitialState(scope, initialState());
    const settledDecision = await service.commitStrategicDecision(scope, newProjectDecision);
    await service.settleRound(scope, {
      opening_state_ref: opening.state_ref,
      decision_id: newProjectDecision.decision_id,
      replay_input_manifest: replayManifest(opening.state_ref, scope.round_id, scope.round_no, [
        newProjectDecision.decision_id
      ])
    });

    const legacy = structuredClone(store.w4) as W4StoreState;
    const legacyAdmission = legacy.decisions[0]?.admission as unknown as Record<string, unknown>;
    delete legacyAdmission.decision_payload_digest;
    const legacyCommitment = legacy.commitments[0] as unknown as Record<string, unknown>;
    delete legacyCommitment.decision_payload_digest;
    const legacyEffect = legacy.effects[0] as unknown as Record<string, unknown>;
    delete legacyEffect.decision_payload_digest;
    const legacyManifest = legacy.outcomes[0]?.replay_input_manifest as unknown as Record<
      string,
      unknown
    >;
    delete legacyManifest.decision_payload_bindings;
    store.w4 = legacy;

    const migrated = createJsonW4Repository(store).snapshot();
    expect(migrated.decisions[0]?.admission.decision_payload_digest).toBe(
      settledDecision.decision.admission.decision_payload_digest
    );
    expect(migrated.commitments[0]?.decision_payload_digest).toBe(
      settledDecision.commitment.decision_payload_digest
    );
    expect(migrated.effects[0]?.decision_payload_digest).toBe(
      settledDecision.effect.decision_payload_digest
    );
    expect(migrated.outcomes[0]?.replay_input_manifest.decision_payload_bindings).toEqual([
      {
        decision_id: newProjectDecision.decision_id,
        decision_payload_digest: newProjectDecision.admission.decision_payload_digest
      }
    ]);
  });

  it("preserves legacy state bytes and digests while loading new optional fields", () => {
    const store = createP1Store();
    const legacy = initialState();
    legacy.state_digest = createHash("sha256")
      .update(JSON.stringify(legacy.state))
      .digest("hex");
    store.w4.states.push(legacy);

    const migrated = createJsonW4Repository(store).snapshot();

    expect(migrated.states[0]?.state).toEqual(legacy.state);
    expect(migrated.states[0]?.state_digest).toBe(legacy.state_digest);
    expect(migrated.states[0]?.state.capital).toBeUndefined();
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
        replay_input_manifest: replayManifest(opening.state_ref, scope.round_id, scope.round_no, [
          newProjectDecision.decision_id
        ])
      })
    ).rejects.toMatchObject({ code: "W4_ATOMIC_COMMIT_FAILED" });
    expect(repository.snapshot().outcomes).toHaveLength(0);
    expect(repository.snapshot().states).toHaveLength(1);

    const settled = await service.settleRound(scope, {
      opening_state_ref: opening.state_ref,
      decision_id: newProjectDecision.decision_id,
      replay_input_manifest: replayManifest(opening.state_ref, scope.round_id, scope.round_no, [
        newProjectDecision.decision_id
      ])
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

  it("publishes D3 path evidence without creating a second truth or replay writer", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const alphaOpening = await service.createInitialState(scope, initialState());
    await service.commitStrategicDecision(scope, newProjectDecision);
    const alphaOutcome = await service.settleRound(scope, {
      opening_state_ref: alphaOpening.state_ref,
      decision_id: newProjectDecision.decision_id,
      replay_input_manifest: replayManifest(
        alphaOpening.state_ref,
        scope.round_id,
        scope.round_no,
        [newProjectDecision.decision_id]
      )
    });

    const betaScope = { ...scope, actor_id: "usr_student_beta", team_id: "team_beta" };
    const betaOpening = await service.createInitialState(betaScope, {
      ...initialState(),
      enterprise_state_id: "state_w4_beta_0",
      team_id: "team_beta",
      state: { ...initialState().state, cash: 1200 }
    });
    const betaDecision = {
      ...newProjectDecision,
      decision_id: "decision_w4_project_beta",
      team_id: "team_beta"
    };
    await service.commitStrategicDecision(betaScope, betaDecision);
    await service.settleRound(betaScope, {
      opening_state_ref: betaOpening.state_ref,
      decision_id: betaDecision.decision_id,
      replay_input_manifest: {
        ...replayManifest(betaOpening.state_ref, scope.round_id, scope.round_no, [
          betaDecision.decision_id
        ]),
        manifest_id: "manifest_run_w4_team_beta_1",
        team_id: "team_beta",
        decision_ids: [betaDecision.decision_id]
      }
    });

    const projection = await service.getProjection({ ...scope, role_key: "teacher" });
    expect(projection.path_evidence.opening_vs_closing).toMatchObject({
      opening_state_ref: alphaOpening.state_ref,
      closing_state_ref: alphaOutcome.closing_state_ref,
      parent_state_ref: alphaOpening.state_ref
    });
    expect(projection.path_evidence.opening_vs_closing?.changed_paths).toContain("cash");
    expect(projection.path_evidence.initiative_timeline[0]?.milestones).toEqual([
      "approved",
      "construction",
      "activated"
    ]);
    expect(projection.path_evidence.official_replay_path).toMatchObject({
      official_outcome_id: alphaOutcome.outcome_id,
      replay_writes_formal_results: false
    });
    expect(projection.path_evidence.same_current_decision_different_history).toMatchObject({
      status: "proven",
      comparison_count: 1
    });
    expect(repository.snapshot().outcomes).toHaveLength(2);
    expect(repository.snapshot().states).toHaveLength(4);

    const tenantAdminProjection = await service.getProjection({
      ...scope,
      actor_id: "usr_admin",
      role_key: "tenant_admin"
    });
    expect(
      tenantAdminProjection.path_evidence.same_current_decision_different_history
    ).toMatchObject({
      status: "proven",
      comparison_count: 1
    });
  });

  it("returns the exact current closing state for a settled round projection", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const opening = await service.createInitialState(scope, initialState());
    await service.commitStrategicDecision(scope, newProjectDecision);
    const outcome = await service.settleRound(scope, {
      opening_state_ref: opening.state_ref,
      decision_id: newProjectDecision.decision_id,
      replay_input_manifest: replayManifest(opening.state_ref, scope.round_id, scope.round_no, [
        newProjectDecision.decision_id
      ])
    });
    const closing = repository
      .snapshot()
      .states.find(
        (state) => state.enterprise_state_id === outcome.closing_state_ref.enterprise_state_id
      );

    const projection = await service.getProjection({ ...scope, role_key: "teacher" });

    expect(closing).toBeDefined();
    expect(projection.closing_state_ref).toEqual(outcome.closing_state_ref);
    expect(projection.state).toEqual(closing?.state);
    expect(projection.state).not.toEqual(opening.state);
    expect(projection.path_evidence.portfolio_hierarchy).toMatchObject({
      portfolio_projects: closing?.state.portfolio.projects,
      portfolio_facilities: closing?.state.portfolio.facilities,
      operating_unit_ids: closing?.state.operating_units.map((unit) => unit.operating_unit_id)
    });
  });
});

void W4EnterpriseStateError;
