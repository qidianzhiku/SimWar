import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  CurrentUser,
  W4CanonicalStrategicDecision,
  W4DecisionAdmission,
  W4EnterpriseState,
  W4ReplayInputManifest,
  W4ScopeContext,
  W4StateRef,
  ProjectProfileRef
} from "@simwar/shared-contracts";
import {
  createEnterpriseStateStrategicEvolutionService,
  W4EnterpriseStateError,
  type W4Repository
} from "../w4-enterprise-state.js";

type RouteContext = { requestId: string; tenantId: string; actor?: CurrentUser };

interface W4RouteDependencies {
  repository: W4Repository;
  readJson: <T>(request: IncomingMessage) => Promise<T>;
  sendJson: (response: ServerResponse, statusCode: number, body: unknown) => void;
  createEnvelope: (context: RouteContext, payload: unknown, message?: string) => unknown;
  requireActor: () => CurrentUser;
  requireStudent: () => CurrentUser;
  requireTeacher: () => CurrentUser;
  requireAdmin: () => CurrentUser;
  resolveRun: (tenantId: string, runId: string) => Promise<{ course_id: string } | null>;
  resolveTeam: (tenantId: string, teamId: string) => Promise<{ course_id: string } | null>;
  resolveRound: (
    tenantId: string,
    runId: string,
    roundNo: number
  ) => Promise<{ round_id: string; status: string } | null>;
  resolveProjectAuthority?: (
    scope: W4ScopeContext,
    reference: ProjectProfileRef
  ) => Promise<{ source_assignment_id: string; project_name: string } | null>;
  admitStrategicDecision: (
    scope: W4ScopeContext,
    decision: W4CanonicalStrategicDecision
  ) => Promise<W4DecisionAdmission>;
  assertSettlementReady: (
    scope: W4ScopeContext,
    openingStateRef: W4StateRef
  ) => Promise<W4ReplayInputManifest>;
}

const ACTIVITY_ID = "w4-enterprise-state-strategic-evolution";

function routeScope(
  context: RouteContext,
  actor: CurrentUser,
  runId: string,
  roundId: string,
  roundNo: number,
  teamId: string,
  courseId: string
): W4ScopeContext {
  if (actor.tenant_id !== context.tenantId) {
    throw new W4EnterpriseStateError("W4_TENANT_SCOPE_CONFLICT");
  }
  if (!teamId.trim()) throw new W4EnterpriseStateError("W4_TEAM_SCOPE_REQUIRED");
  if (actor.roles.includes("learner") && actor.team_id !== teamId) {
    throw new W4EnterpriseStateError("W4_TEAM_SCOPE_CONFLICT");
  }
  return {
    actor_id: actor.user_id,
    tenant_id: context.tenantId,
    course_id: courseId,
    run_id: runId,
    team_id: teamId,
    round_id: roundId,
    round_no: roundNo,
    role_key: actor.roles.includes("team_captain") ? "CEO" : (actor.roles[0] ?? "unknown"),
    activity_id: ACTIVITY_ID
  };
}

function parseRoundPath(
  pathname: string,
  prefix: string
): { runId: string; roundNo: number } | null {
  const match = pathname.match(new RegExp(`^${prefix}/runs/([^/]+)/rounds/(\\d+)(?:/([^/]+))?$`));
  if (!match) return null;
  return { runId: match[1] ?? "", roundNo: Number(match[2]) };
}

function errorStatus(error: W4EnterpriseStateError): number {
  return error.code.includes("CONFLICT") ||
    error.code.includes("DUPLICATE") ||
    error.code.includes("ATOMIC")
    ? 409
    : error.code.includes("NOT_FOUND")
      ? 404
      : 422;
}

async function assertRuntimeScope(
  dependencies: Pick<W4RouteDependencies, "resolveRun" | "resolveTeam">,
  tenantId: string,
  runId: string,
  courseId: string,
  teamId: string
): Promise<void> {
  const run = await dependencies.resolveRun(tenantId, runId);
  if (!run) throw new W4EnterpriseStateError("W4_RUN_NOT_FOUND");
  if (run.course_id !== courseId) throw new W4EnterpriseStateError("W4_COURSE_SCOPE_CONFLICT");
  const team = await dependencies.resolveTeam(tenantId, teamId);
  if (!team) throw new W4EnterpriseStateError("W4_TEAM_NOT_FOUND");
  if (team.course_id !== courseId) throw new W4EnterpriseStateError("W4_TEAM_SCOPE_CONFLICT");
}

function assertWritableRound(round: { status: string }): void {
  if (round.status !== "open") {
    throw new W4EnterpriseStateError("W4_ROUND_READ_ONLY_CONFLICT");
  }
}

export async function handleW4EnterpriseStateRoute(
  repository: W4Repository,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: RouteContext,
  dependencies: Omit<W4RouteDependencies, "repository">
): Promise<boolean> {
  const service = createEnterpriseStateStrategicEvolutionService(repository);
  if (request.method === "GET" && url.pathname === "/api/v1/bff/admin/w4/portfolio") {
    const actor = dependencies.requireAdmin();
    if (actor.tenant_id !== context.tenantId) {
      throw new W4EnterpriseStateError("W4_TENANT_SCOPE_CONFLICT");
    }
    const current = repository.snapshot();
    const states = current.states.filter((state) => state.tenant_id === context.tenantId);
    const tenantRuns = new Set(states.map((state) => `${state.course_id}:${state.run_id}`));
    const portfolios = await Promise.all(
      [...tenantRuns].map(async (key) => {
        const [courseId = "", runId = ""] = key.split(":");
        const runStates = states.filter(
          (state) => state.course_id === courseId && state.run_id === runId
        );
        const latest = runStates.slice().sort((left, right) => right.round_no - left.round_no)[0];
        const initiatives = current.initiatives.filter(
          (item) =>
            item.tenant_id === context.tenantId &&
            item.course_id === courseId &&
            item.run_id === runId
        );
        const teamPaths = await Promise.all(
          [...new Set(runStates.map((state) => state.team_id))].map(async (teamId) => {
            const teamLatest = runStates
              .filter((state) => state.team_id === teamId)
              .slice()
              .sort((left, right) => right.round_no - left.round_no)[0];
            if (!teamLatest) return null;
            const teamProjection = await service.getProjection({
              actor_id: actor.user_id,
              tenant_id: context.tenantId,
              course_id: courseId,
              run_id: runId,
              team_id: teamId,
              round_id: teamLatest.round_id,
              round_no: teamLatest.round_no,
              role_key: actor.roles[0] ?? "admin",
              activity_id: ACTIVITY_ID
            });
            return {
              team_id: teamId,
              path_evidence: teamProjection.path_evidence,
              process_information: {
                status: teamProjection.initiatives.some(
                  (initiative) => initiative.status === "blocked"
                )
                  ? "blocked"
                  : teamProjection.state
                    ? "ready"
                    : "empty",
                activity_id: ACTIVITY_ID
              },
              outcome_information: {
                status: teamProjection.closing_state_ref ? "official" : "empty",
                opening_state_ref: teamProjection.opening_state_ref,
                closing_state_ref: teamProjection.closing_state_ref
              }
            };
          })
        );
        const latestOutcome = current.outcomes
          .filter(
            (outcome) =>
              outcome.tenant_id === context.tenantId &&
              outcome.course_id === courseId &&
              outcome.run_id === runId
          )
          .slice()
          .sort((left, right) => right.round_no - left.round_no)[0];
        return {
          course_id: courseId,
          run_id: runId,
          enterprise_state_count: runStates.length,
          latest_state_ref: latest
            ? {
                enterprise_state_id: latest.enterprise_state_id,
                round_id: latest.round_id,
                round_no: latest.round_no,
                state_digest: latest.state_digest
              }
            : null,
          portfolio: latest?.state.portfolio ?? { projects: [], facilities: [] },
          project_portfolio: current.projectPortfolio.filter(
            (entry) =>
              entry.tenant_id === context.tenantId &&
              entry.course_id === courseId &&
              entry.run_id === runId
          ),
          project_transactions: current.projectTransactions.filter(
            (transaction) =>
              transaction.tenant_id === context.tenantId &&
              transaction.course_id === courseId &&
              transaction.run_id === runId
          ),
          operating_units: latest?.state.operating_units ?? [],
          process_information: {
            status: initiatives.some((initiative) => initiative.status === "blocked")
              ? "blocked"
              : latest
                ? "ready"
                : "empty",
            activity_id: ACTIVITY_ID
          },
          outcome_information: {
            status: latestOutcome ? "official" : "empty",
            opening_state_ref: latestOutcome?.opening_state_ref ?? null,
            closing_state_ref: latestOutcome?.closing_state_ref ?? null
          },
          team_paths: teamPaths.filter((path): path is NonNullable<typeof path> => path !== null),
          initiatives: initiatives.map((initiative) => ({
            initiative_id: initiative.initiative_id,
            kind: initiative.kind,
            status: initiative.status,
            project_lifecycle_status: initiative.project_lifecycle_status ?? null,
            project_name: initiative.project?.project_name ?? null
          }))
        };
      })
    );
    dependencies.sendJson(
      response,
      200,
      dependencies.createEnvelope(context, {
        surface: "admin",
        group: { tenant_id: context.tenantId, portfolio_count: portfolios.length },
        portfolios,
        writer_authority: "SOLE_W4_ENTERPRISE_STATE_SERVICE"
      })
    );
    return true;
  }
  const lifecycleMatch = url.pathname.match(
    /^\/api\/v1\/w4\/runs\/([^/]+)\/rounds\/(\d+)\/initiatives\/([^/]+)\/lifecycle$/
  );
  if (request.method === "POST" && lifecycleMatch) {
    try {
      const actor = dependencies.requireTeacher();
      const body = await dependencies.readJson<Record<string, unknown>>(request);
      const runId = lifecycleMatch[1] ?? "";
      const roundNo = Number(lifecycleMatch[2]);
      const initiativeId = lifecycleMatch[3] ?? "";
      const teamId = String(body.team_id ?? "");
      const courseId = String(body.course_id ?? "course_demo");
      const round = await dependencies.resolveRound(context.tenantId, runId, roundNo);
      if (!round) throw new W4EnterpriseStateError("W4_ROUND_SCOPE_CONFLICT");
      assertWritableRound(round);
      const scope = routeScope(
        context,
        actor,
        runId,
        String(body.round_id ?? round.round_id),
        roundNo,
        teamId,
        courseId
      );
      await assertRuntimeScope(dependencies, context.tenantId, runId, courseId, teamId);
      const target = String(body.target ?? "") as Parameters<
        typeof service.advanceProjectLifecycle
      >[2];
      const result = await service.advanceProjectLifecycle(scope, initiativeId, target);
      dependencies.sendJson(response, 200, dependencies.createEnvelope(context, result));
      return true;
    } catch (error) {
      if (error instanceof W4EnterpriseStateError) {
        dependencies.sendJson(
          response,
          errorStatus(error),
          dependencies.createEnvelope(context, null, error.code)
        );
        return true;
      }
      throw error;
    }
  }
  const portfolioProjectMatch = url.pathname.match(
    /^\/api\/v1\/w4\/runs\/([^/]+)\/rounds\/(\d+)\/portfolio\/projects$/
  );
  if (request.method === "POST" && portfolioProjectMatch) {
    try {
      const actor = dependencies.requireTeacher();
      const body = await dependencies.readJson<Record<string, unknown>>(request);
      const runId = portfolioProjectMatch[1] ?? "";
      const roundNo = Number(portfolioProjectMatch[2]);
      const round = await dependencies.resolveRound(context.tenantId, runId, roundNo);
      if (!round) throw new W4EnterpriseStateError("W4_ROUND_SCOPE_CONFLICT");
      assertWritableRound(round);
      const scope = routeScope(
        context,
        actor,
        runId,
        String(body.round_id ?? round.round_id),
        roundNo,
        String(body.team_id ?? ""),
        String(body.course_id ?? "course_demo")
      );
      await assertRuntimeScope(
        dependencies,
        context.tenantId,
        runId,
        scope.course_id,
        scope.team_id
      );
      if (!dependencies.resolveProjectAuthority) {
        throw new W4EnterpriseStateError("W4_PROJECT_ASSIGNMENT_REQUIRED");
      }
      const reference = body.project_profile_reference as ProjectProfileRef;
      const authority = await dependencies.resolveProjectAuthority(scope, reference);
      if (!authority) throw new W4EnterpriseStateError("W4_PROJECT_ASSIGNMENT_REQUIRED");
      const result = await service.addProjectToPortfolio(scope, {
        project_entry_id: String(body.project_entry_id ?? ""),
        initiative_id: String(body.initiative_id ?? ""),
        project_profile_reference: reference,
        source_assignment_id: authority.source_assignment_id,
        project_name: authority.project_name
      });
      dependencies.sendJson(response, 201, dependencies.createEnvelope(context, result));
      return true;
    } catch (error) {
      if (error instanceof W4EnterpriseStateError) {
        dependencies.sendJson(
          response,
          errorStatus(error),
          dependencies.createEnvelope(context, null, error.code)
        );
        return true;
      }
      throw error;
    }
  }
  const portfolioTransactionMatch = url.pathname.match(
    /^\/api\/v1\/w4\/runs\/([^/]+)\/rounds\/(\d+)\/portfolio\/transactions(?:\/([^/]+)\/advance)?$/
  );
  if (request.method === "POST" && portfolioTransactionMatch) {
    try {
      const actor = dependencies.requireTeacher();
      const body = await dependencies.readJson<Record<string, unknown>>(request);
      const runId = portfolioTransactionMatch[1] ?? "";
      const roundNo = Number(portfolioTransactionMatch[2]);
      const transactionId = portfolioTransactionMatch[3];
      const round = await dependencies.resolveRound(context.tenantId, runId, roundNo);
      if (!round) throw new W4EnterpriseStateError("W4_ROUND_SCOPE_CONFLICT");
      assertWritableRound(round);
      const scope = routeScope(
        context,
        actor,
        runId,
        String(body.round_id ?? round.round_id),
        roundNo,
        String(body.team_id ?? ""),
        String(body.course_id ?? "course_demo")
      );
      await assertRuntimeScope(
        dependencies,
        context.tenantId,
        runId,
        scope.course_id,
        scope.team_id
      );
      if (transactionId) {
        const result = await service.advanceProjectTransaction(
          scope,
          transactionId,
          String(body.target ?? "") as Parameters<typeof service.advanceProjectTransaction>[2],
          {
            ...(body.buyer_confirmation_id
              ? { buyer_confirmation_id: String(body.buyer_confirmation_id) }
              : {}),
            ...(body.seller_confirmation_id
              ? { seller_confirmation_id: String(body.seller_confirmation_id) }
              : {})
          }
        );
        dependencies.sendJson(response, 200, dependencies.createEnvelope(context, result));
        return true;
      }
      const kind = String(body.kind ?? "") as Exclude<
        Parameters<typeof service.createProjectTransaction>[1]["kind"],
        "project_add"
      >;
      const targetReference = body.target_project_profile_reference as
        | ProjectProfileRef
        | undefined;
      if (
        kind === "merger_acquisition" &&
        (!dependencies.resolveProjectAuthority || !targetReference)
      ) {
        throw new W4EnterpriseStateError("W4_M_AND_A_SUCCESSOR_REQUIRED");
      }
      const targetAuthority =
        targetReference && dependencies.resolveProjectAuthority
          ? await dependencies.resolveProjectAuthority(scope, targetReference)
          : null;
      if (targetReference && !targetAuthority) {
        throw new W4EnterpriseStateError("W4_PROJECT_ASSIGNMENT_REQUIRED");
      }
      const result = await service.createProjectTransaction(scope, {
        transaction_id: String(body.transaction_id ?? ""),
        kind,
        initiative_id: String(body.initiative_id ?? ""),
        project_entry_id: String(body.project_entry_id ?? ""),
        ...(targetReference ? { target_project_profile_reference: targetReference } : {}),
        ...(targetAuthority ? { target_project_name: targetAuthority.project_name } : {})
      });
      dependencies.sendJson(response, 201, dependencies.createEnvelope(context, result));
      return true;
    } catch (error) {
      if (error instanceof W4EnterpriseStateError) {
        dependencies.sendJson(
          response,
          errorStatus(error),
          dependencies.createEnvelope(context, null, error.code)
        );
        return true;
      }
      throw error;
    }
  }
  const route = parseRoundPath(url.pathname, "/api/v1/w4");
  const bffRoute = parseRoundPath(url.pathname, "/api/v1/bff/(?:student|teacher|admin)/w4");
  if (!route && !bffRoute) return false;

  const isBff = Boolean(bffRoute);
  const parsed = route ?? bffRoute!;
  const suffix = url.pathname.split(`/rounds/${parsed.roundNo}`)[1] ?? "";

  try {
    if (isBff && request.method === "GET") {
      const surface = url.pathname.match(/^\/api\/v1\/bff\/(student|teacher|admin)\/w4\//)?.[1];
      const actor =
        surface === "student"
          ? dependencies.requireStudent()
          : surface === "admin"
            ? dependencies.requireAdmin()
            : dependencies.requireTeacher();
      const teamId = url.searchParams.get("team_id") ?? actor.team_id ?? "";
      const courseId = url.searchParams.get("course_id") ?? "course_demo";
      await assertRuntimeScope(dependencies, context.tenantId, parsed.runId, courseId, teamId);
      const requestedRoundId = url.searchParams.get("round_id");
      if (requestedRoundId) {
        const runtimeRound = await dependencies.resolveRound(
          context.tenantId,
          parsed.runId,
          parsed.roundNo
        );
        if (!runtimeRound || runtimeRound.round_id !== requestedRoundId) {
          throw new W4EnterpriseStateError("W4_ROUND_SCOPE_CONFLICT");
        }
      }
      const scope = routeScope(
        context,
        actor,
        parsed.runId,
        requestedRoundId ?? `round_${parsed.runId}_${parsed.roundNo}`,
        parsed.roundNo,
        teamId,
        courseId
      );
      const projection = await service.getProjection(scope, {
        allowEmptyRound: Boolean(requestedRoundId)
      });
      const safeProjection =
        surface === "student"
          ? {
              ...projection,
              state: projection.state
                ? {
                    capacity: projection.state.capacity,
                    product_lines: projection.state.product_lines,
                    positioning: projection.state.positioning,
                    operating_units: projection.state.operating_units,
                    portfolio: projection.state.portfolio
                  }
                : null
            }
          : projection;
      dependencies.sendJson(
        response,
        200,
        dependencies.createEnvelope(context, {
          ...safeProjection,
          surface,
          process_information: {
            status: projection.initiatives.some((initiative) => initiative.status === "blocked")
              ? "blocked"
              : "ready",
            activity_id: ACTIVITY_ID
          },
          outcome_information: {
            status: projection.closing_state_ref ? "official" : "empty",
            opening_state_ref: projection.opening_state_ref,
            closing_state_ref: projection.closing_state_ref
          }
        })
      );
      return true;
    }

    const body =
      request.method === "GET" ? {} : await dependencies.readJson<Record<string, unknown>>(request);
    const operation = suffix.replace(/^\//, "");
    const actor =
      operation === "strategic-decisions"
        ? dependencies.requireActor()
        : dependencies.requireTeacher();
    const teamId = String(body.team_id ?? actor.team_id ?? "");
    const roundId = String(body.round_id ?? `round_${parsed.runId}_${parsed.roundNo}`);
    const scope = routeScope(
      context,
      actor,
      parsed.runId,
      roundId,
      parsed.roundNo,
      teamId,
      String(body.course_id ?? "course_demo")
    );
    await assertRuntimeScope(
      dependencies,
      context.tenantId,
      parsed.runId,
      scope.course_id,
      scope.team_id
    );

    if (request.method === "POST" && operation === "states") {
      if (parsed.roundNo !== 1) {
        throw new W4EnterpriseStateError("W4_ROUND_SCOPE_CONFLICT");
      }
      const supplied = (body.state ?? {}) as Partial<W4EnterpriseState["state"]>;
      const input: W4EnterpriseState = {
        enterprise_state_id: String(
          body.enterprise_state_id ?? `state_${parsed.runId}_${scope.team_id}_initial`
        ),
        tenant_id: context.tenantId,
        course_id: scope.course_id,
        run_id: parsed.runId,
        team_id: scope.team_id,
        round_id: roundId,
        round_no: parsed.roundNo,
        version: 1,
        parent_state_ref: null,
        state_digest: "",
        state: {
          cash: Number(supplied.cash ?? 1000),
          capacity: Number(supplied.capacity ?? 100),
          product_lines: Array.isArray(supplied.product_lines)
            ? supplied.product_lines.map(String)
            : ["core-care"],
          positioning: String(supplied.positioning ?? "trusted-care"),
          organization: supplied.organization ?? { team_size: 4 },
          operating_units: Array.isArray(supplied.operating_units)
            ? structuredClone(supplied.operating_units)
            : [{ operating_unit_id: "unit_default", name: "Core Operations", status: "active" }],
          portfolio: supplied.portfolio ?? { projects: [], facilities: [] }
        }
      };
      const created = await service.createInitialState(scope, input);
      dependencies.sendJson(response, 201, dependencies.createEnvelope(context, created));
      return true;
    }

    if (request.method === "POST" && operation === "strategic-decisions") {
      const decision = body.decision as Parameters<typeof service.commitStrategicDecision>[1];
      if (!decision || typeof decision !== "object")
        throw new W4EnterpriseStateError("W4_DECISION_REQUIRED");
      const admission = await dependencies.admitStrategicDecision(scope, decision);
      const compiled = await service.commitStrategicDecision(scope, {
        ...decision,
        status: "canonical",
        admission
      });
      dependencies.sendJson(response, 201, dependencies.createEnvelope(context, compiled));
      return true;
    }

    if (request.method === "POST" && operation === "settle") {
      const openingStateRef = body.opening_state_ref as Parameters<
        typeof service.settleRound
      >[1]["opening_state_ref"];
      const replayInputManifest = await dependencies.assertSettlementReady(scope, openingStateRef);
      const result = await service.settleRound(scope, {
        opening_state_ref: openingStateRef,
        decision_id: body.decision_id ? String(body.decision_id) : null,
        replay_input_manifest: replayInputManifest
      });
      dependencies.sendJson(response, 200, dependencies.createEnvelope(context, result));
      return true;
    }

    if (request.method === "POST" && operation === "continue") {
      const result = await service.createNextRoundOpening({
        ...scope,
        round_id: roundId,
        opening_state_ref: body.closing_state_ref as Parameters<
          typeof service.createNextRoundOpening
        >[0]["opening_state_ref"]
      });
      dependencies.sendJson(response, 201, dependencies.createEnvelope(context, result));
      return true;
    }

    if (request.method === "POST" && operation === "shadow-replay") {
      const result = await service.shadowReplay(scope, String(body.outcome_id ?? ""));
      dependencies.sendJson(response, 200, dependencies.createEnvelope(context, result));
      return true;
    }

    if (request.method === "POST" && operation === "replay") {
      const result = await service.replay(scope, String(body.outcome_id ?? ""));
      dependencies.sendJson(response, 200, dependencies.createEnvelope(context, result));
      return true;
    }
  } catch (error) {
    if (error instanceof W4EnterpriseStateError) {
      dependencies.sendJson(
        response,
        errorStatus(error),
        dependencies.createEnvelope(context, { code: error.code, message: error.message })
      );
      return true;
    }
    throw error;
  }
  return false;
}
