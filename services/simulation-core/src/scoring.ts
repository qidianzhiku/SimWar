import type { TeamSettlement } from "@simwar/shared-contracts";
import type {
  FinanceResult,
  MarketResult,
  OperationsResult,
  ScoreResult,
  SettlementPlugin,
  SettlementPluginTrace,
  TeamDecisionContext,
  TeamEngineResult
} from "./types.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getDemandBand(demand: number): TeamSettlement["state_obs"]["demand_band"] {
  if (demand >= 145) {
    return "high";
  }

  if (demand >= 95) {
    return "medium";
  }

  return "low";
}

function getProfitBand(profit: number): TeamSettlement["state_obs"]["profit_band"] {
  if (profit > 160000) {
    return "healthy";
  }

  if (profit >= 0) {
    return "thin";
  }

  return "loss";
}

function getNextRoundRisk(input: {
  servedDemand: number;
  rawDemand: number;
  cashFlow: number;
  score: number;
}): TeamSettlement["state_est"]["next_round_risk"] {
  if (input.rawDemand > input.servedDemand * 1.08) {
    return "capacity";
  }

  if (input.cashFlow < 0) {
    return "cash";
  }

  if (input.score < 62) {
    return "demand";
  }

  return "balanced";
}

function buildExplanation(
  risk: TeamSettlement["state_est"]["next_round_risk"],
  cashBufferTarget: number
): string {
  if (risk === "capacity") {
    return "市场意愿超过可服务产能，下一轮需要优先处理容量和服务兑现。";
  }

  if (risk === "cash") {
    return "当前策略带来现金压力，下一轮应控制投入节奏并保留现金缓冲。";
  }

  if (risk === "demand") {
    return "需求转化不足，定价、渠道或服务感知需要重新校准。";
  }

  if (cashBufferTarget < 0.12) {
    return "经营结果较稳，但现金缓冲偏低，下一轮要避免过度冒进。";
  }

  return "策略在需求、服务兑现和财务结果之间保持相对平衡。";
}

export function calculateScore(
  context: TeamDecisionContext,
  market: MarketResult,
  operations: OperationsResult,
  finance: FinanceResult,
  plugins: SettlementPlugin[] = []
): { score: ScoreResult; traces: SettlementPluginTrace[] } {
  const marketShare = operations.servedDemand / market.marketSize;
  const demandScore = clamp(marketShare * 180, 0, 35);
  const profitScore = clamp((finance.profit + 250000) / 18000, 0, 30);
  const serviceScore = clamp(context.decision.payload.service_quality_budget / 12000, 0, 20);
  const riskPenalty = finance.cashFlow < 0 ? 8 : 0;
  let score = clamp(40 + demandScore + profitScore + serviceScore - riskPenalty, 0, 100);
  const traces: SettlementPluginTrace[] = [];

  for (const plugin of plugins) {
    const result = plugin.adjustScore?.(context, score, { market, operations, finance });
    if (result) {
      score = clamp(result.score, 0, 100);
      traces.push(result.trace);
    }
  }

  return { score: { score }, traces };
}

export function buildTeamSettlements(results: TeamEngineResult[]): TeamSettlement[] {
  const ranked = results
    .slice()
    .sort((left, right) => right.score.score - left.score.score)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return results.map((result) => {
    const entry = ranked.find((candidate) => candidate.team.team_id === result.team.team_id);

    if (!entry) {
      throw new Error(`missing_team_result:${result.team.team_id}`);
    }

    const roundedDemand = Math.round(entry.market.rawDemand);
    const roundedServed = Math.round(entry.operations.servedDemand);
    const roundedRevenue = round2(entry.finance.revenue);
    const roundedCost = round2(entry.finance.cost);
    const roundedProfit = round2(entry.finance.profit);
    const roundedCashFlow = round2(entry.finance.cashFlow);
    const roundedScore = round2(entry.score.score);
    const risk = getNextRoundRisk({
      servedDemand: entry.operations.servedDemand,
      rawDemand: entry.market.rawDemand,
      cashFlow: entry.finance.cashFlow,
      score: entry.score.score
    });

    return {
      team_id: entry.team.team_id,
      team_name: entry.team.name,
      state_true: {
        market_share: round2(entry.operations.servedDemand / entry.market.marketSize),
        demand: roundedDemand,
        served_demand: roundedServed,
        revenue: roundedRevenue,
        cost: roundedCost,
        profit: roundedProfit,
        cash_flow: roundedCashFlow,
        score: roundedScore,
        rank: entry.rank,
        settlement_status: "settled"
      },
      state_obs: {
        demand_band: getDemandBand(entry.market.rawDemand),
        served_demand: roundedServed,
        revenue: roundedRevenue,
        profit_band: getProfitBand(entry.finance.profit),
        score: roundedScore,
        rank: entry.rank
      },
      state_est: {
        next_round_risk: risk,
        explanation: buildExplanation(risk, entry.decision.payload.cash_buffer_target),
        recommended_focus:
          risk === "capacity"
            ? "capacity"
            : risk === "cash"
              ? "cash_buffer"
              : risk === "demand"
                ? "market_fit"
                : "balanced_execution"
      }
    };
  });
}
