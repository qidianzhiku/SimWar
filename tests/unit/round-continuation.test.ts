import { describe, expect, it } from "vitest";
import type { Round } from "@simwar/shared-contracts";
import {
  continuationRoundId,
  resolveNextRound,
  RoundContinuationError
} from "../../services/api/src/round-continuation.js";

const predecessor: Round = {
  round_id: "round-1",
  round_no: 1,
  run_id: "run-1",
  status: "published",
  tenant_id: "tenant-1"
};

describe("MW4 round continuation resolver", () => {
  it("creates a deterministic same-Run draft without inheriting fields", () => {
    const result = resolveNextRound({ predecessor, rounds: [predecessor] });
    expect(result).toEqual({
      outcome: "created",
      round: {
        round_id: continuationRoundId("run-1", 2),
        round_no: 2,
        run_id: "run-1",
        status: "draft",
        tenant_id: "tenant-1"
      }
    });
  });

  it("reuses one existing exact successor and rejects duplicate candidates", () => {
    const successor: Round = {
      ...predecessor,
      round_id: "round-2",
      round_no: 2,
      status: "draft"
    };
    expect(resolveNextRound({ predecessor, rounds: [predecessor, successor] })).toEqual({
      outcome: "reused",
      round: successor
    });
    expect(() =>
      resolveNextRound({
        predecessor,
        rounds: [predecessor, successor, { ...successor, round_id: "round-2-conflict" }]
      })
    ).toThrowError(
      new RoundContinuationError(
        "ROUND_CONTINUATION_CONFLICT",
        "multiple successor rounds exist for the same predecessor"
      )
    );
  });

  it("requires the predecessor to be published", () => {
    expect(() =>
      resolveNextRound({ predecessor: { ...predecessor, status: "settled" }, rounds: [] })
    ).toThrowError(
      new RoundContinuationError(
        "ROUND_CONTINUATION_REQUIRES_PUBLISHED",
        "only a published predecessor round can continue"
      )
    );
  });
});
