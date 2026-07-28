import { describe, expect, it } from "vitest";
import type { PluginManifest } from "../../packages/shared-contracts/src";
import {
  FormalRunRuntimeBindingError,
  createFormalRunRuntimeBinding
} from "../../services/api/src/formal-run-runtime-binding";
import { resolveFormalRuntimeInputsForHistoricalRead } from "../../services/api/src/formal-runtime-input-resolver";
import {
  InMemoryJsonParameterSetRegistry,
  ParameterSetCommandService,
  type ParameterSetAuthorityActor,
  type ParameterSetVersion
} from "../../services/api/src/parameter-set-authority";
import {
  InMemoryJsonPluginReleaseRegistry,
  PluginReleaseCommandService,
  type PluginReleaseAuthorityActor,
  type PluginReleaseVersion
} from "../../services/api/src/plugin-release-authority";
import {
  InMemoryJsonScenarioPackageRegistry,
  ScenarioPackageCommandService,
  type ScenarioPackageAuthorityActor,
  type ScenarioPackageVersion
} from "../../services/api/src/scenario-package-authority";

const TENANT_ID = "tenant_formal_runtime_input";

const parameterActor: ParameterSetAuthorityActor = {
  actor_id: "parameter_admin",
  capabilities: ["parameter_set:manage"],
  correlation_id: "correlation_parameter",
  tenant_id: TENANT_ID
};

const pluginActor: PluginReleaseAuthorityActor = {
  actor_id: "plugin_release_admin",
  capabilities: [
    "plugin_release:manage",
    "plugin_release:approve",
    "plugin_release:make_available"
  ],
  correlation_id: "correlation_plugin_release"
};

const scenarioActor: ScenarioPackageAuthorityActor = {
  actor_id: "scenario_admin",
  capabilities: ["scenario_package:manage"],
  correlation_id: "correlation_scenario",
  tenant_id: TENANT_ID
};

function pluginManifest(): PluginManifest {
  return {
    adapter_ref: "@simwar/simulation-core/eldercareResolverTestPlugin",
    industry: "wellness",
    manifest_version: "1.0.0",
    name: "Formal runtime input resolver test plugin",
    parameter_schema_ref: "contracts/fixtures/eldercare-resolver-test.json",
    parameter_schema_version: "eldercare.parameters.v1",
    plugin_id: "plugin_wellness_eldercare_resolver_test",
    settlement_hook_refs: ["adjustFinance:eldercare.resolver-test.v1"],
    status: "approved",
    supported_hooks: ["adjustFinance"],
    version: "1.0.0"
  };
}

async function approveParameterSet(
  service: ParameterSetCommandService
): Promise<ParameterSetVersion> {
  const draft = await service.createDraft(parameterActor, {
    compatibility_metadata: { engine_family: "eldercare-core.v1" },
    model_version_ref: "eldercare-core.v1@1.0.0",
    parameter_set_id: "parameter_set_resolver_test",
    parameter_values: { base_capacity: 100, base_market_size: 200 },
    schema_version: "parameter-set.v1",
    tenant_id: TENANT_ID,
    version: "1.0.0"
  });
  const validated = await service.validate(parameterActor, draft.reference);
  const frozen = await service.freeze(parameterActor, validated.reference);
  return (
    await service.approve(parameterActor, frozen.reference, "parameter-approval-resolver-test")
  ).version;
}

async function makePluginAvailable(
  service: PluginReleaseCommandService
): Promise<PluginReleaseVersion> {
  const draft = await service.createDraft(pluginActor, {
    compatibility_metadata: { engine_family: "eldercare-core.v1" },
    official_commit_permissions: [],
    plugin_manifest: pluginManifest(),
    plugin_package_id: "plugin_wellness_eldercare_resolver_test",
    schema_version: "plugin-release.v1",
    version: "1.0.0"
  });
  const validated = await service.validate(pluginActor, draft.reference);
  const approved = await service.approve(
    pluginActor,
    validated.reference,
    "plugin-approval-resolver-test"
  );
  return (
    await service.makeAvailable(
      pluginActor,
      approved.version.reference,
      "plugin-availability-resolver-test"
    )
  ).version;
}

async function approveScenarioPackage(
  service: ScenarioPackageCommandService,
  parameterSet: ParameterSetVersion,
  pluginRelease: PluginReleaseVersion
): Promise<ScenarioPackageVersion> {
  const draft = await service.createDraft(scenarioActor, {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { engine_family: "eldercare-core.v1" },
    content: { market: "synthetic_eldercare" },
    metadata: { title: "Formal runtime input resolver scenario" },
    parameter_set_reference: parameterSet.reference,
    plugin_dependencies: [
      {
        plugin_package_id: pluginRelease.plugin_package_id,
        version: pluginRelease.version
      }
    ],
    scenario_package_id: "scenario_package_resolver_test",
    schema_version: "scenario-package.v1",
    tenant_id: TENANT_ID,
    version: "1.0.0"
  });
  const validated = await service.validate(scenarioActor, draft.reference);
  const frozen = await service.freeze(scenarioActor, validated.reference);
  return (await service.approve(scenarioActor, frozen.reference, "scenario-approval-resolver-test"))
    .version;
}

async function createHarness() {
  const parameterSets = new ParameterSetCommandService(new InMemoryJsonParameterSetRegistry());
  const plugins = new PluginReleaseCommandService(new InMemoryJsonPluginReleaseRegistry());
  const parameterSet = await approveParameterSet(parameterSets);
  const pluginRelease = await makePluginAvailable(plugins);
  const scenarios = new ScenarioPackageCommandService(
    new InMemoryJsonScenarioPackageRegistry(),
    parameterSets
  );
  const scenarioPackage = await approveScenarioPackage(scenarios, parameterSet, pluginRelease);
  const authorities = { parameterSets, plugins, scenarios };
  const binding = await createFormalRunRuntimeBinding({
    authorities,
    engine_reference: { engine_id: "eldercare-core", version: "1.0.0" },
    parameter_set_reference: parameterSet.reference,
    run_id: "run_formal_runtime_input_001",
    scenario_package_reference: scenarioPackage.reference,
    seed: 20260728,
    tenant_id: TENANT_ID
  });

  return {
    authorities,
    binding,
    parameterSet,
    parameterSets,
    pluginRelease,
    plugins,
    scenarioPackage,
    scenarios
  };
}

describe("formal runtime input resolver", () => {
  it("materializes immutable, digest-addressed formal inputs without an active runtime composition", async () => {
    const harness = await createHarness();
    const resolution = await resolveFormalRuntimeInputsForHistoricalRead({
      authorities: harness.authorities,
      binding: harness.binding
    });

    expect(resolution.resolution_schema_version).toBe("formal-runtime-input-resolution.v1");
    expect(resolution.resolution_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(resolution.binding).toEqual(harness.binding);
    expect(resolution.parameter_set.parameter_set_reference).toEqual(
      harness.parameterSet.reference
    );
    expect(resolution.scenario_package.scenario_package_reference).toEqual(
      harness.scenarioPackage.reference
    );
    expect(resolution.plugin_releases).toHaveLength(1);
    expect(resolution.plugin_releases[0]!.plugin_release_reference).toEqual(
      harness.pluginRelease.reference
    );
    expect(resolution.parameter_set).not.toHaveProperty("status");
    expect(resolution.scenario_package).not.toHaveProperty("status");
    expect(Object.isFrozen(resolution)).toBe(true);
    expect(Object.isFrozen(resolution.parameter_set)).toBe(true);
    expect(() => {
      (resolution.parameter_set.compatibility_metadata as Record<string, string>).engine_family =
        "mutated";
    }).toThrow();
  });

  it("keeps retired exact inputs historically readable without silently upgrading them", async () => {
    const harness = await createHarness();
    const initial = await resolveFormalRuntimeInputsForHistoricalRead({
      authorities: harness.authorities,
      binding: harness.binding
    });

    await harness.plugins.retire(pluginActor, harness.pluginRelease.reference);
    await harness.scenarios.retire(scenarioActor, harness.scenarioPackage.reference);
    await harness.parameterSets.retire(parameterActor, harness.parameterSet.reference);

    const historical = await resolveFormalRuntimeInputsForHistoricalRead({
      authorities: harness.authorities,
      binding: harness.binding
    });

    expect(historical.resolution_digest).toBe(initial.resolution_digest);
    expect(historical.parameter_set.parameter_set_reference).toEqual(
      harness.parameterSet.reference
    );
    expect(historical.scenario_package.scenario_package_reference).toEqual(
      harness.scenarioPackage.reference
    );
    expect(historical.plugin_releases[0]!.plugin_release_reference).toEqual(
      harness.pluginRelease.reference
    );
  });

  it("fails closed when the supplied binding no longer matches its digest", async () => {
    const harness = await createHarness();

    await expect(
      resolveFormalRuntimeInputsForHistoricalRead({
        authorities: harness.authorities,
        binding: { ...harness.binding, seed: harness.binding.seed + 1 }
      })
    ).rejects.toThrow(new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_DIGEST_MISMATCH"));
  });
});
