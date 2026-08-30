import { describe, expect, it, vi } from "vitest";
import {
  CanServiceFeasibilityService,
  type CanServiceFeasibilitySource
} from "../../services/api/src/can-service-feasibility-service";
import type {
  CanServiceFeasibilityActor,
  CanServiceFeasibilityDomainInput
} from "../../services/api/src/can-service-feasibility-service";

const domainInput: CanServiceFeasibilityDomainInput = {
  binding: {
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
  },
  demand_units: { source_ref: "w5:customer_demand", unit: "households", value: 40 },
  available_capacity_units: {
    source_ref: "simulation-core:service_capacity",
    unit: "service_units",
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
  }
};

const teacher: CanServiceFeasibilityActor = {
  roles: ["teacher"],
  tenant_id: "tenant_demo",
  team_id: undefined,
  user_id: "teacher_demo"
};

const request = {
  course_id: "course_demo",
  draft_id: "w5_draft_1",
  round_id: "round_demo_1",
  round_no: 1,
  run_id: "run_demo",
  tenant_id: "tenant_demo"
} as const;

function source(): CanServiceFeasibilitySource {
  return { readExactInput: vi.fn().mockResolvedValue(domainInput) };
}

describe("R1 CAN service-feasibility API service", () => {
  it("returns an exact teacher product receipt over the deterministic candidate", async () => {
    const result = await new CanServiceFeasibilityService(source()).get({
      actor: teacher,
      request: { ...request, surface: "teacher" }
    });

    expect(result.surface).toBe("teacher");
    expect(result.teacher_projection?.status).toBe("FEASIBLE");
    expect(result.product_receipt).toEqual({
      exact_binding_digest: domainInput.binding.binding_digest,
      no_write: true,
      operation_id: "R1_CAN_SERVICE_FEASIBILITY_GET_V1",
      state_transition: "STATE_A_TO_STATE_B"
    });
    expect(result.source_refs).toEqual(
      expect.arrayContaining(["w5:customer_demand", "simulation-core:service_capacity"])
    );
  });

  it("redacts candidate inputs and exact references for the student why-not projection", async () => {
    const result = await new CanServiceFeasibilityService(source()).get({
      actor: { ...teacher, roles: ["student"], team_id: "team_demo", user_id: "student_demo" },
      request: { ...request, surface: "student" }
    });

    expect(result.student_projection?.role_safe).toBe(true);
    expect(result.student_projection?.why_not).toEqual([]);
    expect(result.candidate).toBeUndefined();
    expect(result.exact_binding).toBeUndefined();
    expect(result.source_refs).toEqual([]);
  });

  it("rejects an actor from a different tenant before reading the exact source", async () => {
    const read = vi.fn();
    await expect(
      new CanServiceFeasibilityService({ readExactInput: read }).get({
        actor: { ...teacher, tenant_id: "tenant_other" },
        request: { ...request, surface: "teacher" }
      })
    ).rejects.toMatchObject({ code: "R1_SCOPE_CONFLICT" });
    expect(read).not.toHaveBeenCalled();
  });
});
