import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { CurrentUser } from "@simwar/shared-contracts";
import {
  handleStudentLearningReportRoute,
  type StudentLearningReportRouteRuntime
} from "../../services/api/src/routes/student-learning-report-routes.js";

function response() {
  return {
    statusCode: 0,
    payload: undefined as unknown,
    writeHead(status: number) {
      this.statusCode = status;
    },
    end(body: string) {
      this.payload = JSON.parse(body);
    }
  };
}

const student: CurrentUser = {
  display_name: "Student",
  roles: ["learner"],
  team_id: "team_d4",
  tenant_id: "tenant_d4",
  user_id: "usr_student"
};

describe("D4 Student Learning Report BFF routes", () => {
  it("exposes student and teacher preview GET routes but no D4 write route", async () => {
    const runtime = {
      projections: {
        listStudent: vi.fn(async () => ({
          reports: [],
          known_limits: ["limit"],
          report_schema_version: "student-learning-report.v1",
          runtime_authority: "JSON_INTERNAL_ONLY",
          scope: "student_team"
        })),
        getStudent: vi.fn(),
        listPreview: vi.fn(async () => ({
          reports: [],
          known_limits: ["limit"],
          report_schema_version: "student-learning-report.v1",
          runtime_authority: "JSON_INTERNAL_ONLY",
          scope: "tenant_preview"
        })),
        getPreview: vi.fn()
      }
    } as unknown as StudentLearningReportRouteRuntime;
    const res = response();
    const sendJson = (target: ServerResponse, status: number, payload: unknown) => {
      const fake = target as unknown as ReturnType<typeof response>;
      fake.writeHead(status);
      fake.end(JSON.stringify(payload));
    };
    const helpers = {
      createEnvelope: (_context: unknown, data: unknown) => ({ code: "OK", data }),
      requireStudent: () => student,
      requireTeacher: () => ({ ...student, roles: ["teacher"] as const }),
      requireAdmin: () => ({ ...student, roles: ["tenant_admin"] as const }),
      sendJson
    };
    const context = { requestId: "req_d4", tenantId: "tenant_d4" };
    const handled = await handleStudentLearningReportRoute(
      runtime,
      { method: "GET" } as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      new URL("http://localhost/api/v1/bff/student/learning-reports"),
      context,
      helpers
    );
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(runtime.projections.listStudent).toHaveBeenCalled();

    const writeHandled = await handleStudentLearningReportRoute(
      runtime,
      { method: "POST" } as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      new URL("http://localhost/api/v1/bff/student/learning-reports"),
      context,
      helpers
    );
    expect(writeHandled).toBe(false);
  });
});
