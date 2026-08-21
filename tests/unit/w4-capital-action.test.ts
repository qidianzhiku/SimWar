import { describe, expect, it } from "vitest";
import type {
  W4CanonicalStrategicDecision,
  W4EnterpriseState,
  W4ReplayInputManifest,
  W4ScopeContext
} from "../../packages/shared-contracts/src";
import {
  createEnterpriseStateStrategicEvolutionService,
  createInMemoryW4Repository,
  createW4DecisionPayloadDigest
} from "../../services/api/src/w4-enterprise-state";

const scope: W4ScopeContext = {
  actor_id: "teacher-capital",
  tenant_id: "tenant-capital",
  course_id: "course-capital",
  run_id: "run-capital",
  team_id: "team-capital",
  round_id: "round-capital-1",
  round_no: 1,
  role_key: "teacher",
  activity_id: "w4-enterprise-state-strategic-evolution"
};

const initialState = (): W4EnterpriseState => ({
  enterprise_state_id: "state-capital-0",
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

const capitalPayload = {
  rationale: "fund a governed working-capital buffer",
  lead_time_rounds: 1,
  reversible: false,
  dependencies: ["approved-cash-plan"],
  kpi_hypothesis: "protect liquidity through the next project ramp",
  capital_action_kind: "debt" as const,
  principal: 500,
  term_rounds: 2,
  rate_or_cost_bps: 100,
  cost_source: "scenario-capital-cost-v1",
  covenant_min_cash: 500,
  fees: 10,
  obligation: "term_debt" as const
};

function decision(
  kind: "capital_action" | "initial_public_offering" = "capital_action"
): W4CanonicalStrategicDecision {
  const payload =
    kind === "capital_action"
      ? capitalPayload
      : {
          ...capitalPayload,
          capital_action_kind: "initial_public_offering" as const,
          obligation: "equity" as const,
          policy_seam_id: "missing-policy-seam"
        };
  return {
    decision_id: `decision-${kind}`,
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

function manifest(
  openingStateRef: W4ReplayInputManifest["opening_state_ref"],
  roundId: string,
  roundNo: number,
  decisionId?: string,
  decisionPayloadDigest?: string
): W4ReplayInputManifest {
  return {
    manifest_id: `manifest-capital-${roundNo}`,
    tenant_id: scope.tenant_id,
    course_id: scope.course_id,
    run_id: scope.run_id,
    team_id: scope.team_id,
    round_id: roundId,
    opening_state_ref: structuredClone(openingStateRef),
    decision_ids: decisionId ? [decisionId] : [],
    decision_payload_bindings:
      decisionId && decisionPayloadDigest
        ? [{ decision_id: decisionId, decision_payload_digest: decisionPayloadDigest }]
        : [],
    scenario_package_id: "scenario-capital",
    parameter_set_id: "parameters-capital",
    engine_id: "engine-capital",
    plugin_ids: [],
    seed: 1
  };
}

describe("W4 governed capital actions", () => {
  it("applies debt fees, delayed proceeds, interest, and maturity across rounds", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const opening = await service.createInitialState(scope, initialState());
    const compiled = await service.commitStrategicDecision(scope, decision());

    expect(compiled.capital_action).toMatchObject({
      kind: "debt",
      status: "pending",
      principal: 500,
      effective_round_no: 2,
      maturity_round_no: 4
    });
    expect(compiled.commitment.cost).toBe(10);

    const roundOne = await service.settleRound(scope, {
      opening_state_ref: opening.state_ref,
      decision_id: compiled.decision.decision_id,
      replay_input_manifest: manifest(
        opening.state_ref,
        scope.round_id,
        1,
        compiled.decision.decision_id,
        compiled.decision.admission.decision_payload_digest
      )
    });
    const roundOneState = repository
      .snapshot()
      .states.find(
        (state) => state.enterprise_state_id === roundOne.closing_state_ref.enterprise_state_id
      );
    expect(roundOneState?.state.cash).toBe(990);
    expect(roundOneState?.state.capital?.fees_paid).toBe(10);
    expect(roundOneState?.state.capital?.debt_principal).toBe(0);

    const roundTwoScope = { ...scope, round_id: "round-capital-2", round_no: 2 };
    const roundTwoOpening = await service.createNextRoundOpening({
      ...roundTwoScope,
      opening_state_ref: roundOne.closing_state_ref
    });
    const roundTwo = await service.settleRound(roundTwoScope, {
      opening_state_ref: roundTwoOpening.state_ref,
      decision_id: null,
      replay_input_manifest: manifest(roundTwoOpening.state_ref, roundTwoScope.round_id, 2)
    });
    const roundTwoState = repository
      .snapshot()
      .states.find(
        (state) => state.enterprise_state_id === roundTwo.closing_state_ref.enterprise_state_id
      );
    expect(roundTwoState?.state.cash).toBe(1490);
    expect(roundTwoState?.state.capital?.debt_principal).toBe(500);

    const roundThreeScope = { ...scope, round_id: "round-capital-3", round_no: 3 };
    const roundThreeOpening = await service.createNextRoundOpening({
      ...roundThreeScope,
      opening_state_ref: roundTwo.closing_state_ref
    });
    const roundThree = await service.settleRound(roundThreeScope, {
      opening_state_ref: roundThreeOpening.state_ref,
      decision_id: null,
      replay_input_manifest: manifest(roundThreeOpening.state_ref, roundThreeScope.round_id, 3)
    });
    const roundThreeState = repository
      .snapshot()
      .states.find(
        (state) => state.enterprise_state_id === roundThree.closing_state_ref.enterprise_state_id
      );
    expect(roundThreeState?.state.cash).toBe(1485);
    expect(roundThreeState?.state.capital?.interest_paid).toBe(5);

    const roundFourScope = { ...scope, round_id: "round-capital-4", round_no: 4 };
    const roundFourOpening = await service.createNextRoundOpening({
      ...roundFourScope,
      opening_state_ref: roundThree.closing_state_ref
    });
    const roundFour = await service.settleRound(roundFourScope, {
      opening_state_ref: roundFourOpening.state_ref,
      decision_id: null,
      replay_input_manifest: manifest(roundFourOpening.state_ref, roundFourScope.round_id, 4)
    });
    const roundFourState = repository
      .snapshot()
      .states.find(
        (state) => state.enterprise_state_id === roundFour.closing_state_ref.enterprise_state_id
      );
    expect(roundFourState?.state.cash).toBe(980);
    expect(roundFourState?.state.capital?.debt_principal).toBe(0);
    expect(repository.snapshot().capitalActions[0]?.status).toBe("completed");
    expect(
      repository.snapshot().outcomes[0]?.replay_input_manifest.capital_action_snapshot
    ).toHaveLength(1);
  });

  it("fails closed for IPO without an approved policy seam and never creates proceeds", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    await service.createInitialState(scope, initialState());
    const compiled = await service.commitStrategicDecision(
      scope,
      decision("initial_public_offering")
    );

    expect(compiled.capital_action).toMatchObject({
      kind: "initial_public_offering",
      status: "blocked",
      blocked_reason: "W4_CAPITAL_POLICY_REQUIRED"
    });
    expect(compiled.commitment.cost).toBe(0);
    const action = repository.snapshot().capitalActions[0];
    expect(action?.status).toBe("blocked");
  });
});
