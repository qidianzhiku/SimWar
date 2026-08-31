import type { ApiEnvelope, ProjectAwareStudentContext } from "@simwar/shared-contracts";

export interface ProjectAwareStudentContextRequest {
  baseUrl: string;
  courseId: string;
  runId: string;
  roundId?: string | undefined;
  signal?: AbortSignal;
  teamId: string;
  tenantId: string;
  token: string;
}

export class ProjectAwareStudentContextRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ProjectAwareStudentContextRequestError";
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
      typeof envelope.message === "string" ? envelope.message : "Student context request failed";
    throw new ProjectAwareStudentContextRequestError(response.status, code, message);
  }
  if (envelope.data === undefined) {
    throw new ProjectAwareStudentContextRequestError(
      response.status,
      "PROJECT_AWARE_STUDENT_EMPTY_RESPONSE",
      "Student context response did not include data"
    );
  }
  return envelope.data;
}

export async function fetchProjectAwareStudentContext(
  input: ProjectAwareStudentContextRequest
): Promise<ProjectAwareStudentContext> {
  const query = new URLSearchParams({
    course_id: input.courseId,
    run_id: input.runId,
    team_id: input.teamId
  });
  if (input.roundId) query.set("round_id", input.roundId);
  const response = await fetch(
    apiUrl(input.baseUrl, `/api/v1/bff/student/project-aware-context?${query.toString()}`),
    {
      headers: {
        authorization: `Bearer ${input.token}`,
        "x-tenant-id": input.tenantId
      },
      method: "GET",
      ...(input.signal ? { signal: input.signal } : {})
    }
  );
  return readEnvelope<ProjectAwareStudentContext>(response);
}
