import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  ApiEnvelope,
  CurrentUser,
  DisposeEvidenceAdoption,
  PermissionKey,
  ValidationEnvironmentLaunch
} from "@simwar/shared-contracts";
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
  getLegacyAdmissionLaunch?(
    tenantId: string,
    launchId: string
  ): Promise<ValidationEnvironmentLaunch | null>;
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
  if (
    method === "POST" &&
    /^\/api\/v1\/bff\/(teacher|admin)\/model-qualification\/evidence-adoptions\/(request|review|disposition)$/.test(
      url.pathname
    )
  )
    return true;
  if (
    method === "GET" &&
    /^\/api\/v1\/bff\/(teacher|admin)\/model-qualification\/run-admissions\/[^/]+$/.test(
      url.pathname
    )
  )
    return true;
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

  const adoptionRoute = url.pathname.match(
    /^\/api\/v1\/bff\/(teacher|admin)\/model-qualification\/(evidence-adoptions\/(request|review|disposition)|run-admissions\/([^/]+))$/
  );
  if (adoptionRoute) {
    const actor = deps.requirePermission(context, "course:read");
    const role = adoptionRoute[1] === "admin" ? "tenant_admin" : "teacher";
    if (actor.tenant_id !== context.tenantId || !deps.actorHasAnyRole(actor, [role]))
      throw new Error("EVIDENCE_ADOPTION_ROLE_DENIED");
    const body =
      request.method === "POST"
        ? await deps.readJson<Record<string, unknown>>(request, { requiredObject: true })
        : {};
    if (!isRecord(body)) throw new Error("EVIDENCE_ADOPTION_INPUT_INVALID");
    if (request.method === "POST") {
      const actionKeys =
        adoptionRoute[3] === "request"
          ? ["course_id", "command_id", "qualification_id", "expected_adoption"]
          : adoptionRoute[3] === "review"
            ? ["course_id", "command_id", "proposal_id", "proposal_digest", "decision", "note"]
            : [
                "course_id",
                "command_id",
                "proposal_id",
                "proposal_digest",
                "disposition",
                "expires_at",
                "note"
              ];
      if (
        Object.keys(body).length !== actionKeys.length ||
        actionKeys.some((key) => !Object.hasOwn(body, key))
      )
        throw new Error("EVIDENCE_ADOPTION_INPUT_INVALID");
      if (
        adoptionRoute[3] === "request" &&
        isRecord(body.expected_adoption) &&
        (Object.keys(body.expected_adoption).length !== 2 ||
          !Object.hasOwn(body.expected_adoption, "adoption_id") ||
          !Object.hasOwn(body.expected_adoption, "adoption_digest"))
      )
        throw new Error("EVIDENCE_ADOPTION_INPUT_INVALID");
    }
    if (
      ["tenant_id", "actor_id", "epoch", "adoption_id", "adoption_digest"].some((key) =>
        Object.hasOwn(body, key)
      )
    )
      throw new Error("EVIDENCE_ADOPTION_INPUT_INVALID");
    const courseId = resolveCourseId(body, url);
    await assertCourse(deps, context, courseId);
    const selectedScope = scope(context, courseId);
    const selectedActor: ModelQualificationActor = {
      actor_id: actor.user_id,
      tenant_id: context.tenantId,
      role
    };
    if (request.method === "GET") {
      const runId = adoptionRoute[4]!;
      const run = await deps.repository.runs.getRun(context.tenantId, runId);
      if (!run || run.course_id !== courseId) throw new Error("HISTORICAL_REFERENCE_UNAVAILABLE");
      const snapshot = await deps.repository.runs.getQualifiedRunAdmission(context.tenantId, runId);
      if (snapshot)
        send(
          deps,
          context,
          response,
          200,
          service.resolveHistoricalAdmission(selectedActor, selectedScope, snapshot)
        );
      else {
        const launchId = url.searchParams.get("launchId");
        const launch = launchId
          ? await deps.getLegacyAdmissionLaunch?.(context.tenantId, launchId)
          : null;
        if (
          !launch ||
          launch.tenant_id !== context.tenantId ||
          launch.course_id !== courseId ||
          launch.run_id !== runId ||
          !launch.qualified_run_admission_receipt ||
          "schema_version" in launch.qualified_run_admission_receipt ||
          "adoption" in launch.qualified_run_admission_receipt
        )
          throw new Error("HISTORICAL_REFERENCE_UNAVAILABLE");
        // Return the exact stored v1 receipt; never synthesize an O5 adoption.
        send(deps, context, response, 200, {
          historical_schema: "qualified-run-admission.v1",
          run_id: runId,
          admission: launch.qualified_run_admission_receipt
        });
      }
      return true;
    }
    const command_id = stringValue(body.command_id);
    if (adoptionRoute[3] === "request") {
      if (body.expected_adoption !== null && !isRecord(body.expected_adoption))
        throw new Error("EVIDENCE_ADOPTION_EXPLICIT_PREDECESSOR_REQUIRED");
      const expected =
        body.expected_adoption === null
          ? null
          : {
              adoption_id: stringValue(
                (body.expected_adoption as Record<string, unknown>).adoption_id
              ),
              adoption_digest: stringValue(
                (body.expected_adoption as Record<string, unknown>).adoption_digest
              )
            };
      send(
        deps,
        context,
        response,
        200,
        service.requestEvidenceAdoption(selectedActor, selectedScope, {
          command_id,
          qualification_id: stringValue(body.qualification_id),
          expected_adoption: expected
        })
      );
    } else if (adoptionRoute[3] === "review") {
      if (body.decision !== "APPROVED" && body.decision !== "REJECTED")
        throw new Error("EVIDENCE_ADOPTION_REVIEW_INVALID");
      send(
        deps,
        context,
        response,
        200,
        service.reviewEvidenceAdoption(selectedActor, selectedScope, {
          command_id,
          proposal_id: stringValue(body.proposal_id),
          proposal_digest: stringValue(body.proposal_digest),
          decision: body.decision,
          note: stringValue(body.note)
        })
      );
    } else {
      const allowed = [
        "ADOPTED_FOR_FUTURE_ADMISSION",
        "DEFERRED_WITH_EXPIRY",
        "REJECTED_CANDIDATE",
        "REBASE_REQUIRED"
      ];
      if (
        !allowed.includes(stringValue(body.disposition)) ||
        !(body.expires_at === null || typeof body.expires_at === "string")
      )
        throw new Error("EVIDENCE_ADOPTION_DISPOSITION_INVALID");
      send(
        deps,
        context,
        response,
        200,
        service.disposeEvidenceAdoption(selectedActor, selectedScope, {
          command_id,
          proposal_id: stringValue(body.proposal_id),
          proposal_digest: stringValue(body.proposal_digest),
          disposition: body.disposition as DisposeEvidenceAdoption["disposition"],
          expires_at: body.expires_at,
          note: stringValue(body.note)
        })
      );
    }
    return true;
  }

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
