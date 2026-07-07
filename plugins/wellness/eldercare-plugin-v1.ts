import type { PluginManifest } from "@simwar/shared-contracts";
import {
  evaluateEldercareCoreRound,
  type EldercareModelInput,
  type EldercareRoundEvaluation
} from "../../services/simulation-core/src/eldercare-core-model";

export interface EldercareWellnessPluginV1 {
  plugin_id: "plugin_wellness_eldercare_v1";
  version: "1.0.0";
  runtime_authority: "scenario_asset_only";
  formal_truth_write: false;
  manifest: PluginManifest;
  evaluate(input: EldercareModelInput): EldercareRoundEvaluation;
}

export const ELDERCARE_WELLNESS_PLUGIN_MANIFEST: PluginManifest = {
  adapter_ref: "@simwar/simulation-core/eldercareWellnessPluginV1",
  industry: "wellness",
  manifest_version: "1.0.0",
  name: "R7-A eldercare wellness plugin asset v1",
  parameter_schema_ref: "contracts/fixtures/r7a-eldercare-core-scenario.valid.json",
  parameter_schema_version: "eldercare.parameters.v1",
  plugin_id: "plugin_wellness_eldercare_v1",
  settlement_hook_refs: [
    "segmentDemand:eldercare.segment-demand.v1",
    "capacityGuardrail:eldercare.capacity-guardrail.v1",
    "payerMix:eldercare.payer-mix-resilience.v1",
    "serviceQualityRisk:eldercare.service-quality-risk.v1"
  ],
  status: "candidate",
  supported_hooks: ["adjustDemand", "adjustOperations", "adjustFinance", "adjustScore"],
  version: "1.0.0"
};

export const eldercareWellnessPluginV1: EldercareWellnessPluginV1 = {
  evaluate: evaluateEldercareCoreRound,
  formal_truth_write: false,
  manifest: ELDERCARE_WELLNESS_PLUGIN_MANIFEST,
  plugin_id: "plugin_wellness_eldercare_v1",
  runtime_authority: "scenario_asset_only",
  version: "1.0.0"
};
