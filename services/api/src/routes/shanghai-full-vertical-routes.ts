import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  ApiEnvelope,
  CurrentUser,
  ParameterSetReference,
  PermissionKey,
  Run,
  ScenarioPackageReference
} from "@simwar/shared-contracts";
import {
  createParameterSetReference,
  createScenarioPackageReference
} from "@simwar/shared-contracts";
import type { RepositoryFacade } from "../repository-facade.js";
import {
  ShanghaiFullVerticalError,
  ShanghaiFullVerticalService,
  type ShanghaiFullVerticalExactReadContext
} from "../shanghai-full-vertical-service.js";
import { W5GovernedModelError, type W5ServiceActor } from "../w5-governed-model-service.js";

const TEACHER_PREFIX = "/api/v1/bff/teacher/shanghai";
const STUDENT_PREFIX = "/api/v1/bff/student/shanghai";
const ADMIN_PREFIX = "/api/v1/bff/admin/shanghai";

interface ShanghaiRouteContext {
  requestId: string;
  tenantId: string;
  actor?: CurrentUser;
}

interface ShanghaiRouteDependencies {
  actorHasAnyRole(actor: CurrentUser, roles: readonly string[]): boolean;
  createContext(request: IncomingMessage): ShanghaiRouteContext;
  createEnvelope<TData>(
    context: ShanghaiRouteContext,
    data: TData,
    message?: string
  ): ApiEnvelope<TData>;
  repository: RepositoryFacade;
  resolveExactReferences?: (
    tenantId: string,
    run: Run
  ) => Promise<{
    parameter_set_reference: ParameterSetReference;
    scenario_package_reference: ScenarioPackageReference;
  } | null>;
  requirePermission(context: ShanghaiRouteContext, permission: PermissionKey): CurrentUser;
  sendJson(response: ServerResponse, statusCode: number, body: unknown): void;
}

function nonBlank(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

function exactRound(value: string | null): number | null {
  if (!nonBlank(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function stable(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value), "utf8").digest("hex");
}

function actorForService(actor: CurrentUser): W5ServiceActor {
  const role = actor.roles.find((candidate) =>
    ["learner", "student", "teacher", "tenant_admin", "platform_admin"].includes(candidate)
  );
  if (!role) throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
  return {
    actor_id: actor.user_id,
    role: role as W5ServiceActor["role"],
    tenant_id: actor.tenant_id
  };
}

function assertTeacher(
  deps: ShanghaiRouteDependencies,
  context: ShanghaiRouteContext
): CurrentUser {
  const actor = deps.requirePermission(context, "course:read");
  if (!deps.actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
    throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
  }
  return actor;
}

function assertStudent(
  deps: ShanghaiRouteDependencies,
  context: ShanghaiRouteContext
): CurrentUser {
  const actor = deps.requirePermission(context, "course:read");
  if (
    !deps.actorHasAnyRole(actor, ["learner", "student"]) ||
    actor.tenant_id !== context.tenantId
  ) {
    throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
  }
  return actor;
}

function assertAdmin(deps: ShanghaiRouteDependencies, context: ShanghaiRouteContext): CurrentUser {
  const actor = deps.requirePermission(context, "course:read");
  if (!deps.actorHasAnyRole(actor, ["tenant_admin"]) || actor.tenant_id !== context.tenantId) {
    throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
  }
  return actor;
}

async function resolveCourse(
  deps: ShanghaiRouteDependencies,
  tenantId: string,
  courseId: string
): Promise<{ course_id: string; tenant_id: string }> {
  const course = await deps.repository.courses.getCourse(tenantId, courseId);
  if (!course || course.tenant_id !== tenantId) {
    throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
  }
  return { course_id: course.course_id, tenant_id: course.tenant_id };
}

async function resolveRun(
  deps: ShanghaiRouteDependencies,
  tenantId: string,
  runId: string,
  roundNo: number
): Promise<Run> {
  const run = await deps.repository.runs.getRun(tenantId, runId);
  if (!run || run.tenant_id !== tenantId) {
    throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
  }
  const rounds = await deps.repository.rounds.listRoundsForRun(tenantId, runId);
  if (!rounds.some((round) => round.round_no === roundNo && round.tenant_id === tenantId)) {
    throw new W5GovernedModelError("W5_EXACT_BINDING_REQUIRED");
  }
  return run;
}

async function exactReferences(
  deps: ShanghaiRouteDependencies,
  tenantId: string,
  run: Run
): Promise<{
  parameter_set_reference: ParameterSetReference;
  scenario_package_reference: ScenarioPackageReference;
}> {
  const authoritative = await deps.resolveExactReferences?.(tenantId, run);
  if (authoritative) return authoritative;
  const [parameterSet, scenario] = await Promise.all([
    deps.repository.parameterSets.getParameterSet(tenantId, run.parameter_set_id),
    deps.repository.scenarios.getScenarioPackage(tenantId, run.scenario_package_id)
  ]);
  if (!parameterSet || !scenario) {
    throw new W5GovernedModelError("W5_EXACT_BINDING_REQUIRED");
  }
  return {
    parameter_set_reference: createParameterSetReference({
      content_digest: digest(parameterSet),
      parameter_set_id: parameterSet.parameter_set_id,
      version: parameterSet.version
    }),
    scenario_package_reference: createScenarioPackageReference({
      content_digest: digest(scenario),
      scenario_package_id: scenario.scenario_package_id,
      tenant_id: scenario.tenant_id,
      version: scenario.version
    })
  };
}

function send<TData>(
  deps: ShanghaiRouteDependencies,
  context: ShanghaiRouteContext,
  response: ServerResponse,
  data: TData
): void {
  deps.sendJson(response, 200, deps.createEnvelope(context, data));
}

function mapServiceError(error: unknown): never {
  if (error instanceof ShanghaiFullVerticalError) {
    throw new W5GovernedModelError(
      error.code === "SHANGHAI_FULL_VERTICAL_SCOPE_CONFLICT"
        ? "W5_SCOPE_CONFLICT"
        : "W5_EXACT_BINDING_REQUIRED"
    );
  }
  throw error;
}

function readExactQuery(url: URL): {
  draftId: string | null;
  roundNo: number | null;
  runId: string | null;
} {
  return {
    draftId: nonBlank(url.searchParams.get("draftId")) ? url.searchParams.get("draftId") : null,
    roundNo: exactRound(url.searchParams.get("roundNo")),
    runId: nonBlank(url.searchParams.get("runId")) ? url.searchParams.get("runId") : null
  };
}

export function isShanghaiFullVerticalRoute(method: string | undefined, url: URL): boolean {
  return (
    method === "GET" &&
    [
      `${TEACHER_PREFIX}/full-vertical`,
      `${STUDENT_PREFIX}/full-vertical`,
      `${ADMIN_PREFIX}/full-vertical`
    ].includes(url.pathname)
  );
}

export async function handleShanghaiFullVerticalRoute(
  service: ShanghaiFullVerticalService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  deps: ShanghaiRouteDependencies
): Promise<boolean> {
  if (!isShanghaiFullVerticalRoute(request.method, url)) return false;

  const context = deps.createContext(request);
  try {
    if (url.pathname === `${TEACHER_PREFIX}/full-vertical`) {
      const actor = assertTeacher(deps, context);
      const courseId = url.searchParams.get("courseId") ?? "";
      await resolveCourse(deps, context.tenantId, courseId);
      const query = readExactQuery(url);
      if ((query.runId === null) !== (query.roundNo === null)) {
        throw new W5GovernedModelError("W5_EXACT_BINDING_REQUIRED");
      }
      let refs: {
        parameter_set_reference: ParameterSetReference;
        scenario_package_reference: ScenarioPackageReference;
      } | null = null;
      if (query.runId !== null && query.roundNo !== null) {
        const run = await resolveRun(deps, context.tenantId, query.runId, query.roundNo);
        if (run.course_id !== courseId) {
          throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
        }
        refs = await exactReferences(deps, context.tenantId, run);
      }
      send(
        deps,
        context,
        response,
        service.getTeacher(actorForService(actor), {
          course_id: courseId,
          current_parameter_set_reference: refs?.parameter_set_reference ?? null,
          current_scenario_package_reference: refs?.scenario_package_reference ?? null,
          draft_id: query.draftId,
          round_no: query.roundNo,
          run_id: query.runId
        })
      );
      return true;
    }

    const query = readExactQuery(url);
    if (query.draftId === null || query.runId === null || query.roundNo === null) {
      throw new W5GovernedModelError("W5_EXACT_BINDING_REQUIRED");
    }
    const run = await resolveRun(deps, context.tenantId, query.runId, query.roundNo);
    const requestedCourseId = url.searchParams.get("courseId");
    if (url.pathname === `${ADMIN_PREFIX}/full-vertical`) {
      if (!nonBlank(requestedCourseId)) {
        throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
      }
      await resolveCourse(deps, context.tenantId, requestedCourseId);
      if (requestedCourseId !== run.course_id) {
        throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
      }
    }
    const refs = await exactReferences(deps, context.tenantId, run);
    const exactContext: ShanghaiFullVerticalExactReadContext = {
      course_id: requestedCourseId ?? run.course_id,
      current_parameter_set_reference: refs.parameter_set_reference,
      current_scenario_package_reference: refs.scenario_package_reference,
      draft_id: query.draftId,
      round_no: query.roundNo,
      run_id: query.runId
    };

    if (url.pathname === `${STUDENT_PREFIX}/full-vertical`) {
      const actor = assertStudent(deps, context);
      const team = await deps.repository.teams.getTeamForUser(
        context.tenantId,
        run.run_id,
        actor.user_id
      );
      if (!team) throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
      send(
        deps,
        context,
        response,
        service.getStudent(actorForService(actor), { ...exactContext, team_id: team.team_id })
      );
      return true;
    }

    const actor = assertAdmin(deps, context);
    await resolveCourse(deps, context.tenantId, run.course_id);
    send(deps, context, response, service.getAdmin(actorForService(actor), exactContext));
    return true;
  } catch (error) {
    mapServiceError(error);
  }
}
