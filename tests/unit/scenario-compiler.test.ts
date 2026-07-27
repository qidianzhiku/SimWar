import { describe, expect, it } from "vitest";
import { createParameterSetReference } from "../../packages/shared-contracts/src/index";
import {
  compileGenericScenario,
  type GenericScenarioCompilerInput
} from "../../services/api/src/scenario-compiler";

const parameterSetReference = createParameterSetReference({
  content_digest: "a".repeat(64),
  parameter_set_id: "parameter_set_generic_001",
  tenant_id: "tenant_generic_001",
  version: "1.0.0"
});

function createInput(
  overrides: Partial<GenericScenarioCompilerInput> = {}
): GenericScenarioCompilerInput {
  return {
    artifact_policy: {
      mode: "INLINE",
      retention: "IMMUTABLE"
    },
    compatibility_metadata: {
      engine: "simulation-core.v1",
      plugin_api: "plugin-api.v1"
    },
    metadata: {
      license_provenance_id: "internal-synthetic-v1",
      privacy_classification: "synthetic_internal",
      title: "Generic scenario candidate"
    },
    parameter_set_reference: parameterSetReference,
    plugin_dependencies: [
      {
        plugin_package_id: "generic-plugin",
        version: "1.0.0"
      }
    ],
    scenario_package_id: "scenario_package_generic_001",
    schema_version: "scenario-package.v1",
    source_reference: {
      license_provenance_id: "internal-synthetic-v1",
      source_digest: "b".repeat(64),
      source_id: "synthetic-source-001",
      source_kind: "SYNTHETIC_INTERNAL",
      source_version: "1.0.0",
      status: "REGISTERED",
      tenant_id: "tenant_generic_001"
    },
    template: {
      content: {
        objectives: ["operate", "learn"],
        rounds: [{ label: "baseline", round_no: 1 }]
      },
      template_id: "scenario-template-generic-001",
      template_version: "1.0.0"
    },
    tenant_id: "tenant_generic_001",
    version: "1.0.0",
    ...overrides
  };
}

describe("generic Scenario compiler", () => {
  it("compiles one immutable generic candidate with a deterministic validation report", () => {
    const first = compileGenericScenario(createInput());
    const second = compileGenericScenario(
      createInput({
        compatibility_metadata: {
          plugin_api: "plugin-api.v1",
          engine: "simulation-core.v1"
        },
        template: {
          content: {
            rounds: [{ round_no: 1, label: "baseline" }],
            objectives: ["operate", "learn"]
          },
          template_id: "scenario-template-generic-001",
          template_version: "1.0.0"
        }
      })
    );

    expect(first.report.status).toBe("VALID");
    expect(first.candidate).not.toBeNull();
    expect(first.candidate?.parameter_set_reference).toEqual(parameterSetReference);
    expect(first.candidate?.content).toMatchObject({
      scenario_source: {
        source_digest: "b".repeat(64),
        source_id: "synthetic-source-001",
        source_kind: "SYNTHETIC_INTERNAL",
        source_version: "1.0.0"
      },
      template: {
        template_id: "scenario-template-generic-001",
        template_version: "1.0.0"
      }
    });
    expect(first.report.candidate_content_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.report.input_digest).toBe(second.report.input_digest);
    expect(first.report.candidate_content_digest).toBe(second.report.candidate_content_digest);
    expect(Object.isFrozen(first.candidate)).toBe(true);
    expect(Object.isFrozen(first.candidate?.content)).toBe(true);
    expect(Object.isFrozen(first.report)).toBe(true);
  });

  it("returns an invalid report and no candidate when the source reference is malformed", () => {
    const result = compileGenericScenario(
      createInput({
        source_reference: {
          ...createInput().source_reference,
          source_digest: "not-a-digest"
        }
      })
    );

    expect(result).toEqual({
      candidate: null,
      report: expect.objectContaining({
        candidate_content_digest: null,
        errors: ["SCENARIO_SOURCE_REFERENCE_INVALID"],
        status: "INVALID"
      })
    });
  });

  it("rejects source kinds outside the generic compiler allowlist", () => {
    const result = compileGenericScenario(
      createInput({
        source_reference: {
          ...createInput().source_reference,
          source_kind: "EXTERNAL" as GenericScenarioCompilerInput["source_reference"]["source_kind"]
        }
      })
    );

    expect(result.candidate).toBeNull();
    expect(result.report.errors).toEqual(["SCENARIO_SOURCE_REFERENCE_INVALID"]);
  });

  it("does not compile a retired source reference into a new candidate", () => {
    const result = compileGenericScenario(
      createInput({
        source_reference: {
          ...createInput().source_reference,
          status: "RETIRED"
        }
      })
    );

    expect(result.candidate).toBeNull();
    expect(result.report.errors).toEqual(["SCENARIO_SOURCE_RETIRED"]);
  });

  it("rejects candidate content that contains a formal truth field", () => {
    const result = compileGenericScenario(
      createInput({
        template: {
          ...createInput().template,
          content: {
            state_true: "forbidden"
          }
        }
      })
    );

    expect(result.candidate).toBeNull();
    expect(result.report.status).toBe("INVALID");
    expect(result.report.errors).toEqual(["SCENARIO_PACKAGE_VALIDATION_FAILED"]);
  });
});
