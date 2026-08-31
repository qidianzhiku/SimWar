import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@simwar/shared-contracts";
import { handleW020AdvisoryRoute } from "../../services/api/src/routes/w020-advisory-routes.js";
import { GovernedAdvisoryService } from "../../services/api/src/w020-advisory-service.js";

const studentConsumer = readFileSync(
  resolve(process.cwd(), "apps/student/src/StudentRoleAdvisor.tsx"),
  "utf8"
);
const teacherConsumer = readFileSync(
  resolve(process.cwd(), "apps/teacher/src/TeacherDebriefAdvisor.tsx"),
  "utf8"
);

const student: CurrentUser = {
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

const workflowSnapshot = {
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

function response() {
  return {
    statusCode: 0,
    body: "",
    writeHead(status: number) {
      this.statusCode = status;
    },
    end(body: string) {
      this.body = body;
    }
  };
}

function service(records: never[]) {
  return new GovernedAdvisoryService({
    repository: {
      list: async () => structuredClone(records),
      append: async (record) => records.push(record as never)
    },
    roleWorkflow: {
      readRoleWorkflow: () => workflowSnapshot,
      commitRoleWorkflow: () => undefined
    } as never
  });
}

function helpers(body: unknown) {
  return {
    readJson: async () => body,
    sendJson(target: ReturnType<typeof response>, status: number, payload: unknown) {
      target.writeHead(status);
      target.end(JSON.stringify(payload));
    },
    createEnvelope: (_context: unknown, payload: unknown) => ({ code: "OK", data: payload }),
    requireStudent: () => undefined,
    requireTeacher: () => undefined
  };
}

describe("W020 exact real consumer paths", () => {
  it("binds StudentRoleAdvisor to student BFF, service, and deterministic gateway", async () => {
    expect(studentConsumer).toContain("/api/v1/bff/student/advisors/role");
    expect(studentConsumer).toContain("role_key: roleKey");
    expect(studentConsumer).toContain("run_id: props.runId");
    expect(studentConsumer).toContain("round_id: props.roundId");
    expect(studentConsumer).toContain("team_id: props.teamId");

    const records: never[] = [];
    const target = response();
    const handled = await handleW020AdvisoryRoute(
      service(records),
      { method: "POST" } as never,
      target as never,
      new URL("http://localhost/api/v1/bff/student/advisors/role"),
      { requestId: "req_student", tenantId: "tenant_demo", actor: student },
      helpers({
        discriminator: "w020_advisory_request",
        surface: "student_role",
        run_id: "run_001",
        round_id: "round_001",
        team_id: "team_001",
        role_key: "CEO",
        idempotency_key: "student-001"
      })
    );

    expect(handled).toBe(true);
    expect(target.statusCode).toBe(201);
    expect(target.body).toContain('"advisory_only":true');
    expect(target.body).toContain('"provider":"deterministic-mock"');
    expect(target.body).not.toContain("state_true");
    expect(target.body).not.toContain("SettlementResult");
  });

  it("binds TeacherDebriefAdvisor to teacher debrief/audit BFF, service, and gateway", async () => {
    expect(teacherConsumer).toContain("/api/v1/bff/teacher/advisors/debrief");
    expect(teacherConsumer).toContain("/api/v1/bff/teacher/advisors/audit");
    expect(teacherConsumer).toContain("team_id: selectedTeamId");

    const records: never[] = [];
    const instance = service(records);
    const debriefTarget = response();
    const debriefHandled = await handleW020AdvisoryRoute(
      instance,
      { method: "POST" } as never,
      debriefTarget as never,
      new URL("http://localhost/api/v1/bff/teacher/advisors/debrief"),
      { requestId: "req_teacher", tenantId: "tenant_demo", actor: teacher },
      helpers({
        discriminator: "w020_advisory_request",
        surface: "teacher_debrief",
        run_id: "run_001",
        round_id: "round_001",
        team_id: "team_001",
        idempotency_key: "teacher-001"
      })
    );

    const auditTarget = response();
    const auditHandled = await handleW020AdvisoryRoute(
      instance,
      { method: "GET" } as never,
      auditTarget as never,
      new URL("http://localhost/api/v1/bff/teacher/advisors/audit"),
      { requestId: "req_teacher_audit", tenantId: "tenant_demo", actor: teacher },
      helpers(undefined)
    );

    expect(debriefHandled).toBe(true);
    expect(debriefTarget.statusCode).toBe(201);
    expect(debriefTarget.body).toContain('"advisory_only":true');
    expect(debriefTarget.body).toContain('"provider":"deterministic-mock"');
    expect(auditHandled).toBe(true);
    expect(auditTarget.statusCode).toBe(200);
    expect(auditTarget.body).not.toContain("raw_prompt");
    expect(records).toHaveLength(1);
  });
});
