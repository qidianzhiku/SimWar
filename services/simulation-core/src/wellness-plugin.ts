import type { PluginManifest } from "@simwar/shared-contracts";
import type { OperationsResult, SettlementPlugin } from "./types.js";
import { getWellnessParameters } from "./wellness-parameters.js";

export const WELLNESS_PLUGIN_MANIFEST: PluginManifest = {
  manifest_version: "1.0.0",
  plugin_id: "plugin_wellness_v1",
  name: "康养行业插件 v1",
  version: "1.0.0",
  status: "approved",
  industry: "wellness",
  supported_hooks: ["adjustDemand", "adjustOperations", "adjustFinance", "adjustScore"],
  parameter_schema_version: "wellness.parameters.v1",
  parameter_schema_ref: "contracts/schemas/wellness-parameters.v1.json",
  settlement_hook_refs: [
    "adjustDemand:wellness_eldercare_demand_v1",
    "adjustOperations:wellness_capacity_guardrail_v1",
    "adjustFinance:wellness_partnership_discount_v1",
    "adjustScore:wellness_service_quality_weight_v1"
  ],
  adapter_ref: "@simwar/simulation-core/wellnessPluginV1"
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export const wellnessPluginV1: SettlementPlugin = {
  plugin_id: WELLNESS_PLUGIN_MANIFEST.plugin_id,
  version: WELLNESS_PLUGIN_MANIFEST.version,
  manifest: WELLNESS_PLUGIN_MANIFEST,
  adjustDemand(context, demand) {
    const parameters = getWellnessParameters(context.parameterSet);
    const qualityBudget = context.decision.payload.service_quality_budget;
    const careTrustLift = Math.min(
      parameters.demand_curve.max_quality_lift,
      qualityBudget / parameters.demand_curve.quality_budget_per_utility
    );
    const priceFriction = Math.max(
      0,
      (context.decision.payload.pricing.base_price - parameters.demand_curve.reference_price) /
        parameters.demand_curve.price_friction_scale
    );
    const utilityShift =
      careTrustLift * parameters.demand_curve.quality_lift_weight -
      priceFriction * parameters.demand_curve.price_sensitivity;

    return {
      demand: demand + utilityShift,
      trace: {
        plugin_id: this.plugin_id,
        version: this.version,
        hooks: ["adjustDemand"],
        adjustments: {
          utility_shift: round2(utilityShift),
          demand_curve: "wellness_eldercare_demand_v1",
          parameter_schema_version: parameters.schema_version
        }
      }
    };
  },
  adjustOperations(context, operations) {
    const parameters = getWellnessParameters(context.parameterSet);
    const maxCapacity =
      context.parameterSet.base_capacity * parameters.operations_constraints.max_capacity_modifier;
    const cappedCapacity = Math.min(operations.capacity, maxCapacity);
    const constrainedOperations: OperationsResult = {
      ...operations,
      capacity: cappedCapacity,
      servedDemand: Math.min(operations.servedDemand, cappedCapacity)
    };

    return {
      operations: constrainedOperations,
      trace: {
        plugin_id: this.plugin_id,
        version: this.version,
        hooks: ["adjustOperations"],
        adjustments: {
          capacity_delta: round2(constrainedOperations.capacity - operations.capacity),
          operations_constraint: "wellness_capacity_guardrail_v1",
          min_service_quality_budget: parameters.operations_constraints.min_service_quality_budget
        }
      }
    };
  },
  adjustFinance(context, cost) {
    const parameters = getWellnessParameters(context.parameterSet);
    const partnershipDiscount =
      context.decision.payload.service_quality_budget >=
      parameters.cost_structure.partnership_discount_threshold
        ? parameters.cost_structure.partnership_discount_rate
        : 0;
    const policyCostShift = -round2(cost * partnershipDiscount);

    return {
      cost: cost + policyCostShift,
      trace: {
        plugin_id: this.plugin_id,
        version: this.version,
        hooks: ["adjustFinance"],
        adjustments: {
          policy_cost_shift: policyCostShift,
          cost_structure: "wellness_partnership_discount_v1",
          partnership_discount_rate: partnershipDiscount
        }
      }
    };
  },
  adjustScore(context, score) {
    const parameters = getWellnessParameters(context.parameterSet);
    const bonus = Math.min(
      parameters.scoring_weights.max_service_quality_bonus,
      context.decision.payload.service_quality_budget *
        parameters.scoring_weights.service_quality_bonus_per_budget
    );
    const penalty =
      context.decision.payload.service_quality_budget <
      parameters.operations_constraints.min_service_quality_budget
        ? parameters.scoring_weights.underfunded_service_penalty
        : 0;
    const adjustedScore = score + bonus - penalty;

    return {
      score: adjustedScore,
      trace: {
        plugin_id: this.plugin_id,
        version: this.version,
        hooks: ["adjustScore"],
        adjustments: {
          score_delta: round2(adjustedScore - score),
          scoring_weight: "wellness_service_quality_weight_v1"
        }
      }
    };
  }
};
