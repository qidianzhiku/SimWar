import type { IncomingMessage, ServerResponse } from "node:http";
import type { CurrentUser } from "@simwar/shared-contracts";
import {
  ValidationEnvironmentLaunchError,
  ValidationEnvironmentLaunchService,
  type ValidationEnvironmentLaunchInput,
  type QualifiedRunAdmissionRequest,
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

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationEnvironmentLaunchError("W025_INPUT_INVALID");
  }
  return value;
}

function parseQualifiedRunAdmission(value: unknown): QualifiedRunAdmissionRequest {
  const root = object(value);
  const coursePackage = object(root.course_package_reference);
  const modelVersion = object(root.model_version_reference);
  const modelArtifact = object(root.model_artifact_reference);
  return {
    course_id: requiredString(root.course_id),
    course_package_reference: {
      content_digest: requiredString(coursePackage.content_digest),
      course_package_id: requiredString(coursePackage.course_package_id),
      tenant_id: requiredString(coursePackage.tenant_id),
      version: requiredString(coursePackage.version)
    },
    source_package_id: requiredString(root.source_package_id),
    calibration_dataset_id: requiredString(root.calibration_dataset_id),
    qualification_id: requiredString(root.qualification_id),
    model_version_reference: {
      content_digest: requiredString(modelVersion.content_digest),
      model_version_id: requiredString(modelVersion.model_version_id),
      version: requiredString(modelVersion.version)
    },
    model_artifact_reference: {
      artifact_id: requiredString(modelArtifact.artifact_id),
      content_digest: requiredString(modelArtifact.content_digest),
      format: requiredString(modelArtifact.format),
      source_ref: requiredString(modelArtifact.source_ref)
    }
  };
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
    qualified_run_admission: parseQualifiedRunAdmission(body.qualified_run_admission),
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
