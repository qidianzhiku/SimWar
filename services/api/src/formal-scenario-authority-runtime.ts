import type { JsonFormalScenarioAuthorityPersistence } from "./json-repository-adapter.js";
import { ParameterSetCommandService } from "./parameter-set-authority.js";
import {
  createScenarioPackageAuthorityReadFacade,
  type ScenarioPackageAuthorityReadFacade
} from "./repository-facade.js";
import { ScenarioPackageCommandService } from "./scenario-package-authority.js";

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
  persistence: JsonFormalScenarioAuthorityPersistence
): JsonFormalScenarioAuthorityRuntime {
  const parameterRegistry = persistence.createParameterSetRegistry();
  const parameterSets = new ParameterSetCommandService(parameterRegistry);
  const scenarioRegistry = persistence.createScenarioPackageRegistry();
  const scenarioPackages = new ScenarioPackageCommandService(scenarioRegistry, parameterSets);

  return Object.freeze({
    catalog: createScenarioPackageAuthorityReadFacade({ authority: scenarioPackages }),
    parameterSets,
    scenarioPackages
  });
}
