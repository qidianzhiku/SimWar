import { describe, expect, it } from "vitest";
import { buildM1ExecutiveSeason, validateM1ExecutiveSeason } from "@simwar/sh-next-support";

describe("M1 Shanghai executive strategy season", () => {
  it("builds four complete episodes with an exact-bound decision loop", () => {
    const pack = buildM1ExecutiveSeason();

    expect(pack.state_transition).toEqual({ from: "STATE_A", to: "STATE_B" });
    expect(pack.episodes).toHaveLength(4);
    expect(pack.episodes.map((episode) => episode.episode_id)).toEqual([
      "SH-ESL-NEXT-01-E01",
      "SH-ESL-NEXT-01-E02",
      "SH-ESL-NEXT-01-E03",
      "SH-ESL-NEXT-01-E04"
    ]);
    for (const episode of pack.episodes) {
      expect(episode.scenario_ref.scenario_id).toMatch(/^sh-esl-next-01-scenario-/);
      expect(episode.scenario_ref.parameter_set_id).toMatch(/^sh-esl-next-01-parameter-/);
      expect(episode.ai_mode).toBe("OFF");
      expect(episode.final_ranking_prefilled).toBe(false);
      expect(episode.loop).toEqual(["Decision", "Outcome", "Debrief", "What-if", "Transfer"]);
    }
  });

  it("keeps process, outcome, learning, and counterfactual evidence separate", () => {
    const pack = buildM1ExecutiveSeason();
    for (const episode of pack.episodes) {
      expect(episode.process.authority).toBe("CANDIDATE");
      expect(episode.outcome_candidate.authority).toBe("CANDIDATE");
      expect(episode.learning_evidence.authority).toBe("CANDIDATE");
      expect(episode.counterfactual.authority).toBe("CANDIDATE");
      expect(episode.outcome_candidate.final_score).toBeUndefined();
      expect(episode.outcome_candidate.final_rank).toBeUndefined();
    }
  });

  it("is role-safe, provenance-complete, and contains no forbidden truth writer fields", () => {
    const pack = buildM1ExecutiveSeason();
    const serialized = JSON.stringify(pack);

    expect(pack.role_visibility.student.forbidden_fields).toContain("private_truth");
    expect(pack.role_visibility.student.forbidden_fields).toContain("final_ranking");
    expect(pack.authority.official_truth_write).toBe(false);
    expect(pack.authority.settlement_write).toBe(false);
    expect(pack.authority.parameter_set_formal_write).toBe(false);
    expect(pack.authority.provider).toBe("OFF");
    expect(serialized).not.toContain('"MODEL_CALIBRATED"');
    expect(serialized).not.toContain('"state_true"');
    expect(serialized).not.toContain('"SettlementResult"');
    expect(pack.sources.every((source) => /^[a-f0-9]{64}$/.test(source.hash))).toBe(true);
    expect(pack.observations.every((observation) => observation.source_id.length > 0)).toBe(true);
  });

  it("has a passing MJP and stable digest, while admitting no formal consumer", () => {
    const first = buildM1ExecutiveSeason();
    const second = buildM1ExecutiveSeason();

    expect(first.mjp.status).toBe("PASS");
    expect(first.mjp.episode_id).toBe("SH-ESL-NEXT-01-E01");
    expect(first.consumer.consumer_ready).toBe(false);
    expect(first.consumer.classification).toBe("C1");
    expect(first.pack_digest).toBe(second.pack_digest);
    expect(validateM1ExecutiveSeason(first)).toEqual([]);
  });
});
