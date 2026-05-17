import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession, Tenant, User } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store } from "../../services/api/src/store";

async function startServer(): Promise<{ baseUrl: string; server: Server }> {
  const server = createApiServer(createP1Store());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server
  };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function request<TData>(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    token?: string;
    tenantId?: string;
    body?: unknown;
  } = {}
): Promise<{ status: number; body: ApiEnvelope<TData> }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": options.tenantId ?? "tenant_demo"
  });

  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  return {
    status: response.status,
    body: (await response.json()) as ApiEnvelope<TData>
  };
}

async function login(baseUrl: string, username: string, password: string, tenantId: string): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    method: "POST",
    tenantId,
    body: { username, password }
  });

  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

describe("P1 auth, RBAC and tenant governance", () => {
  it("allows platform tenant creation and blocks tenant-admin escalation", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const platformToken = await login(baseUrl, "platform", "platform", "tenant_platform");
      const tenantAdminToken = await login(baseUrl, "admin", "admin", "tenant_demo");

      const createdTenant = await request<Tenant>(baseUrl, "/api/v1/admin/tenants", {
        method: "POST",
        token: platformToken,
        tenantId: "tenant_platform",
        body: {
          name: "P1 Autonomous Tenant",
          domain: "p1-autonomous.simwar.local"
        }
      });
      expect(createdTenant.status).toBe(201);
      expect(createdTenant.body.data.domain).toBe("p1-autonomous.simwar.local");

      const forbiddenTenant = await request<Tenant>(baseUrl, "/api/v1/admin/tenants", {
        method: "POST",
        token: tenantAdminToken,
        body: {
          name: "Escalation Attempt",
          domain: "blocked.simwar.local"
        }
      });
      expect(forbiddenTenant.status).toBe(403);

      const forbiddenUser = await request<User>(baseUrl, "/api/v1/admin/users", {
        method: "POST",
        token: tenantAdminToken,
        body: {
          username: "bad_admin",
          email: "bad-admin@demo.simwar.local",
          display_name: "Bad Admin",
          password: "secret",
          roles: ["platform_admin"]
        }
      });
      expect(forbiddenUser.status).toBe(403);
    } finally {
      await stopServer(server);
    }
  });

  it("creates tenant-scoped users, revokes sessions and records audit logs", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const adminToken = await login(baseUrl, "admin", "admin", "tenant_demo");
      const createdUser = await request<User>(baseUrl, "/api/v1/admin/users", {
        method: "POST",
        token: adminToken,
        body: {
          username: "learner_two",
          email: "learner-two@demo.simwar.local",
          display_name: "Learner Two",
          password: "learner-two",
          roles: ["learner"]
        }
      });
      expect(createdUser.status).toBe(201);
      expect(createdUser.body.data.roles).toEqual(["learner"]);
      expect(JSON.stringify(createdUser.body.data)).not.toContain("password_hash");

      const learnerToken = await login(baseUrl, "learner_two", "learner-two", "tenant_demo");
      const forbiddenUsers = await request<User[]>(baseUrl, "/api/v1/admin/users", {
        token: learnerToken
      });
      expect(forbiddenUsers.status).toBe(403);

      const logout = await request<{ revoked: boolean }>(baseUrl, "/api/v1/auth/logout", {
        method: "POST",
        token: learnerToken
      });
      expect(logout.body.data.revoked).toBe(true);

      const revokedMe = await request<unknown>(baseUrl, "/api/v1/auth/me", {
        token: learnerToken
      });
      expect(revokedMe.status).toBe(401);

      const audit = await request<unknown[]>(baseUrl, "/api/v1/audit/logs?action=user.create", {
        token: adminToken
      });
      expect(audit.body.data.length).toBe(1);
    } finally {
      await stopServer(server);
    }
  });

  it("rejects truth-field writes before learner decision validation", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher", "tenant_demo");
      const studentToken = await login(baseUrl, "student", "student", "tenant_demo");
      const run = await request<{ run: { run_id: string } }>(baseUrl, "/api/v1/courses/course_demo/runs", {
        method: "POST",
        token: teacherToken
      });
      const runId = run.body.data.run.run_id;
      await request(baseUrl, `/api/v1/runs/${runId}/rounds/1/start`, { method: "POST", token: teacherToken });

      const response = await request<unknown>(baseUrl, `/api/v1/runs/${runId}/rounds/1/decisions`, {
        method: "POST",
        token: studentToken,
        body: {
          team_id: "team_alpha",
          decision_payload: {
            pricing: { base_price: 12800 },
            marketing_budget: 180000,
            service_quality_budget: 160000,
            capacity_plan: "expand",
            cash_buffer_target: 0.16,
            strategy_statement: "尝试写入真值字段应被拒绝",
            state_true: { score: 100 }
          }
        }
      });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("TRUTH-403-001");
    } finally {
      await stopServer(server);
    }
  });
});
