import type { Decision, Round, Run, Team } from "@simwar/shared-contracts";
import { describe, expect, it } from "vitest";
import { compileBeijingYanjiaoEldercareScenarioAsset } from "../../services/simulation-core/src/eldercare-scenario-compiler";
import { createToyLogitEngine } from "../../services/simulation-core/src/toy-logit-engine";

function team(team_id: string, name: string): Team {
  return {
    captain_user_id: `${team_id}_captain`,
    course_id: "course_r7a",
    members: [],
    name,
    team_id,
    tenant_id: "tenant_r7a"
  };
}

function decision(team_id: string, price: number, serviceQualityBudget: number): Decision {
  return {
    decision_id: `decision_${team_id}`,
    payload: {
      capacity_plan: "expand",
      cash_buffer_target: 0.18,
      marketing_budget: 150000,
      pricing: { base_price: price },
      service_quality_budget: serviceQualityBudget,
      strategy_statement: `R7-A compatibility decision for ${team_id}.`
    },
    round_id: "round_r7a_1",
    round_no: 1,
    run_id: "run_r7a",
    status: "validated",
    submitted_by: `${team_id}_captain`,
    team_id,
    tenant_id: "tenant_r7a",
    validation_report: [],
    version: 1
  };
}

describe("R7-A eldercare asset compatibility with Golden M1 settlement boundary", () => {
  it("can be consumed as a candidate scenario asset without widening student visibility", () => {
    const asset = compileBeijingYanjiaoEldercareScenarioAsset();
    const run: Run = {
      course_id: "course_r7a",
      parameter_set_id: asset.parameter_set.parameter_set_id,
      run_id: "run_r7a",
      scenario_package_id: asset.scenario_package.scenario_package_id,
      seed: asset.parameter_set.seed,
      status: "active",
      tenant_id: "tenant_r7a"
    };
    const round: Round = {
      round_id: "round_r7a_1",
      round_no: 1,
      run_id: run.run_id,
      status: "locked",
      tenant_id: run.tenant_id
    };
    const engine = createToyLogitEngine();
    const output = engine.settle({
      decisions: [decision("team_alpha", 13200, 180000), decision("team_beta", 11800, 130000)],
      parameterSet: asset.parameter_set,
      round,
      run,
      scenario: asset.scenario_package,
      teams: [team("team_alpha", "Alpha Eldercare Team"), team("team_beta", "Beta Eldercare Team")]
    });
    const studentSafe = output.team_results.map(
      ({ state_true: _stateTrue, ...visible }) => visible
    );

    expect(output.engine_id).toBe("toy_logit_wellness_v1");
    expect(output.team_results).toHaveLength(2);
    expect(
      output.team_results.every((result) => result.state_true.settlement_status === "settled")
    ).toBe(true);
    expect(JSON.stringify(studentSafe)).not.toContain("state_true");
    expect(JSON.stringify(studentSafe)).not.toContain("manifest_hash");
    expect(JSON.stringify(asset)).not.toContain("SettlementResult");
  });
});
