import { describe, expect, it } from "vitest";
import type { Run } from "../../packages/shared-contracts/src";
import {
  FormalRunRuntimeBindingError,
  assertRunMatchesFormalRuntimeBinding,
  createFormalRunRuntimeBinding,
  resolveFormalRunRuntimeBindingForHistoricalRead
} from "../../services/api/src/formal-run-runtime-binding";
import {
  InMemoryJsonParameterSetRegistry,
  ParameterSetCommandService,
  type ParameterSetAuthorityActor,
  type ParameterSetVersion
} from "../../services/api/src/parameter-set-authority";
import {
  InMemoryJsonScenarioPackageRegistry,
  ScenarioPackageCommandService,
  type ScenarioPackageAuthorityActor,
  type ScenarioPackageVersion
} from "../../services/api/src/scenario-package-authority";

const TENANT_ID = "tenant_formal_run_binding";

const parameterActor: ParameterSetAuthorityActor = {
  actor_id: "parameter_admin",
  capabilities: ["parameter_set:manage"],
  correlation_id: "correlation_parameter",
  tenant_id: TENANT_ID
};

const scenarioActor: ScenarioPackageAuthorityActor = {
  actor_id: "scenario_admin",
  capabilities: ["scenario_package:manage"],
  correlation_id: "correlation_scenario",
  tenant_id: TENANT_ID
};

async function approveParameterSet(
  service: ParameterSetCommandService,
  input: { parameter_set_id: string; version: string }
): Promise<ParameterSetVersion> {
  const draft = await service.createDraft(parameterActor, {
    compatibility_metadata: { engine_family: "toy_logit" },
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: input.parameter_set_id,
    parameter_values: { base_capacity: 100, base_market_size: 200 },
    schema_version: "parameter-set.v1",
    tenant_id: TENANT_ID,
    version: input.version
  });
  const validated = await service.validate(parameterActor, draft.reference);
  const frozen = await service.freeze(parameterActor, validated.reference);
  return (
    await service.approve(
      parameterActor,
      frozen.reference,
      `approval_${input.parameter_set_id}_${input.version}`
    )
  ).version;
}

async function approveScenarioPackage(
  service: ScenarioPackageCommandService,
  parameterSet: ParameterSetVersion,
  input: { scenario_package_id: string; version: string }
): Promise<ScenarioPackageVersion> {
  const draft = await service.createDraft(scenarioActor, {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { engine_family: "toy_logit" },
    content: { scenario_kind: "synthetic_internal" },
    metadata: { title: "Formal RuntimeBinding test scenario" },
    parameter_set_reference: parameterSet.reference,
    plugin_dependencies: [{ plugin_package_id: "plugin_wellness_eldercare", version: "1.0.0" }],
    scenario_package_id: input.scenario_package_id,
    schema_version: "scenario-package.v1",
    tenant_id: TENANT_ID,
    version: input.version
  });
  const validated = await service.validate(scenarioActor, draft.reference);
  const frozen = await service.freeze(scenarioActor, validated.reference);
  return (
    await service.approve(
      scenarioActor,
      frozen.reference,
      `approval_${input.scenario_package_id}_${input.version}`
    )
  ).version;
}

async function createHarness() {
  const parameterRegistry = new InMemoryJsonParameterSetRegistry();
  const parameterSets = new ParameterSetCommandService(parameterRegistry);
  const primaryParameterSet = await approveParameterSet(parameterSets, {
    parameter_set_id: "parameter_set_primary",
    version: "1.0.0"
  });
  const alternateParameterSet = await approveParameterSet(parameterSets, {
    parameter_set_id: "parameter_set_alternate",
    version: "1.0.0"
  });
  const scenarioRegistry = new InMemoryJsonScenarioPackageRegistry();
  const scenarios = new ScenarioPackageCommandService(scenarioRegistry, parameterSets);
  const primaryScenario = await approveScenarioPackage(scenarios, primaryParameterSet, {
    scenario_package_id: "scenario_package_primary",
    version: "1.0.0"
  });

  return {
    alternateParameterSet,
    parameterSets,
    primaryParameterSet,
    primaryScenario,
    scenarios
  };
}

function createBindingInput(harness: Awaited<ReturnType<typeof createHarness>>) {
  return {
    authorities: {
      parameterSets: harness.parameterSets,
      scenarios: harness.scenarios
    },
    engine_reference: {
      engine_id: "toy_logit_wellness_v1",
      version: "0.1.0"
    },
    parameter_set_reference: harness.primaryParameterSet.reference,
    run_id: "run_formal_binding_001",
    scenario_package_reference: harness.primaryScenario.reference,
    seed: 20260728,
    tenant_id: TENANT_ID
  };
}

describe("Formal Run RuntimeBinding", () => {
  it("creates an immutable exact binding from approved formal authority references", async () => {
    const harness = await createHarness();
    const binding = await createFormalRunRuntimeBinding(createBindingInput(harness));

    expect(binding.binding_schema_version).toBe("formal-run-runtime-binding.v1");
    expect(binding.binding_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(binding.seed_policy).toBe("EXACT_RUN_SEED");
    expect(binding.parameter_set_reference).toEqual(harness.primaryParameterSet.reference);
    expect(binding.scenario_package_reference).toEqual(harness.primaryScenario.reference);
    expect(binding.plugin_release_references).toEqual([
      { plugin_package_id: "plugin_wellness_eldercare", version: "1.0.0" }
    ]);
    expect(binding.model_version_references).toEqual(["toy_logit_wellness_v1@0.1.0"]);
    expect(binding.projection_schema_references).toEqual([
      { schema_id: "ParameterSet", version: "parameter-set.v1" },
      { schema_id: "ScenarioPackage", version: "scenario-package.v1" }
    ]);
    expect(Object.isFrozen(binding)).toBe(true);
    expect(Object.isFrozen(binding.scenario_package_reference)).toBe(true);
    expect(() => {
      (binding.plugin_release_references as Array<{ version: string }>)[0]!.version = "2.0.0";
    }).toThrow();
  });

  it("fails closed when an exact Authority digest or embedded ParameterSet differs", async () => {
    const harness = await createHarness();

    await expect(
      createFormalRunRuntimeBinding({
        ...createBindingInput(harness),
        scenario_package_reference: {
          ...harness.primaryScenario.reference,
          content_digest: "f".repeat(64)
        }
      })
    ).rejects.toThrow(new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_SCENARIO_NOT_BINDABLE"));

    await expect(
      createFormalRunRuntimeBinding({
        ...createBindingInput(harness),
        parameter_set_reference: harness.alternateParameterSet.reference
      })
    ).rejects.toThrow(
      new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_PARAMETER_REFERENCE_MISMATCH")
    );
  });

  it("rejects retired versions for a new binding while allowing the existing exact binding to resolve historically", async () => {
    const harness = await createHarness();
    const binding = await createFormalRunRuntimeBinding(createBindingInput(harness));

    const replacementParameterSet = await approveParameterSet(harness.parameterSets, {
      parameter_set_id: harness.primaryParameterSet.parameter_set_id,
      version: "2.0.0"
    });
    const replacementScenario = await approveScenarioPackage(
      harness.scenarios,
      replacementParameterSet,
      {
        scenario_package_id: harness.primaryScenario.scenario_package_id,
        version: "2.0.0"
      }
    );

    await harness.scenarios.retire(scenarioActor, harness.primaryScenario.reference);
    await harness.parameterSets.retire(parameterActor, harness.primaryParameterSet.reference);

    await expect(createFormalRunRuntimeBinding(createBindingInput(harness))).rejects.toThrow(
      new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_SCENARIO_NOT_BINDABLE")
    );

    const historical = await resolveFormalRunRuntimeBindingForHistoricalRead({
      authorities: {
        parameterSets: harness.parameterSets,
        scenarios: harness.scenarios
      },
      binding
    });

    expect(historical.parameter_set_status).toBe("RETIRED");
    expect(historical.scenario_package_status).toBe("RETIRED");
    expect(historical.binding).toEqual(binding);
    expect(historical.binding.parameter_set_reference).not.toEqual(
      replacementParameterSet.reference
    );
    expect(historical.binding.scenario_package_reference).not.toEqual(
      replacementScenario.reference
    );
  });

  it("does not silently upgrade an ID-only Run and rejects malformed or mismatched bindings", async () => {
    const harness = await createHarness();
    const binding = await createFormalRunRuntimeBinding(createBindingInput(harness));
    const legacyRun: Run = {
      course_id: "course_formal_binding",
      parameter_set_id: harness.primaryParameterSet.parameter_set_id,
      run_id: binding.run_id,
      scenario_package_id: harness.primaryScenario.scenario_package_id,
      seed: binding.seed,
      status: "active",
      tenant_id: TENANT_ID
    };

    expect(assertRunMatchesFormalRuntimeBinding(legacyRun)).toEqual({
      classification: "LEGACY_ID_ONLY",
      binding: null
    });
    expect(() =>
      assertRunMatchesFormalRuntimeBinding(
        {
          ...legacyRun,
          seed: binding.seed + 1
        },
        binding
      )
    ).toThrow(new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_RUN_MISMATCH"));

    expect(() =>
      assertRunMatchesFormalRuntimeBinding(legacyRun, {
        ...binding,
        model_version_references: [...binding.model_version_references, "unexpected-model"]
      })
    ).toThrow(new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_INVALID"));

    expect(() =>
      assertRunMatchesFormalRuntimeBinding(legacyRun, {
        ...binding,
        projection_schema_references: [
          ...binding.projection_schema_references,
          { schema_id: "ScenarioPackage", version: "scenario-package.v2" }
        ]
      })
    ).toThrow(new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_INVALID"));
  });
});
