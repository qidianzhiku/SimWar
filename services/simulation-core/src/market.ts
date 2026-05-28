import type {
  MarketResult,
  SettlementPlugin,
  SettlementPluginTrace,
  TeamDecisionContext
} from "./types.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateMarketDemand(
  context: TeamDecisionContext,
  plugins: SettlementPlugin[]
): { market: MarketResult; traces: SettlementPluginTrace[] } {
  const decision = context.decision;
  const parameterSet = context.parameterSet;
  const price = decision.payload.pricing.base_price;
  const marketingLift = decision.payload.marketing_budget / 9000;
  const qualityLift = decision.payload.service_quality_budget / 11000;
  const pricePenalty = price / 210;
  const seedNoise = (parameterSet.seed % 17) / 10;
  const marketSize = parameterSet.base_market_size;
  let rawDemand = clamp(
    marketSize * 0.48 + marketingLift + qualityLift - pricePenalty + seedNoise,
    12,
    marketSize
  );
  const traces: SettlementPluginTrace[] = [];

  for (const plugin of plugins) {
    const result = plugin.adjustDemand?.(context, rawDemand);
    if (result) {
      rawDemand = clamp(result.demand, 0, marketSize);
      traces.push(result.trace);
    }
  }

  return {
    market: {
      rawDemand,
      marketSize,
      utilityShift: traces.reduce(
        (sum, trace) => sum + Number(trace.adjustments.utility_shift ?? 0),
        0
      )
    },
    traces
  };
}
