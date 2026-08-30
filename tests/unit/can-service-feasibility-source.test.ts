import { describe, expect, it, vi } from "vitest";
import {
  createW5CanServiceFeasibilitySource,
  type CanServiceFeasibilitySourceDependencies
} from "../../services/api/src/can-service-feasibility-source";
import type {
  CanServiceFeasibilityActor,
  CanServiceFeasibilityRequest
} from "../../services/api/src/can-service-feasibility-service";

const request: CanServiceFeasibilityRequest = {
  course_id: "course_demo",
  draft_id: "w5_draft_1",
  round_id: "round_demo_1",
  round_no: 1,
  run_id: "run_demo",
  surface: "teacher",
  tenant_id: "tenant_demo"
};

const actor: CanServiceFeasibilityActor = {
  roles: ["teacher"],
  tenant_id: "tenant_demo",
  user_id: "teacher_demo"
};

const binding = {
  binding_digest: "b".repeat(64),
  binding_id: "w5_binding_w5_draft_1",
  course_id: "course_demo",
  model_version_ref: "eldercare_w5_governed_v1@1.1.0" as const,
  no_implicit_latest: true as const,
  parameter_set_reference: {
    content_digest: "a".repeat(64),
    parameter_set_id: "parameter_set_demo",
    version: "1.0.0"
  },
  round_no: 1,
  run_id: "run_demo",
  scenario_package_reference: {
    content_digest: "c".repeat(64),
    scenario_package_id: "scenario_demo",
    tenant_id: "tenant_demo",
    version: "1.0.0"
  },
  seed: 20260829,
  status: "BOUND" as const,
  tenant_id: "tenant_demo"
};

function dependencies(
  constraints: readonly string[] = ["capacity=64", "workforce=80", "quality=1"]
): CanServiceFeasibilitySourceDependencies {
  return {
    repository: {
      courses: {
        getCourse: vi.fn().mockResolvedValue({ course_id: "course_demo", tenant_id: "tenant_demo" })
      },
      runs: {
        getRun: vi.fn().mockResolvedValue({
          course_id: "course_demo",
          parameter_set_id: "parameter_set_demo",
          run_id: "run_demo",
          scenario_package_id: "scenario_demo",
          tenant_id: "tenant_demo"
        })
      },
      rounds: {
        listRoundsForRun: vi
          .fn()
          .mockResolvedValue([
            { round_id: "round_demo_1", round_no: 1, run_id: "run_demo", tenant_id: "tenant_demo" }
          ])
      }
    },
    w5: {
      getDraft: vi.fn().mockReturnValue({
        course_id: "course_demo",
        exact_runtime_binding: binding,
        model_version_ref: binding.model_version_ref,
        parameter_values: { caregiver_supply: 80, customer_demand: 40 }
      }),
      evaluate: vi.fn().mockReturnValue({ can: { constraints, eligible: true } })
    }
  };
}

describe("R1 CAN W5 exact source adapter", () => {
  it("composes exact round identity and W5 candidate signals without writing truth", async () => {
    const result = await createW5CanServiceFeasibilitySource(dependencies()).readExactInput(
      request,
      actor
    );

    expect(result?.binding.round_id).toBe("round_demo_1");
    expect(result?.binding.no_implicit_latest).toBe(true);
    expect(result?.demand_units.value).toBe(40);
    expect(result?.workforce_units.value).toBe(80);
    expect(result?.available_capacity_units?.value).toBe(64);
    expect(result?.eligibility.licensed.source_ref).toContain("license_and_staffing");
  });

  it("keeps a missing capacity input absent so the domain emits UNKNOWN", async () => {
    const result = await createW5CanServiceFeasibilitySource(
      dependencies(["workforce=80", "quality=1"])
    ).readExactInput(request, actor);

    expect(result?.available_capacity_units).toBeUndefined();
  });

  it("rejects a run/round context that cannot prove the exact requested identity", async () => {
    const mismatched = dependencies();
    mismatched.repository.runs.getRun = vi.fn().mockResolvedValue({
      course_id: "course_other",
      parameter_set_id: "parameter_set_demo",
      run_id: "run_demo",
      scenario_package_id: "scenario_demo",
      tenant_id: "tenant_demo"
    });

    await expect(
      createW5CanServiceFeasibilitySource(mismatched).readExactInput(request, actor)
    ).resolves.toBeNull();
  });
});
