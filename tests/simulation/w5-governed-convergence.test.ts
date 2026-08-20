import { describe, expect, it } from "vitest";
import {
  createDefaultEldercareModelInput,
  evaluateW5CoreRealization
} from "../../services/simulation-core/src";

describe("W5 governed convergence core realization", () => {
  it("is deterministic, replay-relevant and never writes formal results", () => {
    const input = createDefaultEldercareModelInput();
    const first = evaluateW5CoreRealization(input);
    const second = evaluateW5CoreRealization(input);

    expect(first.authority).toBe("SIMULATION_CORE");
    expect(first.official).toBe(true);
    expect(first.writes_formal_result).toBe(false);
    expect(first.replay_relevant_digest).toBe(second.replay_relevant_digest);
    expect(first.metrics).toEqual(second.metrics);
  });

  it("changes the replay identity only when the exact core input changes", () => {
    const first = evaluateW5CoreRealization(createDefaultEldercareModelInput());
    const changed = evaluateW5CoreRealization({
      ...createDefaultEldercareModelInput(),
      seed: 20260820
    });

    expect(changed.replay_relevant_digest).not.toBe(first.replay_relevant_digest);
    expect(changed.writes_formal_result).toBe(false);
  });
});
