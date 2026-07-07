import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  P0DemoState,
  Tenant,
  User
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store } from "../../services/api/src/store";

const REQUIRED_INTERNAL_PACK_DOCUMENTS = [
  "docs/quality/l1-g0-g7-current-evidence-ledger.md",
  "docs/quality/l1-known-limits-and-release-note.md",
  "docs/operations/l1-teacher-kit-internal-only.md",
  "docs/operations/l1-session-runbook-lite.md",
  "docs/operations/l1-synthetic-data-reset-and-abort.md",
  "docs/operations/l1-replay-evidence-review-checklist.md",
  "docs/operations/l1-issue-escalation-procedure.md",
  "docs/architecture/r4-discovery-parity-gap-directory.md",
  "docs/governance/g0-solo-maintainer-control-policy.md"
] as const;

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
    body?: unknown;
    method?: string;
    omitTenantHeader?: boolean;
    tenantId?: string;
    token?: string;
  } = {}
): Promise<{ body: ApiEnvelope<TData>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json"
  });

  if (!options.omitTenantHeader) {
    headers.set("x-tenant-id", options.tenantId ?? "tenant_demo");
  }

  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    method: options.method ?? "GET"
  });

  return {
    body: (await response.json()) as ApiEnvelope<TData>,
    status: response.status
  };
}

async function login(
  baseUrl: string,
  username: string,
  password: string,
  tenantId = "tenant_demo"
): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    method: "POST",
    tenantId
  });

  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

function assertSerializedDoesNotContain(value: unknown, forbidden: string[]): void {
  const serialized = JSON.stringify(value);

  for (const item of forbidden) {
    expect(serialized).not.toContain(item);
  }
}

describe("L1 internal application readiness pack", () => {
  it("keeps the internal application documents explicit about status and non-proofs", () => {
    for (const path of REQUIRED_INTERNAL_PACK_DOCUMENTS) {
      const document = readFileSync(path, "utf8");
      expect(document).toContain("G0 Status:");
      expect(document).toContain("EXCEPTION");
      expect(document).toContain("L1 Status:");
      expect(document).toContain("NOT_READY");
      expect(document).toContain("PostgreSQL runtime");
      expect(document).toContain("NOT_AUTHORIZED");
      expect(document).toContain("Pilot");
      expect(document).toContain("Production");
    }
  });

  it("keeps current tenant, platform authority, and demo-state surfaces scoped", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const adminToken = await login(baseUrl, "admin", "admin");
      const platformToken = await login(baseUrl, "platform", "platform", "tenant_platform");

      const studentState = await request<P0DemoState>(baseUrl, "/api/v1/demo-state", {
        token: studentToken
      });
      expect(studentState.status).toBe(200);
      expect((studentState.body.data as unknown as Record<string, unknown>).tenants).toBeUndefined();
      expect((studentState.body.data as unknown as Record<string, unknown>).users).toBeUndefined();
      assertSerializedDoesNotContain(studentState.body.data, [
        "tenant_other",
        "tenant_platform",
        "usr_other_teacher",
        "usr_platform"
      ]);

      const tenantAdminState = await request<{ tenants: Tenant[]; users: User[] }>(
        baseUrl,
        "/api/v1/admin/state",
        {
          omitTenantHeader: true,
          token: adminToken
        }
      );
      expect(tenantAdminState.status).toBe(200);
      expect(tenantAdminState.body.data.tenants.map((tenant) => tenant.tenant_id)).toEqual([
        "tenant_demo"
      ]);
      assertSerializedDoesNotContain(tenantAdminState.body.data, [
        "tenant_other",
        "tenant_platform",
        "usr_other_teacher",
        "usr_platform"
      ]);

      const platformState = await request<{ tenants: Tenant[]; users: User[] }>(
        baseUrl,
        "/api/v1/admin/state",
        {
          omitTenantHeader: true,
          token: platformToken
        }
      );
      expect(platformState.status).toBe(200);
      expect(platformState.body.data.tenants.map((tenant) => tenant.tenant_id).sort()).toEqual([
        "tenant_demo",
        "tenant_other",
        "tenant_platform"
      ]);

      const forgedTenantRead = await request<unknown>(baseUrl, "/api/v1/courses", {
        tenantId: "tenant_other",
        token: teacherToken
      });
      expect(forgedTenantRead.status).toBe(403);
      expect(forgedTenantRead.body.code).toBe("TENANT-403-001");
      assertSerializedDoesNotContain(forgedTenantRead.body, ["usr_other_teacher"]);

      const studentAdminRead = await request<unknown>(baseUrl, "/api/v1/admin/state", {
        token: studentToken
      });
      expect(studentAdminRead.status).toBe(403);
      assertSerializedDoesNotContain(studentAdminRead.body, ["tenant_other", "usr_other_teacher"]);
    } finally {
      await stopServer(server);
    }
  });
});
