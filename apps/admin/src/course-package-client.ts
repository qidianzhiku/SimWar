import type {
  CoursePackageVersion,
  CoursePackageVersionDraftInput,
  CoursePackageVersionExportDto,
  CoursePackageVersionImportInput,
  CoursePackageVersionReference
} from "@simwar/shared-contracts";

export const ADMIN_COURSE_PACKAGE_VERSION_LIST_PATH = "/api/v1/admin/course-package-versions";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type AdminCoursePackageOperation =
  | "list"
  | "draft"
  | "import"
  | "validate"
  | "make-available"
  | "retire"
  | "export";

export type CoursePackageSurfaceState =
  | "DEPENDENCY_MISSING"
  | "DIGEST_MISMATCH"
  | "EXPORT_RESTRICTED"
  | "INCOMPATIBLE"
  | "PERMISSION_DENIED"
  | "STALE"
  | "UNKNOWN";

export class AdminCoursePackageRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super("Course package request failed");
    this.name = "AdminCoursePackageRequestError";
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

async function requestCoursePackage<TData>(
  path: string,
  token: string,
  fetcher: Fetcher,
  init: RequestInit
): Promise<TData> {
  const response = await fetcher(path, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...init.headers }
  });
  let payload: ResponseEnvelope<TData>;
  try {
    payload = (await response.json()) as ResponseEnvelope<TData>;
  } catch {
    throw new AdminCoursePackageRequestError(response.status, "COURSE_PACKAGE_RESPONSE_INVALID");
  }

  if (!response.ok) {
    throw new AdminCoursePackageRequestError(response.status, responseCode(payload));
  }
  if (!("data" in payload) || payload.data === undefined) {
    throw new AdminCoursePackageRequestError(response.status, "COURSE_PACKAGE_RESPONSE_INVALID");
  }
  return payload.data;
}

function toReferenceInput(reference: CoursePackageVersionReference) {
  return {
    content_digest: reference.content_digest,
    course_package_id: reference.course_package_id,
    version: reference.version
  };
}

function versionPath(reference: CoursePackageVersionReference, action: string): string {
  return `${ADMIN_COURSE_PACKAGE_VERSION_LIST_PATH}/${encodeURIComponent(
    reference.course_package_id
  )}/versions/${encodeURIComponent(reference.version)}/${action}`;
}

export async function loadAdminCoursePackageVersions(
  token: string,
  fetcher: Fetcher = fetch
): Promise<readonly CoursePackageVersion[]> {
  const data = await requestCoursePackage<{
    course_package_versions: readonly CoursePackageVersion[];
  }>(ADMIN_COURSE_PACKAGE_VERSION_LIST_PATH, token, fetcher, { method: "GET" });
  return data.course_package_versions;
}

export async function createAdminCoursePackageDraft(
  input: CoursePackageVersionDraftInput,
  token: string,
  fetcher: Fetcher = fetch
): Promise<CoursePackageVersion> {
  return requestCoursePackage(`${ADMIN_COURSE_PACKAGE_VERSION_LIST_PATH}/drafts`, token, fetcher, {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
}

export async function importAdminCoursePackageVersion(
  input: CoursePackageVersionImportInput,
  token: string,
  fetcher: Fetcher = fetch
): Promise<CoursePackageVersion> {
  return requestCoursePackage(`${ADMIN_COURSE_PACKAGE_VERSION_LIST_PATH}/import`, token, fetcher, {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
}

export async function runAdminCoursePackageLifecycle(
  operation: "validate" | "make-available" | "retire",
  coursePackage: CoursePackageVersion,
  token: string,
  fetcher: Fetcher = fetch
): Promise<CoursePackageVersion> {
  const reference: CoursePackageVersionReference = {
    content_digest: coursePackage.content_digest,
    course_package_id: coursePackage.course_package_id,
    tenant_id: coursePackage.tenant_id,
    version: coursePackage.version
  };
  return requestCoursePackage(versionPath(reference, operation), token, fetcher, {
    body: JSON.stringify(toReferenceInput(reference)),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
}

export async function exportAdminCoursePackageVersion(
  coursePackage: CoursePackageVersion,
  token: string,
  fetcher: Fetcher = fetch
): Promise<CoursePackageVersion> {
  const reference: CoursePackageVersionReference = {
    content_digest: coursePackage.content_digest,
    course_package_id: coursePackage.course_package_id,
    tenant_id: coursePackage.tenant_id,
    version: coursePackage.version
  };
  const data = await requestCoursePackage<CoursePackageVersionExportDto>(
    `${versionPath(reference, "export")}?content_digest=${encodeURIComponent(reference.content_digest)}`,
    token,
    fetcher,
    { method: "GET" }
  );
  return data.course_package_version;
}

export function getAdminCoursePackageSurfaceState(
  value: unknown,
  operation: AdminCoursePackageOperation
): CoursePackageSurfaceState {
  if (value && typeof value === "object" && "status" in value && value.status === "RETIRED") {
    return "STALE";
  }
  if (!(value instanceof AdminCoursePackageRequestError)) {
    return "UNKNOWN";
  }
  if (operation === "export" && (value.status === 401 || value.status === 403)) {
    return "EXPORT_RESTRICTED";
  }
  if (value.status === 401 || value.status === 403 || value.code === "COURSE_PACKAGE_FORBIDDEN") {
    return "PERMISSION_DENIED";
  }
  if (value.code === "COURSE_PACKAGE_DEPENDENCY_NOT_BINDABLE") {
    return "DEPENDENCY_MISSING";
  }
  if (value.code === "COURSE_PACKAGE_IMPORT_DIGEST_INVALID") {
    return "DIGEST_MISMATCH";
  }
  if (value.code === "COURSE_PACKAGE_COMPATIBILITY_MISMATCH") {
    return "INCOMPATIBLE";
  }
  if (
    value.code === "COURSE_PACKAGE_NOT_FOUND" ||
    value.code === "COURSE_PACKAGE_LIFECYCLE_INVALID"
  ) {
    return "STALE";
  }
  return "UNKNOWN";
}
