import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  GSIReceipt,
  GSIStudentProjection
} from "../../packages/shared-contracts/src";
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

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  store.runs = [
    {
      course_id: "course_demo",
      parameter_set_id: "param_toy_approved_1",
      run_id: "run_gsi_real_bff",
      scenario_package_id: "scenario_eldercare_demo",
      seed: 20260828,
      status: "active",
      tenant_id: DEFAULT_TENANT_ID
    }
  ];
  store.rounds = [
    {
      round_id: "round_gsi_real_bff_1",
      round_no: 1,
      run_id: "run_gsi_real_bff",
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

describe("GSI stakeholder shadow plane real BFF", () => {
  it("keeps one exact candidate visible across Teacher, Student and Admin projections", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const adminToken = await login(baseUrl, "admin");

      const assignment = await request(baseUrl, "/api/v1/bff/teacher/role-workflows/assignments", {
        body: {
          course_id: "course_demo",
          role_key: "CEO",
          run_id: "run_gsi_real_bff",
          team_id: "team_alpha",
          user_id: "usr_student"
        },
        method: "PUT",
        token: teacherToken
      });
      expect(assignment.status).toBe(201);

      const created = await request<GSIReceipt>(baseUrl, "/api/v1/bff/teacher/gsi/candidates", {
        body: {
          discriminator: "gsi_stakeholder_shadow_request",
          binding: {
            tenant_id: DEFAULT_TENANT_ID,
            course_id: "course_demo",
            run_id: "run_gsi_real_bff",
            round_id: "round_gsi_real_bff_1",
            team_id: "team_alpha",
            scenario_package_id: "scenario_eldercare_demo",
            scenario_version: "1.0.0",
            parameter_set_id: "param_toy_approved_1",
            parameter_set_version: "1.0.0",
            model_version_id: "gsi-stakeholder-resolver-v1",
            model_version: "1.0.0",
            model_artifact_id: "artifact:gsi-stakeholder-resolver-v1:1.0.0",
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
            },
            {
              proposal_id: "proposal_regulator_1",
              stakeholder_type: "regulator",
              intent: "reduce_regulatory_risk",
              priority: 0.6,
              influence: -0.2,
              summary: "Regulatory review may slow expansion."
            }
          ],
          idempotency_key: "gsi_real_bff_001"
        },
        method: "POST",
        token: teacherToken
      });
      expect(created.status).toBe(201);
      expect(created.body.data.provider).toBe("OFF");
      expect(created.body.data.formal_truth_write).toBe(false);
      expect(created.body.data.binding.run_id).toBe("run_gsi_real_bff");
      const candidateId = created.body.data.candidate_id;

      const student = await request<GSIStudentProjection>(
        baseUrl,
        `/api/v1/bff/student/gsi/candidates/${candidateId}`,
        { token: studentToken }
      );
      expect(student.status).toBe(200);
      expect(student.body.data.surface).toBe("student");
      expect(student.body.data.role_key).toBe("CEO");
      expect(JSON.stringify(student.body.data)).not.toContain("proposal_customer_1");
      expect(JSON.stringify(student.body.data)).not.toContain("Customers value");

      const admin = await request<Record<string, unknown>>(
        baseUrl,
        `/api/v1/bff/admin/gsi/audit?candidate_id=${encodeURIComponent(candidateId)}`,
        { token: adminToken }
      );
      expect(admin.status).toBe(200);
      expect(admin.body.data.provider).toBe("OFF");
      expect(admin.body.data.writes_official_truth).toBe(false);
      expect(admin.body.data.binding).toMatchObject({
        scenario_package_id: "scenario_eldercare_demo",
        parameter_set_id: "param_toy_approved_1"
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
});
