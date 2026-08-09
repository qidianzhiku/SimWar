import { describe, expect, it } from "vitest";
import type { CurrentUser, W020AdvisoryRecord } from "@simwar/shared-contracts";
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
  events: [
    {
      event_id: "event_001",
      event_type: "section_saved",
      created_at: "2026-08-09T00:00:00.000Z",
      round_id: "round_001"
    }
  ]
} as never;

function service(records: W020AdvisoryRecord[] = [], workflowSnapshot = snapshot) {
  return new GovernedAdvisoryService({
    repository: {
      list: async () => structuredClone(records),
      append: async (record) => records.push(structuredClone(record))
    },
    roleWorkflow: { readRoleWorkflow: () => workflowSnapshot, commitRoleWorkflow: () => undefined }
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
      role_key: "CMO" as const,
      idempotency_key: "idem_002"
    };
    await instance.createTeacherDebriefAdvisory(teacher, base, "req_1");
    await expect(
      instance.createTeacherDebriefAdvisory(teacher, { ...base, role_key: "CFO" }, "req_2")
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
    const instance = new GovernedAdvisoryService({
      repository: {
        list: async () => structuredClone(records),
        append: async (record) => records.push(structuredClone(record))
      },
      roleWorkflow: { readRoleWorkflow: () => snapshot, commitRoleWorkflow: () => undefined },
      now: () => "2026-08-09T03:00:00.000Z"
    });
    const request = {
      discriminator: "w020_advisory_request" as const,
      surface: "teacher_debrief" as const,
      run_id: "run_001",
      round_id: "round_001",
      team_id: "team_001",
      idempotency_key: "idem_006"
    };
    await instance.createTeacherDebriefAdvisory(teacher, request, "req_1");
    expect(records[0]?.model_call_log.created_at).toBe("2026-08-09T03:00:00.000Z");
  });
});
