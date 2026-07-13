import type {
  ActorRole,
  ApiEnvelope,
  PlatformAdminAuthorityDTO,
  TenantAdminSummaryDTO
} from "@simwar/shared-contracts";

export const TENANT_ADMIN_SUMMARY_PATH = "/api/v1/bff/admin/tenant-summary";
export const PLATFORM_ADMIN_AUTHORITY_PATH = "/api/v1/bff/admin/platform-authority?scope=platform";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type AdminSummarySurface =
  | { kind: "none" }
  | { kind: "tenant"; summary: TenantAdminSummaryDTO }
  | { authority: PlatformAdminAuthorityDTO; kind: "platform" };

class AdminSummaryRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super("Admin summary request failed");
    this.name = "AdminSummaryRequestError";
  }
}

function isTenantSummary(value: unknown): value is TenantAdminSummaryDTO {
  if (!value || typeof value !== "object") {
    return false;
  }

  const summary = value as Partial<TenantAdminSummaryDTO>;
  return (
    summary.actor_role === "tenant_admin" &&
    typeof summary.tenant_id === "string" &&
    Array.isArray(summary.visible_tenant_ids) &&
    summary.visible_tenant_ids.length === 1 &&
    summary.visible_tenant_ids[0] === summary.tenant_id &&
    typeof summary.visible_state?.audit_event_count === "number" &&
    typeof summary.visible_state.course_count === "number" &&
    typeof summary.visible_state.run_count === "number" &&
    typeof summary.visible_state.team_count === "number"
  );
}

function isPlatformAuthority(value: unknown): value is PlatformAdminAuthorityDTO {
  if (!value || typeof value !== "object") {
    return false;
  }

  const authority = value as Partial<PlatformAdminAuthorityDTO>;
  return (
    authority.actor_role === "platform_admin" &&
    authority.platform_authority === true &&
    authority.required_scope === "platform" &&
    typeof authority.visible_state?.tenant_count === "number" &&
    Array.isArray(authority.visible_state.tenant_ids)
  );
}

async function requestSummary<TData>(
  path: string,
  token: string,
  fetcher: Fetcher
): Promise<TData> {
  const response = await fetcher(path, {
    headers: { authorization: `Bearer ${token}` },
    method: "GET"
  });

  let envelope: ApiEnvelope<TData>;
  try {
    envelope = (await response.json()) as ApiEnvelope<TData>;
  } catch {
    throw new AdminSummaryRequestError(response.status, "BFF_INVALID_RESPONSE");
  }

  if (!response.ok) {
    throw new AdminSummaryRequestError(response.status, String(envelope.code));
  }

  return envelope.data;
}

export async function loadAdminSummary(
  roles: ActorRole[],
  token: string,
  fetcher: Fetcher = fetch
): Promise<AdminSummarySurface> {
  if (roles.includes("platform_admin")) {
    const authority = await requestSummary<PlatformAdminAuthorityDTO>(
      PLATFORM_ADMIN_AUTHORITY_PATH,
      token,
      fetcher
    );
    if (!isPlatformAuthority(authority)) {
      throw new AdminSummaryRequestError(502, "BFF_INVALID_RESPONSE");
    }
    return { authority, kind: "platform" };
  }

  if (roles.includes("tenant_admin")) {
    const summary = await requestSummary<TenantAdminSummaryDTO>(
      TENANT_ADMIN_SUMMARY_PATH,
      token,
      fetcher
    );
    if (!isTenantSummary(summary)) {
      throw new AdminSummaryRequestError(502, "BFF_INVALID_RESPONSE");
    }
    return { kind: "tenant", summary };
  }

  return { kind: "none" };
}

export function getAdminSummaryErrorMessage(error: unknown): string {
  if (error instanceof AdminSummaryRequestError) {
    if (error.code === "BFF-422-001") {
      return "Explicit platform scope is required.";
    }
    if (error.status === 401) {
      return "Sign in is required to load the Admin summary.";
    }
    if (error.status === 403) {
      return "Admin summary is unavailable for this role.";
    }
  }

  return "Admin summary is unavailable.";
}
