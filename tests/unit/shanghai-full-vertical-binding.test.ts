import { readFileSync } from "node:fs";
import {
  createShanghaiFullVerticalBindingEvidenceV1,
  createR7TeacherScenarioSelectionReadinessContract,
  validateShanghaiFullVerticalBindingV1,
  type ShanghaiFullVerticalCandidateIdentityV1,
  type ShanghaiFullVerticalFormalReferencesV1
} from "@simwar/shared-contracts";
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";

const candidate: ShanghaiFullVerticalCandidateIdentityV1 = {
  compiler_version: "r7c.shanghai.scenario-factory.compiler.v2",
  course_id: "course_demo",
  parameter_set_id: "param_demo",
  parameter_set_seed: 2026072601,
  parameter_set_version: "1.0.0",
  plugin_package_ids: ["plugin_wellness_eldercare_v1"],
  plugin_version: "plugin_wellness_eldercare_v1@1.0.0",
  scenario_family_version: "r7c.shanghai.scenario-family.v2",
  scenario_package_id: "scenario_demo",
  scenario_package_version: "1.0.0",
  scenario_version: "r7c.shanghai.base_operations.v2",
  tenant_id: "tenant_demo"
};

const formal: ShanghaiFullVerticalFormalReferencesV1 = {
  course_id: "course_demo",
  parameter_set: {
    content_digest: "b".repeat(64),
    parameter_set_id: "param_demo",
    version: "1.0.0"
  },
  parameter_set_seed: 2026072601,
  plugin_releases: [
    {
      content_digest: "c".repeat(64),
      plugin_package_id: "plugin_wellness_eldercare_v1",
      version: "1.0.0"
    }
  ],
  scenario_package: {
    content_digest: "a".repeat(64),
    scenario_package_id: "scenario_demo",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  tenant_id: "tenant_demo"
};

describe("Shanghai full vertical candidate binding", () => {
  it("publishes the implemented readiness route in OpenAPI", () => {
    const openApi = yaml.load(readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8")) as {
      paths: Record<string, Record<string, { operationId?: string; parameters?: unknown[] }>>;
    };
    const operation =
      openApi.paths["/api/v1/bff/teacher/runs/{runId}/scenario-selection-readiness"]?.get;

    expect(operation?.operationId).toBe("R7_TEACHER_SCENARIO_SELECTION_READINESS_GET_V1");
    expect(operation?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ in: "path", name: "runId", required: true }),
        expect.objectContaining({ in: "query", name: "scenarioPackageId", required: true }),
        expect.objectContaining({ in: "query", name: "parameterSetId", required: true })
      ])
    );
  });

  it("describes readiness as a read-only repository-facade route", () => {
    expect(createR7TeacherScenarioSelectionReadinessContract()).toEqual({
      direct_store_access: false,
      frontend_direct_internal_settle_route: false,
      method: "GET",
      official_parameter_set_write: false,
      official_scenario_binding_write: false,
      operation_id: "R7_TEACHER_SCENARIO_SELECTION_READINESS_GET_V1",
      path: "/api/v1/bff/teacher/runs/{runId}/scenario-selection-readiness",
      reads_runtime_store_through_repository_facade: true,
      replay_hash_semantics_changed: false,
      runtime_activation: false,
      settlement_result_write: false,
      student_visibility_expansion: false,
      teacher_authority_required: true
    });
  });

  it("accepts exact candidate/formal identity and keeps digest status reference-only", () => {
    expect(validateShanghaiFullVerticalBindingV1({ candidate, formal })).toEqual({
      issues: [],
      ok: true
    });

    expect(createShanghaiFullVerticalBindingEvidenceV1({ candidate, formal })).toEqual(
      expect.objectContaining({
        digest_status: "REFERENCE_ONLY_NOT_REHASHED",
        formal_truth_write: false,
        parameter_set_write: false,
        runtime_activation: false,
        settlement_write: false,
        status: "BOUND"
      })
    );
  });

  it("snapshots nested formal references before returning evidence", () => {
    const formalInput: ShanghaiFullVerticalFormalReferencesV1 = {
      ...formal,
      parameter_set: { ...formal.parameter_set },
      plugin_releases: formal.plugin_releases.map((release) => ({ ...release })),
      scenario_package: { ...formal.scenario_package }
    };
    const evidence = createShanghaiFullVerticalBindingEvidenceV1({
      candidate,
      formal: formalInput
    });

    formalInput.parameter_set.version = "2.0.0";
    formalInput.plugin_releases[0]!.version = "2.0.0";
    formalInput.scenario_package.version = "2.0.0";

    expect(evidence.formal_references.parameter_set.version).toBe("1.0.0");
    expect(evidence.formal_references.plugin_releases[0]?.version).toBe("1.0.0");
    expect(evidence.formal_references.scenario_package.version).toBe("1.0.0");
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.formal_references)).toBe(true);
    expect(Object.isFrozen(evidence.formal_references.parameter_set)).toBe(true);
    expect(Object.isFrozen(evidence.formal_references.plugin_releases)).toBe(true);
  });

  it.each([
    ["tenant_id", { formal: { ...formal, tenant_id: "tenant_other" } }, "TENANT_SCOPE_MISMATCH"],
    [
      "scenario_package_version",
      {
        formal: {
          ...formal,
          scenario_package: { ...formal.scenario_package, version: "2.0.0" }
        }
      },
      "SCENARIO_PACKAGE_VERSION_MISMATCH"
    ],
    [
      "parameter_set_version",
      {
        formal: {
          ...formal,
          parameter_set: { ...formal.parameter_set, version: "2.0.0" }
        }
      },
      "PARAMETER_SET_VERSION_MISMATCH"
    ],
    [
      "parameter_set_seed",
      {
        formal: {
          ...formal,
          parameter_set_seed: 2026072602
        }
      },
      "PARAMETER_SET_SEED_MISMATCH"
    ],
    [
      "plugin_release_version",
      {
        formal: {
          ...formal,
          plugin_releases: [{ ...formal.plugin_releases[0]!, version: "2.0.0" }]
        }
      },
      "PLUGIN_VERSION_MISMATCH"
    ]
  ])("rejects %s drift before binding", (_label, input, issue) => {
    expect(validateShanghaiFullVerticalBindingV1({ candidate, ...input })).toEqual({
      issues: [issue],
      ok: false
    });
    expect(() => createShanghaiFullVerticalBindingEvidenceV1({ candidate, ...input })).toThrow(
      new RegExp(issue)
    );
  });

  it("rejects a plugin set that does not exactly match the candidate", () => {
    const result = validateShanghaiFullVerticalBindingV1({
      candidate,
      formal: {
        ...formal,
        plugin_releases: []
      }
    });

    expect(result).toEqual({
      issues: ["PLUGIN_PACKAGE_IDS_MISMATCH"],
      ok: false
    });
  });
});
