import type { IncomingMessage, ServerResponse } from "node:http";
import type { CurrentUser, GSIRequest } from "@simwar/shared-contracts";
import type { GSICrossRoundComparisonQuery } from "../gsi-stakeholder-shadow-plane-service.js";
import { isGSIRequest } from "@simwar/shared-contracts";
import {
  GSIStakeholderShadowPlaneError,
  type GSIStakeholderShadowPlaneService
} from "../gsi-stakeholder-shadow-plane-service.js";

const TEACHER_PREFIX = "/api/v1/bff/teacher/gsi";
const STUDENT_PREFIX = "/api/v1/bff/student/gsi";
const ADMIN_PREFIX = "/api/v1/bff/admin/gsi";

export interface GSIRouteContext {
  requestId: string;
  tenantId: string;
  actor: CurrentUser;
}

export interface GSIRouteHelpers {
  readJson(request: IncomingMessage): Promise<unknown>;
  sendJson(response: ServerResponse, status: number, payload: unknown): void;
  createEnvelope(context: GSIRouteContext, payload: unknown): unknown;
  requireStudent(context: GSIRouteContext): void;
  requireTeacher(context: GSIRouteContext): void;
  requireAdmin(context: GSIRouteContext): void;
}

function candidateId(pathname: string, prefix: string): string | null {
  const match = pathname.match(new RegExp(`^${prefix}/candidates/([^/]+)$`));
  return match?.[1] ?? null;
}

function isComparePath(pathname: string, prefix: string): boolean {
  return pathname === `${prefix}/candidates/compare`;
}

function exactQueryValue(url: URL, name: string): string {
  const value = url.searchParams.get(name);
  if (
    !value ||
    value.trim() !== value ||
    ["latest", "current", "default", "fallback", "first", "last", "newest"].includes(
      value.toLowerCase()
    )
  ) {
    throw new GSIStakeholderShadowPlaneError("GSI_INPUT_INVALID");
  }
  return value;
}

function parseComparisonQuery(url: URL): GSICrossRoundComparisonQuery {
  const expectedComparisonDigest = url.searchParams.get("expected_comparison_digest") ?? undefined;
  const expectedContextDigest = url.searchParams.get("expected_context_digest") ?? undefined;
  if (
    (expectedComparisonDigest && !/^[a-f0-9]{64}$/u.test(expectedComparisonDigest)) ||
    (expectedContextDigest && !/^[a-f0-9]{64}$/u.test(expectedContextDigest))
  ) {
    throw new GSIStakeholderShadowPlaneError("GSI_INPUT_INVALID");
  }
  return {
    from_candidate_id: exactQueryValue(url, "from_candidate_id"),
    to_candidate_id: exactQueryValue(url, "to_candidate_id"),
    activity_id: exactQueryValue(url, "activity_id"),
    role_key: exactQueryValue(url, "role_key"),
    ...(expectedComparisonDigest ? { expected_comparison_digest: expectedComparisonDigest } : {}),
    ...(expectedContextDigest ? { expected_context_digest: expectedContextDigest } : {})
  };
}

function parseRequest(value: unknown): GSIRequest {
  if (!isGSIRequest(value)) {
    throw new GSIStakeholderShadowPlaneError("GSI_INPUT_INVALID");
  }
  return value;
}

function errorStatus(error: GSIStakeholderShadowPlaneError): number {
  if (error.code === "GSI_FORBIDDEN") return 403;
  if (error.code === "GSI_CONTEXT_NOT_FOUND" || error.code === "GSI_NOT_FOUND") return 404;
  if (error.code === "GSI_NOT_PUBLISHED") return 409;
  if (error.code === "GSI_DUPLICATE_CONFLICT") return 409;
  if (error.code === "GSI_REBASE_REQUIRED" || error.code === "GSI_CONTEXT_UNAVAILABLE") return 409;
  return 422;
}

export async function handleGSIStakeholderShadowPlaneRoute(
  service: GSIStakeholderShadowPlaneService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: GSIRouteContext,
  helpers: GSIRouteHelpers
): Promise<boolean> {
  const isTeacher = url.pathname.startsWith(TEACHER_PREFIX);
  const isStudent = url.pathname.startsWith(STUDENT_PREFIX);
  const isAdmin = url.pathname.startsWith(ADMIN_PREFIX);
  if (!isTeacher && !isStudent && !isAdmin) return false;
  try {
    if (isTeacher) {
      helpers.requireTeacher(context);
      if (request.method === "POST" && url.pathname === `${TEACHER_PREFIX}/candidates`) {
        const receipt = await service.createCandidate(
          context.actor,
          parseRequest(await helpers.readJson(request)),
          context.requestId
        );
        helpers.sendJson(response, 201, helpers.createEnvelope(context, receipt));
        return true;
      }
      if (request.method === "GET" && isComparePath(url.pathname, TEACHER_PREFIX)) {
        const projection = await service.compareCandidates(
          context.actor,
          parseComparisonQuery(url)
        );
        helpers.sendJson(response, 200, helpers.createEnvelope(context, projection));
        return true;
      }
      const id = candidateId(url.pathname, TEACHER_PREFIX);
      if (request.method === "GET" && id) {
        const receipt = await service.getTeacherReceipt(context.actor, id, context.requestId);
        helpers.sendJson(response, 200, helpers.createEnvelope(context, receipt));
        return true;
      }
      throw new GSIStakeholderShadowPlaneError("GSI_INPUT_INVALID");
    }
    if (isStudent) {
      helpers.requireStudent(context);
      if (request.method === "GET" && isComparePath(url.pathname, STUDENT_PREFIX)) {
        const projection = await service.compareCandidates(
          context.actor,
          parseComparisonQuery(url)
        );
        helpers.sendJson(response, 200, helpers.createEnvelope(context, projection));
        return true;
      }
      const id = candidateId(url.pathname, STUDENT_PREFIX);
      if (request.method === "GET" && id) {
        const projection = await service.getStudentProjection(context.actor, id);
        helpers.sendJson(response, 200, helpers.createEnvelope(context, projection));
        return true;
      }
      throw new GSIStakeholderShadowPlaneError("GSI_INPUT_INVALID");
    }
    helpers.requireAdmin(context);
    if (request.method === "GET" && isComparePath(url.pathname, ADMIN_PREFIX)) {
      const projection = await service.compareCandidates(context.actor, parseComparisonQuery(url));
      helpers.sendJson(response, 200, helpers.createEnvelope(context, projection));
      return true;
    }
    if (request.method === "GET" && url.pathname === `${ADMIN_PREFIX}/audit`) {
      const id = url.searchParams.get("candidate_id");
      if (!id) throw new GSIStakeholderShadowPlaneError("GSI_INPUT_INVALID");
      const projection = await service.getAdminProjection(context.actor, context.tenantId, id);
      helpers.sendJson(response, 200, helpers.createEnvelope(context, projection));
      return true;
    }
    throw new GSIStakeholderShadowPlaneError("GSI_INPUT_INVALID");
  } catch (error) {
    const mapped =
      error instanceof GSIStakeholderShadowPlaneError
        ? error
        : new GSIStakeholderShadowPlaneError("GSI_INPUT_INVALID");
    helpers.sendJson(
      response,
      errorStatus(mapped),
      helpers.createEnvelope(context, {
        code: mapped.code,
        message: "governed stakeholder shadow request rejected"
      })
    );
    return true;
  }
}
