import { describe, expect, it } from "vitest";
import {
  GSI_MODEL_ARTIFACT_ID,
  GSI_MODEL_ARTIFACT_VERSION,
  GSI_MODEL_VERSION,
  GSI_MODEL_VERSION_ID,
  type CurrentUser,
  type GSIRecord,
  type GSIRequest
} from "@simwar/shared-contracts";
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

const platformAdmin: CurrentUser = {
  display_name: "Platform Admin",
  permissions: ["course:read"],
  roles: ["platform_admin"],
  tenant_id: "tenant_platform",
  user_id: "usr_platform_admin"
};

const request: GSIRequest = {
  discriminator: "gsi_stakeholder_shadow_request",
  binding: {
    tenant_id: "tenant_demo",
    course_id: "course_001",
    run_id: "run_001",
    round_id: "round_001",
    round_no: 1,
    team_id: "team_001",
    activity_id: "activity_gsi",
    role_key: "CEO",
    scenario_package_id: "scenario_demo",
    scenario_version: "1.0.0",
    parameter_set_id: "parameter_demo",
    parameter_set_version: "1.0.0",
    model_version_id: GSI_MODEL_VERSION_ID,
    model_version: GSI_MODEL_VERSION,
    model_artifact_id: GSI_MODEL_ARTIFACT_ID,
    model_artifact_version: GSI_MODEL_ARTIFACT_VERSION
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
  run: {
    run_id: "run_001",
    course_id: "course_001",
    parameter_set_id: "parameter_demo",
    scenario_package_id: "scenario_demo",
    tenant_id: "tenant_demo"
  },
  round: { round_id: "round_001", round_no: 1, run_id: "run_001", tenant_id: "tenant_demo" },
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
  },
  workflowSnapshot = snapshot
) {
  return new GSIStakeholderShadowPlaneService({
    repository: {
      list: async () => structuredClone(records),
      get: async (_tenantId, candidateId) =>
        structuredClone(records.find((record) => record.candidate_id === candidateId) ?? null),
      append
    },
    roleWorkflow: {
      readRoleWorkflow: () => workflowSnapshot,
      commitRoleWorkflow: () => undefined
    },
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
  it.each([teacher, student, platformAdmin])(
    "filters mixed activity and role before pair cardinality for $roles",
    async (actor) => {
      const records: GSIRecord[] = [];
      const instance = service(records);
      await instance.createCandidate(teacher, request, "req_mixed");
      for (const binding of [{ role_key: "CFO" }, { activity_id: "activity_other" }]) {
        const other = structuredClone(records[0]!);
        other.candidate_id = JSON.stringify(binding);
        Object.assign(other.request.binding, binding);
        records.push(other);
      }
      const options = await instance.getPairOptions(actor, request.binding, "tenant_demo");
      expect(options.rounds).toEqual([{ round_id: "round_001", round_no: 1 }]);
      const second = structuredClone(records[0]!);
      second.candidate_id = "second_round";
      second.request.binding.round_id = "round_002";
      records.push(second);
      await expect(
        instance.compareRoundPair(
          actor,
          {
            ...request.binding,
            from_round_id: "round_001",
            to_round_id: "round_002"
          },
          "tenant_demo"
        )
      ).rejects.not.toMatchObject({ code: "GSI_PAIR_AMBIGUOUS" });
    }
  );
  it("filters inactive/private candidates before exposing round-pair uniqueness", async () => {
    const records: GSIRecord[] = [];
    const creator = service(records);
    const receipt = await creator.createCandidate(teacher, request, "req_visibility");
    records.push({ ...structuredClone(records[0]!), candidate_id: "hidden_duplicate" });
    const inactive = structuredClone(snapshot) as unknown as {
      assignments: Array<{ status: string }>;
    };
    inactive.assignments[0]!.status = "inactive";
    const reader = service(records, undefined, inactive as never);
    const input = {
      course_id: request.binding.course_id,
      run_id: request.binding.run_id,
      team_id: request.binding.team_id,
      activity_id: request.binding.activity_id,
      role_key: request.binding.role_key
    };
    expect((await reader.getPairOptions(student, input)).rounds).toEqual([]);
    await expect(
      reader.compareRoundPair(student, {
        ...input,
        from_round_id: request.binding.round_id,
        to_round_id: "round_002"
      })
    ).rejects.toMatchObject({ code: "GSI_PAIR_NOT_AVAILABLE" });
    await expect(reader.getStudentProjection(student, receipt.candidate_id)).rejects.toMatchObject({
      code: "GSI_FORBIDDEN"
    });
    records[1]!.request.publication_status = "DRAFT";
    expect((await creator.getPairOptions(student, input)).rounds).toEqual([
      { round_id: request.binding.round_id, round_no: 1 }
    ]);
  });

  it("never relabels a stored CEO candidate as the requester's CFO role", async () => {
    const records: GSIRecord[] = [];
    const instance = service(records);
    const receipt = await instance.createCandidate(teacher, request, "req_role");
    const changed = structuredClone(snapshot) as unknown as {
      assignments: Array<{ status: string; role_key: string; user_id: string }>;
    };
    changed.assignments.push({ status: "active", role_key: "CFO", user_id: "usr_cfo" });
    await expect(
      service(records, undefined, changed as never).getStudentProjection(
        { ...student, user_id: "usr_cfo" },
        receipt.candidate_id
      )
    ).rejects.toMatchObject({ code: "GSI_FORBIDDEN" });
    expect(records[0]!.student_projection.role_key).toBe("CEO");
  });

  it("rejects pair activity and role rebinding before the comparator", async () => {
    const records: GSIRecord[] = [];
    const instance = service(records);
    const receipt = await instance.createCandidate(teacher, request, "req_pair_scope");
    records.push({ ...structuredClone(records[0]!), candidate_id: "candidate_second" });
    for (const input of [
      { activity_id: "activity_other", role_key: "CEO" },
      { activity_id: "activity_gsi", role_key: "CFO" }
    ]) {
      await expect(
        instance.compareCandidates(student, {
          ...input,
          from_candidate_id: receipt.candidate_id,
          to_candidate_id: "candidate_second"
        })
      ).rejects.toMatchObject({ code: "GSI_FORBIDDEN" });
    }
  });

  it("rejects a stored candidate whose course no longer matches server workflow", async () => {
    const records: GSIRecord[] = [];
    const instance = service(records);
    const receipt = await instance.createCandidate(teacher, request, "req_scope");
    records[0]!.request.binding.course_id = "course_other";
    await expect(
      instance.getStudentProjection(student, receipt.candidate_id)
    ).rejects.toMatchObject({
      code: "GSI_CONTEXT_NOT_FOUND"
    });
  });

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

  it("persists the role-safe context, coach output, and model call log with the candidate", async () => {
    const records: GSIRecord[] = [];
    const instance = service(records);

    await instance.createCandidate(teacher, request, "req_audit_1");

    const persisted = records[0] as GSIRecord & {
      context?: { context_digest?: string; run_id?: string };
      coach_output?: { model_call_log_id?: string };
      model_call_log?: { model_call_log_id?: string; provider?: string };
      audit_log?: {
        action?: string;
        request_id?: string;
        after?: { context_digest?: string; model_call_log_id?: string };
      };
    };
    expect(persisted.context).toMatchObject({ run_id: "run_001" });
    expect(persisted.context?.context_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted.coach_output?.model_call_log_id).toMatch(/^model_call_/);
    expect(persisted.model_call_log).toMatchObject({
      model_call_log_id: persisted.coach_output?.model_call_log_id,
      provider: "deterministic-mock"
    });
    expect(persisted.audit_log).toMatchObject({
      action: "gsi.candidate.create",
      request_id: "req_audit_1",
      after: {
        context_digest: persisted.context?.context_digest,
        model_call_log_id: persisted.model_call_log?.model_call_log_id
      }
    });
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

  it("rejects a candidate when its run is bound to different scenario or parameter resources", async () => {
    const mismatchedSnapshot = {
      ...snapshot,
      run: { ...snapshot.run, parameter_set_id: "parameter_other" }
    } as never;
    const instance = service([], undefined, mismatchedSnapshot);

    await expect(
      instance.createCandidate(teacher, request, "req_run_binding_1")
    ).rejects.toMatchObject({
      code: "GSI_CONTEXT_NOT_FOUND"
    });
  });

  it("rejects model and artifact references that are not the governed deterministic identity", async () => {
    const forgedBindingRequest = {
      ...request,
      binding: {
        ...request.binding,
        model_artifact_id: "artifact:forged-model:9.9.9",
        model_artifact_version: "9.9.9",
        model_version: "9.9.9",
        model_version_id: "forged-model"
      }
    };
    const instance = service([]);

    await expect(
      instance.createCandidate(teacher, forgedBindingRequest, "req_model_binding_1")
    ).rejects.toMatchObject({ code: "GSI_CONTEXT_NOT_FOUND" });
  });

  it("lets a platform admin read a candidate through an explicit selected tenant context", async () => {
    const records: GSIRecord[] = [];
    const instance = service(records);
    const created = await instance.createCandidate(teacher, request, "req_admin_1");

    const projection = await instance.getAdminProjection(
      platformAdmin,
      "tenant_demo",
      created.candidate_id
    );

    expect(projection.tenant_id).toBe("tenant_demo");
    expect(projection.binding.run_id).toBe("run_001");
    expect(projection.context_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(projection.model_call_log_id).toMatch(/^model_call_/);
    expect(projection.audit_log_id).toMatch(/^gsi_audit_/);
  });
});
