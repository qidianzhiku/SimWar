import { describe, expect, it } from "vitest";
import type {
  Decision,
  FormalRunRuntimeBinding,
  ParameterSet,
  Round,
  Run,
  ScenarioPackage,
  Team
} from "../../packages/shared-contracts/src/index.js";
import { CourseBlueprintBindingStore } from "../../services/api/src/course-blueprint-binding-store.js";
import { createCourseBlueprintBinding } from "../../services/api/src/course-blueprint-binding.js";
import { createFormalCourseAuthorityBinding } from "../../services/api/src/formal-course-authority-binding.js";
import { FormalCourseAuthorityBindingStore } from "../../services/api/src/formal-course-authority-binding-store.js";
import {
  createFormalRunRuntimeBinding,
  type FormalRunBindingAuthorityPorts,
  type FormalRunParameterSetAuthorityBindingRecord,
  type FormalRunScenarioPackageAuthorityBindingRecord
} from "../../services/api/src/formal-run-runtime-binding.js";
import { FormalRunRuntimeBindingStore } from "../../services/api/src/formal-run-runtime-binding-store.js";
import { resolveFormalRuntimeInputsForActiveRun } from "../../services/api/src/formal-runtime-input-resolver.js";
import { createM1RunReplayEvidence } from "../../services/api/src/run-manifest-replay-evidence.js";
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

function createFormalAuthorities(): FormalRunBindingAuthorityPorts {
  const parameterReference = {
    content_digest: "a".repeat(64),
    parameter_set_id: run.parameter_set_id,
    version: "1.0.0"
  };
  const scenarioReference = {
    content_digest: "b".repeat(64),
    scenario_package_id: run.scenario_package_id,
    tenant_id: tenantId,
    version: "1.0.0"
  };
  const formalParameter: FormalRunParameterSetAuthorityBindingRecord = {
    compatibility_metadata: { engine_family: "toy_logit" },
    content_digest: parameterReference.content_digest,
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: parameterReference.parameter_set_id,
    parameter_values: {
      runtime_parameter_set: {
        base_capacity: parameterSet.base_capacity,
        base_market_size: parameterSet.base_market_size,
        fixed_cost: parameterSet.fixed_cost,
        model_family: parameterSet.model_family,
        unit_cost: parameterSet.unit_cost
      }
    },
    reference: parameterReference,
    schema_version: "parameter-set.v1",
    status: "APPROVED",
    tenant_id: tenantId,
    version: parameterReference.version
  };
  const formalScenario: FormalRunScenarioPackageAuthorityBindingRecord = {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { engine_family: "toy_logit" },
    content: {
      runtime_scenario_package: {
        name: scenario.name,
        plugin_package_ids: []
      }
    },
    content_digest: scenarioReference.content_digest,
    metadata: { title: scenario.name },
    parameter_set_reference: parameterReference,
    plugin_dependencies: [],
    reference: scenarioReference,
    scenario_package_id: scenarioReference.scenario_package_id,
    schema_version: "scenario-package.v1",
    status: "APPROVED",
    tenant_id: tenantId,
    version: scenarioReference.version
  };
  return {
    parameterSets: {
      assertBindable: async () => undefined,
      getByReference: async (_tenantId, reference) =>
        JSON.stringify(reference) === JSON.stringify(parameterReference) ? formalParameter : null
    },
    plugins: {
      getByReference: async () => null,
      resolveAvailableForNewBinding: async () => null
    },
    scenarios: {
      assertBindable: async () => undefined,
      getByReference: async (_tenantId, reference) =>
        JSON.stringify(reference) === JSON.stringify(scenarioReference) ? formalScenario : null
    }
  };
}

async function createFormalBindings(
  store: ReturnType<typeof createP1Store>,
  authorities: FormalRunBindingAuthorityPorts
): Promise<FormalRunRuntimeBinding> {
  const parameter_set_reference = {
    content_digest: "a".repeat(64),
    parameter_set_id: run.parameter_set_id,
    version: "1.0.0"
  };
  const scenario_package_reference = {
    content_digest: "b".repeat(64),
    scenario_package_id: run.scenario_package_id,
    tenant_id: tenantId,
    version: "1.0.0"
  };
  const courseBinding = await createFormalCourseAuthorityBinding({
    authorities,
    course_id: run.course_id,
    engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
    parameter_set_reference,
    scenario_package_reference,
    tenant_id: tenantId
  });
  new FormalCourseAuthorityBindingStore(store).append(courseBinding);
  const runBinding = await createFormalRunRuntimeBinding({
    authorities,
    engine_reference: courseBinding.engine_reference,
    parameter_set_reference: courseBinding.parameter_set_reference,
    run_id: run.run_id,
    scenario_package_reference: courseBinding.scenario_package_reference,
    seed: run.seed,
    tenant_id: tenantId
  });
  new FormalRunRuntimeBindingStore(store).append(runBinding);
  return runBinding;
}

describe("CourseBlueprint Golden non-interference", () => {
  it("keeps formal runtime resolution, Settlement, Score, Rank, and replay evidence identical with an exact Blueprint binding", async () => {
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

    const authorities = createFormalAuthorities();
    const baselineBinding = await createFormalBindings(baselineStore, authorities);
    const blueprintBinding = await createFormalBindings(blueprintStore, authorities);
    const baselineFormalInputs = await resolveFormalRuntimeInputsForActiveRun({
      authorities,
      binding: baselineBinding,
      run
    });
    const blueprintFormalInputs = await resolveFormalRuntimeInputsForActiveRun({
      authorities,
      binding: blueprintBinding,
      run
    });
    const baselineInput = {
      decisions: [decision],
      parameterSet: baselineFormalInputs.parameterSet,
      round,
      run,
      scenario: baselineFormalInputs.scenario,
      teams: [team]
    };
    const blueprintInput = {
      ...baselineInput,
      parameterSet: blueprintFormalInputs.parameterSet,
      scenario: blueprintFormalInputs.scenario
    };
    const baseline = prepareSettlementOutcome(structuredClone(baselineInput), {
      createSettlementResultId: () => "settlement_golden_c1"
    });
    const withBlueprint = prepareSettlementOutcome(structuredClone(blueprintInput), {
      createSettlementResultId: () => "settlement_golden_c1"
    });
    const baselineDigest = previewSettlementReplay(structuredClone(baselineInput));
    const blueprintDigest = previewSettlementReplay(structuredClone(blueprintInput));
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
    expect(baselineFormalInputs).toEqual(blueprintFormalInputs);
    expect(JSON.stringify(baselineInput)).not.toContain("course_blueprint");
    expect(JSON.stringify(blueprintInput)).not.toContain("course_blueprint");

    const baselineEvidence = createM1RunReplayEvidence({
      decisions: [decision],
      formal_runtime_binding: {
        binding: baselineBinding,
        formal_resolution_digest: baselineFormalInputs.formal_resolution_digest
      },
      parameterSet: baselineFormalInputs.parameterSet,
      round,
      run,
      scenario: baselineFormalInputs.scenario,
      settlement: baseline.settlement,
      teams: [team]
    });
    const blueprintEvidence = createM1RunReplayEvidence({
      decisions: [decision],
      formal_runtime_binding: {
        binding: blueprintBinding,
        formal_resolution_digest: blueprintFormalInputs.formal_resolution_digest
      },
      parameterSet: blueprintFormalInputs.parameterSet,
      round,
      run,
      scenario: blueprintFormalInputs.scenario,
      settlement: withBlueprint.settlement,
      teams: [team]
    });
    expect(baselineEvidence).toEqual(blueprintEvidence);
    expect(JSON.stringify(blueprintEvidence)).not.toContain("course_blueprint");

    const baselineReplay = prepareSettlementOutcome(structuredClone(baselineInput), {
      createSettlementResultId: () => "unexpected",
      existingSettlement: baselineStore.settlementResults[0]
    });
    const blueprintReplay = prepareSettlementOutcome(structuredClone(blueprintInput), {
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
