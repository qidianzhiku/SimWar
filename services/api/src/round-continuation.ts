import type { Round } from "@simwar/shared-contracts";

export class RoundContinuationError extends Error {
  constructor(
    readonly code: "ROUND_CONTINUATION_REQUIRES_PUBLISHED" | "ROUND_CONTINUATION_CONFLICT",
    message: string
  ) {
    super(message);
    this.name = "RoundContinuationError";
  }
}

export function continuationRoundId(runId: string, roundNo: number): string {
  return `round_${runId}_${roundNo}`;
}

export function resolveNextRound(input: { predecessor: Round; rounds: readonly Round[] }): {
  outcome: "created" | "reused";
  round: Round;
} {
  if (input.predecessor.status !== "published") {
    throw new RoundContinuationError(
      "ROUND_CONTINUATION_REQUIRES_PUBLISHED",
      "only a published predecessor round can continue"
    );
  }

  const nextRoundNo = input.predecessor.round_no + 1;
  const candidates = input.rounds.filter(
    (round) =>
      round.tenant_id === input.predecessor.tenant_id &&
      round.run_id === input.predecessor.run_id &&
      round.round_no === nextRoundNo
  );

  if (candidates.length > 1) {
    throw new RoundContinuationError(
      "ROUND_CONTINUATION_CONFLICT",
      "multiple successor rounds exist for the same predecessor"
    );
  }

  const existing = candidates[0];
  if (existing) {
    return { outcome: "reused", round: existing };
  }

  return {
    outcome: "created",
    round: {
      round_id: continuationRoundId(input.predecessor.run_id, nextRoundNo),
      round_no: nextRoundNo,
      run_id: input.predecessor.run_id,
      status: "draft",
      tenant_id: input.predecessor.tenant_id
    }
  };
}
