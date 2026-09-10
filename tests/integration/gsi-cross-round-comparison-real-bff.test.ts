import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  GSIReceipt,
  GSICrossRoundAdminProjection,
  GSICrossRoundStudentProjection,
  GSICrossRoundTeacherProjection
} from "@simwar/shared-contracts";
import { createApiServer } from "../../services/api/src/server";
import { DEFAULT_TENANT_ID, createP1Store, type SimWarStore } from "../../services/api/src/store";

interface RequestOptions {
  body?: unknown;
  method?: string;
  token?: string;
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {}
): Promise<{ body: ApiEnvelope<T>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": DEFAULT_TENANT_ID
  });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? "GET"
  });
  return { body: (await response.json()) as ApiEnvelope<T>, status: response.status };
}

async function login(baseUrl: string, username: string): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password: username, username },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

function binding(roundId: string) {
  return {
    tenant_id: DEFAULT_TENANT_ID,
    course_id: "course_demo",
    run_id: "run_gsi_o2_real_bff",
    round_id: roundId,
    team_id: "team_alpha",
    scenario_package_id: "scenario_eldercare_demo",
    scenario_version: "1.0.0",
    parameter_set_id: "param_toy_approved_1",
    parameter_set_version: "1.0.0",
    model_version_id: "gsi-stakeholder-resolver-v1",
    model_version: "1.0.0",
    model_artifact_id: "artifact:gsi-stakeholder-resolver-v1:1.0.0",
    model_artifact_version: "1.0.0"
  };
}

function candidateRequest(
  roundId: string,
  idempotencyKey: string,
  influence: number,
  publicationStatus: "DRAFT" | "PUBLISHED" = "PUBLISHED"
) {
  return {
    discriminator: "gsi_stakeholder_shadow_request",
    binding: binding(roundId),
    plane_mode: "OFF",
    publication_status: publicationStatus,
    proposals: [
      {
        proposal_id: `${idempotencyKey}_customer`,
        stakeholder_type: "customer",
        intent: "protect_demand",
        priority: 0.8,
        influence,
        summary: "Customers value predictable service."
      }
    ],
    idempotency_key: idempotencyKey
  };
}

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  store.runs = [
    {
      course_id: "course_demo",
      parameter_set_id: "param_toy_approved_1",
      run_id: "run_gsi_o2_real_bff",
      scenario_package_id: "scenario_eldercare_demo",
      seed: 20260910,
      status: "active",
      tenant_id: DEFAULT_TENANT_ID
    }
  ];
  store.rounds = [
    {
      round_id: "round_gsi_o2_1",
      round_no: 1,
      run_id: "run_gsi_o2_real_bff",
      status: "open",
      tenant_id: DEFAULT_TENANT_ID
    },
    {
      round_id: "round_gsi_o2_2",
      round_no: 2,
      run_id: "run_gsi_o2_real_bff",
      status: "open",
      tenant_id: DEFAULT_TENANT_ID
    }
  ];
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

describe("GSI cross-round comparison real BFF", () => {
  it("serves exact Teacher -> Student -> Admin comparison projections without a second route family", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const adminToken = await login(baseUrl, "admin");
      const assignment = await request(baseUrl, "/api/v1/bff/teacher/role-workflows/assignments", {
        body: {
          course_id: "course_demo",
          role_key: "CEO",
          run_id: "run_gsi_o2_real_bff",
          team_id: "team_alpha",
          user_id: "usr_student"
        },
        method: "PUT",
        token: teacherToken
      });
      expect(assignment.status).toBe(201);

      const from = await request<GSIReceipt>(baseUrl, "/api/v1/bff/teacher/gsi/candidates", {
        body: candidateRequest("round_gsi_o2_1", "gsi_o2_from", 0.25),
        method: "POST",
        token: teacherToken
      });
      const to = await request<GSIReceipt>(baseUrl, "/api/v1/bff/teacher/gsi/candidates", {
        body: candidateRequest("round_gsi_o2_2", "gsi_o2_to", 0.75),
        method: "POST",
        token: teacherToken
      });
      expect(from.status).toBe(201);
      expect(to.status).toBe(201);
      const query = new URLSearchParams({
        from_candidate_id: from.body.data.candidate_id,
        to_candidate_id: to.body.data.candidate_id,
        activity_id: "activity_gsi_o2",
        role_key: "CEO"
      });

      const teacher = await request<GSICrossRoundTeacherProjection>(
        baseUrl,
        `/api/v1/bff/teacher/gsi/candidates/compare?${query}`,
        { token: teacherToken }
      );
      expect(teacher.status).toBe(200);
      expect(teacher.body.data.comparison.pair.from.candidate_id).toBe(from.body.data.candidate_id);
      expect(teacher.body.data.comparison.pair.to.candidate_id).toBe(to.body.data.candidate_id);
      expect(teacher.body.data.comparison.movements[0]?.direction).toBe("INCREASED");
      expect(teacher.body.data.comparison.non_causal).toBe(true);
      expect(teacher.body.data.context.status).toBe("CONTEXT_UNAVAILABLE");

      const student = await request<GSICrossRoundStudentProjection>(
        baseUrl,
        `/api/v1/bff/student/gsi/candidates/compare?${query}`,
        { token: studentToken }
      );
      expect(student.status).toBe(200);
      expect(student.body.data.movements[0]?.direction).toBe("INCREASED");
      expect(student.body.data.movements[0]).not.toHaveProperty("signal_key");
      const studentJson = JSON.stringify(student.body.data);
      expect(studentJson).not.toContain(from.body.data.candidate_id);
      expect(studentJson).not.toContain("comparison_digest");
      expect(studentJson).not.toContain("activity_gsi_o2");

      const admin = await request<GSICrossRoundAdminProjection>(
        baseUrl,
        `/api/v1/bff/admin/gsi/candidates/compare?${query}`,
        { token: adminToken }
      );
      expect(admin.status).toBe(200);
      expect(admin.body.data.surface).toBe("admin");
      expect(admin.body.data.context.context_binding.course_id).toBe("course_demo");
      expect(admin.body.data.provider).toBe("OFF");
      expect(admin.body.data.official_truth_write).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  it("keeps Student comparison unpublished and unassigned contexts fail closed", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const draft = await request<GSIReceipt>(baseUrl, "/api/v1/bff/teacher/gsi/candidates", {
        body: candidateRequest("round_gsi_o2_1", "gsi_o2_draft", 0.25, "DRAFT"),
        method: "POST",
        token: teacherToken
      });
      const published = await request<GSIReceipt>(baseUrl, "/api/v1/bff/teacher/gsi/candidates", {
        body: candidateRequest("round_gsi_o2_2", "gsi_o2_published", 0.75),
        method: "POST",
        token: teacherToken
      });
      expect(draft.status).toBe(201);
      expect(published.status).toBe(201);
      const draftQuery = new URLSearchParams({
        from_candidate_id: draft.body.data.candidate_id,
        to_candidate_id: published.body.data.candidate_id,
        activity_id: "activity_gsi_o2",
        role_key: "CEO"
      });
      const unpublished = await request(
        baseUrl,
        `/api/v1/bff/student/gsi/candidates/compare?${draftQuery}`,
        { token: studentToken }
      );
      expect(unpublished.status).toBe(409);
      expect(unpublished.body.data.code).toBe("GSI_NOT_PUBLISHED");

      const from = await request<GSIReceipt>(baseUrl, "/api/v1/bff/teacher/gsi/candidates", {
        body: candidateRequest("round_gsi_o2_1", "gsi_o2_unassigned_from", 0.25),
        method: "POST",
        token: teacherToken
      });
      const to = await request<GSIReceipt>(baseUrl, "/api/v1/bff/teacher/gsi/candidates", {
        body: candidateRequest("round_gsi_o2_2", "gsi_o2_unassigned_to", 0.75),
        method: "POST",
        token: teacherToken
      });
      const unassignedQuery = new URLSearchParams({
        from_candidate_id: from.body.data.candidate_id,
        to_candidate_id: to.body.data.candidate_id,
        activity_id: "activity_gsi_o2",
        role_key: "CEO"
      });
      const unassigned = await request(
        baseUrl,
        `/api/v1/bff/student/gsi/candidates/compare?${unassignedQuery}`,
        { token: studentToken }
      );
      expect(unassigned.status).toBe(403);
      expect(unassigned.body.data.code).toBe("GSI_FORBIDDEN");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
});
