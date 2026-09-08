import { describe, expect, it } from "vitest";
import { evaluateCanServiceFeasibility } from "../../services/simulation-core/src/can-service-feasibility";

const binding = {
  binding_digest: "b".repeat(64),
  course_id: "course_demo",
  model_version_ref: "eldercare_w5_governed_v1@1.1.0",
  no_implicit_latest: true,
  parameter_set_reference: {
    content_digest: "a".repeat(64),
    parameter_set_id: "parameter_set_demo",
    version: "1.0.0"
  },
  round_id: "round_demo_1",
  round_no: 1,
  run_id: "run_demo",
  scenario_package_reference: {
    content_digest: "c".repeat(64),
    scenario_package_id: "scenario_demo",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  seed: 20260829,
  tenant_id: "tenant_demo"
} as const;

function candidate() {
  return evaluateCanServiceFeasibility({
    binding,
    demand_units: { source_ref: "can:demand", unit: "households", value: 40 },
    available_capacity_units: { source_ref: "can:capacity", unit: "households", value: 64 },
    workforce_units: { source_ref: "can:workforce", unit: "people", value: 80 },
    minimum_workforce_units: { source_ref: "can:min-workforce", unit: "people", value: 1 },
    service_quality_budget: { source_ref: "can:quality", unit: "CNY", value: 120000 },
    minimum_service_quality_budget: { source_ref: "can:min-quality", unit: "CNY", value: 0 },
    eligibility: {
      licensed: { source_ref: "can:license", value: true },
      staffing_compliant: { source_ref: "can:staffing", value: true }
    }
  });
}

describe("O7 CAN producer intrinsic lineage", () => {
  it("emits deterministic typed model and artifact identity owned by CAN", () => {
    const first = candidate();
    const second = candidate();
    if (!first.producer_intrinsic_lineage || !second.producer_intrinsic_lineage) {
      throw new Error("CAN_PRODUCER_INTRINSIC_LINEAGE_MISSING");
    }

    expect(first.producer_intrinsic_lineage).toEqual(second.producer_intrinsic_lineage);
    expect(first.producer_intrinsic_lineage.model_version_reference).toEqual({
      model_version_id: "can_service_feasibility_v1",
      version: "1.0.0",
      content_digest: expect.stringMatching(/^[a-f0-9]{64}$/u)
    });
    expect(first.producer_intrinsic_lineage.model_artifact_reference).toEqual({
      artifact_id: "can_service_feasibility_evaluator",
      content_digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      format: "typescript-simulation-core",
      source_ref: "services/simulation-core/src/can-service-feasibility.ts"
    });
    expect(first.producer_intrinsic_lineage.model_version_reference.model_version_id).not.toContain("w5");
    expect(first.producer_intrinsic_lineage.model_version_reference.model_version_id).not.toBe(
      binding.model_version_ref
    );
    expect(first.producer_intrinsic_lineage.lineage_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.authority.official_truth_write).toBe(false);
    expect(first.authority.settlement_write).toBe(false);
    expect(first.authority.provider_calls).toBe(0);
  });

  it("keeps UNKNOWN as UNKNOWN while still exposing the same producer identity", () => {
    const result = evaluateCanServiceFeasibility({
      ...candidateInput(),
      available_capacity_units: undefined
    });
    if (!result.producer_intrinsic_lineage) {
      throw new Error("CAN_PRODUCER_INTRINSIC_LINEAGE_MISSING");
    }

    expect(result.status).toBe("UNKNOWN");
    expect(result.producer_intrinsic_lineage.model_artifact_reference.source_ref).toBe(
      "services/simulation-core/src/can-service-feasibility.ts"
    );
  });
});

function candidateInput() {
  return {
    binding,
    demand_units: { source_ref: "can:demand", unit: "households" as const, value: 40 },
    available_capacity_units: { source_ref: "can:capacity", unit: "households" as const, value: 64 },
    workforce_units: { source_ref: "can:workforce", unit: "people" as const, value: 80 },
    minimum_workforce_units: { source_ref: "can:min-workforce", unit: "people" as const, value: 1 },
    service_quality_budget: { source_ref: "can:quality", unit: "CNY" as const, value: 120000 },
    minimum_service_quality_budget: { source_ref: "can:min-quality", unit: "CNY" as const, value: 0 },
    eligibility: {
      licensed: { source_ref: "can:license", value: true },
      staffing_compliant: { source_ref: "can:staffing", value: true }
    }
  };
}
