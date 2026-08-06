import { describe, expect, it, vi } from "vitest";
import {
  provisionTenantBaseline,
  TenantBaselineRequestError,
  tenantBaselineErrorMessage
} from "../../apps/admin/src/tenant-baseline-client";

const request = {
  idempotency_key: "w018-tenant-a",
  source_parameter_set: {
    content_digest: "a".repeat(64),
    parameter_set_id: "source-parameter",
    source_tenant_id: "tenant-source",
    version: "1.0.0"
  },
  source_scenario_package: {
    content_digest: "b".repeat(64),
    scenario_package_id: "source-scenario",
    source_tenant_id: "tenant-source",
    version: "1.0.0"
  },
  target_tenant_id: "tenant-a"
} as const;

function response(status: number, data: unknown, code = "OK"): Response {
  return new Response(JSON.stringify({ code, data, message: "ok", request_id: "request" }), {
    headers: { "content-type": "application/json" },
    status
  });
}

describe("tenant baseline admin client", () => {
  it("preserves exact request references and accepts a tenant-local result", async () => {
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
      expect(input).toContain("/api/v1/admin/tenant-baselines/provision");
      expect(init?.headers).toMatchObject({ authorization: "Bearer token" });
      expect(JSON.parse(String(init?.body))).toEqual(request);
      return response(201, {
        audit_identity: "audit-w018",
        outcome: "CREATED",
        parameter_set: {
          content_digest: "c".repeat(64),
          reference: { parameter_set_id: "local-p", version: "1.0.0" },
          status: "APPROVED",
          tenant_id: "tenant-a",
          version: "1.0.0"
        },
        provenance: {
          idempotency_key_digest: "d".repeat(64),
          provisioning_request_digest: "e".repeat(64),
          schema_version: "tenant-baseline-provenance.v1",
          source_parameter_set: {
            reference: request.source_parameter_set,
            tenant_id: "tenant-source"
          },
          source_scenario_package: {
            reference: request.source_scenario_package,
            tenant_id: "tenant-source"
          }
        },
        scenario_package: {
          content_digest: "f".repeat(64),
          reference: { scenario_package_id: "local-s", tenant_id: "tenant-a", version: "1.0.0" },
          status: "APPROVED",
          tenant_id: "tenant-a",
          version: "1.0.0"
        }
      });
    });
    await expect(
      provisionTenantBaseline(request, "token", "http://api", fetcher)
    ).resolves.toMatchObject({ outcome: "CREATED" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("turns stable conflict responses into an actionable message", async () => {
    const fetcher = vi.fn(async () => response(409, null, "TENANT_BASELINE-409-001"));
    await expect(
      provisionTenantBaseline(request, "token", "http://api", fetcher)
    ).rejects.toBeInstanceOf(TenantBaselineRequestError);
    expect(
      tenantBaselineErrorMessage(
        new TenantBaselineRequestError(409, "TENANT_BASELINE-409-001", "conflict")
      )
    ).toContain("conflicts");
  });

  it("rejects a response whose materialized tenant differs from the request", async () => {
    const fetcher = vi.fn(async () =>
      response(201, {
        audit_identity: "audit",
        outcome: "CREATED",
        parameter_set: { reference: {}, tenant_id: "tenant-b" },
        provenance: {},
        scenario_package: { reference: {}, tenant_id: "tenant-b" }
      })
    );
    await expect(
      provisionTenantBaseline(request, "token", "http://api", fetcher)
    ).rejects.toMatchObject({ code: "BFF_INVALID_RESPONSE" });
  });
});
