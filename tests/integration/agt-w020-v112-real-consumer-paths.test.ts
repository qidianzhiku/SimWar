import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CurrentUser, W020AdvisoryRecord } from "@simwar/shared-contracts";
import { handleW020AdvisoryRoute } from "../../services/api/src/routes/w020-advisory-routes.js";
import { GovernedAdvisoryService } from "../../services/api/src/w020-advisory-service.js";

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
      created_at: "2026-08-30T00:00:00.000Z",
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

function route(
  service: GovernedAdvisoryService,
  actor: CurrentUser,
  path: string,
  body: unknown,
  method = "POST"
) {
  const target = response();
  return handleW020AdvisoryRoute(
    service,
    { method } as never,
    target as never,
    new URL(`http://localhost${path}`),
    { requestId: `req-${method}-${path}`, tenantId: actor.tenant_id, actor },
    {
      readJson: async () => body,
      sendJson: (_response, status, payload) => {
        target.writeHead(status);
        target.end(JSON.stringify(payload));
      },
      createEnvelope: (_context, payload) => ({ code: "OK", data: payload }),
      requireStudent: () => undefined,
      requireTeacher: () => undefined,
      requireTeacherOrAdmin: () => undefined
    }
  ).then(() => ({
    target,
    payload: JSON.parse(target.body) as { data?: Record<string, unknown> }
  }));
}

describe("W020 absorbed behavior on real Student/Teacher consumer paths", () => {
  it("executes the exact StudentRoleAdvisor and TeacherDebriefAdvisor routes", async () => {
    const studentSource = readFileSync("apps/student/src/StudentRoleAdvisor.tsx", "utf8");
    const teacherSource = readFileSync("apps/teacher/src/TeacherDebriefAdvisor.tsx", "utf8");
    expect(studentSource).toContain("/api/v1/bff/student/advisors/role");
    expect(studentSource).toContain("role_key");
    expect(studentSource).toContain("team_id");
    expect(teacherSource).toContain("/api/v1/bff/teacher/advisors/debrief");
    expect(teacherSource).toContain("/api/v1/bff/teacher/advisors/audit");
    expect(teacherSource).toContain("selectedTeamId");

    const records: W020AdvisoryRecord[] = [];
    const service = new GovernedAdvisoryService({
      repository: {
        list: async () => structuredClone(records),
        append: async (record) => records.push(structuredClone(record))
      },
      roleWorkflow: { readRoleWorkflow: () => snapshot, commitRoleWorkflow: () => undefined }
    });

    const studentResult = await route(service, student, "/api/v1/bff/student/advisors/role", {
      discriminator: "w020_advisory_request",
      idempotency_key: "real-student-001",
      role_key: "CEO",
      round_id: "round_001",
      run_id: "run_001",
      surface: "student_role",
      team_id: "team_001"
    });
    expect(studentResult.target.statusCode).toBe(201);
    expect(studentResult.payload.data?.context).toMatchObject({
      role_key: "CEO",
      run_id: "run_001",
      round_id: "round_001",
      team_id: "team_001"
    });
    expect(studentResult.payload.data?.coach_output).toMatchObject({
      advisory_only: true,
      output_type: "advisory"
    });

    const teacherResult = await route(service, teacher, "/api/v1/bff/teacher/advisors/debrief", {
      discriminator: "w020_advisory_request",
      idempotency_key: "real-teacher-001",
      round_id: "round_001",
      run_id: "run_001",
      surface: "teacher_debrief",
      team_id: "team_001"
    });
    expect(teacherResult.target.statusCode).toBe(201);
    expect(teacherResult.payload.data?.projection).toMatchObject({
      policy: { provider: "OFF", formal_truth_write: false },
      surface: "teacher_debrief"
    });
    expect(String(teacherResult.payload.data?.coach_output)).not.toContain("state_true");

    const auditResult = await route(
      service,
      teacher,
      "/api/v1/bff/teacher/advisors/audit",
      undefined,
      "GET"
    );
    expect(auditResult.target.statusCode).toBe(200);
    expect(auditResult.payload.data).toMatchObject({ entries: expect.any(Array) });
  });

  it("keeps the real consumer response free of formal authority fields", async () => {
    const records: W020AdvisoryRecord[] = [];
    const service = new GovernedAdvisoryService({
      repository: {
        list: async () => structuredClone(records),
        append: async (record) => records.push(structuredClone(record))
      },
      roleWorkflow: { readRoleWorkflow: () => snapshot, commitRoleWorkflow: () => undefined }
    });
    const result = await route(service, student, "/api/v1/bff/student/advisors/role", {
      discriminator: "w020_advisory_request",
      idempotency_key: "real-safety-001",
      role_key: "CEO",
      round_id: "round_001",
      run_id: "run_001",
      surface: "student_role",
      team_id: "team_001"
    });
    const serialized = JSON.stringify(result.payload.data);
    expect(serialized).not.toContain("SettlementResult");
    expect(serialized).not.toContain("state_true");
    expect(serialized).not.toContain("raw_prompt");
    expect(serialized).not.toContain('"score"');
    expect(serialized).not.toContain('"rank"');
  });
});
