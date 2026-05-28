import type { Decision } from "@simwar/shared-contracts";
import type {
  MarketResult,
  OperationsResult,
  SettlementPlugin,
  SettlementPluginTrace,
  TeamDecisionContext
} from "./types.js";

function getCapacityModifier(capacityPlan: Decision["payload"]["capacity_plan"]): number {
  if (capacityPlan === "expand") {
    return 1.18;
  }

  if (capacityPlan === "contract") {
    return 0.82;
  }

  return 1;
}

export function calculateOperations(
  context: TeamDecisionContext,
  market: MarketResult,
  plugins: SettlementPlugin[] = []
): { operations: OperationsResult; traces: SettlementPluginTrace[] } {
  const capacityModifier = getCapacityModifier(context.decision.payload.capacity_plan);
  let operations: OperationsResult = {
    capacity: context.parameterSet.base_capacity * capacityModifier,
    capacityModifier,
    servedDemand: Math.min(market.rawDemand, context.parameterSet.base_capacity * capacityModifier)
  };
  const traces: SettlementPluginTrace[] = [];

  for (const plugin of plugins) {
    const result = plugin.adjustOperations?.(context, operations);
    if (result) {
      operations = result.operations;
      traces.push(result.trace);
    }
  }

  return { operations, traces };
}
