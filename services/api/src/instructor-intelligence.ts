import { createHash } from "node:crypto";
import {
  M1_CLASSROOM_DEBRIEF_PROMPTS,
  M1_JSON_RUNTIME_LIMITATIONS,
  type InstructorDebriefArtifactDTO,
  type InstructorIntelligenceKitDTO,
  type PublicResultView,
  type Round,
  type SettlementResult
} from "@simwar/shared-contracts";
import type { InstructorAsset } from "./instructor-asset-registry.js";

export type InstructorIntelligenceKit = InstructorIntelligenceKitDTO;

/** Builds a deterministic teacher-only teaching projection from existing read models. */
export function createInstructorIntelligenceKit(input: {
  asset: InstructorAsset;
  previous_result_view?: PublicResultView;
  result_view: PublicResultView;
  round: Round;
}): InstructorIntelligenceKit {
  if (input.round.status !== "published") {
    throw new Error("INSTRUCTOR_INTELLIGENCE_PUBLISHED_ROUND_REQUIRED");
  }
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

const INSTRUCTOR_DEBRIEF_REPLAY_HASH = /^[a-f0-9]{64}$/;

const INSTRUCTOR_DEBRIEF_EXACTNESS_LIMITS = [
  "on_demand_read_model_not_persisted_as_truth",
  "json_runtime_only",
  "not_teacher_confirmation_or_final_grade",
  "not_durable_cross_process_recovery"
] as const;

type ArtifactInput = {
  asset: InstructorAsset;
  previous_result_view?: PublicResultView;
  previous_settlement?: SettlementResult;
  result_view: PublicResultView;
  round: Round;
  settlement?: SettlementResult;
};

/** Builds the current C4 debrief artifact without creating a second authority or store. */
export function createInstructorDebriefArtifact(
  input: ArtifactInput
): InstructorDebriefArtifactDTO {
  const settlement = requireInstructorDebriefSettlement(input.settlement);
  if (
    input.round.status !== "published" ||
    input.result_view.status !== "published" ||
    input.round.run_id !== settlement.run_id ||
    input.round.round_id !== settlement.round_id ||
    input.round.round_no !== settlement.round_no ||
    input.result_view.run_id !== settlement.run_id ||
    input.result_view.round_no !== settlement.round_no ||
    input.asset.tenant_id !== settlement.tenant_id ||
    input.asset.course_blueprint_ref.tenant_id !== input.asset.tenant_id
  ) {
    throw new Error("INSTRUCTOR_DEBRIEF_SOURCE_SCOPE_MISMATCH");
  }
  if (
    !isValidReplayHash(settlement.replay_hash) ||
    input.result_view.replay_hash !== settlement.replay_hash
  ) {
    throw new Error("INSTRUCTOR_DEBRIEF_REPLAY_HASH_INVALID");
  }

  const baseline = createBaselineBinding(input.previous_settlement, settlement);
  const kit = createInstructorIntelligenceKit({
    asset: input.asset,
    ...(input.previous_result_view ? { previous_result_view: input.previous_result_view } : {}),
    result_view: input.result_view,
    round: input.round
  });
  const withoutDigest = {
    ai_status: "off" as const,
    artifact_schema_version: "instructor-debrief-artifact.v1" as const,
    artifact_type: "instructor_debrief_artifact" as const,
    authority_class: "ADVISORY_ONLY" as const,
    exactness_limits: [...INSTRUCTOR_DEBRIEF_EXACTNESS_LIMITS],
    instructor_asset_fact_digest: input.asset.fact_digest,
    instructor_asset_id: input.asset.asset_id,
    kit,
    source_binding: {
      baseline,
      course_blueprint_ref: input.asset.course_blueprint_ref,
      instructor_asset_fact_digest: input.asset.fact_digest,
      instructor_asset_id: input.asset.asset_id,
      replay_hash: settlement.replay_hash,
      round_id: settlement.round_id,
      round_no: settlement.round_no,
      run_id: settlement.run_id,
      settlement_result_id: settlement.settlement_result_id
    }
  } satisfies Omit<InstructorDebriefArtifactDTO, "artifact_digest">;
  const artifact_digest = createHash("sha256")
    .update(stableJson(withoutDigest), "utf8")
    .digest("hex");
  return { ...withoutDigest, artifact_digest };
}

export function serializeInstructorDebriefArtifactJson(
  artifact: InstructorDebriefArtifactDTO
): string {
  return stableJson(artifact);
}

export function renderInstructorDebriefMarkdown(artifact: InstructorDebriefArtifactDTO): string {
  const source = artifact.source_binding;
  const baseline =
    source.baseline.status === "available"
      ? `${source.baseline.settlement_result_id} / ${source.baseline.replay_hash}`
      : source.baseline.reason;
  return [
    "# Instructor Debrief Artifact",
    "",
    `- Artifact digest: ${artifact.artifact_digest}`,
    `- Artifact schema: ${artifact.artifact_schema_version}`,
    `- Authority: ${artifact.authority_class}`,
    `- AI status: ${artifact.ai_status}`,
    `- Asset: ${artifact.instructor_asset_id}`,
    `- Settlement result: ${source.settlement_result_id}`,
    `- Replay hash: ${source.replay_hash}`,
    `- Course blueprint: ${source.course_blueprint_ref.resource_id}@${source.course_blueprint_ref.version}`,
    `- Baseline: ${baseline}`,
    "",
    "## Discussion points",
    ...artifact.kit.discussion_points.map((point) => `- ${point}`),
    "",
    "## Follow-up questions",
    ...artifact.kit.follow_up_questions.map((question) => `- ${question}`),
    "",
    "## Known limits",
    ...artifact.exactness_limits.map((limit) => `- ${limit}`),
    ...artifact.kit.known_limits.map((limit) => `- ${limit}`),
    ""
  ].join("\n");
}

function requireInstructorDebriefSettlement(
  settlement: SettlementResult | undefined
): SettlementResult {
  if (!settlement) throw new Error("INSTRUCTOR_DEBRIEF_SETTLEMENT_RESULT_REQUIRED");
  return settlement;
}

function isValidReplayHash(value: string): boolean {
  return INSTRUCTOR_DEBRIEF_REPLAY_HASH.test(value);
}

function createBaselineBinding(
  previous: SettlementResult | undefined,
  current: SettlementResult
): InstructorDebriefArtifactDTO["source_binding"]["baseline"] {
  if (!previous) {
    return { reason: "NO_PRIOR_PUBLISHED_RESULT", status: "baseline_unavailable" };
  }
  if (
    previous.tenant_id !== current.tenant_id ||
    previous.run_id !== current.run_id ||
    previous.round_no !== current.round_no - 1 ||
    !isValidReplayHash(previous.replay_hash)
  ) {
    throw new Error("INSTRUCTOR_DEBRIEF_BASELINE_SCOPE_MISMATCH");
  }
  return {
    round_id: previous.round_id,
    round_no: previous.round_no,
    replay_hash: previous.replay_hash,
    run_id: previous.run_id,
    settlement_result_id: previous.settlement_result_id,
    status: "available"
  };
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(sortJsonValue(value))}\n`;
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortJsonValue(nested)])
    );
  }
  return value;
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
