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
  MODEL_VERSION_REF,
  OperatingWorldError,
  OperatingWorldService,
  type OperatingWorldBindInput,
  type OperatingWorldDraftInput,
  type OperatingWorldServiceActor,
  type OperatingWorldServiceScope
} from "../operating-world-service.js";

const ACTIVITY_ID = "sh-m3-operating-world";
const TEACHER_PREFIX = "/api/v1/bff/teacher/operating-world";
const STUDENT_PREFIX = "/api/v1/bff/student/operating-world";
const ADMIN_PREFIX = "/api/v1/bff/admin/operating-world";

interface RouteContext {
  requestId: string;
  tenantId: string;
}

interface RouteDependencies {
  actorHasAnyRole(actor: CurrentUser, roles: readonly string[]): boolean;
  createContext(request: IncomingMessage): RouteContext;
  createEnvelope<TData>(context: RouteContext, data: TData, message?: string): ApiEnvelope<TData>;
  readJson<TBody>(request: IncomingMessage, options?: { requiredObject?: boolean }): Promise<TBody>;
  repository: RepositoryFacade;
  resolveExactReferences?: (
    tenantId: string,
    run: Run
  ) => Promise<{
    parameter_set_reference: ParameterSetReference;
    scenario_package_reference: ScenarioPackageReference;
  } | null>;
  requirePermission(context: RouteContext, permission: PermissionKey): CurrentUser;
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

function serviceActor(actor: CurrentUser): OperatingWorldServiceActor {
  const role = actor.roles.find((candidate) =>
    ["teacher", "student", "learner", "admin", "tenant_admin", "platform_admin"].includes(candidate)
  );
  if (!role) throw new OperatingWorldError("OW_ROLE_FORBIDDEN");
  return {
    actor_id: actor.user_id,
    role: role as OperatingWorldServiceActor["role"],
    tenant_id: actor.tenant_id
  };
}

function scope(
  courseId: string,
  extras: Partial<OperatingWorldServiceScope> = {}
): OperatingWorldServiceScope {
  return { activity_id: ACTIVITY_ID, course_id: courseId, ...extras };
}

function draftId(
  pathname: string,
  suffix: "validate" | "preview" | "freeze" | "bind" | "official-consumer"
) {
  const match = pathname.match(new RegExp(`^${TEACHER_PREFIX}/drafts/([^/]+)/${suffix}$`));
  return match?.[1];
}

function send<TData>(
  deps: RouteDependencies,
  context: RouteContext,
  response: ServerResponse,
  statusCode: number,
  data: TData
): void {
  deps.sendJson(response, statusCode, deps.createEnvelope(context, data));
}

async function resolveCourse(
  deps: RouteDependencies,
  tenantId: string,
  courseId: string
): Promise<void> {
  const course = await deps.repository.courses.getCourse(tenantId, courseId);
  if (!course || course.tenant_id !== tenantId) throw new OperatingWorldError("OW_SCOPE_CONFLICT");
}

async function resolveRun(
  deps: RouteDependencies,
  tenantId: string,
  runId: string,
  roundNo: number
): Promise<Run> {
  const run = await deps.repository.runs.getRun(tenantId, runId);
  if (!run || run.tenant_id !== tenantId) throw new OperatingWorldError("OW_SCOPE_CONFLICT");
  const rounds = await deps.repository.rounds.listRoundsForRun(tenantId, runId);
  if (!rounds.some((round) => round.round_no === roundNo && round.tenant_id === tenantId)) {
    throw new OperatingWorldError("OW_EXACT_BINDING_REQUIRED");
  }
  return run;
}

async function exactReferences(
  deps: RouteDependencies,
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
  if (!parameterSet || !scenario) throw new OperatingWorldError("OW_EXACT_BINDING_REQUIRED");
  const digest = (value: unknown) => cryptoDigest(JSON.stringify(value));
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

function cryptoDigest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requireRole(
  deps: RouteDependencies,
  context: RouteContext,
  roles: readonly string[]
): CurrentUser {
  const actor = deps.requirePermission(context, "course:read");
  if (!deps.actorHasAnyRole(actor, roles) || actor.tenant_id !== context.tenantId) {
    throw new OperatingWorldError("OW_SCOPE_CONFLICT");
  }
  return actor;
}

export function isOperatingWorldRoute(method: string | undefined, url: URL): boolean {
  if (
    method === "GET" &&
    [`${TEACHER_PREFIX}/studio`, `${ADMIN_PREFIX}/audit`, `${STUDENT_PREFIX}/brief`].includes(
      url.pathname
    )
  )
    return true;
  if (
    method === "GET" &&
    url.pathname.startsWith(`${TEACHER_PREFIX}/drafts/`) &&
    url.pathname.endsWith("/official-consumer")
  )
    return true;
  if (method === "POST" && url.pathname === `${TEACHER_PREFIX}/drafts`) return true;
  return (
    method === "POST" &&
    ["validate", "preview", "freeze", "bind"].some(
      (suffix) =>
        draftId(url.pathname, suffix as "validate" | "preview" | "freeze" | "bind") !== undefined
    )
  );
}

export async function handleOperatingWorldRoute(
  service: OperatingWorldService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  deps: RouteDependencies
): Promise<boolean> {
  if (!isOperatingWorldRoute(request.method, url)) return false;
  const context = deps.createContext(request);

  if (request.method === "GET" && url.pathname === `${TEACHER_PREFIX}/studio`) {
    const actor = requireRole(deps, context, ["teacher"]);
    const courseId = url.searchParams.get("courseId") ?? "";
    await resolveCourse(deps, context.tenantId, courseId);
    send(
      deps,
      context,
      response,
      200,
      service.getTeacherProjection(serviceActor(actor), scope(courseId))
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === `${TEACHER_PREFIX}/drafts`) {
    const actor = requireRole(deps, context, ["teacher"]);
    const body = await deps.readJson<Record<string, unknown>>(request, { requiredObject: true });
    const courseId = nonBlank(body.course_id) ? body.course_id : "";
    await resolveCourse(deps, context.tenantId, courseId);
    if (!isRecord(body.families)) throw new OperatingWorldError("OW_INVALID_VALUE");
    const families = body.families;
    send(
      deps,
      context,
      response,
      201,
      service.createDraft(serviceActor(actor), scope(courseId), {
        families: families as unknown as OperatingWorldDraftInput["families"],
        ...(integer(body.seed) ? { seed: body.seed } : {}),
        ...(nonBlank(body.title) ? { title: body.title } : {})
      })
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === `${STUDENT_PREFIX}/brief`) {
    const actor = requireRole(deps, context, ["student", "learner"]);
    const courseId = url.searchParams.get("courseId") ?? "";
    const draft = url.searchParams.get("draftId") ?? "";
    const runId = url.searchParams.get("runId") ?? "";
    const roundNo = Number(url.searchParams.get("roundNo"));
    if (!courseId || !draft || !runId || !Number.isSafeInteger(roundNo)) {
      throw new OperatingWorldError("OW_EXACT_BINDING_REQUIRED");
    }
    const run = await resolveRun(deps, context.tenantId, runId, roundNo);
    if (run.course_id !== courseId) throw new OperatingWorldError("OW_SCOPE_CONFLICT");
    if (!(await deps.repository.teams.getTeamForUser(context.tenantId, runId, actor.user_id))) {
      throw new OperatingWorldError("OW_SCOPE_CONFLICT");
    }
    send(
      deps,
      context,
      response,
      200,
      service.projectStudent(
        serviceActor(actor),
        scope(courseId, { run_id: runId, round_no: roundNo }),
        draft
      )
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === `${ADMIN_PREFIX}/audit`) {
    const actor = requireRole(deps, context, ["admin", "tenant_admin", "platform_admin"]);
    const courseId = url.searchParams.get("courseId") ?? "";
    const draft = url.searchParams.get("draftId") ?? "";
    if (!courseId || !draft) throw new OperatingWorldError("OW_EXACT_BINDING_REQUIRED");
    await resolveCourse(deps, context.tenantId, courseId);
    send(
      deps,
      context,
      response,
      200,
      service.getAdminAudit(serviceActor(actor), scope(courseId), draft)
    );
    return true;
  }

  const action = (["validate", "preview", "freeze", "bind"] as const).find(
    (candidate) => draftId(url.pathname, candidate) !== undefined
  );
  if (request.method === "POST" && action) {
    const actor = requireRole(deps, context, ["teacher"]);
    const id = draftId(url.pathname, action);
    if (!id) throw new OperatingWorldError("OW_DRAFT_NOT_FOUND");
    const body = await deps.readJson<Record<string, unknown>>(request, { requiredObject: false });
    const bodyValue = isRecord(body) ? body : {};
    const courseId =
      url.searchParams.get("courseId") ??
      (nonBlank(bodyValue.course_id) ? bodyValue.course_id : "");
    if (!courseId) throw new OperatingWorldError("OW_SCOPE_CONFLICT");
    const draft = service.getDraft(serviceActor(actor), scope(courseId), id);
    const baseScope = scope(draft.course_id, {
      ...(integer(bodyValue.round_no) ? { round_no: bodyValue.round_no } : {}),
      ...(nonBlank(bodyValue.run_id) ? { run_id: bodyValue.run_id } : {})
    });
    if (action === "validate") {
      send(deps, context, response, 200, service.validateDraft(serviceActor(actor), baseScope, id));
    } else if (action === "preview") {
      const variant =
        bodyValue.variant === "LOW" || bodyValue.variant === "HIGH" ? bodyValue.variant : "BASE";
      send(
        deps,
        context,
        response,
        200,
        service.previewDraft(serviceActor(actor), baseScope, id, variant)
      );
    } else if (action === "freeze") {
      send(deps, context, response, 200, service.freezeDraft(serviceActor(actor), baseScope, id));
    } else {
      if (!nonBlank(bodyValue.run_id) || !integer(bodyValue.round_no))
        throw new OperatingWorldError("OW_EXACT_BINDING_REQUIRED");
      const run = await resolveRun(deps, context.tenantId, bodyValue.run_id, bodyValue.round_no);
      if (run.course_id !== draft.course_id) throw new OperatingWorldError("OW_SCOPE_CONFLICT");
      const refs = await exactReferences(deps, context.tenantId, run);
      const input: OperatingWorldBindInput = {
        model_version_ref: MODEL_VERSION_REF,
        parameter_set_reference: refs.parameter_set_reference,
        round_no: bodyValue.round_no,
        run_id: bodyValue.run_id,
        scenario_package_reference: refs.scenario_package_reference,
        seed: integer(bodyValue.seed) ? bodyValue.seed : run.seed
      };
      send(
        deps,
        context,
        response,
        200,
        service.bindDraft(serviceActor(actor), baseScope, id, input)
      );
    }
    return true;
  }

  if (
    request.method === "GET" &&
    url.pathname.startsWith(`${TEACHER_PREFIX}/drafts/`) &&
    url.pathname.endsWith("/official-consumer")
  ) {
    const actor = requireRole(deps, context, ["teacher"]);
    const id = url.pathname.split("/").at(-2) ?? "";
    const courseId = url.searchParams.get("courseId") ?? "";
    const runId = url.searchParams.get("runId") ?? "";
    const roundNo = Number(url.searchParams.get("roundNo"));
    if (!courseId || !runId || !Number.isSafeInteger(roundNo)) {
      throw new OperatingWorldError("OW_EXACT_BINDING_REQUIRED");
    }
    await resolveCourse(deps, context.tenantId, courseId);
    send(
      deps,
      context,
      response,
      200,
      service.getOfficialConsumerInput(
        serviceActor(actor),
        scope(courseId, { run_id: runId, round_no: roundNo }),
        id
      )
    );
    return true;
  }
  return false;
}

export { OperatingWorldError };
