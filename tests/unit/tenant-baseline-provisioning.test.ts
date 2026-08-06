import { describe, expect, it, vi } from "vitest";
import { createJsonFormalScenarioAuthorityRuntime } from "../../services/api/src/formal-scenario-authority-runtime";
import { createJsonFormalScenarioAuthorityPersistence } from "../../services/api/src/json-repository-adapter";
import {
  TenantBaselineProvisioningError,
  TenantBaselineProvisioningService
} from "../../services/api/src/tenant-baseline-provisioning";
import {
  calculateParameterSetContentDigest,
  ParameterSetAuthorityError
} from "../../services/api/src/parameter-set-authority";
import { calculateScenarioPackageContentDigest } from "../../services/api/src/scenario-package-authority";
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

async function seedApprovedSourceVersion(
  authority: ReturnType<typeof createFormalAuthorityRuntime>,
  version: string
) {
  const parameterDraft = await authority.parameterSets.createDraft(sourceActor, {
    compatibility_metadata: { engine_family: "toy_logit" },
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: "source_parameter",
    parameter_values: { base_capacity: 80, base_market_size: 100 },
    schema_version: "parameter-set.v1",
    tenant_id: sourceActor.tenant_id,
    version
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
    `source_parameter_approval_${version}`
  );
  const scenarioDraft = await authority.scenarioPackages.createDraft(sourceActor, {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { scenario_family: "wellness" },
    content: { rounds: 1 },
    metadata: { title: `Source baseline ${version}` },
    parameter_set_reference: parameterApproved.version.reference,
    plugin_dependencies: [],
    scenario_package_id: "source_scenario",
    schema_version: "scenario-package.v1",
    tenant_id: sourceActor.tenant_id,
    version
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
    `source_scenario_approval_${version}`
  );

  return {
    parameter: parameterApproved.version,
    scenario: scenarioApproved.version
  };
}

describe("TenantBaselineProvisioningService", () => {
  it("preserves legacy formal asset digests when baseline provenance is absent", async () => {
    const { parameter, scenario } = await seedApprovedSource();

    expect(
      calculateParameterSetContentDigest({
        compatibility_metadata: parameter.compatibility_metadata,
        model_version_ref: parameter.model_version_ref,
        parameter_set_id: parameter.parameter_set_id,
        parameter_values: parameter.parameter_values,
        schema_version: parameter.schema_version,
        tenant_id: parameter.tenant_id,
        version: parameter.version
      })
    ).toBe(parameter.content_digest);
    expect(
      calculateScenarioPackageContentDigest({
        artifact_policy: scenario.artifact_policy,
        compatibility_metadata: scenario.compatibility_metadata,
        content: scenario.content,
        metadata: scenario.metadata,
        parameter_set_reference: scenario.parameter_set_reference,
        plugin_dependencies: scenario.plugin_dependencies,
        scenario_package_id: scenario.scenario_package_id,
        schema_version: scenario.schema_version,
        tenant_id: scenario.tenant_id,
        version: scenario.version
      })
    ).toBe(scenario.content_digest);
  });

  it("rejects a conflicting redundant source scenario tenant in direct service calls", async () => {
    const { authority, parameter, scenario } = await seedApprovedSource();
    const service = new TenantBaselineProvisioningService(authority);

    await expect(
      service.provision(
        { actor_id: "usr_platform", correlation_id: "redundant_source_tenant_conflict" },
        {
          idempotency_key: "redundant-source-tenant-conflict-v1",
          source_parameter_set: {
            ...parameter.reference,
            source_tenant_id: sourceActor.tenant_id
          },
          source_scenario_package: {
            ...scenario.reference,
            source_tenant_id: sourceActor.tenant_id,
            tenant_id: "tenant_other"
          },
          target_tenant_id: "tenant_target"
        }
      )
    ).rejects.toMatchObject({ code: "REQUEST_INVALID" });
  });

  it("maps formal target identity races to the stable provisioning conflict", async () => {
    const { authority, parameter, scenario } = await seedApprovedSource();
    vi.spyOn(authority.parameterSets, "createDraft").mockRejectedValueOnce(
      new ParameterSetAuthorityError("PARAMETER_SET_VERSION_ALREADY_EXISTS")
    );
    const service = new TenantBaselineProvisioningService(authority);

    await expect(
      service.provision(
        { actor_id: "usr_platform", correlation_id: "formal_target_race" },
        {
          idempotency_key: "formal-target-race-v1",
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
    ).rejects.toMatchObject({
      code: "CONFLICT",
      name: "TenantBaselineProvisioningError"
    } satisfies Partial<TenantBaselineProvisioningError>);
  });

  it("ignores untyped legacy display metadata so it cannot alter formal provenance or reuse", async () => {
    const { authority, parameter, scenario } = await seedApprovedSource();
    const service = new TenantBaselineProvisioningService(authority);
    const request = {
      idempotency_key: "legacy-metadata-boundary-v1",
      source_parameter_set: {
        ...parameter.reference,
        source_tenant_id: sourceActor.tenant_id
      },
      source_scenario_package: {
        ...scenario.reference,
        source_tenant_id: sourceActor.tenant_id
      },
      target_tenant_id: "tenant_target"
    };

    const first = await service.provision(
      { actor_id: "usr_platform", correlation_id: "legacy_metadata_first" },
      {
        ...request,
        local_display_metadata: { password: "synthetic-password-only" }
      } as unknown as typeof request
    );
    const retried = await service.provision(
      { actor_id: "usr_platform", correlation_id: "legacy_metadata_retry" },
      {
        ...request,
        local_display_metadata: { access_token: "synthetic-access-token-only" }
      } as unknown as typeof request
    );

    expect(first.outcome).toBe("CREATED");
    expect(retried.outcome).toBe("REUSED");
    expect(first.provenance).not.toHaveProperty("requested_local_metadata");
    expect(retried.provenance.provisioning_request_digest).toBe(
      first.provenance.provisioning_request_digest
    );
  });

  it("changes the provisioning digest when structured target identity changes", async () => {
    const { authority, parameter, scenario } = await seedApprovedSource();
    const service = new TenantBaselineProvisioningService(authority);
    const source = {
      source_parameter_set: {
        ...parameter.reference,
        source_tenant_id: sourceActor.tenant_id
      },
      source_scenario_package: {
        ...scenario.reference,
        source_tenant_id: sourceActor.tenant_id
      }
    };

    const first = await service.provision(
      { actor_id: "usr_platform", correlation_id: "structured_digest_first" },
      { ...source, idempotency_key: "structured-digest-v1", target_tenant_id: "tenant_a" }
    );
    const changedTarget = await service.provision(
      { actor_id: "usr_platform", correlation_id: "structured_digest_changed_target" },
      { ...source, idempotency_key: "structured-digest-v1", target_tenant_id: "tenant_b" }
    );

    expect(first.provenance.provisioning_request_digest).not.toBe(
      changedTarget.provenance.provisioning_request_digest
    );
    expect(first.provenance).not.toHaveProperty("requested_local_metadata");
    expect(changedTarget.provenance).not.toHaveProperty("requested_local_metadata");
  });

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

  it("rejects a complete target pair whose formal approval evidence is missing", async () => {
    const { authority, parameter, scenario, store } = await seedApprovedSource();
    const service = new TenantBaselineProvisioningService(authority);
    const request = {
      idempotency_key: "missing-approval-evidence-v1",
      source_parameter_set: {
        ...parameter.reference,
        source_tenant_id: sourceActor.tenant_id
      },
      source_scenario_package: {
        ...scenario.reference,
        source_tenant_id: sourceActor.tenant_id
      },
      target_tenant_id: "tenant_target"
    };

    await expect(
      service.provision(
        { actor_id: "usr_platform", correlation_id: "missing_approval_create" },
        request
      )
    ).resolves.toMatchObject({ outcome: "CREATED" });

    store.formalParameterSetApprovalRecords.splice(
      0,
      store.formalParameterSetApprovalRecords.length,
      ...store.formalParameterSetApprovalRecords.filter(
        (record) => record.tenant_id !== request.target_tenant_id
      )
    );
    const countsBeforeRetry = {
      parameterApprovals: store.formalParameterSetApprovalRecords.length,
      parameterSnapshots: store.formalParameterSetLifecycleSnapshots.length,
      scenarioApprovals: store.formalScenarioPackageApprovalRecords.length,
      scenarioSnapshots: store.formalScenarioPackageLifecycleSnapshots.length
    };

    await expect(
      service.provision(
        { actor_id: "usr_platform", correlation_id: "missing_approval_retry" },
        request
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect({
      parameterApprovals: store.formalParameterSetApprovalRecords.length,
      parameterSnapshots: store.formalParameterSetLifecycleSnapshots.length,
      scenarioApprovals: store.formalScenarioPackageApprovalRecords.length,
      scenarioSnapshots: store.formalScenarioPackageLifecycleSnapshots.length
    }).toEqual(countsBeforeRetry);
  });

  it("treats malformed persisted provenance as a conflict instead of throwing", async () => {
    const { authority, parameter, scenario, store } = await seedApprovedSource();
    const service = new TenantBaselineProvisioningService(authority);
    const request = {
      idempotency_key: "malformed-provenance-conflict-v1",
      source_parameter_set: {
        ...parameter.reference,
        source_tenant_id: sourceActor.tenant_id
      },
      source_scenario_package: {
        ...scenario.reference,
        source_tenant_id: sourceActor.tenant_id
      },
      target_tenant_id: "tenant_target"
    };
    const created = await service.provision(
      { actor_id: "usr_platform", correlation_id: "malformed_provenance_create" },
      request
    );
    const targetParameterIndex = store.formalParameterSetLifecycleSnapshots.findLastIndex(
      (snapshot) =>
        snapshot.tenant_id === request.target_tenant_id &&
        snapshot.parameter_set_id === created.parameter_set.reference.parameter_set_id
    );
    expect(targetParameterIndex).toBeGreaterThanOrEqual(0);
    const targetParameter = store.formalParameterSetLifecycleSnapshots[targetParameterIndex]!;
    store.formalParameterSetLifecycleSnapshots[targetParameterIndex] = {
      ...targetParameter,
      baseline_provenance: {
        ...created.provenance,
        source_parameter_set: undefined
      } as unknown as typeof created.provenance
    };
    const countsBeforeRetry = {
      parameterApprovals: store.formalParameterSetApprovalRecords.length,
      parameterSnapshots: store.formalParameterSetLifecycleSnapshots.length,
      scenarioApprovals: store.formalScenarioPackageApprovalRecords.length,
      scenarioSnapshots: store.formalScenarioPackageLifecycleSnapshots.length
    };

    await expect(
      service.provision(
        { actor_id: "usr_platform", correlation_id: "malformed_provenance_retry" },
        request
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect({
      parameterApprovals: store.formalParameterSetApprovalRecords.length,
      parameterSnapshots: store.formalParameterSetLifecycleSnapshots.length,
      scenarioApprovals: store.formalScenarioPackageApprovalRecords.length,
      scenarioSnapshots: store.formalScenarioPackageLifecycleSnapshots.length
    }).toEqual(countsBeforeRetry);
  });

  it("rejects a V2 retry when the same deterministic target has incomplete V1 history", async () => {
    const { authority, parameter, scenario, store } = await seedApprovedSource();
    const service = new TenantBaselineProvisioningService(authority);
    const key = "partial-v1-v2-conflict-v1";
    const target = "tenant_target";

    await expect(
      service.provision(
        { actor_id: "usr_platform", correlation_id: "partial_v1_create" },
        {
          idempotency_key: key,
          source_parameter_set: {
            ...parameter.reference,
            source_tenant_id: sourceActor.tenant_id
          },
          source_scenario_package: {
            ...scenario.reference,
            source_tenant_id: sourceActor.tenant_id
          },
          target_tenant_id: target
        }
      )
    ).resolves.toMatchObject({ outcome: "CREATED" });

    store.formalParameterSetApprovalRecords.splice(
      0,
      store.formalParameterSetApprovalRecords.length,
      ...store.formalParameterSetApprovalRecords.filter((record) => record.tenant_id !== target)
    );
    store.formalScenarioPackageApprovalRecords.splice(
      0,
      store.formalScenarioPackageApprovalRecords.length,
      ...store.formalScenarioPackageApprovalRecords.filter((record) => record.tenant_id !== target)
    );
    const v2 = await seedApprovedSourceVersion(authority, "2.0.0");
    const countsBeforeRetry = {
      parameterApprovals: store.formalParameterSetApprovalRecords.length,
      parameterSnapshots: store.formalParameterSetLifecycleSnapshots.length,
      scenarioApprovals: store.formalScenarioPackageApprovalRecords.length,
      scenarioSnapshots: store.formalScenarioPackageLifecycleSnapshots.length
    };

    await expect(
      service.provision(
        { actor_id: "usr_platform", correlation_id: "partial_v1_v2_retry" },
        {
          idempotency_key: key,
          source_parameter_set: {
            ...v2.parameter.reference,
            source_tenant_id: sourceActor.tenant_id
          },
          source_scenario_package: {
            ...v2.scenario.reference,
            source_tenant_id: sourceActor.tenant_id
          },
          target_tenant_id: target
        }
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect({
      parameterApprovals: store.formalParameterSetApprovalRecords.length,
      parameterSnapshots: store.formalParameterSetLifecycleSnapshots.length,
      scenarioApprovals: store.formalScenarioPackageApprovalRecords.length,
      scenarioSnapshots: store.formalScenarioPackageLifecycleSnapshots.length
    }).toEqual(countsBeforeRetry);
  });
});
