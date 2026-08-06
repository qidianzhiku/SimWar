import type { IncomingMessage, ServerResponse } from "node:http";
import type { TeachingClosureContext } from "@simwar/shared-contracts";
import {
  TeachingClosureQueryError,
  TeachingClosureQueryService
} from "../teaching-closure-query.js";

export interface TeachingClosureRouteRuntime {
  readonly closure: TeachingClosureQueryService;
}

export interface TeachingClosureRouteHelpers {
  readonly createEnvelope: (
    context: { requestId: string; tenantId: string },
    payload: unknown
  ) => unknown;
  readonly requireTeacher: () => { user_id: string; tenant_id: string };
  readonly sendJson: (response: ServerResponse, status: number, payload: unknown) => void;
}

function identity(url: URL, name: string): string {
  const value = url.searchParams.get(name);
  if (
    !value ||
    value.trim() !== value ||
    !/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) ||
    /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  ) {
    throw new TeachingClosureQueryError("W019_CONTEXT_INVALID");
  }
  return value;
}

function parseContext(url: URL): TeachingClosureContext {
  return {
    activity_id: identity(url, "activity_id"),
    course_id: identity(url, "course_id"),
    role_key: identity(url, "role_key"),
    run_id: identity(url, "run_id"),
    team_id: identity(url, "team_id")
  };
}

export function isTeachingClosureRoute(method: string | undefined, url: URL): boolean {
  return method === "GET" && url.pathname === "/api/v1/bff/teacher/teaching-closure";
}

export async function handleTeachingClosureRoute(
  runtime: TeachingClosureRouteRuntime,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: { requestId: string; tenantId: string },
  helpers: TeachingClosureRouteHelpers
): Promise<boolean> {
  if (!isTeachingClosureRoute(request.method, url)) return false;
  const teacher = helpers.requireTeacher();
  try {
    const data = await runtime.closure.get(
      { actor_id: teacher.user_id, tenant_id: context.tenantId },
      parseContext(url)
    );
    helpers.sendJson(response, 200, helpers.createEnvelope(context, data));
  } catch (error) {
    const code = error instanceof TeachingClosureQueryError ? error.code : "W019_OUTPUT_INVALID";
    const status = code === "W019_CONTEXT_INVALID" ? 422 : 500;
    helpers.sendJson(
      response,
      status,
      helpers.createEnvelope(context, { code, message: "Teaching closure request rejected" })
    );
  }
  return true;
}
