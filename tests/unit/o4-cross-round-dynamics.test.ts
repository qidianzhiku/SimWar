import { describe, expect, it } from "vitest";
import {
  buildO4CrossRoundDynamicsCandidate,
  O4CrossRoundDynamicsError
} from "@simwar/simulation-core";
import type {
  W4CanonicalStrategicDecision,
  W4EnterpriseState,
  W4OfficialOutcome
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

function decision(teamId: string): W4CanonicalStrategicDecision {
  return {
    decision_id: `decision-${teamId}-3`,
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
      canonical_decision_id: `canonical-${teamId}-3`,
      merge_commit_id: `merge-${teamId}-3`,
      team_confirmation_id: `confirmation-${teamId}-3`,
      decision_payload_digest: "a".repeat(64)
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
});
