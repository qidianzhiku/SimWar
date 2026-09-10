import { describe, expect, it } from "vitest";
import type {
  CurrentUser,
  GSICrossRoundStudentProjection,
  GSICrossRoundTeacherProjection
} from "@simwar/shared-contracts";
import { handleGSIStakeholderShadowPlaneRoute } from "../../services/api/src/routes/gsi-stakeholder-shadow-plane-routes.js";
import type { GSIStakeholderShadowPlaneService } from "../../services/api/src/gsi-stakeholder-shadow-plane-service.js";

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

const comparisonQuery =
  "from_candidate_id=gsi_from_001&to_candidate_id=gsi_to_001&activity_id=activity_gsi&role_key=CEO";

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

function teacherProjection(): GSICrossRoundTeacherProjection {
  return {
    surface: "teacher",
    comparison: {
      discriminator: "gsi_cross_round_comparison",
      pair: {
        from_candidate_id: "gsi_from_001",
        to_candidate_id: "gsi_to_001",
        from_round_id: "round_1",
        to_round_id: "round_2",
        from_round_no: 1,
        to_round_no: 2
      },
      movements: [
        {
          stakeholder_type: "customer",
          intent: "protect_demand",
          from_value: 0.2,
          to_value: 0.8,
          delta: 0.6,
          direction: "INCREASED"
        }
      ],
      comparison_digest: "a".repeat(64),
      non_causal: true,
      causal_proof: false,
      known_limits: ["Descriptive movement only."]
    },
    context: {
      status: "CONTEXT_UNAVAILABLE",
      anchors: [],
      context_digest: "b".repeat(64),
      non_causal: true,
      causal_proof: false,
      official_outcome_recomputed: false,
      official_truth_write: false,
      recovery: "WAIT_FOR_PUBLICATION",
      known_limits: ["Published context is unavailable."]
    },
    provider: "OFF",
    official_truth_write: false,
    known_limits: ["Descriptive movement only."],
    recovery: "WAIT_FOR_PUBLICATION"
  };
}

function studentProjection(): GSICrossRoundStudentProjection {
  return {
    surface: "student",
    movements: [
      {
        stakeholder_type: "customer",
        intent: "protect_demand",
        from_value: 0.2,
        to_value: 0.8,
        delta: 0.6,
        direction: "INCREASED"
      }
    ],
    context_status: "CONTEXT_UNAVAILABLE",
    non_causal: true,
    causal_proof: false,
    provider: "OFF",
    official_truth_write: false,
    known_limits: ["Role-safe summary only."],
    recovery: "WAIT_FOR_PUBLICATION"
  };
}

describe("GSI cross-round comparison route", () => {
  it("routes exact pair comparison through the existing Teacher and Student GSI family", async () => {
    const current = response();
    const service = {
      compareCandidates: async (actor: CurrentUser) =>
        actor.roles.includes("student") ? studentProjection() : teacherProjection()
    } as unknown as GSIStakeholderShadowPlaneService;
    const helpers = {
      readJson: async () => ({}),
      sendJson: (_target: unknown, status: number, payload: unknown) => {
        current.statusCode = status;
        current.body = JSON.stringify(payload);
      },
      createEnvelope: (_context: unknown, payload: unknown) => ({ code: "OK", data: payload }),
      requireStudent: () => undefined,
      requireTeacher: () => undefined,
      requireAdmin: () => undefined
    };

    await handleGSIStakeholderShadowPlaneRoute(
      service,
      { method: "GET" } as never,
      current as never,
      new URL(`http://localhost/api/v1/bff/teacher/gsi/candidates/compare?${comparisonQuery}`),
      { requestId: "req_teacher_compare", tenantId: "tenant_demo", actor: teacher },
      helpers
    );
    expect(current.statusCode).toBe(200);
    expect(current.body).toContain("gsi_from_001");
    expect(current.body).toContain("non_causal");

    await handleGSIStakeholderShadowPlaneRoute(
      service,
      { method: "GET" } as never,
      current as never,
      new URL(`http://localhost/api/v1/bff/student/gsi/candidates/compare?${comparisonQuery}`),
      { requestId: "req_student_compare", tenantId: "tenant_demo", actor: student },
      helpers
    );
    expect(current.statusCode).toBe(200);
    expect(current.body).toContain("INCREASED");
    expect(current.body).not.toContain("gsi_from_001");
    expect(current.body).not.toContain("comparison_digest");
  });

  it("rejects implicit selectors before service invocation", async () => {
    const current = response();
    let invoked = false;
    const service = {
      compareCandidates: async () => {
        invoked = true;
        return teacherProjection();
      }
    } as unknown as GSIStakeholderShadowPlaneService;
    await handleGSIStakeholderShadowPlaneRoute(
      service,
      { method: "GET" } as never,
      current as never,
      new URL(
        "http://localhost/api/v1/bff/teacher/gsi/candidates/compare?from_candidate_id=latest&to_candidate_id=gsi_to_001&activity_id=activity_gsi&role_key=CEO"
      ),
      { requestId: "req_invalid_compare", tenantId: "tenant_demo", actor: teacher },
      {
        readJson: async () => ({}),
        sendJson: (_target: unknown, status: number, payload: unknown) => {
          current.statusCode = status;
          current.body = JSON.stringify(payload);
        },
        createEnvelope: (_context: unknown, payload: unknown) => ({ code: "OK", data: payload }),
        requireStudent: () => undefined,
        requireTeacher: () => undefined,
        requireAdmin: () => undefined
      }
    );
    expect(current.statusCode).toBe(422);
    expect(invoked).toBe(false);
  });
});
