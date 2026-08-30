import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  ApiEnvelope,
  CourseFactoryCloneInput,
  CourseFactoryDraftInput,
  CourseFactoryMetadata,
  CourseFactoryProvenanceKind,
  CourseFactorySourceEvidenceReference,
  CoursePackageVersionReference,
  CurrentUser,
  PermissionKey
} from "@simwar/shared-contracts";
import {
  COURSE_FACTORY_PROVENANCE_KINDS,
  COURSE_FACTORY_SCHEMA_VERSION
} from "@simwar/shared-contracts";
import {
  CourseFactoryError,
  type CourseFactoryActor,
  type CourseFactoryService
} from "../course-factory.js";

const ADMIN_PREFIX = "/api/v1/admin/course-factory";
const TEACHER_PREFIX = "/api/v1/bff/teacher/course-factory";
const ENTERPRISE_PREFIX = "/api/v1/bff/enterprise/course-factory";
const VERSION_PATH =
  /^\/api\/v1\/admin\/course-factory\/versions\/([^/]+)\/versions\/([^/]+)\/(validate|approve|publish|supersede|retire)$/;
const AUDIT_PATH =
  /^\/api\/v1\/admin\/course-factory\/versions\/([^/]+)\/versions\/([^/]+)\/audit$/;
const EXPORT_PATH =
  /^\/api\/v1\/admin\/course-factory\/versions\/([^/]+)\/versions\/([^/]+)\/export$/;

interface CourseFactoryRouteContext {
  readonly requestId: string;
  readonly tenantId: string;
  readonly actor?: CurrentUser;
}

interface CourseFactoryAuditInput {
  readonly actor: CurrentUser;
  readonly action: string;
  readonly after: unknown;
  readonly requestId: string;
  readonly resourceId: string;
  readonly resourceType: string;
  readonly tenantId: string;
}

interface CourseFactoryRouteDependencies {
  readonly actorHasAnyRole: (actor: CurrentUser, roles: readonly string[]) => boolean;
  readonly createEnvelope: <TData>(
    context: CourseFactoryRouteContext,
    data: TData,
    message?: string
  ) => ApiEnvelope<TData>;
  readonly executeMutation: <TData>(
    command: () => Promise<TData>,
    audit: (result: TData) => CourseFactoryAuditInput
  ) => Promise<TData>;
  readonly readJson: <TBody>(
    request: IncomingMessage,
    options?: { requiredObject?: boolean }
  ) => Promise<TBody>;
  readonly requirePermission: (
    context: CourseFactoryRouteContext,
    permission: PermissionKey
  ) => CurrentUser;
  readonly sendJson: (response: ServerResponse, statusCode: number, body: unknown) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertOnlyFields(value: Record<string, unknown>, fields: readonly string[]): void {
  const allowed = new Set(fields);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
}

function text(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  return value;
}

function identity(value: unknown): string {
  const candidate = text(value);
  if (
    !/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(candidate) ||
    /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(
      candidate
    )
  ) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  return candidate;
}

function version(value: unknown): string {
  const candidate = identity(value);
  if (/(?:^|[._:-])[xX*](?:$|[._:-])/.test(candidate)) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  return candidate;
}

function digest(value: unknown): string {
  const candidate = text(value);
  if (!/^[a-f0-9]{64}$/.test(candidate)) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  return candidate;
}

function exactIsoOrNull(value: unknown): string | null {
  if (value === null) return null;
  const candidate = text(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(candidate)) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  return candidate;
}

function exactReference(value: unknown, tenantId: string): CoursePackageVersionReference {
  if (!isRecord(value)) throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value, ["content_digest", "course_package_id", "tenant_id", "version"]);
  if (identity(value.tenant_id) !== tenantId) {
    throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION");
  }
  return {
    content_digest: digest(value.content_digest),
    course_package_id: identity(value.course_package_id),
    tenant_id: tenantId,
    version: version(value.version)
  };
}

function blueprintReference(
  value: unknown,
  tenantId: string
): CourseFactoryDraftInput["course_blueprint_reference"] {
  if (!isRecord(value)) throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value, ["content_digest", "course_blueprint_id", "tenant_id", "version"]);
  if (identity(value.tenant_id) !== tenantId) {
    throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION");
  }
  return {
    content_digest: digest(value.content_digest),
    course_blueprint_id: identity(value.course_blueprint_id),
    tenant_id: tenantId,
    version: version(value.version)
  };
}

function scenarioReference(
  value: unknown,
  tenantId: string
): CourseFactoryDraftInput["scenario_package_reference"] {
  if (!isRecord(value)) throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value, ["content_digest", "scenario_package_id", "tenant_id", "version"]);
  if (identity(value.tenant_id) !== tenantId) {
    throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION");
  }
  return {
    content_digest: digest(value.content_digest),
    scenario_package_id: identity(value.scenario_package_id),
    tenant_id: tenantId,
    version: version(value.version)
  };
}

function parameterReference(value: unknown): CourseFactoryDraftInput["parameter_set_reference"] {
  if (!isRecord(value)) throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value, ["content_digest", "parameter_set_id", "version"]);
  return {
    content_digest: digest(value.content_digest),
    parameter_set_id: identity(value.parameter_set_id),
    version: version(value.version)
  };
}

function stringList(value: unknown): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.trim() === "")
  ) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  return value.map((item) => text(item));
}

function modelVersionReference(
  value: unknown
): NonNullable<CourseFactoryMetadata["source_manifest"]["model_version_reference"]> {
  if (!isRecord(value)) throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value, ["content_digest", "model_version_id", "version"]);
  return {
    content_digest: digest(value.content_digest),
    model_version_id: identity(value.model_version_id),
    version: version(value.version)
  };
}

function modelArtifactReference(
  value: unknown
): NonNullable<CourseFactoryMetadata["source_manifest"]["model_artifact_reference"]> {
  if (!isRecord(value)) throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value, ["artifact_id", "content_digest", "format", "source_ref"]);
  return {
    artifact_id: identity(value.artifact_id),
    content_digest: digest(value.content_digest),
    format: text(value.format),
    source_ref: text(value.source_ref)
  };
}

function profileReference(
  value: unknown,
  tenantId: string
): NonNullable<CourseFactoryMetadata["source_manifest"]["project_profile_reference"]> {
  if (!isRecord(value)) throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value, ["content_digest", "project_profile_id", "tenant_id", "version"]);
  if (identity(value.tenant_id) !== tenantId) {
    throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION");
  }
  return {
    content_digest: digest(value.content_digest),
    project_profile_id: identity(value.project_profile_id),
    tenant_id: identity(value.tenant_id),
    version: version(value.version)
  };
}

function sourceEvidenceReference(value: unknown): CourseFactorySourceEvidenceReference {
  if (!isRecord(value)) throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value, [
    "schema_version",
    "binding_request_id",
    "source_epoch",
    "regional_transfer",
    "living_operations",
    "baseline_region",
    "target_region",
    "source_reality_class",
    "rights_status",
    "qualification_status",
    "calibration_evidence",
    "formal_binding_eligible",
    "consumption_status",
    "exact_binding_required",
    "required_rechecks",
    "exact_source_refs",
    "m29_pack_digest",
    "evidence_digest"
  ]);
  if (
    value.schema_version !== "course-factory-source-evidence.v1" ||
    value.binding_request_id !== "SH-M29-MAIN-PULL-BINDING-REQUEST" ||
    value.baseline_region !== "Shanghai" ||
    value.target_region !== "Hangzhou" ||
    value.source_reality_class !== "PUBLIC_SOURCE_BOUND" ||
    value.rights_status !== "PUBLIC_REFERENCE_ONLY" ||
    value.qualification_status !== "LIMITED" ||
    value.calibration_evidence !== "NOT_PROVEN" ||
    value.formal_binding_eligible !== false ||
    value.consumption_status !== "LOOKAHEAD_READY" ||
    value.exact_binding_required !== true
  ) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  if (!isRecord(value.source_epoch) || !isRecord(value.regional_transfer)) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  if (!isRecord(value.living_operations)) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  const sourceEpochBaseSha = text(value.source_epoch.source_epoch_base_sha);
  if (!/^[a-f0-9]{40}$/.test(sourceEpochBaseSha)) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  const expiresAt = text(value.living_operations.expires_at);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  const parsedExpiry = new Date(`${expiresAt}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsedExpiry.getTime()) ||
    parsedExpiry.toISOString().slice(0, 10) !== expiresAt
  ) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  return {
    schema_version: "course-factory-source-evidence.v1",
    binding_request_id: "SH-M29-MAIN-PULL-BINDING-REQUEST",
    source_epoch: {
      epoch_id: identity(value.source_epoch.epoch_id),
      epoch_digest: digest(value.source_epoch.epoch_digest),
      source_epoch_base_sha: sourceEpochBaseSha
    },
    regional_transfer: {
      transfer_id: identity(value.regional_transfer.transfer_id),
      pack_digest: digest(value.regional_transfer.pack_digest),
      candidate_version: version(value.regional_transfer.candidate_version)
    },
    living_operations: {
      pack_digest: digest(value.living_operations.pack_digest),
      epoch_id: identity(value.living_operations.epoch_id),
      epoch_version: version(value.living_operations.epoch_version),
      expires_at: expiresAt
    },
    baseline_region: "Shanghai",
    target_region: "Hangzhou",
    source_reality_class: "PUBLIC_SOURCE_BOUND",
    rights_status: "PUBLIC_REFERENCE_ONLY",
    qualification_status: "LIMITED",
    calibration_evidence: "NOT_PROVEN",
    formal_binding_eligible: false,
    consumption_status: "LOOKAHEAD_READY",
    exact_binding_required: true,
    required_rechecks: stringList(value.required_rechecks),
    exact_source_refs: stringList(value.exact_source_refs),
    m29_pack_digest: digest(value.m29_pack_digest),
    evidence_digest: digest(value.evidence_digest)
  };
}

function factoryMetadata(value: unknown, tenantId: string): CourseFactoryMetadata {
  if (!isRecord(value)) throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value, [
    "known_limits",
    "provenance",
    "rights",
    "schema_version",
    "source_manifest",
    "source_evidence_reference",
    "user_data_policy"
  ]);
  if (text(value.schema_version) !== COURSE_FACTORY_SCHEMA_VERSION) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  if (!isRecord(value.rights)) throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value.rights, [
    "allowed_tenant_ids",
    "copy_allowed",
    "export_allowed",
    "expires_at",
    "owner_tenant_id"
  ]);
  if (!isRecord(value.provenance)) throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value.provenance, ["kind", "source_course_package_reference"]);
  if (!isRecord(value.source_manifest))
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value.source_manifest, [
    "course_blueprint_reference",
    "model_artifact_reference",
    "model_version_reference",
    "parameter_set_reference",
    "project_profile_reference",
    "scenario_package_reference"
  ]);
  if (!isRecord(value.user_data_policy))
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value.user_data_policy, [
    "copied_private_data",
    "copied_user_decisions",
    "copied_user_results"
  ]);
  const rights = value.rights;
  const provenance = value.provenance;
  const manifest = value.source_manifest;
  const userDataPolicy = value.user_data_policy;
  const allowedTenantIds = stringList(rights.allowed_tenant_ids);
  if (
    identity(rights.owner_tenant_id) !== tenantId ||
    !allowedTenantIds.includes(tenantId) ||
    typeof rights.copy_allowed !== "boolean" ||
    typeof rights.export_allowed !== "boolean"
  ) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  const sourceCoursePackageReference =
    provenance.source_course_package_reference === undefined
      ? undefined
      : exactReference(provenance.source_course_package_reference, tenantId);
  if (
    !COURSE_FACTORY_PROVENANCE_KINDS.includes(provenance.kind as CourseFactoryProvenanceKind) ||
    userDataPolicy.copied_private_data !== false ||
    userDataPolicy.copied_user_decisions !== false ||
    userDataPolicy.copied_user_results !== false
  ) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  return {
    known_limits: stringList(value.known_limits),
    provenance: {
      kind: provenance.kind as CourseFactoryProvenanceKind,
      ...(sourceCoursePackageReference
        ? { source_course_package_reference: sourceCoursePackageReference }
        : {})
    },
    rights: {
      allowed_tenant_ids: allowedTenantIds,
      copy_allowed: rights.copy_allowed,
      export_allowed: rights.export_allowed,
      expires_at: exactIsoOrNull(rights.expires_at),
      owner_tenant_id: identity(rights.owner_tenant_id)
    },
    schema_version: COURSE_FACTORY_SCHEMA_VERSION,
    ...(value.source_evidence_reference !== undefined
      ? { source_evidence_reference: sourceEvidenceReference(value.source_evidence_reference) }
      : {}),
    source_manifest: {
      course_blueprint_reference: blueprintReference(manifest.course_blueprint_reference, tenantId),
      ...(manifest.model_artifact_reference !== undefined
        ? { model_artifact_reference: modelArtifactReference(manifest.model_artifact_reference) }
        : {}),
      ...(manifest.model_version_reference !== undefined
        ? { model_version_reference: modelVersionReference(manifest.model_version_reference) }
        : {}),
      parameter_set_reference: parameterReference(manifest.parameter_set_reference),
      ...(manifest.project_profile_reference !== undefined
        ? {
            project_profile_reference: profileReference(
              manifest.project_profile_reference,
              tenantId
            )
          }
        : {}),
      scenario_package_reference: scenarioReference(manifest.scenario_package_reference, tenantId)
    },
    user_data_policy: {
      copied_private_data: false,
      copied_user_decisions: false,
      copied_user_results: false
    }
  };
}

function draft(value: unknown, tenantId: string): CourseFactoryDraftInput {
  if (!isRecord(value)) throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value, [
    "course_blueprint_reference",
    "course_package_id",
    "description",
    "factory_metadata",
    "parameter_set_reference",
    "scenario_package_reference",
    "title",
    "version"
  ]);
  return {
    course_blueprint_reference: blueprintReference(value.course_blueprint_reference, tenantId),
    course_package_id: identity(value.course_package_id),
    description: text(value.description),
    factory_metadata: factoryMetadata(value.factory_metadata, tenantId),
    parameter_set_reference: parameterReference(value.parameter_set_reference),
    scenario_package_reference: scenarioReference(value.scenario_package_reference, tenantId),
    title: text(value.title),
    version: version(value.version)
  };
}

function cloneInput(value: unknown, tenantId: string): CourseFactoryCloneInput {
  if (!isRecord(value)) throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value, [
    "course_package_id",
    "description",
    "source_course_package_reference",
    "title",
    "version"
  ]);
  return {
    course_package_id: identity(value.course_package_id),
    description: text(value.description),
    source_course_package_reference: exactReference(
      value.source_course_package_reference,
      tenantId
    ),
    title: text(value.title),
    version: version(value.version)
  };
}

function transitionReference(
  value: unknown,
  tenantId: string,
  coursePackageId: string,
  packageVersion: string
): CoursePackageVersionReference {
  if (!isRecord(value)) throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  assertOnlyFields(value, ["content_digest"]);
  return {
    content_digest: digest(value.content_digest),
    course_package_id: coursePackageId,
    tenant_id: tenantId,
    version: packageVersion
  };
}

function actorFor(context: CourseFactoryRouteContext, actor: CurrentUser): CourseFactoryActor {
  return { actor_id: actor.user_id, tenant_id: context.tenantId, roles: actor.roles };
}

function actorForAuthenticatedTenant(actor: CurrentUser): CourseFactoryActor {
  return { actor_id: actor.user_id, tenant_id: actor.tenant_id, roles: actor.roles };
}

function requireAdmin(
  deps: CourseFactoryRouteDependencies,
  context: CourseFactoryRouteContext
): CurrentUser {
  const actor = deps.requirePermission(context, "course:read");
  if (!deps.actorHasAnyRole(actor, ["tenant_admin", "platform_admin"])) {
    throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION");
  }
  if (actor.tenant_id !== context.tenantId && !deps.actorHasAnyRole(actor, ["platform_admin"])) {
    throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION");
  }
  return actor;
}

function requireTeacher(
  deps: CourseFactoryRouteDependencies,
  context: CourseFactoryRouteContext
): CurrentUser {
  const actor = deps.requirePermission(context, "course:read");
  if (!deps.actorHasAnyRole(actor, ["teacher"]) || actor.tenant_id !== context.tenantId) {
    throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION");
  }
  return actor;
}

function errorStatus(error: CourseFactoryError): number {
  switch (error.code) {
    case "COURSE_FACTORY_NOT_FOUND":
      return 404;
    case "COURSE_FACTORY_RIGHTS_EXPIRED":
    case "COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION":
    case "COURSE_FACTORY_EXPORT_FORBIDDEN":
      return 403;
    case "COURSE_FACTORY_LIFECYCLE_INVALID":
      return 409;
    default:
      return 422;
  }
}

function sendFactoryError(
  deps: CourseFactoryRouteDependencies,
  response: ServerResponse,
  context: CourseFactoryRouteContext,
  error: CourseFactoryError
): void {
  deps.sendJson(response, errorStatus(error), {
    request_id: context.requestId,
    code: error.code,
    message: error.message,
    details: []
  });
}

function actionAudit(
  context: CourseFactoryRouteContext,
  actor: CurrentUser,
  action: string
): (result: { course_package_id: string; version: string }) => CourseFactoryAuditInput {
  return (result) => ({
    actor,
    action: `course_factory.${action}`,
    after: result,
    requestId: context.requestId,
    resourceId: `${result.course_package_id}:${result.version}`,
    resourceType: "course_factory_version",
    tenantId: context.tenantId
  });
}

export function isCourseFactoryRoute(method: string | undefined, url: URL): boolean {
  if (method === "GET") {
    return (
      url.pathname === `${ADMIN_PREFIX}/catalog` ||
      url.pathname === `${TEACHER_PREFIX}/catalog` ||
      url.pathname === `${ENTERPRISE_PREFIX}/sponsor` ||
      AUDIT_PATH.test(url.pathname) ||
      EXPORT_PATH.test(url.pathname)
    );
  }
  if (method !== "POST") return false;
  return (
    url.pathname === `${ADMIN_PREFIX}/versions` ||
    url.pathname === `${ADMIN_PREFIX}/versions/clone` ||
    url.pathname === `${ADMIN_PREFIX}/versions/rollback` ||
    VERSION_PATH.test(url.pathname)
  );
}

export async function handleCourseFactoryRoute(
  service: CourseFactoryService,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: CourseFactoryRouteContext,
  deps: CourseFactoryRouteDependencies
): Promise<boolean> {
  if (!isCourseFactoryRoute(request.method, url)) return false;
  try {
    if (request.method === "GET" && url.pathname === `${ADMIN_PREFIX}/catalog`) {
      const actor = requireAdmin(deps, context);
      const tenantId = url.searchParams.get("tenant_id") ?? context.tenantId;
      if ([...url.searchParams.keys()].some((key) => key !== "tenant_id")) {
        throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
      }
      const result = await service.listCatalog(actorForAuthenticatedTenant(actor), tenantId);
      deps.sendJson(response, 200, deps.createEnvelope(context, result));
      return true;
    }

    if (request.method === "GET" && url.pathname === `${TEACHER_PREFIX}/catalog`) {
      const actor = requireTeacher(deps, context);
      const result = await service.getTeacherCatalog(actorFor(context, actor));
      deps.sendJson(response, 200, deps.createEnvelope(context, result));
      return true;
    }

    if (request.method === "GET" && url.pathname === `${ENTERPRISE_PREFIX}/sponsor`) {
      const actor = requireAdmin(deps, context);
      const tenantId = url.searchParams.get("tenant_id") ?? context.tenantId;
      if ([...url.searchParams.keys()].some((key) => key !== "tenant_id")) {
        throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
      }
      const result = await service.getSponsorProjection(
        actorForAuthenticatedTenant(actor),
        tenantId
      );
      deps.sendJson(response, 200, deps.createEnvelope(context, result));
      return true;
    }

    if (request.method === "POST" && url.pathname === `${ADMIN_PREFIX}/versions`) {
      const actor = requireAdmin(deps, context);
      const input = draft(await deps.readJson(request, { requiredObject: true }), context.tenantId);
      const result = await deps.executeMutation(
        () => service.createDraft(actorFor(context, actor), input),
        actionAudit(context, actor, "create")
      );
      deps.sendJson(response, 201, deps.createEnvelope(context, result));
      return true;
    }

    if (
      request.method === "POST" &&
      (url.pathname === `${ADMIN_PREFIX}/versions/clone` ||
        url.pathname === `${ADMIN_PREFIX}/versions/rollback`)
    ) {
      const actor = requireAdmin(deps, context);
      const input = cloneInput(
        await deps.readJson(request, { requiredObject: true }),
        context.tenantId
      );
      const action = url.pathname.endsWith("/rollback") ? "rollback" : "clone";
      const command = () =>
        action === "rollback"
          ? service.rollback(actorFor(context, actor), input)
          : service.clone(actorFor(context, actor), input);
      const result = await deps.executeMutation(command, actionAudit(context, actor, action));
      deps.sendJson(response, 201, deps.createEnvelope(context, result));
      return true;
    }

    const transitionMatch = VERSION_PATH.exec(url.pathname);
    if (request.method === "POST" && transitionMatch) {
      const actor = requireAdmin(deps, context);
      const packageId = identity(decodeURIComponent(transitionMatch[1] ?? ""));
      const packageVersion = version(decodeURIComponent(transitionMatch[2] ?? ""));
      const action = transitionMatch[3] ?? "";
      const reference = transitionReference(
        await deps.readJson(request, { requiredObject: true }),
        context.tenantId,
        packageId,
        packageVersion
      );
      const commandActor = actorFor(context, actor);
      const command = () => {
        switch (action) {
          case "validate":
            return service.validate(commandActor, reference);
          case "approve":
            return service.approve(commandActor, reference);
          case "publish":
            return service.publish(commandActor, reference);
          case "supersede":
            return service.supersede(commandActor, reference);
          case "retire":
            return service.retire(commandActor, reference);
          default:
            throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
        }
      };
      const result = await deps.executeMutation(command, actionAudit(context, actor, action));
      deps.sendJson(response, 200, deps.createEnvelope(context, result));
      return true;
    }

    const auditMatch = AUDIT_PATH.exec(url.pathname);
    if (request.method === "GET" && auditMatch) {
      const actor = requireAdmin(deps, context);
      if ([...url.searchParams.keys()].length !== 1 || !url.searchParams.has("content_digest")) {
        throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
      }
      const reference = {
        content_digest: digest(url.searchParams.get("content_digest")),
        course_package_id: identity(decodeURIComponent(auditMatch[1] ?? "")),
        tenant_id: context.tenantId,
        version: version(decodeURIComponent(auditMatch[2] ?? ""))
      };
      const result = await service.getAudit(actorFor(context, actor), reference);
      deps.sendJson(response, 200, deps.createEnvelope(context, result));
      return true;
    }

    const exportMatch = EXPORT_PATH.exec(url.pathname);
    if (request.method === "GET" && exportMatch) {
      const actor = requireAdmin(deps, context);
      if ([...url.searchParams.keys()].length !== 1 || !url.searchParams.has("content_digest")) {
        throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
      }
      const reference = {
        content_digest: digest(url.searchParams.get("content_digest")),
        course_package_id: identity(decodeURIComponent(exportMatch[1] ?? "")),
        tenant_id: context.tenantId,
        version: version(decodeURIComponent(exportMatch[2] ?? ""))
      };
      const result = await deps.executeMutation(
        () => service.export(actorFor(context, actor), reference),
        actionAudit(context, actor, "export")
      );
      deps.sendJson(response, 200, deps.createEnvelope(context, result));
      return true;
    }
  } catch (error) {
    if (!(error instanceof CourseFactoryError)) throw error;
    sendFactoryError(deps, response, context, error);
    return true;
  }
  return false;
}
