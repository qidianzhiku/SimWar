import type {
  ApiEnvelope,
  CoursePackageVersionReference,
  TeacherScenarioStudioActivationDto,
  TeacherScenarioStudioCatalogDto,
  TeacherScenarioStudioDraftDto,
  TeacherScenarioStudioDraftInput,
  TeacherScenarioStudioPreviewDto,
  TeacherScenarioStudioValidationDto
} from "@simwar/shared-contracts";

export class TeacherScenarioStudioRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "TeacherScenarioStudioRequestError";
  }
}

async function request<T>(input: {
  apiBase: string;
  body?: unknown;
  method: string;
  path: string;
  token: string;
}): Promise<T> {
  const init: RequestInit = {
    headers: {
      authorization: `Bearer ${input.token}`,
      ...(input.body === undefined ? {} : { "content-type": "application/json" })
    },
    method: input.method
  };
  if (input.body !== undefined) init.body = JSON.stringify(input.body);
  const response = await fetch(`${input.apiBase}${input.path}`, init);
  const payload = (await response.json()) as Partial<ApiEnvelope<T>> & {
    error?: { code?: string; message?: string };
  };
  if (!response.ok || payload.data === undefined) {
    throw new TeacherScenarioStudioRequestError(
      response.status,
      payload.code ?? payload.error?.code ?? "TEACHER_SCENARIO_STUDIO_REQUEST_FAILED",
      payload.message ?? payload.error?.message ?? "Teacher Scenario Studio request failed"
    );
  }
  return payload.data;
}

export function loadTeacherScenarioStudioCatalog(input: {
  apiBase: string;
  token: string;
}): Promise<TeacherScenarioStudioCatalogDto> {
  return request({ ...input, method: "GET", path: "/api/v1/bff/teacher/scenario-studio" });
}

export function createTeacherScenarioStudioDraft(input: {
  apiBase: string;
  draft: TeacherScenarioStudioDraftInput;
  token: string;
}): Promise<TeacherScenarioStudioDraftDto> {
  return request({
    ...input,
    body: input.draft,
    method: "POST",
    path: "/api/v1/bff/teacher/scenario-studio/drafts"
  });
}

export function previewTeacherScenarioStudio(input: {
  apiBase: string;
  reference: CoursePackageVersionReference;
  token: string;
}): Promise<TeacherScenarioStudioPreviewDto> {
  return request({
    ...input,
    body: { course_package_reference: input.reference },
    method: "POST",
    path: "/api/v1/bff/teacher/scenario-studio/drafts/preview"
  });
}

function transitionPath(
  reference: CoursePackageVersionReference,
  action: "activate" | "freeze" | "validate"
): string {
  return `/api/v1/bff/teacher/scenario-studio/drafts/${encodeURIComponent(reference.course_package_id)}/versions/${encodeURIComponent(reference.version)}/${action}`;
}

export function validateTeacherScenarioStudio(input: {
  apiBase: string;
  reference: CoursePackageVersionReference;
  token: string;
}): Promise<TeacherScenarioStudioValidationDto> {
  return request({
    ...input,
    body: { course_package_reference: input.reference },
    method: "POST",
    path: transitionPath(input.reference, "validate")
  });
}

export function freezeTeacherScenarioStudio(input: {
  apiBase: string;
  reference: CoursePackageVersionReference;
  token: string;
}): Promise<TeacherScenarioStudioDraftDto> {
  return request({
    ...input,
    body: { course_package_reference: input.reference },
    method: "POST",
    path: transitionPath(input.reference, "freeze")
  });
}

export function activateTeacherScenarioStudio(input: {
  apiBase: string;
  reference: CoursePackageVersionReference;
  token: string;
}): Promise<TeacherScenarioStudioActivationDto> {
  return request({
    ...input,
    body: { course_package_reference: input.reference },
    method: "POST",
    path: transitionPath(input.reference, "activate")
  });
}
