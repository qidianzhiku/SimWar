import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  CurrentUser,
  D5ExactRef
} from "@simwar/shared-contracts";
import {
  D5ExportAssembler,
  D5ExportError,
  type D5ExportSelectionInput
} from "../d5-export-assembler.js";
import { D5DeliveryService, type D5DeliveryRequest } from "../d5-delivery.js";
import { isD5ExactRef, type D5ExportFailureCode } from "@simwar/shared-contracts";

interface D5RouteContext {
  readonly requestId: string;
  readonly tenantId: string;
}

interface D5RouteRuntime {
  readonly exportAssembler: D5ExportAssembler;
  readonly delivery: D5DeliveryService;
}

interface D5RouteTools {
  readonly readJson: (request: IncomingMessage, options?: { requiredObject?: boolean }) => Promise<Record<string, unknown>>;
  readonly sendJson: (response: ServerResponse, statusCode: number, body: unknown) => void;
  readonly createEnvelope: (context: D5RouteContext, data: unknown, message?: string) => unknown;
  readonly requireTeacher: () => CurrentUser;
  readonly requireAdmin: () => CurrentUser;
}

function statusFor(code: D5ExportFailureCode): number {
  if (code === "D5_EXPORT_JOB_NOT_FOUND") return 404;
  if (code === "D5_EXPORT_DESTINATION_FORBIDDEN" || code === "D5_EXPORT_SCOPE_VIOLATION") return 403;
  if (code === "D5_EXPORT_DUPLICATE_CONFLICT" || code === "D5_EXPORT_CANCEL_FORBIDDEN" || code === "D5_EXPORT_JOB_NOT_RETRYABLE" || code === "D5_EXPORT_ALREADY_DELIVERED") return 409;
  return 422;
}

function parseRef(value: unknown, tenantId: string, resourceType: D5ExactRef["resource_type"]): D5ExactRef {
  if (!isD5ExactRef(value) || value.tenant_id !== tenantId || value.resource_type !== resourceType) {
    throw new D5ExportError("D5_EXACT_REFERENCE_INVALID");
  }
  return value;
}

function parseSelection(body: Record<string, unknown>, tenantId: string): D5ExportSelectionInput {
  if (!Array.isArray(body.report_refs) || body.report_refs.length === 0) {
    throw new D5ExportError("D5_REPORT_NOT_ELIGIBLE");
  }
  return {
    ...(body.destination_ref === undefined ? {} : { destination_ref: parseRef(body.destination_ref, tenantId, "destination_profile_version") }),
    ...(body.policy_ref === undefined ? {} : { policy_ref: parseRef(body.policy_ref, tenantId, "learning_export_policy_version") }),
    ...(body.profile_ref === undefined ? {} : { profile_ref: parseRef(body.profile_ref, tenantId, "xapi_profile_version") }),
    report_refs: body.report_refs.map((value) => parseRef(value, tenantId, "student_learning_report"))
  };
}

function parseDelivery(body: Record<string, unknown>, tenantId: string): D5DeliveryRequest {
  const request: D5DeliveryRequest = {
    bundle_ref: parseRef(body.bundle_ref, tenantId, "learning_export_bundle_version"),
    ...(body.idempotency_key === undefined ? {} : { idempotency_key: String(body.idempotency_key) })
  };
  return request;
}

function sendD5Error(
  tools: D5RouteTools,
  response: ServerResponse,
  context: D5RouteContext,
  error: D5ExportError
): void {
  tools.sendJson(response, statusFor(error.code), {
    request_id: context.requestId,
    code: error.code,
    message: "D5 export operation rejected",
    details: []
  });
}

export async function handleD5ExportRoute(
  runtime: D5RouteRuntime,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: D5RouteContext,
  tools: D5RouteTools
): Promise<boolean> {
  const isTeacher = url.pathname.startsWith("/api/v1/bff/teacher/learning-exports");
  const isAdmin = url.pathname.startsWith("/api/v1/bff/admin/learning-exports");
  if (!isTeacher && !isAdmin) return false;
  const actor = isTeacher ? tools.requireTeacher() : tools.requireAdmin();
  try {
    if (request.method === "POST" && (url.pathname.endsWith("/preview") || url.pathname.endsWith("/seal"))) {
      const body = await tools.readJson(request, { requiredObject: true });
      const selection = parseSelection(body, context.tenantId);
      if (url.pathname.endsWith("/preview")) {
        const preview = await runtime.exportAssembler.preview(context.tenantId, selection);
        tools.sendJson(response, 200, tools.createEnvelope(context, preview));
      } else {
        const sealed = await runtime.exportAssembler.seal({ actor_id: actor.user_id, tenant_id: context.tenantId }, selection);
        tools.sendJson(response, 201, tools.createEnvelope(context, sealed.bundle, sealed.status));
      }
      return true;
    }
    if (request.method === "GET" && (url.pathname === "/api/v1/bff/teacher/learning-exports" || url.pathname === "/api/v1/bff/admin/learning-exports")) {
      tools.sendJson(response, 200, tools.createEnvelope(context, await runtime.exportAssembler.list(context.tenantId)));
      return true;
    }
    if (request.method === "POST" && (url.pathname === "/api/v1/bff/teacher/learning-exports/jobs" || url.pathname === "/api/v1/bff/admin/learning-exports/jobs")) {
      const body = await tools.readJson(request, { requiredObject: true });
      const result = await runtime.delivery.createJob({ actor_id: actor.user_id, tenant_id: context.tenantId }, parseDelivery(body, context.tenantId));
      tools.sendJson(response, 201, tools.createEnvelope(context, result.job, result.status));
      return true;
    }
    const retry = url.pathname.match(/^\/api\/v1\/bff\/(?:teacher|admin)\/learning-exports\/jobs\/([^/]+)\/retry$/);
    if (request.method === "POST" && retry) {
      const job = await runtime.delivery.retryJob({ actor_id: actor.user_id, tenant_id: context.tenantId }, retry[1] ?? "");
      tools.sendJson(response, 200, tools.createEnvelope(context, job));
      return true;
    }
    const cancel = url.pathname.match(/^\/api\/v1\/bff\/(?:teacher|admin)\/learning-exports\/jobs\/([^/]+)\/cancel$/);
    if (request.method === "POST" && cancel) {
      const job = await runtime.delivery.cancelJob({ actor_id: actor.user_id, tenant_id: context.tenantId }, cancel[1] ?? "");
      tools.sendJson(response, 200, tools.createEnvelope(context, job));
      return true;
    }
    return false;
  } catch (error) {
    if (error instanceof D5ExportError) {
      sendD5Error(tools, response, context, error);
      return true;
    }
    throw error;
  }
}
