import type { IncomingMessage, ServerResponse } from "node:http";
import type { CurrentUser } from "@simwar/shared-contracts";
import {
  GoldenJourneyIntegrationError,
  type GoldenJourneyIntegrationService
} from "../golden-journey-integration.js";

interface GoldenJourneyRouteContext {
  readonly requestId: string;
  readonly tenantId: string;
  readonly correlationId: string;
}

interface GoldenJourneyRouteTools {
  readonly sendJson: (response: ServerResponse, status: number, body: unknown) => void;
  readonly createEnvelope: (context: GoldenJourneyRouteContext, payload: unknown) => unknown;
  readonly requireStudent: () => CurrentUser;
  readonly requireTeacher: () => CurrentUser;
}

function identity(value: string | null): string | undefined {
  if (
    !value ||
    !/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) ||
    /(?:^|[._:-])(?:latest|current|default|fallback|unresolved)(?:$|[._:-])/i.test(value)
  )
    return undefined;
  return value;
}

function query(url: URL) {
  const courseId = identity(url.searchParams.get("course_id"));
  const journeyId = identity(url.searchParams.get("journey_id"));
  const runId = identity(url.searchParams.get("run_id"));
  const teamId = identity(url.searchParams.get("team_id"));
  return {
    ...(courseId ? { course_id: courseId } : {}),
    ...(journeyId ? { journey_id: journeyId } : {}),
    ...(runId ? { run_id: runId } : {}),
    ...(teamId ? { team_id: teamId } : {})
  };
}

function errorStatus(error: GoldenJourneyIntegrationError): number {
  return error.statusCode === 404 ? 404 : error.statusCode === 403 ? 403 : 422;
}

export function isGoldenJourneyRoute(method: string | undefined, url: URL): boolean {
  return (
    method === "GET" &&
    /^\/api\/v1\/bff\/(teacher|student)\/golden-journey\/(status|context|allowed-actions|receipts)$/.test(
      url.pathname
    )
  );
}

export async function handleGoldenJourneyRoute(
  runtime: { readonly goldenJourney: GoldenJourneyIntegrationService },
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: GoldenJourneyRouteContext,
  tools: GoldenJourneyRouteTools
): Promise<boolean> {
  if (!isGoldenJourneyRoute(request.method, url)) return false;
  const isStudent = url.pathname.startsWith("/api/v1/bff/student/");
  const actor = isStudent ? tools.requireStudent() : tools.requireTeacher();
  const role = isStudent ? "student" : actor.roles.includes("admin") ? "admin" : "teacher";
  try {
    const status = await runtime.goldenJourney.getStatus(
      context.tenantId,
      { role, ...(actor.team_id ? { team_id: actor.team_id } : {}), user_id: actor.user_id },
      query(url),
      context.requestId,
      context.correlationId
    );
    const data = url.pathname.endsWith("/context")
      ? status.context
      : url.pathname.endsWith("/allowed-actions")
        ? status.allowed_actions
        : url.pathname.endsWith("/receipts")
          ? status.receipt_index
          : status;
    tools.sendJson(response, 200, tools.createEnvelope(context, data));
    return true;
  } catch (error) {
    if (!(error instanceof GoldenJourneyIntegrationError)) throw error;
    tools.sendJson(response, errorStatus(error), {
      request_id: context.requestId,
      code: error.code,
      message: "R3 Golden Journey request rejected",
      details: [],
      correlation_id: context.correlationId
    });
    return true;
  }
}
