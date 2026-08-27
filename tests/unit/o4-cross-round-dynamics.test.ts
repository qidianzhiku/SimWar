import { describe, expect, it } from "vitest";
import {
  buildO4CrossRoundDynamicsCandidate,
  O4CrossRoundDynamicsError
} from "@simwar/simulation-core";
import type {
  W4CanonicalStrategicDecision,
  W4EnterpriseState,
  W4OfficialOutcome,
  W4StateRef
} from "@simwar/shared-contracts";

const scope = {
  tenant_id: "tenant_o4",
  course_id: "course_o4",
  run_id: "run_o4"
} as const;

function state(
  teamId: string,
  roundNo: number,
  cash: number,
  capacity: number,
  projects: string[],
  positioning: string
): W4EnterpriseState {
  return {
    enterprise_state_id: `state-${teamId}-${roundNo}`,
    ...scope,
    team_id: teamId,
    round_id: `round-${roundNo}`,
    round_no: roundNo,
    version: 1,
    parent_state_ref: null,
    state_digest: `${teamId}${roundNo}`.padEnd(64, "0"),
    state: {
      cash,
      capacity,
      product_lines: ["care"],
      positioning,
      organization: { headcount: capacity },
      operating_units: [
        {
          operating_unit_id: `unit-${teamId}`,
          name: `${teamId} unit`,
          status: "active"
        }
      ],
      portfolio: { projects, facilities: [] }
    }
  };
}

function stateRef(value: W4EnterpriseState): W4StateRef {
  return {
    tenant_id: value.tenant_id,
    course_id: value.course_id,
    run_id: value.run_id,
    team_id: value.team_id,
    round_id: value.round_id,
    enterprise_state_id: value.enterprise_state_id,
    version: value.version,
    state_digest: value.state_digest,
    parent_state_ref: value.parent_state_ref
  };
}

function officialOutcome(
  opening: W4EnterpriseState,
  closing: W4EnterpriseState
): W4OfficialOutcome {
  return {
    official_outcome_id: `outcome-${closing.team_id}-${closing.round_no}`,
    ...scope,
    team_id: closing.team_id,
    round_id: closing.round_id,
    round_no: closing.round_no,
    opening_state_ref: stateRef(opening),
    closing_state_ref: stateRef(closing),
    commitment_ids: [],
    persistent_effect_ids: [],
    reexecuted_decision_ids: [],
    replay_input_manifest: {} as W4OfficialOutcome["replay_input_manifest"],
    settlement_digest: `digest-${closing.team_id}-${closing.round_no}`,
    status: "official"
  };
}

function decision(
  teamId: string,
  payloadDigest = "a".repeat(64),
  suffix = "3"
): W4CanonicalStrategicDecision {
  return {
    decision_id: `decision-${teamId}-${suffix}`,
    ...scope,
    team_id: teamId,
    round_id: "round-3",
    round_no: 3,
    kind: "positioning_adjustment",
    version: 1,
    status: "canonical",
    payload: { positioning: "premium" },
    admission: {
      policy: "canonical_decision_required",
      authority: "team_confirmation",
      canonical_decision_id: `canonical-${teamId}-${suffix}`,
      merge_commit_id: `merge-${teamId}-${suffix}`,
      team_confirmation_id: `confirmation-${teamId}-${suffix}`,
      decision_payload_digest: payloadDigest
    }
  };
}

describe("O4 cross-round dynamics differential", () => {
  it("proves a deterministic same-current-decision/different-history differential", () => {
    const states = [
      state("team_alpha", 1, 1000, 10, ["base"], "value"),
      state("team_alpha", 2, 900, 12, ["base", "alpha-expansion"], "value"),
      state("team_alpha", 3, 850, 14, ["base", "alpha-expansion"], "premium"),
      state("team_beta", 1, 1000, 10, ["base"], "value"),
      state("team_beta", 2, 980, 10, ["base"], "value"),
      state("team_beta", 3, 940, 10, ["base"], "premium")
    ];
    const decisions = [decision("team_alpha"), decision("team_beta")];
    const input = { ...scope, states, outcomes: [] as W4OfficialOutcome[], decisions };
    const before = structuredClone(input);

    const candidate = buildO4CrossRoundDynamicsCandidate(input);
    const repeated = buildO4CrossRoundDynamicsCandidate(input);

    expect(candidate).toEqual(repeated);
    expect(candidate.status).toBe("PROVEN");
    expect(candidate.horizon_rounds).toBe(3);
    expect(candidate.source_team_count).toBe(2);
    expect(candidate.source_state_ref_count).toBe(6);
    expect(candidate.team_paths.map((path) => path.team_id)).toEqual([
      "team_alpha",
      "team_beta"
    ]);
    expect(candidate.pair_differentials).toMatchObject([
      {
        current_decision_match: "MATCHED",
        history_different: true,
        outcome_differential: {
          cash: -90,
          capacity: 4,
          portfolio_count: 1,
          operating_unit_count: 0
        }
      }
    ]);
    expect(input).toEqual(before);
  });

  it("fails closed when two teams do not each have three consecutive rounds", () => {
    expect(() =>
      buildO4CrossRoundDynamicsCandidate({
        ...scope,
        states: [
          state("team_alpha", 1, 1000, 10, ["base"], "value"),
          state("team_alpha", 2, 900, 10, ["base"], "value"),
          state("team_alpha", 3, 850, 10, ["base"], "premium"),
          state("team_beta", 1, 1000, 10, ["base"], "value"),
          state("team_beta", 3, 900, 10, ["base"], "premium")
        ],
        outcomes: [],
        decisions: []
      })
    ).toThrowError(new O4CrossRoundDynamicsError("O4_INSUFFICIENT_HISTORY"));
  });

  it("rejects duplicate state records for the same team and round", () => {
    const duplicate = state("team_alpha", 1, 1000, 10, ["base"], "value");
    expect(() =>
      buildO4CrossRoundDynamicsCandidate({
        ...scope,
        states: [duplicate, structuredClone(duplicate)],
        outcomes: [],
        decisions: []
      })
    ).toThrowError(new O4CrossRoundDynamicsError("O4_DUPLICATE_STATE"));
  });

  it("resolves the official closing state when an opening state shares its round number", () => {
    const alphaOpening = state("team_alpha", 1, 1000, 10, ["base"], "value");
    const alphaClosing = {
      ...state("team_alpha", 1, 950, 11, ["base"], "value"),
      enterprise_state_id: "state-team_alpha-1-closing",
      version: 2,
      parent_state_ref: stateRef(alphaOpening)
    };
    const betaOpening = state("team_beta", 1, 1000, 10, ["base"], "value");
    const betaClosing = {
      ...state("team_beta", 1, 975, 10, ["base"], "value"),
      enterprise_state_id: "state-team_beta-1-closing",
      version: 2,
      parent_state_ref: stateRef(betaOpening)
    };
    const candidate = buildO4CrossRoundDynamicsCandidate({
      ...scope,
      states: [
        alphaOpening,
        alphaClosing,
        state("team_alpha", 2, 900, 12, ["base", "alpha-expansion"], "value"),
        state("team_alpha", 3, 850, 14, ["base", "alpha-expansion"], "premium"),
        betaOpening,
        betaClosing,
        state("team_beta", 2, 980, 10, ["base"], "value"),
        state("team_beta", 3, 940, 10, ["base"], "premium")
      ],
      outcomes: [
        officialOutcome(alphaOpening, alphaClosing),
        officialOutcome(betaOpening, betaClosing)
      ],
      decisions: [decision("team_alpha"), decision("team_beta")]
    });

    expect(candidate.team_paths[0]?.rounds[0]?.closing_state_ref?.enterprise_state_id).toBe(
      alphaClosing.enterprise_state_id
    );
    expect(candidate.team_paths[0]?.rounds[0]?.opening_state_ref?.enterprise_state_id).toBe(
      alphaOpening.enterprise_state_id
    );
  });

  it("does not treat team identity as a historical differential", () => {
    const states = [
      state("team_alpha", 1, 1000, 10, ["base"], "value"),
      state("team_alpha", 2, 900, 12, ["base", "expansion"], "value"),
      state("team_alpha", 3, 850, 14, ["base", "expansion"], "premium"),
      state("team_beta", 1, 1000, 10, ["base"], "value"),
      state("team_beta", 2, 900, 12, ["base", "expansion"], "value"),
      state("team_beta", 3, 850, 14, ["base", "expansion"], "premium")
    ];
    const candidate = buildO4CrossRoundDynamicsCandidate({
      ...scope,
      states,
      outcomes: [],
      decisions: [decision("team_alpha"), decision("team_beta")]
    });

    expect(candidate.team_paths[0]?.history_digest).toBe(candidate.team_paths[1]?.history_digest);
    expect(candidate.pair_differentials[0]?.history_different).toBe(false);
    expect(candidate.status).toBe("OBSERVED_DIFFERENTIAL");
  });

  it("compares the complete deterministic current-round decision set", () => {
    const states = [
      state("team_alpha", 1, 1000, 10, ["base"], "value"),
      state("team_alpha", 2, 900, 12, ["base", "expansion"], "value"),
      state("team_alpha", 3, 850, 14, ["base", "expansion"], "premium"),
      state("team_beta", 1, 1000, 10, ["base"], "value"),
      state("team_beta", 2, 980, 10, ["base"], "value"),
      state("team_beta", 3, 940, 10, ["base"], "premium")
    ];
    const candidate = buildO4CrossRoundDynamicsCandidate({
      ...scope,
      states,
      outcomes: [],
      decisions: [
        decision("team_alpha", "a".repeat(64), "first"),
        decision("team_alpha", "b".repeat(64), "second"),
        decision("team_beta", "a".repeat(64), "first"),
        decision("team_beta", "c".repeat(64), "second")
      ]
    });

    expect(candidate.pair_differentials[0]?.current_decision_match).toBe("DIFFERENT");
  });
});
