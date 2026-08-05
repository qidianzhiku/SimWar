import { describe, expect, it, vi } from "vitest";
import { createJsonFormalScenarioAuthorityRuntime } from "../../services/api/src/formal-scenario-authority-runtime";
import { createJsonFormalScenarioAuthorityPersistence } from "../../services/api/src/json-repository-adapter";
import { TenantBaselineProvisioningService } from "../../services/api/src/tenant-baseline-provisioning";
import type { SimWarStore } from "../../services/api/src/store";

type FormalAuthorityTestStore = Pick<
  SimWarStore,
  | "formalCourseBlueprintApprovalRecords"
  | "formalCourseBlueprintLifecycleSnapshots"
  | "formalParameterSetApprovalRecords"
  | "formalParameterSetLifecycleSnapshots"
  | "formalPluginReleaseApprovalRecords"
  | "formalPluginReleaseAvailabilityRecords"
  | "formalPluginReleaseLifecycleSnapshots"
  | "formalScenarioPackageApprovalRecords"
  | "formalScenarioPackageLifecycleSnapshots"
  | "persist"
>;

function createFormalAuthorityTestStore(): FormalAuthorityTestStore {
  return {
    formalCourseBlueprintApprovalRecords: [],
    formalCourseBlueprintLifecycleSnapshots: [],
    formalParameterSetApprovalRecords: [],
    formalParameterSetLifecycleSnapshots: [],
    formalPluginReleaseApprovalRecords: [],
    formalPluginReleaseAvailabilityRecords: [],
    formalPluginReleaseLifecycleSnapshots: [],
    formalScenarioPackageApprovalRecords: [],
    formalScenarioPackageLifecycleSnapshots: [],
    persist: () => undefined
  };
}

function createFormalAuthorityRuntime(store: FormalAuthorityTestStore) {
  return createJsonFormalScenarioAuthorityRuntime(
    createJsonFormalScenarioAuthorityPersistence(store as SimWarStore)
  );
}

const sourceActor = {
  actor_id: "usr_platform",
  capabilities: ["parameter_set:manage", "scenario_package:manage"],
  correlation_id: "tenant_baseline_unit_source",
  tenant_id: "tenant_source"
};

async function seedApprovedSource() {
  const store = createFormalAuthorityTestStore();
  const authority = createFormalAuthorityRuntime(store);
  const parameterDraft = await authority.parameterSets.createDraft(sourceActor, {
    compatibility_metadata: { engine_family: "toy_logit" },
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: "source_parameter",
    parameter_values: { base_capacity: 80, base_market_size: 100 },
    schema_version: "parameter-set.v1",
    tenant_id: sourceActor.tenant_id,
    version: "1.0.0"
  });
  const parameterValidated = await authority.parameterSets.validate(
    sourceActor,
    parameterDraft.reference
  );
  const parameterFrozen = await authority.parameterSets.freeze(
    sourceActor,
    parameterValidated.reference
  );
  const parameterApproved = await authority.parameterSets.approve(
    sourceActor,
    parameterFrozen.reference,
    "source_parameter_approval"
  );
  const scenarioDraft = await authority.scenarioPackages.createDraft(sourceActor, {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { scenario_family: "wellness" },
    content: { rounds: 1 },
    metadata: { title: "Source baseline" },
    parameter_set_reference: parameterApproved.version.reference,
    plugin_dependencies: [],
    scenario_package_id: "source_scenario",
    schema_version: "scenario-package.v1",
    tenant_id: sourceActor.tenant_id,
    version: "1.0.0"
  });
  const scenarioValidated = await authority.scenarioPackages.validate(
    sourceActor,
    scenarioDraft.reference
  );
  const scenarioFrozen = await authority.scenarioPackages.freeze(
    sourceActor,
    scenarioValidated.reference
  );
  const scenarioApproved = await authority.scenarioPackages.approve(
    sourceActor,
    scenarioFrozen.reference,
    "source_scenario_approval"
  );
  return {
    authority,
    parameter: parameterApproved.version,
    scenario: scenarioApproved.version,
    store
  };
}

describe("TenantBaselineProvisioningService", () => {
  it("rejects non-canonical tenant identifiers before materializing a baseline", async () => {
    const { authority, parameter, scenario, store } = await seedApprovedSource();
    const service = new TenantBaselineProvisioningService(authority);

    await expect(
      service.provision(
        { actor_id: "usr_platform", correlation_id: "noncanonical_target_unit" },
        {
          idempotency_key: "noncanonical-target-unit-v1",
          source_parameter_set: {
            ...parameter.reference,
            source_tenant_id: sourceActor.tenant_id
          },
          source_scenario_package: {
            ...scenario.reference,
            source_tenant_id: sourceActor.tenant_id
          },
          target_tenant_id: " tenant_target "
        }
      )
    ).rejects.toMatchObject({ code: "REQUEST_INVALID" });

    expect(
      store.formalParameterSetLifecycleSnapshots.some(
        (version) => version.tenant_id === " tenant_target "
      )
    ).toBe(false);
    expect(
      store.formalScenarioPackageLifecycleSnapshots.some(
        (version) => version.tenant_id === " tenant_target "
      )
    ).toBe(false);
  });

  it("compensates the formal JSON collections when ScenarioPackage materialization fails", async () => {
    const { parameter, scenario, store } = await seedApprovedSource();
    const sourceBefore = structuredClone({
      parameter: store.formalParameterSetLifecycleSnapshots,
      scenario: store.formalScenarioPackageLifecycleSnapshots
    });
    const originalPersist = store.persist;
    let failScenarioAppend = false;
    store.persist = () => {
      if (failScenarioAppend) {
        failScenarioAppend = false;
        throw new Error("simulated_scenario_append_failure");
      }
      originalPersist();
    };
    const operationAuthority = createFormalAuthorityRuntime(store);
    const concurrentActor = {
      actor_id: "usr_platform",
      capabilities: ["parameter_set:manage", "scenario_package:manage"],
      correlation_id: "tenant_baseline_unit_concurrent",
      tenant_id: "tenant_other"
    };
    const originalCreateScenarioDraft = operationAuthority.scenarioPackages.createDraft.bind(
      operationAuthority.scenarioPackages
    );
    vi.spyOn(operationAuthority.scenarioPackages, "createDraft").mockImplementation(
      async (actor, input) => {
        await operationAuthority.parameterSets.createDraft(concurrentActor, {
          compatibility_metadata: { engine_family: "toy_logit" },
          model_version_ref: "toy_logit_wellness_v1@0.1.0",
          parameter_set_id: "concurrent_parameter",
          parameter_values: { base_capacity: 120, base_market_size: 160 },
          schema_version: "parameter-set.v1",
          tenant_id: concurrentActor.tenant_id,
          version: "1.0.0"
        });
        failScenarioAppend = true;
        return originalCreateScenarioDraft(actor, input);
      }
    );
    const service = new TenantBaselineProvisioningService(operationAuthority);

    await expect(
      service.provision(
        { actor_id: "usr_platform", correlation_id: "partial_failure_unit" },
        {
          idempotency_key: "partial-failure-unit-v1",
          source_parameter_set: {
            ...parameter.reference,
            source_tenant_id: sourceActor.tenant_id
          },
          source_scenario_package: {
            ...scenario.reference,
            source_tenant_id: sourceActor.tenant_id
          },
          target_tenant_id: "tenant_target"
        }
      )
    ).rejects.toThrow("simulated_scenario_append_failure");

    expect(
      store.formalParameterSetLifecycleSnapshots.some(
        (version) => version.tenant_id === "tenant_target"
      )
    ).toBe(false);
    expect(
      store.formalScenarioPackageLifecycleSnapshots.some(
        (version) => version.tenant_id === "tenant_target"
      )
    ).toBe(false);
    expect(
      store.formalParameterSetLifecycleSnapshots.some(
        (version) =>
          version.tenant_id === concurrentActor.tenant_id &&
          version.parameter_set_id === "concurrent_parameter"
      )
    ).toBe(true);
    expect({
      parameter: store.formalParameterSetLifecycleSnapshots.filter(
        (version) => version.tenant_id === sourceActor.tenant_id
      ),
      scenario: store.formalScenarioPackageLifecycleSnapshots.filter(
        (version) => version.tenant_id === sourceActor.tenant_id
      )
    }).toEqual(sourceBefore);
  });
});
