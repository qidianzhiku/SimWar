import type { ParameterSet, WellnessParametersV1 } from "@simwar/shared-contracts";

export const WELLNESS_PARAMETERS_SCHEMA_VERSION = "wellness.parameters.v1" as const;

export const DEFAULT_WELLNESS_PARAMETERS_V1: WellnessParametersV1 = {
  schema_version: WELLNESS_PARAMETERS_SCHEMA_VERSION,
  demand_curve: {
    reference_price: 15000,
    price_friction_scale: 3500,
    quality_budget_per_utility: 40000,
    max_quality_lift: 9,
    quality_lift_weight: 1,
    price_sensitivity: 1
  },
  cost_structure: {
    partnership_discount_threshold: 150000,
    partnership_discount_rate: 0.015
  },
  operations_constraints: {
    max_capacity_modifier: 1.2,
    min_service_quality_budget: 60000
  },
  scoring_weights: {
    service_quality_bonus_per_budget: 0.00001,
    max_service_quality_bonus: 3,
    underfunded_service_penalty: 3
  }
};

export function getWellnessParameters(parameterSet: ParameterSet): WellnessParametersV1 {
  return parameterSet.parameters ?? DEFAULT_WELLNESS_PARAMETERS_V1;
}
