import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import type {
  ApiErrorEnvelope,
  ApiEnvelope,
  CurrentUser,
  DecisionPayload,
  PublicResultView,
  RoundStatus
} from "@simwar/shared-contracts";
import { getApiHealthPayload } from "./health.js";
import { settleRound, validateDecisionPayload } from "./simulation.js";
import {
  DEFAULT_TENANT_ID,
  SERVICE_KERNEL_TOKEN,
  actorHasAnyRole,
  appendAudit,
  createP0Store,
  nextId,
  type SimWarStore
} from "./store.js";

const DEFAULT_PORT = 3000;

interface RequestContext {
  requestId: string;
  tenantId: string;
  actor?: CurrentUser;
}

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details: ApiErrorEnvelope["details"] = []
  ) {
    super(message);
  }
}

const defaultStore = createP0Store();

function createEnvelope<TData>(context: RequestContext, data: TData, message = "success"): ApiEnvelope<TData> {
  return {
    request_id: context.requestId,
    code: "OK",
    message,
    data
  };
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "access-control-allow-headers": "authorization, content-type, idempotency-key, x-request-id, x-service-principal, x-tenant-id",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function sendError(response: ServerResponse, context: RequestContext, error: HttpError): void {
  sendJson(response, error.statusCode, {
    request_id: context.requestId,
    code: error.code,
    message: error.message,
    details: error.details
  });
}

function getBearerToken(request: IncomingMessage): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  return header.slice("Bearer ".length);
}

function createContext(store: SimWarStore, request: IncomingMessage): RequestContext {
  const requestId = request.headers["x-request-id"]?.toString() ?? `req_${Date.now()}`;
  const tenantId = request.headers["x-tenant-id"]?.toString() ?? DEFAULT_TENANT_ID;
  const token = getBearerToken(request);
  const userId = token ? store.sessions.get(token) : undefined;
  const actor = userId ? store.users.find((user) => user.user_id === userId) : undefined;

  if (actor && actor.tenant_id !== tenantId) {
    throw new HttpError(403, "TENANT-403-001", "tenant boundary violation");
  }

  return actor
    ? {
        requestId,
        tenantId,
        actor
      }
    : {
    requestId,
        tenantId
      };
}

function requireActor(context: RequestContext): CurrentUser {
  if (!context.actor) {
    throw new HttpError(401, "AUTH-401-001", "authentication required");
  }

  return context.actor;
}

function requireRoles(context: RequestContext, roles: CurrentUser["roles"]): CurrentUser {
  const actor = requireActor(context);

  if (!actorHasAnyRole(actor, roles)) {
    throw new HttpError(403, "AUTHZ-403-001", "insufficient role");
  }

  return actor;
}

function requireServiceKernel(request: IncomingMessage): CurrentUser {
  const token = getBearerToken(request);
  const servicePrincipal = request.headers["x-service-principal"]?.toString();

  if (token !== SERVICE_KERNEL_TOKEN || servicePrincipal !== "service_kernel") {
    throw new HttpError(403, "AUTHZ-403-002", "service kernel credential required");
  }

  return {
    user_id: "service_kernel",
    tenant_id: DEFAULT_TENANT_ID,
    display_name: "Service Kernel",
    roles: ["service_kernel"]
  };
}

async function readJson<TBody>(request: IncomingMessage): Promise<TBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {} as TBody;
  }

  return JSON.parse(raw) as TBody;
}

function matchPath(pathname: string, pattern: RegExp): RegExpMatchArray {
  const match = pathname.match(pattern);

  if (!match) {
    throw new HttpError(404, "ROUTE-404-001", "not found");
  }

  return match;
}

function getCourse(store: SimWarStore, context: RequestContext, courseId: string) {
  const course = store.courses.find((candidate) => candidate.course_id === courseId && candidate.tenant_id === context.tenantId);
  if (!course) {
    throw new HttpError(404, "COURSE-404-001", "course not found");
  }

  return course;
}

function getRun(store: SimWarStore, context: RequestContext, runId: string) {
  const run = store.runs.find((candidate) => candidate.run_id === runId && candidate.tenant_id === context.tenantId);
  if (!run) {
    throw new HttpError(404, "RUN-404-001", "run not found");
  }

  return run;
}

function getRound(store: SimWarStore, context: RequestContext, runId: string, roundNo: number) {
  const round = store.rounds.find(
    (candidate) => candidate.run_id === runId && candidate.round_no === roundNo && candidate.tenant_id === context.tenantId
  );
  if (!round) {
    throw new HttpError(404, "ROUND-404-001", "round not found");
  }

  return round;
}

function createPublicResultView(store: SimWarStore, context: RequestContext, runId: string, roundNo: number): PublicResultView {
  const actor = requireActor(context);
  const round = getRound(store, context, runId, roundNo);
  const settlement = store.settlementResults.find((result) => result.run_id === runId && result.round_no === roundNo);
  const isTeacher = actorHasAnyRole(actor, ["teacher", "tenant_admin", "platform_admin"]);

  if (!settlement) {
    return {
      run_id: runId,
      round_no: roundNo,
      status: round.status,
      results: []
    };
  }

  const visibleTeamIds = isTeacher ? undefined : new Set([actor.team_id].filter((teamId): teamId is string => Boolean(teamId)));
  const visibleResults = settlement.team_results
    .filter((result) => !visibleTeamIds || visibleTeamIds.has(result.team_id))
    .map((result) => {
      if (isTeacher) {
        return result;
      }

      return {
        team_id: result.team_id,
        team_name: result.team_name,
        state_obs: result.state_obs,
        state_est: result.state_est
      };
    });

  return {
    run_id: runId,
    round_no: roundNo,
    status: round.status,
    replay_hash: settlement.replay_hash,
    results: visibleResults
  };
}

function assertRoundStatus(round: { status: RoundStatus }, expected: RoundStatus, code: string): void {
  if (round.status !== expected) {
    throw new HttpError(409, code, `round must be ${expected}`);
  }
}

async function routeRequest(store: SimWarStore, request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? "/", "http://localhost");
  const context = createContext(store, request);

  if (request.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/api/v1/health")) {
    sendJson(response, 200, createEnvelope(context, getApiHealthPayload()));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
    const body = await readJson<{ username?: string; password?: string }>(request);
    const user = store.users.find(
      (candidate) => candidate.username === body.username && candidate.password === body.password && candidate.tenant_id === context.tenantId
    );

    if (!user) {
      throw new HttpError(401, "AUTH-401-002", "invalid credentials");
    }

    const session = [...store.sessions.entries()].find((entry) => entry[1] === user.user_id);
    const accessToken = session?.[0] ?? `${user.username}-token`;
    store.sessions.set(accessToken, user.user_id);
    appendAudit(store, {
      actor: user,
      action: "auth.login",
      resourceType: "user",
      resourceId: user.user_id,
      requestId: context.requestId
    });
    sendJson(response, 200, createEnvelope(context, { access_token: accessToken, expires_in: 3600, user }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/auth/me") {
    sendJson(response, 200, createEnvelope(context, requireActor(context)));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/demo-state") {
    const actor = requireActor(context);
    const latestRun = store.runs.at(-1);
    const latestRound = latestRun ? store.rounds.find((round) => round.run_id === latestRun.run_id) : undefined;
    const latestResult = latestRun && latestRound ? createPublicResultView(store, context, latestRun.run_id, latestRound.round_no) : undefined;

    sendJson(
      response,
      200,
      createEnvelope(context, {
        current_user: actor,
        courses: store.courses.filter((course) => course.tenant_id === context.tenantId),
        teams: store.teams.filter((team) => team.tenant_id === context.tenantId),
        runs: store.runs.filter((run) => run.tenant_id === context.tenantId),
        rounds: store.rounds.filter((round) => round.tenant_id === context.tenantId),
        decisions: store.decisions.filter((decision) => decision.tenant_id === context.tenantId),
        ...(latestResult ? { latest_result: latestResult } : {}),
        audit_logs: store.auditLogs.filter((log) => log.tenant_id === context.tenantId).slice(-20)
      })
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/courses") {
    requireActor(context);
    sendJson(response, 200, createEnvelope(context, store.courses.filter((course) => course.tenant_id === context.tenantId)));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/courses") {
    const actor = requireRoles(context, ["teacher", "tenant_admin", "platform_admin"]);
    const body = await readJson<{ title?: string }>(request);
    const scenario = store.scenarios.find((candidate) => candidate.tenant_id === context.tenantId);
    const parameterSet = store.parameterSets.find((candidate) => candidate.tenant_id === context.tenantId && candidate.status === "approved");

    if (!scenario || !parameterSet) {
      throw new HttpError(422, "COURSE-422-001", "approved scenario and parameter set are required");
    }

    const course = {
      course_id: nextId(store, "course", "course"),
      tenant_id: context.tenantId,
      title: body.title?.trim() || "P0 商战课程",
      status: "draft" as const,
      scenario_package_id: scenario.scenario_package_id,
      parameter_set_id: parameterSet.parameter_set_id,
      created_by: actor.user_id
    };
    store.courses.push(course);
    appendAudit(store, {
      actor,
      action: "course.create",
      resourceType: "course",
      resourceId: course.course_id,
      requestId: context.requestId
    });
    sendJson(response, 201, createEnvelope(context, course));
    return;
  }

  if (request.method === "GET" && /^\/api\/v1\/courses\/[^/]+$/.test(url.pathname)) {
    requireActor(context);
    const [, courseId] = matchPath(url.pathname, /^\/api\/v1\/courses\/([^/]+)$/);
    sendJson(response, 200, createEnvelope(context, getCourse(store, context, courseId ?? "")));
    return;
  }

  if (request.method === "POST" && /^\/api\/v1\/courses\/[^/]+\/publish$/.test(url.pathname)) {
    const actor = requireRoles(context, ["teacher", "tenant_admin", "platform_admin"]);
    const [, courseId] = matchPath(url.pathname, /^\/api\/v1\/courses\/([^/]+)\/publish$/);
    const course = getCourse(store, context, courseId ?? "");
    course.status = "published";
    appendAudit(store, {
      actor,
      action: "course.publish",
      resourceType: "course",
      resourceId: course.course_id,
      requestId: context.requestId
    });
    sendJson(response, 200, createEnvelope(context, course));
    return;
  }

  if (request.method === "POST" && /^\/api\/v1\/courses\/[^/]+\/teams$/.test(url.pathname)) {
    const actor = requireRoles(context, ["teacher", "tenant_admin", "platform_admin"]);
    const [, courseId] = matchPath(url.pathname, /^\/api\/v1\/courses\/([^/]+)\/teams$/);
    const course = getCourse(store, context, courseId ?? "");
    const body = await readJson<{ name?: string; captain_user_id?: string }>(request);
    const captain = store.users.find((user) => user.user_id === (body.captain_user_id ?? "usr_student") && user.tenant_id === context.tenantId);

    if (!captain) {
      throw new HttpError(422, "TEAM-422-001", "captain user not found");
    }

    const team = {
      team_id: nextId(store, "team", "team"),
      tenant_id: context.tenantId,
      course_id: course.course_id,
      name: body.name?.trim() || `Team ${store.counters.team}`,
      captain_user_id: captain.user_id,
      members: [
        {
          user_id: captain.user_id,
          display_name: captain.display_name,
          role_slot: "CEO" as const
        }
      ]
    };
    store.teams.push(team);
    captain.team_id = team.team_id;
    appendAudit(store, {
      actor,
      action: "team.create",
      resourceType: "team",
      resourceId: team.team_id,
      requestId: context.requestId
    });
    sendJson(response, 201, createEnvelope(context, team));
    return;
  }

  if (request.method === "POST" && /^\/api\/v1\/courses\/[^/]+\/runs$/.test(url.pathname)) {
    const actor = requireRoles(context, ["teacher", "tenant_admin", "platform_admin"]);
    const [, courseId] = matchPath(url.pathname, /^\/api\/v1\/courses\/([^/]+)\/runs$/);
    const course = getCourse(store, context, courseId ?? "");

    if (course.status !== "published" && course.status !== "active") {
      throw new HttpError(409, "RUN-409-001", "course must be published before creating run");
    }

    const parameterSet = store.parameterSets.find((candidate) => candidate.parameter_set_id === course.parameter_set_id);
    if (!parameterSet || parameterSet.status !== "approved") {
      throw new HttpError(422, "RUN-422-001", "approved parameter set is required");
    }

    const run = {
      run_id: nextId(store, "run", "run"),
      tenant_id: context.tenantId,
      course_id: course.course_id,
      scenario_package_id: course.scenario_package_id,
      parameter_set_id: course.parameter_set_id,
      seed: parameterSet.seed,
      status: "active" as const
    };
    const round = {
      round_id: nextId(store, "round", "round"),
      tenant_id: context.tenantId,
      run_id: run.run_id,
      round_no: 1,
      status: "draft" as const
    };
    store.runs.push(run);
    store.rounds.push(round);
    appendAudit(store, {
      actor,
      action: "run.create",
      resourceType: "run",
      resourceId: run.run_id,
      requestId: context.requestId
    });
    sendJson(response, 201, createEnvelope(context, { run, round }));
    return;
  }

  if (request.method === "POST" && /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/start$/.test(url.pathname)) {
    const actor = requireRoles(context, ["teacher", "tenant_admin", "platform_admin"]);
    const [, runId, roundNoRaw] = matchPath(url.pathname, /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/start$/);
    const run = getRun(store, context, runId ?? "");
    const round = getRound(store, context, run.run_id, Number(roundNoRaw));
    assertRoundStatus(round, "draft", "ROUND-409-001");
    round.status = "open";
    appendAudit(store, {
      actor,
      action: "round.start",
      resourceType: "round",
      resourceId: round.round_id,
      requestId: context.requestId
    });
    sendJson(response, 200, createEnvelope(context, round));
    return;
  }

  if (request.method === "POST" && /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/decisions$/.test(url.pathname)) {
    const actor = requireRoles(context, ["learner", "team_captain"]);
    const [, runId, roundNoRaw] = matchPath(url.pathname, /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/decisions$/);
    const run = getRun(store, context, runId ?? "");
    const round = getRound(store, context, run.run_id, Number(roundNoRaw));
    assertRoundStatus(round, "open", "ROUND-409-002");
    const body = await readJson<{ team_id?: string; decision_payload?: DecisionPayload }>(request);
    const teamId = body.team_id ?? actor.team_id;

    if (!teamId || teamId !== actor.team_id) {
      throw new HttpError(403, "TEAM-403-001", "learners can only submit for their own team");
    }

    const team = store.teams.find((candidate) => candidate.team_id === teamId && candidate.course_id === run.course_id);
    if (!team) {
      throw new HttpError(404, "TEAM-404-001", "team not found");
    }

    const validationErrors = validateDecisionPayload(body.decision_payload);
    if (validationErrors.length > 0) {
      throw new HttpError(422, "DEC-422-001", "decision validation failed", validationErrors);
    }

    const priorVersions = store.decisions.filter(
      (decision) => decision.run_id === run.run_id && decision.round_no === round.round_no && decision.team_id === team.team_id
    );
    const decision = {
      decision_id: nextId(store, "decision", "decision"),
      tenant_id: context.tenantId,
      run_id: run.run_id,
      round_id: round.round_id,
      round_no: round.round_no,
      team_id: team.team_id,
      status: "validated" as const,
      version: priorVersions.length + 1,
      payload: body.decision_payload as DecisionPayload,
      validation_report: [],
      submitted_by: actor.user_id
    };
    store.decisions.push(decision);
    appendAudit(store, {
      actor,
      action: "decision.submit",
      resourceType: "decision",
      resourceId: decision.decision_id,
      requestId: context.requestId
    });
    sendJson(response, 201, createEnvelope(context, decision));
    return;
  }

  if (request.method === "POST" && /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/lock$/.test(url.pathname)) {
    const actor = requireRoles(context, ["teacher", "tenant_admin", "platform_admin"]);
    const [, runId, roundNoRaw] = matchPath(url.pathname, /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/lock$/);
    const run = getRun(store, context, runId ?? "");
    const round = getRound(store, context, run.run_id, Number(roundNoRaw));
    assertRoundStatus(round, "open", "ROUND-409-003");
    round.status = "locked";
    round.decision_batch_id = `batch_${run.run_id}_${round.round_no}`;
    appendAudit(store, {
      actor,
      action: "round.lock",
      resourceType: "round",
      resourceId: round.round_id,
      requestId: context.requestId
    });
    sendJson(response, 200, createEnvelope(context, round));
    return;
  }

  if (request.method === "POST" && /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/settle$/.test(url.pathname)) {
    const actor = requireRoles(context, ["teacher", "tenant_admin", "platform_admin"]);
    const [, runId, roundNoRaw] = matchPath(url.pathname, /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/settle$/);
    const run = getRun(store, context, runId ?? "");
    const round = getRound(store, context, run.run_id, Number(roundNoRaw));

    if (round.status !== "locked" && round.status !== "settled" && round.status !== "published") {
      throw new HttpError(409, "ROUND-409-004", "round must be locked before settlement");
    }

    const scenario = store.scenarios.find((candidate) => candidate.scenario_package_id === run.scenario_package_id);
    const parameterSet = store.parameterSets.find((candidate) => candidate.parameter_set_id === run.parameter_set_id);
    const teams = store.teams.filter((team) => team.course_id === run.course_id);
    const latestDecisions = teams.map((team) => {
      const versions = store.decisions.filter(
        (decision) => decision.run_id === run.run_id && decision.round_no === round.round_no && decision.team_id === team.team_id
      );
      return versions.at(-1);
    });

    if (!scenario || !parameterSet || latestDecisions.some((decision) => !decision)) {
      throw new HttpError(422, "SETTLE-422-001", "scenario, parameter set and team decisions are required");
    }

    const settlement = settleRound(store, {
      run,
      round,
      scenario,
      parameterSet,
      teams,
      decisions: latestDecisions.filter((decision): decision is NonNullable<typeof decision> => Boolean(decision))
    });
    appendAudit(store, {
      actor,
      action: "round.settle_requested",
      resourceType: "settlement_result",
      resourceId: settlement.settlement_result_id,
      requestId: context.requestId
    });
    sendJson(response, 200, createEnvelope(context, settlement));
    return;
  }

  if (request.method === "POST" && /^\/internal\/v1\/runs\/[^/]+\/rounds\/\d+\/settle$/.test(url.pathname)) {
    const serviceActor = requireServiceKernel(request);
    const [, runId, roundNoRaw] = matchPath(url.pathname, /^\/internal\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/settle$/);
    const serviceContext = { ...context, actor: serviceActor, tenantId: DEFAULT_TENANT_ID };
    const run = getRun(store, serviceContext, runId ?? "");
    const round = getRound(store, serviceContext, run.run_id, Number(roundNoRaw));

    if (round.status !== "locked" && round.status !== "settled" && round.status !== "published") {
      throw new HttpError(409, "ROUND-409-004", "round must be locked before settlement");
    }

    const scenario = store.scenarios.find((candidate) => candidate.scenario_package_id === run.scenario_package_id);
    const parameterSet = store.parameterSets.find((candidate) => candidate.parameter_set_id === run.parameter_set_id);
    const teams = store.teams.filter((team) => team.course_id === run.course_id);
    const latestDecisions = teams.map((team) => {
      const versions = store.decisions.filter(
        (decision) => decision.run_id === run.run_id && decision.round_no === round.round_no && decision.team_id === team.team_id
      );
      return versions.at(-1);
    });

    if (!scenario || !parameterSet || latestDecisions.some((decision) => !decision)) {
      throw new HttpError(422, "SETTLE-422-001", "scenario, parameter set and team decisions are required");
    }

    const settlement = settleRound(store, {
      run,
      round,
      scenario,
      parameterSet,
      teams,
      decisions: latestDecisions.filter((decision): decision is NonNullable<typeof decision> => Boolean(decision))
    });
    appendAudit(store, {
      actor: serviceActor,
      action: "round.settle",
      resourceType: "settlement_result",
      resourceId: settlement.settlement_result_id,
      requestId: context.requestId
    });
    sendJson(response, 200, createEnvelope(context, settlement));
    return;
  }

  if (request.method === "POST" && /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/publish$/.test(url.pathname)) {
    const actor = requireRoles(context, ["teacher", "tenant_admin", "platform_admin"]);
    const [, runId, roundNoRaw] = matchPath(url.pathname, /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/publish$/);
    const run = getRun(store, context, runId ?? "");
    const round = getRound(store, context, run.run_id, Number(roundNoRaw));
    assertRoundStatus(round, "settled", "ROUND-409-005");
    round.status = "published";
    appendAudit(store, {
      actor,
      action: "round.publish",
      resourceType: "round",
      resourceId: round.round_id,
      requestId: context.requestId
    });
    sendJson(response, 200, createEnvelope(context, round));
    return;
  }

  if (request.method === "GET" && /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/results$/.test(url.pathname)) {
    const [, runId, roundNoRaw] = matchPath(url.pathname, /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/results$/);
    sendJson(response, 200, createEnvelope(context, createPublicResultView(store, context, runId ?? "", Number(roundNoRaw))));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/audit/logs") {
    requireRoles(context, ["teacher", "tenant_admin", "platform_admin"]);
    sendJson(response, 200, createEnvelope(context, store.auditLogs.filter((log) => log.tenant_id === context.tenantId)));
    return;
  }

  throw new HttpError(404, "ROUTE-404-001", "not found");
}

export function createApiServer(store: SimWarStore = defaultStore) {
  return createServer((request, response) => {
    routeRequest(store, request, response).catch((error: unknown) => {
      const fallbackContext: RequestContext = {
        requestId: request.headers["x-request-id"]?.toString() ?? `req_${Date.now()}`,
        tenantId: request.headers["x-tenant-id"]?.toString() ?? DEFAULT_TENANT_ID
      };

      if (error instanceof HttpError) {
        sendError(response, fallbackContext, error);
        return;
      }

      if (error instanceof SyntaxError) {
        sendError(response, fallbackContext, new HttpError(400, "JSON-400-001", "invalid json"));
        return;
      }

      sendError(response, fallbackContext, new HttpError(500, "API-500-001", "internal server error"));
    });
  });
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const port = Number.parseInt(process.env.API_PORT ?? "", 10) || DEFAULT_PORT;
  const server = createApiServer();

  server.listen(port, () => {
    console.log(`SimWar API listening on http://localhost:${port}`);
  });
}
