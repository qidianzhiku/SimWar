import type { IncomingMessage, ServerResponse } from "node:http";
import {
  isW020AdvisoryRequest,
  type CurrentUser,
  type W020AdvisoryRequest
} from "@simwar/shared-contracts";
import { GovernedAdvisoryService, W020AdvisoryError } from "../w020-advisory-service.js";

export interface W020AdvisoryRouteContext {
  readonly requestId: string;
  readonly tenantId: string;
  readonly actor: CurrentUser;
}

export interface W020AdvisoryRouteHelpers {
  readJson(request: IncomingMessage): Promise<unknown>;
  sendJson(response: ServerResponse, status: number, payload: unknown): void;
  createEnvelope(context: W020AdvisoryRouteContext, payload: unknown): unknown;
  requireStudent(context: W020AdvisoryRouteContext): void;
  requireTeacher(context: W020AdvisoryRouteContext): void;
}

function parseRequest(
  value: unknown,
  surface: "student_role" | "teacher_debrief"
): W020AdvisoryRequest {
  if (!isW020AdvisoryRequest(value) || value.surface !== surface)
    throw new W020AdvisoryError("W020_INPUT_INVALID");
  return value;
}

function errorStatus(error: W020AdvisoryError): number {
  if (error.code === "W020_FORBIDDEN") return 403;
  if (error.code === "W020_CONTEXT_NOT_FOUND") return 404;
  if (error.code === "W020_SOURCE_NOT_ELIGIBLE") return 409;
  if (error.code === "W020_DUPLICATE_CONFLICT") return 409;
  if (error.code === "W020_PROVIDER_FAILED" || error.code === "W020_OUTPUT_REJECTED") return 502;
  if (error.code === "W020_PERSISTENCE_FAILED") return 503;
  return 422;
}

function sendError(
  error: unknown,
  response: ServerResponse,
  context: W020AdvisoryRouteContext,
  helpers: W020AdvisoryRouteHelpers
): void {
  const mapped =
    error instanceof W020AdvisoryError ? error : new W020AdvisoryError("W020_INPUT_INVALID");
  helpers.sendJson(
    response,
    errorStatus(mapped),
    helpers.createEnvelope(context, {
      code: mapped.code,
      message: "governed advisory request rejected"
    })
  );
}

export async function handleW020AdvisoryRoute(
  service: GovernedAdvisoryService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: W020AdvisoryRouteContext,
  helpers: W020AdvisoryRouteHelpers
): Promise<boolean> {
  const isStudent = url.pathname.startsWith("/api/v1/bff/student/advisors");
  const isTeacher = url.pathname.startsWith("/api/v1/bff/teacher/advisors");
  if (!isStudent && !isTeacher) return false;
  try {
    if (isStudent) {
      try {
        helpers.requireStudent(context);
      } catch {
        throw new W020AdvisoryError("W020_FORBIDDEN");
      }
      if (request.method !== "POST" || url.pathname !== "/api/v1/bff/student/advisors/role")
        throw new W020AdvisoryError("W020_FORBIDDEN");
      const receipt = await service.createStudentRoleAdvisory(
        context.actor,
        parseRequest(await helpers.readJson(request), "student_role"),
        context.requestId
      );
      helpers.sendJson(response, 201, helpers.createEnvelope(context, receipt));
      return true;
    }
    try {
      helpers.requireTeacher(context);
    } catch {
      throw new W020AdvisoryError("W020_FORBIDDEN");
    }
    if (request.method === "GET" && url.pathname === "/api/v1/bff/teacher/advisors/audit") {
      helpers.sendJson(
        response,
        200,
        helpers.createEnvelope(context, {
          entries: await service.listTeacherAudit(context.actor),
          known_limits: ["Audit excludes raw prompt and raw event payload."]
        })
      );
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/v1/bff/teacher/advisors/debrief") {
      const receipt = await service.createTeacherDebriefAdvisory(
        context.actor,
        parseRequest(await helpers.readJson(request), "teacher_debrief"),
        context.requestId
      );
      helpers.sendJson(response, 201, helpers.createEnvelope(context, receipt));
      return true;
    }
    throw new W020AdvisoryError("W020_INPUT_INVALID");
  } catch (error) {
    sendError(error, response, context, helpers);
    return true;
  }
}
