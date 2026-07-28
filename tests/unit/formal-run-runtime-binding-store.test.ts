import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { FormalRunRuntimeBinding } from "../../packages/shared-contracts/src";
import {
  FormalRunRuntimeBindingStore,
  FormalRunRuntimeBindingStoreError
} from "../../services/api/src/formal-run-runtime-binding-store";
import { createP1Store } from "../../services/api/src/store";

const digest = (character: string) => character.repeat(64);
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

function createBinding(): FormalRunRuntimeBinding {
  return {
    binding_digest: digest("a"),
    binding_schema_version: "formal-run-runtime-binding.v1",
    engine_reference: { engine_id: "toy_logit_wellness_v1", version: "1.0.0" },
    model_version_references: ["toy-logit@1.0.0"],
    parameter_set_reference: {
      content_digest: digest("b"),
      parameter_set_id: "parameter_set_formal_test",
      version: "1.0.0"
    },
    plugin_release_references: [
      {
        content_digest: digest("c"),
        plugin_package_id: "plugin_wellness_stub",
        version: "1.0.0"
      }
    ],
    projection_schema_references: [
      { schema_id: "ParameterSet", version: "parameter-set.v1" },
      { schema_id: "ScenarioPackage", version: "scenario-package.v1" }
    ],
    run_id: "run_formal_001",
    scenario_package_reference: {
      content_digest: digest("d"),
      scenario_package_id: "scenario_formal_test",
      version: "1.0.0"
    },
    seed: 20260728,
    seed_policy: "EXACT_RUN_SEED",
    tenant_id: "tenant_formal_test"
  };
}

describe("formal Run runtime binding store", () => {
  it("persists one immutable tenant-scoped binding and rejects a second binding for the same Run", () => {
    const root = mkdtempSync(join(tmpdir(), "simwar-formal-binding-store-"));
    temporaryRoots.push(root);
    const snapshotPath = join(root, "store.json");
    const binding = createBinding();
    const store = createP1Store({ persistenceFile: snapshotPath });
    const bindings = new FormalRunRuntimeBindingStore(store);

    bindings.append(binding);
    store.persist();

    expect(bindings.getForRun(binding.tenant_id, binding.run_id)).toEqual(binding);
    expect(() => {
      bindings.append({ ...binding, binding_digest: digest("e") });
    }).toThrow(new FormalRunRuntimeBindingStoreError("FORMAL_RUN_BINDING_ALREADY_EXISTS"));

    const reloaded = new FormalRunRuntimeBindingStore(
      createP1Store({ persistenceFile: snapshotPath })
    );
    expect(reloaded.getForRun(binding.tenant_id, binding.run_id)).toEqual(binding);
  });
});
