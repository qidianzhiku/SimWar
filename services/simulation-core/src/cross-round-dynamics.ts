import { createHash } from "node:crypto";
import type {
  O4CarryoverDirection,
  O4CarryoverFactor,
  O4CarryoverFactorKind,
  O4CrossRoundDynamicsCandidate,
  O4PairDifferential,
  O4RoundDynamicsRecord,
  O4TeamDynamicsPath
} from "@simwar/shared-contracts";
import type {
  W4CanonicalStrategicDecision,
  W4EnterpriseState,
  W4OfficialOutcome,
  W4StateRef
} from "@simwar/shared-contracts";

export class O4CrossRoundDynamicsError extends Error {
  constructor(
    readonly code: "O4_INVALID_INPUT" | "O4_INSUFFICIENT_HISTORY" | "O4_DUPLICATE_STATE"
  ) {
    super(code);
    this.name = "O4CrossRoundDynamicsError";
  }
}

export interface O4CrossRoundDynamicsCoreInput {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly run_id: string;
  readonly target_round_no?: number;
  readonly states: readonly W4EnterpriseState[];
  readonly outcomes: readonly W4OfficialOutcome[];
  readonly decisions: readonly W4CanonicalStrategicDecision[];
}

interface O4Metrics {
  readonly cash: number;
  readonly capacity: number;
  readonly portfolio_count: number;
  readonly operating_unit_count: number;
  readonly positioning: string;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function stateRef(state: W4EnterpriseState): W4StateRef {
  return {
    tenant_id: state.tenant_id,
    course_id: state.course_id,
    run_id: state.run_id,
    team_id: state.team_id,
    round_id: state.round_id,
    enterprise_state_id: state.enterprise_state_id,
    version: state.version,
    state_digest: state.state_digest,
    parent_state_ref: state.parent_state_ref
  };
}

function metrics(state: W4EnterpriseState): O4Metrics {
  return {
    cash: state.state.cash,
    capacity: state.state.capacity,
    portfolio_count: state.state.portfolio.projects.length,
    operating_unit_count: state.state.operating_units.length,
    positioning: state.state.positioning
  };
}

function direction(value: number): O4CarryoverDirection {
  return value > 0 ? "INCREASED" : value < 0 ? "DECREASED" : "UNCHANGED";
}

function factor(
  kind: O4CarryoverFactorKind,
  magnitude: number,
  explanation: string
): O4CarryoverFactor {
  return { kind, direction: direction(magnitude), magnitude: Math.abs(magnitude), explanation };
}

function carryoverFactors(current: O4Metrics, previous: O4Metrics | undefined): O4CarryoverFactor[] {
  const baseline = previous ?? {
    cash: 0,
    capacity: 0,
    portfolio_count: 0,
    operating_unit_count: 0,
    positioning: ""
  };
  return [
    factor(
      "CASH_POSITION",
      current.cash - baseline.cash,
      "Cash position carried from the preceding enterprise state; it is explanatory and not a settlement write."
    ),
    factor(
      "CAPACITY_POSITION",
      current.capacity - baseline.capacity,
      "Capacity position carried from the preceding enterprise state."
    ),
    factor(
      "PORTFOLIO_COMMITMENT",
      current.portfolio_count - baseline.portfolio_count,
      "Portfolio project count represents durable strategic commitment carried into the next round."
    ),
    factor(
      "ORGANIZATION_SCALE",
      current.operating_unit_count - baseline.operating_unit_count,
      "Operating-unit count represents the bounded organization scale visible to the differential."
    ),
    factor(
      "POSITIONING_CONTINUITY",
      current.positioning === baseline.positioning ? 0 : 1,
      current.positioning === baseline.positioning
        ? "Positioning is unchanged across the state boundary."
        : "Positioning changed across the state boundary and remains part of the historical path."
    )
  ];
}

function sameRef(left: W4StateRef, right: W4StateRef): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.course_id === right.course_id &&
    left.run_id === right.run_id &&
    left.team_id === right.team_id &&
    left.round_id === right.round_id &&
    left.enterprise_state_id === right.enterprise_state_id &&
    left.version === right.version &&
    left.state_digest === right.state_digest
  );
}

function outcomeForState(
  outcomes: readonly W4OfficialOutcome[],
  state: W4EnterpriseState
): W4OfficialOutcome | undefined {
  return outcomes.find(
    (outcome) =>
      outcome.tenant_id === state.tenant_id &&
      outcome.course_id === state.course_id &&
      outcome.run_id === state.run_id &&
      outcome.team_id === state.team_id &&
      outcome.round_id === state.round_id &&
      outcome.round_no === state.round_no &&
      sameRef(outcome.closing_state_ref, stateRef(state))
  );
}

function decisionFingerprint(decision: W4CanonicalStrategicDecision | undefined): string | null {
  if (!decision) return null;
  return `${decision.kind}:${decision.admission.decision_payload_digest}`;
}

function pairDifferential(
  left: O4TeamDynamicsPath,
  right: O4TeamDynamicsPath,
  leftDecision: W4CanonicalStrategicDecision | undefined,
  rightDecision: W4CanonicalStrategicDecision | undefined,
  targetRoundNo: number
): O4PairDifferential {
  const leftRound = left.rounds.find((item) => item.round_no === targetRoundNo);
  const rightRound = right.rounds.find((item) => item.round_no === targetRoundNo);
  if (!leftRound?.metrics || !rightRound?.metrics) {
    throw new O4CrossRoundDynamicsError("O4_INVALID_INPUT");
  }
  const leftFingerprint = decisionFingerprint(leftDecision);
  const rightFingerprint = decisionFingerprint(rightDecision);
  const currentDecisionMatch =
    leftFingerprint === null || rightFingerprint === null
      ? "NOT_OBSERVED"
      : leftFingerprint === rightFingerprint
        ? "MATCHED"
        : "DIFFERENT";
  const cash = leftRound.metrics.cash - rightRound.metrics.cash;
  const capacity = leftRound.metrics.capacity - rightRound.metrics.capacity;
  const portfolioCount =
    leftRound.metrics.portfolio_count - rightRound.metrics.portfolio_count;
  const operatingUnitCount =
    leftRound.metrics.operating_unit_count - rightRound.metrics.operating_unit_count;
  const explanatoryFactors = [
    factor("CASH_POSITION", cash, "Current cash-position difference between the two exact histories."),
    factor(
      "CAPACITY_POSITION",
      capacity,
      "Current capacity-position difference between the two exact histories."
    ),
    factor(
      "PORTFOLIO_COMMITMENT",
      portfolioCount,
      "Current portfolio-commitment difference between the two exact histories."
    ),
    factor(
      "ORGANIZATION_SCALE",
      operatingUnitCount,
      "Current organization-scale difference between the two exact histories."
    ),
    factor(
      "POSITIONING_CONTINUITY",
      leftRound.metrics.positioning === rightRound.metrics.positioning ? 0 : 1,
      leftRound.metrics.positioning === rightRound.metrics.positioning
        ? "The two histories retain the same positioning label."
        : "The two histories retain different positioning labels."
    )
  ];
  return {
    left_team_id: left.team_id,
    right_team_id: right.team_id,
    target_round_no: targetRoundNo,
    current_decision_match: currentDecisionMatch,
    history_different: left.history_digest !== right.history_digest,
    outcome_differential: {
      cash,
      capacity,
      portfolio_count: portfolioCount,
      operating_unit_count: operatingUnitCount
    },
    explanatory_factors: explanatoryFactors
  };
}

export function buildO4CrossRoundDynamicsCandidate(
  input: O4CrossRoundDynamicsCoreInput
): O4CrossRoundDynamicsCandidate {
  if (
    !input.tenant_id ||
    !input.course_id ||
    !input.run_id ||
    (input.target_round_no !== undefined &&
      (!Number.isInteger(input.target_round_no) || input.target_round_no < 3))
  ) {
    throw new O4CrossRoundDynamicsError("O4_INVALID_INPUT");
  }
  const scopedStates = input.states.filter(
    (state) =>
      state.tenant_id === input.tenant_id &&
      state.course_id === input.course_id &&
      state.run_id === input.run_id
  );
  const byTeam = new Map<string, W4EnterpriseState[]>();
  for (const state of scopedStates) {
    const teamStates = byTeam.get(state.team_id) ?? [];
    if (teamStates.some((item) => item.round_no === state.round_no)) {
      throw new O4CrossRoundDynamicsError("O4_DUPLICATE_STATE");
    }
    teamStates.push(state);
    byTeam.set(state.team_id, teamStates);
  }
  const availableRoundNos = scopedStates.map((state) => state.round_no);
  const targetRoundNo =
    input.target_round_no ?? Math.max(...availableRoundNos, 0);
  const requiredRoundNos = [targetRoundNo - 2, targetRoundNo - 1, targetRoundNo];
  const eligibleTeams = [...byTeam.entries()]
    .filter(([, states]) => requiredRoundNos.every((roundNo) => states.some((s) => s.round_no === roundNo)))
    .sort(([left], [right]) => left.localeCompare(right));
  if (targetRoundNo < 3 || eligibleTeams.length < 2) {
    throw new O4CrossRoundDynamicsError("O4_INSUFFICIENT_HISTORY");
  }

  const paths: O4TeamDynamicsPath[] = eligibleTeams.map(([teamId, states]) => {
    const sortedStates = states.slice().sort((left, right) => left.round_no - right.round_no);
    const selectedStates = requiredRoundNos.map((roundNo) => {
      const state = sortedStates.find((candidate) => candidate.round_no === roundNo);
      if (!state) throw new O4CrossRoundDynamicsError("O4_INSUFFICIENT_HISTORY");
      return state;
    });
    const rounds: O4RoundDynamicsRecord[] = selectedStates.map((state) => {
      const currentMetrics = metrics(state);
      const previousState = sortedStates.find((candidate) => candidate.round_no === state.round_no - 1);
      const outcome = outcomeForState(input.outcomes, state);
      return {
        round_no: state.round_no,
        round_id: state.round_id,
        ...(outcome?.opening_state_ref
          ? { opening_state_ref: outcome.opening_state_ref }
          : state.parent_state_ref
            ? { opening_state_ref: state.parent_state_ref }
            : {}),
        closing_state_ref: stateRef(state),
        metrics: currentMetrics,
        carryover_factors: carryoverFactors(
          currentMetrics,
          previousState ? metrics(previousState) : undefined
        )
      };
    });
    return {
      team_id: teamId,
      history_digest: digest(
        rounds.map((round) => ({
          round_no: round.round_no,
          round_id: round.round_id,
          closing_state_ref: round.closing_state_ref,
          metrics: round.metrics
        }))
      ),
      round_count: rounds.length,
      rounds
    };
  });

  const pairDifferentials: O4PairDifferential[] = [];
  for (let leftIndex = 0; leftIndex < paths.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < paths.length; rightIndex += 1) {
      const left = paths[leftIndex]!;
      const right = paths[rightIndex]!;
      pairDifferentials.push(
        pairDifferential(
          left,
          right,
          input.decisions.find(
            (decision) =>
              decision.tenant_id === input.tenant_id &&
              decision.course_id === input.course_id &&
              decision.run_id === input.run_id &&
              decision.team_id === left.team_id &&
              decision.round_no === targetRoundNo
          ),
          input.decisions.find(
            (decision) =>
              decision.tenant_id === input.tenant_id &&
              decision.course_id === input.course_id &&
              decision.run_id === input.run_id &&
              decision.team_id === right.team_id &&
              decision.round_no === targetRoundNo
          ),
          targetRoundNo
        )
      );
    }
  }
  const proven = pairDifferentials.some(
    (pair) => pair.current_decision_match === "MATCHED" && pair.history_different
  );
  return {
    candidate_id: `o4-cross-round-${digest({
      tenant_id: input.tenant_id,
      course_id: input.course_id,
      run_id: input.run_id,
      target_round_no: targetRoundNo,
      teams: paths.map((path) => [path.team_id, path.history_digest])
    }).slice(0, 24)}`,
    status: proven ? "PROVEN" : "OBSERVED_DIFFERENTIAL",
    horizon_rounds: requiredRoundNos.length,
    source_team_count: paths.length,
    source_state_ref_count: paths.reduce((count, path) => count + path.rounds.length, 0),
    team_paths: paths,
    pair_differentials: pairDifferentials
  };
}
