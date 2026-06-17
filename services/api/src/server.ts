import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import type {
  ActorRole,
  AdminState,
  ApiErrorEnvelope,
  ApiEnvelope,
  AuditLog,
  AuthSession,
  CurrentUser,
  Decision,
  DecisionPayload,
  PermissionKey,
  PublicResultView,
  Round,
  RoundStatus,
  SettlementResult,
  Tenant,
  User
} from "@simwar/shared-contracts";
import { actorHasPermission, isTruthProtectedField } from "@simwar/shared-contracts";
import {
  createSignedToken,
  hashPassword,
  hashToken,
  verifyPassword,
  verifySignedToken
} from "./auth.js";
import { getApiHealthPayload } from "./health.js";
import { createJsonRepositoryProvider, type RepositoryProvider } from "./repository-provider.js";
import {
  resolveRuntimeSecurityConfig,
  validateRuntimeSecurityConfig,
  type RuntimeSecurityConfig,
  type RuntimeSecurityConfigEnv
} from "./runtime-security-config.js";
import { settleRoundWithSettlementWriter, validateDecisionPayload } from "./simulation.js";
import {
  DEFAULT_TENANT_ID,
  PLATFORM_TENANT_ID,
  actorHasAnyRole,
  createP1Store,
  getActorFromUser,
  nextId,
  sanitizeUser,
  setUserRoles,
  type SimWarStore,
  type StoredUser
} from "./store.js";

const DEFAULT_PORT = 3000;
const SESSION_TTL_SECONDS = 60 * 60 * 8;

interface RequestContext {
  requestId: string;
  tenantId: string;
  actor?: CurrentUser;
  token?: string;
}

interface ApiRuntime {
  store: SimWarStore;
  repositoryProvider: RepositoryProvider;
  securityConfig: RuntimeSecurityConfig;
}

export interface CreateApiServerOptions {
  env?: RuntimeSecurityConfigEnv;
  securityConfig?: RuntimeSecurityConfig;
}

interface DecisionSubmitBody {
  team_id?: string;
  decision_payload?: DecisionPayload;
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

const defaultStore = createP1Store({
  persistenceFile: process.env.SIMWAR_STORE_FILE ?? "tmp/simwar-store.json"
});

function createApiRuntime(store: SimWarStore, options: CreateApiServerOptions = {}): ApiRuntime {
  return {
    store,
    repositoryProvider: createJsonRepositoryProvider({ store }),
    securityConfig: options.securityConfig
      ? validateRuntimeSecurityConfig(options.securityConfig)
      : resolveRuntimeSecurityConfig(options.env ?? process.env)
  };
}

async function appendAudit(
  runtime: ApiRuntime,
  input: {
    actor: CurrentUser;
    action: string;
    resourceType: string;
    resourceId: string;
    requestId: string;
    tenantId?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  }
): Promise<AuditLog> {
  const log: AuditLog = {
    audit_id: nextId(runtime.store, "audit", "audit"),
    tenant_id: input.tenantId ?? input.actor.tenant_id,
    actor_id: input.actor.user_id,
    actor_role: input.actor.roles[0] ?? "learner",
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    request_id: input.requestId,
    created_at: new Date().toISOString(),
    ...(input.before ? { before: input.before } : {}),
    ...(input.after ? { after: input.after } : {})
  };

  await runtime.repositoryProvider.facade.auditLogs.appendAuditLog(log);
  return log;
}

async function submitDecision(
  runtime: ApiRuntime,
  context: RequestContext,
  request: IncomingMessage,
  runId: string,
  roundNo: number
): Promise<Decision> {
  const store = runtime.store;
  const actor = requirePermission(context, "decision:submit");
  const run = getRun(store, context, runId);
  const round = getRound(store, context, run.run_id, roundNo);
  assertRoundStatus(round, "open", "ROUND-409-002");
  const body = await readJson<DecisionSubmitBody>(request);
  assertNoTruthProtectedFields(body);
  const teamId = body.team_id ?? actor.team_id;

  if (!teamId || teamId !== actor.team_id) {
    throw new HttpError(403, "TEAM-403-001", "learners can only submit for their own team");
  }

  const team = store.teams.find(
    (candidate) =>
      candidate.team_id === teamId &&
      candidate.course_id === run.course_id &&
      candidate.tenant_id === context.tenantId
  );
  if (!team) {
    throw new HttpError(404, "TEAM-404-001", "team not found");
  }

  const validationErrors = validateDecisionPayload(body.decision_payload);
  if (validationErrors.length > 0) {
    throw new HttpError(422, "DEC-422-001", "decision validation failed", validationErrors);
  }

  const priorVersions = store.decisions.filter(
    (decision) =>
      decision.run_id === run.run_id &&
      decision.round_no === round.round_no &&
      decision.team_id === team.team_id &&
      decision.tenant_id === context.tenantId
  );
  const decision: Decision = {
    decision_id: nextId(store, "decision", "decision"),
    tenant_id: context.tenantId,
    run_id: run.run_id,
    round_id: round.round_id,
    round_no: round.round_no,
    team_id: team.team_id,
    status: "validated",
    version: priorVersions.length + 1,
    payload: body.decision_payload as DecisionPayload,
    validation_report: [],
    submitted_by: actor.user_id
  };

  await runtime.repositoryProvider.facade.decisions.saveDecision(decision);
  await appendAudit(runtime, {
    actor,
    action: "decision.submit",
    resourceType: "decision",
    resourceId: decision.decision_id,
    requestId: context.requestId,
    after: clonePublic(decision)
  });

  return decision;
}

async function lockRound(
  runtime: ApiRuntime,
  context: RequestContext,
  runId: string,
  roundNo: number
): Promise<Round> {
  const store = runtime.store;
  const actor = requirePermission(context, "round:lock");
  const run = getRun(store, context, runId);
  const round = getRound(store, context, run.run_id, roundNo);
  assertRoundStatus(round, "open", "ROUND-409-003");
  const before = clonePublic(round);

  const lockedRound: Round = {
    ...round,
    status: "locked",
    decision_batch_id: `batch_${run.run_id}_${round.round_no}`
  };

  await runtime.repositoryProvider.facade.rounds.saveRound(lockedRound);

  await appendAudit(runtime, {
    actor,
    action: "round.lock",
    resourceType: "round",
    resourceId: lockedRound.round_id,
    requestId: context.requestId,
    before,
    after: clonePublic(lockedRound)
  });

  return lockedRound;
}

async function publishRound(
  runtime: ApiRuntime,
  context: RequestContext,
  runId: string,
  roundNo: number
): Promise<Round> {
  const store = runtime.store;
  const actor = requirePermission(context, "round:publish");
  const run = getRun(store, context, runId);
  const round = getRound(store, context, run.run_id, roundNo);
  assertRoundStatus(round, "settled", "ROUND-409-005");
  const before = clonePublic(round);

  const publishedRound: Round = {
    ...round,
    status: "published"
  };

  await runtime.repositoryProvider.facade.rounds.saveRound(publishedRound);

  await appendAudit(runtime, {
    actor,
    action: "round.publish",
    resourceType: "round",
    resourceId: publishedRound.round_id,
    requestId: context.requestId,
    before,
    after: clonePublic(publishedRound)
  });

  return publishedRound;
}

function createEnvelope<TData>(
  context: RequestContext,
  data: TData,
  message = "success"
): ApiEnvelope<TData> {
  return {
    request_id: context.requestId,
    code: "OK",
    message,
    data
  };
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "access-control-allow-headers":
      "authorization, content-type, idempotency-key, x-request-id, x-service-principal, x-tenant-id",
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

function isExpired(isoDate: string): boolean {
  return new Date(isoDate).getTime() <= Date.now();
}

function createContext(runtime: ApiRuntime, request: IncomingMessage): RequestContext {
  const { store } = runtime;
  const requestId = request.headers["x-request-id"]?.toString() ?? `req_${Date.now()}`;
  const requestedTenantId = request.headers["x-tenant-id"]?.toString();
  const bearerToken = getBearerToken(request);
  const token = bearerToken ?? "";
  const payload = verifySignedToken(token, runtime.securityConfig.jwtSecret);
  const tokenHash = hashToken(token);
  const session = store.sessions.find(
    (candidate) =>
      candidate.session_id === (payload?.session_id ?? "") &&
      candidate.user_id === (payload?.sub ?? "") &&
      candidate.token_hash === tokenHash &&
      !candidate.revoked_at &&
      !isExpired(candidate.expires_at)
  );
  const user = session
    ? store.users.find(
        (candidate) => candidate.user_id === session.user_id && candidate.status === "active"
      )
    : undefined;
  const actor = user ? getActorFromUser(store, user) : undefined;

  const tenantId = requestedTenantId ?? actor?.tenant_id ?? DEFAULT_TENANT_ID;

  if (
    actor &&
    requestedTenantId &&
    actor.tenant_id !== requestedTenantId &&
    !actorHasAnyRole(actor, ["platform_admin"])
  ) {
    throw new HttpError(403, "TENANT-403-001", "tenant boundary violation");
  }

  return {
    requestId,
    tenantId,
    ...(actor ? { actor } : {}),
    ...(bearerToken ? { token: bearerToken } : {})
  };
}

function requireActor(context: RequestContext): CurrentUser {
  if (!context.actor) {
    throw new HttpError(401, "AUTH-401-001", "authentication required");
  }

  return context.actor;
}

function requirePermission(context: RequestContext, permission: PermissionKey): CurrentUser {
  const actor = requireActor(context);

  if (!actorHasPermission(actor, permission)) {
    throw new HttpError(403, "AUTHZ-403-001", `missing permission: ${permission}`);
  }

  return actor;
}

function requireServiceKernel(
  runtime: ApiRuntime,
  request: IncomingMessage,
  context: RequestContext
): CurrentUser {
  const token = getBearerToken(request);
  const servicePrincipal = request.headers["x-service-principal"]?.toString();

  if (
    token !== runtime.securityConfig.internalServiceToken ||
    servicePrincipal !== "service_kernel"
  ) {
    throw new HttpError(403, "AUTHZ-403-002", "service kernel credential required");
  }

  return {
    user_id: "service_kernel",
    tenant_id: context.tenantId,
    display_name: "Service Kernel",
    roles: ["service_kernel"],
    permissions: ["internal:settle"]
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

function clonePublic(input: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
}

function findTruthProtectedFields(value: unknown, path = ""): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findTruthProtectedFields(entry, `${path}[${index}]`));
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) => {
    const nextPath = path ? `${path}.${key}` : key;
    const ownViolation = isTruthProtectedField(key) ? [nextPath] : [];
    return [...ownViolation, ...findTruthProtectedFields(nestedValue, nextPath)];
  });
}

function assertNoTruthProtectedFields(value: unknown): void {
  const fields = findTruthProtectedFields(value);

  if (fields.length > 0) {
    throw new HttpError(
      403,
      "TRUTH-403-001",
      "truth protected fields can only be written by the simulation kernel",
      fields.map((field) => ({ field, reason: "truth_protected" }))
    );
  }
}

function getCourse(store: SimWarStore, context: RequestContext, courseId: string) {
  const course = store.courses.find(
    (candidate) => candidate.course_id === courseId && candidate.tenant_id === context.tenantId
  );
  if (!course) {
    throw new HttpError(404, "COURSE-404-001", "course not found");
  }

  return course;
}

async function getCourseForRead(runtime: ApiRuntime, context: RequestContext, courseId: string) {
  const courseReadModel = await runtime.repositoryProvider.facade.courses.getCourse(
    context.tenantId,
    courseId
  );

  if (!courseReadModel) {
    throw new HttpError(404, "COURSE-404-001", "course not found");
  }

  const course = runtime.store.courses.find(
    (candidate) =>
      candidate.course_id === courseReadModel.course_id &&
      candidate.tenant_id === courseReadModel.tenant_id
  );

  if (!course) {
    throw new HttpError(404, "COURSE-404-001", "course not found");
  }

  return course;
}

function getRun(store: SimWarStore, context: RequestContext, runId: string) {
  const run = store.runs.find(
    (candidate) => candidate.run_id === runId && candidate.tenant_id === context.tenantId
  );
  if (!run) {
    throw new HttpError(404, "RUN-404-001", "run not found");
  }

  return run;
}

function getRound(store: SimWarStore, context: RequestContext, runId: string, roundNo: number) {
  const round = store.rounds.find(
    (candidate) =>
      candidate.run_id === runId &&
      candidate.round_no === roundNo &&
      candidate.tenant_id === context.tenantId
  );
  if (!round) {
    throw new HttpError(404, "ROUND-404-001", "round not found");
  }

  return round;
}

async function getRoundForRead(
  runtime: ApiRuntime,
  context: RequestContext,
  runId: string,
  roundNo: number
) {
  const run = await runtime.repositoryProvider.facade.runs.getRun(context.tenantId, runId);
  const rounds = await runtime.repositoryProvider.facade.rounds.listRoundsForRun(
    context.tenantId,
    run?.run_id ?? runId
  );
  const round = rounds.find((candidate) => candidate.round_no === roundNo);

  if (!round) {
    throw new HttpError(404, "ROUND-404-001", "round not found");
  }

  return round;
}

async function createPublicResultView(
  runtime: ApiRuntime,
  context: RequestContext,
  runId: string,
  roundNo: number
): Promise<PublicResultView> {
  const actor = requirePermission(context, "result:read");
  const round = await getRoundForRead(runtime, context, runId, roundNo);
  const settlements =
    await runtime.repositoryProvider.facade.settlements.listSettlementResultsForRound(
      context.tenantId,
      runId,
      round.round_id
    );
  const settlement = settlements.find(
    (result) =>
      result.run_id === runId &&
      result.round_no === roundNo &&
      result.tenant_id === context.tenantId
  );
  const canSeeTruth = actorHasAnyRole(actor, ["teacher", "tenant_admin", "platform_admin"]);

  if (!settlement) {
    return {
      run_id: runId,
      round_no: roundNo,
      status: round.status,
      results: []
    };
  }

  const visibleTeamIds = canSeeTruth
    ? undefined
    : new Set([actor.team_id].filter((teamId): teamId is string => Boolean(teamId)));
  const visibleResults = settlement.team_results
    .filter((result) => !visibleTeamIds || visibleTeamIds.has(result.team_id))
    .map((result) => {
      if (canSeeTruth) {
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

function assertRoundStatus(
  round: { status: RoundStatus },
  expected: RoundStatus,
  code: string
): void {
  if (round.status !== expected) {
    throw new HttpError(409, code, `round must be ${expected}`);
  }
}

async function filterAuditLogs(runtime: ApiRuntime, context: RequestContext, url: URL) {
  const actor = requirePermission(context, "audit:read");
  const requestedTenant = url.searchParams.get("tenant_id");
  const tenantScope = actorHasAnyRole(actor, ["platform_admin"])
    ? requestedTenant
    : context.tenantId;
  const action = url.searchParams.get("action");
  const actorId = url.searchParams.get("actor_id");
  const resourceType = url.searchParams.get("resource_type");
  const tenantIds = tenantScope
    ? [tenantScope]
    : runtime.store.tenants.map((tenant) => tenant.tenant_id);
  const auditLogOrder = new Map(runtime.store.auditLogs.map((log, index) => [log.audit_id, index]));
  const auditLogs = (
    await Promise.all(
      tenantIds.map((tenantId) =>
        runtime.repositoryProvider.facade.auditLogs.listAuditLogs({
          tenant_id: tenantId,
          ...(actorId ? { actor_id: actorId } : {}),
          ...(action ? { action } : {})
        })
      )
    )
  )
    .flat()
    .sort(
      (left, right) =>
        (auditLogOrder.get(left.audit_id) ?? 0) - (auditLogOrder.get(right.audit_id) ?? 0)
    );

  return auditLogs.filter((log) => {
    if (tenantScope && log.tenant_id !== tenantScope) {
      return false;
    }

    if (action && log.action !== action) {
      return false;
    }

    if (actorId && log.actor_id !== actorId) {
      return false;
    }

    if (resourceType && log.resource_type !== resourceType) {
      return false;
    }

    return true;
  });
}

async function createAdminState(runtime: ApiRuntime, context: RequestContext): Promise<AdminState> {
  const store = runtime.store;
  const actor = requirePermission(context, "user:read");
  const isPlatform = actorHasAnyRole(actor, ["platform_admin"]);
  const tenants = isPlatform
    ? store.tenants
    : store.tenants.filter((tenant) => tenant.tenant_id === context.tenantId);
  const users = isPlatform
    ? store.users.map(sanitizeUser)
    : store.users.filter((user) => user.tenant_id === context.tenantId).map(sanitizeUser);

  return {
    current_user: actor,
    tenants,
    users,
    roles: store.roles,
    permissions: store.permissions,
    audit_logs: (
      await filterAuditLogs(runtime, context, new URL("/api/v1/audit/logs", "http://localhost"))
    ).slice(-30)
  };
}

function requireManagedTenant(
  store: SimWarStore,
  actor: CurrentUser,
  context: RequestContext,
  tenantId?: string
): Tenant {
  const targetTenantId = actorHasAnyRole(actor, ["platform_admin"])
    ? (tenantId ?? context.tenantId)
    : context.tenantId;
  const tenant = store.tenants.find(
    (candidate) => candidate.tenant_id === targetTenantId && candidate.status === "active"
  );

  if (!tenant) {
    throw new HttpError(404, "TENANT-404-001", "tenant not found");
  }

  if (!actorHasAnyRole(actor, ["platform_admin"]) && tenant.tenant_id !== actor.tenant_id) {
    throw new HttpError(403, "TENANT-403-001", "tenant boundary violation");
  }

  return tenant;
}

function normalizeRoles(actor: CurrentUser, roles?: ActorRole[]): ActorRole[] {
  const requested = roles && roles.length > 0 ? roles : ["learner"];

  if (!actorHasAnyRole(actor, ["platform_admin"]) && requested.includes("platform_admin")) {
    throw new HttpError(403, "AUTHZ-403-003", "tenant administrators cannot assign platform_admin");
  }

  return [...new Set(requested)] as ActorRole[];
}

async function routeRequest(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const store = runtime.store;

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? "/", "http://localhost");
  const context = createContext(runtime, request);

  if (
    request.method === "GET" &&
    (url.pathname === "/healthz" || url.pathname === "/api/v1/health")
  ) {
    sendJson(response, 200, createEnvelope(context, getApiHealthPayload()));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
    const body = await readJson<{ username?: string; email?: string; password?: string }>(request);
    const login = body.username?.trim() || body.email?.trim();
    const user = store.users.find(
      (candidate) =>
        candidate.tenant_id === context.tenantId &&
        candidate.status === "active" &&
        (candidate.username === login || candidate.email === login)
    );

    if (!user || !body.password || !verifyPassword(body.password, user.password_hash)) {
      throw new HttpError(401, "AUTH-401-002", "invalid credentials");
    }

    const actor = getActorFromUser(store, user);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const sessionId = nextId(store, "session", "session");
    const expiresAtSeconds = nowSeconds + SESSION_TTL_SECONDS;
    const accessToken = createSignedToken(
      {
        sub: actor.user_id,
        tenant_id: actor.tenant_id,
        roles: actor.roles,
        session_id: sessionId,
        iat: nowSeconds,
        exp: expiresAtSeconds
      },
      runtime.securityConfig.jwtSecret
    );

    store.sessions.push({
      session_id: sessionId,
      user_id: actor.user_id,
      tenant_id: actor.tenant_id,
      token_hash: hashToken(accessToken),
      created_at: new Date(nowSeconds * 1000).toISOString(),
      expires_at: new Date(expiresAtSeconds * 1000).toISOString()
    });
    await appendAudit(runtime, {
      actor,
      action: "auth.login",
      resourceType: "user",
      resourceId: actor.user_id,
      requestId: context.requestId,
      tenantId: actor.tenant_id
    });

    const session: AuthSession = {
      access_token: accessToken,
      expires_in: SESSION_TTL_SECONDS,
      token_type: "Bearer",
      user: actor
    };
    sendJson(response, 200, createEnvelope(context, session));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/auth/logout") {
    const actor = requireActor(context);
    const tokenHash = context.token ? hashToken(context.token) : undefined;
    const session = tokenHash
      ? store.sessions.find((candidate) => candidate.token_hash === tokenHash)
      : undefined;

    if (session) {
      session.revoked_at = new Date().toISOString();
    }

    await appendAudit(runtime, {
      actor,
      action: "auth.logout",
      resourceType: "session",
      resourceId: session?.session_id ?? "unknown",
      requestId: context.requestId
    });
    sendJson(response, 200, createEnvelope(context, { revoked: Boolean(session) }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/auth/me") {
    sendJson(response, 200, createEnvelope(context, requireActor(context)));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/admin/state") {
    sendJson(response, 200, createEnvelope(context, await createAdminState(runtime, context)));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/admin/tenants") {
    const actor = requirePermission(context, "tenant:read");
    const tenants = actorHasAnyRole(actor, ["platform_admin"])
      ? store.tenants
      : store.tenants.filter((tenant) => tenant.tenant_id === context.tenantId);
    sendJson(response, 200, createEnvelope(context, tenants));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/admin/tenants") {
    const actor = requirePermission(context, "tenant:create");
    const body = await readJson<{ name?: string; domain?: string }>(request);
    assertNoTruthProtectedFields(body);

    const name = body.name?.trim();
    const domain = body.domain?.trim().toLowerCase();
    if (!name || !domain) {
      throw new HttpError(422, "TENANT-422-001", "name and domain are required");
    }

    if (store.tenants.some((tenant) => tenant.domain === domain)) {
      throw new HttpError(409, "TENANT-409-001", "tenant domain already exists");
    }

    const now = new Date().toISOString();
    const tenant: Tenant = {
      tenant_id: nextId(store, "tenant", "tenant"),
      name,
      domain,
      status: "active",
      created_at: now,
      updated_at: now
    };
    store.tenants.push(tenant);
    await appendAudit(runtime, {
      actor,
      action: "tenant.create",
      resourceType: "tenant",
      resourceId: tenant.tenant_id,
      requestId: context.requestId,
      tenantId: tenant.tenant_id,
      after: clonePublic(tenant)
    });
    sendJson(response, 201, createEnvelope(context, tenant));
    return;
  }

  if (request.method === "GET" && /^\/api\/v1\/admin\/tenants\/[^/]+$/.test(url.pathname)) {
    const actor = requirePermission(context, "tenant:read");
    const [, tenantId] = matchPath(url.pathname, /^\/api\/v1\/admin\/tenants\/([^/]+)$/);
    const tenant = store.tenants.find((candidate) => candidate.tenant_id === tenantId);

    if (
      !tenant ||
      (!actorHasAnyRole(actor, ["platform_admin"]) && tenant.tenant_id !== context.tenantId)
    ) {
      throw new HttpError(404, "TENANT-404-001", "tenant not found");
    }

    sendJson(response, 200, createEnvelope(context, tenant));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/admin/users") {
    const actor = requirePermission(context, "user:read");
    const users = actorHasAnyRole(actor, ["platform_admin"])
      ? store.users.map(sanitizeUser)
      : store.users.filter((user) => user.tenant_id === context.tenantId).map(sanitizeUser);
    sendJson(response, 200, createEnvelope(context, users));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/admin/users") {
    const actor = requirePermission(context, "user:create");
    const body = await readJson<{
      tenant_id?: string;
      username?: string;
      email?: string;
      password?: string;
      display_name?: string;
      roles?: ActorRole[];
    }>(request);
    assertNoTruthProtectedFields(body);

    const tenant = requireManagedTenant(store, actor, context, body.tenant_id);
    const username = body.username?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "simwar123";
    const displayName = body.display_name?.trim() || username;

    if (!username || !email || !displayName) {
      throw new HttpError(422, "USER-422-001", "username, email and display_name are required");
    }

    if (
      store.users.some(
        (user) =>
          user.tenant_id === tenant.tenant_id &&
          (user.username === username || user.email === email)
      )
    ) {
      throw new HttpError(409, "USER-409-001", "username or email already exists in tenant");
    }

    const now = new Date().toISOString();
    const roles = normalizeRoles(actor, body.roles);
    const user: StoredUser = {
      user_id: nextId(store, "user", "usr"),
      tenant_id: tenant.tenant_id,
      username,
      email,
      password_hash: hashPassword(password),
      display_name: displayName,
      roles,
      status: "active",
      created_at: now,
      updated_at: now
    };
    store.users.push(user);
    setUserRoles(store, user, roles);
    const publicUser = sanitizeUser(user);
    await appendAudit(runtime, {
      actor,
      action: "user.create",
      resourceType: "user",
      resourceId: user.user_id,
      requestId: context.requestId,
      tenantId: user.tenant_id,
      after: clonePublic(publicUser)
    });
    sendJson(response, 201, createEnvelope(context, publicUser));
    return;
  }

  if (request.method === "PATCH" && /^\/api\/v1\/admin\/users\/[^/]+$/.test(url.pathname)) {
    const actor = requirePermission(context, "user:update");
    const [, userId] = matchPath(url.pathname, /^\/api\/v1\/admin\/users\/([^/]+)$/);
    const user = store.users.find((candidate) => candidate.user_id === userId);

    if (
      !user ||
      (!actorHasAnyRole(actor, ["platform_admin"]) && user.tenant_id !== context.tenantId)
    ) {
      throw new HttpError(404, "USER-404-001", "user not found");
    }

    const body = await readJson<{
      display_name?: string;
      email?: string;
      status?: User["status"];
      roles?: ActorRole[];
      tenant_id?: string;
      password?: string;
    }>(request);
    assertNoTruthProtectedFields(body);

    if (body.tenant_id && body.tenant_id !== user.tenant_id) {
      throw new HttpError(403, "USER-403-001", "user tenant cannot be changed through patch");
    }

    const before = sanitizeUser(user);
    if (body.display_name) {
      user.display_name = body.display_name.trim();
    }

    if (body.email) {
      user.email = body.email.trim().toLowerCase();
    }

    if (body.status) {
      user.status = body.status;
    }

    if (body.password) {
      user.password_hash = hashPassword(body.password);
    }

    if (body.roles) {
      setUserRoles(store, user, normalizeRoles(actor, body.roles));
    }

    user.updated_at = new Date().toISOString();
    const after = sanitizeUser(user);
    await appendAudit(runtime, {
      actor,
      action: "user.update",
      resourceType: "user",
      resourceId: user.user_id,
      requestId: context.requestId,
      tenantId: user.tenant_id,
      before: clonePublic(before),
      after: clonePublic(after)
    });
    sendJson(response, 200, createEnvelope(context, after));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/rbac/roles") {
    requirePermission(context, "rbac:read");
    sendJson(response, 200, createEnvelope(context, store.roles));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/rbac/permissions") {
    requirePermission(context, "rbac:read");
    sendJson(response, 200, createEnvelope(context, store.permissions));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/demo-state") {
    const actor = requireActor(context);
    const tenantRuns = store.runs.filter((run) => run.tenant_id === context.tenantId);
    const latestRun = tenantRuns.at(-1);
    const latestRound = latestRun
      ? store.rounds.find(
          (round) => round.run_id === latestRun.run_id && round.tenant_id === context.tenantId
        )
      : undefined;
    const latestResult =
      latestRun && latestRound
        ? await createPublicResultView(runtime, context, latestRun.run_id, latestRound.round_no)
        : undefined;
    const canReadAdmin = actorHasPermission(actor, "user:read");

    sendJson(
      response,
      200,
      createEnvelope(context, {
        current_user: actor,
        ...(canReadAdmin
          ? { tenants: store.tenants.filter((tenant) => tenant.tenant_id === context.tenantId) }
          : {}),
        ...(canReadAdmin
          ? {
              users: store.users
                .filter((user) => user.tenant_id === context.tenantId)
                .map(sanitizeUser)
            }
          : {}),
        ...(canReadAdmin ? { roles: store.roles, permissions: store.permissions } : {}),
        courses: store.courses.filter((course) => course.tenant_id === context.tenantId),
        teams: store.teams.filter((team) => team.tenant_id === context.tenantId),
        runs: tenantRuns,
        rounds: store.rounds.filter((round) => round.tenant_id === context.tenantId),
        decisions: store.decisions.filter((decision) => decision.tenant_id === context.tenantId),
        ...(latestResult ? { latest_result: latestResult } : {}),
        audit_logs: actorHasPermission(actor, "audit:read")
          ? (
              await filterAuditLogs(
                runtime,
                context,
                new URL("/api/v1/audit/logs", "http://localhost")
              )
            ).slice(-20)
          : []
      })
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/courses") {
    requirePermission(context, "course:read");
    sendJson(
      response,
      200,
      createEnvelope(
        context,
        store.courses.filter((course) => course.tenant_id === context.tenantId)
      )
    );
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/courses") {
    const actor = requirePermission(context, "course:create");
    const body = await readJson<{ title?: string }>(request);
    assertNoTruthProtectedFields(body);
    const scenario = store.scenarios.find((candidate) => candidate.tenant_id === context.tenantId);
    const parameterSet = store.parameterSets.find(
      (candidate) => candidate.tenant_id === context.tenantId && candidate.status === "approved"
    );

    if (!scenario || !parameterSet) {
      throw new HttpError(
        422,
        "COURSE-422-001",
        "approved scenario and parameter set are required"
      );
    }

    const course = {
      course_id: nextId(store, "course", "course"),
      tenant_id: context.tenantId,
      title: body.title?.trim() || "P1 商战课程",
      status: "draft" as const,
      scenario_package_id: scenario.scenario_package_id,
      parameter_set_id: parameterSet.parameter_set_id,
      created_by: actor.user_id
    };
    store.courses.push(course);
    await appendAudit(runtime, {
      actor,
      action: "course.create",
      resourceType: "course",
      resourceId: course.course_id,
      requestId: context.requestId,
      after: clonePublic(course)
    });
    sendJson(response, 201, createEnvelope(context, course));
    return;
  }

  if (request.method === "GET" && /^\/api\/v1\/courses\/[^/]+$/.test(url.pathname)) {
    requirePermission(context, "course:read");
    const [, courseId] = matchPath(url.pathname, /^\/api\/v1\/courses\/([^/]+)$/);
    const course = await getCourseForRead(runtime, context, courseId ?? "");
    sendJson(response, 200, createEnvelope(context, course));
    return;
  }

  if (request.method === "POST" && /^\/api\/v1\/courses\/[^/]+\/publish$/.test(url.pathname)) {
    const actor = requirePermission(context, "course:publish");
    const [, courseId] = matchPath(url.pathname, /^\/api\/v1\/courses\/([^/]+)\/publish$/);
    const course = getCourse(store, context, courseId ?? "");
    const before = clonePublic(course);
    course.status = "published";
    await appendAudit(runtime, {
      actor,
      action: "course.publish",
      resourceType: "course",
      resourceId: course.course_id,
      requestId: context.requestId,
      before,
      after: clonePublic(course)
    });
    sendJson(response, 200, createEnvelope(context, course));
    return;
  }

  if (request.method === "POST" && /^\/api\/v1\/courses\/[^/]+\/teams$/.test(url.pathname)) {
    const actor = requirePermission(context, "team:create");
    const [, courseId] = matchPath(url.pathname, /^\/api\/v1\/courses\/([^/]+)\/teams$/);
    const course = getCourse(store, context, courseId ?? "");
    const body = await readJson<{ name?: string; captain_user_id?: string }>(request);
    assertNoTruthProtectedFields(body);
    const captain = store.users.find(
      (user) =>
        user.user_id === (body.captain_user_id ?? "usr_student") &&
        user.tenant_id === context.tenantId
    );

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
    await appendAudit(runtime, {
      actor,
      action: "team.create",
      resourceType: "team",
      resourceId: team.team_id,
      requestId: context.requestId,
      after: clonePublic(team)
    });
    sendJson(response, 201, createEnvelope(context, team));
    return;
  }

  if (request.method === "POST" && /^\/api\/v1\/courses\/[^/]+\/runs$/.test(url.pathname)) {
    const actor = requirePermission(context, "run:create");
    const [, courseId] = matchPath(url.pathname, /^\/api\/v1\/courses\/([^/]+)\/runs$/);
    const course = getCourse(store, context, courseId ?? "");

    if (course.status !== "published" && course.status !== "active") {
      throw new HttpError(409, "RUN-409-001", "course must be published before creating run");
    }

    const parameterSet = store.parameterSets.find(
      (candidate) =>
        candidate.parameter_set_id === course.parameter_set_id &&
        candidate.tenant_id === context.tenantId
    );
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
    await appendAudit(runtime, {
      actor,
      action: "run.create",
      resourceType: "run",
      resourceId: run.run_id,
      requestId: context.requestId,
      after: clonePublic(run)
    });
    sendJson(response, 201, createEnvelope(context, { run, round }));
    return;
  }

  if (
    request.method === "POST" &&
    /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/start$/.test(url.pathname)
  ) {
    const actor = requirePermission(context, "round:start");
    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/start$/
    );
    const run = getRun(store, context, runId ?? "");
    const round = getRound(store, context, run.run_id, Number(roundNoRaw));
    assertRoundStatus(round, "draft", "ROUND-409-001");
    const before = clonePublic(round);
    round.status = "open";
    await appendAudit(runtime, {
      actor,
      action: "round.start",
      resourceType: "round",
      resourceId: round.round_id,
      requestId: context.requestId,
      before,
      after: clonePublic(round)
    });
    sendJson(response, 200, createEnvelope(context, round));
    return;
  }

  if (
    request.method === "POST" &&
    /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/decisions$/.test(url.pathname)
  ) {
    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/decisions$/
    );
    const decision = await submitDecision(
      runtime,
      context,
      request,
      runId ?? "",
      Number(roundNoRaw)
    );
    sendJson(response, 201, createEnvelope(context, decision));
    return;
  }

  if (
    request.method === "POST" &&
    /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/lock$/.test(url.pathname)
  ) {
    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/lock$/
    );
    const round = await lockRound(runtime, context, runId ?? "", Number(roundNoRaw));
    sendJson(response, 200, createEnvelope(context, round));
    return;
  }

  if (
    request.method === "POST" &&
    /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/settle$/.test(url.pathname)
  ) {
    const actor = requirePermission(context, "settlement:settle");
    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/settle$/
    );
    const settlement = await runSettlement(runtime, context, runId ?? "", Number(roundNoRaw));
    await appendAudit(runtime, {
      actor,
      action: "round.settle_requested",
      resourceType: "settlement_result",
      resourceId: settlement.settlement_result_id,
      requestId: context.requestId,
      after: clonePublic({ replay_hash: settlement.replay_hash })
    });
    sendJson(response, 200, createEnvelope(context, settlement));
    return;
  }

  if (
    request.method === "POST" &&
    /^\/internal\/v1\/runs\/[^/]+\/rounds\/\d+\/settle$/.test(url.pathname)
  ) {
    const serviceActor = requireServiceKernel(runtime, request, context);
    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/internal\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/settle$/
    );
    const serviceContext: RequestContext = {
      requestId: context.requestId,
      tenantId: context.tenantId,
      actor: serviceActor
    };
    const settlement = await runSettlement(
      runtime,
      serviceContext,
      runId ?? "",
      Number(roundNoRaw)
    );
    await appendAudit(runtime, {
      actor: serviceActor,
      action: "round.settle",
      resourceType: "settlement_result",
      resourceId: settlement.settlement_result_id,
      requestId: context.requestId,
      tenantId: context.tenantId,
      after: clonePublic({ replay_hash: settlement.replay_hash })
    });
    sendJson(response, 200, createEnvelope(context, settlement));
    return;
  }

  if (
    request.method === "POST" &&
    /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/publish$/.test(url.pathname)
  ) {
    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/publish$/
    );
    const round = await publishRound(runtime, context, runId ?? "", Number(roundNoRaw));
    sendJson(response, 200, createEnvelope(context, round));
    return;
  }

  if (
    request.method === "GET" &&
    /^\/api\/v1\/runs\/[^/]+\/rounds\/\d+\/results$/.test(url.pathname)
  ) {
    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/runs\/([^/]+)\/rounds\/(\d+)\/results$/
    );
    sendJson(
      response,
      200,
      createEnvelope(
        context,
        await createPublicResultView(runtime, context, runId ?? "", Number(roundNoRaw))
      )
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/audit/logs") {
    sendJson(response, 200, createEnvelope(context, await filterAuditLogs(runtime, context, url)));
    return;
  }

  throw new HttpError(404, "ROUTE-404-001", "not found");
}

async function runSettlement(
  runtime: ApiRuntime,
  context: RequestContext,
  runId: string,
  roundNo: number
): Promise<SettlementResult> {
  const store = runtime.store;
  const run = getRun(store, context, runId);
  const round = getRound(store, context, run.run_id, roundNo);

  if (round.status !== "locked" && round.status !== "settled" && round.status !== "published") {
    throw new HttpError(409, "ROUND-409-004", "round must be locked before settlement");
  }

  const scenario = store.scenarios.find(
    (candidate) =>
      candidate.scenario_package_id === run.scenario_package_id &&
      candidate.tenant_id === context.tenantId
  );
  const parameterSet = store.parameterSets.find(
    (candidate) =>
      candidate.parameter_set_id === run.parameter_set_id &&
      candidate.tenant_id === context.tenantId
  );
  const teams = store.teams.filter(
    (team) => team.course_id === run.course_id && team.tenant_id === context.tenantId
  );
  const latestDecisions = teams.map((team) => {
    const versions = store.decisions.filter(
      (decision) =>
        decision.run_id === run.run_id &&
        decision.round_no === round.round_no &&
        decision.team_id === team.team_id &&
        decision.tenant_id === context.tenantId
    );
    return versions.at(-1);
  });

  if (!scenario || !parameterSet || latestDecisions.some((decision) => !decision)) {
    throw new HttpError(
      422,
      "SETTLE-422-001",
      "scenario, parameter set and team decisions are required"
    );
  }

  return settleRoundWithSettlementWriter(
    store,
    {
      run,
      round,
      scenario,
      parameterSet,
      teams,
      decisions: latestDecisions.filter((decision): decision is NonNullable<typeof decision> =>
        Boolean(decision)
      )
    },
    runtime.repositoryProvider.facade.settlements
  );
}

export function createApiServer(
  store: SimWarStore = defaultStore,
  options: CreateApiServerOptions = {}
) {
  const runtime = createApiRuntime(store, options);

  return createServer((request, response) => {
    routeRequest(runtime, request, response).catch((error: unknown) => {
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

      sendError(
        response,
        fallbackContext,
        new HttpError(500, "API-500-001", "internal server error")
      );
    });
  });
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const port = Number.parseInt(process.env.API_PORT ?? "", 10) || DEFAULT_PORT;
  const server = createApiServer();

  server.listen(port, () => {
    console.log(`SimWar API listening on http://localhost:${port}`);
    console.log(`SimWar API store: ${defaultStore.persistenceFile ?? "memory"}`);
    console.log(`Platform admin: tenant=${PLATFORM_TENANT_ID} username=platform`);
  });
}
