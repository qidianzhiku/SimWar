import type { IncomingMessage, ServerResponse } from "node:http";
import type { CurrentUser } from "@simwar/shared-contracts";
import {
  O4CrossRoundDynamicsServiceError,
  type O4CrossRoundDynamicsRequest,
  type O4CrossRoundDynamicsService
} from "../o4-cross-round-dynamics.js";

interface O4RouteContext {
  readonly requestId: string;
  readonly tenantId: string;
}

interface O4RouteHelpers {
  readonly createEnvelope: (context: O4RouteContext, payload: unknown, message?: string) => unknown;
  readonly requireStudent: () => CurrentUser;
  readonly requireTeacher: () => CurrentUser;
  readonly requireAdmin: () => CurrentUser;
  readonly sendJson: (response: ServerResponse, status: number, payload: unknown) => void;
}

const ROUTE = /^\/api\/v1\/bff\/(teacher|student|admin)\/o4\/runs\/([^/]+)\/cross-round-dynamics$/;

export function isO4CrossRoundDynamicsRoute(method: string | undefined, url: URL): boolean {
  return method === "GET" && ROUTE.test(url.pathname);
}

function errorStatus(error: O4CrossRoundDynamicsServiceError): number {
  switch (error.code) {
    case "O4_SCOPE_VIOLATION":
      return 403;
    case "O4_RUN_NOT_FOUND":
      return 404;
    case "O4_COURSE_SCOPE_CONFLICT":
      return 403;
    case "O4_INSUFFICIENT_HISTORY":
    case "O4_DUPLICATE_STATE":
      return 409;
    case "O4_CONTEXT_INVALID":
      return 422;
    default:
      return 500;
  }
}

function routeActor(
  surface: "teacher" | "student" | "admin",
  helpers: O4RouteHelpers
): CurrentUser {
  return surface === "teacher"
    ? helpers.requireTeacher()
    : surface === "student"
      ? helpers.requireStudent()
      : helpers.requireAdmin();
}

export async function handleO4CrossRoundDynamicsRoute(
  service: O4CrossRoundDynamicsService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: O4RouteContext,
  helpers: O4RouteHelpers
): Promise<boolean> {
  if (!isO4CrossRoundDynamicsRoute(request.method, url)) return false;
  const match = url.pathname.match(ROUTE);
  if (!match?.[1] || !match[2]) return false;
  const surface = match[1] as "teacher" | "student" | "admin";
  const actor = routeActor(surface, helpers);
  const courseId = url.searchParams.get("course_id") ?? "";
  const rawRoundNo = url.searchParams.get("round_no");
  const targetRoundNo = rawRoundNo === null ? undefined : Number(rawRoundNo);
  const input: O4CrossRoundDynamicsRequest = {
    actor: {
      tenant_id: actor.tenant_id,
      user_id: actor.user_id,
      roles: actor.roles,
      ...(actor.team_id ? { team_id: actor.team_id } : {})
    },
    surface,
    course_id: courseId,
    run_id: match[2],
    ...(targetRoundNo !== undefined ? { target_round_no: targetRoundNo } : {})
  };
  try {
    const payload = await service.getCandidate(input);
    helpers.sendJson(
      response,
      200,
      helpers.createEnvelope(context, payload, "O4 cross-round dynamics candidate ready")
    );
  } catch (error) {
    if (!(error instanceof O4CrossRoundDynamicsServiceError)) throw error;
    helpers.sendJson(response, errorStatus(error), {
      code: error.code,
      message: error.code,
      request_id: context.requestId
    });
  }
  return true;
}
