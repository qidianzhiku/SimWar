import {
  InMemoryJsonParameterSetRegistry,
  ParameterSetCommandService
} from "./parameter-set-authority.js";
import {
  createScenarioPackageAuthorityReadFacade,
  type ScenarioPackageAuthorityReadFacade
} from "./repository-facade.js";
import {
  InMemoryJsonScenarioPackageRegistry,
  ScenarioPackageCommandService
} from "./scenario-package-authority.js";
import type { SimWarStore } from "./store.js";

export interface JsonFormalScenarioAuthorityRuntime {
  catalog: ScenarioPackageAuthorityReadFacade;
  parameterSets: ParameterSetCommandService;
  scenarioPackages: ScenarioPackageCommandService;
}

/**
 * Composes persisted formal-authority registries without activating them for
 * legacy Runs or exposing a Teacher runtime-selection route.
 */
export function createJsonFormalScenarioAuthorityRuntime(
  store: SimWarStore
): JsonFormalScenarioAuthorityRuntime {
  const parameterRegistry = new InMemoryJsonParameterSetRegistry({
    approvals: store.formalParameterSetApprovalRecords,
    onAppend: store.persist,
    snapshots: store.formalParameterSetLifecycleSnapshots
  });
  const parameterSets = new ParameterSetCommandService(parameterRegistry);
  const scenarioRegistry = new InMemoryJsonScenarioPackageRegistry({
    approvals: store.formalScenarioPackageApprovalRecords,
    onAppend: store.persist,
    snapshots: store.formalScenarioPackageLifecycleSnapshots
  });
  const scenarioPackages = new ScenarioPackageCommandService(scenarioRegistry, parameterSets);

  return Object.freeze({
    catalog: createScenarioPackageAuthorityReadFacade({ authority: scenarioPackages }),
    parameterSets,
    scenarioPackages
  });
}
