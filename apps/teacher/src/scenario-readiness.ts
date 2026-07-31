import type {
  R7TeacherScenarioPackageCandidatesDto,
  TeacherCourseBlueprintCatalogDto,
  TeacherCourseBlueprintCourseCreateDto,
  TeacherCourseBlueprintReadinessDto,
  TeacherFormalCourseBindingPreviewDto,
  TeacherFormalCourseCreateDto,
  TeacherFormalScenarioPackageCatalogDto
} from "@simwar/shared-contracts";

export const SCENARIO_READINESS_OPERATION_ID =
  "R7_TEACHER_SCENARIO_SELECTION_READINESS_GET_V1" as const;

export interface ScenarioReadinessResponse {
  operation_id: typeof SCENARIO_READINESS_OPERATION_ID;
  tenant_id: string;
  course_id: string;
  run_id: string;
  scenario_package_id: string;
  parameter_set_id: string;
  eligible: boolean;
  readiness_status: "BLOCKED" | "READY";
  compatibility_status: string;
  provenance_status: string;
  qa_status: string;
  license_status: string;
  calibration_status: string;
  runtime_adapter_status: string;
  no_go_reasons: string[];
  evidence_freshness: {
    collected_at: string | null;
    expires_at: string | null;
    is_expired: boolean;
  };
  explicit_non_proofs: string[];
}

export class ScenarioReadinessRequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ScenarioReadinessRequestError";
  }
}

export class ScenarioCandidatesRequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ScenarioCandidatesRequestError";
  }
}

export class TeacherFormalScenarioPackageCatalogRequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "TeacherFormalScenarioPackageCatalogRequestError";
  }
}

export class TeacherFormalCourseBindingRequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "TeacherFormalCourseBindingRequestError";
  }
}

export interface TeacherCourseBlueprintStudioEditableContent {
  activity_plan: readonly unknown[];
  description: string;
  duration_minutes: number;
  instructor_guidance_reference: string;
  objectives: readonly string[];
  ordered_phases: readonly {
    activity_type: string;
    duration_minutes: number;
    order: number;
    phase_id: string;
    student_instruction: string;
    teacher_guidance: string;
    title: string;
  }[];
  required_product_capabilities: readonly string[];
  scenario_compatibility_constraints: Readonly<Record<string, string>>;
  schema_version: "course-blueprint.v1";
  title: string;
  version: string;
}

export interface TeacherCourseBlueprintStudioPreview {
  content_digest: string;
  course_blueprint_reference: TeacherCourseBlueprintCatalogDto["candidates"][number]["course_blueprint_reference"];
  editable_content: TeacherCourseBlueprintStudioEditableContent;
  status: "APPROVED" | "DRAFT" | "VALIDATED";
}

export interface TeacherCourseBlueprintStudioDraft {
  content_digest: string;
  course_blueprint_reference: TeacherCourseBlueprintCatalogDto["candidates"][number]["course_blueprint_reference"];
  source_course_blueprint_reference: TeacherCourseBlueprintCatalogDto["candidates"][number]["course_blueprint_reference"];
  status: "DRAFT";
  title: string;
  version: string;
}

export interface TeacherCourseBlueprintStudioSubmission {
  course_blueprint_reference: TeacherCourseBlueprintCatalogDto["candidates"][number]["course_blueprint_reference"];
  status: "VALIDATED";
}

async function requestTeacherFormalCourseBinding<T>(input: {
  apiBaseUrl: string;
  body: unknown;
  path: string;
  token: string;
}): Promise<T> {
  const response = await fetch(`${input.apiBaseUrl}${input.path}`, {
    body: JSON.stringify(input.body),
    headers: {
      authorization: `Bearer ${input.token}`,
      "content-type": "application/json"
    },
    method: "POST"
  });
  const payload = (await response.json()) as T | { error?: { message?: string } };
  if (!response.ok) {
    throw new TeacherFormalCourseBindingRequestError(
      response.status,
      typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        payload.error?.message
        ? payload.error.message
        : "formal Course binding request failed"
    );
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload) ||
    (payload as { data?: unknown }).data === undefined
  ) {
    throw new TeacherFormalCourseBindingRequestError(
      502,
      "formal Course binding response envelope is invalid"
    );
  }
  return (payload as { data: T }).data;
}

export async function requestTeacherFormalCourseBindingPreview(input: {
  apiBaseUrl: string;
  scenarioPackageReference: TeacherFormalScenarioPackageCatalogDto["candidates"][number]["scenario_package_reference"];
  token: string;
}): Promise<TeacherFormalCourseBindingPreviewDto> {
  return requestTeacherFormalCourseBinding({
    apiBaseUrl: input.apiBaseUrl,
    body: { scenario_package_reference: input.scenarioPackageReference },
    path: "/api/v1/bff/teacher/formal-course-bindings/preview",
    token: input.token
  });
}

export async function requestTeacherFormalCourseCreate(input: {
  apiBaseUrl: string;
  scenarioPackageReference: TeacherFormalScenarioPackageCatalogDto["candidates"][number]["scenario_package_reference"];
  title: string;
  token: string;
}): Promise<TeacherFormalCourseCreateDto> {
  return requestTeacherFormalCourseBinding({
    apiBaseUrl: input.apiBaseUrl,
    body: { scenario_package_reference: input.scenarioPackageReference, title: input.title },
    path: "/api/v1/bff/teacher/formal-courses",
    token: input.token
  });
}

export async function requestTeacherCourseBlueprintCatalog(input: {
  apiBaseUrl: string;
  token: string;
}): Promise<TeacherCourseBlueprintCatalogDto> {
  const response = await fetch(`${input.apiBaseUrl}/api/v1/bff/teacher/course-blueprints`, {
    headers: { authorization: `Bearer ${input.token}` },
    method: "GET"
  });
  const payload = (await response.json()) as {
    data?: TeacherCourseBlueprintCatalogDto;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new TeacherFormalCourseBindingRequestError(
      response.status,
      payload.error?.message ?? "CourseBlueprint catalog request failed"
    );
  if (!payload.data) {
    throw new TeacherFormalCourseBindingRequestError(
      502,
      "CourseBlueprint catalog response envelope is invalid"
    );
  }
  return payload.data;
}

export async function requestTeacherCourseBlueprintReadiness(input: {
  apiBaseUrl: string;
  courseBlueprintReference: TeacherCourseBlueprintCatalogDto["candidates"][number]["course_blueprint_reference"];
  scenarioPackageReference: TeacherFormalScenarioPackageCatalogDto["candidates"][number]["scenario_package_reference"];
  token: string;
}): Promise<TeacherCourseBlueprintReadinessDto> {
  return requestTeacherFormalCourseBinding({
    apiBaseUrl: input.apiBaseUrl,
    body: {
      course_blueprint_reference: input.courseBlueprintReference,
      scenario_package_reference: input.scenarioPackageReference
    },
    path: "/api/v1/bff/teacher/course-blueprints/readiness",
    token: input.token
  });
}

export async function requestTeacherCourseBlueprintCourseCreate(input: {
  apiBaseUrl: string;
  courseBlueprintReference: TeacherCourseBlueprintCatalogDto["candidates"][number]["course_blueprint_reference"];
  scenarioPackageReference: TeacherFormalScenarioPackageCatalogDto["candidates"][number]["scenario_package_reference"];
  title: string;
  token: string;
}): Promise<TeacherCourseBlueprintCourseCreateDto> {
  return requestTeacherFormalCourseBinding({
    apiBaseUrl: input.apiBaseUrl,
    body: {
      course_blueprint_reference: input.courseBlueprintReference,
      scenario_package_reference: input.scenarioPackageReference,
      title: input.title
    },
    path: "/api/v1/bff/teacher/course-blueprint-courses",
    token: input.token
  });
}

export async function requestTeacherCourseBlueprintStudioPreview(input: {
  apiBaseUrl: string;
  courseBlueprintReference: TeacherCourseBlueprintCatalogDto["candidates"][number]["course_blueprint_reference"];
  token: string;
}): Promise<TeacherCourseBlueprintStudioPreview> {
  return requestTeacherFormalCourseBinding({
    apiBaseUrl: input.apiBaseUrl,
    body: { course_blueprint_reference: input.courseBlueprintReference },
    path: "/api/v1/bff/teacher/course-blueprints/studio/preview",
    token: input.token
  });
}

export async function requestTeacherCourseBlueprintStudioDraftCreate(input: {
  apiBaseUrl: string;
  draft: TeacherCourseBlueprintStudioEditableContent;
  sourceCourseBlueprintReference: TeacherCourseBlueprintCatalogDto["candidates"][number]["course_blueprint_reference"];
  token: string;
}): Promise<TeacherCourseBlueprintStudioDraft> {
  return requestTeacherFormalCourseBinding({
    apiBaseUrl: input.apiBaseUrl,
    body: {
      draft: input.draft,
      source_course_blueprint_reference: input.sourceCourseBlueprintReference
    },
    path: "/api/v1/bff/teacher/course-blueprints/studio/drafts",
    token: input.token
  });
}

export async function requestTeacherCourseBlueprintStudioSubmission(input: {
  apiBaseUrl: string;
  courseBlueprintReference: TeacherCourseBlueprintCatalogDto["candidates"][number]["course_blueprint_reference"];
  token: string;
}): Promise<TeacherCourseBlueprintStudioSubmission> {
  return requestTeacherFormalCourseBinding({
    apiBaseUrl: input.apiBaseUrl,
    body: { course_blueprint_reference: input.courseBlueprintReference },
    path: "/api/v1/bff/teacher/course-blueprints/studio/submissions",
    token: input.token
  });
}

export function getTeacherFormalCourseBindingErrorMessage(error: unknown): string {
  if (!(error instanceof TeacherFormalCourseBindingRequestError)) {
    return "Formal Course binding could not be completed.";
  }
  if (error.status === 401) return "Authentication is required to create a formal Course.";
  if (error.status === 403) return "Teacher authority is required to create a formal Course.";
  return "The selected formal ScenarioPackage is no longer available.";
}

export async function requestTeacherFormalScenarioPackageCatalog(input: {
  apiBaseUrl: string;
  token: string;
}): Promise<TeacherFormalScenarioPackageCatalogDto> {
  const response = await fetch(
    `${input.apiBaseUrl}/api/v1/bff/teacher/formal-scenario-package-catalog`,
    {
      headers: { authorization: `Bearer ${input.token}` },
      method: "GET"
    }
  );
  const payload = (await response.json()) as
    | TeacherFormalScenarioPackageCatalogDto
    | { error?: { message?: string } };

  if (!response.ok) {
    throw new TeacherFormalScenarioPackageCatalogRequestError(
      response.status,
      "error" in payload && payload.error?.message
        ? payload.error.message
        : "formal ScenarioPackage catalog request failed"
    );
  }

  return payload as TeacherFormalScenarioPackageCatalogDto;
}

export function getTeacherFormalScenarioPackageCatalogErrorMessage(error: unknown): string {
  if (!(error instanceof TeacherFormalScenarioPackageCatalogRequestError)) {
    return "Formal ScenarioPackage catalog could not be loaded.";
  }
  if (error.status === 401) {
    return "Authentication is required to load the formal ScenarioPackage catalog.";
  }
  if (error.status === 403) {
    return "Teacher authority is required to load the formal ScenarioPackage catalog.";
  }
  return "Formal ScenarioPackage catalog could not be loaded.";
}

export async function requestScenarioPackageCandidates(input: {
  apiBaseUrl: string;
  runId: string;
  token: string;
}): Promise<R7TeacherScenarioPackageCandidatesDto> {
  const response = await fetch(
    `${input.apiBaseUrl}/api/v1/bff/teacher/runs/${encodeURIComponent(input.runId)}/scenario-package-candidates`,
    {
      headers: { authorization: `Bearer ${input.token}` },
      method: "GET"
    }
  );
  const payload = (await response.json()) as
    | R7TeacherScenarioPackageCandidatesDto
    | { error?: { message?: string } };

  if (!response.ok) {
    throw new ScenarioCandidatesRequestError(
      response.status,
      "error" in payload && payload.error?.message
        ? payload.error.message
        : "scenario candidates request failed"
    );
  }

  return payload as R7TeacherScenarioPackageCandidatesDto;
}

export function getScenarioCandidatesErrorMessage(error: unknown): string {
  if (!(error instanceof ScenarioCandidatesRequestError)) {
    return "Scenario candidates could not be loaded.";
  }
  if (error.status === 401) {
    return "Authentication is required to load Scenario candidates.";
  }
  if (error.status === 403) {
    return "Teacher authority is required to load Scenario candidates.";
  }
  if (error.status === 404) {
    return "Scenario candidates are unavailable or out of scope.";
  }
  if (error.status === 503) {
    return "Scenario candidate provider is unavailable.";
  }
  return "Scenario candidates could not be loaded.";
}

export function validateScenarioReadinessInput(input: {
  parameterSetId: string;
  scenarioPackageId: string;
}): string | undefined {
  if (!input.scenarioPackageId.trim()) {
    return "Scenario Package ID is required.";
  }
  if (!input.parameterSetId.trim()) {
    return "ParameterSet ID is required.";
  }
  return undefined;
}

export async function requestScenarioReadiness(input: {
  apiBaseUrl: string;
  parameterSetId: string;
  runId: string;
  scenarioPackageId: string;
  token: string;
}): Promise<ScenarioReadinessResponse> {
  const query = new URLSearchParams({
    parameterSetId: input.parameterSetId.trim(),
    scenarioPackageId: input.scenarioPackageId.trim()
  });
  const response = await fetch(
    `${input.apiBaseUrl}/api/v1/bff/teacher/runs/${encodeURIComponent(input.runId)}/scenario-selection-readiness?${query.toString()}`,
    {
      headers: {
        authorization: `Bearer ${input.token}`
      },
      method: "GET"
    }
  );
  const payload = (await response.json()) as
    | ScenarioReadinessResponse
    | { error?: { message?: string } };

  if (!response.ok) {
    throw new ScenarioReadinessRequestError(
      response.status,
      "error" in payload && payload.error?.message
        ? payload.error.message
        : "readiness request failed"
    );
  }

  return payload as ScenarioReadinessResponse;
}

export function getScenarioReadinessErrorMessage(error: unknown): string {
  if (!(error instanceof ScenarioReadinessRequestError)) {
    return "Readiness could not be loaded.";
  }
  if (error.status === 401) {
    return "Authentication is required to check readiness.";
  }
  if (error.status === 403) {
    return "You are not authorized to check readiness.";
  }
  if (error.status === 404) {
    return "Readiness is unavailable or out of scope.";
  }
  if (error.status === 409) {
    return "Readiness is blocked by the current gate.";
  }
  return "Readiness could not be loaded.";
}
