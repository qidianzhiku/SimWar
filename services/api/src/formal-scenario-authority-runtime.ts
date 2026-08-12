import type {
  JsonFormalScenarioAuthorityPersistence,
  JsonTenantBaselineMaterialization
} from "./json-repository-adapter.js";
import { ParameterSetCommandService } from "./parameter-set-authority.js";
import { PluginReleaseCommandService } from "./plugin-release-authority.js";
import {
  createScenarioPackageAuthorityReadFacade,
  type ScenarioPackageAuthorityReadFacade
} from "./repository-facade.js";
import { ScenarioPackageCommandService } from "./scenario-package-authority.js";

export interface JsonFormalScenarioAuthorityRuntime {
  catalog: ScenarioPackageAuthorityReadFacade;
  parameterSets: ParameterSetCommandService;
  pluginReleases: PluginReleaseCommandService;
  removeTenantBaselineMaterialization(
    materialization: JsonTenantBaselineMaterialization
  ): void | Promise<void>;
  scenarioPackages: ScenarioPackageCommandService;
}

/**
 * Composes persisted formal-authority registries without activating them for
 * legacy Runs. Consumers must apply their own read-only authorization boundary.
 */
export function createJsonFormalScenarioAuthorityRuntime(
  persistence: JsonFormalScenarioAuthorityPersistence
): JsonFormalScenarioAuthorityRuntime {
  const parameterRegistry = persistence.createParameterSetRegistry();
  const parameterSets = new ParameterSetCommandService(parameterRegistry);
  const pluginRegistry = persistence.createPluginReleaseRegistry();
  const pluginReleases = new PluginReleaseCommandService(pluginRegistry);
  const scenarioRegistry = persistence.createScenarioPackageRegistry();
  const scenarioPackages = new ScenarioPackageCommandService(scenarioRegistry, parameterSets);

  return Object.freeze({
    catalog: createScenarioPackageAuthorityReadFacade({ authority: scenarioPackages }),
    parameterSets,
    pluginReleases,
    removeTenantBaselineMaterialization: (materialization: JsonTenantBaselineMaterialization) =>
      persistence.removeTenantBaselineMaterialization(materialization),
    scenarioPackages
  });
}
