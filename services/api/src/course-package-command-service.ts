import type {
  CoursePackageVersion,
  CoursePackageVersionCloneInput,
  CoursePackageVersionDraftInput,
  CoursePackageVersionExportDto,
  CoursePackageVersionImportInput,
  CoursePackageVersionReference
} from "@simwar/shared-contracts";
import type { CourseBlueprintVersion } from "./course-blueprint-authority.js";
import {
  type CoursePackageRegistryPort,
  CoursePackageRegistryError,
  assertValidCoursePackageVersion,
  createCoursePackageDraftVersion,
  createCoursePackageLifecycleSnapshot
} from "./course-package-json-registry.js";
import type { ParameterSetVersion } from "./parameter-set-authority.js";
import type { ScenarioPackageVersion } from "./scenario-package-authority.js";

export interface CoursePackageCommandActor {
  actor_id: string;
  tenant_id: string;
}

export interface CoursePackageSourceReadPorts {
  courseBlueprints: {
    assertBindable(
      tenantId: string,
      reference: CoursePackageVersion["course_blueprint_reference"]
    ): Promise<void>;
    getByReference(
      tenantId: string,
      reference: CoursePackageVersion["course_blueprint_reference"]
    ): Promise<CourseBlueprintVersion | null>;
  };
  parameterSets: {
    assertBindable(
      tenantId: string,
      reference: CoursePackageVersion["parameter_set_reference"]
    ): Promise<void>;
    getByReference(
      tenantId: string,
      reference: CoursePackageVersion["parameter_set_reference"]
    ): Promise<ParameterSetVersion | null>;
  };
  scenarioPackages: {
    assertBindable(
      tenantId: string,
      reference: CoursePackageVersion["scenario_package_reference"]
    ): Promise<void>;
    getByReference(
      tenantId: string,
      reference: CoursePackageVersion["scenario_package_reference"]
    ): Promise<ScenarioPackageVersion | null>;
  };
}

export class CoursePackageCommandError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "CoursePackageCommandError";
  }
}

function sameParameterSetReference(
  left: CoursePackageVersion["parameter_set_reference"],
  right: CoursePackageVersion["parameter_set_reference"]
): boolean {
  return (
    left.parameter_set_id === right.parameter_set_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function cloneDraft(version: CoursePackageVersion): CoursePackageVersionDraftInput {
  return {
    course_blueprint_reference: structuredClone(version.course_blueprint_reference),
    course_package_id: version.course_package_id,
    description: version.description,
    parameter_set_reference: structuredClone(version.parameter_set_reference),
    scenario_package_reference: structuredClone(version.scenario_package_reference),
    ...(version.studio_configuration
      ? { studio_configuration: structuredClone(version.studio_configuration) }
      : {}),
    ...(version.factory_metadata
      ? { factory_metadata: structuredClone(version.factory_metadata) }
      : {}),
    title: version.title,
    version: version.version
  };
}

export class CoursePackageCommandService {
  constructor(
    private readonly registry: CoursePackageRegistryPort,
    private readonly sources: CoursePackageSourceReadPorts
  ) {}

  captureAuditCheckpointForCompensation(): CoursePackageVersion[] {
    return this.registry.captureAuditCheckpointForCompensation();
  }

  restoreAuditCheckpointAfterFailure(checkpoint: readonly CoursePackageVersion[]): void {
    this.registry.restoreAuditCheckpointAfterFailure(checkpoint);
  }

  async createDraft(
    actor: CoursePackageCommandActor,
    draft: CoursePackageVersionDraftInput
  ): Promise<CoursePackageVersion> {
    if (
      !actor.actor_id.trim() ||
      !actor.tenant_id.trim() ||
      draft.course_blueprint_reference.tenant_id !== actor.tenant_id ||
      draft.scenario_package_reference.tenant_id !== actor.tenant_id
    ) {
      throw new CoursePackageCommandError("COURSE_PACKAGE_TENANT_SCOPE_VIOLATION");
    }
    try {
      const version = createCoursePackageDraftVersion({
        actor_id: actor.actor_id,
        draft,
        now: this.registry.currentTime(),
        tenant_id: actor.tenant_id
      });
      await this.registry.append(version);
      return version;
    } catch (error) {
      this.mapRegistryError(error, "COURSE_PACKAGE_DUPLICATE_VERSION");
    }
  }

  async getByReference(
    tenantId: string,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersion | null> {
    return this.registry.getByReference(tenantId, reference);
  }

  async validate(
    actor: CoursePackageCommandActor,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersion> {
    const current = await this.getOwned(actor, reference);
    if (current.factory_metadata !== undefined) {
      throw new CoursePackageCommandError("COURSE_PACKAGE_FORBIDDEN");
    }
    if (current.status !== "DRAFT") {
      throw new CoursePackageCommandError("COURSE_PACKAGE_LIFECYCLE_INVALID");
    }
    await this.assertDependencies(current);
    return this.appendTransition(current, "VALIDATED");
  }

  async validateFactory(
    actor: CoursePackageCommandActor,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersion> {
    const current = await this.getOwned(actor, reference);
    if (current.status !== "DRAFT" || current.factory_metadata === undefined) {
      throw new CoursePackageCommandError("COURSE_PACKAGE_LIFECYCLE_INVALID");
    }
    await this.assertDependencies(current);
    return this.appendTransition(current, "VALIDATED");
  }

  async makeAvailable(
    actor: CoursePackageCommandActor,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersion> {
    const current = await this.getOwned(actor, reference);
    if (current.status !== "VALIDATED") {
      throw new CoursePackageCommandError("COURSE_PACKAGE_LIFECYCLE_INVALID");
    }
    await this.assertDependencies(current);
    return this.appendTransition(current, "AVAILABLE");
  }

  async approveFactory(
    actor: CoursePackageCommandActor,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersion> {
    const current = await this.getOwned(actor, reference);
    if (current.status !== "VALIDATED" || current.factory_metadata === undefined) {
      throw new CoursePackageCommandError("COURSE_PACKAGE_LIFECYCLE_INVALID");
    }
    await this.assertDependencies(current);
    return this.appendTransition(current, "APPROVED");
  }

  async publishFactory(
    actor: CoursePackageCommandActor,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersion> {
    const current = await this.getOwned(actor, reference);
    if (current.status !== "APPROVED" || current.factory_metadata === undefined) {
      throw new CoursePackageCommandError("COURSE_PACKAGE_LIFECYCLE_INVALID");
    }
    await this.assertDependencies(current);
    return this.appendTransition(current, "PUBLISHED");
  }

  async supersedeFactory(
    actor: CoursePackageCommandActor,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersion> {
    const current = await this.getOwned(actor, reference);
    if (current.status !== "PUBLISHED" || current.factory_metadata === undefined) {
      throw new CoursePackageCommandError("COURSE_PACKAGE_LIFECYCLE_INVALID");
    }
    return this.appendTransition(current, "SUPERSEDED");
  }

  async retire(
    actor: CoursePackageCommandActor,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersion> {
    const current = await this.getOwned(actor, reference);
    if (current.status !== "AVAILABLE" || current.factory_metadata !== undefined) {
      throw new CoursePackageCommandError("COURSE_PACKAGE_LIFECYCLE_INVALID");
    }
    return this.appendTransition(current, "RETIRED");
  }

  async retireFactory(
    actor: CoursePackageCommandActor,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersion> {
    const current = await this.getOwned(actor, reference);
    if (
      (current.status !== "PUBLISHED" && current.status !== "SUPERSEDED") ||
      current.factory_metadata === undefined
    ) {
      throw new CoursePackageCommandError("COURSE_PACKAGE_LIFECYCLE_INVALID");
    }
    return this.appendTransition(current, "RETIRED");
  }

  async clone(
    actor: CoursePackageCommandActor,
    input: CoursePackageVersionCloneInput
  ): Promise<CoursePackageVersion> {
    const source = await this.getOwned(actor, input.source_course_package_reference);
    if (source.status !== "AVAILABLE") {
      throw new CoursePackageCommandError("COURSE_PACKAGE_LIFECYCLE_INVALID");
    }
    return this.createDraft(actor, {
      ...cloneDraft(source),
      course_package_id: input.course_package_id,
      description: input.description,
      title: input.title,
      version: input.version
    });
  }

  async import(
    actor: CoursePackageCommandActor,
    input: CoursePackageVersionImportInput
  ): Promise<CoursePackageVersion> {
    const source = input.source_course_package_version;
    if (source.tenant_id !== actor.tenant_id) {
      throw new CoursePackageCommandError("COURSE_PACKAGE_TENANT_SCOPE_VIOLATION");
    }
    try {
      assertValidCoursePackageVersion(source);
    } catch (error) {
      if (error instanceof CoursePackageRegistryError) {
        throw new CoursePackageCommandError("COURSE_PACKAGE_IMPORT_DIGEST_INVALID");
      }
      throw error;
    }
    if (source.status !== "AVAILABLE") {
      throw new CoursePackageCommandError("COURSE_PACKAGE_LIFECYCLE_INVALID");
    }
    try {
      return await this.createDraft(actor, cloneDraft(source));
    } catch (error) {
      if (error instanceof CoursePackageRegistryError) {
        throw new CoursePackageCommandError("COURSE_PACKAGE_IMPORT_DIGEST_INVALID");
      }
      throw error;
    }
  }

  async export(
    actor: CoursePackageCommandActor,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersionExportDto> {
    const current = await this.getOwned(actor, reference);
    if (current.status !== "AVAILABLE") {
      throw new CoursePackageCommandError("COURSE_PACKAGE_LIFECYCLE_INVALID");
    }
    return { course_package_version: structuredClone(current) };
  }

  private async getOwned(
    actor: CoursePackageCommandActor,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersion> {
    if (reference.tenant_id !== actor.tenant_id) {
      throw new CoursePackageCommandError("COURSE_PACKAGE_TENANT_SCOPE_VIOLATION");
    }
    const current = await this.registry.getByReference(actor.tenant_id, reference);
    if (!current) throw new CoursePackageCommandError("COURSE_PACKAGE_NOT_FOUND");
    return current;
  }

  private async appendTransition(
    current: CoursePackageVersion,
    status: CoursePackageVersion["status"]
  ): Promise<CoursePackageVersion> {
    const next = createCoursePackageLifecycleSnapshot(current, status);
    try {
      await this.registry.append(next);
    } catch (error) {
      this.mapRegistryError(error, "COURSE_PACKAGE_LIFECYCLE_INVALID");
    }
    return next;
  }

  private async assertDependencies(version: CoursePackageVersion): Promise<void> {
    try {
      await Promise.all([
        this.sources.courseBlueprints.assertBindable(
          version.tenant_id,
          version.course_blueprint_reference
        ),
        this.sources.scenarioPackages.assertBindable(
          version.tenant_id,
          version.scenario_package_reference
        ),
        this.sources.parameterSets.assertBindable(
          version.tenant_id,
          version.parameter_set_reference
        )
      ]);
    } catch {
      throw new CoursePackageCommandError("COURSE_PACKAGE_DEPENDENCY_NOT_BINDABLE");
    }

    const [courseBlueprint, scenarioPackage, parameterSet] = await Promise.all([
      this.sources.courseBlueprints.getByReference(
        version.tenant_id,
        version.course_blueprint_reference
      ),
      this.sources.scenarioPackages.getByReference(
        version.tenant_id,
        version.scenario_package_reference
      ),
      this.sources.parameterSets.getByReference(version.tenant_id, version.parameter_set_reference)
    ]);

    if (
      !courseBlueprint ||
      !scenarioPackage ||
      !parameterSet ||
      courseBlueprint.status !== "APPROVED" ||
      scenarioPackage.status !== "APPROVED" ||
      parameterSet.status !== "APPROVED"
    ) {
      throw new CoursePackageCommandError("COURSE_PACKAGE_DEPENDENCY_NOT_BINDABLE");
    }
    if (
      !sameParameterSetReference(
        scenarioPackage.parameter_set_reference,
        version.parameter_set_reference
      ) ||
      !sameParameterSetReference(parameterSet.reference, version.parameter_set_reference)
    ) {
      throw new CoursePackageCommandError("COURSE_PACKAGE_COMPATIBILITY_MISMATCH");
    }
    for (const [key, expected] of Object.entries(
      courseBlueprint.scenario_compatibility_constraints
    )) {
      if (scenarioPackage.compatibility_metadata[key] !== expected) {
        throw new CoursePackageCommandError("COURSE_PACKAGE_COMPATIBILITY_MISMATCH");
      }
    }
  }

  private mapRegistryError(error: unknown, fallback: string): never {
    if (error instanceof CoursePackageRegistryError) {
      throw new CoursePackageCommandError(
        error.code === "COURSE_PACKAGE_INPUT_INVALID" ? "COURSE_PACKAGE_INPUT_INVALID" : fallback
      );
    }
    throw error;
  }
}
