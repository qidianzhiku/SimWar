import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiEnvelope, CurrentUser, PermissionKey } from "@simwar/shared-contracts";
import type { RepositoryFacade } from "../repository-facade.js";
import {
  ModelQualificationError,
  ModelQualificationService,
  type ModelQualificationActor,
  type ModelQualificationDatasetInput,
  type ModelQualificationRunInput,
  type ModelQualificationScope,
  type ModelQualificationSourceInput
} from "../model-qualification-service.js";

const TEACHER_PREFIX = "/api/v1/bff/teacher/model-qualification";
const ADMIN_PREFIX = "/api/v1/bff/admin/model-qualification";
const STUDENT_PREFIX = "/api/v1/bff/student/model-qualification";
const ACTIVITY_ID = "model-qualification-studio";

interface ModelQualificationRouteContext {
  requestId: string;
  tenantId: string;
  actor?: CurrentUser;
}

interface ModelQualificationRouteDependencies {
  actorHasAnyRole(actor: CurrentUser, roles: readonly string[]): boolean;
  createContext(request: IncomingMessage): ModelQualificationRouteContext;
  createEnvelope<TData>(
    context: ModelQualificationRouteContext,
    data: TData,
    message?: string
  ): ApiEnvelope<TData>;
  readJson<TBody>(request: IncomingMessage, options?: { requiredObject?: boolean }): Promise<TBody>;
  repository: RepositoryFacade;
  requirePermission(
    context: ModelQualificationRouteContext,
    permission: PermissionKey
  ): CurrentUser;
  sendJson(response: ServerResponse, statusCode: number, body: unknown): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function resolveCourseId(body: Record<string, unknown>, url: URL): string {
  const bodyCourseId = stringValue(body.course_id);
  const queryCourseId = stringValue(url.searchParams.get("courseId"));
  if (bodyCourseId && queryCourseId && bodyCourseId !== queryCourseId) {
    throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
  }
  return bodyCourseId || queryCourseId;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? [...value] : [];
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : Number.NaN;
}

function serviceActor(actor: CurrentUser): ModelQualificationActor {
  const role = actor.roles.find((candidate) =>
    ["student", "learner", "teacher", "tenant_admin"].includes(candidate)
  );
  if (!role || !actor.tenant_id)
    throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
  return {
    actor_id: actor.user_id,
    role: role as ModelQualificationActor["role"],
    tenant_id: actor.tenant_id
  };
}

function scope(context: ModelQualificationRouteContext, courseId: string): ModelQualificationScope {
  if (!courseId) throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
  return { activity_id: ACTIVITY_ID, course_id: courseId, tenant_id: context.tenantId };
}

async function assertCourse(
  deps: ModelQualificationRouteDependencies,
  context: ModelQualificationRouteContext,
  courseId: string
): Promise<void> {
  const course = await deps.repository.courses.getCourse(context.tenantId, courseId);
  if (!course || course.tenant_id !== context.tenantId) {
    throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
  }
}

function send<TData>(
  deps: ModelQualificationRouteDependencies,
  context: ModelQualificationRouteContext,
  response: ServerResponse,
  statusCode: number,
  data: TData
): void {
  deps.sendJson(response, statusCode, deps.createEnvelope(context, data));
}

function qualificationId(pathname: string, suffix: "review" | "bind"): string | undefined {
  return pathname.match(new RegExp(`^${TEACHER_PREFIX}/qualifications/([^/]+)/${suffix}$`))?.[1];
}

function requalificationPreviewId(pathname: string, suffix: "review"): string | undefined {
  return pathname.match(
    new RegExp(`^${TEACHER_PREFIX}/requalification-previews/([^/]+)/${suffix}$`)
  )?.[1];
}

export function isModelQualificationRoute(method: string | undefined, url: URL): boolean {
  if (method === "GET") {
    return (
      url.pathname === `${TEACHER_PREFIX}` ||
      url.pathname === `${ADMIN_PREFIX}` ||
      url.pathname === `${STUDENT_PREFIX}`
    );
  }
  if (method !== "POST") return false;
  return (
    url.pathname === `${TEACHER_PREFIX}/source-packages` ||
    url.pathname === `${TEACHER_PREFIX}/datasets` ||
    url.pathname === `${TEACHER_PREFIX}/qualifications` ||
    url.pathname === `${TEACHER_PREFIX}/requalification-previews` ||
    qualificationId(url.pathname, "review") !== undefined ||
    qualificationId(url.pathname, "bind") !== undefined ||
    requalificationPreviewId(url.pathname, "review") !== undefined
  );
}

export async function handleModelQualificationRoute(
  service: ModelQualificationService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  deps: ModelQualificationRouteDependencies
): Promise<boolean> {
  if (!isModelQualificationRoute(request.method, url)) return false;
  const context = deps.createContext(request);

  if (request.method === "GET" && url.pathname === `${TEACHER_PREFIX}`) {
    const actor = deps.requirePermission(context, "course:read");
    if (actor.tenant_id !== context.tenantId || !deps.actorHasAnyRole(actor, ["teacher"])) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
    }
    const courseId = stringValue(url.searchParams.get("courseId"));
    await assertCourse(deps, context, courseId);
    send(
      deps,
      context,
      response,
      200,
      service.getTeacherProjection(serviceActor(actor), scope(context, courseId))
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === `${ADMIN_PREFIX}`) {
    const actor = deps.requirePermission(context, "course:read");
    if (actor.tenant_id !== context.tenantId || !deps.actorHasAnyRole(actor, ["tenant_admin"])) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
    }
    const courseId = stringValue(url.searchParams.get("courseId"));
    await assertCourse(deps, context, courseId);
    send(
      deps,
      context,
      response,
      200,
      service.getAdminProjection(serviceActor(actor), scope(context, courseId))
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === `${STUDENT_PREFIX}`) {
    const actor = deps.requirePermission(context, "course:read");
    if (
      actor.tenant_id !== context.tenantId ||
      !deps.actorHasAnyRole(actor, ["student", "learner"])
    ) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
    }
    const courseId = stringValue(url.searchParams.get("courseId"));
    const qualification = stringValue(url.searchParams.get("qualificationId"));
    await assertCourse(deps, context, courseId);
    const visibleCourses = await deps.repository.courses.listCoursesForUser(
      context.tenantId,
      actor.user_id
    );
    if (!visibleCourses.some((course) => course.course_id === courseId)) {
      throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
    }
    if (!qualification) throw new ModelQualificationError("MODEL_QUALIFICATION_NOT_FOUND");
    send(
      deps,
      context,
      response,
      200,
      service.getStudentProjection(serviceActor(actor), scope(context, courseId), qualification)
    );
    return true;
  }

  const actor = deps.requirePermission(context, "course:read");
  if (actor.tenant_id !== context.tenantId || !deps.actorHasAnyRole(actor, ["teacher"])) {
    throw new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT");
  }
  const body = await deps.readJson<Record<string, unknown>>(request, {
    requiredObject: !url.pathname.endsWith("/bind")
  });
  const bodyRecord = isRecord(body) ? body : {};
  if (url.pathname === `${TEACHER_PREFIX}/qualifications` && "diagnostics" in bodyRecord) {
    throw new ModelQualificationError("MODEL_QUALIFICATION_DIAGNOSTICS_INVALID");
  }
  const courseId = resolveCourseId(bodyRecord, url);
  await assertCourse(deps, context, courseId);
  const serviceScope = scope(context, courseId);

  if (url.pathname === `${TEACHER_PREFIX}/source-packages`) {
    const quality = isRecord(bodyRecord.quality) ? bodyRecord.quality : {};
    const input: ModelQualificationSourceInput = {
      content_digest: stringValue(bodyRecord.content_digest),
      evidence_refs: stringArray(bodyRecord.evidence_refs),
      expires_at:
        bodyRecord.expires_at === null ||
        bodyRecord.expires_at === undefined ||
        bodyRecord.expires_at === ""
          ? null
          : stringValue(bodyRecord.expires_at),
      feature_schema_digest: stringValue(bodyRecord.feature_schema_digest),
      freshness_status:
        bodyRecord.freshness_status as ModelQualificationSourceInput["freshness_status"],
      observed_at: stringValue(bodyRecord.observed_at),
      quality: {
        conflict_count: numberValue(quality.conflict_count),
        missingness_rate: numberValue(quality.missingness_rate),
        record_count: numberValue(quality.record_count)
      },
      rights_status: bodyRecord.rights_status as ModelQualificationSourceInput["rights_status"],
      source_ref: stringValue(bodyRecord.source_ref),
      source_version: stringValue(bodyRecord.source_version),
      title: stringValue(bodyRecord.title)
    };
    send(
      deps,
      context,
      response,
      201,
      service.registerSourcePackage(serviceActor(actor), serviceScope, input)
    );
    return true;
  }

  if (url.pathname === `${TEACHER_PREFIX}/datasets`) {
    const input: ModelQualificationDatasetInput = {
      calibration_record_ids: stringArray(bodyRecord.calibration_record_ids),
      content_digest: stringValue(bodyRecord.content_digest),
      holdout_record_ids: stringArray(bodyRecord.holdout_record_ids),
      source_package_id: stringValue(bodyRecord.source_package_id)
    };
    send(
      deps,
      context,
      response,
      201,
      service.createCalibrationDataset(serviceActor(actor), serviceScope, input)
    );
    return true;
  }

  if (url.pathname === `${TEACHER_PREFIX}/qualifications`) {
    const reference = isRecord(bodyRecord.model_version_reference)
      ? bodyRecord.model_version_reference
      : {};
    const input: ModelQualificationRunInput = {
      calibration_dataset_id: stringValue(bodyRecord.calibration_dataset_id),
      deterministic_seed: numberValue(bodyRecord.deterministic_seed),
      model_version_reference: {
        content_digest: stringValue(reference.content_digest),
        model_version_id: stringValue(reference.model_version_id),
        version: stringValue(reference.version)
      },
      source_package_id: stringValue(bodyRecord.source_package_id)
    };
    send(
      deps,
      context,
      response,
      201,
      service.runQualification(serviceActor(actor), serviceScope, input)
    );
    return true;
  }

  if (url.pathname === `${TEACHER_PREFIX}/requalification-previews`) {
    const baselineSourcePackageId = stringValue(bodyRecord.baseline_source_package_id);
    const candidateSourcePackageId = stringValue(bodyRecord.candidate_source_package_id);
    send(
      deps,
      context,
      response,
      201,
      service.createRequalificationPreview(serviceActor(actor), serviceScope, {
        baseline_source_package_id: baselineSourcePackageId,
        candidate_source_package_id: candidateSourcePackageId
      })
    );
    return true;
  }

  const reviewId = qualificationId(url.pathname, "review");
  if (reviewId) {
    if (bodyRecord.decision !== "APPROVED" && bodyRecord.decision !== "REJECTED") {
      throw new ModelQualificationError("MODEL_QUALIFICATION_REVIEW_INVALID");
    }
    const decision = bodyRecord.decision;
    send(
      deps,
      context,
      response,
      200,
      service.reviewQualification(serviceActor(actor), serviceScope, reviewId, {
        decision,
        note: stringValue(bodyRecord.note)
      })
    );
    return true;
  }

  const bindId = qualificationId(url.pathname, "bind");
  if (bindId) {
    send(
      deps,
      context,
      response,
      200,
      service.bindQualification(serviceActor(actor), serviceScope, bindId)
    );
    return true;
  }

  const previewId = requalificationPreviewId(url.pathname, "review");
  if (previewId) {
    if (bodyRecord.decision !== "APPROVED" && bodyRecord.decision !== "REJECTED") {
      throw new ModelQualificationError("MODEL_QUALIFICATION_REVIEW_INVALID");
    }
    send(
      deps,
      context,
      response,
      200,
      service.reviewRequalificationPreview(serviceActor(actor), serviceScope, previewId, {
        decision: bodyRecord.decision,
        note: stringValue(bodyRecord.note)
      })
    );
    return true;
  }

  return false;
}

export { ModelQualificationError };
