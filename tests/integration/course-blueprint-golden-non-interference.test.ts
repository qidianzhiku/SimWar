import { describe, expect, it } from "vitest";
import type {
  Decision,
  ParameterSet,
  Round,
  Run,
  ScenarioPackage,
  Team
} from "../../packages/shared-contracts/src/index.js";
import { CourseBlueprintBindingStore } from "../../services/api/src/course-blueprint-binding-store.js";
import { createCourseBlueprintBinding } from "../../services/api/src/course-blueprint-binding.js";
import {
  prepareSettlementOutcome,
  previewSettlementReplay
} from "../../services/api/src/simulation.js";
import { createP1Store } from "../../services/api/src/store.js";

const tenantId = "tenant_demo";
const run: Run = {
  course_id: "course_golden_c1",
  parameter_set_id: "parameter_golden_c1",
  run_id: "run_golden_c1",
  scenario_package_id: "scenario_golden_c1",
  seed: 20260729,
  status: "active",
  tenant_id: tenantId
};
const round: Round = {
  round_id: "round_golden_c1",
  round_no: 1,
  run_id: run.run_id,
  status: "locked",
  tenant_id: tenantId
};
const scenario: ScenarioPackage = {
  name: "Golden C1 non-interference",
  plugin_package_ids: [],
  scenario_package_id: run.scenario_package_id,
  status: "approved",
  tenant_id: tenantId,
  version: "1.0.0"
};
const parameterSet: ParameterSet = {
  base_capacity: 120,
  base_market_size: 240,
  fixed_cost: 120000,
  model_family: "toy_logit",
  parameter_set_id: run.parameter_set_id,
  seed: run.seed,
  status: "approved",
  tenant_id: tenantId,
  unit_cost: 4200,
  version: "1.0.0"
};
const team: Team = {
  captain_user_id: "usr_student",
  course_id: run.course_id,
  members: [{
    display_name: "Golden Student",
    role_slot: "CEO",
    user_id: "usr_student"
  }],
  name: "Golden Team",
  team_id: "team_golden_c1",
  tenant_id: tenantId
};
const decision: Decision = {
  decision_id: "decision_golden_c1",
  payload: {
    capacity_plan: "expand",
    cash_buffer_target: 0.16,
    marketing_budget: 180000,
    pricing: { base_price: 12800 },
    service_quality_budget: 160000,
    strategy_statement: "Keep the exact Golden decision stable."
  },
  round_id: round.round_id,
  round_no: round.round_no,
  run_id: run.run_id,
  status: "validated",
  submitted_by: "usr_student",
  team_id: team.team_id,
  tenant_id: tenantId,
  validation_report: [],
  version: 1
};

describe("CourseBlueprint Golden non-interference", () => {
  it("keeps Settlement, Score, Rank, result digest, and replay hash identical with an exact Blueprint binding", () => {
    const baselineStore = createP1Store();
    const blueprintStore = createP1Store();
    new CourseBlueprintBindingStore(blueprintStore).append(createCourseBlueprintBinding({
      binding_schema_version: "course-blueprint-binding.v1",
      course_blueprint_reference: {
        content_digest: "c".repeat(64),
        course_blueprint_id: "blueprint_golden_c1",
        tenant_id: tenantId,
        version: "1.0.0"
      },
      course_id: run.course_id,
      tenant_id: tenantId
    }));

    const input = {
      decisions: [decision],
      parameterSet,
      round,
      run,
      scenario,
      teams: [team]
    };
    const baseline = prepareSettlementOutcome(structuredClone(input), {
      createSettlementResultId: () => "settlement_golden_c1"
    });
    const withBlueprint = prepareSettlementOutcome(structuredClone(input), {
      createSettlementResultId: () => "settlement_golden_c1"
    });
    const baselineDigest = previewSettlementReplay(structuredClone(input));
    const blueprintDigest = previewSettlementReplay(structuredClone(input));
    baselineStore.settlementResults.push(structuredClone(baseline.settlement));
    blueprintStore.settlementResults.push(structuredClone(withBlueprint.settlement));

    expect(baseline.settlement).toEqual(withBlueprint.settlement);
    expect(baseline.settlement.replay_hash).toBe(withBlueprint.settlement.replay_hash);
    expect(baselineDigest.result_digest).toBe(blueprintDigest.result_digest);
    expect(baseline.settlement.team_results.map(({ state_true }) => ({
      rank: state_true.rank,
      score: state_true.score
    }))).toEqual(withBlueprint.settlement.team_results.map(({ state_true }) => ({
      rank: state_true.rank,
      score: state_true.score
    })));
    expect(baselineStore.settlementResults).toEqual(blueprintStore.settlementResults);
    expect(baselineStore.courseBlueprintBindings).toEqual([]);
    expect(blueprintStore.courseBlueprintBindings).toHaveLength(1);
    expect(JSON.stringify(input)).not.toContain("course_blueprint");

    const baselineReplay = prepareSettlementOutcome(structuredClone(input), {
      createSettlementResultId: () => "unexpected",
      existingSettlement: baselineStore.settlementResults[0]
    });
    const blueprintReplay = prepareSettlementOutcome(structuredClone(input), {
      createSettlementResultId: () => "unexpected",
      existingSettlement: blueprintStore.settlementResults[0]
    });
    expect(baselineReplay).toEqual(blueprintReplay);
    expect(baselineReplay.shouldCommit).toBe(false);
    expect(baselineReplay.replayHashConflict).toBe(false);
    expect(baselineStore.settlementResults).toHaveLength(1);
    expect(blueprintStore.settlementResults).toHaveLength(1);
  });
});
