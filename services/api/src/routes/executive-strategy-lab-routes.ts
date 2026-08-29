import type { IncomingMessage, ServerResponse } from "node:http";
import type { CurrentUser, ESLRequest } from "@simwar/shared-contracts";
import { isESLRequest } from "@simwar/shared-contracts";
import {
  ExecutiveStrategyLabError,
  type ExecutiveStrategyLabService
} from "../executive-strategy-lab-service.js";

const TEACHER_CREATE = "/api/v1/bff/teacher/esl/strategy-lab";
const TEACHER_CANDIDATE = /^\/api\/v1\/bff\/teacher\/esl\/candidates\/([^/]+)$/;
const STUDENT_CANDIDATE = /^\/api\/v1\/bff\/student\/esl\/candidates\/([^/]+)$/;
const ADMIN_AUDIT = "/api/v1/bff/admin/esl/audit";

interface ESLRouteContext {
  readonly requestId: string;
  readonly tenantId: string;
}

interface ESLRouteHelpers {
  readonly readJson: <T>(request: IncomingMessage) => Promise<T>;
  readonly sendJson: (response: ServerResponse, status: number, body: unknown) => void;
  readonly createEnvelope: (
    context: ESLRouteContext,
    payload: unknown,
    message?: string
  ) => unknown;
  readonly requireTeacher: () => CurrentUser;
  readonly requireStudent: () => CurrentUser;
  readonly requireAdmin: () => CurrentUser;
}

function status(error: ExecutiveStrategyLabError): number {
  switch (error.code) {
    case "ESL_FORBIDDEN":
      return 403;
    case "ESL_RUN_NOT_FOUND":
    case "ESL_ROUND_NOT_FOUND":
    case "ESL_NOT_FOUND":
      return 404;
    case "ESL_OFFICIAL_BASELINE_REQUIRED":
    case "ESL_PATHS_REQUIRED":
    case "ESL_DUPLICATE_CONFLICT":
      return 409;
    default:
      return 422;
  }
}

interface HttpLikeError {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

function isHttpLikeError(error: unknown): error is HttpLikeError {
  if (!error || typeof error !== "object") return false;
  const candidate = error as Partial<HttpLikeError>;
  return (
    typeof candidate.statusCode === "number" &&
    Number.isInteger(candidate.statusCode) &&
    candidate.statusCode >= 400 &&
    candidate.statusCode <= 599 &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
}

function sendError(
  response: ServerResponse,
  context: ESLRouteContext,
  helpers: ESLRouteHelpers,
  error: unknown
): void {
  if (isHttpLikeError(error)) {
    helpers.sendJson(
      response,
      error.statusCode,
      helpers.createEnvelope(context, {
        code: error.code,
        message: error.message,
        ...(Array.isArray(error.details) ? { details: error.details } : {})
      })
    );
    return;
  }
  const mapped = error instanceof ExecutiveStrategyLabError
    ? error
    : new ExecutiveStrategyLabError("ESL_OUTPUT_INVALID");
  helpers.sendJson(
    response,
    status(mapped),
    helpers.createEnvelope(context, { code: mapped.code, message: "ESL request rejected" })
  );
}

export function isExecutiveStrategyLabRoute(method: string | undefined, url: URL): boolean {
  return (
    (method === "POST" && url.pathname === TEACHER_CREATE) ||
    (method === "GET" &&
      (TEACHER_CANDIDATE.test(url.pathname) ||
        STUDENT_CANDIDATE.test(url.pathname) ||
        url.pathname === ADMIN_AUDIT))
  );
}

export async function handleExecutiveStrategyLabRoute(
  service: ExecutiveStrategyLabService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: ESLRouteContext,
  helpers: ESLRouteHelpers
): Promise<boolean> {
  if (!isExecutiveStrategyLabRoute(request.method, url)) return false;
  try {
    if (request.method === "POST" && url.pathname === TEACHER_CREATE) {
      const actor = helpers.requireTeacher();
      const body = await helpers.readJson<unknown>(request);
      if (!isESLRequest(body)) throw new ExecutiveStrategyLabError("ESL_INPUT_INVALID");
      const result = await service.createCandidate(actor, body as ESLRequest);
      helpers.sendJson(
        response,
        201,
        helpers.createEnvelope(context, result, "executive strategy lab candidate ready")
      );
      return true;
    }
    if (request.method === "GET" && TEACHER_CANDIDATE.test(url.pathname)) {
      const actor = helpers.requireTeacher();
      const match = TEACHER_CANDIDATE.exec(url.pathname);
      const result = await service.getTeacher(actor, match?.[1] ?? "");
      helpers.sendJson(response, 200, helpers.createEnvelope(context, result));
      return true;
    }
    if (request.method === "GET" && STUDENT_CANDIDATE.test(url.pathname)) {
      const actor = helpers.requireStudent();
      const match = STUDENT_CANDIDATE.exec(url.pathname);
      const result = await service.getStudent(actor, match?.[1] ?? "");
      helpers.sendJson(response, 200, helpers.createEnvelope(context, result));
      return true;
    }
    const actor = helpers.requireAdmin();
    const candidateId = url.searchParams.get("candidate_id")?.trim() ?? "";
    if (!candidateId) throw new ExecutiveStrategyLabError("ESL_INPUT_INVALID");
    const result = await service.getAdmin(actor, candidateId);
    helpers.sendJson(response, 200, helpers.createEnvelope(context, result));
    return true;
  } catch (error) {
    sendError(response, context, helpers, error);
    return true;
  }
}
