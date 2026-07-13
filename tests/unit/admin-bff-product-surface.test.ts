import { describe, expect, it, vi } from "vitest";
import type { PlatformAdminAuthorityDTO, TenantAdminSummaryDTO } from "@simwar/shared-contracts";
import {
  PLATFORM_ADMIN_AUTHORITY_PATH,
  TENANT_ADMIN_SUMMARY_PATH,
  getAdminSummaryErrorMessage,
  loadAdminSummary
} from "../../apps/admin/src/admin-bff";

const tenantSummary: TenantAdminSummaryDTO = {
  actor_role: "tenant_admin",
  allowed_actions: ["tenant:read"],
  explicit_non_proof: ["read-only summary"],
  redacted_fields: ["other_tenant_data"],
  source_runtime_path: ["GET /api/v1/admin/state"],
  tenant_id: "tenant_demo",
  visible_state: {
    audit_event_count: 1,
    course_count: 1,
    run_count: 1,
    team_count: 2
  },
  visible_tenant_ids: ["tenant_demo"]
};

const platformAuthority: PlatformAdminAuthorityDTO = {
  actor_role: "platform_admin",
  allowed_actions: ["tenant:read"],
  explicit_authority_source: "platform_admin role",
  explicit_non_proof: ["read-only summary"],
  platform_authority: true,
  redacted_fields: ["tenant_private_payload"],
  required_scope: "platform",
  source_runtime_path: ["GET /api/v1/admin/state"],
  visible_state: {
    tenant_count: 3,
    tenant_ids: ["tenant_platform", "tenant_demo", "tenant_other"]
  }
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify(
      status < 400 ? { code: 0, data, message: "success", request_id: "req_test" } : data
    ),
    { headers: { "content-type": "application/json" }, status }
  );
}

describe("Admin BFF product surface client", () => {
  it("loads the Tenant Admin summary through the exact tenant-scoped GET without client tenant authority", async () => {
    const fetcher = vi.fn(async () => jsonResponse(tenantSummary));

    await expect(loadAdminSummary(["tenant_admin"], "tenant-token", fetcher)).resolves.toEqual({
      kind: "tenant",
      summary: tenantSummary
    });

    expect(fetcher).toHaveBeenCalledOnce();
    const [path, init] = fetcher.mock.calls[0] ?? [];
    expect(path).toBe(TENANT_ADMIN_SUMMARY_PATH);
    expect(init?.method).toBe("GET");
    expect(init?.headers).toEqual({ authorization: "Bearer tenant-token" });
    expect(JSON.stringify(init)).not.toContain("x-tenant-id");
    expect(path).not.toContain("scope=platform");
  });

  it("loads Platform Admin authority only through the explicit platform scope GET", async () => {
    const fetcher = vi.fn(async () => jsonResponse(platformAuthority));

    await expect(loadAdminSummary(["platform_admin"], "platform-token", fetcher)).resolves.toEqual({
      authority: platformAuthority,
      kind: "platform"
    });

    expect(fetcher).toHaveBeenCalledOnce();
    const [path, init] = fetcher.mock.calls[0] ?? [];
    expect(path).toBe(PLATFORM_ADMIN_AUTHORITY_PATH);
    expect(path).toContain("scope=platform");
    expect(init?.method).toBe("GET");
    expect(init?.headers).toEqual({ authorization: "Bearer platform-token" });
    expect(JSON.stringify(init)).not.toContain("x-tenant-id");
  });

  it("does not request an Admin summary for Teacher or Student roles", async () => {
    const fetcher = vi.fn(async () => jsonResponse(tenantSummary));

    await expect(loadAdminSummary(["teacher"], "teacher-token", fetcher)).resolves.toEqual({
      kind: "none"
    });
    await expect(loadAdminSummary(["learner"], "student-token", fetcher)).resolves.toEqual({
      kind: "none"
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed without falling back to admin state or exposing server text", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        {
          code: "TENANT-404-001",
          details: { tenant_id: "tenant_private" },
          message: "tenant_private does not exist"
        },
        404
      )
    );

    const error = await loadAdminSummary(["tenant_admin"], "tenant-token", fetcher).catch(
      (cause: unknown) => cause
    );

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[0]).toBe(TENANT_ADMIN_SUMMARY_PATH);
    expect(fetcher.mock.calls.flat().join(" ")).not.toContain("/api/v1/admin/state");
    expect(getAdminSummaryErrorMessage(error)).toBe("Admin summary is unavailable.");
    expect(getAdminSummaryErrorMessage(error)).not.toContain("tenant_private");
  });

  it("maps missing explicit platform scope to a safe non-escalating error", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        {
          code: "BFF-422-001",
          message: "platform authority BFF requires explicit scope=platform"
        },
        422
      )
    );

    const error = await loadAdminSummary(["platform_admin"], "platform-token", fetcher).catch(
      (cause: unknown) => cause
    );

    expect(getAdminSummaryErrorMessage(error)).toBe("Explicit platform scope is required.");
  });

  it("fails closed when a tenant response claims visibility over another tenant", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        ...tenantSummary,
        visible_tenant_ids: ["tenant_demo", "tenant_other"]
      })
    );

    const error = await loadAdminSummary(["tenant_admin"], "tenant-token", fetcher).catch(
      (cause: unknown) => cause
    );

    expect(getAdminSummaryErrorMessage(error)).toBe("Admin summary is unavailable.");
  });
});
