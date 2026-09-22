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
export type TeacherScenarioStudioModelSelection =
  | { kind: "SOURCE_UNAVAILABLE" }
  | { kind: "REQUIRES_SELECTION"; options: readonly string[] }
  | { kind: "SELECTED"; modelVersionRef: string };

export type TeacherScenarioStudioRecoveryState =
  | "REAUTH_REQUIRED"
  | "PERMISSION_DENIED"
  | "STALE_OR_OUT_OF_SCOPE"
  | "CONFLICT"
  | "UNKNOWN_COMMAND_RESULT"
  | "ERROR_FAIL_CLOSED";

export interface TeacherScenarioStudioRecoveryError {
  status: number;
  code: string;
  message: string;
  mutation?: boolean;
  transport?: "NETWORK" | "MALFORMED";
}

export function getTeacherScenarioStudioModelSelection(
  catalog: Pick<TeacherScenarioStudioCatalogDto, "model_versions">,
  selectedModelVersionRef: string
): TeacherScenarioStudioModelSelection {
  const options = catalog.model_versions.map((model) => model.model_version_ref);
  if (options.length === 0) return { kind: "SOURCE_UNAVAILABLE" };
  if (!selectedModelVersionRef || !options.includes(selectedModelVersionRef)) {
    return { kind: "REQUIRES_SELECTION", options };
  }
  return { kind: "SELECTED", modelVersionRef: selectedModelVersionRef };
}

export function getTeacherScenarioStudioPrimaryAction(input: {
  status: "DRAFT" | "BLOCKED" | "VALIDATED" | "FROZEN" | "ACTIVATED";
}):
  | "VALIDATE_COMPATIBILITY"
  | "INSPECT_AND_RECOVER"
  | "FREEZE_CANDIDATE"
  | "PREVIEW_TEACHING_SCENARIO"
  | "NONE" {
  if (input.status === "DRAFT") return "VALIDATE_COMPATIBILITY";
  if (input.status === "BLOCKED") return "INSPECT_AND_RECOVER";
  if (input.status === "VALIDATED") return "FREEZE_CANDIDATE";
  if (input.status === "FROZEN") return "PREVIEW_TEACHING_SCENARIO";
  return "NONE";
}

export function getTeacherScenarioStudioRecoveryState(
  error: TeacherScenarioStudioRecoveryError
): TeacherScenarioStudioRecoveryState {
  if (error.transport === "MALFORMED") return "ERROR_FAIL_CLOSED";
  if (error.mutation && (error.status === 0 || error.status >= 500)) {
    return "UNKNOWN_COMMAND_RESULT";
  }
  if (error.status === 401) return "REAUTH_REQUIRED";
  if (error.status === 403) return "PERMISSION_DENIED";
  if (error.status === 404) return "STALE_OR_OUT_OF_SCOPE";
  if (error.status === 409) return "CONFLICT";
  return "ERROR_FAIL_CLOSED";
}

export class TeacherScenarioStudioRequestCoordinator {
  private controller: AbortController | null = null;
  private epoch = 0;
  private contextKey = "";

  begin(nextContextKey: string): {
    signal: AbortSignal;
    isCurrent: () => boolean;
  } {
    this.controller?.abort();
    const controller = new AbortController();
    const epoch = ++this.epoch;
    this.controller = controller;
    this.contextKey = nextContextKey;
    return {
      signal: controller.signal,
      isCurrent: () =>
        this.epoch === epoch && this.contextKey === nextContextKey && !controller.signal.aborted
    };
  }

  invalidate(nextContextKey: string): void {
    this.controller?.abort();
    this.controller = null;
    this.contextKey = nextContextKey;
    this.epoch += 1;
  }
}

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
  signal?: AbortSignal;
  validate: (value: unknown) => value is T;
}): Promise<T> {
  const init: RequestInit = {
    headers: {
      authorization: `Bearer ${input.token}`,
      ...(input.body === undefined ? {} : { "content-type": "application/json" })
    },
    method: input.method
  };
  if (input.signal !== undefined) init.signal = input.signal;
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
  if (!input.validate(payload.data)) {
    throw new TeacherScenarioStudioRequestError(
      response.status,
      "TEACHER_SCENARIO_STUDIO_INVALID_RESPONSE",
      "Teacher Scenario Studio returned an invalid response"
    );
  }
  return payload.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "string" && value[key] !== "";
}

function hasReference(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasString(value, "content_digest") &&
    hasString(value, "course_package_id") &&
    hasString(value, "tenant_id") &&
    hasString(value, "version")
  );
}

function isCatalog(value: unknown): value is TeacherScenarioStudioCatalogDto {
  return (
    isRecord(value) &&
    Array.isArray(value.course_blueprints) &&
    Array.isArray(value.scenario_packages) &&
    Array.isArray(value.model_versions) &&
    value.model_versions.every(
      (model) =>
        isRecord(model) &&
        hasString(model, "model_version_ref") &&
        model.provider === "OFF" &&
        model.status === "APPROVED"
    )
  );
}

function isDraft(value: unknown): value is TeacherScenarioStudioDraftDto {
  return (
    isRecord(value) &&
    hasReference(value.course_package_reference) &&
    hasString(value, "operation_id") &&
    ["DRAFT", "VALIDATED", "FROZEN", "ACTIVATED"].includes(String(value.status)) &&
    isRecord(value.studio_configuration) &&
    hasString(value, "title")
  );
}

function isValidation(value: unknown): value is TeacherScenarioStudioValidationDto {
  return (
    isRecord(value) &&
    isRecord(value.checks) &&
    ["VALIDATED", "BLOCKED"].includes(String(value.status)) &&
    hasString(value, "operation_id")
  );
}

function isPreview(value: unknown): value is TeacherScenarioStudioPreviewDto {
  return (
    isRecord(value) &&
    isRecord(value.role_safe_preview) &&
    isRecord(value.source_references) &&
    ["DRAFT", "VALIDATED", "FROZEN", "ACTIVATED"].includes(String(value.status))
  );
}

function isActivation(value: unknown): value is TeacherScenarioStudioActivationDto {
  return (
    isRecord(value) &&
    isRecord(value.activation) &&
    value.activation.run_activation === "DEFERRED_TO_EXISTING_RUN_WRITER" &&
    value.activation.status === "ACTIVATED" &&
    value.activation.writer === "EXISTING_COURSE_AND_FORMAL_AUTHORITY_BINDING_WRITERS" &&
    isRecord(value.course) &&
    hasString(value.course, "course_id") &&
    hasString(value.course, "status") &&
    isRecord(value.source_references)
  );
}

export function loadTeacherScenarioStudioCatalog(input: {
  apiBase: string;
  token: string;
  signal?: AbortSignal;
}): Promise<TeacherScenarioStudioCatalogDto> {
  return request({
    ...input,
    method: "GET",
    path: "/api/v1/bff/teacher/scenario-studio",
    validate: isCatalog
  });
}

export function createTeacherScenarioStudioDraft(input: {
  apiBase: string;
  draft: TeacherScenarioStudioDraftInput;
  token: string;
  signal?: AbortSignal;
}): Promise<TeacherScenarioStudioDraftDto> {
  return request({
    ...input,
    body: input.draft,
    method: "POST",
    path: "/api/v1/bff/teacher/scenario-studio/drafts",
    validate: isDraft
  });
}

export function previewTeacherScenarioStudio(input: {
  apiBase: string;
  reference: CoursePackageVersionReference;
  token: string;
  signal?: AbortSignal;
}): Promise<TeacherScenarioStudioPreviewDto> {
  return request({
    ...input,
    body: { course_package_reference: input.reference },
    method: "POST",
    path: "/api/v1/bff/teacher/scenario-studio/drafts/preview",
    validate: isPreview
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
  signal?: AbortSignal;
}): Promise<TeacherScenarioStudioValidationDto> {
  return request({
    ...input,
    body: { course_package_reference: input.reference },
    method: "POST",
    path: transitionPath(input.reference, "validate"),
    validate: isValidation
  });
}

export function freezeTeacherScenarioStudio(input: {
  apiBase: string;
  reference: CoursePackageVersionReference;
  token: string;
  signal?: AbortSignal;
}): Promise<TeacherScenarioStudioDraftDto> {
  return request({
    ...input,
    body: { course_package_reference: input.reference },
    method: "POST",
    path: transitionPath(input.reference, "freeze"),
    validate: isDraft
  });
}

export function activateTeacherScenarioStudio(input: {
  apiBase: string;
  reference: CoursePackageVersionReference;
  token: string;
  signal?: AbortSignal;
}): Promise<TeacherScenarioStudioActivationDto> {
  return request({
    ...input,
    body: { course_package_reference: input.reference },
    method: "POST",
    path: transitionPath(input.reference, "activate"),
    validate: isActivation
  });
}
