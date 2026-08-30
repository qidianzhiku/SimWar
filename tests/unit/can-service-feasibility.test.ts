import { describe, expect, it } from "vitest";
import {
  CanServiceFeasibilityError,
  evaluateCanServiceFeasibility,
  type CanServiceFeasibilityDomainInput
} from "../../services/simulation-core/src/can-service-feasibility";

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

function input(
  overrides: Partial<CanServiceFeasibilityDomainInput> = {}
): CanServiceFeasibilityDomainInput {
  return {
    binding,
    demand_units: { source_ref: "w5:customer_demand", unit: "households", value: 40 },
    available_capacity_units: {
      source_ref: "simulation-core:service_capacity",
      unit: "households",
      value: 64
    },
    workforce_units: { source_ref: "w5:caregiver_supply", unit: "people", value: 80 },
    minimum_workforce_units: { source_ref: "r1:minimum_workforce", unit: "people", value: 1 },
    service_quality_budget: { source_ref: "w5:service_quality_budget", unit: "CNY", value: 120000 },
    minimum_service_quality_budget: {
      source_ref: "r1:minimum_quality_budget",
      unit: "CNY",
      value: 0
    },
    eligibility: {
      licensed: { source_ref: "w5:license", value: true },
      staffing_compliant: { source_ref: "w5:staffing", value: true }
    },
    ...overrides
  };
}

describe("R1 CAN service-feasibility domain", () => {
  it("turns exact capacity, workforce, quality and eligibility inputs into a deterministic feasible candidate", () => {
    const first = evaluateCanServiceFeasibility(input());
    const second = evaluateCanServiceFeasibility(input());

    expect(first).toEqual(second);
    expect(first.status).toBe("FEASIBLE");
    expect(first.why_not).toEqual([]);
    expect(first.constraints.map((item) => item.kind)).toEqual([
      "DEMAND",
      "CAPACITY",
      "WORKFORCE",
      "QUALITY",
      "ELIGIBILITY",
      "ELIGIBILITY"
    ]);
    expect(first.queue.claim).toBe("NOT_CLAIMED");
  });

  it("reports every blocking constraint without converting missing input to zero", () => {
    const result = evaluateCanServiceFeasibility(
      input({
        available_capacity_units: undefined,
        workforce_units: { source_ref: "w5:caregiver_supply", unit: "people", value: 0 },
        service_quality_budget: { source_ref: "w5:service_quality_budget", unit: "CNY", value: 0 },
        eligibility: {
          licensed: { source_ref: "w5:license", value: false },
          staffing_compliant: { source_ref: "w5:staffing", value: false }
        }
      })
    );

    expect(result.status).toBe("UNKNOWN");
    expect(result.why_not.map((item) => item.constraint_kind)).toEqual([
      "CAPACITY",
      "WORKFORCE",
      "ELIGIBILITY",
      "ELIGIBILITY"
    ]);
    expect(result.constraints.find((item) => item.kind === "CAPACITY")?.status).toBe("UNKNOWN");
  });

  it("rejects an implicit latest binding before evaluating domain values", () => {
    expect(() =>
      evaluateCanServiceFeasibility(
        input({
          binding: { ...binding, model_version_ref: "latest" }
        })
      )
    ).toThrowError(new CanServiceFeasibilityError("R1_EXACT_BINDING_REQUIRED"));
  });

  it("never emits official truth or settlement authority", () => {
    const result = evaluateCanServiceFeasibility(input());

    expect(result.authority).toEqual({
      candidate_writer: "SIMULATION_CORE_READ_ONLY",
      official_truth_write: false,
      provider_calls: 0,
      replay_truth_write: false,
      settlement_write: false
    });
  });

  it("does not compare capacity and demand when their semantic units differ", () => {
    const result = evaluateCanServiceFeasibility(
      input({
        available_capacity_units: {
          source_ref: "simulation-core:service_capacity",
          unit: "service_units",
          value: 64
        }
      })
    );

    expect(result.status).toBe("UNKNOWN");
    expect(result.constraints.find((item) => item.kind === "CAPACITY")?.status).toBe("UNKNOWN");
    expect(result.why_not).toContainEqual(
      expect.objectContaining({ code: "INPUT_UNAVAILABLE", constraint_kind: "CAPACITY" })
    );
  });

  it("keeps unavailable license and staffing signals unknown", () => {
    const result = evaluateCanServiceFeasibility(
      input({
        eligibility: {
          licensed: { source_ref: "w5:license:input-unavailable", value: null },
          staffing_compliant: { source_ref: "w5:staffing:input-unavailable", value: null }
        }
      })
    );

    expect(result.status).toBe("UNKNOWN");
    expect(result.constraints.filter((item) => item.kind === "ELIGIBILITY")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "UNKNOWN", observed: { unit: "boolean", value: null } })
      ])
    );
    expect(result.why_not).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INPUT_UNAVAILABLE", constraint_kind: "ELIGIBILITY" })
      ])
    );
  });
});
