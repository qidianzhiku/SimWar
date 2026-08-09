import { describe, expect, it } from "vitest";
import {
  createEldercareGoldenM1BlueprintDraft,
  createEldercareGoldenM1CoursePackageDraft,
  createEldercareGoldenM1ParameterDraft,
  createEldercareGoldenM1PluginDraft,
  createEldercareGoldenM1ScenarioDraft,
  type EldercareGoldenM1AdapterInput
} from "../../services/api/src/eldercare-golden-m1";

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);

function input(
  overrides: Partial<EldercareGoldenM1AdapterInput> = {}
): EldercareGoldenM1AdapterInput {
  return {
    source_tenant_id: "tenant_r7a_synthetic",
    target_tenant_id: "tenant_eldercare_golden_m1",
    artifact_ids: {
      parameter_set_id: "parameter_eldercare_shanghai_golden_m1_v1",
      scenario_package_id: "scenario_eldercare_shanghai_golden_m1_v1",
      plugin_package_id: "plugin_wellness_eldercare_v1",
      course_blueprint_id: "blueprint_eldercare_shanghai_golden_m1_v1",
      course_package_id: "course_package_eldercare_shanghai_golden_m1_v1",
      version: "1.0.0"
    },
    ...overrides
  };
}

function parameterReference() {
  return {
    content_digest: DIGEST_A,
    parameter_set_id: "parameter_eldercare_shanghai_golden_m1_v1",
    version: "1.0.0"
  };
}

function scenarioReference() {
  return {
    content_digest: DIGEST_B,
    scenario_package_id: "scenario_eldercare_shanghai_golden_m1_v1",
    tenant_id: "tenant_eldercare_golden_m1",
    version: "1.0.0"
  };
}

function blueprintReference() {
  return {
    content_digest: DIGEST_A,
    course_blueprint_id: "blueprint_eldercare_shanghai_golden_m1_v1",
    tenant_id: "tenant_eldercare_golden_m1",
    version: "1.0.0"
  };
}

describe("Shanghai Eldercare Golden M1 pure adapter", () => {
  it("maps the same compiled asset to deterministic draft inputs", () => {
    const firstInput = input({
      parameter_set_reference: parameterReference(),
      scenario_package_reference: scenarioReference(),
      course_blueprint_reference: blueprintReference()
    });
    const first = {
      parameter: createEldercareGoldenM1ParameterDraft(firstInput),
      scenario: createEldercareGoldenM1ScenarioDraft(firstInput),
      plugin: createEldercareGoldenM1PluginDraft(firstInput),
      blueprint: createEldercareGoldenM1BlueprintDraft(firstInput),
      coursePackage: createEldercareGoldenM1CoursePackageDraft(firstInput)
    };
    const second = {
      parameter: createEldercareGoldenM1ParameterDraft(firstInput),
      scenario: createEldercareGoldenM1ScenarioDraft(firstInput),
      plugin: createEldercareGoldenM1PluginDraft(firstInput),
      blueprint: createEldercareGoldenM1BlueprintDraft(firstInput),
      coursePackage: createEldercareGoldenM1CoursePackageDraft(firstInput)
    };

    expect(second).toEqual(first);
  });

  it("emits the exact eldercare plugin dependency and six-round teaching metadata", () => {
    const context = input({ parameter_set_reference: parameterReference() });
    const plugin = createEldercareGoldenM1PluginDraft(context);
    const scenario = createEldercareGoldenM1ScenarioDraft(context);
    const blueprint = createEldercareGoldenM1BlueprintDraft(context);

    expect(plugin.plugin_package_id).toBe("plugin_wellness_eldercare_v1");
    expect(plugin.version).toBe("1.0.0");
    expect((scenario.content as { rounds: unknown[] }).rounds).toHaveLength(6);
    expect(scenario.plugin_dependencies).toEqual([
      { plugin_package_id: "plugin_wellness_eldercare_v1", version: "1.0.0" }
    ]);
    expect(blueprint.ordered_phases).toHaveLength(6);
    expect(blueprint.activity_plan).toHaveLength(6);
  });

  it("keeps synthetic teaching labels and excludes truth/private fields from every draft", () => {
    const context = input({
      parameter_set_reference: parameterReference(),
      scenario_package_reference: scenarioReference(),
      course_blueprint_reference: blueprintReference()
    });
    const drafts = [
      createEldercareGoldenM1ParameterDraft(context),
      createEldercareGoldenM1ScenarioDraft(context),
      createEldercareGoldenM1PluginDraft(context),
      createEldercareGoldenM1BlueprintDraft(context),
      createEldercareGoldenM1CoursePackageDraft(context)
    ];
    const serialized = JSON.stringify(drafts);

    expect(serialized).toContain("L0_SYNTHETIC");
    expect(serialized).toContain("SYNTHETIC_TEACHING_BASELINE");
    expect(serialized).toContain("REALITY_CALIBRATION_NOT_PROVEN");
    for (const forbidden of [
      "state_true",
      "SettlementResult",
      "replay_authority",
      "private_assumption",
      "rank"
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("rejects blank or mismatched tenant identity before producing a draft", () => {
    expect(() => createEldercareGoldenM1ParameterDraft(input({ source_tenant_id: " " }))).toThrow();
    expect(() => createEldercareGoldenM1ParameterDraft(input({ target_tenant_id: "" }))).toThrow();
    expect(() =>
      createEldercareGoldenM1ParameterDraft(input({ source_tenant_id: "tenant_other" }))
    ).toThrow();
    expect(() =>
      createEldercareGoldenM1ScenarioDraft(
        input({
          parameter_set_reference: parameterReference(),
          scenario_package_reference: { ...scenarioReference(), tenant_id: "tenant_other" }
        })
      )
    ).toThrow();
    expect(() =>
      createEldercareGoldenM1CoursePackageDraft(
        input({
          parameter_set_reference: parameterReference(),
          scenario_package_reference: scenarioReference(),
          course_blueprint_reference: { ...blueprintReference(), tenant_id: "tenant_other" }
        })
      )
    ).toThrow();
  });
});
