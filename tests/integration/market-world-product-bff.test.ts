import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  AdminMarketWorldBindingsProjection,
  ApiEnvelope,
  AuthSession,
  MarketWorldBindingReceipt,
  StudentRoleWorkflowWorkspaceDTO,
  TeacherMarketWorldProjection
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";
import { getShanghaiMarketWorldReference } from "../../services/api/src/market-world-product";

async function request<T>(
  baseUrl: string,
  path: string,
  options: { body?: unknown; method?: string; token?: string; tenantId?: string } = {}
): Promise<{ body: ApiEnvelope<T>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": options.tenantId ?? "tenant_demo"
  });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? (options.body === undefined ? "GET" : "POST")
  });
  return { body: (await response.json()) as ApiEnvelope<T>, status: response.status };
}

async function login(baseUrl: string, username: string, password = username): Promise<string> {
  const result = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password, username }
  });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body.data.access_token;
}

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  store.runs.push({
    course_id: "course_demo",
    parameter_set_id: "param_toy_approved_1",
    run_id: "run_market_world",
    scenario_package_id: "scenario_eldercare_demo",
    seed: 41,
    status: "active",
    tenant_id: "tenant_demo"
  });
  store.rounds.push({
    round_id: "round_market_world",
    round_no: 1,
    run_id: "run_market_world",
    status: "open",
    tenant_id: "tenant_demo"
  });
  store.studentRoleAssignments.push({
    assigned_at: "2026-08-20T00:00:00.000Z",
    assigned_by: "usr_teacher",
    assignment_id: "assignment_market_world",
    course_id: "course_demo",
    role_key: "CEO",
    run_id: "run_market_world",
    status: "active",
    team_id: "team_alpha",
    tenant_id: "tenant_demo",
    user_id: "usr_student"
  });
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

describe("Shanghai Market World product BFF", () => {
  it("joins the existing Course and Role Journey through real HTTP with bounded projections", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const adminToken = await login(baseUrl, "admin");
      const studentToken = await login(baseUrl, "student");

      const before = await request<TeacherMarketWorldProjection>(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/market-world",
        { token: teacherToken }
      );
      expect(before.status).toBe(200);
      expect(before.body.data.binding_state).toBe("UNBOUND");

      const reference = getShanghaiMarketWorldReference();
      const bound = await request<MarketWorldBindingReceipt>(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/market-world-binding",
        { body: { market_world_reference: reference }, token: teacherToken }
      );
      expect(bound.status).toBe(200);
      expect(bound.body.data).toMatchObject({
        binding_state: "BOUND",
        idempotent: false,
        market_world_reference: reference,
        operation_id: "TEACHER_MARKET_WORLD_BINDING_POST_V1"
      });

      const repeated = await request<MarketWorldBindingReceipt>(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/market-world-binding",
        { body: { market_world_reference: reference }, token: teacherToken }
      );
      expect(repeated.status).toBe(200);
      expect(repeated.body.data.idempotent).toBe(true);

      const after = await request<TeacherMarketWorldProjection>(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/market-world",
        { token: teacherToken }
      );
      expect(after.body.data.binding_state).toBe("BOUND");
      expect(after.body.data.market_world_reference).toEqual(reference);
      expect(after.body.data).not.toHaveProperty("raw_source_path");

      const student = await request<StudentRoleWorkflowWorkspaceDTO>(
        baseUrl,
        "/api/v1/bff/student/role-workspace?run_id=run_market_world&round_id=round_market_world&team_id=team_alpha",
        { token: studentToken }
      );
      expect(student.status).toBe(200);
      expect(student.body.data.market_world_visibility).toBe("VISIBLE");
      expect(student.body.data.market_brief?.brief_kind).toBe("SHANGHAI_MARKET_BRIEF");
      expect(JSON.stringify(student.body.data)).not.toMatch(
        /state_true|raw_source_path|private_coefficient|other_team_data|unpublished_result|score|rank/i
      );

      const admin = await request<AdminMarketWorldBindingsProjection>(
        baseUrl,
        "/api/v1/bff/admin/market-world-bindings",
        { token: adminToken }
      );
      expect(admin.status).toBe(200);
      expect(admin.body.data.schema_version).toBe("admin-market-world-bindings.v1");
      expect(admin.body.data.courses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            binding_state: "BOUND",
            course_id: "course_demo",
            market_world_reference: reference
          })
        ])
      );
      expect(JSON.stringify(admin.body.data)).not.toMatch(
        /raw_source_path|private_coefficient|state_true/i
      );
      expect(store.auditLogs.filter((log) => log.action === "market_world.bind")).toHaveLength(1);
    } finally {
      server.close();
    }
  });

  it("fails closed for unauthenticated, malformed, unknown, tenant-crossing, and non-admin requests", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const reference = getShanghaiMarketWorldReference();

      const unauthenticated = await request(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/market-world"
      );
      expect(unauthenticated.status).toBe(401);

      const extraField = await request(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/market-world-binding",
        {
          body: { market_world_reference: reference, raw_source_path: "D:/private" },
          token: teacherToken
        }
      );
      expect(extraField.status).toBe(422);
      expect(extraField.body.code).toBe("MARKET_WORLD_REFERENCE_INVALID");

      const unknown = await request(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/market-world-binding",
        {
          body: {
            market_world_reference: { ...reference, market_world_id: "unknown-world" }
          },
          token: teacherToken
        }
      );
      expect(unknown.status).toBe(422);
      expect(unknown.body.code).toBe("MARKET_WORLD_UNKNOWN_REFERENCE");

      const tenantCrossing = await request(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/market-world",
        { tenantId: "tenant_other", token: teacherToken }
      );
      expect(tenantCrossing.status).toBe(403);

      const studentAdminAttempt = await request(
        baseUrl,
        "/api/v1/bff/admin/market-world-bindings",
        { token: studentToken }
      );
      expect(studentAdminAttempt.status).toBe(403);

      const invalidDigest = await request(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/market-world-binding",
        {
          body: {
            market_world_reference: { ...reference, digest: "not-a-digest" }
          },
          token: teacherToken
        }
      );
      expect(invalidDigest.status).toBe(422);
      expect(invalidDigest.body.code).toBe("MARKET_WORLD_REFERENCE_INVALID");
    } finally {
      server.close();
    }
  });
});
