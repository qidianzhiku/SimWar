import { createP1Store } from "../../services/api/src/store";

export const R7_GOLDEN_M1_READY_SCENARIO_ID = "scenario_r7_golden_m1_ready";
export const R7_GOLDEN_M1_READY_PARAMETER_SET_ID = "param_r7_golden_m1_ready";
export const R7_GOLDEN_M1_BLOCKED_PARAMETER_SET_ID = "param_r7_golden_m1_blocked";
export const R7_GOLDEN_M1_READY_RUN_ID = "run_r7_golden_m1_ready";
export const R7_GOLDEN_M1_BLOCKED_RUN_ID = "run_r7_golden_m1_blocked";
export const R7_GOLDEN_M1_READY_ROUND_ID = "round_r7_golden_m1_ready";
export const R7_GOLDEN_M1_BLOCKED_ROUND_ID = "round_r7_golden_m1_blocked";

/**
 * Seeds only the disposable Playwright JSON snapshot before the API process starts.
 * The browser journeys consume these references through the existing read-only BFF.
 */
export function seedR7GoldenM1ScenarioReadinessFixture(storeFile: string): void {
  const store = createP1Store({ persistenceFile: storeFile });
  const sourceScenario = store.scenarios.find(
    (scenario) => scenario.scenario_package_id === "scenario_eldercare_demo"
  );
  const sourceParameterSet = store.parameterSets.find(
    (parameterSet) => parameterSet.parameter_set_id === "param_toy_approved_1"
  );

  if (!sourceScenario || !sourceParameterSet) {
    throw new Error(
      "Golden M1 Playwright fixture requires the default synthetic scenario and parameter set."
    );
  }

  const fixtureIds = [
    R7_GOLDEN_M1_READY_SCENARIO_ID,
    R7_GOLDEN_M1_READY_PARAMETER_SET_ID,
    R7_GOLDEN_M1_BLOCKED_PARAMETER_SET_ID
  ];
  const fixtureAlreadyExists =
    store.scenarios.some((scenario) => fixtureIds.includes(scenario.scenario_package_id)) ||
    store.parameterSets.some((parameterSet) => fixtureIds.includes(parameterSet.parameter_set_id));

  if (fixtureAlreadyExists) {
    throw new Error("Golden M1 Playwright fixture must be seeded into a freshly reset store.");
  }

  store.scenarios.push({
    ...sourceScenario,
    scenario_package_id: R7_GOLDEN_M1_READY_SCENARIO_ID,
    name: "Synthetic Golden M1 Scenario Readiness Fixture",
    version: "1.0.0-golden-m1-ready"
  });
  store.parameterSets.push(
    {
      ...sourceParameterSet,
      parameter_set_id: R7_GOLDEN_M1_READY_PARAMETER_SET_ID,
      seed: 20260710,
      version: "1.0.0-golden-m1-ready"
    },
    {
      ...sourceParameterSet,
      parameter_set_id: R7_GOLDEN_M1_BLOCKED_PARAMETER_SET_ID,
      seed: 20260711,
      status: "candidate",
      version: "1.0.0-golden-m1-blocked"
    }
  );
  store.runs.push(
    {
      run_id: R7_GOLDEN_M1_BLOCKED_RUN_ID,
      tenant_id: sourceScenario.tenant_id,
      course_id: "course_demo",
      scenario_package_id: R7_GOLDEN_M1_READY_SCENARIO_ID,
      parameter_set_id: R7_GOLDEN_M1_BLOCKED_PARAMETER_SET_ID,
      seed: 20260711,
      status: "active"
    },
    {
      run_id: R7_GOLDEN_M1_READY_RUN_ID,
      tenant_id: sourceScenario.tenant_id,
      course_id: "course_demo",
      scenario_package_id: R7_GOLDEN_M1_READY_SCENARIO_ID,
      parameter_set_id: R7_GOLDEN_M1_READY_PARAMETER_SET_ID,
      seed: 20260710,
      status: "active"
    }
  );
  store.rounds.push(
    {
      round_id: R7_GOLDEN_M1_BLOCKED_ROUND_ID,
      tenant_id: sourceScenario.tenant_id,
      run_id: R7_GOLDEN_M1_BLOCKED_RUN_ID,
      round_no: 1,
      status: "draft"
    },
    {
      round_id: R7_GOLDEN_M1_READY_ROUND_ID,
      tenant_id: sourceScenario.tenant_id,
      run_id: R7_GOLDEN_M1_READY_RUN_ID,
      round_no: 1,
      status: "draft"
    }
  );
  store.persist();
}
