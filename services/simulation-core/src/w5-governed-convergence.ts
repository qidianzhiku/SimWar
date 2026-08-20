import { createHash } from "node:crypto";
import {
  createDefaultEldercareModelInput,
  evaluateEldercareCoreRound,
  type EldercareModelInput,
  type EldercareRoundMetrics
} from "./eldercare-core-model.js";

export interface W5CoreRealization {
  authority: "SIMULATION_CORE";
  metrics: EldercareRoundMetrics;
  official: true;
  replay_relevant_digest: string;
  writes_formal_result: false;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

/**
 * W5's realized plane deliberately delegates to the existing Simulation Core
 * evaluator. It returns an official-core projection for model convergence
 * evidence, but it does not persist SettlementResult or alter formal truth.
 */
export function evaluateW5CoreRealization(
  input: EldercareModelInput = createDefaultEldercareModelInput()
): W5CoreRealization {
  const evaluation = evaluateEldercareCoreRound(input);
  return {
    authority: "SIMULATION_CORE",
    metrics: evaluation.round_metrics,
    official: true,
    replay_relevant_digest: digest({
      model_family: evaluation.model_family,
      round_metrics: evaluation.round_metrics,
      scenario_id: evaluation.scenario_id,
      seed: input.seed
    }),
    writes_formal_result: false
  };
}
