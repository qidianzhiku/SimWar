import type { IncomingMessage, ServerResponse } from "node:http";
import type { CurrentUser } from "@simwar/shared-contracts";
import {
  ValidationEnvironmentLaunchError,
  ValidationEnvironmentLaunchService,
  type ValidationEnvironmentLaunchInput,
  type ValidationEnvironmentLaunchStepExecutor
} from "../validation-environment-launch.js";

export interface W025LaunchRouteContext {
  readonly requestId: string;
  readonly tenantId: string;
  readonly actor: CurrentUser;
}

export interface W025LaunchRouteHelpers {
  readJson(request: IncomingMessage): Promise<unknown>;
  sendJson(response: ServerResponse, status: number, payload: unknown): void;
  createEnvelope(context: W025LaunchRouteContext, payload: unknown): unknown;
  requireTeacher(context: W025LaunchRouteContext): void;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ValidationEnvironmentLaunchError("W025_INPUT_INVALID");
  return value as Record<string, unknown>;
}

function parseInput(
  value: unknown,
  context: W025LaunchRouteContext
): ValidationEnvironmentLaunchInput {
  const body = object(value);
  if (body.target_tenant_id !== context.tenantId) {
    throw new ValidationEnvironmentLaunchError("W025_INPUT_INVALID", "tenant scope mismatch");
  }
  if (Object.hasOwn(body, "created_by")) {
    throw new ValidationEnvironmentLaunchError("W025_INPUT_INVALID", "created_by is actor-bound");
  }
  return {
    ...body,
    created_by: context.actor.user_id
  } as unknown as ValidationEnvironmentLaunchInput;
}

function status(error: ValidationEnvironmentLaunchError): number {
  if (error.code === "W025_LAUNCH_CONFLICT") return 409;
  if (error.code === "W025_POSTGRES_REQUIRED") return 503;
  if (error.code === "W025_LAUNCH_ABORTED" || error.code === "W025_LAUNCH_CAS_STALE") return 409;
  return 422;
}

export async function handleValidationEnvironmentLaunchRoute(
  service: ValidationEnvironmentLaunchService | undefined,
  executorFactory:
    | ((
        context: W025LaunchRouteContext
      ) =>
        | ValidationEnvironmentLaunchStepExecutor
        | Promise<ValidationEnvironmentLaunchStepExecutor>)
    | undefined,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: W025LaunchRouteContext,
  helpers: W025LaunchRouteHelpers
): Promise<boolean> {
  const root = "/api/v1/admin/validation-environment-launches";
  if (!url.pathname.startsWith(root)) return false;
  try {
    helpers.requireTeacher(context);
    if (!service || !executorFactory) {
      throw new ValidationEnvironmentLaunchError(
        "W025_POSTGRES_REQUIRED",
        "W025 requires SIMWAR_REPOSITORY_MODE=postgres"
      );
    }
    if (request.method === "POST" && url.pathname === root) {
      const launch = await service.start(
        parseInput(await helpers.readJson(request), context),
        await executorFactory(context)
      );
      helpers.sendJson(response, 201, helpers.createEnvelope(context, launch));
      return true;
    }
    const match = new RegExp(`^${root}/([^/]+)$`).exec(url.pathname);
    if (request.method === "GET" && match?.[1]) {
      const launch = await service.get(context.tenantId, match[1]);
      if (!launch)
        throw new ValidationEnvironmentLaunchError(
          "W025_LAUNCH_HISTORY_INVALID",
          "launch not found"
        );
      helpers.sendJson(response, 200, helpers.createEnvelope(context, launch));
      return true;
    }
    throw new ValidationEnvironmentLaunchError("W025_INPUT_INVALID");
  } catch (error) {
    const mapped =
      error instanceof ValidationEnvironmentLaunchError
        ? error
        : new ValidationEnvironmentLaunchError("W025_LAUNCH_HISTORY_INVALID");
    helpers.sendJson(
      response,
      status(mapped),
      helpers.createEnvelope(context, { code: mapped.code, message: mapped.message })
    );
    return true;
  }
}
