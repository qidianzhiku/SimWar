import type {
  CoursePackageVersionCloneInput,
  CoursePackageVersionTeacherDto
} from "@simwar/shared-contracts";

export const TEACHER_COURSE_PACKAGE_VERSION_LIST_PATH =
  "/api/v1/bff/teacher/course-package-versions";
export const TEACHER_COURSE_PACKAGE_VERSION_CLONE_PATH =
  "/api/v1/bff/teacher/course-package-versions/clone";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type TeacherCoursePackageSurfaceState = "PERMISSION_DENIED" | "UNKNOWN";

export class TeacherCoursePackageRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super("Course package request failed");
    this.name = "TeacherCoursePackageRequestError";
  }
}

interface ResponseEnvelope<TData> {
  code?: unknown;
  data?: TData;
  error?: { code?: unknown };
}

function responseCode(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "COURSE_PACKAGE_RESPONSE_INVALID";
  }
  const envelope = payload as ResponseEnvelope<unknown>;
  if (typeof envelope.code === "string") {
    return envelope.code;
  }
  if (typeof envelope.error?.code === "string") {
    return envelope.error.code;
  }
  return "COURSE_PACKAGE_RESPONSE_INVALID";
}

export async function loadTeacherCoursePackageVersions(
  token: string,
  fetcher: Fetcher = fetch
): Promise<readonly CoursePackageVersionTeacherDto[]> {
  const response = await fetcher(TEACHER_COURSE_PACKAGE_VERSION_LIST_PATH, {
    headers: { authorization: `Bearer ${token}` },
    method: "GET"
  });
  let payload: ResponseEnvelope<{
    course_package_versions: readonly CoursePackageVersionTeacherDto[];
  }>;
  try {
    payload = (await response.json()) as ResponseEnvelope<{
      course_package_versions: readonly CoursePackageVersionTeacherDto[];
    }>;
  } catch {
    throw new TeacherCoursePackageRequestError(response.status, "COURSE_PACKAGE_RESPONSE_INVALID");
  }

  if (!response.ok) {
    throw new TeacherCoursePackageRequestError(response.status, responseCode(payload));
  }
  if (!("data" in payload) || payload.data === undefined) {
    throw new TeacherCoursePackageRequestError(response.status, "COURSE_PACKAGE_RESPONSE_INVALID");
  }
  return payload.data.course_package_versions;
}

export async function cloneTeacherCoursePackageVersion(
  input: CoursePackageVersionCloneInput,
  token: string,
  fetcher: Fetcher = fetch
): Promise<CoursePackageVersionTeacherDto> {
  const response = await fetcher(TEACHER_COURSE_PACKAGE_VERSION_CLONE_PATH, {
    body: JSON.stringify(input),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    method: "POST"
  });
  let payload: ResponseEnvelope<CoursePackageVersionTeacherDto>;
  try {
    payload = (await response.json()) as ResponseEnvelope<CoursePackageVersionTeacherDto>;
  } catch {
    throw new TeacherCoursePackageRequestError(response.status, "COURSE_PACKAGE_RESPONSE_INVALID");
  }

  if (!response.ok) {
    throw new TeacherCoursePackageRequestError(response.status, responseCode(payload));
  }
  if (!("data" in payload) || payload.data === undefined) {
    throw new TeacherCoursePackageRequestError(response.status, "COURSE_PACKAGE_RESPONSE_INVALID");
  }
  return payload.data;
}

export function getTeacherCoursePackageSurfaceState(
  value: unknown
): TeacherCoursePackageSurfaceState {
  if (
    value instanceof TeacherCoursePackageRequestError &&
    (value.status === 401 || value.status === 403 || value.code === "COURSE_PACKAGE_FORBIDDEN")
  ) {
    return "PERMISSION_DENIED";
  }
  return "UNKNOWN";
}
