import type { IncomingMessage, ServerResponse } from "node:http";
import type { CurrentUser, ShanghaiC0StudentChoice } from "@simwar/shared-contracts";
import { isShanghaiC0Request } from "@simwar/shared-contracts";
import {
  ShanghaiC0ConversionError,
  type ShanghaiC0ConversionService
} from "../shanghai-c0-conversion-service.js";

const TEACHER_CREATE = "/api/v1/bff/teacher/shanghai-c0/conversions";
const TEACHER_GET = /^\/api\/v1\/bff\/teacher\/shanghai-c0\/conversions\/([^/]+)$/;
const STUDENT_GET = /^\/api\/v1\/bff\/student\/shanghai-c0\/conversions\/([^/]+)$/;
const STUDENT_CHOICE = /^\/api\/v1\/bff\/student\/shanghai-c0\/conversions\/([^/]+)\/choice$/;
const ADMIN_GET = /^\/api\/v1\/bff\/admin\/shanghai-c0\/conversions\/([^/]+)$/;

interface ShanghaiC0RouteContext {
  readonly requestId: string;
  readonly tenantId: string;
}

interface ShanghaiC0RouteHelpers {
  readonly readJson: <T>(request: IncomingMessage) => Promise<T>;
  readonly sendJson: (response: ServerResponse, status: number, body: unknown) => void;
  readonly createEnvelope: (
    context: ShanghaiC0RouteContext,
    payload: unknown,
    message?: string
  ) => unknown;
  readonly requireTeacher: () => CurrentUser;
  readonly requireStudent: () => CurrentUser;
  readonly requireAdmin: () => CurrentUser;
}

function status(error: ShanghaiC0ConversionError): number {
  switch (error.code) {
    case "SH_C0_FORBIDDEN":
      return 403;
    case "SH_C0_NOT_FOUND":
    case "SH_C0_RUN_NOT_FOUND":
    case "SH_C0_ROUND_NOT_FOUND":
      return 404;
    case "SH_C0_EXACT_BINDING_REQUIRED":
      return 409;
    default:
      return 422;
  }
}

export function isShanghaiC0ConversionRoute(method: string | undefined, url: URL): boolean {
  return (
    (method === "POST" && url.pathname === TEACHER_CREATE) ||
    (method === "GET" &&
      (TEACHER_GET.test(url.pathname) ||
        STUDENT_GET.test(url.pathname) ||
        ADMIN_GET.test(url.pathname))) ||
    (method === "POST" && STUDENT_CHOICE.test(url.pathname))
  );
}

function choiceBody(value: unknown): ShanghaiC0StudentChoice {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ShanghaiC0ConversionError("SH_C0_INPUT_INVALID");
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.option_id !== "string" || candidate.option_id.trim().length === 0) {
    throw new ShanghaiC0ConversionError("SH_C0_INPUT_INVALID");
  }
  return { option_id: candidate.option_id.trim() };
}

export async function handleShanghaiC0ConversionRoute(
  service: ShanghaiC0ConversionService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: ShanghaiC0RouteContext,
  helpers: ShanghaiC0RouteHelpers
): Promise<boolean> {
  if (!isShanghaiC0ConversionRoute(request.method, url)) return false;
  try {
    if (request.method === "POST" && url.pathname === TEACHER_CREATE) {
      const actor = helpers.requireTeacher();
      const body = await helpers.readJson<unknown>(request);
      if (!isShanghaiC0Request(body)) throw new ShanghaiC0ConversionError("SH_C0_INPUT_INVALID");
      const result = await service.createTeacher(actor, body);
      helpers.sendJson(
        response,
        201,
        helpers.createEnvelope(context, result, "Shanghai C0 conversion consumed")
      );
      return true;
    }
    if (request.method === "GET" && TEACHER_GET.test(url.pathname)) {
      const actor = helpers.requireTeacher();
      const match = TEACHER_GET.exec(url.pathname);
      const result = await service.getTeacher(actor, decodeURIComponent(match?.[1] ?? ""));
      helpers.sendJson(response, 200, helpers.createEnvelope(context, result));
      return true;
    }
    if (request.method === "GET" && STUDENT_GET.test(url.pathname)) {
      const actor = helpers.requireStudent();
      const match = STUDENT_GET.exec(url.pathname);
      const result = await service.getStudent(actor, decodeURIComponent(match?.[1] ?? ""));
      helpers.sendJson(response, 200, helpers.createEnvelope(context, result));
      return true;
    }
    if (request.method === "POST" && STUDENT_CHOICE.test(url.pathname)) {
      const actor = helpers.requireStudent();
      const match = STUDENT_CHOICE.exec(url.pathname);
      const result = await service.submitStudentChoice(
        actor,
        decodeURIComponent(match?.[1] ?? ""),
        choiceBody(await helpers.readJson<unknown>(request))
      );
      helpers.sendJson(
        response,
        200,
        helpers.createEnvelope(context, result, "Student draft choice recorded")
      );
      return true;
    }
    const actor = helpers.requireAdmin();
    const match = ADMIN_GET.exec(url.pathname);
    const result = await service.getAdmin(actor, decodeURIComponent(match?.[1] ?? ""));
    helpers.sendJson(response, 200, helpers.createEnvelope(context, result));
    return true;
  } catch (error) {
    const mapped =
      error instanceof ShanghaiC0ConversionError
        ? error
        : new ShanghaiC0ConversionError("SH_C0_INPUT_INVALID");
    helpers.sendJson(
      response,
      status(mapped),
      helpers.createEnvelope(context, {
        code: mapped.code,
        message: "Shanghai C0 conversion request rejected"
      })
    );
    return true;
  }
}
