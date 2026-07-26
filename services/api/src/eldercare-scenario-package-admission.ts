import {
  compileBeijingYanjiaoEldercareScenarioAsset,
  type EldercareScenarioAsset
} from "@simwar/simulation-core";
import type { ParameterSetReference } from "@simwar/shared-contracts";
import type { ParameterSetDraftInput } from "./parameter-set-authority.js";
import type { ScenarioPackageDraftInput } from "./scenario-package-authority.js";

export const R7D_SYNTHETIC_TENANT_ID = "tenant_r7a_synthetic";
export const R7D_ELDERCARE_SCENARIO_PACKAGE_ID = "scenario_r7a_beijing_yanjiao_eldercare_v1";
export const R7D_ELDERCARE_SCENARIO_PACKAGE_VERSION = "1.0.0";

function sourceAsset(): EldercareScenarioAsset {
  return compileBeijingYanjiaoEldercareScenarioAsset();
}

function toParameterValues(asset: EldercareScenarioAsset) {
  const parameters = asset.parameter_set.parameters;

  return {
    base_capacity: asset.parameter_set.base_capacity,
    base_market_size: asset.parameter_set.base_market_size,
    fixed_cost: asset.parameter_set.fixed_cost,
    seed: asset.parameter_set.seed,
    unit_cost: asset.parameter_set.unit_cost,
    wellness_parameters: parameters
      ? {
          cost_structure: {
            partnership_discount_rate: parameters.cost_structure.partnership_discount_rate,
            partnership_discount_threshold: parameters.cost_structure.partnership_discount_threshold
          },
          demand_curve: {
            max_quality_lift: parameters.demand_curve.max_quality_lift,
            price_friction_scale: parameters.demand_curve.price_friction_scale,
            price_sensitivity: parameters.demand_curve.price_sensitivity,
            quality_budget_per_utility: parameters.demand_curve.quality_budget_per_utility,
            quality_lift_weight: parameters.demand_curve.quality_lift_weight,
            reference_price: parameters.demand_curve.reference_price
          },
          operations_constraints: {
            max_capacity_modifier: parameters.operations_constraints.max_capacity_modifier,
            min_service_quality_budget: parameters.operations_constraints.min_service_quality_budget
          },
          schema_version: parameters.schema_version,
          scoring_weights: {
            max_service_quality_bonus: parameters.scoring_weights.max_service_quality_bonus,
            service_quality_bonus_per_budget:
              parameters.scoring_weights.service_quality_bonus_per_budget,
            underfunded_service_penalty: parameters.scoring_weights.underfunded_service_penalty
          }
        }
      : null
  };
}

/**
 * Builds the synthetic ParameterSet authority input locally for admission
 * tests. It is not persisted or exposed by a runtime route.
 */
export function createR7DEldercareParameterSetDraft(): ParameterSetDraftInput {
  const asset = sourceAsset();

  return {
    compatibility_metadata: {
      plugin_package: "plugin_wellness_eldercare_v1@1.0.0",
      source_asset: asset.asset_id
    },
    model_version_ref: asset.model_preview.model_family,
    parameter_set_id: asset.parameter_set.parameter_set_id,
    parameter_values: toParameterValues(asset),
    schema_version: asset.parameter_set.parameters?.schema_version ?? "wellness.parameters.v1",
    tenant_id: asset.parameter_set.tenant_id,
    version: asset.parameter_set.version
  };
}

/**
 * Maps the existing deep eldercare asset into generic, immutable
 * ScenarioPackage content without copying ParameterSet values, formal truth,
 * private traces, or replay artifacts into the ScenarioPackage.
 */
export function createR7DEldercareScenarioPackageDraft(
  parameterSetReference: ParameterSetReference
): ScenarioPackageDraftInput {
  const asset = sourceAsset();

  return {
    artifact_policy: {
      mode: "INLINE",
      retention: "IMMUTABLE"
    },
    compatibility_metadata: {
      compiler: "r7a-eldercare-scenario-compiler.v1",
      model_family: asset.model_preview.model_family,
      plugin_package: "plugin_wellness_eldercare_v1@1.0.0"
    },
    content: {
      learner_visibility_forbidden_categories: asset.learner_visibility_forbidden_categories.map(
        (category) => category
      ),
      regions: asset.regions.map((region) => ({
        demand_weight: region.demand_weight,
        display_name: region.display_name,
        distance_friction: region.distance_friction,
        income_index: region.income_index,
        region_id: region.region_id
      })),
      rounds: asset.rounds.map((round) => ({
        decision_focus: round.decision_focus.map((focus) => focus),
        evidence_boundary: round.evidence_boundary,
        round_no: round.round_no,
        title: round.title
      })),
      scenario_asset_hash: asset.asset_hash,
      scenario_asset_id: asset.asset_id,
      synthetic_data_policy: asset.synthetic_data_policy
    },
    metadata: {
      calibration_status: "UN_CALIBRATED_NOT_FOR_OPERATING_DECISION",
      license_provenance_id: "internal-synthetic-r7d-v1",
      privacy_classification: "synthetic_internal",
      title: asset.scenario_package.name
    },
    parameter_set_reference: parameterSetReference,
    plugin_dependencies: asset.scenario_package.plugin_package_ids.map((plugin_package_id) => ({
      plugin_package_id,
      version: "1.0.0"
    })),
    scenario_package_id: R7D_ELDERCARE_SCENARIO_PACKAGE_ID,
    schema_version: "scenario-package.eldercare.v1",
    tenant_id: R7D_SYNTHETIC_TENANT_ID,
    version: R7D_ELDERCARE_SCENARIO_PACKAGE_VERSION
  };
}
