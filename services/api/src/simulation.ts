import { createHash } from "node:crypto";
import type { Decision, ParameterSet, Round, Run, ScenarioPackage, SettlementResult, Team, TeamSettlement } from "@simwar/shared-contracts";
import { nextId, type SimWarStore } from "./store.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildReplayHash(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function getCapacityModifier(capacityPlan: Decision["payload"]["capacity_plan"]): number {
  if (capacityPlan === "expand") {
    return 1.18;
  }

  if (capacityPlan === "contract") {
    return 0.82;
  }

  return 1;
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

function buildExplanation(risk: TeamSettlement["state_est"]["next_round_risk"], decision: Decision): string {
  if (risk === "capacity") {
    return "市场意愿超过可服务产能，下一轮需要优先处理容量和服务兑现。";
  }

  if (risk === "cash") {
    return "当前策略带来现金压力，下一轮应控制投入节奏并保留现金缓冲。";
  }

  if (risk === "demand") {
    return "需求转化不足，定价、渠道或服务感知需要重新校准。";
  }

  if (decision.payload.cash_buffer_target < 0.12) {
    return "经营结果较稳，但现金缓冲偏低，下一轮要避免过度冒进。";
  }

  return "策略在需求、服务兑现和财务结果之间保持相对平衡。";
}

export function validateDecisionPayload(payload: unknown): Array<{ field: string; reason: string }> {
  const errors: Array<{ field: string; reason: string }> = [];
  const candidate = payload as Partial<Decision["payload"]> | undefined;

  if (!candidate || typeof candidate !== "object") {
    return [{ field: "decision_payload", reason: "required_object" }];
  }

  const basePrice = candidate.pricing?.base_price;
  if (typeof basePrice !== "number" || basePrice < 6000 || basePrice > 30000) {
    errors.push({ field: "pricing.base_price", reason: "must_be_between_6000_and_30000" });
  }

  if (typeof candidate.marketing_budget !== "number" || candidate.marketing_budget < 0 || candidate.marketing_budget > 1000000) {
    errors.push({ field: "marketing_budget", reason: "must_be_between_0_and_1000000" });
  }

  if (
    typeof candidate.service_quality_budget !== "number" ||
    candidate.service_quality_budget < 0 ||
    candidate.service_quality_budget > 1000000
  ) {
    errors.push({ field: "service_quality_budget", reason: "must_be_between_0_and_1000000" });
  }

  if (candidate.capacity_plan !== "contract" && candidate.capacity_plan !== "hold" && candidate.capacity_plan !== "expand") {
    errors.push({ field: "capacity_plan", reason: "must_be_contract_hold_or_expand" });
  }

  if (typeof candidate.cash_buffer_target !== "number" || candidate.cash_buffer_target < 0 || candidate.cash_buffer_target > 0.6) {
    errors.push({ field: "cash_buffer_target", reason: "must_be_between_0_and_0_6" });
  }

  if (typeof candidate.strategy_statement !== "string" || candidate.strategy_statement.trim().length < 8) {
    errors.push({ field: "strategy_statement", reason: "must_be_at_least_8_chars" });
  }

  return errors;
}

export function settleRound(
  store: SimWarStore,
  input: {
    run: Run;
    round: Round;
    scenario: ScenarioPackage;
    parameterSet: ParameterSet;
    teams: Team[];
    decisions: Decision[];
  }
): SettlementResult {
  const existing = store.settlementResults.find(
    (result) => result.run_id === input.run.run_id && result.round_no === input.round.round_no
  );

  if (existing) {
    return existing;
  }

  const totalMarket = input.parameterSet.base_market_size;
  const initialTeamResults = input.teams.map((team) => {
    const decision = input.decisions.find((candidate) => candidate.team_id === team.team_id);

    if (!decision) {
      throw new Error(`missing_decision:${team.team_id}`);
    }

    const price = decision.payload.pricing.base_price;
    const marketingLift = decision.payload.marketing_budget / 9000;
    const qualityLift = decision.payload.service_quality_budget / 11000;
    const pricePenalty = price / 210;
    const seedNoise = (input.parameterSet.seed % 17) / 10;
    const rawDemand = clamp(totalMarket * 0.48 + marketingLift + qualityLift - pricePenalty + seedNoise, 12, totalMarket);
    const capacity = input.parameterSet.base_capacity * getCapacityModifier(decision.payload.capacity_plan);
    const servedDemand = Math.min(rawDemand, capacity);
    const marketShare = servedDemand / totalMarket;
    const revenue = servedDemand * price;
    const variableCost = servedDemand * input.parameterSet.unit_cost;
    const expansionCost = decision.payload.capacity_plan === "expand" ? 45000 : 0;
    const contractionPenalty = decision.payload.capacity_plan === "contract" ? 15000 : 0;
    const cost =
      variableCost +
      input.parameterSet.fixed_cost +
      decision.payload.marketing_budget +
      decision.payload.service_quality_budget +
      expansionCost +
      contractionPenalty;
    const profit = revenue - cost;
    const cashFlow = profit - decision.payload.cash_buffer_target * 100000;
    const demandScore = clamp(marketShare * 180, 0, 35);
    const profitScore = clamp((profit + 250000) / 18000, 0, 30);
    const serviceScore = clamp(decision.payload.service_quality_budget / 12000, 0, 20);
    const riskPenalty = cashFlow < 0 ? 8 : 0;
    const score = clamp(40 + demandScore + profitScore + serviceScore - riskPenalty, 0, 100);

    return {
      decision,
      rawDemand,
      servedDemand,
      team,
      values: {
        marketShare,
        revenue,
        cost,
        profit,
        cashFlow,
        score
      }
    };
  });

  const ranked = initialTeamResults
    .slice()
    .sort((left, right) => right.values.score - left.values.score)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const teamResults: TeamSettlement[] = input.teams.map((team) => {
    const entry = ranked.find((candidate) => candidate.team.team_id === team.team_id);

    if (!entry) {
      throw new Error(`missing_team_result:${team.team_id}`);
    }

    const roundedDemand = Math.round(entry.rawDemand);
    const roundedServed = Math.round(entry.servedDemand);
    const roundedRevenue = round2(entry.values.revenue);
    const roundedCost = round2(entry.values.cost);
    const roundedProfit = round2(entry.values.profit);
    const roundedCashFlow = round2(entry.values.cashFlow);
    const roundedScore = round2(entry.values.score);
    const risk = getNextRoundRisk({
      servedDemand: entry.servedDemand,
      rawDemand: entry.rawDemand,
      cashFlow: entry.values.cashFlow,
      score: entry.values.score
    });

    return {
      team_id: team.team_id,
      team_name: team.name,
      state_true: {
        market_share: round2(entry.values.marketShare),
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
        demand_band: getDemandBand(entry.rawDemand),
        served_demand: roundedServed,
        revenue: roundedRevenue,
        profit_band: getProfitBand(entry.values.profit),
        score: roundedScore,
        rank: entry.rank
      },
      state_est: {
        next_round_risk: risk,
        explanation: buildExplanation(risk, entry.decision),
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

  const replayHash = buildReplayHash({
    parameter_set_id: input.parameterSet.parameter_set_id,
    scenario_package_id: input.scenario.scenario_package_id,
    run_id: input.run.run_id,
    round_no: input.round.round_no,
    seed: input.run.seed,
    decisions: input.decisions.map((decision) => ({
      team_id: decision.team_id,
      version: decision.version,
      payload: decision.payload
    })),
    team_results: teamResults.map((result) => result.state_true)
  });

  const settlement: SettlementResult = {
    settlement_result_id: nextId(store, "result", "result"),
    tenant_id: input.run.tenant_id,
    run_id: input.run.run_id,
    round_id: input.round.round_id,
    round_no: input.round.round_no,
    parameter_set_id: input.parameterSet.parameter_set_id,
    scenario_package_id: input.scenario.scenario_package_id,
    replay_hash: replayHash,
    team_results: teamResults
  };

  input.round.status = "settled";
  input.round.replay_hash = replayHash;
  store.settlementResults.push(settlement);

  return settlement;
}
