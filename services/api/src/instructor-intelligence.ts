import { createHash } from "node:crypto";
import {
  M1_CLASSROOM_DEBRIEF_PROMPTS,
  M1_JSON_RUNTIME_LIMITATIONS,
  type PublicResultView,
  type Round
} from "@simwar/shared-contracts";
import type { InstructorAsset } from "./instructor-asset-registry.js";

export interface InstructorIntelligenceKit {
  readonly ai_status: "off";
  readonly anomaly_status:
    | "baseline_unavailable"
    | "result_pending"
    | "no_material_delta"
    | "material_delta";
  readonly causal_evidence_refs: readonly InstructorAsset["course_blueprint_ref"][];
  readonly debrief_agenda: readonly string[];
  readonly deterministic_fact_digest: string;
  readonly discussion_points: readonly string[];
  readonly follow_up_questions: readonly string[];
  readonly instructor_asset_id: string;
  readonly known_limits: readonly string[];
  readonly round: Pick<Round, "round_id" | "round_no" | "run_id" | "status">;
  readonly result_delta: {
    readonly baseline_round_no?: number;
    readonly baseline_team_count?: number;
    readonly current_team_count: number;
    readonly average_score_delta?: number;
    readonly rank_change_count?: number;
  };
  readonly source_course_blueprint_ref: InstructorAsset["course_blueprint_ref"];
  readonly time_guidance: string;
}

/** Builds a deterministic teacher-only teaching projection from existing read models. */
export function createInstructorIntelligenceKit(input: {
  asset: InstructorAsset;
  previous_result_view?: PublicResultView;
  result_view: PublicResultView;
  round: Round;
}): InstructorIntelligenceKit {
  const currentObserved = input.result_view.results.map((result) => ({
    rank: result.state_obs.rank,
    score: result.state_obs.score,
    team_id: result.team_id
  }));
  const previousObserved = input.previous_result_view?.results.map((result) => ({
    rank: result.state_obs.rank,
    score: result.state_obs.score,
    team_id: result.team_id
  }));
  const analysis = buildResultDelta(currentObserved, previousObserved, input.round.round_no);
  const anomalyStatus = analysis.anomaly_status;
  const facts = {
    previous_result_count: previousObserved?.length ?? 0,
    result_delta: analysis.result_delta,
    result_count: currentObserved.length,
    result_label: input.result_view.result_label,
    round_no: input.round.round_no,
    round_status: input.round.status
  };
  const deterministicFactDigest = createHash("sha256")
    .update(JSON.stringify({ asset_digest: input.asset.fact_digest, facts }))
    .digest("hex");

  return {
    ai_status: "off",
    anomaly_status: anomalyStatus,
    causal_evidence_refs: [input.asset.course_blueprint_ref],
    debrief_agenda: [
      "Review the observed result against the team decision.",
      "Discuss one demand, capacity, cash, or pricing tradeoff.",
      "Agree a next-round experiment without changing official results."
    ],
    deterministic_fact_digest: deterministicFactDigest,
    discussion_points: [...M1_CLASSROOM_DEBRIEF_PROMPTS],
    follow_up_questions: [
      "Which decision created the most visible tradeoff?",
      "What evidence would change the next-round choice?"
    ],
    instructor_asset_id: input.asset.asset_id,
    known_limits: [...M1_JSON_RUNTIME_LIMITATIONS],
    round: {
      round_id: input.round.round_id,
      round_no: input.round.round_no,
      run_id: input.round.run_id,
      status: input.round.status
    },
    result_delta: analysis.result_delta,
    source_course_blueprint_ref: input.asset.course_blueprint_ref,
    time_guidance:
      "Reserve 10 minutes for evidence review and 5 minutes for next-round commitments."
  };
}

function buildResultDelta(
  current: ReadonlyArray<{ rank: number; score: number; team_id: string }>,
  previous: ReadonlyArray<{ rank: number; score: number; team_id: string }> | undefined,
  roundNo: number
): {
  anomaly_status: InstructorIntelligenceKit["anomaly_status"];
  result_delta: InstructorIntelligenceKit["result_delta"];
} {
  if (current.length === 0) {
    return {
      anomaly_status: roundNo === 1 ? "baseline_unavailable" : "result_pending",
      result_delta: { current_team_count: 0 }
    };
  }
  if (!previous || previous.length === 0) {
    return {
      anomaly_status: "baseline_unavailable",
      result_delta: { current_team_count: current.length }
    };
  }

  const previousByTeam = new Map(previous.map((result) => [result.team_id, result]));
  const comparable = current.flatMap((result) => {
    const baseline = previousByTeam.get(result.team_id);
    return baseline ? [{ baseline, current: result }] : [];
  });
  const averageScoreDelta =
    comparable.length === 0
      ? 0
      : comparable.reduce((sum, item) => sum + item.current.score - item.baseline.score, 0) /
        comparable.length;
  const rankChangeCount = comparable.filter(
    (item) => item.current.rank !== item.baseline.rank
  ).length;
  const material =
    current.length !== previous.length || averageScoreDelta !== 0 || rankChangeCount !== 0;
  return {
    anomaly_status: material ? "material_delta" : "no_material_delta",
    result_delta: {
      average_score_delta: averageScoreDelta,
      baseline_round_no: roundNo - 1,
      baseline_team_count: previous.length,
      current_team_count: current.length,
      rank_change_count: rankChangeCount
    }
  };
}
