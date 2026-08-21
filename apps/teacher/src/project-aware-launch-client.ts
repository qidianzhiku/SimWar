import type {
  ApiEnvelope,
  ProjectAwareCourseReadiness,
  ProjectAwareLaunchReceipt
} from "@simwar/shared-contracts";

export interface ProjectAwareTeacherRequest {
  baseUrl: string;
  courseId: string;
  runId: string;
  signal?: AbortSignal;
  tenantId: string;
  token: string;
}

export class ProjectAwareLaunchRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ProjectAwareLaunchRequestError";
  }
}

function apiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

function authHeaders(input: ProjectAwareTeacherRequest): HeadersInit {
  return {
    authorization: `Bearer ${input.token}`,
    "x-tenant-id": input.tenantId
  };
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
      typeof envelope.message === "string" ? envelope.message : "Project-aware request failed";
    throw new ProjectAwareLaunchRequestError(response.status, code, message);
  }
  if (envelope.data === undefined) {
    throw new ProjectAwareLaunchRequestError(
      response.status,
      "PROJECT_AWARE_EMPTY_RESPONSE",
      "Project-aware response did not include data"
    );
  }
  return envelope.data;
}

function stableScopeHash(values: readonly string[]): string {
  let hash = 2166136261;
  for (const character of values.join("\u001f")) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * The same exact tenant/course/run scope always produces the same safe key.
 * It intentionally contains no random value and stays within the server key grammar.
 */
export function createProjectAwareLaunchIdempotencyKey(
  input: Pick<ProjectAwareTeacherRequest, "courseId" | "runId" | "tenantId">
): string {
  return `project-aware-launch:${stableScopeHash([input.tenantId, input.courseId, input.runId])}`;
}

export async function fetchProjectAwareCourseReadiness(
  input: ProjectAwareTeacherRequest
): Promise<ProjectAwareCourseReadiness> {
  const query = new URLSearchParams({ run_id: input.runId });
  const response = await fetch(
    apiUrl(
      input.baseUrl,
      `/api/v1/bff/teacher/courses/${encodeURIComponent(input.courseId)}/project-aware-readiness?${query.toString()}`
    ),
    {
      headers: authHeaders(input),
      method: "GET",
      ...(input.signal ? { signal: input.signal } : {})
    }
  );
  return readEnvelope<ProjectAwareCourseReadiness>(response);
}

export async function launchProjectAwareCourse(
  input: ProjectAwareTeacherRequest & { idempotencyKey?: string | undefined }
): Promise<ProjectAwareLaunchReceipt> {
  const idempotencyKey = input.idempotencyKey ?? createProjectAwareLaunchIdempotencyKey(input);
  const response = await fetch(
    apiUrl(
      input.baseUrl,
      `/api/v1/bff/teacher/courses/${encodeURIComponent(input.courseId)}/project-aware-launch`
    ),
    {
      body: JSON.stringify({ idempotency_key: idempotencyKey, run_id: input.runId }),
      headers: {
        ...authHeaders(input),
        "content-type": "application/json"
      },
      method: "POST",
      ...(input.signal ? { signal: input.signal } : {})
    }
  );
  return readEnvelope<ProjectAwareLaunchReceipt>(response);
}
