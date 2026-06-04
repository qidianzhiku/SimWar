import type {
  FinanceResult,
  OperationsResult,
  SettlementPlugin,
  SettlementPluginTrace,
  TeamDecisionContext
} from "./types.js";

export function calculateFinance(
  context: TeamDecisionContext,
  operations: OperationsResult,
  plugins: SettlementPlugin[]
): { finance: FinanceResult; traces: SettlementPluginTrace[] } {
  const decision = context.decision;
  const parameterSet = context.parameterSet;
  const revenue = operations.servedDemand * decision.payload.pricing.base_price;
  const variableCost = operations.servedDemand * parameterSet.unit_cost;
  const expansionCost = decision.payload.capacity_plan === "expand" ? 45000 : 0;
  const contractionPenalty = decision.payload.capacity_plan === "contract" ? 15000 : 0;
  let cost =
    variableCost +
    parameterSet.fixed_cost +
    decision.payload.marketing_budget +
    decision.payload.service_quality_budget +
    expansionCost +
    contractionPenalty;
  const traces: SettlementPluginTrace[] = [];

  for (const plugin of plugins) {
    const result = plugin.adjustFinance?.(context, cost);
    if (result) {
      cost = result.cost;
      traces.push(result.trace);
    }
  }

  const profit = revenue - cost;

  return {
    finance: {
      revenue,
      cost,
      profit,
      cashFlow: profit - decision.payload.cash_buffer_target * 100000,
      policyCostShift: traces.reduce(
        (sum, trace) => sum + Number(trace.adjustments.policy_cost_shift ?? 0),
        0
      )
    },
    traces
  };
}
