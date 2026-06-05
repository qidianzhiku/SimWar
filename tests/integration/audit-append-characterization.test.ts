import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuditLog,
  AuthSession,
  Tenant,
  User
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
    store
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

async function login(
  baseUrl: string,
  username: string,
  password: string,
  tenantId = "tenant_demo"
): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    method: "POST",
    tenantId,
    body: { username, password }
  });

  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

function expectAuditTimestamp(value: string | undefined): void {
  expect(value).toEqual(expect.any(String));
  expect(Number.isNaN(Date.parse(value ?? ""))).toBe(false);
}

describe("audit append characterization", () => {
  it("characterizes appendAudit persistence, fields, append ordering, and read-after-write behavior", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const adminToken = await login(baseUrl, "admin", "admin");
      const createdUser = await request<User>(baseUrl, "/api/v1/admin/users", {
        method: "POST",
        token: adminToken,
        body: {
          username: "audit_learner",
          email: "audit-learner@demo.simwar.local",
          display_name: "Audit Learner",
          password: "audit-learner",
          roles: ["learner"]
        }
      });
      expect(createdUser.status).toBe(201);

      expect(store.auditLogs).toHaveLength(2);
      expect(store.auditLogs.map((log) => log.action)).toEqual(["auth.login", "user.create"]);
      expect(store.auditLogs.map((log) => log.audit_id)).toEqual(["audit_001", "audit_002"]);

      const loginAudit = store.auditLogs[0];
      const userCreateAudit = store.auditLogs[1];
      expect(loginAudit).toMatchObject({
        audit_id: "audit_001",
        tenant_id: "tenant_demo",
        actor_id: "usr_admin",
        actor_role: "tenant_admin",
        action: "auth.login",
        resource_type: "user",
        resource_id: "usr_admin"
      });
      expectAuditTimestamp(loginAudit?.created_at);
      expect(loginAudit?.request_id).toEqual(expect.any(String));

      expect(userCreateAudit).toMatchObject({
        audit_id: "audit_002",
        tenant_id: "tenant_demo",
        actor_id: "usr_admin",
        actor_role: "tenant_admin",
        action: "user.create",
        resource_type: "user",
        resource_id: createdUser.body.data.user_id
      });
      expectAuditTimestamp(userCreateAudit?.created_at);
      expect(userCreateAudit?.request_id).toEqual(expect.any(String));
      expect(userCreateAudit?.after).toMatchObject({
        user_id: createdUser.body.data.user_id,
        username: "audit_learner",
        roles: ["learner"]
      });

      const auditRead = await request<AuditLog[]>(baseUrl, "/api/v1/audit/logs", {
        token: adminToken
      });
      expect(auditRead.status).toBe(200);
      expect(auditRead.body.code).toBe("OK");
      expect(auditRead.body.message).toBe("success");
      expect(auditRead.body.data.map((log) => log.audit_id)).toEqual(
        store.auditLogs.map((log) => log.audit_id)
      );

      const actionFilter = await request<AuditLog[]>(
        baseUrl,
        "/api/v1/audit/logs?action=user.create",
        {
          token: adminToken
        }
      );
      expect(actionFilter.status).toBe(200);
      expect(actionFilter.body.data).toHaveLength(1);
      expect(actionFilter.body.data[0]).toEqual(userCreateAudit);

      const actorAndResourceFilter = await request<AuditLog[]>(
        baseUrl,
        "/api/v1/audit/logs?actor_id=usr_admin&resource_type=user",
        {
          token: adminToken
        }
      );
      expect(actorAndResourceFilter.status).toBe(200);
      expect(actorAndResourceFilter.body.data.map((log) => log.action)).toEqual([
        "auth.login",
        "user.create"
      ]);
    } finally {
      await stopServer(server);
    }
  });

  it("characterizes audit read authentication and authorization failures", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const unauthenticated = await request<unknown>(baseUrl, "/api/v1/audit/logs");
      expect(unauthenticated.status).toBe(401);
      expect(unauthenticated.body.code).toBe("AUTH-401-001");

      const studentToken = await login(baseUrl, "student", "student");
      const forbidden = await request<unknown>(baseUrl, "/api/v1/audit/logs", {
        token: studentToken
      });
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.code).toBe("AUTHZ-403-001");
    } finally {
      await stopServer(server);
    }
  });

  it("characterizes platform audit tenant filtering and tenant-admin scope behavior", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const platformToken = await login(baseUrl, "platform", "platform", "tenant_platform");
      const createdTenant = await request<Tenant>(baseUrl, "/api/v1/admin/tenants", {
        method: "POST",
        token: platformToken,
        tenantId: "tenant_platform",
        body: {
          name: "Audit Characterization Tenant",
          domain: "audit-characterization.simwar.local"
        }
      });
      expect(createdTenant.status).toBe(201);

      const adminToken = await login(baseUrl, "admin", "admin");
      const createdUser = await request<User>(baseUrl, "/api/v1/admin/users", {
        method: "POST",
        token: adminToken,
        body: {
          username: "tenant_scoped_audit_user",
          email: "tenant-scoped-audit-user@demo.simwar.local",
          display_name: "Tenant Scoped Audit User",
          password: "tenant-scoped-audit-user",
          roles: ["learner"]
        }
      });
      expect(createdUser.status).toBe(201);

      expect(store.auditLogs.map((log) => log.action)).toEqual([
        "auth.login",
        "tenant.create",
        "auth.login",
        "user.create"
      ]);

      const allPlatformAudit = await request<AuditLog[]>(baseUrl, "/api/v1/audit/logs", {
        token: platformToken,
        tenantId: "tenant_platform"
      });
      expect(allPlatformAudit.status).toBe(200);
      expect(allPlatformAudit.body.data.map((log) => log.audit_id)).toEqual(
        store.auditLogs.map((log) => log.audit_id)
      );

      const newTenantAudit = await request<AuditLog[]>(
        baseUrl,
        `/api/v1/audit/logs?tenant_id=${createdTenant.body.data.tenant_id}`,
        {
          token: platformToken,
          tenantId: "tenant_platform"
        }
      );
      expect(newTenantAudit.status).toBe(200);
      expect(newTenantAudit.body.data.map((log) => log.action)).toEqual(["tenant.create"]);
      expect(newTenantAudit.body.data[0]).toMatchObject({
        tenant_id: createdTenant.body.data.tenant_id,
        actor_id: "usr_platform",
        action: "tenant.create",
        resource_type: "tenant",
        resource_id: createdTenant.body.data.tenant_id
      });

      const tenantAdminCannotUseRequestedTenantScope = await request<AuditLog[]>(
        baseUrl,
        "/api/v1/audit/logs?tenant_id=tenant_platform",
        {
          token: adminToken
        }
      );
      expect(tenantAdminCannotUseRequestedTenantScope.status).toBe(200);
      expect(
        tenantAdminCannotUseRequestedTenantScope.body.data.every(
          (log) => log.tenant_id === "tenant_demo"
        )
      ).toBe(true);
      expect(tenantAdminCannotUseRequestedTenantScope.body.data.map((log) => log.action)).toEqual([
        "auth.login",
        "user.create"
      ]);
    } finally {
      await stopServer(server);
    }
  });
});
