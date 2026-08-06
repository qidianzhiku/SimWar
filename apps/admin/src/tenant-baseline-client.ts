import type {
  ApiEnvelope,
  TenantBaselineProvisioningRequest,
  TenantBaselineProvisioningResult
} from "@simwar/shared-contracts";

export const TENANT_BASELINE_PROVISION_PATH = "/api/v1/admin/tenant-baselines/provision";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class TenantBaselineRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly serverMessage: string
  ) {
    super(serverMessage);
    this.name = "TenantBaselineRequestError";
  }
}

export async function provisionTenantBaseline(
  request: TenantBaselineProvisioningRequest,
  token: string,
  apiBase: string,
  fetcher: Fetcher = fetch
): Promise<TenantBaselineProvisioningResult> {
  const response = await fetcher(`${apiBase}${TENANT_BASELINE_PROVISION_PATH}`, {
    body: JSON.stringify(request),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    method: "POST"
  });
  const envelope = (await response.json()) as ApiEnvelope<TenantBaselineProvisioningResult>;
  if (!response.ok) {
    throw new TenantBaselineRequestError(response.status, envelope.code, envelope.message);
  }
  if (
    !envelope.data ||
    (envelope.data.outcome !== "CREATED" && envelope.data.outcome !== "REUSED") ||
    envelope.data.parameter_set.tenant_id !== request.target_tenant_id ||
    envelope.data.scenario_package.tenant_id !== request.target_tenant_id
  ) {
    throw new TenantBaselineRequestError(502, "BFF_INVALID_RESPONSE", "baseline response invalid");
  }
  return envelope.data;
}

export function tenantBaselineErrorMessage(error: unknown): string {
  if (!(error instanceof TenantBaselineRequestError)) {
    return "Tenant baseline provisioning failed.";
  }
  if (error.code === "TENANT_BASELINE-403-001") return "Platform baseline authority is required.";
  if (error.code === "TENANT_BASELINE-404-001") return "Target tenant was not found.";
  if (error.code === "TENANT_BASELINE-409-001")
    return "This idempotency key conflicts with an existing baseline.";
  if (error.code === "TENANT_BASELINE-422-001")
    return "The exact baseline references are invalid or not approved.";
  return `${error.code}: ${error.serverMessage}`;
}
