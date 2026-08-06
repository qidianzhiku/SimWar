import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import {
  handleTeachingClosureRoute,
  type TeachingClosureRouteRuntime
} from "../../services/api/src/routes/teaching-closure-routes.js";

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

describe("W019 teaching closure route", () => {
  it("requires the complete exact context and emits a teacher-safe envelope", async () => {
    const runtime = {
      closure: {
        get: async (_actor: unknown, context: unknown) => ({
          context,
          course_report_available: false,
          export_formats: ["json", "markdown"],
          known_limits: ["limit"],
          queue_item: {
            claim_status: "AVAILABLE",
            confirmation_status: "MISSING",
            context,
            eligible_event_count: 0,
            evidence_count: 0,
            known_limits: ["limit"],
            missing: ["eligible_event", "evidence_artifact", "confirmation"],
            outcome_status: "UNAVAILABLE"
          },
          runtime_authority: "JSON_INTERNAL_ONLY",
          schema_version: "teaching-closure.v1",
          student_safe_preview: {
            criterion_count: 0,
            evidence_count: 0,
            next_focus: "pending",
            status: "UNAVAILABLE",
            visibility: "student_safe"
          }
        })
      }
    } as unknown as TeachingClosureRouteRuntime;
    const res = response();
    const handled = await handleTeachingClosureRoute(
      runtime,
      { method: "GET" } as IncomingMessage,
      res as unknown as ServerResponse,
      new URL(
        "http://localhost/api/v1/bff/teacher/teaching-closure?course_id=course_001&run_id=run_001&team_id=team_001&role_key=marketing&activity_id=activity_001"
      ),
      { requestId: "req_001", tenantId: "tenant_001" },
      {
        createEnvelope: (_context, data) => ({ code: "OK", data }),
        requireTeacher: () => ({ user_id: "teacher_001", tenant_id: "tenant_001" }),
        sendJson: (target, status, payload) => {
          const fake = target as unknown as ReturnType<typeof response>;
          fake.writeHead(status);
          fake.end(JSON.stringify(payload));
        }
      }
    );
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect((res.payload as { data: { context: { team_id: string } } }).data.context.team_id).toBe(
      "team_001"
    );
  });
});
