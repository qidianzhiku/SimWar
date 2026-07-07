import type { Decision, Round, Run, Team } from "@simwar/shared-contracts";
import type { SettlementEngineOutput } from "../../services/simulation-core/src/types";
import { describe, expect, it } from "vitest";
import {
  approveR7BScenarioDraft,
  bindR7BFrozenScenarioToRun,
  buildR7BShadowReplayEvidence,
  compileR7BScenarioDraft,
  createR7BScenarioDraft,
  freezeR7BApprovedScenario,
  projectR7BScenarioForActor,
  validateR7BScenarioLifecycleRecord
} from "../../services/simulation-core/src/eldercare-scenario-lifecycle";
import { createToyLogitEngine } from "../../services/simulation-core/src/toy-logit-engine";

const teacherActor = {
  actor_id: "teacher_r7b",
  course_id: "course_r7b_synthetic",
  role: "teacher" as const,
  tenant_id: "tenant_r7b_synthetic"
};
const studentActor = {
  actor_id: "student_alpha_r7b",
  course_id: "course_r7b_synthetic",
  role: "student" as const,
  team_id: "team_alpha_r7b",
  tenant_id: "tenant_r7b_synthetic"
};

function team(team_id: string, name: string): Team {
  return {
    captain_user_id: `${team_id}_captain`,
    course_id: "course_r7b_synthetic",
    members: [],
    name,
    team_id,
    tenant_id: "tenant_r7b_synthetic"
  };
}

function decision(team_id: string, price: number, serviceQualityBudget: number): Decision {
  return {
    decision_id: `decision_${team_id}`,
    payload: {
      capacity_plan: "expand",
      cash_buffer_target: 0.2,
      marketing_budget: 165000,
      pricing: { base_price: price },
      service_quality_budget: serviceQualityBudget,
      strategy_statement: `R7-B lifecycle compatibility decision for ${team_id}.`
    },
    round_id: "round_r7b_1",
    round_no: 1,
    run_id: "run_r7b_synthetic_001",
    status: "validated",
    submitted_by: `${team_id}_captain`,
    team_id,
    tenant_id: "tenant_r7b_synthetic",
    validation_report: [],
    version: 1
  };
}

function boundScenario() {
  const compiled = compileR7BScenarioDraft(createR7BScenarioDraft({ actor: teacherActor }));
  expect(validateR7BScenarioLifecycleRecord(compiled).errors).toEqual([]);
  const approved = approveR7BScenarioDraft(compiled, { actor: teacherActor });
  return bindR7BFrozenScenarioToRun(freezeR7BApprovedScenario(approved, { actor: teacherActor }), {
    actor: teacherActor,
    run_id: "run_r7b_synthetic_001"
  });
}

function settle(boundScenarioRecord: ReturnType<typeof boundScenario>): SettlementEngineOutput {
  const run: Run = {
    course_id: "course_r7b_synthetic",
    parameter_set_id: boundScenarioRecord.asset.parameter_set.parameter_set_id,
    run_id: boundScenarioRecord.run_binding?.run_id ?? "run_r7b_synthetic_001",
    scenario_package_id: boundScenarioRecord.asset.scenario_package.scenario_package_id,
    seed: boundScenarioRecord.asset.parameter_set.seed,
    status: "active",
    tenant_id: boundScenarioRecord.tenant_id
  };
  const round: Round = {
    round_id: "round_r7b_1",
    round_no: 1,
    run_id: run.run_id,
    status: "locked",
    tenant_id: run.tenant_id
  };

  return createToyLogitEngine().settle({
    decisions: [
      decision("team_alpha_r7b", 13200, 180000),
      decision("team_beta_r7b", 11800, 130000)
    ],
    parameterSet: boundScenarioRecord.asset.parameter_set,
    round,
    run,
    scenario: boundScenarioRecord.asset.scenario_package,
    teams: [
      team("team_alpha_r7b", "Alpha Eldercare Team"),
      team("team_beta_r7b", "Beta Eldercare Team")
    ]
  });
}

describe("R7-B scenario lifecycle compatibility with Golden M1 and replay boundaries", () => {
  it("settles through the existing Golden M1 engine without widening student visibility", () => {
    const bound = boundScenario();
    const first = settle(bound);
    const second = settle(bound);
    const studentView = projectR7BScenarioForActor(bound, { actor: studentActor });
    const studentSafeResults = first.team_results.map(
      ({ state_true: _stateTrue, ...visible }) => visible
    );

    expect(first).toEqual(second);
    expect(bound.run_binding?.scenario_package_id).toBe(
      bound.asset.scenario_package.scenario_package_id
    );
    expect(bound.run_binding?.parameter_set_id).toBe(bound.asset.parameter_set.parameter_set_id);
    expect(first.team_results).toHaveLength(2);
    expect(JSON.stringify(studentView)).not.toContain("state_true");
    expect(JSON.stringify(studentView)).not.toContain("private_plugin_trace");
    expect(JSON.stringify(studentSafeResults)).not.toContain("state_true");
    expect(JSON.stringify(studentSafeResults)).not.toContain("manifest_hash");
  });

  it("creates shadow replay evidence without overwriting the official result", () => {
    const bound = boundScenario();
    const officialResult = settle(bound);
    const before = JSON.stringify(officialResult);
    const evidence = buildR7BShadowReplayEvidence(bound, officialResult);

    expect(evidence.replay_mode).toBe("shadow_replay");
    expect(evidence.replay_writes_formal_results).toBe(false);
    expect(evidence.official_result_non_overwrite).toBe(true);
    expect(evidence.bound_scenario_version).toBe(bound.asset.scenario_package.version);
    expect(JSON.stringify(officialResult)).toBe(before);
    expect(JSON.stringify(evidence.public_view)).not.toContain("state_true");
    expect(JSON.stringify(evidence.public_view)).not.toContain("private_replay");
  });
});
