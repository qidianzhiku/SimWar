import type { IncomingMessage, ServerResponse } from "node:http";
import type { CurrentUser } from "@simwar/shared-contracts";
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

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new W020AdvisoryError("W020_INPUT_INVALID");
  return value as Record<string, unknown>;
}

function parseRequest(value: unknown, surface: "student_role" | "teacher_debrief") {
  const body = object(value);
  const allowed = ["run_id", "round_id", "team_id", "idempotency_key", ...(surface === "student_role" ? ["role_key"] : [])];
  if (Object.keys(body).some((key) => !allowed.includes(key)) || allowed.some((key) => body[key] === undefined && key !== "role_key")) throw new W020AdvisoryError("W020_INPUT_INVALID");
  if (!["run_id", "round_id", "team_id", "idempotency_key"].every((key) => typeof body[key] === "string")) throw new W020AdvisoryError("W020_INPUT_INVALID");
  if (body.role_key !== undefined && !["CEO", "CFO", "CMO", "COO"].includes(String(body.role_key))) throw new W020AdvisoryError("W020_INPUT_INVALID");
  return {
    discriminator: "w020_advisory_request" as const,
    idempotency_key: body.idempotency_key as string,
    round_id: body.round_id as string,
    run_id: body.run_id as string,
    surface,
    team_id: body.team_id as string,
    ...(body.role_key !== undefined ? { role_key: body.role_key as "CEO" | "CFO" | "CMO" | "COO" } : {})
  };
}

function errorStatus(error: W020AdvisoryError): number {
  if (error.code === "W020_FORBIDDEN") return 403;
  if (error.code === "W020_CONTEXT_NOT_FOUND") return 404;
  if (error.code === "W020_DUPLICATE_CONFLICT") return 409;
  return 422;
}

function sendError(
  error: unknown,
  response: ServerResponse,
  context: W020AdvisoryRouteContext,
  helpers: W020AdvisoryRouteHelpers
): void {
  const mapped = error instanceof W020AdvisoryError ? error : new W020AdvisoryError("W020_INPUT_INVALID");
  helpers.sendJson(response, errorStatus(mapped), helpers.createEnvelope(context, { code: mapped.code, message: "governed advisory request rejected" }));
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
      helpers.requireStudent(context);
      if (request.method !== "POST" || url.pathname !== "/api/v1/bff/student/advisors/role") throw new W020AdvisoryError("W020_FORBIDDEN");
      const receipt = await service.createStudentRoleAdvisory(context.actor, parseRequest(await helpers.readJson(request), "student_role"), context.requestId);
      helpers.sendJson(response, 201, helpers.createEnvelope(context, receipt));
      return true;
    }
    helpers.requireTeacher(context);
    if (request.method === "GET" && url.pathname === "/api/v1/bff/teacher/advisors/audit") {
      helpers.sendJson(response, 200, helpers.createEnvelope(context, { entries: await service.listTeacherAudit(context.actor), known_limits: ["Audit excludes raw prompt and raw event payload."] }));
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/v1/bff/teacher/advisors/debrief") {
      const receipt = await service.createTeacherDebriefAdvisory(context.actor, parseRequest(await helpers.readJson(request), "teacher_debrief"), context.requestId);
      helpers.sendJson(response, 201, helpers.createEnvelope(context, receipt));
      return true;
    }
    throw new W020AdvisoryError("W020_INPUT_INVALID");
  } catch (error) {
    sendError(error, response, context, helpers);
    return true;
  }
}
