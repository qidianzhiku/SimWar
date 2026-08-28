import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  CurrentUser,
  M4MultipathCounterfactualInput,
  M4MultipathSurface,
  M4CounterfactualPathInput,
  W4ScopeContext,
  W4StateRef
} from "@simwar/shared-contracts";
import {
  M4MultipathCounterfactualTransferError,
  type M4MultipathCounterfactualTransferService
} from "../m4-multipath-counterfactual-transfer.js";

type RouteContext = { requestId: string; tenantId: string; actor?: CurrentUser };

interface M4RouteDependencies {
  readJson: <T>(request: IncomingMessage) => Promise<T>;
  sendJson: (response: ServerResponse, statusCode: number, body: unknown) => void;
  createEnvelope: (context: RouteContext, payload: unknown, message?: string) => unknown;
  requireStudent: () => CurrentUser;
  requireTeacher: () => CurrentUser;
}

function errorStatus(error: M4MultipathCounterfactualTransferError): number {
  if (error.code.includes("SCOPE") || error.code.includes("RUNTIME")) return 409;
  if (error.code.includes("LINEAGE") || error.code.includes("REENTRY")) return 409;
  return 400;
}

function routeScope(
  context: RouteContext,
  actor: CurrentUser,
  runId: string,
  input: Partial<M4MultipathCounterfactualInput>,
  roundNo: number
): W4ScopeContext {
  if (actor.tenant_id !== context.tenantId) {
    throw new M4MultipathCounterfactualTransferError("M4_TENANT_SCOPE_CONFLICT");
  }
  const sourceRef = input.source_state_ref;
  const teamId = sourceRef?.team_id ?? "";
  if (!teamId.trim()) {
    throw new M4MultipathCounterfactualTransferError("M4_TEAM_SCOPE_REQUIRED");
  }
  if (actor.roles.includes("learner") && actor.team_id !== teamId) {
    throw new M4MultipathCounterfactualTransferError("M4_TEAM_SCOPE_CONFLICT");
  }
  return {
    actor_id: actor.user_id,
    tenant_id: context.tenantId,
    course_id: sourceRef?.course_id ?? "",
    run_id: runId,
    team_id: teamId,
    round_id: sourceRef?.round_id ?? "",
    round_no: Number.isSafeInteger(roundNo) ? roundNo : 1,
    role_key: actor.roles.includes("team_captain") ? "CEO" : (actor.roles[0] ?? "unknown"),
    activity_id: "w4-enterprise-state-strategic-evolution"
  };
}

function queryScope(
  context: RouteContext,
  actor: CurrentUser,
  runId: string,
  url: URL
): W4ScopeContext {
  const teamId = url.searchParams.get("team_id") ?? actor.team_id ?? "";
  if (actor.tenant_id !== context.tenantId) {
    throw new M4MultipathCounterfactualTransferError("M4_TENANT_SCOPE_CONFLICT");
  }
  if (!teamId.trim()) {
    throw new M4MultipathCounterfactualTransferError("M4_TEAM_SCOPE_REQUIRED");
  }
  if (actor.roles.includes("learner") && actor.team_id !== teamId) {
    throw new M4MultipathCounterfactualTransferError("M4_TEAM_SCOPE_CONFLICT");
  }
  return {
    actor_id: actor.user_id,
    tenant_id: context.tenantId,
    course_id: url.searchParams.get("course_id") ?? "",
    run_id: runId,
    team_id: teamId,
    round_id: url.searchParams.get("round_id") ?? "",
    round_no: Number(url.searchParams.get("round_no") ?? 1),
    role_key: actor.roles.includes("team_captain") ? "CEO" : (actor.roles[0] ?? "unknown"),
    activity_id: "w4-enterprise-state-strategic-evolution"
  };
}

function parseInput(body: Record<string, unknown>): M4MultipathCounterfactualInput {
  const sourceStateRef = body.source_state_ref as W4StateRef;
  const paths: M4CounterfactualPathInput[] = Array.isArray(body.paths)
    ? body.paths.map((candidate) => {
        const path = candidate && typeof candidate === "object" ? candidate : {};
        const record = path as Record<string, unknown>;
        return {
          path_id: String(record.path_id ?? ""),
          label: String(record.label ?? ""),
          decision_ids: Array.isArray(record.decision_ids) ? record.decision_ids.map(String) : []
        };
      })
    : [];
  return {
    source_state_ref: sourceStateRef,
    source_outcome_id: String(body.source_outcome_id ?? ""),
    paths,
    horizon_rounds: Number(body.horizon_rounds),
    scenario_package_id: String(body.scenario_package_id ?? ""),
    parameter_set_id: String(body.parameter_set_id ?? ""),
    engine_id: String(body.engine_id ?? ""),
    plugin_ids: Array.isArray(body.plugin_ids) ? body.plugin_ids.map(String) : [],
    seed: Number(body.seed)
  };
}

export async function handleM4MultipathCounterfactualTransferRoute(
  service: M4MultipathCounterfactualTransferService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: RouteContext,
  dependencies: M4RouteDependencies
): Promise<boolean> {
  const match = url.pathname.match(
    /^\/api\/v1\/bff\/(student|teacher)\/w4\/runs\/([^/]+)\/multipath-counterfactual-transfer$/
  );
  if (!match) return false;

  const surface = match[1] as M4MultipathSurface;
  const actor =
    surface === "student" ? dependencies.requireStudent() : dependencies.requireTeacher();
  try {
    if (request.method === "GET") {
      const result = await service.createDefault(
        queryScope(context, actor, match[2] ?? "", url),
        surface
      );
      dependencies.sendJson(response, 200, dependencies.createEnvelope(context, result));
      return true;
    }
    if (request.method !== "POST") return false;
    const body = await dependencies.readJson<Record<string, unknown>>(request);
    const input = parseInput(body);
    const scope = routeScope(context, actor, match[2] ?? "", input, Number(body.round_no ?? 1));
    const result = await service.create(scope, input, surface);
    dependencies.sendJson(response, 200, dependencies.createEnvelope(context, result));
  } catch (error) {
    if (error instanceof M4MultipathCounterfactualTransferError) {
      dependencies.sendJson(
        response,
        errorStatus(error),
        dependencies.createEnvelope(context, null, error.code)
      );
      return true;
    }
    throw error;
  }
  return true;
}
