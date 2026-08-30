import type { IncomingMessage, ServerResponse } from "node:http";
import type { CurrentUser, PermissionKey } from "@simwar/shared-contracts";
import {
  CanServiceFeasibilityServiceError,
  type CanServiceFeasibilityRequest,
  type CanServiceFeasibilityService
} from "../can-service-feasibility-service.js";

interface CanRouteContext {
  readonly requestId: string;
  readonly tenantId: string;
}

interface CanRouteHelpers {
  readonly createEnvelope: (
    context: CanRouteContext,
    payload: unknown,
    message?: string
  ) => unknown;
  readonly requirePermission: (context: CanRouteContext, permission: PermissionKey) => CurrentUser;
  readonly sendJson: (response: ServerResponse, status: number, payload: unknown) => void;
}

const ROUTE = /^\/api\/v1\/bff\/(teacher|student|admin)\/can\/service-feasibility$/;
const EXACT_ID = /^[A-Za-z0-9]+(?:[._:@+-][A-Za-z0-9]+)*$/u;
const BANNED_ID =
  /(?:^|[._:@+-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:@+-])/iu;

export function isCanServiceFeasibilityRoute(method: string | undefined, url: URL): boolean {
  return method === "GET" && ROUTE.test(url.pathname);
}

function validId(value: string | null): value is string {
  return value !== null && value.trim() === value && EXACT_ID.test(value) && !BANNED_ID.test(value);
}

function parseRequest(
  surface: "teacher" | "student" | "admin",
  url: URL,
  tenantId: string
): CanServiceFeasibilityRequest {
  const courseId = url.searchParams.get("courseId");
  const draftId = url.searchParams.get("draftId");
  const runId = url.searchParams.get("runId");
  const roundId = url.searchParams.get("roundId");
  const rawRoundNo = url.searchParams.get("roundNo");
  const roundNo = rawRoundNo === null ? NaN : Number(rawRoundNo);
  if (
    !validId(courseId) ||
    !validId(draftId) ||
    !validId(runId) ||
    !validId(roundId) ||
    !Number.isSafeInteger(roundNo) ||
    roundNo < 1 ||
    !validId(tenantId)
  ) {
    throw new CanServiceFeasibilityServiceError("R1_EXACT_CONTEXT_REQUIRED");
  }
  return {
    course_id: courseId,
    draft_id: draftId,
    round_id: roundId,
    round_no: roundNo,
    run_id: runId,
    surface,
    tenant_id: tenantId
  };
}

function roleAllowed(surface: "teacher" | "student" | "admin", actor: CurrentUser): boolean {
  if (surface === "teacher") return actor.roles.includes("teacher");
  if (surface === "student") {
    return (
      actor.roles.some((role) => ["learner", "student", "team_captain"].includes(role)) &&
      Boolean(actor.team_id)
    );
  }
  return actor.roles.some((role) => ["tenant_admin", "admin", "platform_admin"].includes(role));
}

function status(error: CanServiceFeasibilityServiceError): number {
  switch (error.code) {
    case "R1_SCOPE_CONFLICT":
      return 403;
    case "R1_SOURCE_NOT_READY":
      return 404;
    case "R1_EXACT_CONTEXT_REQUIRED":
      return 409;
    case "R1_CONTEXT_INVALID":
      return 422;
    case "R1_OUTPUT_INVALID":
      return 500;
  }
}

export async function handleCanServiceFeasibilityRoute(
  service: CanServiceFeasibilityService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: CanRouteContext & { readonly actor?: CurrentUser },
  helpers: CanRouteHelpers
): Promise<boolean> {
  if (!isCanServiceFeasibilityRoute(request.method, url)) return false;
  const match = url.pathname.match(ROUTE);
  if (!match?.[1]) return false;
  const surface = match[1] as "teacher" | "student" | "admin";
  const actor = helpers.requirePermission(context, "course:read");
  if (
    !roleAllowed(surface, actor) ||
    (surface !== "admin" && actor.tenant_id !== context.tenantId)
  ) {
    throw new CanServiceFeasibilityServiceError("R1_SCOPE_CONFLICT");
  }
  try {
    const request = parseRequest(surface, url, context.tenantId);
    const payload = await service.get({
      actor: {
        roles: actor.roles,
        tenant_id: actor.tenant_id,
        ...(actor.team_id ? { team_id: actor.team_id } : {}),
        user_id: actor.user_id
      },
      request
    });
    helpers.sendJson(
      response,
      200,
      helpers.createEnvelope(context, payload, "CAN service-feasibility candidate ready")
    );
  } catch (error) {
    if (!(error instanceof CanServiceFeasibilityServiceError)) throw error;
    helpers.sendJson(response, status(error), {
      code: error.code,
      message: error.code,
      request_id: context.requestId
    });
  }
  return true;
}
