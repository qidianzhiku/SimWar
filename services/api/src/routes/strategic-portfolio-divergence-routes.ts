import type { IncomingMessage, ServerResponse } from "node:http";
import type { CurrentUser, StrategicPortfolioDivergenceRequest } from "@simwar/shared-contracts";
import { isStrategicPortfolioDivergenceRequest } from "@simwar/shared-contracts";
import {
  StrategicPortfolioDivergenceServiceError,
  type StrategicPortfolioDivergenceService
} from "../strategic-portfolio-divergence-service.js";

interface RouteContext {
  requestId: string;
  tenantId: string;
}

interface RouteHelpers {
  readJson: <T>(request: IncomingMessage) => Promise<T>;
  sendJson: (response: ServerResponse, status: number, body: unknown) => void;
  createEnvelope: (context: RouteContext, payload: unknown, message?: string) => unknown;
  requireTeacher: () => CurrentUser;
  requireStudent: () => CurrentUser;
  requireAdmin: () => CurrentUser;
}

const TEACHER_CREATE = "/api/v1/bff/teacher/sp-o3/strategic-portfolio/divergence";
const TEACHER_GET = /^\/api\/v1\/bff\/teacher\/sp-o3\/strategic-portfolio\/divergence\/([^/]+)$/;
const STUDENT_GET = /^\/api\/v1\/bff\/student\/sp-o3\/strategic-portfolio\/divergence\/([^/]+)$/;
const ADMIN_GET = /^\/api\/v1\/bff\/admin\/sp-o3\/strategic-portfolio\/divergence\/([^/]+)$/;

function isRoute(method: string | undefined, pathname: string): boolean {
  return (
    (method === "POST" && pathname === TEACHER_CREATE) ||
    (method === "GET" &&
      (TEACHER_GET.test(pathname) || STUDENT_GET.test(pathname) || ADMIN_GET.test(pathname)))
  );
}

function status(error: StrategicPortfolioDivergenceServiceError): number {
  if (error.code === "SP_O3_FORBIDDEN") return 403;
  if (error.code === "SP_O3_NOT_FOUND") return 404;
  if (error.code.includes("CONFLICT") || error.code === "SP_O3_REBASE_REQUIRED") return 409;
  return 422;
}

export async function handleStrategicPortfolioDivergenceRoute(
  service: StrategicPortfolioDivergenceService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: RouteContext,
  helpers: RouteHelpers
): Promise<boolean> {
  if (!isRoute(request.method, url.pathname)) return false;
  try {
    if (request.method === "POST") {
      const actor = helpers.requireTeacher();
      const body = await helpers.readJson<unknown>(request);
      if (!isStrategicPortfolioDivergenceRequest(body)) {
        throw new StrategicPortfolioDivergenceServiceError("SP_O3_INPUT_INVALID");
      }
      const result = await service.createCandidate(
        actor,
        body as StrategicPortfolioDivergenceRequest
      );
      helpers.sendJson(
        response,
        201,
        helpers.createEnvelope(context, result, "strategic portfolio divergence ready")
      );
      return true;
    }
    const teacher = TEACHER_GET.exec(url.pathname);
    if (teacher) {
      helpers.sendJson(
        response,
        200,
        helpers.createEnvelope(
          context,
          await service.getTeacher(helpers.requireTeacher(), teacher[1] ?? "")
        )
      );
      return true;
    }
    const student = STUDENT_GET.exec(url.pathname);
    if (student) {
      helpers.sendJson(
        response,
        200,
        helpers.createEnvelope(
          context,
          await service.getStudent(helpers.requireStudent(), student[1] ?? "")
        )
      );
      return true;
    }
    const admin = ADMIN_GET.exec(url.pathname);
    if (admin) {
      helpers.sendJson(
        response,
        200,
        helpers.createEnvelope(
          context,
          await service.getAdmin(helpers.requireAdmin(), admin[1] ?? "")
        )
      );
      return true;
    }
    return false;
  } catch (error) {
    if (!(error instanceof StrategicPortfolioDivergenceServiceError)) throw error;
    helpers.sendJson(
      response,
      status(error),
      helpers.createEnvelope(context, {
        code: error.code,
        message: "strategic portfolio divergence rejected"
      })
    );
    return true;
  }
}
