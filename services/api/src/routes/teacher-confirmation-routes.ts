import type { IncomingMessage, ServerResponse } from "node:http";
import type { TeacherConfirmationCommandInput } from "@simwar/shared-contracts";
import {
  TeacherConfirmationError,
  TeacherConfirmationCommandService
} from "../teacher-confirmation.js";
import { TeacherConfirmationQueryService } from "../teacher-confirmation-query.js";
import {
  TeacherConfirmationWorkClaimError,
  TeacherConfirmationWorkClaimService
} from "../teacher-confirmation-work-claim.js";

export interface TeacherConfirmationRouteContext {
  readonly requestId: string;
  readonly tenantId: string;
  readonly actorId: string;
}

export interface TeacherConfirmationRouteRuntime {
  readonly commands: TeacherConfirmationCommandService;
  readonly queries: TeacherConfirmationQueryService;
  readonly claims: TeacherConfirmationWorkClaimService;
}

export interface TeacherConfirmationRouteHelpers {
  readJson(request: IncomingMessage): Promise<unknown>;
  sendJson(response: ServerResponse, status: number, payload: unknown): void;
  createEnvelope(context: TeacherConfirmationRouteContext, payload: unknown): unknown;
  requireTeacher(context: TeacherConfirmationRouteContext): void;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TeacherConfirmationError("D3_INPUT_INVALID");
  return value as Record<string, unknown>;
}

function only(value: Record<string, unknown>, fields: readonly string[]): void {
  if (Object.keys(value).some((field) => !fields.includes(field)))
    throw new TeacherConfirmationError("D3_INPUT_INVALID");
}

function parseInput(value: unknown): TeacherConfirmationCommandInput {
  const body = object(value);
  only(body, [
    "confirmation_id",
    "course_package_ref",
    "learning_goal_ref",
    "rubric_ref",
    "evidence_refs",
    "context",
    "criterion_decisions",
    "teacher_feedback",
    "idempotency_key"
  ]);
  return body as unknown as TeacherConfirmationCommandInput;
}

function parseRejectInput(value: unknown): { rejection_reason: string } {
  const body = object(value);
  only(body, ["rejection_reason"]);
  if (typeof body.rejection_reason !== "string")
    throw new TeacherConfirmationError("D3_INPUT_INVALID");
  return { rejection_reason: body.rejection_reason };
}

function errorResponse(error: unknown): {
  status: number;
  payload: { code: string; message: string };
} {
  const code =
    error instanceof TeacherConfirmationError || error instanceof TeacherConfirmationWorkClaimError
      ? error.code
      : "D3_INPUT_INVALID";
  const forbidden = code === "D3_FORBIDDEN";
  const conflict =
    code === "D3_DUPLICATE_CONFLICT" ||
    code === "D3_WORK_CLAIM_CONFLICT" ||
    code === "D3_LIFECYCLE_INVALID";
  return {
    status: forbidden ? 403 : conflict ? 409 : 422,
    payload: { code, message: "D3 teacher confirmation command rejected" }
  };
}

export async function handleTeacherConfirmationRoute(
  runtime: TeacherConfirmationRouteRuntime,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: TeacherConfirmationRouteContext,
  helpers: TeacherConfirmationRouteHelpers
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/v1/bff/teacher/confirmations")) return false;
  helpers.requireTeacher(context);
  try {
    if (request.method === "GET" && url.pathname === "/api/v1/bff/teacher/confirmations") {
      helpers.sendJson(
        response,
        200,
        helpers.createEnvelope(context, await runtime.queries.listTeacher(context.tenantId))
      );
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/v1/bff/teacher/confirmations/drafts") {
      const receipt = await runtime.commands.saveDraft(
        { actor_id: context.actorId, tenant_id: context.tenantId },
        parseInput(await helpers.readJson(request)),
        context.requestId
      );
      helpers.sendJson(response, 201, helpers.createEnvelope(context, receipt));
      return true;
    }
    const confirm = /^\/api\/v1\/bff\/teacher\/confirmations\/([^/]+)\/confirm$/.exec(url.pathname);
    if (request.method === "POST" && confirm) {
      const confirmationId = confirm[1];
      if (!confirmationId) throw new TeacherConfirmationError("D3_INPUT_INVALID");
      const receipt = await runtime.commands.confirm(
        { actor_id: context.actorId, tenant_id: context.tenantId },
        confirmationId,
        context.requestId
      );
      helpers.sendJson(response, 200, helpers.createEnvelope(context, receipt));
      return true;
    }
    const reject = /^\/api\/v1\/bff\/teacher\/confirmations\/([^/]+)\/reject$/.exec(url.pathname);
    if (request.method === "POST" && reject) {
      const confirmationId = reject[1];
      if (!confirmationId) throw new TeacherConfirmationError("D3_INPUT_INVALID");
      const receipt = await runtime.commands.reject(
        { actor_id: context.actorId, tenant_id: context.tenantId },
        confirmationId,
        parseRejectInput(await helpers.readJson(request)),
        context.requestId
      );
      helpers.sendJson(response, 200, helpers.createEnvelope(context, receipt));
      return true;
    }
    const revise = /^\/api\/v1\/bff\/teacher\/confirmations\/([^/]+)\/revise$/.exec(url.pathname);
    if (request.method === "POST" && revise) {
      const confirmationId = revise[1];
      if (!confirmationId) throw new TeacherConfirmationError("D3_INPUT_INVALID");
      const receipt = await runtime.commands.revise(
        { actor_id: context.actorId, tenant_id: context.tenantId },
        confirmationId,
        parseInput(await helpers.readJson(request)),
        context.requestId
      );
      helpers.sendJson(response, 201, helpers.createEnvelope(context, receipt));
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/v1/bff/teacher/confirmations/claims") {
      const body = object(await helpers.readJson(request));
      only(body, ["context", "evidence_set_digest", "ttl_seconds"]);
      const claimInput = {
        tenant_id: context.tenantId,
        context: body.context as never,
        evidence_set_digest: String(body.evidence_set_digest),
        claimed_by: context.actorId,
        now: new Date().toISOString(),
        ...(typeof body.ttl_seconds === "number" ? { ttl_seconds: body.ttl_seconds } : {})
      };
      const claim = runtime.claims.claim(claimInput);
      helpers.sendJson(
        response,
        201,
        helpers.createEnvelope(context, {
          claim,
          known_limits: ["Claims are process-local and non-durable."]
        })
      );
      return true;
    }
    const release = /^\/api\/v1\/bff\/teacher\/confirmations\/claims\/([^/]+)\/release$/.exec(
      url.pathname
    );
    if (request.method === "POST" && release) {
      const claimId = release[1];
      if (!claimId) throw new TeacherConfirmationError("D3_INPUT_INVALID");
      helpers.sendJson(
        response,
        200,
        helpers.createEnvelope(context, { claim: runtime.claims.release(claimId, context.actorId) })
      );
      return true;
    }
  } catch (error) {
    const mapped = errorResponse(error);
    helpers.sendJson(response, mapped.status, helpers.createEnvelope(context, mapped.payload));
    return true;
  }
  return false;
}
