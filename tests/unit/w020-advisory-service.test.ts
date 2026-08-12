import { describe, expect, it } from "vitest";
import {
  createGovernedAgentGateway,
  type AgentProviderPort
} from "../../services/agent-gateway/src/index.js";
import type {
  CurrentUser,
  TeachingClosureDto,
  W020AdvisoryAuditRecord,
  W020AdvisoryRecord
} from "@simwar/shared-contracts";
import {
  GovernedAdvisoryService,
  W020AdvisoryError
} from "../../services/api/src/w020-advisory-service.js";

const actor: CurrentUser = {
  display_name: "Student",
  permissions: ["course:read"],
  roles: ["student"],
  team_id: "team_001",
  tenant_id: "tenant_demo",
  user_id: "usr_student"
};

const teacher: CurrentUser = {
  display_name: "Teacher",
  permissions: ["course:read"],
  roles: ["teacher"],
  tenant_id: "tenant_demo",
  user_id: "usr_teacher"
};

const snapshot = {
  course: {
    course_id: "course_001",
    tenant_id: "tenant_demo",
    title: "Course",
    status: "active",
    scenario_package_id: "scenario_001",
    parameter_set_id: "parameter_001",
    created_by: "usr_teacher"
  },
  run: {
    run_id: "run_001",
    course_id: "course_001",
    tenant_id: "tenant_demo",
    scenario_package_id: "scenario_001",
    parameter_set_id: "parameter_001",
    seed: 1,
    status: "completed"
  },
  round: {
    round_id: "round_001",
    run_id: "run_001",
    tenant_id: "tenant_demo",
    round_no: 1,
    status: "published"
  },
  team: {
    team_id: "team_001",
    course_id: "course_001",
    tenant_id: "tenant_demo",
    name: "Team",
    captain_user_id: "usr_student",
    members: []
  },
  assignments: [
    { assignment_id: "assignment_001", status: "active", role_key: "CEO", user_id: "usr_student" },
    { assignment_id: "assignment_002", status: "active", role_key: "CFO", user_id: "usr_other" }
  ],
  sections: [],
  merge_commits: [],
  confirmations: [],
  decisions: [],
  events: [
    {
      event_id: "event_001",
      event_type: "section_saved",
      created_at: "2026-08-09T00:00:00.000Z",
      round_id: "round_001"
    }
  ]
} as never;

const teacherRequest = {
  activity_id: "activity_001",
  discriminator: "w020_advisory_request" as const,
  idempotency_key: "idem_teacher_001",
  role_key: "CEO" as const,
  round_id: "round_001",
  run_id: "run_001",
  surface: "teacher_debrief" as const,
  team_id: "team_001"
};

function eligibleTeachingClosure(
  context: {
    activity_id: string;
    course_id: string;
    role_key: string;
    run_id: string;
    team_id: string;
  },
  overrides: Partial<TeachingClosureDto> = {}
): TeachingClosureDto {
  const knownLimits = ["Human Validation is not performed."];
  return {
    context,
    course_report_available: true,
    export_formats: ["json", "markdown"],
    known_limits: knownLimits,
    queue_item: {
      claim_status: "AVAILABLE",
      confirmation_status: "CONFIRMED",
      context,
      eligible_event_count: 1,
      evidence_count: 1,
      known_limits: knownLimits,
      missing: [],
      outcome_status: "CONFIRMED"
    },
    runtime_authority: "JSON_INTERNAL_ONLY",
    schema_version: "teaching-closure.v1",
    student_safe_preview: {
      criterion_count: 1,
      evidence_count: 1,
      next_focus: "Review the confirmed criterion outcome with the student.",
      status: "CONFIRMED",
      visibility: "student_safe"
    },
    ...overrides
  };
}

function repository(
  records: W020AdvisoryRecord[],
  audits: W020AdvisoryAuditRecord[],
  options: { failAudit?: boolean; failSuccess?: boolean } = {}
) {
  return {
    list: async () => structuredClone(records),
    listAudit: async () => structuredClone(audits),
    appendSuccess: async (command: {
      record: W020AdvisoryRecord;
      audit: W020AdvisoryAuditRecord;
    }) => {
      if (options.failSuccess) throw new Error("success persistence unavailable");
      records.push(structuredClone(command.record));
      audits.push(structuredClone(command.audit));
    },
    appendAudit: async (audit: W020AdvisoryAuditRecord) => {
      if (options.failAudit) throw new Error("audit persistence unavailable");
      audits.push(structuredClone(audit));
    }
  };
}

function service(
  records: W020AdvisoryRecord[] = [],
  workflowSnapshot = snapshot,
  audits: W020AdvisoryAuditRecord[] = [],
  closureGet: (
    context: Parameters<typeof eligibleTeachingClosure>[0]
  ) => Promise<TeachingClosureDto> = async (context) => eligibleTeachingClosure(context)
) {
  return new GovernedAdvisoryService({
    repository: repository(records, audits),
    roleWorkflow: { readRoleWorkflow: () => workflowSnapshot, commitRoleWorkflow: () => undefined },
    teachingClosure: {
      get: async (_actor, context) => closureGet(context)
    }
  });
}

describe("W020 governed advisory service", () => {
  it("creates and reuses the same advisory without writing formal truth", async () => {
    const records: W020AdvisoryRecord[] = [];
    const instance = service(records);
    const request = {
      discriminator: "w020_advisory_request" as const,
      surface: "student_role" as const,
      run_id: "run_001",
      round_id: "round_001",
      team_id: "team_001",
      role_key: "CEO" as const,
      idempotency_key: "idem_001"
    };
    const generated = await instance.createStudentRoleAdvisory(actor, request, "req_1");
    const reused = await instance.createStudentRoleAdvisory(actor, request, "req_2");
    expect(generated.status).toBe("generated");
    expect(reused.status).toBe("reused");
    expect(records).toHaveLength(1);
    expect(generated.formal_truth_write).toBe(false);
  });

  it("rejects a changed digest for an existing idempotency key", async () => {
    const records: W020AdvisoryRecord[] = [];
    const instance = service(records);
    const base = {
      discriminator: "w020_advisory_request" as const,
      surface: "teacher_debrief" as const,
      run_id: "run_001",
      round_id: "round_001",
      team_id: "team_001",
      role_key: "CEO" as const,
      activity_id: "activity_001",
      idempotency_key: "idem_002"
    };
    await instance.createTeacherDebriefAdvisory(teacher, base, "req_1");
    await expect(
      instance.createTeacherDebriefAdvisory(
        teacher,
        { ...base, role_key: "CFO", activity_id: "activity_002" },
        "req_2"
      )
    ).rejects.toMatchObject({ code: "W020_DUPLICATE_CONFLICT" });
  });

  it("rejects idempotency-key reuse by a different actor", async () => {
    const records: W020AdvisoryRecord[] = [];
    const instance = service(records);
    await instance.createTeacherDebriefAdvisory(teacher, teacherRequest, "req_1");

    await expect(
      instance.createTeacherDebriefAdvisory(
        { ...teacher, user_id: "usr_teacher_other" },
        teacherRequest,
        "req_2"
      )
    ).rejects.toMatchObject({ code: "W020_DUPLICATE_CONFLICT" });
  });

  it("rejects a forged team scope", async () => {
    const instance = service();
    const request = {
      discriminator: "w020_advisory_request" as const,
      surface: "student_role" as const,
      run_id: "run_001",
      round_id: "round_001",
      team_id: "team_other",
      role_key: "CEO" as const,
      idempotency_key: "idem_003"
    };
    await expect(
      instance.createStudentRoleAdvisory(actor, request, "req_1")
    ).rejects.toBeInstanceOf(W020AdvisoryError);
  });

  it("rejects a team from another course in the same tenant", async () => {
    const mismatched = {
      ...snapshot,
      team: { team_id: "team_001", course_id: "course_other", tenant_id: "tenant_demo" }
    } as never;
    const instance = service([], mismatched);
    const request = {
      discriminator: "w020_advisory_request" as const,
      surface: "student_role" as const,
      run_id: "run_001",
      round_id: "round_001",
      team_id: "team_001",
      role_key: "CEO" as const,
      idempotency_key: "idem_004"
    };
    await expect(instance.createStudentRoleAdvisory(actor, request, "req_1")).rejects.toMatchObject(
      { code: "W020_CONTEXT_NOT_FOUND" }
    );
  });

  it("serializes concurrent writes for one idempotency key", async () => {
    const records: W020AdvisoryRecord[] = [];
    const instance = service(records);
    const request = {
      discriminator: "w020_advisory_request" as const,
      surface: "teacher_debrief" as const,
      run_id: "run_001",
      round_id: "round_001",
      team_id: "team_001",
      role_key: "CEO" as const,
      activity_id: "activity_001",
      idempotency_key: "idem_005"
    };
    const results = await Promise.all([
      instance.createTeacherDebriefAdvisory(teacher, request, "req_1"),
      instance.createTeacherDebriefAdvisory(teacher, request, "req_2")
    ]);
    expect(records).toHaveLength(1);
    expect(results.map((result) => result.status).sort()).toEqual(["generated", "reused"]);
  });

  it("records the actual call time in the audit log", async () => {
    const records: W020AdvisoryRecord[] = [];
    const audits: W020AdvisoryAuditRecord[] = [];
    const instance = new GovernedAdvisoryService({
      repository: repository(records, audits),
      roleWorkflow: { readRoleWorkflow: () => snapshot, commitRoleWorkflow: () => undefined },
      teachingClosure: {
        get: async (_actor, context) => eligibleTeachingClosure(context)
      },
      now: () => "2026-08-09T03:00:00.000Z"
    });
    const request = {
      discriminator: "w020_advisory_request" as const,
      surface: "teacher_debrief" as const,
      run_id: "run_001",
      round_id: "round_001",
      team_id: "team_001",
      role_key: "CEO" as const,
      activity_id: "activity_001",
      idempotency_key: "idem_006"
    };
    await instance.createTeacherDebriefAdvisory(teacher, request, "req_1");
    expect(records[0]?.model_call_log.created_at).toBe("2026-08-09T03:00:00.000Z");
  });

  it("persists a bounded failed audit and no advisory when the provider throws", async () => {
    const records: W020AdvisoryRecord[] = [];
    const audits: W020AdvisoryAuditRecord[] = [];
    const provider: AgentProviderPort = {
      model: "throwing-model",
      provider: "throwing-provider",
      generate: () => {
        throw new Error("private provider detail");
      }
    };
    const instance = new GovernedAdvisoryService({
      gateway: createGovernedAgentGateway(provider, {
        now: () => new Date("2026-08-09T04:00:00.000Z")
      }),
      repository: repository(records, audits),
      roleWorkflow: { readRoleWorkflow: () => snapshot, commitRoleWorkflow: () => undefined }
    });
    const request = {
      discriminator: "w020_advisory_request" as const,
      surface: "student_role" as const,
      run_id: "run_001",
      round_id: "round_001",
      team_id: "team_001",
      role_key: "CEO" as const,
      idempotency_key: "idem_failed_001"
    };

    await expect(
      instance.createStudentRoleAdvisory(actor, request, "req_failed")
    ).rejects.toMatchObject({
      code: "W020_PROVIDER_FAILED"
    });
    expect(records).toHaveLength(0);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.model_call_log.status).toBe("failed");
    expect(audits[0]?.surface).toBe("student_role");
    expect(JSON.stringify(audits[0])).not.toContain("private provider detail");
    expect(JSON.stringify(audits[0])).not.toContain("advisory_text");
  });

  it("persists a bounded rejected audit and no advisory for invalid provider output", async () => {
    const records: W020AdvisoryRecord[] = [];
    const audits: W020AdvisoryAuditRecord[] = [];
    const provider: AgentProviderPort = {
      model: "invalid-model",
      provider: "invalid-provider",
      generate: () => ({ advisory_text: "   ", private_payload: "secret" })
    };
    const instance = new GovernedAdvisoryService({
      gateway: createGovernedAgentGateway(provider),
      repository: repository(records, audits),
      roleWorkflow: { readRoleWorkflow: () => snapshot, commitRoleWorkflow: () => undefined }
    });
    const request = {
      discriminator: "w020_advisory_request" as const,
      surface: "student_role" as const,
      run_id: "run_001",
      round_id: "round_001",
      team_id: "team_001",
      role_key: "CEO" as const,
      idempotency_key: "idem_rejected_001"
    };

    await expect(
      instance.createStudentRoleAdvisory(actor, request, "req_rejected")
    ).rejects.toMatchObject({
      code: "W020_OUTPUT_REJECTED"
    });
    expect(records).toHaveLength(0);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.model_call_log.status).toBe("rejected");
    expect(JSON.stringify(audits[0])).not.toContain("private_payload");
    expect(JSON.stringify(audits[0])).not.toContain("secret");
  });

  it("fails closed when a failed provider audit cannot be persisted", async () => {
    const records: W020AdvisoryRecord[] = [];
    const audits: W020AdvisoryAuditRecord[] = [];
    const provider: AgentProviderPort = {
      model: "throwing-model",
      provider: "throwing-provider",
      generate: () => {
        throw new Error("provider unavailable");
      }
    };
    const instance = new GovernedAdvisoryService({
      gateway: createGovernedAgentGateway(provider),
      repository: repository(records, audits, { failAudit: true }),
      roleWorkflow: { readRoleWorkflow: () => snapshot, commitRoleWorkflow: () => undefined }
    });
    const request = {
      discriminator: "w020_advisory_request" as const,
      surface: "student_role" as const,
      run_id: "run_001",
      round_id: "round_001",
      team_id: "team_001",
      role_key: "CEO" as const,
      idempotency_key: "idem_audit_failure_001"
    };

    await expect(
      instance.createStudentRoleAdvisory(actor, request, "req_audit_failure")
    ).rejects.toMatchObject({
      code: "W020_PERSISTENCE_FAILED"
    });
    expect(records).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it("binds teacher advice to an exact published W019 safe source", async () => {
    const result = await service().createTeacherDebriefAdvisory(
      teacher,
      teacherRequest,
      "req_teacher_safe"
    );

    expect(result.context.activity_id).toBe("activity_001");
    expect(result.context.teacher_safe_source).toMatchObject({
      course_report_available: true,
      outcome_status: "CONFIRMED",
      runtime_authority: "JSON_INTERNAL_ONLY",
      source_schema_version: "teaching-closure.v1"
    });
    expect(result.projection.teacher_debrief).toMatchObject({
      next_focus: "Review the confirmed criterion outcome with the student."
    });
    expect(result.projection.teacher_debrief?.discussion_prompts.length).toBeGreaterThan(0);
    expect(result.projection.teacher_debrief?.explanations.length).toBeGreaterThan(0);
    expect(result.projection.teacher_debrief?.tradeoffs.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain("SettlementResult");
    expect(JSON.stringify(result)).not.toContain("replay_hash");
    expect(JSON.stringify(result)).not.toContain("raw_payload");
  });

  it.each([
    ["draft course", { course: { ...snapshot.course, status: "draft" } }],
    ["active run", { run: { ...snapshot.run, status: "active" } }],
    ["settled round", { round: { ...snapshot.round, status: "settled" } }]
  ])("rejects teacher advice for an unpublished runtime source: %s", async (_label, change) => {
    const instance = service([], { ...snapshot, ...change } as never);
    await expect(
      instance.createTeacherDebriefAdvisory(teacher, teacherRequest, "req_unpublished")
    ).rejects.toMatchObject({ code: "W020_SOURCE_NOT_ELIGIBLE" });
  });

  it.each([
    [
      "context mismatch",
      async (context: Parameters<typeof eligibleTeachingClosure>[0]) =>
        eligibleTeachingClosure({ ...context, activity_id: "activity_other" })
    ],
    [
      "course report missing",
      async (context: Parameters<typeof eligibleTeachingClosure>[0]) =>
        eligibleTeachingClosure(context, { course_report_available: false })
    ],
    [
      "confirmation pending",
      async (context: Parameters<typeof eligibleTeachingClosure>[0]) => {
        const closure = eligibleTeachingClosure(context);
        return {
          ...closure,
          queue_item: {
            ...closure.queue_item,
            confirmation_status: "DRAFT",
            outcome_status: "PENDING"
          },
          student_safe_preview: { ...closure.student_safe_preview, status: "PENDING" }
        } as TeachingClosureDto;
      }
    ]
  ])("rejects an ineligible W019 safe source: %s", async (_label, closureGet) => {
    const instance = service([], snapshot, [], closureGet);
    await expect(
      instance.createTeacherDebriefAdvisory(teacher, teacherRequest, "req_unsafe_source")
    ).rejects.toMatchObject({ code: "W020_SOURCE_NOT_ELIGIBLE" });
  });

  it("fails closed for an actor without an authorized W020 role", async () => {
    const unknownActor = { ...teacher, roles: ["observer"] };
    await expect(
      service().createTeacherDebriefAdvisory(unknownActor, teacherRequest, "req_unknown_role")
    ).rejects.toMatchObject({ code: "W020_FORBIDDEN" });
  });
  it("rejects teacher advice when the exact W019 TeachingClosure source is not eligible", async () => {
    const instance = new GovernedAdvisoryService({
      repository: {
        list: async () => [],
        append: async () => undefined
      },
      roleWorkflow: { readRoleWorkflow: () => snapshot, commitRoleWorkflow: () => undefined },
      teachingClosure: {
        get: async () => ({ course_report_available: false })
      }
    } as never);
    const request = {
      discriminator: "w020_advisory_request" as const,
      surface: "teacher_debrief" as const,
      run_id: "run_001",
      round_id: "round_001",
      team_id: "team_001",
      role_key: "CMO" as const,
      activity_id: "activity_001",
      idempotency_key: "idem_teaching_closure_ineligible"
    };

    await expect(
      instance.createTeacherDebriefAdvisory(teacher, request as never, "req_ineligible")
    ).rejects.toMatchObject({ code: "W020_SOURCE_NOT_ELIGIBLE" });
  });
});
