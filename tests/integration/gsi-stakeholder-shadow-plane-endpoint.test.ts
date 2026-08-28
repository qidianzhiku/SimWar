import { describe, expect, it } from "vitest";
import type { CurrentUser, GSIReceipt, GSIStudentProjection } from "@simwar/shared-contracts";
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

const request = {
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
  idempotency_key: "gsi_route_idem_001"
};

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

function receipt(): GSIReceipt {
  return {
    discriminator: "gsi_stakeholder_shadow_receipt",
    status: "generated",
    request_id: "req_gsi",
    candidate_id: "gsi_candidate_001",
    request_digest: "a".repeat(64),
    binding: request.binding,
    plane_mode: "OFF",
    publication_status: "PUBLISHED",
    resolver: {
      resolver_version: "gsi-deterministic-resolver-v1",
      accepted_proposal_ids: ["proposal_customer_1"],
      signals: [
        {
          signal_id: "signal_customer_1",
          stakeholder_type: "customer",
          intent: "protect_demand",
          bounded_value: 0.32,
          source_proposal_count: 1
        }
      ],
      abstentions: [],
      outside_option: 0.2,
      candidate_value: 0.32,
      resolver_digest: "b".repeat(64),
      signal_digest: "c".repeat(64),
      candidate_digest: "d".repeat(64)
    },
    teacher_projection: {
      surface: "teacher",
      summary: "One bounded stakeholder signal resolved.",
      advisory_text: "Teacher debrief advisory.",
      known_limits: ["Provider OFF."]
    },
    formal_truth_write: false,
    writes_official_truth: false,
    provider: "OFF",
    known_limits: ["Provider OFF."]
  };
}

describe("GSI stakeholder shadow plane BFF routes", () => {
  it("routes Teacher create, Student role-safe read, and Admin audit separately", async () => {
    const created = receipt();
    let adminTenantId: string | undefined;
    let adminCandidateId: string | undefined;
    const studentProjection: GSIStudentProjection = {
      surface: "student",
      role_key: "CEO",
      summary: "Published role-safe stakeholder signal summary.",
      signals: [{ stakeholder_type: "customer", intent: "protect_demand", bounded_value: 0.32 }],
      abstentions: [],
      known_limits: ["Provider OFF."]
    };
    const service = {
      createCandidate: async () => created,
      getStudentProjection: async () => studentProjection,
      getAdminProjection: async (
        _actor: CurrentUser,
        tenantId: string,
        candidateId: string
      ) => {
        adminTenantId = tenantId;
        adminCandidateId = candidateId;
        return {
          surface: "admin",
          tenant_id: "tenant_selected",
          binding: request.binding,
          plane_mode: "OFF",
          provider: "OFF",
          resolver_digest: "b".repeat(64),
          signal_digest: "c".repeat(64),
          candidate_digest: "d".repeat(64),
          writes_official_truth: false,
          known_limits: ["Provider OFF."]
        };
      },
      getTeacherReceipt: async () => created
    } as unknown as GSIStakeholderShadowPlaneService;
    const helpers = {
      readJson: async () => request,
      sendJson: (_target: unknown, status: number, payload: unknown) => {
        current.statusCode = status;
        current.body = JSON.stringify(payload);
      },
      createEnvelope: (_context: unknown, payload: unknown) => ({ code: "OK", data: payload }),
      requireStudent: () => undefined,
      requireTeacher: () => undefined,
      requireAdmin: () => undefined
    };
    const current = response();

    expect(
      await handleGSIStakeholderShadowPlaneRoute(
        service,
        { method: "POST" } as never,
        current as never,
        new URL("http://localhost/api/v1/bff/teacher/gsi/candidates"),
        { requestId: "req_1", tenantId: "tenant_demo", actor: teacher },
        helpers
      )
    ).toBe(true);
    expect(current.statusCode).toBe(201);
    expect(current.body).toContain("gsi_candidate_001");

    expect(
      await handleGSIStakeholderShadowPlaneRoute(
        service,
        { method: "GET" } as never,
        current as never,
        new URL("http://localhost/api/v1/bff/student/gsi/candidates/gsi_candidate_001"),
        { requestId: "req_2", tenantId: "tenant_demo", actor: student },
        helpers
      )
    ).toBe(true);
    expect(current.statusCode).toBe(200);
    expect(current.body).not.toContain("proposal_customer_1");

    expect(
      await handleGSIStakeholderShadowPlaneRoute(
        service,
        { method: "GET" } as never,
        current as never,
        new URL("http://localhost/api/v1/bff/admin/gsi/audit?candidate_id=gsi_candidate_001"),
        { requestId: "req_3", tenantId: "tenant_selected", actor: teacher },
        helpers
      )
    ).toBe(true);
    expect(current.statusCode).toBe(200);
    expect(current.body).toContain("writes_official_truth");
    expect(adminTenantId).toBe("tenant_selected");
    expect(adminCandidateId).toBe("gsi_candidate_001");
  });

  it("handles only the exact GSI paths and rejects an unsupported method", async () => {
    const current = response();
    const handled = await handleGSIStakeholderShadowPlaneRoute(
      {} as GSIStakeholderShadowPlaneService,
      { method: "DELETE" } as never,
      current as never,
      new URL("http://localhost/api/v1/bff/teacher/gsi/candidates"),
      { requestId: "req_4", tenantId: "tenant_demo", actor: teacher },
      {
        readJson: async () => request,
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
    expect(handled).toBe(true);
    expect(current.statusCode).toBe(422);
  });
});
