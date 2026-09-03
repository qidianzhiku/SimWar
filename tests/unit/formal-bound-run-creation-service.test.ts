import { describe, expect, it, vi } from "vitest";
import type { Round, Run } from "../../packages/shared-contracts/src/index.js";
import { createFormalBoundRun } from "../../services/api/src/formal-bound-run-creation-service.js";

const tenantId = "tenant_demo";
const parameterReference = {
  content_digest: "b".repeat(64),
  parameter_set_id: "parameter_b5_001",
  version: "1.0.0"
};
const scenarioReference = {
  content_digest: "a".repeat(64),
  scenario_package_id: "scenario_b5_001",
  tenant_id: tenantId,
  version: "1.0.0"
};

const run: Run = {
  course_id: "course_b5_001",
  parameter_set_id: parameterReference.parameter_set_id,
  run_id: "run_b5_001",
  scenario_package_id: scenarioReference.scenario_package_id,
  seed: 20260729,
  status: "active",
  tenant_id: tenantId
};

const round: Round = {
  round_id: "round_b5_001",
  round_no: 1,
  run_id: run.run_id,
  status: "draft",
  tenant_id: tenantId
};

function createAuthorities(options: { parameterStatus?: "APPROVED" | "RETIRED" } = {}) {
  const pluginReference = {
    content_digest: "c".repeat(64),
    plugin_package_id: "plugin_wellness_v1",
    version: "1.0.0"
  };
  const pluginRecord = {
    compatibility_metadata: {},
    content_digest: pluginReference.content_digest,
    plugin_manifest: { plugin_id: "plugin_wellness_v1", version: "1.0.0" },
    plugin_package_id: "plugin_wellness_v1",
    reference: pluginReference,
    schema_version: "plugin-release.v1",
    status: "AVAILABLE" as const,
    version: "1.0.0"
  };
  return {
    parameterSets: {
      assertBindable: vi.fn(async () => undefined),
      getByReference: vi.fn(async () => ({
        compatibility_metadata: {},
        content_digest: parameterReference.content_digest,
        model_version_ref: "toy_logit_wellness_v1@0.1.0",
        parameter_values: {
          runtime_parameter_set: {
            base_capacity: 120,
            base_market_size: 240,
            fixed_cost: 10,
            model_family: "toy_logit",
            unit_cost: 2
          }
        },
        parameter_set_id: parameterReference.parameter_set_id,
        reference: parameterReference,
        schema_version: "parameter-set.v1",
        status: options.parameterStatus ?? "APPROVED",
        tenant_id: tenantId,
        version: parameterReference.version
      }))
    },
    plugins: {
      getByReference: vi.fn(async () => pluginRecord),
      resolveAvailableForNewBinding: vi.fn(async () => pluginRecord)
    },
    scenarios: {
      assertBindable: vi.fn(async () => undefined),
      getByReference: vi.fn(async () => ({
        artifact_policy: {},
        compatibility_metadata: {},
        content: {
          runtime_scenario_package: { name: "B5", plugin_package_ids: ["plugin_wellness_v1"] }
        },
        content_digest: scenarioReference.content_digest,
        metadata: {},
        parameter_set_reference: parameterReference,
        plugin_dependencies: [{ plugin_package_id: "plugin_wellness_v1", version: "1.0.0" }],
        reference: scenarioReference,
        scenario_package_id: scenarioReference.scenario_package_id,
        schema_version: "scenario-package.v1",
        status: "APPROVED",
        tenant_id: tenantId,
        version: scenarioReference.version
      }))
    }
  };
}

const courseBinding = {
  binding_digest: "d".repeat(64),
  binding_schema_version: "formal-course-authority-binding.v1" as const,
  course_id: run.course_id,
  engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
  parameter_set_reference: parameterReference,
  scenario_package_reference: scenarioReference,
  tenant_id: tenantId
};

describe("formal-bound Run creation service", () => {
  it("compensates a Round persistence failure without a Run or binding residue", async () => {
    const calls: string[] = [];
    await expect(
      createFormalBoundRun({
        authorities: createAuthorities(),
        bindingStore: { append: vi.fn(() => calls.push("append")) },
        courseBinding,
        persistence: {
          deleteRound: vi.fn(async () => calls.push("delete-round")),
          deleteRun: vi.fn(async () => calls.push("delete-run")),
          saveRound: vi.fn(async () => {
            throw new Error("round write failed");
          }),
          saveRun: vi.fn(async () => calls.push("save-run"))
        },
        round,
        run
      })
    ).rejects.toThrow("round write failed");
    expect(calls).toEqual(["save-run", "delete-run"]);
  });

  it("compensates a binding append failure without Run or Round residue", async () => {
    const calls: string[] = [];
    await expect(
      createFormalBoundRun({
        authorities: createAuthorities(),
        bindingStore: {
          append: vi.fn(() => {
            throw new Error("append failed");
          })
        },
        courseBinding,
        persistence: {
          deleteRound: vi.fn(async () => calls.push("delete-round")),
          deleteRun: vi.fn(async () => calls.push("delete-run")),
          saveRound: vi.fn(async () => calls.push("save-round")),
          saveRun: vi.fn(async () => calls.push("save-run"))
        },
        round,
        run
      })
    ).rejects.toThrow("append failed");
    expect(calls).toEqual(["save-run", "save-round", "delete-round", "delete-run"]);
  });

  it("compensates Run, Round, and the exact runtime binding when adjacent finalization fails", async () => {
    const calls: string[] = [];
    await expect(
      createFormalBoundRun({
        afterFormalBindingAppend: async () => {
          calls.push("finalize");
          throw new Error("adjacent finalization failed");
        },
        authorities: createAuthorities(),
        bindingStore: {
          append: vi.fn(() => calls.push("append-binding")),
          removeAfterFailedCreation: vi.fn(() => calls.push("remove-binding"))
        },
        courseBinding,
        persistence: {
          deleteRound: vi.fn(async () => calls.push("delete-round")),
          deleteRun: vi.fn(async () => calls.push("delete-run")),
          saveRound: vi.fn(async () => calls.push("save-round")),
          saveRun: vi.fn(async () => calls.push("save-run"))
        },
        round,
        run
      })
    ).rejects.toThrow("adjacent finalization failed");
    expect(calls).toEqual([
      "save-run",
      "save-round",
      "append-binding",
      "finalize",
      "remove-binding",
      "delete-round",
      "delete-run"
    ]);
  });

  it("leaves no residue when Run persistence or runtime resolution fails", async () => {
    const runWriteCalls: string[] = [];
    await expect(
      createFormalBoundRun({
        authorities: createAuthorities(),
        bindingStore: { append: vi.fn() },
        courseBinding,
        persistence: {
          deleteRound: vi.fn(async () => runWriteCalls.push("delete-round")),
          deleteRun: vi.fn(async () => runWriteCalls.push("delete-run")),
          saveRound: vi.fn(async () => runWriteCalls.push("save-round")),
          saveRun: vi.fn(async () => {
            throw new Error("run write failed");
          })
        },
        round,
        run
      })
    ).rejects.toThrow("run write failed");
    expect(runWriteCalls).toEqual([]);

    await expect(
      createFormalBoundRun({
        authorities: createAuthorities({ parameterStatus: "RETIRED" }),
        bindingStore: { append: vi.fn() },
        courseBinding,
        persistence: {
          deleteRound: vi.fn(async () => undefined),
          deleteRun: vi.fn(async () => undefined),
          saveRound: vi.fn(async () => {
            throw new Error("must not persist round");
          }),
          saveRun: vi.fn(async () => {
            throw new Error("must not persist run");
          })
        },
        round,
        run
      })
    ).rejects.toBeDefined();
  });
});
