import { describe, expect, it } from "vitest";
import {
  GSICrossRoundContextAdapter,
  GSICrossRoundContextError,
  type GSIContextBinding
} from "../../services/api/src/gsi-cross-round-context-adapter.js";

const context: GSIContextBinding = {
  activity_id: "activity_demo",
  course_id: "course_demo",
  role_key: "CEO",
  round_id: "round_2",
  round_no: 2,
  run_id: "run_demo",
  team_id: "team_demo",
  tenant_id: "tenant_demo"
};

function observation(source: "W3" | "M2P5", status: "PUBLISHED" | "UNPUBLISHED" = "PUBLISHED") {
  return { source, status, context, context_digest: `${source.toLowerCase()}-digest` } as const;
}

describe("GSI cross-round context adapter", () => {
  it("returns published W3/M2P5 context as a non-causal read-only anchor", async () => {
    const adapter = new GSICrossRoundContextAdapter({
      readW3: async () => observation("W3"),
      readM2P5: async () => observation("M2P5")
    });
    const result = await adapter.read({ context });
    expect(result.status).toBe("AVAILABLE");
    expect(result.anchors.map((anchor) => anchor.source)).toEqual(["W3", "M2P5"]);
    expect(result.non_causal).toBe(true);
    expect(result.causal_proof).toBe(false);
    expect(result.official_outcome_recomputed).toBe(false);
    expect(result.official_truth_write).toBe(false);
  });

  it("keeps missing or unpublished context unavailable", async () => {
    const adapter = new GSICrossRoundContextAdapter({
      readW3: async () => observation("W3", "UNPUBLISHED"),
      readM2P5: async () => null
    });
    const result = await adapter.read({ context });
    expect(result.status).toBe("CONTEXT_UNAVAILABLE");
    expect(result.recovery).toBe("WAIT_FOR_PUBLICATION");
  });

  it("requires rebase when an exact context observation moved", async () => {
    const moved = { ...context, round_id: "round_3", round_no: 3 };
    const adapter = new GSICrossRoundContextAdapter({
      readW3: async () => ({ ...observation("W3"), context: moved }),
      readM2P5: async () => null
    });
    await expect(adapter.read({ context })).rejects.toThrowError(
      new GSICrossRoundContextError("GSI_CONTEXT_REBASE_REQUIRED")
    );
  });

  it("rejects an implicit selector in the context", async () => {
    const adapter = new GSICrossRoundContextAdapter({
      readW3: async () => null,
      readM2P5: async () => null
    });
    await expect(
      adapter.read({ context: { ...context, course_id: "latest" } })
    ).rejects.toThrowError(new GSICrossRoundContextError("GSI_CONTEXT_INVALID"));
  });
});
