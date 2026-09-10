import { createHash } from "node:crypto";
import {
  createDefaultEldercareModelInput,
  evaluateEldercareCoreRound,
  type EldercareModelInput,
  type EldercareRoundMetrics
} from "./eldercare-core-model.js";
import type { W5ProducerIntrinsicLineage } from "@simwar/shared-contracts";

export interface W5CoreRealization {
  authority: "SIMULATION_CORE";
  metrics: EldercareRoundMetrics;
  official: true;
  producer_intrinsic_lineage: W5ProducerIntrinsicLineage;
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

const CORE_MODEL_VERSION_REFERENCE = Object.freeze({
  model_version_id: "eldercare_core_model_v1",
  version: "1.0.0",
  content_digest: digest({
    producer: "simulation-core-eldercare",
    model_family: "eldercare_core_model_v1",
    source: "services/simulation-core/src/eldercare-core-model.ts"
  })
});

const CORE_MODEL_ARTIFACT_REFERENCE = Object.freeze({
  artifact_id: "eldercare_core_model_v1_artifact",
  content_digest: digest({
    producer: "simulation-core-eldercare",
    artifact: "typescript-simulation-core",
    source: "services/simulation-core/src/eldercare-core-model.ts"
  }),
  format: "typescript-simulation-core",
  source_ref: "services/simulation-core/src/eldercare-core-model.ts"
});

const CORE_INTRINSIC_LINEAGE_DIGEST = digest({
  model_artifact_reference: CORE_MODEL_ARTIFACT_REFERENCE,
  model_version_reference: CORE_MODEL_VERSION_REFERENCE,
  producer_source_ref: "services/simulation-core/src/eldercare-core-model.ts"
});

export const ELDERCARE_CORE_INTRINSIC_LINEAGE: W5ProducerIntrinsicLineage = Object.freeze({
  intrinsic_lineage_digest: CORE_INTRINSIC_LINEAGE_DIGEST,
  model_artifact_reference: CORE_MODEL_ARTIFACT_REFERENCE,
  model_version_reference: CORE_MODEL_VERSION_REFERENCE,
  producer_source_ref: "services/simulation-core/src/eldercare-core-model.ts",
  runtime_binding_digest: CORE_INTRINSIC_LINEAGE_DIGEST
});

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
    producer_intrinsic_lineage: {
      ...ELDERCARE_CORE_INTRINSIC_LINEAGE,
      runtime_binding_digest: digest({
        input,
        intrinsic_lineage_digest: CORE_INTRINSIC_LINEAGE_DIGEST
      })
    },
    replay_relevant_digest: digest({
      model_family: evaluation.model_family,
      round_metrics: evaluation.round_metrics,
      scenario_id: evaluation.scenario_id,
      seed: input.seed
    }),
    writes_formal_result: false
  };
}
