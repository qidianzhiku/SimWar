import type {
  ApiEnvelope,
  ProjectAwareCourseReadiness,
  ProjectAwareLaunchReceipt,
  ProjectLibraryAdminAuditProjection
} from "@simwar/shared-contracts";

export interface ProjectAwareLaunchAuditProjection {
  lineage: readonly ProjectAwareLaunchReceipt[];
  project_library: ProjectLibraryAdminAuditProjection;
  readiness: ProjectAwareCourseReadiness;
}

export interface ProjectAwareLaunchAuditRequest {
  baseUrl: string;
  courseId: string;
  runId: string;
  signal?: AbortSignal;
  tenantId: string;
  token: string;
}

export class ProjectAwareLaunchAuditRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ProjectAwareLaunchAuditRequestError";
  }
}

function apiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

async function readEnvelope<T>(response: Response): Promise<T> {
  let envelope: Partial<ApiEnvelope<T>> = {};
  try {
    envelope = (await response.json()) as Partial<ApiEnvelope<T>>;
  } catch {
    envelope = {};
  }
  if (!response.ok) {
    const code = typeof envelope.code === "string" ? envelope.code : `HTTP_${response.status}`;
    const message =
      typeof envelope.message === "string"
        ? envelope.message
        : "Project-aware audit request failed";
    throw new ProjectAwareLaunchAuditRequestError(response.status, code, message);
  }
  if (envelope.data === undefined) {
    throw new ProjectAwareLaunchAuditRequestError(
      response.status,
      "PROJECT_AWARE_AUDIT_EMPTY_RESPONSE",
      "Project-aware audit response did not include data"
    );
  }
  return envelope.data;
}

export async function fetchProjectAwareLaunchAudit(
  input: ProjectAwareLaunchAuditRequest
): Promise<ProjectAwareLaunchAuditProjection> {
  const query = new URLSearchParams({ course_id: input.courseId, run_id: input.runId });
  const response = await fetch(
    apiUrl(input.baseUrl, `/api/v1/bff/admin/project-aware-audit?${query.toString()}`),
    {
      headers: {
        authorization: `Bearer ${input.token}`,
        "x-tenant-id": input.tenantId
      },
      method: "GET",
      ...(input.signal ? { signal: input.signal } : {})
    }
  );
  return readEnvelope<ProjectAwareLaunchAuditProjection>(response);
}
