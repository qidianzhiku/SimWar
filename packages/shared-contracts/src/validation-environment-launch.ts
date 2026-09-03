import type { CourseBlueprintReference } from "./index.js";
import type { CoursePackageVersionReference } from "./course-package-version.js";
import type { ModelArtifactReference, ModelVersionReference } from "./model-governance.js";
import type { ParameterSetReference } from "./parameter-set-authority.js";
import type { ScenarioPackageReference } from "./scenario-package-authority.js";

export const VALIDATION_ENVIRONMENT_LAUNCH_SCHEMA_VERSION =
  "validation-environment-launch.v1" as const;

export const VALIDATION_ENVIRONMENT_LAUNCH_STATUSES = [
  "REQUESTED",
  "BASELINE_READY",
  "COURSE_RUN_READY",
  "COHORT_READY",
  "SESSION_PREFLIGHT_READY",
  "READY",
  "CONFLICT",
  "ABORTED"
] as const;

export type ValidationEnvironmentLaunchStatus =
  (typeof VALIDATION_ENVIRONMENT_LAUNCH_STATUSES)[number];

export interface ValidationEnvironmentLaunchStepReceipt {
  readonly completed_at: string;
  readonly digest: string;
  readonly status: "PASS";
  readonly summary: string;
}

/**
 * The exact governance evidence that admitted a formal Run. This is a
 * durable, role-safe receipt; it records references and authority flags only,
 * never model output or official settlement truth.
 */
export interface ValidationEnvironmentLaunchAdmissionReceipt {
  readonly calibration_dataset_id: string;
  readonly course_id: string;
  readonly course_package_reference: CoursePackageVersionReference;
  readonly model_artifact_reference: ModelArtifactReference;
  readonly model_version_reference: ModelVersionReference;
  readonly official_truth_write: false;
  readonly parameter_set_reference: ParameterSetReference;
  readonly provider: "OFF";
  readonly qualification_content_digest: string;
  readonly qualification_id: string;
  readonly scenario_package_reference: ScenarioPackageReference;
  readonly source_package_id: string;
  readonly status: "ADMITTED";
  readonly tenant_id: string;
  readonly writer_effect: "NONE";
}

export interface ValidationEnvironmentLaunch {
  readonly schema_version: typeof VALIDATION_ENVIRONMENT_LAUNCH_SCHEMA_VERSION;
  readonly launch_id: string;
  readonly tenant_id: string;
  readonly business_key_digest: string;
  readonly request_fingerprint: string;
  readonly status: ValidationEnvironmentLaunchStatus;
  readonly source_parameter_set: {
    readonly tenant_id: string;
    readonly reference: ParameterSetReference;
  };
  readonly source_scenario_package: {
    readonly tenant_id: string;
    readonly reference: ScenarioPackageReference;
  };
  readonly course_blueprint_reference: CourseBlueprintReference;
  readonly course_package_reference: CoursePackageVersionReference;
  readonly qualified_run_admission_receipt?: ValidationEnvironmentLaunchAdmissionReceipt;
  readonly step_receipts: Readonly<
    Partial<{
      baseline: ValidationEnvironmentLaunchStepReceipt;
      course_run: ValidationEnvironmentLaunchStepReceipt;
      cohort: ValidationEnvironmentLaunchStepReceipt;
      session: ValidationEnvironmentLaunchStepReceipt;
    }>
  >;
  readonly course_id?: string;
  readonly run_id?: string;
  readonly round_id?: string;
  readonly team_ids?: readonly string[];
  readonly session_id?: string;
  readonly version: number;
  readonly created_by: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly last_error?: string | undefined;
  readonly known_limits: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isReference(value: unknown, keys: readonly string[]): boolean {
  return (
    isRecord(value) &&
    keys.every((key) => typeof value[key] === "string" && String(value[key]).trim().length > 0) &&
    isDigest(value.content_digest)
  );
}

function isStepReceipt(value: unknown): value is ValidationEnvironmentLaunchStepReceipt {
  return (
    isRecord(value) &&
    value.status === "PASS" &&
    typeof value.completed_at === "string" &&
    isDigest(value.digest) &&
    typeof value.summary === "string" &&
    value.summary.trim().length > 0
  );
}

function isAdmissionReceipt(value: unknown): value is ValidationEnvironmentLaunchAdmissionReceipt {
  if (!isRecord(value)) return false;
  const coursePackage = value.course_package_reference;
  const modelVersion = value.model_version_reference;
  const modelArtifact = value.model_artifact_reference;
  const parameter = value.parameter_set_reference;
  const scenario = value.scenario_package_reference;
  return (
    typeof value.calibration_dataset_id === "string" && value.calibration_dataset_id.trim().length > 0 &&
    typeof value.course_id === "string" && value.course_id.trim().length > 0 &&
    isReference(coursePackage, ["course_package_id", "version", "tenant_id", "content_digest"]) &&
    isReference(modelVersion, ["model_version_id", "version", "content_digest"]) &&
    isReference(modelArtifact, ["artifact_id", "content_digest", "format", "source_ref"]) &&
    isReference(parameter, ["parameter_set_id", "version", "content_digest"]) &&
    isReference(scenario, ["scenario_package_id", "version", "tenant_id", "content_digest"]) &&
    value.official_truth_write === false &&
    value.provider === "OFF" &&
    isDigest(value.qualification_content_digest) &&
    typeof value.qualification_id === "string" && value.qualification_id.trim().length > 0 &&
    typeof value.source_package_id === "string" && value.source_package_id.trim().length > 0 &&
    value.status === "ADMITTED" &&
    typeof value.tenant_id === "string" && value.tenant_id.trim().length > 0 &&
    value.writer_effect === "NONE"
  );
}

export function isValidationEnvironmentLaunch(
  value: unknown
): value is ValidationEnvironmentLaunch {
  if (!isRecord(value)) return false;
  if (
    value.schema_version !== VALIDATION_ENVIRONMENT_LAUNCH_SCHEMA_VERSION ||
    typeof value.launch_id !== "string" ||
    typeof value.tenant_id !== "string" ||
    !isDigest(value.business_key_digest) ||
    !isDigest(value.request_fingerprint) ||
    !VALIDATION_ENVIRONMENT_LAUNCH_STATUSES.includes(
      value.status as ValidationEnvironmentLaunchStatus
    ) ||
    typeof value.version !== "number" ||
    !Number.isInteger(value.version) ||
    value.version < 0 ||
    typeof value.created_by !== "string" ||
    typeof value.created_at !== "string" ||
    typeof value.updated_at !== "string" ||
    !Array.isArray(value.known_limits) ||
    !value.known_limits.every((limit) => typeof limit === "string")
  ) {
    return false;
  }
  if (
    !isRecord(value.source_parameter_set) ||
    typeof value.source_parameter_set.tenant_id !== "string" ||
    !isReference(value.source_parameter_set.reference, [
      "parameter_set_id",
      "version",
      "content_digest"
    ]) ||
    !isRecord(value.source_scenario_package) ||
    typeof value.source_scenario_package.tenant_id !== "string" ||
    !isReference(value.source_scenario_package.reference, [
      "scenario_package_id",
      "version",
      "tenant_id",
      "content_digest"
    ]) ||
    !isReference(value.course_blueprint_reference, [
      "course_blueprint_id",
      "version",
      "tenant_id",
      "content_digest"
    ]) ||
    !isReference(value.course_package_reference, [
      "course_package_id",
      "version",
      "tenant_id",
      "content_digest"
    ]) ||
    (value.qualified_run_admission_receipt !== undefined &&
      !isAdmissionReceipt(value.qualified_run_admission_receipt)) ||
    !isRecord(value.step_receipts)
  ) {
    return false;
  }
  const stepReceipts = value.step_receipts as Record<string, unknown>;
  return ["baseline", "course_run", "cohort", "session"].every(
    (key) => stepReceipts[key] === undefined || isStepReceipt(stepReceipts[key])
  );
}
