import { describe, expect, it } from "vitest";
import {
  R7D_ELDERCARE_SCENARIO_PACKAGE_ID,
  R7D_SYNTHETIC_TENANT_ID,
  createR7DEldercareParameterSetDraft,
  createR7DEldercareScenarioPackageDraft
} from "../../services/api/src/eldercare-scenario-package-admission";
import {
  InMemoryJsonParameterSetRegistry,
  ParameterSetCommandService
} from "../../services/api/src/parameter-set-authority";
import {
  InMemoryJsonScenarioPackageRegistry,
  ScenarioPackageAuthorityError,
  ScenarioPackageCommandService
} from "../../services/api/src/scenario-package-authority";
import { compileBeijingYanjiaoEldercareScenarioAsset } from "../../services/simulation-core/src/eldercare-scenario-compiler";

const parameterActor = {
  actor_id: "r7d_parameter_authority",
  capabilities: ["parameter_set:manage"] as const,
  correlation_id: "r7d_parameter_correlation",
  tenant_id: R7D_SYNTHETIC_TENANT_ID
};

const scenarioActor = {
  actor_id: "r7d_scenario_authority",
  capabilities: ["scenario_package:manage"] as const,
  correlation_id: "r7d_scenario_correlation",
  tenant_id: R7D_SYNTHETIC_TENANT_ID
};

async function admitEldercareScenario() {
  const parameterRegistry = new InMemoryJsonParameterSetRegistry();
  const parameterService = new ParameterSetCommandService(parameterRegistry);
  const parameterDraft = await parameterService.createDraft(
    parameterActor,
    createR7DEldercareParameterSetDraft()
  );
  const parameterValidated = await parameterService.validate(
    parameterActor,
    parameterDraft.reference
  );
  const parameterFrozen = await parameterService.freeze(
    parameterActor,
    parameterValidated.reference
  );
  const approvedParameter = await parameterService.approve(
    parameterActor,
    parameterFrozen.reference,
    "r7d_parameter_approval"
  );

  const scenarioRegistry = new InMemoryJsonScenarioPackageRegistry();
  const scenarioService = new ScenarioPackageCommandService(scenarioRegistry, parameterService);
  const scenarioDraft = await scenarioService.createDraft(
    scenarioActor,
    createR7DEldercareScenarioPackageDraft(approvedParameter.version.reference)
  );
  const scenarioValidated = await scenarioService.validate(scenarioActor, scenarioDraft.reference);
  const scenarioFrozen = await scenarioService.freeze(scenarioActor, scenarioValidated.reference);
  const approvedScenario = await scenarioService.approve(
    scenarioActor,
    scenarioFrozen.reference,
    "r7d_scenario_approval"
  );

  return { approvedParameter, approvedScenario, scenarioRegistry, scenarioService };
}

describe("R7-D eldercare ScenarioPackage authority admission", () => {
  it("admits the deterministic Beijing-Yanjiao asset using only an exact approved ParameterSet reference", async () => {
    const sourceAsset = compileBeijingYanjiaoEldercareScenarioAsset();
    const parameterDraft = createR7DEldercareParameterSetDraft();
    const { approvedParameter, approvedScenario, scenarioService } = await admitEldercareScenario();
    const serializedContent = JSON.stringify(approvedScenario.version.content);

    expect(parameterDraft.tenant_id).toBe(sourceAsset.parameter_set.tenant_id);
    expect(parameterDraft.parameter_set_id).toBe(sourceAsset.parameter_set.parameter_set_id);
    expect(approvedScenario.version.scenario_package_id).toBe(R7D_ELDERCARE_SCENARIO_PACKAGE_ID);
    expect(approvedScenario.version.tenant_id).toBe(R7D_SYNTHETIC_TENANT_ID);
    expect(approvedScenario.version.parameter_set_reference).toEqual(
      approvedParameter.version.reference
    );
    expect(approvedScenario.version.status).toBe("APPROVED");
    expect(approvedScenario.version.content).toMatchObject({
      rounds: sourceAsset.rounds,
      scenario_asset_hash: sourceAsset.asset_hash,
      scenario_asset_id: sourceAsset.asset_id
    });
    expect(approvedScenario.version.content).not.toHaveProperty("model_preview");
    expect(approvedScenario.version.content).not.toHaveProperty("parameter_set");
    expect(serializedContent).not.toContain("parameter_values");
    expect(serializedContent).not.toContain("state_true");
    expect(serializedContent).not.toContain("SettlementResult");
    expect(serializedContent).not.toContain("replay_hash");

    await expect(
      scenarioService.assertBindable(R7D_SYNTHETIC_TENANT_ID, approvedScenario.version.reference)
    ).resolves.toBeUndefined();

    const [projection] = await scenarioService.listApprovedForTenant(R7D_SYNTHETIC_TENANT_ID);
    expect(projection).toMatchObject({
      parameter_set_reference: approvedParameter.version.reference,
      reference: approvedScenario.version.reference,
      status: "APPROVED"
    });
    expect(projection).not.toHaveProperty("content");
    expect(projection).not.toHaveProperty("metadata");
  });

  it("removes a retired eldercare package from new-bindable projections without rewriting history", async () => {
    const { approvedScenario, scenarioRegistry, scenarioService } = await admitEldercareScenario();

    const retired = await scenarioService.retire(scenarioActor, approvedScenario.version.reference);

    expect(retired.status).toBe("RETIRED");
    await expect(
      scenarioService.assertBindable(R7D_SYNTHETIC_TENANT_ID, approvedScenario.version.reference)
    ).rejects.toThrow(new ScenarioPackageAuthorityError("RETIRED_FOR_NEW_BINDING"));
    await expect(scenarioService.listApprovedForTenant(R7D_SYNTHETIC_TENANT_ID)).resolves.toEqual(
      []
    );
    await expect(
      scenarioRegistry.listLifecycleSnapshots(
        R7D_SYNTHETIC_TENANT_ID,
        R7D_ELDERCARE_SCENARIO_PACKAGE_ID,
        "1.0.0"
      )
    ).resolves.toHaveLength(5);
  });
});
