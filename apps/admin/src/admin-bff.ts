import type {
  ActorRole,
  ApiEnvelope,
  PlatformAdminAuthorityDTO,
  SyntheticRunLifecycleControlDTO,
  SyntheticRunLifecycleOperation,
  SyntheticRunLifecycleOperationResultDTO,
  TenantAdminSummaryDTO
} from "@simwar/shared-contracts";

export const TENANT_ADMIN_SUMMARY_PATH = "/api/v1/bff/admin/tenant-summary";
export const PLATFORM_ADMIN_AUTHORITY_PATH = "/api/v1/bff/admin/platform-authority?scope=platform";
export const RUN_LIFECYCLE_CONTROLS_PATH = "/api/v1/bff/admin/run-lifecycle-controls";

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

async function requestBff<TData>(
  path: string,
  token: string,
  fetcher: Fetcher,
  init: RequestInit = { method: "GET" }
): Promise<TData> {
  const response = await fetcher(path, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}` }
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

function isLifecycleControl(value: unknown): value is SyntheticRunLifecycleControlDTO {
  if (!value || typeof value !== "object") {
    return false;
  }

  const control = value as Partial<SyntheticRunLifecycleControlDTO>;
  return (
    typeof control.tenant_id === "string" &&
    typeof control.course_id === "string" &&
    typeof control.run_id === "string" &&
    control.runtime_boundary === "JSON_INTERNAL_ONLY" &&
    typeof control.synthetic_marker === "boolean" &&
    typeof control.pre_settlement === "boolean" &&
    typeof control.pre_publication === "boolean" &&
    typeof control.evidence_frozen === "boolean" &&
    Array.isArray(control.allowed_operations) &&
    Array.isArray(control.blocked_reasons) &&
    Array.isArray(control.preserved_state)
  );
}

export async function loadRunLifecycleControls(
  token: string,
  fetcher: Fetcher = fetch
): Promise<SyntheticRunLifecycleControlDTO[]> {
  const controls = await requestBff<unknown[]>(RUN_LIFECYCLE_CONTROLS_PATH, token, fetcher);
  if (!Array.isArray(controls) || !controls.every(isLifecycleControl)) {
    throw new AdminSummaryRequestError(502, "BFF_INVALID_RESPONSE");
  }
  return controls;
}

export async function executeRunLifecycleOperation(
  control: Pick<SyntheticRunLifecycleControlDTO, "course_id" | "run_id">,
  operation: SyntheticRunLifecycleOperation,
  token: string,
  fetcher: Fetcher = fetch
): Promise<SyntheticRunLifecycleOperationResultDTO> {
  const courseId = encodeURIComponent(control.course_id);
  const runId = encodeURIComponent(control.run_id);
  const result = await requestBff<SyntheticRunLifecycleOperationResultDTO>(
    `/api/v1/bff/admin/courses/${courseId}/runs/${runId}/lifecycle/${operation}`,
    token,
    fetcher,
    {
      body: JSON.stringify({ confirmation: `${operation.toUpperCase()} ${control.run_id}` }),
      headers: { "content-type": "application/json" },
      method: "POST"
    }
  );
  if (
    !result ||
    result.operation !== operation ||
    typeof result.idempotent !== "boolean" ||
    !Array.isArray(result.ephemeral_artifacts_changed) ||
    !isLifecycleControl(result.control)
  ) {
    throw new AdminSummaryRequestError(502, "BFF_INVALID_RESPONSE");
  }
  return result;
}

export async function loadAdminSummary(
  roles: ActorRole[],
  token: string,
  fetcher: Fetcher = fetch
): Promise<AdminSummarySurface> {
  if (roles.includes("platform_admin")) {
    const authority = await requestBff<PlatformAdminAuthorityDTO>(
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
    const summary = await requestBff<TenantAdminSummaryDTO>(
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
    if (error.code.startsWith("LIFECYCLE-")) {
      return "Run lifecycle operation was denied by the synthetic pre-settlement boundary.";
    }
  }

  return "Admin summary is unavailable.";
}
