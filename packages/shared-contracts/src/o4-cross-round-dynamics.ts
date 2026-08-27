import type {
  W4EnterpriseStateData,
  W4StateRef
} from "./w4-enterprise-state.js";

export const O4_CROSS_ROUND_DYNAMICS_SCHEMA_VERSION =
  "o4-cross-round-dynamics.v1" as const;

export type O4CrossRoundDynamicsSurface = "teacher" | "student" | "admin";
export type O4CrossRoundDynamicsStatus = "PROVEN" | "OBSERVED_DIFFERENTIAL";
export type O4CurrentDecisionMatch = "MATCHED" | "DIFFERENT" | "NOT_OBSERVED";
export type O4CarryoverFactorKind =
  | "CASH_POSITION"
  | "CAPACITY_POSITION"
  | "PORTFOLIO_COMMITMENT"
  | "ORGANIZATION_SCALE"
  | "POSITIONING_CONTINUITY";
export type O4CarryoverDirection = "INCREASED" | "DECREASED" | "UNCHANGED";

export interface O4CrossRoundDynamicsScope {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly run_id: string;
  readonly target_round_no: number;
}

export interface O4CarryoverFactor {
  readonly kind: O4CarryoverFactorKind;
  readonly direction: O4CarryoverDirection;
  /** Omitted from the Student projection to avoid exposing raw state deltas. */
  readonly magnitude?: number;
  readonly explanation: string;
}

export interface O4RoundDynamicsRecord {
  readonly round_no: number;
  readonly round_id: string;
  readonly opening_state_ref?: W4StateRef;
  readonly closing_state_ref?: W4StateRef;
  readonly metrics?: {
    readonly cash: number;
    readonly capacity: number;
    readonly portfolio_count: number;
    readonly operating_unit_count: number;
    readonly positioning: string;
  };
  readonly carryover_factors: readonly O4CarryoverFactor[];
}

export interface O4TeamDynamicsPath {
  readonly team_id: string;
  readonly history_digest: string;
  readonly round_count: number;
  readonly rounds: readonly O4RoundDynamicsRecord[];
}

export interface O4PairDifferential {
  readonly left_team_id: string;
  readonly right_team_id: string;
  readonly target_round_no: number;
  readonly current_decision_match: O4CurrentDecisionMatch;
  readonly history_different: boolean;
  readonly outcome_differential: {
    readonly cash: number;
    readonly capacity: number;
    readonly portfolio_count: number;
    readonly operating_unit_count: number;
  };
  readonly explanatory_factors: readonly O4CarryoverFactor[];
}

export interface O4CrossRoundDynamicsCandidate {
  readonly candidate_id: string;
  readonly status: O4CrossRoundDynamicsStatus;
  readonly horizon_rounds: number;
  readonly source_team_count: number;
  readonly source_state_ref_count: number;
  readonly team_paths: readonly O4TeamDynamicsPath[];
  readonly pair_differentials: readonly O4PairDifferential[];
}

export interface O4CrossRoundDynamicsResponse {
  readonly schema_version: typeof O4_CROSS_ROUND_DYNAMICS_SCHEMA_VERSION;
  readonly runtime_authority: "JSON_INTERNAL_ONLY";
  readonly visibility: "teacher_safe" | "student_safe" | "admin_safe";
  readonly exact_scope: O4CrossRoundDynamicsScope;
  readonly candidate: O4CrossRoundDynamicsCandidate;
  readonly provenance: {
    readonly source: "W4_ENTERPRISE_STATE_READ_MODEL";
    readonly state_ref_count: number;
    readonly official_outcome_count: number;
    readonly source_decision_count: number;
    readonly replay_writes_formal_results: false;
  };
  readonly authority: {
    readonly candidate_writer: "SIMULATION_CORE_READ_ONLY";
    readonly official_truth_write: false;
    readonly settlement_write: false;
    readonly replay_write: false;
    readonly provider_calls: 0;
  };
  readonly known_limits: readonly string[];
}

export function projectO4StudentState(
  response: O4CrossRoundDynamicsResponse,
  teamId: string
): O4CrossRoundDynamicsResponse {
  const path = response.candidate.team_paths.find((item) => item.team_id === teamId);
  if (!path) return response;
  return {
    ...response,
    visibility: "student_safe",
    exact_scope: { ...response.exact_scope },
    candidate: {
      ...response.candidate,
      source_team_count: 1,
      source_state_ref_count: 0,
      team_paths: [
        {
          ...path,
          rounds: path.rounds.map(({ round_no, round_id, carryover_factors }) => ({
            round_no,
            round_id,
            carryover_factors: carryover_factors.map(({ kind, direction, explanation }) => ({
              kind,
              direction,
              explanation
            }))
          }))
        }
      ],
      pair_differentials: []
    },
    provenance: {
      ...response.provenance,
      state_ref_count: 0,
      official_outcome_count: 0,
      source_decision_count: 0
    },
    known_limits: [
      ...response.known_limits,
      "Student projection is limited to the authenticated team and omits peer paths, raw state metrics, exact state refs, outcomes, and decision provenance."
    ]
  };
}

export type O4EnterpriseStateDataForMetrics = Pick<
  W4EnterpriseStateData,
  "cash" | "capacity" | "portfolio" | "operating_units" | "positioning"
>;
