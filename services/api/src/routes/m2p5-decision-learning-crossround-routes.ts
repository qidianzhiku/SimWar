import type { IncomingMessage, ServerResponse } from "node:http";
import {
  advanceStudentDecisionContextEvidence,
  type M2P5DecisionLearningContext,
  type StudentDecisionContextEvidence
} from "@simwar/shared-contracts";
import {
  M2P5DecisionLearningError,
  type M2P5DecisionLearningActor,
  type M2P5DecisionLearningCrossRoundService
} from "../m2p5-decision-learning-crossround.js";

export interface M2P5RouteContext {
  readonly requestId: string;
  readonly tenantId: string;
}

export interface M2P5RouteHelpers {
  readonly createEnvelope: (context: M2P5RouteContext, payload: unknown) => unknown;
  readonly requireStudent: () => M2P5DecisionLearningActor;
  readonly requireTeacher: () => M2P5DecisionLearningActor;
  readonly resolveStudentDecisionContextEvidence?: (input: {
    actor: M2P5DecisionLearningActor;
    context: M2P5DecisionLearningContext;
  }) => Promise<StudentDecisionContextEvidence | undefined>;
  readonly sendJson: (response: ServerResponse, status: number, payload: unknown) => void;
}

function identity(value: string | null): string {
  if (
    !value ||
    value.trim() !== value ||
    !/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) ||
    /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  ) {
    throw new M2P5DecisionLearningError("M2P5_CONTEXT_INVALID");
  }
  return value;
}

function contextFromUrl(url: URL, tenantId: string, runId: string, roundNo: number) {
  const context: M2P5DecisionLearningContext = {
    activity_id: identity(url.searchParams.get("activity_id")),
    course_id: identity(url.searchParams.get("course_id")),
    role_key: identity(url.searchParams.get("role_key")),
    round_id: identity(url.searchParams.get("round_id")),
    round_no: Number(url.searchParams.get("round_no")),
    run_id: identity(url.searchParams.get("run_id")),
    team_id: identity(url.searchParams.get("team_id")),
    tenant_id: tenantId
  };
  if (
    context.run_id !== runId ||
    context.round_no !== roundNo ||
    !Number.isInteger(context.round_no) ||
    context.round_no < 1
  ) {
    throw new M2P5DecisionLearningError("M2P5_CONTEXT_INVALID");
  }
  return context;
}

function errorStatus(code: string): number {
  if (code === "M2P5_SCOPE_VIOLATION") return 403;
  if (code === "M2P5_ROUND_NOT_FOUND") return 404;
  if (code === "M2P5_OFFICIAL_RESULT_NOT_PUBLISHED" || code === "M2P5_CONTEXT_EVIDENCE_INVALID") {
    return 409;
  }
  return 422;
}

export function isM2P5DecisionLearningRoute(method: string | undefined, url: URL): boolean {
  return (
    method === "GET" &&
    /^\/api\/v1\/bff\/(?:student|teacher)\/m2p5\/runs\/[^/]+\/rounds\/\d+\/decision-learning$/.test(
      url.pathname
    )
  );
}

export async function handleM2P5DecisionLearningRoute(
  service: M2P5DecisionLearningCrossRoundService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  routeContext: M2P5RouteContext,
  helpers: M2P5RouteHelpers
): Promise<boolean> {
  if (!isM2P5DecisionLearningRoute(request.method, url)) return false;
  const match =
    /^\/api\/v1\/bff\/(student|teacher)\/m2p5\/runs\/([^/]+)\/rounds\/(\d+)\/decision-learning$/.exec(
      url.pathname
    );
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new M2P5DecisionLearningError("M2P5_CONTEXT_INVALID");
  }
  const surface = match[1] as "student" | "teacher";
  // Authentication/authorization errors must reach the server's normal HTTP
  // error mapper instead of being flattened into a projection validation error.
  const actor = surface === "student" ? helpers.requireStudent() : helpers.requireTeacher();
  try {
    const context = contextFromUrl(
      url,
      routeContext.tenantId,
      identity(match[2]),
      Number(match[3])
    );
    const result = await service.getJourney({
      actor,
      context,
      surface
    });
    const requestedEvidence = url.searchParams.has("decision_context_evidence_id")
      ? identity(url.searchParams.get("decision_context_evidence_id"))
      : undefined;
    if (requestedEvidence && surface !== "student") {
      throw new M2P5DecisionLearningError("M2P5_CONTEXT_EVIDENCE_INVALID");
    }
    const evidence = requestedEvidence
      ? await helpers.resolveStudentDecisionContextEvidence?.({ actor, context })
      : undefined;
    if (
      requestedEvidence &&
      (!evidence ||
        evidence.status !== "READY" ||
        evidence.evidence_id !== requestedEvidence ||
        evidence.scope.tenant_id !== context.tenant_id ||
        evidence.scope.course_id !== context.course_id ||
        evidence.scope.run_id !== context.run_id ||
        evidence.scope.round_id !== context.round_id ||
        evidence.scope.round_no !== context.round_no ||
        evidence.scope.team_id !== context.team_id ||
        evidence.scope.activity_id !== context.activity_id ||
        evidence.scope.role_key !== context.role_key)
    ) {
      throw new M2P5DecisionLearningError("M2P5_CONTEXT_EVIDENCE_INVALID");
    }
    const responseData = evidence
      ? {
          ...result,
          decision_context_evidence: advanceStudentDecisionContextEvidence(evidence, context)
        }
      : result;
    helpers.sendJson(response, 200, helpers.createEnvelope(routeContext, responseData));
  } catch (error) {
    const code = error instanceof M2P5DecisionLearningError ? error.code : "M2P5_OUTPUT_INVALID";
    helpers.sendJson(response, errorStatus(code), {
      request_id: routeContext.requestId,
      code,
      message: "M2-P5 decision learning projection rejected",
      details: []
    });
  }
  return true;
}
