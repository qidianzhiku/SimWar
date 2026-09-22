import type { IncomingMessage, ServerResponse } from "node:http";
import type { CurrentUser } from "@simwar/shared-contracts";
import {
  DecisionThreadEvidenceSpineError,
  DecisionThreadEvidenceSpineService
} from "../decision-thread-evidence-spine.js";

export interface DecisionThreadEvidenceSpineRouteContext {
  readonly requestId: string;
  readonly tenantId: string;
}

export interface DecisionThreadEvidenceSpineRouteHelpers {
  readonly createEnvelope: (
    context: DecisionThreadEvidenceSpineRouteContext,
    payload: unknown
  ) => unknown;
  readonly requireStudent: () => CurrentUser;
  readonly requireTeacher: () => CurrentUser;
  readonly requireAdmin: () => CurrentUser;
  readonly sendJson: (response: ServerResponse, status: number, payload: unknown) => void;
}

function identity(value: string | null): string {
  if (
    !value ||
    value.trim() !== value ||
    !/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) ||
    /(?:^|[._:-])(?:any|current|default|fallback|first|last|latest|newest|next|unresolved)(?:$|[._:-])/i.test(
      value
    )
  ) {
    throw new DecisionThreadEvidenceSpineError("DDT_CONTEXT_INVALID");
  }
  return value;
}

function contextFromUrl(url: URL, tenantId: string) {
  const roundNoValue = url.searchParams.get("round_no");
  const roundNo = Number(roundNoValue);
  if (!roundNoValue || !Number.isSafeInteger(roundNo) || roundNo < 1) {
    throw new DecisionThreadEvidenceSpineError("DDT_CONTEXT_INVALID");
  }
  const context = {
    activity_id: identity(url.searchParams.get("activity_id")),
    course_id: identity(url.searchParams.get("course_id")),
    role_key: identity(url.searchParams.get("role_key")),
    round_id: identity(url.searchParams.get("round_id")),
    round_no: roundNo,
    run_id: identity(url.searchParams.get("run_id")),
    team_id: identity(url.searchParams.get("team_id")),
    tenant_id: identity(tenantId)
  };
  const fromRound = url.searchParams.get("gsi_from_round_id");
  const toRound = url.searchParams.get("gsi_to_round_id");
  if ((fromRound === null) !== (toRound === null)) {
    throw new DecisionThreadEvidenceSpineError("DDT_GSI_PAIR_INVALID");
  }
  return {
    ...context,
    ...(fromRound !== null && toRound !== null
      ? { gsi_from_round_id: identity(fromRound), gsi_to_round_id: identity(toRound) }
      : {})
  };
}

function actorForService(actor: CurrentUser) {
  return {
    user_id: actor.user_id,
    tenant_id: actor.tenant_id,
    roles: actor.roles,
    ...(actor.team_id ? { team_id: actor.team_id } : {})
  };
}

function errorStatus(error: DecisionThreadEvidenceSpineError): number {
  if (error.code === "DDT_SCOPE_VIOLATION") return 403;
  if (error.code === "DDT_OUTPUT_INVALID") return 500;
  return 422;
}

export function isDecisionThreadEvidenceSpineRoute(method: string | undefined, url: URL): boolean {
  return (
    method === "GET" &&
    /^\/api\/v1\/bff\/(?:teacher|student|admin)\/decision-thread\/evidence-spine$/.test(
      url.pathname
    )
  );
}

export async function handleDecisionThreadEvidenceSpineRoute(
  service: DecisionThreadEvidenceSpineService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  routeContext: DecisionThreadEvidenceSpineRouteContext,
  helpers: DecisionThreadEvidenceSpineRouteHelpers
): Promise<boolean> {
  if (!isDecisionThreadEvidenceSpineRoute(request.method, url)) return false;
  const match = /^\/api\/v1\/bff\/(teacher|student|admin)\/decision-thread\/evidence-spine$/.exec(
    url.pathname
  );
  if (!match?.[1]) throw new DecisionThreadEvidenceSpineError("DDT_CONTEXT_INVALID");
  const surface = match[1] as "teacher" | "student" | "admin";
  const actor =
    surface === "student"
      ? helpers.requireStudent()
      : surface === "teacher"
        ? helpers.requireTeacher()
        : helpers.requireAdmin();
  try {
    const context = contextFromUrl(url, routeContext.tenantId);
    const data = await service.getSpine({
      actor: actorForService(actor),
      context,
      surface
    });
    helpers.sendJson(response, 200, helpers.createEnvelope(routeContext, data));
  } catch (error) {
    if (!(error instanceof DecisionThreadEvidenceSpineError)) throw error;
    helpers.sendJson(response, errorStatus(error), {
      request_id: routeContext.requestId,
      code: error.code,
      message: "Decision Thread evidence spine request rejected",
      details: []
    });
  }
  return true;
}
