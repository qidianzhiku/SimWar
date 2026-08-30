import { createHash } from "node:crypto";
import type {
  CourseFactoryAuditProjection,
  CourseFactoryCatalogEntry,
  CourseFactoryCatalogProjection,
  CourseFactoryCloneInput,
  CourseFactoryDraftInput,
  CourseFactoryLifecycleState,
  CourseFactoryMetadata,
  CourseFactorySponsorProjection,
  CourseFactorySponsorCatalogEntry,
  CourseFactoryTeacherCatalogEntry,
  CourseFactoryTeacherCatalogProjection,
  CourseFactoryStudentEvidenceProjection,
  CourseFactoryVersion,
  CoursePackageVersion,
  CoursePackageVersionReference,
  ParameterSetReference,
  ScenarioPackageReference
} from "@simwar/shared-contracts";
import {
  COURSE_FACTORY_LIFECYCLE_STATES,
  isCourseFactoryMetadataForTenant
} from "@simwar/shared-contracts";
import {
  projectM30SourceEvidenceForRole,
  validateM30CourseFactorySourceEvidence
} from "@simwar/sh-next-support";
import type { SimWarStore } from "./store.js";
import {
  CoursePackageCommandError,
  CoursePackageCommandService,
  type CoursePackageCommandActor,
  type CoursePackageSourceReadPorts
} from "./course-package-command-service.js";
import {
  type CoursePackageRegistryPort,
  createCoursePackageVersionReference
} from "./course-package-json-registry.js";

export type CourseFactorySourcePorts = CoursePackageSourceReadPorts;

export interface CourseFactoryActor extends CoursePackageCommandActor {
  roles?: readonly string[];
}

export type CourseFactoryErrorCode =
  | "COURSE_FACTORY_INPUT_INVALID"
  | "COURSE_FACTORY_LIFECYCLE_INVALID"
  | "COURSE_FACTORY_NOT_FOUND"
  | "COURSE_FACTORY_RIGHTS_EXPIRED"
  | "COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION"
  | "COURSE_FACTORY_EXPORT_FORBIDDEN";

export class CourseFactoryError extends Error {
  constructor(readonly code: CourseFactoryErrorCode) {
    super(code);
    this.name = "CourseFactoryError";
  }
}

export interface CourseFactoryServiceDependencies {
  packageCommands: CoursePackageCommandService;
  packageRegistry: CoursePackageRegistryPort;
  store?: SimWarStore;
}

const KNOWN_LIMITS = [
  "JSON_INTERNAL_ONLY is the active runtime authority; no durable delivery claim is made.",
  "CourseFactory copies exact references and never copies user decisions, results, or private data.",
  "Sponsor progress is a role-safe aggregate and does not expose team, score, rank, or settlement truth.",
  "Provider and PostgreSQL/RLS remain OFF; model and profile references are provenance only."
] as const;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function isFactoryVersion(value: CoursePackageVersion): value is CourseFactoryVersion {
  return (
    isCourseFactoryMetadataForTenant(value.factory_metadata, value.tenant_id) &&
    (COURSE_FACTORY_LIFECYCLE_STATES as readonly string[]).includes(value.status)
  );
}

function requireFactoryVersion(value: CoursePackageVersion): CourseFactoryVersion {
  if (!isFactoryVersion(value)) throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  return value;
}

function exactReferenceKey(reference: CoursePackageVersionReference): string {
  return JSON.stringify([
    reference.tenant_id,
    reference.course_package_id,
    reference.version,
    reference.content_digest
  ]);
}

function referenceOf(version: CoursePackageVersion): CoursePackageVersionReference {
  return createCoursePackageVersionReference(version);
}

function sameReference(
  left: CoursePackageVersionReference,
  right: CoursePackageVersionReference
): boolean {
  return exactReferenceKey(left) === exactReferenceKey(right);
}

function sameBlueprintReference(
  left: CourseFactoryDraftInput["course_blueprint_reference"],
  right: CourseFactoryDraftInput["course_blueprint_reference"]
): boolean {
  return (
    left.content_digest === right.content_digest &&
    left.course_blueprint_id === right.course_blueprint_id &&
    left.tenant_id === right.tenant_id &&
    left.version === right.version
  );
}

function sameScenarioReference(
  left: CourseFactoryDraftInput["scenario_package_reference"],
  right: CourseFactoryDraftInput["scenario_package_reference"]
): boolean {
  return (
    left.content_digest === right.content_digest &&
    left.scenario_package_id === right.scenario_package_id &&
    left.tenant_id === right.tenant_id &&
    left.version === right.version
  );
}

function sameParameterReference(
  left: CourseFactoryDraftInput["parameter_set_reference"],
  right: CourseFactoryDraftInput["parameter_set_reference"]
): boolean {
  return (
    left.content_digest === right.content_digest &&
    left.parameter_set_id === right.parameter_set_id &&
    left.version === right.version
  );
}

export interface CourseFactoryStudentExactBindingReferences {
  parameter_set_reference: ParameterSetReference;
  scenario_package_reference: ScenarioPackageReference;
}

function assertMetadata(versionTenantId: string, metadata: CourseFactoryMetadata): void {
  if (!isCourseFactoryMetadataForTenant(metadata, versionTenantId)) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  if (
    metadata.source_evidence_reference &&
    validateM30CourseFactorySourceEvidence(metadata.source_evidence_reference).length > 0
  ) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
}

function isExpired(metadata: CourseFactoryMetadata, now: string): boolean {
  return (
    metadata.rights.expires_at !== null && Date.parse(metadata.rights.expires_at) <= Date.parse(now)
  );
}

function isSourceEvidenceExpired(metadata: CourseFactoryMetadata, now: string): boolean {
  const expiresAt = metadata.source_evidence_reference?.living_operations.expires_at;
  if (expiresAt === undefined) return false;
  const expiryTime = Date.parse(`${expiresAt}T00:00:00.000Z`);
  const nowTime = Date.parse(now);
  return !Number.isFinite(expiryTime) || !Number.isFinite(nowTime) || expiryTime <= nowTime;
}

function mapPackageError(error: unknown): never {
  if (error instanceof CoursePackageCommandError) {
    if (error.code === "COURSE_PACKAGE_NOT_FOUND") {
      throw new CourseFactoryError("COURSE_FACTORY_NOT_FOUND");
    }
    if (error.code === "COURSE_PACKAGE_LIFECYCLE_INVALID") {
      throw new CourseFactoryError("COURSE_FACTORY_LIFECYCLE_INVALID");
    }
  }
  throw error;
}

function catalogEntry(version: CourseFactoryVersion): CourseFactoryCatalogEntry {
  return {
    course_package_reference: createCoursePackageVersionReference(version),
    description: version.description,
    factory_metadata: clone(version.factory_metadata),
    status: version.status,
    title: version.title,
    version: version.version
  };
}

function teacherCatalogEntry(
  entry: CourseFactoryCatalogEntry,
  now: string
): CourseFactoryTeacherCatalogEntry {
  const evidence = entry.factory_metadata.source_evidence_reference;
  const sourceManifest = entry.factory_metadata.source_manifest;
  const projectableEvidence =
    evidence && !isSourceEvidenceExpired(entry.factory_metadata, now) ? evidence : undefined;
  return {
    course_package_reference: clone(entry.course_package_reference),
    description: entry.description,
    status: entry.status,
    title: entry.title,
    version: entry.version,
    ...(projectableEvidence
      ? {
          source_context: {
            target_region: projectableEvidence.target_region,
            epoch_version: projectableEvidence.living_operations.epoch_version,
            qualification_status: projectableEvidence.qualification_status,
            consumption_status: projectableEvidence.consumption_status,
            exact_binding_required: projectableEvidence.exact_binding_required,
            known_limits: [
              "PUBLIC_SOURCE_BOUND",
              "calibration NOT_PROVEN",
              "qualification LIMITED"
            ],
            source_reference_versions: {
              course_blueprint: sourceManifest.course_blueprint_reference.version,
              scenario_package: sourceManifest.scenario_package_reference.version,
              parameter_set: sourceManifest.parameter_set_reference.version
            }
          }
        }
      : {})
  };
}

function sponsorCatalogEntry(
  version: CourseFactoryVersion,
  now: string
): CourseFactorySponsorCatalogEntry {
  const evidence = version.factory_metadata.source_evidence_reference;
  const projectableEvidence =
    evidence && !isSourceEvidenceExpired(version.factory_metadata, now) ? evidence : undefined;
  return {
    course_package_reference: createCoursePackageVersionReference(version),
    status: version.status,
    title: version.title,
    version: version.version,
    ...(projectableEvidence
      ? {
          source_context: {
            target_region: projectableEvidence.target_region,
            epoch_version: projectableEvidence.living_operations.epoch_version,
            qualification_status: projectableEvidence.qualification_status,
            consumption_status: projectableEvidence.consumption_status,
            exact_binding_required: projectableEvidence.exact_binding_required
          }
        }
      : {})
  };
}

function lifecycleStatus(status: CoursePackageVersion["status"]): CourseFactoryLifecycleState {
  if (!(COURSE_FACTORY_LIFECYCLE_STATES as readonly string[]).includes(status)) {
    throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
  }
  return status as CourseFactoryLifecycleState;
}

export class CourseFactoryService {
  private readonly packageCommands: CoursePackageCommandService;
  private readonly packageRegistry: CoursePackageRegistryPort;
  private readonly store: SimWarStore | undefined;

  constructor(dependencies: CourseFactoryServiceDependencies) {
    this.packageCommands = dependencies.packageCommands;
    this.packageRegistry = dependencies.packageRegistry;
    this.store = dependencies.store;
  }

  async createDraft(
    actor: CourseFactoryActor,
    input: CourseFactoryDraftInput
  ): Promise<CourseFactoryVersion> {
    assertMetadata(actor.tenant_id, input.factory_metadata);
    if (input.factory_metadata.provenance.kind !== "ORIGINAL") {
      throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
    }
    return this.persistDraft(actor, input);
  }

  private async persistDraft(
    actor: CourseFactoryActor,
    input: CourseFactoryDraftInput
  ): Promise<CourseFactoryVersion> {
    assertMetadata(actor.tenant_id, input.factory_metadata);
    if (
      !sameBlueprintReference(
        input.factory_metadata.source_manifest.course_blueprint_reference,
        input.course_blueprint_reference
      ) ||
      !sameScenarioReference(
        input.factory_metadata.source_manifest.scenario_package_reference,
        input.scenario_package_reference
      ) ||
      !sameParameterReference(
        input.factory_metadata.source_manifest.parameter_set_reference,
        input.parameter_set_reference
      )
    ) {
      throw new CourseFactoryError("COURSE_FACTORY_INPUT_INVALID");
    }
    try {
      return requireFactoryVersion(await this.packageCommands.createDraft(actor, input));
    } catch (error) {
      mapPackageError(error);
    }
  }

  async clone(
    actor: CourseFactoryActor,
    input: CourseFactoryCloneInput
  ): Promise<CourseFactoryVersion> {
    const source = await this.getReusableSource(actor, input.source_course_package_reference);
    if (source.status !== "PUBLISHED") {
      throw new CourseFactoryError("COURSE_FACTORY_LIFECYCLE_INVALID");
    }
    const now = this.packageRegistry.currentTime();
    if (!source.factory_metadata.rights.copy_allowed) {
      throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION");
    }
    if (isExpired(source.factory_metadata, now)) {
      throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_EXPIRED");
    }

    const factory_metadata: CourseFactoryMetadata = {
      ...clone(source.factory_metadata),
      provenance: {
        kind: "CLONED",
        source_course_package_reference: referenceOf(source)
      },
      rights: {
        ...clone(source.factory_metadata.rights),
        allowed_tenant_ids: [actor.tenant_id],
        owner_tenant_id: actor.tenant_id
      }
    };
    return this.persistDraft(actor, {
      ...this.packageDraft(source),
      course_package_id: input.course_package_id,
      description: input.description,
      factory_metadata,
      title: input.title,
      version: input.version
    });
  }

  async validate(
    actor: CourseFactoryActor,
    reference: CoursePackageVersionReference
  ): Promise<CourseFactoryVersion> {
    const current = await this.getOwned(actor, reference);
    if (current.status !== "DRAFT")
      throw new CourseFactoryError("COURSE_FACTORY_LIFECYCLE_INVALID");
    try {
      return requireFactoryVersion(await this.packageCommands.validate(actor, reference));
    } catch (error) {
      mapPackageError(error);
    }
  }

  async approve(
    actor: CourseFactoryActor,
    reference: CoursePackageVersionReference
  ): Promise<CourseFactoryVersion> {
    const current = await this.getOwned(actor, reference);
    if (current.status !== "VALIDATED")
      throw new CourseFactoryError("COURSE_FACTORY_LIFECYCLE_INVALID");
    try {
      return requireFactoryVersion(await this.packageCommands.approveFactory(actor, reference));
    } catch (error) {
      mapPackageError(error);
    }
  }

  async publish(
    actor: CourseFactoryActor,
    reference: CoursePackageVersionReference
  ): Promise<CourseFactoryVersion> {
    const current = await this.getOwned(actor, reference);
    if (current.status !== "APPROVED")
      throw new CourseFactoryError("COURSE_FACTORY_LIFECYCLE_INVALID");
    const now = this.packageRegistry.currentTime();
    if (!current.factory_metadata.rights.allowed_tenant_ids.includes(actor.tenant_id)) {
      throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION");
    }
    if (isExpired(current.factory_metadata, now)) {
      throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_EXPIRED");
    }
    try {
      return requireFactoryVersion(await this.packageCommands.publishFactory(actor, reference));
    } catch (error) {
      mapPackageError(error);
    }
  }

  async supersede(
    actor: CourseFactoryActor,
    reference: CoursePackageVersionReference
  ): Promise<CourseFactoryVersion> {
    const current = await this.getOwned(actor, reference);
    if (current.status !== "PUBLISHED")
      throw new CourseFactoryError("COURSE_FACTORY_LIFECYCLE_INVALID");
    try {
      return requireFactoryVersion(await this.packageCommands.supersedeFactory(actor, reference));
    } catch (error) {
      mapPackageError(error);
    }
  }

  async retire(
    actor: CourseFactoryActor,
    reference: CoursePackageVersionReference
  ): Promise<CourseFactoryVersion> {
    const current = await this.getOwned(actor, reference);
    if (current.status !== "PUBLISHED" && current.status !== "SUPERSEDED") {
      throw new CourseFactoryError("COURSE_FACTORY_LIFECYCLE_INVALID");
    }
    try {
      return requireFactoryVersion(await this.packageCommands.retireFactory(actor, reference));
    } catch (error) {
      mapPackageError(error);
    }
  }

  async rollback(
    actor: CourseFactoryActor,
    input: CourseFactoryCloneInput
  ): Promise<CourseFactoryVersion> {
    const source = await this.getOwned(actor, input.source_course_package_reference);
    if (!["PUBLISHED", "SUPERSEDED", "RETIRED"].includes(source.status)) {
      throw new CourseFactoryError("COURSE_FACTORY_LIFECYCLE_INVALID");
    }
    if (!source.factory_metadata.rights.copy_allowed) {
      throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION");
    }
    if (isExpired(source.factory_metadata, this.packageRegistry.currentTime())) {
      throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_EXPIRED");
    }
    return this.persistDraft(actor, {
      ...this.packageDraft(source),
      course_package_id: input.course_package_id,
      description: input.description,
      factory_metadata: {
        ...clone(source.factory_metadata),
        provenance: {
          kind: "ROLLBACK",
          source_course_package_reference: referenceOf(source)
        }
      },
      title: input.title,
      version: input.version
    });
  }

  async export(
    actor: CourseFactoryActor,
    reference: CoursePackageVersionReference
  ): Promise<CourseFactoryVersion> {
    const version = await this.getOwned(actor, reference);
    if (!version.factory_metadata.rights.export_allowed) {
      throw new CourseFactoryError("COURSE_FACTORY_EXPORT_FORBIDDEN");
    }
    if (isExpired(version.factory_metadata, this.packageRegistry.currentTime())) {
      throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_EXPIRED");
    }
    return clone(version);
  }

  async listCatalog(
    actor: CourseFactoryActor,
    tenantId = actor.tenant_id
  ): Promise<CourseFactoryCatalogProjection> {
    this.assertTenantRead(actor, tenantId);
    const versions = (await this.packageRegistry.listForTenant(tenantId))
      .filter(isFactoryVersion)
      .map((version) => catalogEntry(version));
    return { catalog: versions, known_limits: KNOWN_LIMITS, tenant_id: tenantId };
  }

  async getTeacherCatalog(actor: CourseFactoryActor): Promise<CourseFactoryTeacherCatalogProjection> {
    const projection = await this.listCatalog(actor);
    const now = this.packageRegistry.currentTime();
    return {
      ...projection,
      catalog: projection.catalog
        .filter((entry) => entry.status === "PUBLISHED" && !isExpired(entry.factory_metadata, now))
        .map((entry) => teacherCatalogEntry(entry, now))
    };
  }

  /**
   * Reuses the existing Student project-aware BFF flow. The lookup is exact
   * and fail-closed: more than one matching published package is ambiguous,
   * while a stale or invalid M30 evidence reference is never projected.
   */
  async getStudentSourceEvidence(
    tenantId: string,
    references: CourseFactoryStudentExactBindingReferences
  ): Promise<CourseFactoryStudentEvidenceProjection | undefined> {
    const now = this.packageRegistry.currentTime();
    const candidates = (await this.packageRegistry.listForTenant(tenantId))
      .filter(isFactoryVersion)
      .filter(
        (version) =>
          version.status === "PUBLISHED" &&
          !isExpired(version.factory_metadata, now) &&
          !isSourceEvidenceExpired(version.factory_metadata, now) &&
          version.factory_metadata.source_evidence_reference !== undefined &&
          sameScenarioReference(
            version.scenario_package_reference,
            references.scenario_package_reference
          ) &&
          sameScenarioReference(
            version.factory_metadata.source_manifest.scenario_package_reference,
            references.scenario_package_reference
          ) &&
          sameParameterReference(
            version.parameter_set_reference,
            references.parameter_set_reference
          ) &&
          sameParameterReference(
            version.factory_metadata.source_manifest.parameter_set_reference,
            references.parameter_set_reference
          ) &&
          validateM30CourseFactorySourceEvidence(version.factory_metadata.source_evidence_reference)
            .length === 0
      );
    if (candidates.length !== 1) return undefined;
    const projection = projectM30SourceEvidenceForRole(
      candidates[0]!.factory_metadata.source_evidence_reference!,
      "student"
    );
    return {
      target_region: projection.target_region as "Hangzhou",
      epoch_version: projection.epoch_version as string,
      qualification_status: projection.qualification_status as "LIMITED",
      consumption_status: projection.consumption_status as "LOOKAHEAD_READY",
      exact_binding_required: true
    };
  }

  async getAudit(
    actor: CourseFactoryActor,
    reference: CoursePackageVersionReference
  ): Promise<CourseFactoryAuditProjection> {
    const current = await this.getOwned(actor, reference);
    const snapshots = (
      await this.packageRegistry.listLifecycleSnapshots(
        actor.tenant_id,
        current.course_package_id,
        current.version
      )
    ).filter(isFactoryVersion);
    const first = snapshots[0];
    const latest = snapshots.at(-1);
    if (!first || !latest) throw new CourseFactoryError("COURSE_FACTORY_NOT_FOUND");
    const firstComparable = this.auditComparable(first);
    const latestComparable = this.auditComparable(latest);
    const diff = Object.keys({ ...firstComparable, ...latestComparable })
      .sort()
      .filter(
        (field) =>
          JSON.stringify(firstComparable[field]) !== JSON.stringify(latestComparable[field])
      )
      .map((field) => ({ field, from: firstComparable[field], to: latestComparable[field] }));
    const lineage = [
      ...(current.factory_metadata.provenance.source_course_package_reference
        ? [current.factory_metadata.provenance.source_course_package_reference]
        : []),
      ...snapshots.map((snapshot) => createCoursePackageVersionReference(snapshot))
    ].filter(
      (candidate, index, all) => all.findIndex((item) => sameReference(item, candidate)) === index
    );
    return {
      course_package_reference: createCoursePackageVersionReference(current),
      diff,
      lineage,
      lifecycle: snapshots.map((snapshot) => lifecycleStatus(snapshot.status)),
      tenant_id: actor.tenant_id
    };
  }

  async getSponsorProjection(
    actor: CourseFactoryActor,
    tenantId = actor.tenant_id
  ): Promise<CourseFactorySponsorProjection> {
    this.assertTenantRead(actor, tenantId);
    const catalog = await this.listCatalog(actor, tenantId);
    const tenantCourses = (this.store?.courses ?? []).filter(
      (course) => course.tenant_id === tenantId
    );
    const tenantRuns = (this.store?.runs ?? []).filter((run) => run.tenant_id === tenantId);
    const tenantRounds = (this.store?.rounds ?? []).filter((round) => round.tenant_id === tenantId);
    const now = this.packageRegistry.currentTime();
    const sponsorCatalog = (await this.packageRegistry.listForTenant(tenantId))
      .filter(isFactoryVersion)
      .map((version) => sponsorCatalogEntry(version, now));
    return {
      catalog: sponsorCatalog,
      delivery_progress: {
        active_runs: tenantRuns.filter((run) => run.status === "active").length,
        course_count: tenantCourses.length,
        published_versions: catalog.catalog.filter((entry) => entry.status === "PUBLISHED").length,
        round_count: tenantRounds.length
      },
      evidence_pack: {
        exact_refs_present: catalog.catalog.every(
          (entry) => entry.factory_metadata.source_manifest !== undefined
        ),
        private_data_included: false,
        source_evidence_count: sponsorCatalog.filter((entry) => entry.source_context !== undefined)
          .length
      },
      known_limits: catalog.known_limits,
      tenant_id: tenantId
    };
  }

  private packageDraft(version: CourseFactoryVersion): CourseFactoryDraftInput {
    return {
      course_blueprint_reference: clone(version.course_blueprint_reference),
      course_package_id: version.course_package_id,
      description: version.description,
      factory_metadata: clone(version.factory_metadata),
      parameter_set_reference: clone(version.parameter_set_reference),
      scenario_package_reference: clone(version.scenario_package_reference),
      ...(version.studio_configuration
        ? { studio_configuration: clone(version.studio_configuration) }
        : {}),
      title: version.title,
      version: version.version
    };
  }

  private async getOwned(
    actor: CourseFactoryActor,
    reference: CoursePackageVersionReference
  ): Promise<CourseFactoryVersion> {
    if (!reference || typeof reference !== "object") {
      throw new CourseFactoryError("COURSE_FACTORY_NOT_FOUND");
    }
    if (reference.tenant_id !== actor.tenant_id) {
      throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION");
    }
    const version = await this.packageCommands.getByReference(actor.tenant_id, reference);
    if (!version) throw new CourseFactoryError("COURSE_FACTORY_NOT_FOUND");
    return requireFactoryVersion(version);
  }

  private async getReusableSource(
    actor: CourseFactoryActor,
    reference: CoursePackageVersionReference
  ): Promise<CourseFactoryVersion> {
    if (!reference || typeof reference !== "object") {
      throw new CourseFactoryError("COURSE_FACTORY_NOT_FOUND");
    }
    if (reference.tenant_id !== actor.tenant_id) {
      throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION");
    }
    const version = await this.packageCommands.getByReference(reference.tenant_id, reference);
    if (!version) throw new CourseFactoryError("COURSE_FACTORY_NOT_FOUND");
    const source = requireFactoryVersion(version);
    if (!source.factory_metadata.rights.allowed_tenant_ids.includes(actor.tenant_id)) {
      throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION");
    }
    return source;
  }

  private assertTenantRead(actor: CourseFactoryActor, tenantId: string): void {
    const isPlatformAdmin = actor.roles?.includes("platform_admin") ?? false;
    if (tenantId !== actor.tenant_id && !isPlatformAdmin) {
      throw new CourseFactoryError("COURSE_FACTORY_RIGHTS_SCOPE_VIOLATION");
    }
  }

  private auditComparable(version: CourseFactoryVersion): Record<string, unknown> {
    return {
      description: version.description,
      factory_metadata: version.factory_metadata,
      title: version.title,
      version: version.version,
      source_digest: digest(version.factory_metadata.source_manifest)
    };
  }
}
