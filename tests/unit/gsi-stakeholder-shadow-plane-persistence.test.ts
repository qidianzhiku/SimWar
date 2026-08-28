import { describe, expect, it } from "vitest";
import type { CurrentUser, GSIRecord, GSIRequest } from "@simwar/shared-contracts";
import {
  GSIStakeholderShadowPlaneError,
  GSIStakeholderShadowPlaneService
} from "../../services/api/src/gsi-stakeholder-shadow-plane-service.js";

const teacher: CurrentUser = {
  display_name: "Teacher",
  permissions: ["course:read"],
  roles: ["teacher"],
  tenant_id: "tenant_demo",
  user_id: "usr_teacher"
};

const student: CurrentUser = {
  display_name: "Student",
  permissions: ["course:read"],
  roles: ["student"],
  team_id: "team_001",
  tenant_id: "tenant_demo",
  user_id: "usr_student"
};

const request: GSIRequest = {
  discriminator: "gsi_stakeholder_shadow_request",
  binding: {
    tenant_id: "tenant_demo",
    course_id: "course_001",
    run_id: "run_001",
    round_id: "round_001",
    team_id: "team_001",
    scenario_package_id: "scenario_demo",
    scenario_version: "1.0.0",
    parameter_set_id: "parameter_demo",
    parameter_set_version: "1.0.0",
    model_version_id: "model_demo",
    model_version: "1.0.0",
    model_artifact_id: "artifact_demo",
    model_artifact_version: "1.0.0"
  },
  plane_mode: "OFF",
  publication_status: "PUBLISHED",
  proposals: [
    {
      proposal_id: "proposal_customer_1",
      stakeholder_type: "customer",
      intent: "protect_demand",
      priority: 0.8,
      influence: 0.4,
      summary: "Customers value predictable service."
    }
  ],
  idempotency_key: "gsi_idem_persistence_001"
};

const snapshot = {
  course: { course_id: "course_001", tenant_id: "tenant_demo" },
  run: { run_id: "run_001", course_id: "course_001", tenant_id: "tenant_demo" },
  round: { round_id: "round_001", run_id: "run_001", tenant_id: "tenant_demo" },
  team: { team_id: "team_001", course_id: "course_001", tenant_id: "tenant_demo" },
  assignments: [
    { assignment_id: "assignment_001", status: "active", role_key: "CEO", user_id: "usr_student" }
  ],
  sections: [],
  merge_commits: [],
  confirmations: [],
  decisions: [],
  events: []
} as never;

function service(
  records: GSIRecord[] = [],
  append = async (record: GSIRecord) => {
    records.push(structuredClone(record));
  }
) {
  return new GSIStakeholderShadowPlaneService({
    repository: {
      list: async () => structuredClone(records),
      get: async (_tenantId, candidateId) =>
        structuredClone(records.find((record) => record.candidate_id === candidateId) ?? null),
      append
    },
    roleWorkflow: { readRoleWorkflow: () => snapshot, commitRoleWorkflow: () => undefined },
    exactReferences: {
      getScenarioPackage: async () => ({
        scenario_package_id: "scenario_demo",
        tenant_id: "tenant_demo",
        name: "Demo",
        version: "1.0.0",
        status: "approved",
        plugin_package_ids: []
      }),
      getParameterSet: async () => ({
        parameter_set_id: "parameter_demo",
        tenant_id: "tenant_demo",
        version: "1.0.0",
        status: "approved",
        model_family: "toy_logit",
        seed: 1,
        base_market_size: 10,
        base_capacity: 5,
        unit_cost: 1,
        fixed_cost: 1
      })
    }
  });
}

describe("GSI candidate persistence and scope", () => {
  it("round-trips one candidate and reuses the same idempotency key", async () => {
    const records: GSIRecord[] = [];
    const instance = service(records);
    const generated = await instance.createCandidate(teacher, request, "req_1");
    const reused = await instance.createCandidate(teacher, request, "req_2");

    expect(records).toHaveLength(1);
    expect(generated.status).toBe("generated");
    expect(reused.status).toBe("reused");
    expect(reused.candidate_id).toBe(generated.candidate_id);
    expect(records[0]?.request.binding.team_id).toBe("team_001");
    expect(generated.formal_truth_write).toBe(false);
    expect(generated.writes_official_truth).toBe(false);
  });

  it("rejects changed content for an existing idempotency key", async () => {
    const instance = service([]);
    await instance.createCandidate(teacher, request, "req_1");
    await expect(
      instance.createCandidate(
        teacher,
        {
          ...request,
          proposals: [{ ...request.proposals[0], influence: 0.2 }]
        },
        "req_2"
      )
    ).rejects.toMatchObject({ code: "GSI_DUPLICATE_CONFLICT" });
  });

  it("returns only a published role-safe projection to the assigned student", async () => {
    const records: GSIRecord[] = [];
    const instance = service(records);
    const receipt = await instance.createCandidate(teacher, request, "req_1");
    const projection = await instance.getStudentProjection(student, receipt.candidate_id);

    expect(projection.surface).toBe("student");
    expect(projection.role_key).toBe("CEO");
    expect(JSON.stringify(projection)).not.toContain("Customers value predictable service");
    expect(JSON.stringify(projection)).not.toContain("proposal_id");
    expect(JSON.stringify(projection)).not.toContain("state_true");
  });

  it("fails closed when persistence fails", async () => {
    const instance = service([], async () => {
      throw new Error("persistence failed");
    });
    await expect(instance.createCandidate(teacher, request, "req_1")).rejects.toEqual(
      new GSIStakeholderShadowPlaneError("GSI_PERSISTENCE_FAILED")
    );
  });

  it("fails closed when a declared scenario version is not the stored exact reference", async () => {
    const instance = service([]);
    await expect(
      instance.createCandidate(
        teacher,
        {
          ...request,
          binding: { ...request.binding, scenario_version: "2.0.0" }
        },
        "req_5"
      )
    ).rejects.toMatchObject({ code: "GSI_CONTEXT_NOT_FOUND" });
  });
});
