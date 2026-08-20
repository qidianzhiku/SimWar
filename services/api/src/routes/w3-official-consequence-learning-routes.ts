import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  W3CounterfactualCommandInput,
  W3EvidenceSelectionCommandInput,
  W3HypothesisCommandInput,
  W3OfficialConsequenceContext,
  W3ReflectionCommandInput
} from "@simwar/shared-contracts";
import {
  W3OfficialConsequenceLearningError,
  type W3Actor,
  type W3OfficialConsequenceLearningService
} from "../w3-official-consequence-learning.js";

export interface W3RouteContext {
  readonly actor?: W3Actor;
  readonly requestId: string;
  readonly tenantId: string;
}

export interface W3RouteHelpers {
  readonly createEnvelope: (context: W3RouteContext, payload: unknown) => unknown;
  readonly readJson: (request: IncomingMessage) => Promise<unknown>;
  readonly requireStudent: () => W3Actor;
  readonly requireTeacher: () => W3Actor;
  readonly sendJson: (response: ServerResponse, status: number, payload: unknown) => void;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new W3OfficialConsequenceLearningError("W3_REQUEST_INVALID");
  }
  return value as Record<string, unknown>;
}

function only(value: Record<string, unknown>, fields: readonly string[]): void {
  if (Object.keys(value).some((field) => !fields.includes(field))) {
    throw new W3OfficialConsequenceLearningError("W3_REQUEST_INVALID");
  }
}

function identity(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) ||
    /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  ) {
    throw new W3OfficialConsequenceLearningError("W3_CONTEXT_INVALID");
  }
  return value;
}

function contextFromUrl(url: URL, tenantId: string): W3OfficialConsequenceContext {
  const roundNo = Number(url.searchParams.get("round_no"));
  if (!Number.isInteger(roundNo) || roundNo < 1) {
    throw new W3OfficialConsequenceLearningError("W3_CONTEXT_INVALID");
  }
  return {
    activity_id: identity(url.searchParams.get("activity_id")),
    course_id: identity(url.searchParams.get("course_id")),
    role_key: identity(url.searchParams.get("role_key")),
    round_id: identity(url.searchParams.get("round_id")),
    round_no: roundNo,
    run_id: identity(url.searchParams.get("run_id")),
    team_id: identity(url.searchParams.get("team_id")),
    tenant_id: tenantId
  };
}

function contextFromBody(
  value: Record<string, unknown>,
  tenantId: string
): W3OfficialConsequenceContext {
  const context = object(value.context);
  return {
    activity_id: identity(context.activity_id),
    course_id: identity(context.course_id),
    role_key: identity(context.role_key),
    round_id: identity(context.round_id),
    round_no: Number(context.round_no),
    run_id: identity(context.run_id),
    team_id: identity(context.team_id),
    tenant_id: tenantId
  };
}

function parseCounterfactual(value: unknown, tenantId: string): W3CounterfactualCommandInput {
  const body = object(value);
  only(body, ["changed_field", "changed_value", "context", "idempotency_key"]);
  if (typeof body.changed_field !== "string" || typeof body.idempotency_key !== "string") {
    throw new W3OfficialConsequenceLearningError("W3_REQUEST_INVALID");
  }
  if (typeof body.changed_value !== "string" && typeof body.changed_value !== "number") {
    throw new W3OfficialConsequenceLearningError("W3_REQUEST_INVALID");
  }
  return {
    changed_field: body.changed_field as W3CounterfactualCommandInput["changed_field"],
    changed_value: body.changed_value,
    context: contextFromBody(body, tenantId),
    idempotency_key: body.idempotency_key
  };
}

function parseReflection(value: unknown, tenantId: string): W3ReflectionCommandInput {
  const body = object(value);
  only(body, ["context", "idempotency_key", "prompt_id", "response"]);
  if (
    typeof body.idempotency_key !== "string" ||
    typeof body.prompt_id !== "string" ||
    typeof body.response !== "string"
  ) {
    throw new W3OfficialConsequenceLearningError("W3_REQUEST_INVALID");
  }
  return {
    context: contextFromBody(body, tenantId),
    idempotency_key: body.idempotency_key,
    prompt_id: body.prompt_id,
    response: body.response
  };
}

function parseEvidenceSelection(value: unknown, tenantId: string): W3EvidenceSelectionCommandInput {
  const body = object(value);
  only(body, ["context", "evidence_refs", "idempotency_key"]);
  if (!Array.isArray(body.evidence_refs) || typeof body.idempotency_key !== "string") {
    throw new W3OfficialConsequenceLearningError("W3_REQUEST_INVALID");
  }
  return {
    context: contextFromBody(body, tenantId),
    evidence_refs: body.evidence_refs as W3EvidenceSelectionCommandInput["evidence_refs"],
    idempotency_key: body.idempotency_key
  };
}

function errorResponse(error: unknown): { status: number; code: string; message: string } {
  const code =
    error instanceof W3OfficialConsequenceLearningError ? error.code : "W3_OUTPUT_INVALID";
  const status =
    code === "W3_ACTOR_SCOPE_VIOLATION"
      ? 403
      : ["W3_CONTEXT_INVALID", "W3_REQUEST_INVALID"].includes(code)
        ? 422
        : ["W3_OFFICIAL_RESULT_REQUIRED", "W3_EVIDENCE_NOT_FOUND"].includes(code)
          ? 404
          : 409;
  return { status, code, message: "W3 official consequence request rejected" };
}

export function isW3OfficialConsequenceRoute(method: string | undefined, url: URL): boolean {
  return (
    (method === "GET" &&
      /^\/api\/v1\/bff\/(?:student|teacher)\/w3\/consequence$/.test(url.pathname)) ||
    (method === "POST" &&
      /^\/api\/v1\/bff\/(?:student|teacher)\/w3\/(?:counterfactual|reflection|evidence-selection|next-round-hypothesis)$/.test(
        url.pathname
      ))
  );
}

export async function handleW3OfficialConsequenceRoute(
  service: W3OfficialConsequenceLearningService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: W3RouteContext,
  helpers: W3RouteHelpers
): Promise<boolean> {
  if (!isW3OfficialConsequenceRoute(request.method, url)) return false;
  try {
    const surface = url.pathname.startsWith("/api/v1/bff/student/") ? "student" : "teacher";
    const actor = surface === "student" ? helpers.requireStudent() : helpers.requireTeacher();
    if (request.method === "GET") {
      helpers.sendJson(
        response,
        200,
        helpers.createEnvelope(
          context,
          await service.getConsequence(actor, contextFromUrl(url, context.tenantId), surface)
        )
      );
      return true;
    }
    if (url.pathname.endsWith("/counterfactual")) {
      helpers.sendJson(
        response,
        200,
        helpers.createEnvelope(
          context,
          await service.createCounterfactual(
            actor,
            parseCounterfactual(await helpers.readJson(request), context.tenantId),
            context.requestId
          )
        )
      );
      return true;
    }
    if (url.pathname.endsWith("/reflection")) {
      helpers.sendJson(
        response,
        201,
        helpers.createEnvelope(
          context,
          await service.saveReflection(
            actor,
            parseReflection(await helpers.readJson(request), context.tenantId),
            context.requestId
          )
        )
      );
      return true;
    }
    if (url.pathname.endsWith("/evidence-selection")) {
      helpers.sendJson(
        response,
        201,
        helpers.createEnvelope(
          context,
          await service.selectEvidence(
            actor,
            parseEvidenceSelection(await helpers.readJson(request), context.tenantId),
            context.requestId
          )
        )
      );
      return true;
    }
    const body = object(await helpers.readJson(request));
    only(body, ["context"]);
    const input: W3HypothesisCommandInput = { context: contextFromBody(body, context.tenantId) };
    helpers.sendJson(
      response,
      200,
      helpers.createEnvelope(
        context,
        await service.prepareNextRoundHypothesis(actor, input, context.requestId)
      )
    );
    return true;
  } catch (error) {
    const mapped = errorResponse(error);
    helpers.sendJson(response, mapped.status, {
      request_id: context.requestId,
      code: mapped.code,
      message: mapped.message,
      details: []
    });
    return true;
  }
}
