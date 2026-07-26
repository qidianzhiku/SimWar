import { describe, expect, it } from "vitest";
import { compileBeijingYanjiaoEldercareScenarioAsset } from "@simwar/simulation-core";
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
  ScenarioPackageCommandService,
  calculateScenarioPackageContentDigest
} from "../../services/api/src/scenario-package-authority";

const parameterActor = {
  actor_id: "r7d_integration_parameter_authority",
  capabilities: ["parameter_set:manage"] as const,
  correlation_id: "r7d_integration_parameter_correlation",
  tenant_id: R7D_SYNTHETIC_TENANT_ID
};

const scenarioActor = {
  actor_id: "r7d_integration_scenario_authority",
  capabilities: ["scenario_package:manage"] as const,
  correlation_id: "r7d_integration_scenario_correlation",
  tenant_id: R7D_SYNTHETIC_TENANT_ID
};

describe("R7-D eldercare authority admission integration", () => {
  it("creates a deterministic, redacted Authority projection from the compiled source asset", async () => {
    const sourceAsset = compileBeijingYanjiaoEldercareScenarioAsset();
    const parameterService = new ParameterSetCommandService(new InMemoryJsonParameterSetRegistry());
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
      "r7d_integration_parameter_approval"
    );

    const scenarioDraftInput = createR7DEldercareScenarioPackageDraft(
      approvedParameter.version.reference
    );
    const scenarioService = new ScenarioPackageCommandService(
      new InMemoryJsonScenarioPackageRegistry(),
      parameterService
    );
    const draft = await scenarioService.createDraft(scenarioActor, scenarioDraftInput);
    const validated = await scenarioService.validate(scenarioActor, draft.reference);
    const frozen = await scenarioService.freeze(scenarioActor, validated.reference);
    const approved = await scenarioService.approve(
      scenarioActor,
      frozen.reference,
      "r7d_integration_scenario_approval"
    );

    expect(calculateScenarioPackageContentDigest(scenarioDraftInput)).toBe(
      calculateScenarioPackageContentDigest(
        createR7DEldercareScenarioPackageDraft(approvedParameter.version.reference)
      )
    );
    expect(approved.version.reference).toMatchObject({
      scenario_package_id: R7D_ELDERCARE_SCENARIO_PACKAGE_ID,
      tenant_id: R7D_SYNTHETIC_TENANT_ID,
      version: "1.0.0"
    });
    expect(approved.version.content).toMatchObject({
      scenario_asset_hash: sourceAsset.asset_hash,
      scenario_asset_id: sourceAsset.asset_id
    });
    expect(approved.version.content).not.toHaveProperty("model_preview");
    expect(approved.version.content).not.toHaveProperty("parameter_set");

    const [projection] = await scenarioService.listApprovedForTenant(R7D_SYNTHETIC_TENANT_ID);
    expect(projection).toMatchObject({
      parameter_set_reference: approvedParameter.version.reference,
      reference: approved.version.reference,
      status: "APPROVED"
    });
    expect(JSON.stringify(projection)).not.toContain("parameter_values");
    expect(JSON.stringify(projection)).not.toContain("state_true");
    expect(JSON.stringify(projection)).not.toContain("SettlementResult");
    expect(projection).not.toHaveProperty("content");
    expect(projection).not.toHaveProperty("metadata");
  });
});
