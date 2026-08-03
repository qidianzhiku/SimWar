import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiEnvelope, CurrentUser } from "@simwar/shared-contracts";
import {
  StudentLearningReportProjectionError,
  type StudentLearningReportActor,
  type StudentLearningReportProjectionService
} from "../student-learning-report-projection.js";

export interface StudentLearningReportRouteContext {
  readonly requestId: string;
  readonly tenantId: string;
}

export interface StudentLearningReportRouteRuntime {
  readonly projections: StudentLearningReportProjectionService;
}

export interface StudentLearningReportRouteHelpers {
  createEnvelope<TData>(context: StudentLearningReportRouteContext, data: TData): ApiEnvelope<TData>;
  requireStudent(): CurrentUser;
  requireTeacher(): CurrentUser;
  requireAdmin(): CurrentUser;
  sendJson(response: ServerResponse, status: number, payload: unknown): void;
}

function reportId(value: string | undefined): string {
  if (
    !value ||
    value.trim() !== value ||
    !/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) ||
    /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  ) {
    throw new StudentLearningReportProjectionError("D4_REPORT_REFERENCE_INVALID");
  }
  return value;
}

function actor(value: CurrentUser): StudentLearningReportActor {
  return {
    tenant_id: value.tenant_id,
    user_id: value.user_id,
    ...(value.team_id ? { team_id: value.team_id } : {})
  };
}

function errorResponse(error: unknown): { status: number; payload: { code: string; message: string } } {
  const code =
    error instanceof StudentLearningReportProjectionError
      ? error.code
      : "D4_REPORT_OUTPUT_INVALID";
  const status =
    code === "D4_REPORT_SCOPE_VIOLATION"
      ? 403
      : code === "D4_REPORT_NOT_FOUND" || code === "D4_REPORT_NOT_AVAILABLE"
        ? 404
        : 422;
  return { status, payload: { code, message: "D4 student learning report projection rejected" } };
}

export function isStudentLearningReportRoute(method: string | undefined, url: URL): boolean {
  return (
    method === "GET" &&
    /^\/api\/v1\/bff\/(?:student|teacher|admin)\/learning-reports(?:\/[^/]+)?$/.test(url.pathname)
  );
}

export async function handleStudentLearningReportRoute(
  runtime: StudentLearningReportRouteRuntime,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: StudentLearningReportRouteContext,
  helpers: StudentLearningReportRouteHelpers
): Promise<boolean> {
  if (!isStudentLearningReportRoute(request.method, url)) return false;
  const match = /^\/api\/v1\/bff\/(student|teacher|admin)\/learning-reports(?:\/([^/]+))?$/.exec(
    url.pathname
  );
  const surface = match?.[1];
  const requestedReportId = match?.[2];
  const current =
    surface === "student"
      ? helpers.requireStudent()
      : surface === "teacher"
        ? helpers.requireTeacher()
        : helpers.requireAdmin();
  try {
    if (surface === "student") {
      const reportActor = actor(current);
      const data = requestedReportId
        ? await runtime.projections.getStudent(reportActor, reportId(requestedReportId))
        : await runtime.projections.listStudent(reportActor);
      helpers.sendJson(response, 200, helpers.createEnvelope(context, data));
      return true;
    }
    const reportActor = actor(current);
    const data = requestedReportId
      ? await runtime.projections.getPreview(reportActor, reportId(requestedReportId))
      : await runtime.projections.listPreview(reportActor);
    helpers.sendJson(response, 200, helpers.createEnvelope(context, data));
    return true;
  } catch (error) {
    const mapped = errorResponse(error);
    helpers.sendJson(response, mapped.status, helpers.createEnvelope(context, mapped.payload));
    return true;
  }
}
