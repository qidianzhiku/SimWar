import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as T;
}

const digest = "a".repeat(64);
const valid = {
  course_blueprint_reference: {
    content_digest: digest,
    course_blueprint_id: "blueprint_tss_001",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  course_package_id: "course_package_tss_001",
  description: "A governed scenario studio candidate.",
  parameter_set_reference: {
    content_digest: digest,
    parameter_set_id: "parameter_tss_001",
    version: "1.0.0"
  },
  scenario_package_reference: {
    content_digest: digest,
    scenario_package_id: "scenario_tss_001",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  studio_configuration: {
    custom_parameters: { mode: "DRAFT_ONLY", values: { custom_rate: 1.2 } },
    experience_profile: "STANDARD",
    model_version_ref: "eldercare_w5_governed_v1@1.1.0",
    module_configuration: {
      capital: { enabled: true },
      environment: { region: "generic" },
      funding: { enabled: true },
      policy_shocks: { enabled: false },
      project_template: { template_id: "generic" },
      workforce: { enabled: true }
    },
    schema_version: "teacher-scenario-studio.v1"
  },
  title: "TSS candidate",
  version: "1.0.0"
};

describe("Teacher Scenario Studio contract", () => {
  it("freezes exact refs, six coupled modules, and draft-only custom parameters", () => {
    const schema = readJson<{ $defs: Record<string, unknown>; $schema: string }>(
      "contracts/schemas/teacher-scenario-studio.v1.json"
    );
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile({
      $defs: schema.$defs,
      $schema: schema.$schema,
      $ref: "#/$defs/draftInput"
    });
    expect(validate(valid)).toBe(true);
    expect(
      validate({
        ...valid,
        studio_configuration: {
          ...valid.studio_configuration,
          custom_parameters: { mode: "ACTIVATED", values: {} }
        }
      })
    ).toBe(false);
    expect(validate({ ...valid, version: "latest" })).toBe(false);
    expect(
      validate({
        ...valid,
        studio_configuration: {
          ...valid.studio_configuration,
          module_configuration: { ...valid.studio_configuration.module_configuration, unknown: {} }
        }
      })
    ).toBe(false);
  });
});
