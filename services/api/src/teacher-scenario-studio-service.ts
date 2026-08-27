import type {
  Course,
  CourseBlueprintReference,
  CoursePackageVersion,
  CoursePackageVersionReference,
  TeacherScenarioStudioActivationDto,
  TeacherScenarioStudioCatalogDto,
  TeacherScenarioStudioConfiguration,
  TeacherScenarioStudioDraftDto,
  TeacherScenarioStudioDraftInput,
  TeacherScenarioStudioJsonValue,
  TeacherScenarioStudioPreviewDto,
  TeacherScenarioStudioStatus,
  TeacherScenarioStudioValidationDto
} from "@simwar/shared-contracts";
import { W5_MODEL_VERSION_REF } from "@simwar/shared-contracts";
import type { CourseBlueprintVersion } from "./course-blueprint-authority.js";
import type { CoursePackageCommandService } from "./course-package-command-service.js";
import { createCoursePackageVersionReference } from "./course-package-json-registry.js";
import type { CoursePackageVersionDraftInput } from "@simwar/shared-contracts";
import type { ParameterSetVersion } from "./parameter-set-authority.js";
import type {
  ScenarioPackageAuthorityReadProjection,
  ScenarioPackageReference
} from "@simwar/shared-contracts";

export type TeacherScenarioStudioFailureCode =
  | "TEACHER_SCENARIO_STUDIO_ACTIVATION_FAILED"
  | "TEACHER_SCENARIO_STUDIO_COMPATIBILITY_MISMATCH"
  | "TEACHER_SCENARIO_STUDIO_CUSTOM_PARAMETER_INVALID"
  | "TEACHER_SCENARIO_STUDIO_INPUT_INVALID"
  | "TEACHER_SCENARIO_STUDIO_LIFECYCLE_INVALID"
  | "TEACHER_SCENARIO_STUDIO_MODEL_VERSION_MISMATCH"
  | "TEACHER_SCENARIO_STUDIO_NOT_FOUND"
  | "TEACHER_SCENARIO_STUDIO_SOURCE_NOT_BINDABLE"
  | "TEACHER_SCENARIO_STUDIO_TENANT_SCOPE_VIOLATION";

export class TeacherScenarioStudioError extends Error {
  constructor(readonly code: TeacherScenarioStudioFailureCode) {
    super(code);
    this.name = "TeacherScenarioStudioError";
  }
}

export interface TeacherScenarioStudioActor {
  actor_id: string;
  tenant_id: string;
}

export interface TeacherScenarioStudioSourcePorts {
  courseBlueprints: {
    getByReference(
      tenantId: string,
      reference: CourseBlueprintReference
    ): Promise<CourseBlueprintVersion | null>;
    listApprovedForTenant(tenantId: string): Promise<CourseBlueprintVersion[]>;
  };
  parameterSets: {
    getByReference(
      tenantId: string,
      reference: TeacherScenarioStudioDraftInput["parameter_set_reference"]
    ): Promise<ParameterSetVersion | null>;
  };
  scenarioPackages: {
    assertBindable(tenantId: string, reference: ScenarioPackageReference): Promise<void>;
    getByReference(
      tenantId: string,
      reference: ScenarioPackageReference
    ): Promise<ScenarioPackageAuthorityReadProjection | null>;
    listApprovedForTenant(tenantId: string): Promise<ScenarioPackageAuthorityReadProjection[]>;
  };
}

export interface TeacherScenarioStudioActivationInput {
  actor_id: string;
  course_blueprint_reference: CourseBlueprintReference;
  scenario_package_reference: ScenarioPackageReference;
  tenant_id: string;
  title: string;
}

export interface TeacherScenarioStudioDependencies {
  activateCourse(input: TeacherScenarioStudioActivationInput): Promise<Course>;
  coursePackages: CoursePackageCommandService;
  modelVersionRef?: string;
  sources: TeacherScenarioStudioSourcePorts;
}

const DEFAULT_MODEL_VERSION_REF = W5_MODEL_VERSION_REF;
const MODULE_KEYS = [
  "capital",
  "environment",
  "funding",
  "policy_shocks",
  "project_template",
  "workforce"
] as const;

type ModuleKey = (typeof MODULE_KEYS)[number];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sameReference(
  left: CoursePackageVersionReference,
  right: CoursePackageVersionReference
): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.course_package_id === right.course_package_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameBlueprintReference(
  left: CourseBlueprintReference,
  right: CourseBlueprintReference
): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.course_blueprint_id === right.course_blueprint_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameScenarioReference(
  left: ScenarioPackageReference,
  right: ScenarioPackageReference
): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.scenario_package_id === right.scenario_package_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameParameterReference(
  left: TeacherScenarioStudioDraftInput["parameter_set_reference"],
  right: TeacherScenarioStudioDraftInput["parameter_set_reference"]
): boolean {
  return (
    left.parameter_set_id === right.parameter_set_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function exactIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) &&
    !/(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  );
}

function exactDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function exactModelVersionRef(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    /^[A-Za-z0-9]+(?:[._:@+-][A-Za-z0-9]+)*$/.test(value) &&
    !/(?:^|[._:@+-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:@+-])/i.test(
      value
    )
  );
}

function isJsonValue(value: unknown): value is TeacherScenarioStudioJsonValue {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every(isJsonValue);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = new Set(keys);
  const actual = Object.keys(value);
  return actual.length === expected.size && actual.every((key) => expected.has(key));
}

function assertExactReference(
  tenantId: string,
  reference: CourseBlueprintReference | ScenarioPackageReference,
  kind: "blueprint" | "scenario"
): void {
  const id =
    kind === "blueprint"
      ? (reference as CourseBlueprintReference).course_blueprint_id
      : (reference as ScenarioPackageReference).scenario_package_id;
  if (
    reference.tenant_id !== tenantId ||
    !exactIdentity(id) ||
    !exactIdentity(reference.tenant_id) ||
    !exactIdentity(reference.version) ||
    !exactDigest(reference.content_digest)
  ) {
    throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_INPUT_INVALID");
  }
}

function assertExactParameterReference(
  tenantId: string,
  reference: TeacherScenarioStudioDraftInput["parameter_set_reference"]
): void {
  if (
    !exactIdentity(reference.parameter_set_id) ||
    !exactIdentity(reference.version) ||
    !exactDigest(reference.content_digest) ||
    !exactIdentity(tenantId)
  ) {
    throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_INPUT_INVALID");
  }
}

function assertConfiguration(configuration: TeacherScenarioStudioConfiguration): void {
  if (
    !isRecord(configuration) ||
    !hasExactlyKeys(configuration, [
      "custom_parameters",
      "experience_profile",
      "model_version_ref",
      "module_configuration",
      "schema_version"
    ]) ||
    configuration.schema_version !== "teacher-scenario-studio.v1" ||
    !["STANDARD", "ADVANCED"].includes(configuration.experience_profile) ||
    !exactModelVersionRef(configuration.model_version_ref)
  ) {
    throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_INPUT_INVALID");
  }

  const moduleConfiguration = configuration.module_configuration;
  if (
    !isRecord(moduleConfiguration) ||
    !hasExactlyKeys(moduleConfiguration, MODULE_KEYS) ||
    MODULE_KEYS.some((key) => !isRecord(moduleConfiguration[key])) ||
    MODULE_KEYS.some((key) => !Object.values(moduleConfiguration[key] as object).every(isJsonValue))
  ) {
    throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_INPUT_INVALID");
  }

  const custom = configuration.custom_parameters;
  if (
    !isRecord(custom) ||
    !hasExactlyKeys(custom, ["mode", "values"]) ||
    custom.mode !== "DRAFT_ONLY" ||
    !isJsonValue(custom.values)
  ) {
    throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_CUSTOM_PARAMETER_INVALID");
  }
}

function assertDraftInput(
  actor: TeacherScenarioStudioActor,
  input: TeacherScenarioStudioDraftInput
): void {
  if (!exactIdentity(actor.actor_id) || !exactIdentity(actor.tenant_id)) {
    throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_TENANT_SCOPE_VIOLATION");
  }
  if (
    !exactIdentity(input.course_package_id) ||
    !exactIdentity(input.version) ||
    typeof input.title !== "string" ||
    input.title.trim() !== input.title ||
    input.title.length === 0 ||
    typeof input.description !== "string" ||
    input.description.trim() !== input.description ||
    input.description.length === 0
  ) {
    throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_INPUT_INVALID");
  }
  assertExactReference(actor.tenant_id, input.course_blueprint_reference, "blueprint");
  assertExactReference(actor.tenant_id, input.scenario_package_reference, "scenario");
  assertExactParameterReference(actor.tenant_id, input.parameter_set_reference);
  assertConfiguration(input.studio_configuration);
}

function toCoursePackageDraft(
  input: TeacherScenarioStudioDraftInput
): CoursePackageVersionDraftInput {
  return {
    course_blueprint_reference: clone(input.course_blueprint_reference),
    course_package_id: input.course_package_id,
    description: input.description,
    parameter_set_reference: clone(input.parameter_set_reference),
    scenario_package_reference: clone(input.scenario_package_reference),
    studio_configuration: clone(input.studio_configuration),
    title: input.title,
    version: input.version
  };
}

function statusOf(version: CoursePackageVersion): TeacherScenarioStudioStatus {
  switch (version.status) {
    case "DRAFT":
      return "DRAFT";
    case "VALIDATED":
      return "VALIDATED";
    case "AVAILABLE":
      return "FROZEN";
    default:
      throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_LIFECYCLE_INVALID");
  }
}

function requireConfiguration(version: CoursePackageVersion): TeacherScenarioStudioConfiguration {
  if (!version.studio_configuration) {
    throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_INPUT_INVALID");
  }
  assertConfiguration(version.studio_configuration);
  return version.studio_configuration;
}

function toDraftDto(version: CoursePackageVersion): TeacherScenarioStudioDraftDto {
  return {
    course_package_reference: createCoursePackageVersionReference(version),
    operation_id: "TEACHER_SCENARIO_STUDIO_DRAFT_CREATE_V1",
    status: statusOf(version),
    studio_configuration: clone(requireConfiguration(version)),
    title: version.title
  };
}

function sourceProjection(
  scenario: ScenarioPackageAuthorityReadProjection
): TeacherScenarioStudioCatalogDto["scenario_packages"][number] {
  return {
    compatibility_metadata: clone(scenario.compatibility_metadata),
    parameter_set_reference: clone(scenario.parameter_set_reference),
    plugin_dependencies: clone(scenario.plugin_dependencies),
    scenario_package_reference: clone(scenario.reference)
  };
}

export class TeacherScenarioStudioService {
  private readonly modelVersionRef: string;

  constructor(private readonly dependencies: TeacherScenarioStudioDependencies) {
    this.modelVersionRef = dependencies.modelVersionRef ?? DEFAULT_MODEL_VERSION_REF;
  }

  async getCatalog(tenantId: string): Promise<TeacherScenarioStudioCatalogDto> {
    const [blueprints, scenarios] = await Promise.all([
      this.dependencies.sources.courseBlueprints.listApprovedForTenant(tenantId),
      this.dependencies.sources.scenarioPackages.listApprovedForTenant(tenantId)
    ]);
    return {
      course_blueprints: blueprints.map((blueprint) => ({
        compatibility_constraints: clone(blueprint.scenario_compatibility_constraints),
        course_blueprint_reference: clone(blueprint.reference),
        title: blueprint.title
      })),
      model_versions: [
        { model_version_ref: this.modelVersionRef, provider: "OFF", status: "APPROVED" }
      ],
      operation_id: "TEACHER_SCENARIO_STUDIO_CATALOG_V1",
      scenario_packages: scenarios.map(sourceProjection)
    };
  }

  async createDraft(
    actor: TeacherScenarioStudioActor,
    input: TeacherScenarioStudioDraftInput
  ): Promise<TeacherScenarioStudioDraftDto> {
    assertDraftInput(actor, input);
    try {
      const created = await this.dependencies.coursePackages.createDraft(
        { actor_id: actor.actor_id, tenant_id: actor.tenant_id },
        toCoursePackageDraft(input)
      );
      return toDraftDto(created);
    } catch (error) {
      if (error instanceof TeacherScenarioStudioError) throw error;
      throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_INPUT_INVALID");
    }
  }

  async preview(
    actor: TeacherScenarioStudioActor,
    reference: CoursePackageVersionReference
  ): Promise<TeacherScenarioStudioPreviewDto> {
    const version = await this.getOwned(actor, reference);
    const configuration = requireConfiguration(version);
    return {
      operation_id: "TEACHER_SCENARIO_STUDIO_PREVIEW_V1",
      role_safe_preview: {
        experience_profile: configuration.experience_profile,
        module_labels: MODULE_KEYS.map((key) => key.replaceAll("_", " ")),
        student_visible: false,
        summary:
          "Teacher-only coupled preview; no custom parameter values or truth fields are exposed."
      },
      source_references: {
        course_blueprint_reference: clone(version.course_blueprint_reference),
        parameter_set_reference: clone(version.parameter_set_reference),
        scenario_package_reference: clone(version.scenario_package_reference)
      },
      status: statusOf(version)
    };
  }

  async validate(
    actor: TeacherScenarioStudioActor,
    reference: CoursePackageVersionReference
  ): Promise<TeacherScenarioStudioValidationDto> {
    const current = await this.getOwned(actor, reference);
    const configuration = requireConfiguration(current);
    const sources = await this.readExactSources(actor.tenant_id, current);
    const compatibility = this.compatibilityStatus(sources.blueprint, sources.scenario);
    const modelVersion = sources.parameter.model_version_ref === configuration.model_version_ref;
    if (!compatibility) {
      throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_COMPATIBILITY_MISMATCH");
    }
    if (!modelVersion || configuration.model_version_ref !== this.modelVersionRef) {
      throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_MODEL_VERSION_MISMATCH");
    }
    if (current.status !== "DRAFT") {
      throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_LIFECYCLE_INVALID");
    }
    try {
      await this.dependencies.coursePackages.validate(
        { actor_id: actor.actor_id, tenant_id: actor.tenant_id },
        reference
      );
    } catch (error) {
      if (error instanceof TeacherScenarioStudioError) throw error;
      throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_SOURCE_NOT_BINDABLE");
    }
    return {
      checks: {
        compatibility: "PASS",
        custom_parameters: "PASS_WITH_LIMITS",
        exact_source_references: "PASS",
        model_version: "PASS"
      },
      operation_id: "TEACHER_SCENARIO_STUDIO_VALIDATE_V1",
      status: "VALIDATED"
    };
  }

  async freeze(
    actor: TeacherScenarioStudioActor,
    reference: CoursePackageVersionReference
  ): Promise<TeacherScenarioStudioDraftDto> {
    const current = await this.getOwned(actor, reference);
    requireConfiguration(current);
    if (current.status !== "VALIDATED") {
      throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_LIFECYCLE_INVALID");
    }
    const frozen = await this.dependencies.coursePackages.makeAvailable(
      { actor_id: actor.actor_id, tenant_id: actor.tenant_id },
      reference
    );
    return {
      ...toDraftDto(frozen),
      operation_id: "TEACHER_SCENARIO_STUDIO_FREEZE_V1",
      status: "FROZEN"
    };
  }

  async activate(
    actor: TeacherScenarioStudioActor,
    reference: CoursePackageVersionReference
  ): Promise<TeacherScenarioStudioActivationDto> {
    const current = await this.getOwned(actor, reference);
    requireConfiguration(current);
    if (current.status !== "AVAILABLE") {
      throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_LIFECYCLE_INVALID");
    }
    const course = await this.dependencies.activateCourse({
      actor_id: actor.actor_id,
      course_blueprint_reference: clone(current.course_blueprint_reference),
      scenario_package_reference: clone(current.scenario_package_reference),
      tenant_id: actor.tenant_id,
      title: current.title
    });
    return {
      activation: {
        run_activation: "DEFERRED_TO_EXISTING_RUN_WRITER",
        status: "ACTIVATED",
        writer: "EXISTING_COURSE_AND_FORMAL_AUTHORITY_BINDING_WRITERS"
      },
      course,
      operation_id: "TEACHER_SCENARIO_STUDIO_ACTIVATE_V1",
      source_references: {
        course_blueprint_reference: clone(current.course_blueprint_reference),
        parameter_set_reference: clone(current.parameter_set_reference),
        scenario_package_reference: clone(current.scenario_package_reference)
      }
    };
  }

  private async getOwned(
    actor: TeacherScenarioStudioActor,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersion> {
    if (reference.tenant_id !== actor.tenant_id) {
      throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_TENANT_SCOPE_VIOLATION");
    }
    const current = await this.dependencies.coursePackages.getByReference(
      actor.tenant_id,
      reference
    );
    if (!current || !sameReference(createCoursePackageVersionReference(current), reference)) {
      throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_NOT_FOUND");
    }
    return current;
  }

  private async readExactSources(
    tenantId: string,
    version: CoursePackageVersion
  ): Promise<{
    blueprint: CourseBlueprintVersion;
    parameter: ParameterSetVersion;
    scenario: ScenarioPackageAuthorityReadProjection;
  }> {
    const [blueprint, parameter, scenario] = await Promise.all([
      this.dependencies.sources.courseBlueprints.getByReference(
        tenantId,
        version.course_blueprint_reference
      ),
      this.dependencies.sources.parameterSets.getByReference(
        tenantId,
        version.parameter_set_reference
      ),
      this.dependencies.sources.scenarioPackages.getByReference(
        tenantId,
        version.scenario_package_reference
      )
    ]);
    if (
      !blueprint ||
      blueprint.status !== "APPROVED" ||
      !parameter ||
      parameter.status !== "APPROVED" ||
      !scenario ||
      scenario.status !== "APPROVED" ||
      !sameBlueprintReference(blueprint.reference, version.course_blueprint_reference) ||
      !sameScenarioReference(scenario.reference, version.scenario_package_reference) ||
      !sameParameterReference(parameter.reference, version.parameter_set_reference) ||
      !sameParameterReference(scenario.parameter_set_reference, version.parameter_set_reference)
    ) {
      throw new TeacherScenarioStudioError("TEACHER_SCENARIO_STUDIO_SOURCE_NOT_BINDABLE");
    }
    return { blueprint, parameter, scenario };
  }

  private compatibilityStatus(
    blueprint: CourseBlueprintVersion,
    scenario: ScenarioPackageAuthorityReadProjection
  ): boolean {
    return Object.entries(blueprint.scenario_compatibility_constraints).every(
      ([key, expected]) => scenario.compatibility_metadata[key] === expected
    );
  }
}

export const TEACHER_SCENARIO_STUDIO_MODULE_KEYS: readonly ModuleKey[] = MODULE_KEYS;
