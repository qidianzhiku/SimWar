import { createHash } from "node:crypto";
import type { ParameterSet, ScenarioPackage } from "@simwar/shared-contracts";
import { DEFAULT_WELLNESS_PARAMETERS_V1 } from "./wellness-parameters.js";
import {
  createDefaultEldercareModelInput,
  evaluateEldercareCoreRound,
  type EldercareModelInput,
  type EldercareRegionProfile
} from "./eldercare-core-model.js";

export interface EldercareScenarioRound {
  round_no: number;
  title: string;
  decision_focus: string[];
  evidence_boundary: "SOURCE_ONLY_INFERENCE";
}

export interface EldercareScenarioAsset {
  asset_id: "r7a-beijing-yanjiao-eldercare-core-scenario-v1";
  asset_hash: string;
  status_boundary: {
    g0_status: "EXCEPTION";
    g0_pass: "NOT_GRANTED";
    l1_status: "NOT_READY";
  };
  scenario_package: ScenarioPackage;
  parameter_set: ParameterSet;
  regions: EldercareRegionProfile[];
  rounds: EldercareScenarioRound[];
  synthetic_data_policy: {
    real_user_data: false;
    real_payment_data: false;
    production_identifier: false;
  };
  r7a_evidence: {
    direct_store_delta: "NONE";
    runtime_truth_change: false;
    replay_writes_formal_results: false;
    postgres_required: false;
  };
  learner_visibility_forbidden_categories: string[];
  model_preview: ReturnType<typeof evaluateEldercareCoreRound>;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function buildAssetWithoutHash(
  input: EldercareModelInput
): Omit<EldercareScenarioAsset, "asset_hash"> {
  return {
    asset_id: "r7a-beijing-yanjiao-eldercare-core-scenario-v1",
    learner_visibility_forbidden_categories: [
      "formal_truth_fields",
      "formal_result_shape",
      "private_replay_manifest",
      "private_replay_digest_fields",
      "teacher_private_metadata",
      "tenant_admin_private_metadata",
      "other_tenant_data"
    ],
    model_preview: evaluateEldercareCoreRound(input),
    parameter_set: {
      base_capacity: 138,
      base_market_size: 210,
      fixed_cost: 260000,
      model_family: "toy_logit",
      parameter_set_id: "parameter_r7a_eldercare_v1",
      parameters: DEFAULT_WELLNESS_PARAMETERS_V1,
      seed: input.seed,
      status: "candidate",
      tenant_id: "tenant_r7a_synthetic",
      unit_cost: 6200,
      version: "r7a.eldercare.parameters.v1"
    },
    r7a_evidence: {
      direct_store_delta: "NONE",
      postgres_required: false,
      replay_writes_formal_results: false,
      runtime_truth_change: false
    },
    regions: input.regions,
    rounds: [
      {
        decision_focus: ["region selection", "community channel discovery"],
        evidence_boundary: "SOURCE_ONLY_INFERENCE",
        round_no: 1,
        title: "Beijing-Yanjiao demand discovery"
      },
      {
        decision_focus: ["bed capacity", "day-care slot planning", "staffing ratio"],
        evidence_boundary: "SOURCE_ONLY_INFERENCE",
        round_no: 2,
        title: "Facility and service capacity"
      },
      {
        decision_focus: ["payer mix", "public subsidy", "commercial insurance"],
        evidence_boundary: "SOURCE_ONLY_INFERENCE",
        round_no: 3,
        title: "Payer mix and affordability"
      },
      {
        decision_focus: ["license scope", "medical care boundary"],
        evidence_boundary: "SOURCE_ONLY_INFERENCE",
        round_no: 4,
        title: "Medical-care license boundary"
      },
      {
        decision_focus: ["service quality", "staff safety", "family trust"],
        evidence_boundary: "SOURCE_ONLY_INFERENCE",
        round_no: 5,
        title: "Care quality and staffing risk"
      },
      {
        decision_focus: ["shadow replay candidate", "non-overwrite evidence"],
        evidence_boundary: "SOURCE_ONLY_INFERENCE",
        round_no: 6,
        title: "Replay and non-overwrite review"
      }
    ],
    scenario_package: {
      name: "R7-A Beijing-Yanjiao Eldercare Core Scenario Asset",
      plugin_package_ids: ["plugin_wellness_eldercare_v1"],
      scenario_package_id: "scenario_r7a_beijing_yanjiao_eldercare_v1",
      status: "approved",
      tenant_id: "tenant_r7a_synthetic",
      version: "1.0.0"
    },
    status_boundary: {
      g0_pass: "NOT_GRANTED",
      g0_status: "EXCEPTION",
      l1_status: "NOT_READY"
    },
    synthetic_data_policy: {
      production_identifier: false,
      real_payment_data: false,
      real_user_data: false
    }
  };
}

export function compileBeijingYanjiaoEldercareScenarioAsset(
  input: EldercareModelInput = createDefaultEldercareModelInput()
): EldercareScenarioAsset {
  const assetWithoutHash = buildAssetWithoutHash(input);

  return {
    ...assetWithoutHash,
    asset_hash: sha256(assetWithoutHash)
  };
}

export function validateEldercareScenarioAsset(asset: EldercareScenarioAsset): string[] {
  const errors: string[] = [];

  if (asset.rounds.length !== 6) {
    errors.push("expected_six_rounds");
  }

  if (asset.r7a_evidence.direct_store_delta !== "NONE") {
    errors.push("direct_store_delta_must_be_none");
  }

  if (asset.r7a_evidence.runtime_truth_change) {
    errors.push("runtime_truth_change_not_allowed");
  }

  if (asset.r7a_evidence.replay_writes_formal_results) {
    errors.push("replay_must_not_write_formal_results");
  }

  if (asset.synthetic_data_policy.real_user_data || asset.synthetic_data_policy.real_payment_data) {
    errors.push("synthetic_asset_must_not_include_real_data");
  }

  return errors;
}
