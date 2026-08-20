import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  ApiEnvelope,
  CurrentUser,
  ParameterSetReference,
  PermissionKey,
  Run,
  ScenarioPackageReference,
  W5ExperienceProfile
} from "@simwar/shared-contracts";
import {
  createParameterSetReference,
  createScenarioPackageReference
} from "@simwar/shared-contracts";
import type { RepositoryFacade } from "../repository-facade.js";
import {
  W5GovernedModelError,
  W5GovernedModelService,
  type W5BindDraftInput,
  type W5CreateDraftInput,
  type W5ServiceActor,
  type W5ServiceScope
} from "../w5-governed-model-service.js";

const ACTIVITY_ID = "w5-governed-model-studio";
const TEACHER_PREFIX = "/api/v1/bff/teacher/w5";
const STUDENT_PREFIX = "/api/v1/bff/student/w5";

interface W5RouteContext {
  requestId: string;
  tenantId: string;
  actor?: CurrentUser;
}

interface W5RouteDependencies {
  actorHasAnyRole(actor: CurrentUser, roles: readonly string[]): boolean;
  createContext(request: IncomingMessage): W5RouteContext;
  createEnvelope<TData>(context: W5RouteContext, data: TData, message?: string): ApiEnvelope<TData>;
  readJson<TBody>(request: IncomingMessage, options?: { requiredObject?: boolean }): Promise<TBody>;
  repository: RepositoryFacade;
  resolveExactReferences?: (
    tenantId: string,
    run: Run
  ) => Promise<{
    parameter_set_reference: ParameterSetReference;
    scenario_package_reference: ScenarioPackageReference;
  } | null>;
  requirePermission(context: W5RouteContext, permission: PermissionKey): CurrentUser;
  sendJson(response: ServerResponse, statusCode: number, body: unknown): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
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

function serviceActor(actor: CurrentUser): W5ServiceActor {
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

function scope(courseId: string, extras: Partial<W5ServiceScope> = {}): W5ServiceScope {
  return { activity_id: ACTIVITY_ID, course_id: courseId, ...extras };
}

function pathDraftId(pathname: string, suffix: "validate" | "freeze" | "bind" | "evaluate") {
  const match = pathname.match(
    new RegExp(`^${TEACHER_PREFIX}/scenario-studio/drafts/([^/]+)/${suffix}$`)
  );
  return match?.[1];
}

function parseProfile(value: unknown): W5ExperienceProfile {
  return value === "ADVANCED" ? "ADVANCED" : "STANDARD";
}

async function resolveCourse(
  deps: W5RouteDependencies,
  tenantId: string,
  courseId: string
): Promise<{ course_id: string; tenant_id: string }> {
  const course = await deps.repository.courses.getCourse(tenantId, courseId);
  if (!course || course.tenant_id !== tenantId) throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
  return { course_id: course.course_id, tenant_id: course.tenant_id };
}

async function resolveRun(
  deps: W5RouteDependencies,
  tenantId: string,
  runId: string,
  roundNo?: number
) {
  const run = await deps.repository.runs.getRun(tenantId, runId);
  if (!run || run.tenant_id !== tenantId) throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
  if (roundNo !== undefined) {
    const rounds = await deps.repository.rounds.listRoundsForRun(tenantId, runId);
    if (!rounds.some((round) => round.round_no === roundNo && round.tenant_id === tenantId)) {
      throw new W5GovernedModelError("W5_EXACT_BINDING_REQUIRED");
    }
  }
  return run;
}

async function exactReferences(
  deps: W5RouteDependencies,
  tenantId: string,
  run: Awaited<ReturnType<typeof resolveRun>>
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
  if (!parameterSet || !scenario) throw new W5GovernedModelError("W5_EXACT_BINDING_REQUIRED");
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

function assertTeacher(deps: W5RouteDependencies, context: W5RouteContext): CurrentUser {
  const actor = deps.requirePermission(context, "course:read");
  if (!deps.actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
    throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
  }
  return actor;
}

function assertStudent(deps: W5RouteDependencies, context: W5RouteContext): CurrentUser {
  const actor = deps.requirePermission(context, "course:read");
  if (!deps.actorHasAnyRole(actor, ["learner", "student"]) || actor.tenant_id !== context.tenantId) {
    throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
  }
  return actor;
}

function send<TData>(
  deps: W5RouteDependencies,
  context: W5RouteContext,
  response: ServerResponse,
  statusCode: number,
  data: TData
): void {
  deps.sendJson(response, statusCode, deps.createEnvelope(context, data));
}

export function isW5GovernedModelRoute(method: string | undefined, url: URL): boolean {
  if (method === "GET" && url.pathname === `${TEACHER_PREFIX}/governed-model`) return true;
  if (method === "GET" && url.pathname === `${STUDENT_PREFIX}/convergence`) return true;
  return (
    method === "POST" &&
    (url.pathname === `${TEACHER_PREFIX}/scenario-studio/drafts` ||
      pathDraftId(url.pathname, "validate") !== undefined ||
      pathDraftId(url.pathname, "freeze") !== undefined ||
      pathDraftId(url.pathname, "bind") !== undefined ||
      pathDraftId(url.pathname, "evaluate") !== undefined)
  );
}

export async function handleW5GovernedModelRoute(
  service: W5GovernedModelService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  deps: W5RouteDependencies
): Promise<boolean> {
  if (!isW5GovernedModelRoute(request.method, url)) return false;

  const context = deps.createContext(request);
  if (request.method === "GET" && url.pathname === `${TEACHER_PREFIX}/governed-model`) {
    const actor = assertTeacher(deps, context);
    const courseId = url.searchParams.get("courseId") ?? "";
    await resolveCourse(deps, context.tenantId, courseId);
    send(deps, context, response, 200, service.getTeacherProjection(serviceActor(actor), scope(courseId)));
    return true;
  }

  if (request.method === "POST" && url.pathname === `${TEACHER_PREFIX}/scenario-studio/drafts`) {
    const actor = assertTeacher(deps, context);
    const body = await deps.readJson<Record<string, unknown>>(request, { requiredObject: true });
    const courseId = nonBlank(body.course_id) ? body.course_id : "";
    await resolveCourse(deps, context.tenantId, courseId);
    const input: W5CreateDraftInput = {};
    if (nonBlank(body.title)) input.title = body.title;
    if (integer(body.seed)) input.seed = body.seed;
    if (
      body.data_classification === "REALITY" ||
      body.data_classification === "SYNTHETIC" ||
      body.data_classification === "ASSUMPTION" ||
      body.data_classification === "STRESS_TEST"
    ) {
      input.data_classification = body.data_classification;
    }
    if (isRecord(body.parameters)) {
      input.parameters = body.parameters as NonNullable<W5CreateDraftInput["parameters"]>;
    }
    send(deps, context, response, 201, service.createDraft(serviceActor(actor), scope(courseId), input));
    return true;
  }

  const action = (["validate", "freeze", "bind", "evaluate"] as const).find(
    (candidate) => pathDraftId(url.pathname, candidate) !== undefined
  );
  if (request.method === "POST" && action) {
    const draftId = pathDraftId(url.pathname, action);
    if (!draftId) throw new W5GovernedModelError("W5_DRAFT_NOT_FOUND");
    const actor = assertTeacher(deps, context);
    const body = await deps.readJson<Record<string, unknown>>(request, { requiredObject: false });
    const bodyValue = isRecord(body) ? body : {};
    const runId = nonBlank(bodyValue.run_id) ? bodyValue.run_id : undefined;
    const roundNo = integer(bodyValue.round_no) ? bodyValue.round_no : undefined;
    const run = runId ? await resolveRun(deps, context.tenantId, runId, roundNo) : undefined;
    const draft = service.getDraftForTenant(serviceActor(actor), draftId);
    if (run && draft.course_id !== run.course_id) {
      throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
    }
    const courseId = draft.course_id;
    const serviceScope = scope(courseId, {
      ...(runId ? { run_id: runId } : {}),
      ...(roundNo !== undefined ? { round_no: roundNo } : {})
    });
    if (action === "validate") {
      send(deps, context, response, 200, service.validateDraft(serviceActor(actor), serviceScope, draftId));
      return true;
    }
    if (action === "freeze") {
      send(deps, context, response, 200, service.freezeDraft(serviceActor(actor), serviceScope, draftId));
      return true;
    }
    if (!run || roundNo === undefined) throw new W5GovernedModelError("W5_EXACT_BINDING_REQUIRED");
    if (action === "bind") {
      const refs = await exactReferences(deps, context.tenantId, run);
      const input: W5BindDraftInput = {
        ...refs,
        round_no: roundNo,
        run_id: run.run_id,
        seed: integer(bodyValue.seed) ? bodyValue.seed : run.seed
      };
      send(deps, context, response, 200, service.bindDraft(serviceActor(actor), serviceScope, draftId, input));
      return true;
    }
    const profile = parseProfile(bodyValue.experience_profile);
    send(deps, context, response, 200, {
      convergence: service.evaluate(serviceActor(actor), serviceScope, draftId, profile, {
        model_plane: bodyValue.model_plane === "OFF" ? "OFF" : "ON"
      })
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === `${STUDENT_PREFIX}/convergence`) {
    const actor = assertStudent(deps, context);
    const draftId = url.searchParams.get("draftId") ?? "";
    const runId = url.searchParams.get("runId") ?? "";
    const roundNo = Number(url.searchParams.get("roundNo"));
    if (!draftId || !runId || !Number.isSafeInteger(roundNo)) {
      throw new W5GovernedModelError("W5_EXACT_BINDING_REQUIRED");
    }
    const run = await resolveRun(deps, context.tenantId, runId, roundNo);
    const enrolledTeam = await deps.repository.teams.getTeamForUser(
      context.tenantId,
      run.run_id,
      actor.user_id
    );
    if (!enrolledTeam) throw new W5GovernedModelError("W5_SCOPE_CONFLICT");
    send(
      deps,
      context,
      response,
      200,
      service.projectStudent(
        serviceActor(actor),
        scope(run.course_id, { round_no: roundNo, run_id: runId }),
        draftId,
        parseProfile(url.searchParams.get("experienceProfile"))
      )
    );
    return true;
  }

  return false;
}

export { W5GovernedModelError };
