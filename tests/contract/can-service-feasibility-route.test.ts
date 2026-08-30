import { describe, expect, it, vi } from "vitest";
import {
  handleCanServiceFeasibilityRoute,
  isCanServiceFeasibilityRoute
} from "../../services/api/src/routes/can-service-feasibility-routes";

describe("R1 CAN service-feasibility BFF route", () => {
  it("recognizes only exact GET role surfaces", () => {
    expect(
      isCanServiceFeasibilityRoute(
        "GET",
        new URL(
          "http://localhost/api/v1/bff/teacher/can/service-feasibility?courseId=c&draftId=d&runId=r&roundId=round_1&roundNo=1"
        )
      )
    ).toBe(true);
    expect(
      isCanServiceFeasibilityRoute(
        "POST",
        new URL("http://localhost/api/v1/bff/teacher/can/service-feasibility")
      )
    ).toBe(false);
  });

  it("passes exact query context and role to the service", async () => {
    const service = { get: vi.fn().mockResolvedValue({ surface: "teacher" }) };
    const sendJson = vi.fn();
    const url = new URL(
      "http://localhost/api/v1/bff/teacher/can/service-feasibility?courseId=course_demo&draftId=w5_draft_1&runId=run_demo&roundId=round_demo_1&roundNo=1"
    );
    const handled = await handleCanServiceFeasibilityRoute(
      service as never,
      { method: "GET" } as never,
      {} as never,
      url,
      {
        requestId: "req_1",
        tenantId: "tenant_demo",
        actor: { user_id: "teacher_demo", tenant_id: "tenant_demo", roles: ["teacher"] }
      } as never,
      {
        createEnvelope: (_context, data) => data,
        requirePermission: () => ({
          user_id: "teacher_demo",
          tenant_id: "tenant_demo",
          roles: ["teacher"]
        }),
        sendJson
      }
    );

    expect(handled).toBe(true);
    expect(service.get).toHaveBeenCalledWith({
      actor: { user_id: "teacher_demo", tenant_id: "tenant_demo", roles: ["teacher"] },
      request: {
        course_id: "course_demo",
        draft_id: "w5_draft_1",
        round_id: "round_demo_1",
        round_no: 1,
        run_id: "run_demo",
        surface: "teacher",
        tenant_id: "tenant_demo"
      }
    });
    expect(sendJson).toHaveBeenCalledWith({}, 200, { surface: "teacher" });
  });
});
