import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createJsonFormalScenarioAuthorityRuntime } from "../../services/api/src/formal-scenario-authority-runtime";
import { createP1Store } from "../../services/api/src/store";

const tenantId = "tenant_formal_catalog";

const parameterActor = {
  actor_id: "parameter_admin_001",
  capabilities: ["parameter_set:manage"] as const,
  correlation_id: "parameter_corr_001",
  tenant_id: tenantId
};

const scenarioActor = {
  actor_id: "scenario_admin_001",
  capabilities: ["scenario_package:manage"] as const,
  correlation_id: "scenario_corr_001",
  tenant_id: tenantId
};

describe("createJsonFormalScenarioAuthorityRuntime", () => {
  it("persists an approved formal ScenarioPackage catalog through a JSON store restart", async () => {
    const directory = mkdtempSync(join(tmpdir(), "simwar-formal-scenario-authority-"));
    const persistenceFile = join(directory, "store.json");

    try {
      const store = createP1Store({ persistenceFile });
      const runtime = createJsonFormalScenarioAuthorityRuntime(store);
      const parameterDraft = await runtime.parameterSets.createDraft(parameterActor, {
        compatibility_metadata: { engine: "simulation-core.v1" },
        model_version_ref: "simulation-core.v1",
        parameter_set_id: "parameter_set_catalog_001",
        parameter_values: { base_capacity: 120, base_market_size: 240 },
        schema_version: "parameters.v1",
        tenant_id: tenantId,
        version: "1.0.0"
      });
      const parameterValidated = await runtime.parameterSets.validate(
        parameterActor,
        parameterDraft.reference
      );
      const parameterFrozen = await runtime.parameterSets.freeze(
        parameterActor,
        parameterValidated.reference
      );
      const parameterApproved = await runtime.parameterSets.approve(
        parameterActor,
        parameterFrozen.reference,
        "parameter_approval_catalog_001"
      );
      const scenarioDraft = await runtime.scenarioPackages.createDraft(scenarioActor, {
        artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
        compatibility_metadata: { engine: "simulation-core.v1" },
        content: { rounds: [{ index: 1, label: "baseline" }] },
        metadata: { title: "Formal catalog scenario" },
        parameter_set_reference: parameterApproved.version.reference,
        plugin_dependencies: [{ plugin_package_id: "wellness", version: "1.0.0" }],
        scenario_package_id: "scenario_package_catalog_001",
        schema_version: "scenario-package.v1",
        tenant_id: tenantId,
        version: "1.0.0"
      });
      const scenarioValidated = await runtime.scenarioPackages.validate(
        scenarioActor,
        scenarioDraft.reference
      );
      const scenarioFrozen = await runtime.scenarioPackages.freeze(
        scenarioActor,
        scenarioValidated.reference
      );
      const scenarioApproved = await runtime.scenarioPackages.approve(
        scenarioActor,
        scenarioFrozen.reference,
        "scenario_approval_catalog_001"
      );

      expect(await runtime.catalog.listApprovedForTenant(tenantId)).toEqual([
        expect.objectContaining({
          reference: scenarioApproved.version.reference,
          status: "APPROVED"
        })
      ]);
      expect(store.scenarios).toHaveLength(1);
      expect(store.parameterSets).toHaveLength(1);

      const restartedStore = createP1Store({ persistenceFile });
      const restartedRuntime = createJsonFormalScenarioAuthorityRuntime(restartedStore);
      await expect(
        restartedRuntime.scenarioPackages.getByReference(
          tenantId,
          scenarioApproved.version.reference
        )
      ).resolves.toMatchObject({ status: "APPROVED" });
      await expect(restartedRuntime.catalog.listApprovedForTenant(tenantId)).resolves.toEqual([
        expect.objectContaining({ reference: scenarioApproved.version.reference })
      ]);

      const retired = await restartedRuntime.scenarioPackages.retire(
        scenarioActor,
        scenarioApproved.version.reference
      );
      expect(retired.status).toBe("RETIRED");
      await expect(restartedRuntime.catalog.listApprovedForTenant(tenantId)).resolves.toEqual([]);

      const retiredStore = createP1Store({ persistenceFile });
      const retiredRuntime = createJsonFormalScenarioAuthorityRuntime(retiredStore);
      await expect(
        retiredRuntime.scenarioPackages.getByReference(tenantId, scenarioApproved.version.reference)
      ).resolves.toMatchObject({ status: "RETIRED" });
      await expect(retiredRuntime.catalog.listApprovedForTenant(tenantId)).resolves.toEqual([]);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
