import type { Decision } from "@simwar/shared-contracts";
import { calculateFinance } from "./finance.js";
import { calculateMarketDemand } from "./market.js";
import { calculateOperations } from "./operations.js";
import { buildTeamSettlements, calculateScore } from "./scoring.js";
import type {
  SettlementEngine,
  SettlementEngineInput,
  SettlementEngineOutput,
  SettlementPlugin,
  SettlementPluginTrace,
  TeamEngineResult
} from "./types.js";
import { wellnessPluginV1 } from "./wellness-plugin.js";

const defaultPluginRegistry = new Map<string, SettlementPlugin>([
  [wellnessPluginV1.plugin_id, wellnessPluginV1]
]);

function latestDecisionForTeam(decisions: Decision[], teamId: string): Decision | undefined {
  return decisions
    .filter((decision) => decision.team_id === teamId)
    .sort((left, right) => left.version - right.version)
    .at(-1);
}

export function createToyLogitEngine(
  plugins: SettlementPlugin[] = [wellnessPluginV1]
): SettlementEngine {
  return {
    engine_id: "toy_logit_wellness_v1",
    settle(input: SettlementEngineInput): SettlementEngineOutput {
      const pluginTrace: SettlementPluginTrace[] = [];
      const teamResults: TeamEngineResult[] = input.teams.map((team) => {
        const decision = latestDecisionForTeam(input.decisions, team.team_id);

        if (!decision) {
          throw new Error(`missing_decision:${team.team_id}`);
        }

        const context = {
          team,
          decision,
          parameterSet: input.parameterSet,
          scenario: input.scenario,
          run: input.run,
          round: input.round
        };
        const { market, traces: marketTraces } = calculateMarketDemand(context, plugins);
        const { operations, traces: operationsTraces } = calculateOperations(
          context,
          market,
          plugins
        );
        const { finance, traces: financeTraces } = calculateFinance(context, operations, plugins);
        const { score, traces: scoreTraces } = calculateScore(
          context,
          market,
          operations,
          finance,
          plugins
        );
        pluginTrace.push(...marketTraces, ...operationsTraces, ...financeTraces, ...scoreTraces);

        return {
          team,
          decision,
          market,
          operations,
          finance,
          score
        };
      });

      return {
        engine_id: this.engine_id,
        plugin_trace: pluginTrace,
        team_results: buildTeamSettlements(teamResults)
      };
    }
  };
}

export function registerSettlementPlugin(
  plugin: SettlementPlugin,
  registry: Map<string, SettlementPlugin> = defaultPluginRegistry
): Map<string, SettlementPlugin> {
  registry.set(plugin.plugin_id, plugin);
  return registry;
}

export function resolveSettlementPlugins(
  pluginPackageIds: string[],
  registry: Map<string, SettlementPlugin> = defaultPluginRegistry
): SettlementPlugin[] {
  return pluginPackageIds
    .map((pluginPackageId) => registry.get(pluginPackageId))
    .filter((plugin): plugin is SettlementPlugin => Boolean(plugin));
}
