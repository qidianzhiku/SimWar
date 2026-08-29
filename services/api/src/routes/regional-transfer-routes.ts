import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  ApiEnvelope,
  CurrentUser,
  PermissionKey,
  RegionalTransferCandidateInput
} from "@simwar/shared-contracts";
import {
  RegionalTransferProductError,
  RegionalTransferProductService,
  type RegionalTransferActor
} from "../regional-transfer-product-service.js";

interface RegionalTransferRouteContext {
  requestId: string;
  tenantId: string;
}

interface RegionalTransferRouteDependencies {
  createContext(request: IncomingMessage): RegionalTransferRouteContext;
  createEnvelope<TData>(
    context: RegionalTransferRouteContext,
    data: TData,
    message?: string
  ): ApiEnvelope<TData>;
  readJson(
    request: IncomingMessage,
    options?: { requiredObject?: boolean }
  ): Promise<Record<string, unknown>>;
  requirePermission(context: RegionalTransferRouteContext, permission: PermissionKey): CurrentUser;
  assertStudentCourseScope?: (
    tenantId: string,
    userId: string,
    teamId: string,
    courseId: string
  ) => Promise<boolean>;
  resolveSelection?: (
    tenantId: string,
    query: { courseId: string; runId: string; roundNo: number }
  ) => Promise<RegionalTransferCandidateInput>;
  sendJson(response: ServerResponse, statusCode: number, body: unknown): void;
}

const TEACHER_PREFIX = "/api/v1/bff/teacher/regional-transfer";
const STUDENT_PREFIX = "/api/v1/bff/student/regional-transfer";
const ADMIN_PREFIX = "/api/v1/bff/admin/regional-transfer";

function actorFor(user: CurrentUser, tenantId: string): RegionalTransferActor {
  return {
    actor_id: user.user_id,
    tenant_id: tenantId,
    ...(user.team_id ? { team_id: user.team_id } : {})
  };
}

function hasRole(user: CurrentUser, roles: readonly string[]): boolean {
  return user.roles.some((role) => roles.includes(role));
}

function assertActor(
  deps: RegionalTransferRouteDependencies,
  context: RegionalTransferRouteContext,
  kind: "teacher" | "student" | "admin"
): CurrentUser {
  const actor = deps.requirePermission(context, "course:read");
  const allowed =
    kind === "teacher"
      ? hasRole(actor, ["teacher", "tenant_admin", "platform_admin"])
      : kind === "student"
        ? hasRole(actor, ["learner", "student"])
        : hasRole(actor, ["tenant_admin", "platform_admin"]);
  if (!allowed || (actor.tenant_id !== context.tenantId && !hasRole(actor, ["platform_admin"]))) {
    throw new RegionalTransferProductError("RT_SCOPE_CONFLICT");
  }
  return actor;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function candidateInput(body: Record<string, unknown>): RegionalTransferCandidateInput {
  if (!isRecord(body.baseline_package_reference) || !isRecord(body.course_blueprint_reference)) {
    throw new RegionalTransferProductError("RT_INPUT_INVALID");
  }
  return body as unknown as RegionalTransferCandidateInput;
}

function statusFor(code: string): number {
  if (code === "RT_CANDIDATE_NOT_FOUND" || code === "RT_PACKAGE_NOT_FOUND") return 404;
  if (code === "RT_SCOPE_CONFLICT") return 403;
  if (code === "RT_INVALID_TRANSITION" || code === "RT_PACKAGE_DIGEST_MISMATCH") return 409;
  if (code === "RT_NOT_PUBLISHED") return 403;
  return 422;
}

export function isRegionalTransferRoute(method: string | undefined, url: URL): boolean {
  return (
    (method === "GET" || method === "POST") &&
    /^\/api\/v1\/bff\/(?:teacher|student|admin)\/regional-transfer(?:\/.*)?$/u.test(url.pathname)
  );
}

export async function handleRegionalTransferRoute(
  service: RegionalTransferProductService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  deps: RegionalTransferRouteDependencies
): Promise<boolean> {
  if (!isRegionalTransferRoute(request.method, url)) return false;

  const context = deps.createContext(request);
  try {
    if (url.pathname === `${TEACHER_PREFIX}/selection` && request.method === "GET") {
      const actor = assertActor(deps, context, "teacher");
      if (!deps.resolveSelection) throw new RegionalTransferProductError("RT_SOURCE_NOT_BINDABLE");
      const courseId = url.searchParams.get("courseId")?.trim() ?? "";
      const runId = url.searchParams.get("runId")?.trim() ?? "";
      const roundNo = Number(url.searchParams.get("roundNo"));
      if (!courseId || !runId || !Number.isSafeInteger(roundNo)) {
        throw new RegionalTransferProductError("RT_INPUT_INVALID");
      }
      const input = await deps.resolveSelection(context.tenantId, { courseId, runId, roundNo });
      deps.sendJson(
        response,
        200,
        deps.createEnvelope(context, { actor_id: actor.user_id, input })
      );
      return true;
    }

    if (url.pathname === TEACHER_PREFIX && request.method === "GET") {
      const actor = assertActor(deps, context, "teacher");
      deps.sendJson(
        response,
        200,
        deps.createEnvelope(context, await service.list(actorFor(actor, context.tenantId)))
      );
      return true;
    }

    if (url.pathname === `${TEACHER_PREFIX}/preview` && request.method === "POST") {
      const actor = assertActor(deps, context, "teacher");
      const result = await service.preview(
        actorFor(actor, context.tenantId),
        candidateInput(await deps.readJson(request, { requiredObject: true }))
      );
      deps.sendJson(response, 200, deps.createEnvelope(context, result));
      return true;
    }

    if (url.pathname === `${TEACHER_PREFIX}/validate` && request.method === "POST") {
      const actor = assertActor(deps, context, "teacher");
      const result = await service.validate(
        actorFor(actor, context.tenantId),
        candidateInput(await deps.readJson(request, { requiredObject: true }))
      );
      deps.sendJson(response, 200, deps.createEnvelope(context, result));
      return true;
    }

    if (url.pathname === `${TEACHER_PREFIX}/freeze` && request.method === "POST") {
      const actor = assertActor(deps, context, "teacher");
      const result = await service.freeze(
        actorFor(actor, context.tenantId),
        candidateInput(await deps.readJson(request, { requiredObject: true }))
      );
      deps.sendJson(
        response,
        201,
        deps.createEnvelope(context, result, "regional transfer candidate frozen")
      );
      return true;
    }

    const bindMatch = new RegExp(`^${TEACHER_PREFIX}/candidates/([^/]+)/bind$`, "u").exec(
      url.pathname
    );
    if (bindMatch?.[1] && request.method === "POST") {
      const actor = assertActor(deps, context, "teacher");
      const result = await service.bind(actorFor(actor, context.tenantId), bindMatch[1]);
      deps.sendJson(
        response,
        200,
        deps.createEnvelope(context, result, "regional transfer candidate activated")
      );
      return true;
    }

    const studentMatch = new RegExp(`^${STUDENT_PREFIX}/candidates/([^/]+)$`, "u").exec(
      url.pathname
    );
    if (studentMatch?.[1] && request.method === "GET") {
      const actor = assertActor(deps, context, "student");
      const result = await service.student(actorFor(actor, context.tenantId), studentMatch[1]);
      if (
        !actor.team_id ||
        !deps.assertStudentCourseScope ||
        !(await deps.assertStudentCourseScope(
          context.tenantId,
          actor.user_id,
          actor.team_id,
          result.context.course_id
        ))
      ) {
        throw new RegionalTransferProductError("RT_SCOPE_CONFLICT");
      }
      deps.sendJson(response, 200, deps.createEnvelope(context, result));
      return true;
    }

    const adminMatch = new RegExp(`^${ADMIN_PREFIX}/candidates/([^/]+)$`, "u").exec(url.pathname);
    if (adminMatch?.[1] && request.method === "GET") {
      const actor = assertActor(deps, context, "admin");
      const result = await service.admin(actorFor(actor, context.tenantId), adminMatch[1]);
      deps.sendJson(response, 200, deps.createEnvelope(context, result));
      return true;
    }

    return false;
  } catch (error) {
    if (!(error instanceof RegionalTransferProductError)) throw error;
    deps.sendJson(response, statusFor(error.code), {
      request_id: context.requestId,
      code: error.code,
      message: "regional transfer operation rejected",
      details: []
    });
    return true;
  }
}
