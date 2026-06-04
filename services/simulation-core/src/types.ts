import type {
  Decision,
  ParameterSet,
  PluginManifest,
  Round,
  Run,
  ScenarioPackage,
  Team,
  TeamSettlement
} from "@simwar/shared-contracts";

export interface SettlementEngineInput {
  run: Run;
  round: Round;
  scenario: ScenarioPackage;
  parameterSet: ParameterSet;
  teams: Team[];
  decisions: Decision[];
}

export interface TeamDecisionContext {
  team: Team;
  decision: Decision;
  parameterSet: ParameterSet;
  scenario: ScenarioPackage;
  run: Run;
  round: Round;
}

export interface MarketResult {
  rawDemand: number;
  marketSize: number;
  utilityShift: number;
}

export interface OperationsResult {
  capacity: number;
  servedDemand: number;
  capacityModifier: number;
}

export interface FinanceResult {
  revenue: number;
  cost: number;
  profit: number;
  cashFlow: number;
  policyCostShift: number;
}

export interface ScoreResult {
  score: number;
}

export interface TeamEngineResult {
  team: Team;
  decision: Decision;
  market: MarketResult;
  operations: OperationsResult;
  finance: FinanceResult;
  score: ScoreResult;
}

export interface SettlementPluginTrace {
  plugin_id: string;
  version: string;
  hooks: string[];
  adjustments: Record<string, number | string | boolean>;
}

export interface SettlementEngineOutput {
  engine_id: string;
  plugin_trace: SettlementPluginTrace[];
  team_results: TeamSettlement[];
}

export interface SettlementPlugin {
  plugin_id: string;
  version: string;
  manifest: PluginManifest;
  adjustDemand?(
    context: TeamDecisionContext,
    demand: number
  ): { demand: number; trace: SettlementPluginTrace };
  adjustOperations?(
    context: TeamDecisionContext,
    operations: OperationsResult
  ): { operations: OperationsResult; trace: SettlementPluginTrace };
  adjustFinance?(
    context: TeamDecisionContext,
    cost: number
  ): { cost: number; trace: SettlementPluginTrace };
  adjustScore?(
    context: TeamDecisionContext,
    score: number,
    inputs: { market: MarketResult; operations: OperationsResult; finance: FinanceResult }
  ): { score: number; trace: SettlementPluginTrace };
}

export interface SettlementEngine {
  engine_id: string;
  settle(input: SettlementEngineInput): SettlementEngineOutput;
}
