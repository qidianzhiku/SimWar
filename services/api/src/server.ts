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
  M1DecisionSubmitRequest,
  PermissionKey,
  PublicRunReplayEvidence,
  PublicResultView,
  Round,
  RoundStatus,
  SettlementResult,
  Team,
  Tenant,
  User
} from "@simwar/shared-contracts";
import {
  M1_CLASSROOM_DEBRIEF_PROMPTS,
  M1_JSON_RUNTIME_BOUNDARY,
  M1_JSON_RUNTIME_LIMITATIONS,
  M1_TEACHING_OFFICIAL_RESULT_LABEL,
  ROLE_PERMISSION_MATRIX,
  actorHasPermission,
  isTruthProtectedField
} from "@simwar/shared-contracts";
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
  type RuntimeEnvironment,
  type RuntimeSecurityConfig,
  type RuntimeSecurityConfigEnv
} from "./runtime-security-config.js";
import { createM1RunReplayEvidence } from "./run-manifest-replay-evidence.js";
import {
  R7TeacherScenarioSelectionGateBlockedError,
  createR7TeacherScenarioPackageCandidatesProjection,
  createR7TeacherScenarioSelectionReadinessProjection
} from "./r7-teacher-scenario-selection-readiness.js";
import { prepareSettlementOutcome, validateDecisionPayload } from "./simulation.js";
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
import {
  createPlatformAdminAuthorityDto,
  createStudentBffCockpitDto,
  createTeacherBffWorkspaceDto,
  createTenantAdminSummaryDto
} from "./teacher-student-bff-dto.js";

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
  settlementLocks: Map<string, Promise<void>>;
}

export interface CreateApiServerOptions {
  env?: RuntimeSecurityConfigEnv;
  repositoryProvider?: RepositoryProvider;
  securityConfig?: RuntimeSecurityConfig;
}

type DecisionSubmitBody = Partial<M1DecisionSubmitRequest>;

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
const sharedRuntimeEnvironments = new Set<RuntimeEnvironment>(["production", "staging"]);
const seededDemoUserIds = new Set([
  "usr_platform",
  "usr_teacher",
  "usr_student",
  "usr_admin",
  "usr_other_teacher"
]);

function isSharedRuntime(environment: RuntimeEnvironment): boolean {
  return sharedRuntimeEnvironments.has(environment);
}

function isSeededDemoUser(user: StoredUser): boolean {
  return seededDemoUserIds.has(user.user_id);
}

function createRuntimeRepositoryProvider(
  store: SimWarStore,
  options: Pick<CreateApiServerOptions, "repositoryProvider"> = {}
): RepositoryProvider {
  return options.repositoryProvider ?? createJsonRepositoryProvider({ store });
}

function createApiRuntime(store: SimWarStore, options: CreateApiServerOptions = {}): ApiRuntime {
  return {
    store,
    repositoryProvider: createRuntimeRepositoryProvider(store, options),
    securityConfig: options.securityConfig
      ? validateRuntimeSecurityConfig(options.securityConfig)
      : resolveRuntimeSecurityConfig(options.env ?? process.env),
    settlementLocks: new Map()
  };
}

interface RunSettlementOutcome {
  settlement: SettlementResult;
  committed: boolean;
  responseSemantics: "committed" | "reused";
}

function settlementBusinessKey(tenantId: string, runId: string, roundNo: number): string {
  return `${tenantId}:${runId}:${roundNo}`;
}

async function acquireSettlementLock(runtime: ApiRuntime, key: string): Promise<() => void> {
  const previous = runtime.settlementLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => current);

  runtime.settlementLocks.set(key, queued);

  await previous.catch(() => undefined);

  return () => {
    release();

    if (runtime.settlementLocks.get(key) === queued) {
      runtime.settlementLocks.delete(key);
    }
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
    audit_id: runtime.repositoryProvider.idGenerator.createAuditLogId(),
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

  if (!isActorMemberOfTeam(actor, team)) {
    throw new HttpError(403, "TEAM-403-001", "learners can only submit for their own team");
  }

  const validationErrors = validateDecisionPayload(body.decision_payload);
  if (validationErrors.length > 0) {
    throw new HttpError(422, "DEC-422-001", "decision validation failed", validationErrors);
  }
  const decisionPayload = body.decision_payload as DecisionPayload;
  const idempotentDecision = await findIdempotentDecisionSubmission(runtime, context, {
    actor,
    payload: decisionPayload,
    roundNo: round.round_no,
    runId: run.run_id,
    teamId: team.team_id
  });
  if (idempotentDecision) {
    return idempotentDecision;
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
    payload: decisionPayload,
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
  if (round.status === "locked") {
    return round;
  }
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
  if (round.status === "published") {
    return round;
  }
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

function sendR7ScenarioSelectionReadinessError(
  response: ServerResponse,
  statusCode: number,
  code: string,
  message: string,
  correlationId: string | null
): void {
  sendJson(response, statusCode, {
    error: {
      code,
      message,
      correlation_id: correlationId
    }
  });
}

function parseR7ScenarioSelectionIdentifier(rawValue: string | undefined): string | undefined {
  try {
    const value = decodeURIComponent(rawValue ?? "").trim();
    return /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
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

async function handleR7TeacherScenarioSelectionReadiness(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL
): Promise<void> {
  let context: RequestContext | undefined;
  const correlationId = () =>
    context?.requestId ?? request.headers["x-request-id"]?.toString() ?? null;

  try {
    context = createContext(runtime, request);
    const actor = requirePermission(context, "course:read");

    if (!actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
      throw new HttpError(403, "AUTHZ-403-001", "teacher authority required");
    }

    const match = url.pathname.match(
      /^\/api\/v1\/bff\/teacher\/runs\/([^/]*)\/scenario-selection-readiness$/
    );
    const runId = parseR7ScenarioSelectionIdentifier(match?.[1]);
    const scenarioPackageIds = url.searchParams.getAll("scenarioPackageId");
    const parameterSetIds = url.searchParams.getAll("parameterSetId");
    const scenarioPackageId = parseR7ScenarioSelectionIdentifier(scenarioPackageIds[0]);
    const parameterSetId = parseR7ScenarioSelectionIdentifier(parameterSetIds[0]);

    if (
      !runId ||
      !scenarioPackageId ||
      !parameterSetId ||
      scenarioPackageIds.length !== 1 ||
      parameterSetIds.length !== 1
    ) {
      sendR7ScenarioSelectionReadinessError(
        response,
        400,
        "R7_BFF_INVALID_REQUEST",
        "runId, scenarioPackageId and parameterSetId are required",
        correlationId()
      );
      return;
    }

    const run = await runtime.repositoryProvider.facade.runs.getRun(context.tenantId, runId);
    if (!run) {
      sendR7ScenarioSelectionReadinessError(
        response,
        404,
        "R7_BFF_SCENARIO_SELECTION_CONTEXT_NOT_FOUND",
        "scenario selection context not found",
        correlationId()
      );
      return;
    }

    const [scenarioPackage, parameterSet] = await Promise.all([
      runtime.repositoryProvider.facade.scenarios.getScenarioPackage(
        context.tenantId,
        scenarioPackageId
      ),
      runtime.repositoryProvider.facade.parameterSets.getParameterSet(
        context.tenantId,
        parameterSetId
      )
    ]);

    if (
      !scenarioPackage ||
      !parameterSet ||
      run.tenant_id !== context.tenantId ||
      scenarioPackage.tenant_id !== context.tenantId ||
      parameterSet.tenant_id !== context.tenantId ||
      run.scenario_package_id !== scenarioPackage.scenario_package_id ||
      run.parameter_set_id !== parameterSet.parameter_set_id
    ) {
      sendR7ScenarioSelectionReadinessError(
        response,
        404,
        "R7_BFF_SCENARIO_SELECTION_CONTEXT_NOT_FOUND",
        "scenario selection context not found",
        correlationId()
      );
      return;
    }

    sendJson(
      response,
      200,
      createR7TeacherScenarioSelectionReadinessProjection({
        parameterSet,
        run,
        scenarioPackage,
        tenantId: context.tenantId
      })
    );
  } catch (error: unknown) {
    if (error instanceof R7TeacherScenarioSelectionGateBlockedError) {
      sendR7ScenarioSelectionReadinessError(
        response,
        409,
        "R7_BFF_SCENARIO_SELECTION_GATE_BLOCKED",
        "scenario selection readiness gate blocked",
        correlationId()
      );
      return;
    }
    if (error instanceof HttpError && error.statusCode === 401) {
      sendR7ScenarioSelectionReadinessError(
        response,
        401,
        "R7_BFF_AUTHENTICATION_REQUIRED",
        "authentication required",
        correlationId()
      );
      return;
    }
    if (error instanceof HttpError && error.statusCode === 403) {
      sendR7ScenarioSelectionReadinessError(
        response,
        403,
        "R7_BFF_TEACHER_AUTHORITY_REQUIRED",
        "teacher authority required",
        correlationId()
      );
      return;
    }

    sendR7ScenarioSelectionReadinessError(
      response,
      500,
      "R7_BFF_INTERNAL_ERROR",
      "internal server error",
      correlationId()
    );
  }
}

async function handleR7TeacherScenarioPackageCandidates(
  runtime: ApiRuntime,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL
): Promise<void> {
  let context: RequestContext | undefined;
  const correlationId = () =>
    context?.requestId ?? request.headers["x-request-id"]?.toString() ?? null;

  try {
    context = createContext(runtime, request);
    const actor = requirePermission(context, "course:read");

    if (!actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
      throw new HttpError(403, "AUTHZ-403-001", "teacher authority required");
    }

    const match = url.pathname.match(
      /^\/api\/v1\/bff\/teacher\/runs\/([^/]*)\/scenario-package-candidates$/
    );
    const runId = parseR7ScenarioSelectionIdentifier(match?.[1]);
    if (!runId) {
      sendR7ScenarioSelectionReadinessError(
        response,
        400,
        "R7_BFF_INVALID_REQUEST",
        "runId is required",
        correlationId()
      );
      return;
    }

    const run = await runtime.repositoryProvider.facade.runs.getRun(context.tenantId, runId);
    if (!run || run.tenant_id !== context.tenantId) {
      sendR7ScenarioSelectionReadinessError(
        response,
        404,
        "R7_BFF_SCENARIO_SELECTION_CONTEXT_NOT_FOUND",
        "scenario selection context not found",
        correlationId()
      );
      return;
    }

    const scenarioFacade = runtime.repositoryProvider.facade.scenarios;
    if (typeof scenarioFacade.listScenarioPackagesForTenant !== "function") {
      sendR7ScenarioSelectionReadinessError(
        response,
        503,
        "R7_BFF_SCENARIO_CANDIDATE_PROVIDER_UNAVAILABLE",
        "scenario candidate provider unavailable",
        correlationId()
      );
      return;
    }

    const candidates = (
      await scenarioFacade.listScenarioPackagesForTenant(context.tenantId)
    ).filter((candidate) => candidate.tenant_id === context?.tenantId);
    sendJson(
      response,
      200,
      createR7TeacherScenarioPackageCandidatesProjection({ candidates, run })
    );
  } catch (error: unknown) {
    if (error instanceof HttpError && error.statusCode === 401) {
      sendR7ScenarioSelectionReadinessError(
        response,
        401,
        "R7_BFF_AUTHENTICATION_REQUIRED",
        "authentication required",
        correlationId()
      );
      return;
    }
    if (error instanceof HttpError && error.statusCode === 403) {
      sendR7ScenarioSelectionReadinessError(
        response,
        403,
        "R7_BFF_TEACHER_AUTHORITY_REQUIRED",
        "teacher authority required",
        correlationId()
      );
      return;
    }

    sendR7ScenarioSelectionReadinessError(
      response,
      500,
      "R7_BFF_INTERNAL_ERROR",
      "internal server error",
      correlationId()
    );
  }
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

function serializeDecisionPayloadForIdempotency(payload: DecisionPayload): string {
  return JSON.stringify(payload);
}

async function findIdempotentDecisionSubmission(
  runtime: ApiRuntime,
  context: RequestContext,
  input: {
    actor: CurrentUser;
    payload: DecisionPayload;
    roundNo: number;
    runId: string;
    teamId: string;
  }
): Promise<Decision | null> {
  const priorDecisionSubmitLogs = await runtime.repositoryProvider.facade.auditLogs.listAuditLogs({
    action: "decision.submit",
    actor_id: input.actor.user_id,
    resource_type: "decision",
    scope: "tenant",
    tenant_id: context.tenantId
  });
  const matchingLog = priorDecisionSubmitLogs.find(
    (auditLog) => auditLog.request_id === context.requestId
  );

  if (!matchingLog) {
    return null;
  }

  const priorDecision = await runtime.repositoryProvider.facade.decisions.getDecisionById(
    context.tenantId,
    matchingLog.resource_id
  );
  if (!priorDecision) {
    throw new HttpError(
      409,
      "DEC-409-003",
      "decision idempotency key references a missing decision"
    );
  }

  const sameCommandTarget =
    priorDecision.run_id === input.runId &&
    priorDecision.round_no === input.roundNo &&
    priorDecision.team_id === input.teamId;
  const samePayload =
    serializeDecisionPayloadForIdempotency(priorDecision.payload) ===
    serializeDecisionPayloadForIdempotency(input.payload);

  if (!sameCommandTarget || !samePayload) {
    throw new HttpError(
      409,
      "DEC-409-002",
      "decision idempotency key was reused with a different decision command"
    );
  }

  return priorDecision;
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

  return courseReadModel;
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

function canReadClassroomScope(actor: CurrentUser): boolean {
  return actorHasAnyRole(actor, ["teacher", "tenant_admin", "platform_admin"]);
}

function isActorMemberOfTeam(actor: CurrentUser, team: Team): boolean {
  return (
    team.captain_user_id === actor.user_id ||
    team.members.some((member) => member.user_id === actor.user_id)
  );
}

function getVisibleResultTeamIdsForActor(actor: CurrentUser): Set<string> | undefined {
  if (canReadClassroomScope(actor)) {
    return undefined;
  }

  if (!actor.team_id) {
    return new Set();
  }

  return new Set([actor.team_id]);
}

async function createPublicReplayEvidenceView(
  runtime: ApiRuntime,
  context: RequestContext,
  round: Round,
  settlement: SettlementResult
): Promise<PublicRunReplayEvidence | undefined> {
  const run = await runtime.repositoryProvider.facade.runs.getRun(
    context.tenantId,
    settlement.run_id
  );

  if (!run) {
    return undefined;
  }

  const [scenario, parameterSet, teams, decisions] = await Promise.all([
    runtime.repositoryProvider.facade.scenarios.getScenarioPackage(
      context.tenantId,
      run.scenario_package_id
    ),
    runtime.repositoryProvider.facade.parameterSets.getParameterSet(
      context.tenantId,
      run.parameter_set_id
    ),
    runtime.repositoryProvider.facade.teams.listTeamsForRun(context.tenantId, run.run_id),
    runtime.repositoryProvider.facade.decisions.listDecisionsForRound(
      context.tenantId,
      run.run_id,
      round.round_id
    )
  ]);

  if (!scenario || !parameterSet) {
    return undefined;
  }

  return createM1RunReplayEvidence({
    decisions,
    parameterSet,
    round,
    run,
    scenario,
    settlement,
    teams
  }).public_view;
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
  const canSeeTruth = canReadClassroomScope(actor);
  const m1ResultMetadata: Pick<
    PublicResultView,
    "classroom_debrief_prompts" | "result_label" | "runtime_boundary" | "runtime_limitations"
  > = {
    classroom_debrief_prompts: [...M1_CLASSROOM_DEBRIEF_PROMPTS],
    result_label: M1_TEACHING_OFFICIAL_RESULT_LABEL,
    runtime_boundary: M1_JSON_RUNTIME_BOUNDARY,
    runtime_limitations: [...M1_JSON_RUNTIME_LIMITATIONS]
  };

  if (!settlement) {
    return {
      ...m1ResultMetadata,
      run_id: runId,
      round_no: roundNo,
      status: round.status,
      results: []
    };
  }

  const visibleTeamIds = getVisibleResultTeamIdsForActor(actor);
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
  const replayEvidence = canSeeTruth
    ? await createPublicReplayEvidenceView(runtime, context, round, settlement)
    : undefined;

  return {
    ...m1ResultMetadata,
    run_id: runId,
    round_no: roundNo,
    status: round.status,
    replay_hash: settlement.replay_hash,
    ...(replayEvidence ? { replay_evidence: replayEvidence } : {}),
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
  const action = url.searchParams.get("action");
  const actorId = url.searchParams.get("actor_id");
  const resourceType = url.searchParams.get("resource_type");

  return runtime.repositoryProvider.facade.auditLogs.listAuditLogs({
    ...(actorHasAnyRole(actor, ["platform_admin"])
      ? {
          scope: "platform" as const,
          ...(requestedTenant ? { tenant_id: requestedTenant } : {})
        }
      : {
          scope: "tenant" as const,
          tenant_id: context.tenantId
        }),
    ...(actorId ? { actor_id: actorId } : {}),
    ...(action ? { action } : {}),
    ...(resourceType ? { resource_type: resourceType } : {})
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
  const requestedTenantId = tenantId?.trim();

  if (
    !actorHasAnyRole(actor, ["platform_admin"]) &&
    requestedTenantId &&
    requestedTenantId !== context.tenantId
  ) {
    throw new HttpError(403, "TENANT-403-001", "tenant boundary violation");
  }

  const targetTenantId = actorHasAnyRole(actor, ["platform_admin"])
    ? (requestedTenantId ?? context.tenantId)
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

function isKnownActorRole(role: string): role is ActorRole {
  return Object.prototype.hasOwnProperty.call(ROLE_PERMISSION_MATRIX, role);
}

function normalizeRoles(actor: CurrentUser, roles?: ActorRole[]): ActorRole[] {
  const requested = roles && roles.length > 0 ? roles : ["learner"];
  const invalidRole = requested.find((role) => !isKnownActorRole(role));

  if (invalidRole) {
    throw new HttpError(422, "ROLE-422-001", "invalid role requested", [
      { field: "roles", reason: "invalid_role" }
    ]);
  }

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

  if (
    request.method === "GET" &&
    url.pathname.startsWith("/api/v1/bff/teacher/runs/") &&
    url.pathname.endsWith("/scenario-package-candidates")
  ) {
    await handleR7TeacherScenarioPackageCandidates(runtime, request, response, url);
    return;
  }

  if (
    request.method === "GET" &&
    url.pathname.startsWith("/api/v1/bff/teacher/runs/") &&
    url.pathname.endsWith("/scenario-selection-readiness")
  ) {
    await handleR7TeacherScenarioSelectionReadiness(runtime, request, response, url);
    return;
  }

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

    if (isSharedRuntime(runtime.securityConfig.environment) && isSeededDemoUser(user)) {
      throw new HttpError(401, "AUTH-401-003", "demo accounts disabled in shared runtime");
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
    const password = body.password;
    const displayName = body.display_name?.trim() || username;

    if (!username || !email || !displayName || !password?.trim()) {
      throw new HttpError(
        422,
        "USER-422-001",
        "username, email, display_name and password are required"
      );
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
    const tenantTeams = store.teams.filter((team) => team.tenant_id === context.tenantId);
    const visibleTeams = canReadClassroomScope(actor)
      ? tenantTeams
      : tenantTeams.filter((team) => isActorMemberOfTeam(actor, team));
    const visibleTeamIds = canReadClassroomScope(actor)
      ? undefined
      : new Set(visibleTeams.map((team) => team.team_id));
    const visibleCourseIds = visibleTeamIds
      ? new Set(visibleTeams.map((team) => team.course_id))
      : undefined;
    const tenantCourses = store.courses.filter((course) => course.tenant_id === context.tenantId);
    const visibleCourses = tenantCourses.filter(
      (course) => !visibleCourseIds || visibleCourseIds.has(course.course_id)
    );
    const visibleRuns = tenantRuns.filter(
      (run) => !visibleCourseIds || visibleCourseIds.has(run.course_id)
    );
    const visibleRunIds = new Set(visibleRuns.map((run) => run.run_id));
    const latestRun = visibleRuns.at(-1);
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
        courses: visibleCourses,
        teams: visibleTeams,
        runs: visibleRuns,
        rounds: store.rounds.filter(
          (round) => round.tenant_id === context.tenantId && visibleRunIds.has(round.run_id)
        ),
        decisions: store.decisions.filter(
          (decision) =>
            decision.tenant_id === context.tenantId &&
            (!visibleTeamIds || visibleTeamIds.has(decision.team_id))
        ),
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

  if (
    request.method === "GET" &&
    /^\/api\/v1\/bff\/teacher\/runs\/[^/]+\/rounds\/\d+\/workspace$/.test(url.pathname)
  ) {
    const actor = requirePermission(context, "result:read");
    if (!actorHasAnyRole(actor, ["teacher"])) {
      throw new HttpError(403, "AUTHZ-403-001", "teacher BFF requires teacher authority");
    }

    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/bff\/teacher\/runs\/([^/]+)\/rounds\/(\d+)\/workspace$/
    );
    const run = getRun(store, context, runId ?? "");
    const course = getCourse(store, context, run.course_id);
    const round = getRound(store, context, run.run_id, Number(roundNoRaw));
    const teams = store.teams.filter(
      (team) => team.tenant_id === context.tenantId && team.course_id === course.course_id
    );
    const decisions = store.decisions.filter(
      (decision) =>
        decision.tenant_id === context.tenantId &&
        decision.run_id === run.run_id &&
        decision.round_no === round.round_no
    );
    const resultView = await createPublicResultView(runtime, context, run.run_id, round.round_no);
    const scenario = store.scenarios.find(
      (candidate) =>
        candidate.tenant_id === context.tenantId &&
        candidate.scenario_package_id === course.scenario_package_id
    );
    const parameterSet = store.parameterSets.find(
      (candidate) =>
        candidate.tenant_id === context.tenantId &&
        candidate.parameter_set_id === course.parameter_set_id
    );

    sendJson(
      response,
      200,
      createEnvelope(
        context,
        createTeacherBffWorkspaceDto({
          actor,
          auditLogs: store.auditLogs.filter((log) => log.tenant_id === context.tenantId),
          course,
          decisions,
          resultView,
          round,
          run,
          ...(parameterSet ? { parameterSet } : {}),
          ...(scenario ? { scenario } : {}),
          teams
        })
      )
    );
    return;
  }

  if (
    request.method === "GET" &&
    /^\/api\/v1\/bff\/student\/runs\/[^/]+\/rounds\/\d+\/cockpit$/.test(url.pathname)
  ) {
    const actor = requirePermission(context, "result:read");
    if (canReadClassroomScope(actor) || !actor.team_id) {
      throw new HttpError(403, "AUTHZ-403-001", "student BFF requires learner team scope");
    }

    const [, runId, roundNoRaw] = matchPath(
      url.pathname,
      /^\/api\/v1\/bff\/student\/runs\/([^/]+)\/rounds\/(\d+)\/cockpit$/
    );
    const run = getRun(store, context, runId ?? "");
    const course = getCourse(store, context, run.course_id);
    const round = getRound(store, context, run.run_id, Number(roundNoRaw));
    const team = store.teams.find(
      (candidate) =>
        candidate.tenant_id === context.tenantId &&
        candidate.course_id === course.course_id &&
        candidate.team_id === actor.team_id &&
        isActorMemberOfTeam(actor, candidate)
    );

    if (!team) {
      throw new HttpError(404, "TEAM-404-001", "team not found");
    }

    sendJson(
      response,
      200,
      createEnvelope(
        context,
        createStudentBffCockpitDto({
          actor,
          course,
          resultView: await createPublicResultView(runtime, context, run.run_id, round.round_no),
          round,
          run,
          team
        })
      )
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/bff/admin/tenant-summary") {
    const actor = requirePermission(context, "tenant:read");
    if (!actorHasAnyRole(actor, ["tenant_admin"])) {
      throw new HttpError(
        403,
        "AUTHZ-403-001",
        "tenant summary BFF requires tenant admin authority"
      );
    }
    const tenant = store.tenants.find(
      (candidate) => candidate.tenant_id === context.tenantId && candidate.status === "active"
    );

    if (!tenant) {
      throw new HttpError(404, "TENANT-404-001", "tenant not found");
    }

    sendJson(
      response,
      200,
      createEnvelope(
        context,
        createTenantAdminSummaryDto({
          actor,
          auditLogs: store.auditLogs.filter((log) => log.tenant_id === tenant.tenant_id),
          courses: store.courses.filter((course) => course.tenant_id === tenant.tenant_id),
          runs: store.runs.filter((run) => run.tenant_id === tenant.tenant_id),
          teams: store.teams.filter((team) => team.tenant_id === tenant.tenant_id),
          tenant
        })
      )
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/bff/admin/platform-authority") {
    const actor = requirePermission(context, "tenant:read");
    if (!actorHasAnyRole(actor, ["platform_admin"])) {
      throw new HttpError(403, "AUTHZ-403-001", "platform BFF requires platform authority");
    }
    if (url.searchParams.get("scope") !== "platform") {
      throw new HttpError(
        422,
        "BFF-422-001",
        "platform authority BFF requires explicit scope=platform"
      );
    }

    sendJson(
      response,
      200,
      createEnvelope(
        context,
        createPlatformAdminAuthorityDto({
          actor,
          tenants: store.tenants
        })
      )
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/courses") {
    requirePermission(context, "course:read");
    const courses = await runtime.repositoryProvider.facade.courses.listCoursesForTenant(
      context.tenantId
    );
    sendJson(response, 200, createEnvelope(context, courses));
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
    if (course.status === "published") {
      sendJson(response, 200, createEnvelope(context, course));
      return;
    }
    if (course.status !== "draft") {
      throw new HttpError(409, "COURSE-409-001", "course must be draft before publish");
    }
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
    const outcome = await runSettlement(runtime, context, runId ?? "", Number(roundNoRaw));

    if (outcome.committed) {
      await appendAudit(runtime, {
        actor,
        action: "round.settle_requested",
        resourceType: "settlement_result",
        resourceId: outcome.settlement.settlement_result_id,
        requestId: context.requestId,
        after: clonePublic({ replay_hash: outcome.settlement.replay_hash })
      });
    }

    response.setHeader("x-simwar-settlement-outcome", outcome.responseSemantics);
    sendJson(response, 200, createEnvelope(context, outcome.settlement));
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
    const outcome = await runSettlement(runtime, serviceContext, runId ?? "", Number(roundNoRaw));

    if (outcome.committed) {
      await appendAudit(runtime, {
        actor: serviceActor,
        action: "round.settle",
        resourceType: "settlement_result",
        resourceId: outcome.settlement.settlement_result_id,
        requestId: context.requestId,
        tenantId: context.tenantId,
        after: clonePublic({ replay_hash: outcome.settlement.replay_hash })
      });
    }

    response.setHeader("x-simwar-settlement-outcome", outcome.responseSemantics);
    sendJson(response, 200, createEnvelope(context, outcome.settlement));
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
): Promise<RunSettlementOutcome> {
  const run = await runtime.repositoryProvider.facade.runs.getRun(context.tenantId, runId);

  if (!run) {
    throw new HttpError(404, "RUN-404-001", "run not found");
  }

  const lockKey = settlementBusinessKey(context.tenantId, run.run_id, roundNo);
  const releaseSettlementLock = await acquireSettlementLock(runtime, lockKey);

  try {
    const rounds = await runtime.repositoryProvider.facade.rounds.listRoundsForRun(
      context.tenantId,
      run.run_id
    );
    const round = rounds.find((candidate) => candidate.round_no === roundNo);

    if (!round) {
      throw new HttpError(404, "ROUND-404-001", "round not found");
    }

    if (round.status !== "locked" && round.status !== "settled" && round.status !== "published") {
      throw new HttpError(409, "ROUND-409-004", "round must be locked before settlement");
    }

    const scenario = await runtime.repositoryProvider.facade.scenarios.getScenarioPackage(
      context.tenantId,
      run.scenario_package_id
    );
    const parameterSet = await runtime.repositoryProvider.facade.parameterSets.getParameterSet(
      context.tenantId,
      run.parameter_set_id
    );
    const teams = await runtime.repositoryProvider.facade.teams.listTeamsForRun(
      context.tenantId,
      run.run_id
    );
    const roundDecisions = await runtime.repositoryProvider.facade.decisions.listDecisionsForRound(
      context.tenantId,
      run.run_id,
      round.round_id
    );
    const latestDecisions = teams.map((team) => {
      const versions = roundDecisions.filter(
        (decision) => decision.round_no === round.round_no && decision.team_id === team.team_id
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

    const existingSettlements =
      await runtime.repositoryProvider.facade.settlements.listSettlementResultsForRound(
        context.tenantId,
        run.run_id,
        round.round_id
      );
    const existingSettlement =
      existingSettlements.find(
        (settlement) =>
          settlement.tenant_id === context.tenantId &&
          settlement.run_id === run.run_id &&
          settlement.round_no === round.round_no
      ) ?? null;
    const outcome = prepareSettlementOutcome(
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
      {
        createSettlementResultId: () =>
          runtime.repositoryProvider.idGenerator.createSettlementResultId(),
        existingSettlement
      }
    );

    if (outcome.replayHashConflict) {
      throw new HttpError(
        409,
        "SETTLE-409-002",
        "settlement result already exists for this business key with different replay-relevant input",
        [{ field: "replay_hash", reason: "conflicting_existing_settlement" }]
      );
    }

    if (outcome.shouldCommit) {
      await runtime.repositoryProvider.facade.commitSettlementOutcome({
        tenant_id: context.tenantId,
        round_id: round.round_id,
        settlement_result: outcome.settlement
      });
    }

    return {
      settlement: outcome.settlement,
      committed: outcome.shouldCommit,
      responseSemantics: outcome.shouldCommit ? "committed" : "reused"
    };
  } finally {
    releaseSettlementLock();
  }
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
