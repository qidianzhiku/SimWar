import { describe, expect, it } from "vitest";
import {
  createToyLogitEngine,
  DEFAULT_WELLNESS_PARAMETERS_V1,
  registerSettlementPlugin,
  resolveSettlementPlugins,
  WELLNESS_PLUGIN_MANIFEST
} from "../../services/simulation-core/src";
import type { SettlementPlugin } from "../../services/simulation-core/src";
import type {
  Decision,
  ParameterSet,
  Round,
  Run,
  ScenarioPackage,
  Team
} from "../../packages/shared-contracts/src";

const scenario: ScenarioPackage = {
  scenario_package_id: "scenario_eldercare_demo",
  tenant_id: "tenant_demo",
  name: "康养商战 P0 默认场景",
  version: "1.0.0",
  status: "approved",
  plugin_package_ids: ["plugin_wellness_v1"]
};

const parameterSet: ParameterSet = {
  parameter_set_id: "param_toy_approved_1",
  tenant_id: "tenant_demo",
  version: "1.0.0",
  status: "approved",
  model_family: "toy_logit",
  seed: 20260517,
  base_market_size: 240,
  base_capacity: 120,
  unit_cost: 4200,
  fixed_cost: 120000,
  parameters: DEFAULT_WELLNESS_PARAMETERS_V1
};

const run: Run = {
  run_id: "run_golden",
  tenant_id: "tenant_demo",
  course_id: "course_demo",
  scenario_package_id: scenario.scenario_package_id,
  parameter_set_id: parameterSet.parameter_set_id,
  seed: parameterSet.seed,
  status: "active"
};

const round: Round = {
  round_id: "round_golden",
  tenant_id: "tenant_demo",
  run_id: run.run_id,
  round_no: 1,
  status: "locked"
};

const team: Team = {
  team_id: "team_alpha",
  tenant_id: "tenant_demo",
  course_id: "course_demo",
  name: "Alpha 康养队",
  captain_user_id: "usr_student",
  members: [{ user_id: "usr_student", display_name: "P0 Student", role_slot: "CEO" }]
};

const decision: Decision = {
  decision_id: "decision_golden",
  tenant_id: "tenant_demo",
  run_id: run.run_id,
  round_id: round.round_id,
  round_no: round.round_no,
  team_id: team.team_id,
  status: "validated",
  version: 1,
  payload: {
    pricing: { base_price: 12800 },
    marketing_budget: 180000,
    service_quality_budget: 160000,
    capacity_plan: "expand",
    cash_buffer_target: 0.16,
    strategy_statement: "守住中高端康养客群并优先保证交付能力"
  },
  validation_report: [],
  submitted_by: "usr_student"
};

describe("toy_logit_wellness_v1 engine adapter", () => {
  it("keeps golden settlement output deterministic and plugin-traced", () => {
    const result = createToyLogitEngine().settle({
      run,
      round,
      scenario,
      parameterSet,
      teams: [team],
      decisions: [decision]
    });

    expect(result.engine_id).toBe("toy_logit_wellness_v1");
    expect(result.plugin_trace.map((trace) => trace.hooks[0])).toEqual([
      "adjustDemand",
      "adjustOperations",
      "adjustFinance",
      "adjustScore"
    ]);
    expect(result.plugin_trace[0]?.adjustments.parameter_schema_version).toBe(
      "wellness.parameters.v1"
    );
    expect(result.team_results[0]?.state_true).toMatchObject({
      market_share: 0.39,
      demand: 93,
      served_demand: 93,
      revenue: 1190311.34,
      cost: 882137.35,
      profit: 308173.99,
      cash_flow: 292173.99,
      score: 100,
      rank: 1,
      settlement_status: "settled"
    });
  });

  it("publishes a manifest that describes wellness parameters and settlement hooks", () => {
    expect(WELLNESS_PLUGIN_MANIFEST).toMatchObject({
      plugin_id: "plugin_wellness_v1",
      parameter_schema_version: "wellness.parameters.v1",
      parameter_schema_ref: "contracts/schemas/wellness-parameters.v1.json",
      supported_hooks: ["adjustDemand", "adjustOperations", "adjustFinance", "adjustScore"]
    });
  });

  it("keeps the same wellness input stable across repeated settlements", () => {
    const engine = createToyLogitEngine();
    const first = engine.settle({
      run,
      round,
      scenario,
      parameterSet,
      teams: [team],
      decisions: [decision]
    });
    const second = engine.settle({
      run,
      round,
      scenario,
      parameterSet,
      teams: [team],
      decisions: [decision]
    });

    expect(second).toEqual(first);
  });

  it("explains parameter-driven output differences through plugin traces", () => {
    const noPartnershipDiscount: ParameterSet = {
      ...parameterSet,
      parameter_set_id: "param_toy_no_partnership_discount",
      parameters: {
        ...DEFAULT_WELLNESS_PARAMETERS_V1,
        cost_structure: {
          ...DEFAULT_WELLNESS_PARAMETERS_V1.cost_structure,
          partnership_discount_rate: 0
        }
      }
    };

    const baseline = createToyLogitEngine().settle({
      run,
      round,
      scenario,
      parameterSet,
      teams: [team],
      decisions: [decision]
    });
    const candidate = createToyLogitEngine().settle({
      run,
      round,
      scenario,
      parameterSet: noPartnershipDiscount,
      teams: [team],
      decisions: [decision]
    });

    expect(candidate.team_results[0]?.state_true.profit).toBeLessThan(
      baseline.team_results[0]?.state_true.profit ?? 0
    );
    expect(
      candidate.plugin_trace.find((trace) => trace.hooks.includes("adjustFinance"))?.adjustments
        .partnership_discount_rate
    ).toBe(0);
  });

  it("resolves registered industry plugins without changing the engine main flow", () => {
    const registry = new Map<string, SettlementPlugin>();
    const testPlugin: SettlementPlugin = {
      plugin_id: "plugin_test_market_lift",
      version: "1.0.0",
      manifest: {
        ...WELLNESS_PLUGIN_MANIFEST,
        plugin_id: "plugin_test_market_lift",
        name: "Test market lift",
        supported_hooks: ["adjustDemand"],
        settlement_hook_refs: ["adjustDemand:test_market_lift_v1"],
        adapter_ref: "@simwar/test/marketLift"
      },
      adjustDemand(_context, demand) {
        return {
          demand: demand + 5,
          trace: {
            plugin_id: this.plugin_id,
            version: this.version,
            hooks: ["adjustDemand"],
            adjustments: { utility_shift: 5, hook: "test_market_lift_v1" }
          }
        };
      }
    };
    registerSettlementPlugin(testPlugin, registry);

    const [resolved] = resolveSettlementPlugins(["plugin_test_market_lift"], registry);
    const result = createToyLogitEngine(resolved ? [resolved] : []).settle({
      run,
      round,
      scenario: { ...scenario, plugin_package_ids: ["plugin_test_market_lift"] },
      parameterSet,
      teams: [team],
      decisions: [decision]
    });

    expect(result.plugin_trace.map((trace) => trace.plugin_id)).toEqual([
      "plugin_test_market_lift"
    ]);
    expect(result.team_results[0]?.state_true.demand).toBeGreaterThan(93);
  });
});
