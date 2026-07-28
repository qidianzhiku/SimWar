import { createHash } from "node:crypto";
import type {
  FormalRunEngineReference,
  ParameterSetReference,
  ScenarioPackageReference
} from "@simwar/shared-contracts";
import type { FormalRunBindingAuthorityPorts } from "./formal-run-runtime-binding.js";

export const FORMAL_COURSE_AUTHORITY_BINDING_SCHEMA_VERSION =
  "formal-course-authority-binding.v1" as const;

export interface FormalCourseAuthorityBinding {
  binding_digest: string;
  binding_schema_version: typeof FORMAL_COURSE_AUTHORITY_BINDING_SCHEMA_VERSION;
  course_id: string;
  engine_reference: Readonly<FormalRunEngineReference>;
  parameter_set_reference: Readonly<ParameterSetReference>;
  scenario_package_reference: Readonly<ScenarioPackageReference>;
  tenant_id: string;
}

export type FormalCourseAuthorityBindingFailureCode =
  | "FORMAL_COURSE_BINDING_INVALID"
  | "FORMAL_COURSE_BINDING_PARAMETER_NOT_BINDABLE"
  | "FORMAL_COURSE_BINDING_PARAMETER_REFERENCE_MISMATCH"
  | "FORMAL_COURSE_BINDING_PLUGIN_NOT_BINDABLE"
  | "FORMAL_COURSE_BINDING_SCENARIO_NOT_BINDABLE";

export class FormalCourseAuthorityBindingError extends Error {
  constructor(readonly code: FormalCourseAuthorityBindingFailureCode) {
    super(code);
    this.name = "FormalCourseAuthorityBindingError";
  }
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sameParameterSetReference(
  left: ParameterSetReference,
  right: ParameterSetReference
): boolean {
  return (
    left.parameter_set_id === right.parameter_set_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameScenarioPackageReference(
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

function createBindingDigest(input: Omit<FormalCourseAuthorityBinding, "binding_digest">): string {
  return createHash("sha256").update(canonicalize(input)).digest("hex");
}

export async function createFormalCourseAuthorityBinding(input: {
  authorities: FormalRunBindingAuthorityPorts;
  course_id: string;
  engine_reference: FormalRunEngineReference;
  parameter_set_reference: ParameterSetReference;
  scenario_package_reference: ScenarioPackageReference;
  tenant_id: string;
}): Promise<FormalCourseAuthorityBinding> {
  if (
    !isNonBlankString(input.course_id) ||
    !isNonBlankString(input.tenant_id) ||
    !isNonBlankString(input.engine_reference.engine_id) ||
    !isNonBlankString(input.engine_reference.version) ||
    input.scenario_package_reference.tenant_id !== input.tenant_id
  ) {
    throw new FormalCourseAuthorityBindingError("FORMAL_COURSE_BINDING_INVALID");
  }

  try {
    await input.authorities.scenarios.assertBindable(
      input.tenant_id,
      input.scenario_package_reference
    );
  } catch {
    throw new FormalCourseAuthorityBindingError("FORMAL_COURSE_BINDING_SCENARIO_NOT_BINDABLE");
  }

  try {
    await input.authorities.parameterSets.assertBindable(
      input.tenant_id,
      input.parameter_set_reference
    );
  } catch {
    throw new FormalCourseAuthorityBindingError("FORMAL_COURSE_BINDING_PARAMETER_NOT_BINDABLE");
  }

  const [scenarioPackage, parameterSet] = await Promise.all([
    input.authorities.scenarios.getByReference(input.tenant_id, input.scenario_package_reference),
    input.authorities.parameterSets.getByReference(input.tenant_id, input.parameter_set_reference)
  ]);

  if (!scenarioPackage || scenarioPackage.status !== "APPROVED") {
    throw new FormalCourseAuthorityBindingError("FORMAL_COURSE_BINDING_SCENARIO_NOT_BINDABLE");
  }
  if (!parameterSet || parameterSet.status !== "APPROVED") {
    throw new FormalCourseAuthorityBindingError("FORMAL_COURSE_BINDING_PARAMETER_NOT_BINDABLE");
  }
  if (
    !sameScenarioPackageReference(scenarioPackage.reference, input.scenario_package_reference) ||
    !sameParameterSetReference(parameterSet.reference, input.parameter_set_reference) ||
    !sameParameterSetReference(scenarioPackage.parameter_set_reference, parameterSet.reference)
  ) {
    throw new FormalCourseAuthorityBindingError(
      "FORMAL_COURSE_BINDING_PARAMETER_REFERENCE_MISMATCH"
    );
  }

  const pluginReleases = await Promise.all(
    scenarioPackage.plugin_dependencies.map((dependency) =>
      input.authorities.plugins.resolveAvailableForNewBinding(
        dependency.plugin_package_id,
        dependency.version
      )
    )
  );
  if (
    pluginReleases.some((pluginRelease) => !pluginRelease || pluginRelease.status !== "AVAILABLE")
  ) {
    throw new FormalCourseAuthorityBindingError("FORMAL_COURSE_BINDING_PLUGIN_NOT_BINDABLE");
  }

  const bindingWithoutDigest = {
    binding_schema_version: FORMAL_COURSE_AUTHORITY_BINDING_SCHEMA_VERSION,
    course_id: input.course_id,
    engine_reference: clone(input.engine_reference),
    parameter_set_reference: clone(input.parameter_set_reference),
    scenario_package_reference: clone(input.scenario_package_reference),
    tenant_id: input.tenant_id
  };
  return deepFreeze({
    ...bindingWithoutDigest,
    binding_digest: createBindingDigest(bindingWithoutDigest)
  });
}

export function assertFormalCourseAuthorityBinding(binding: FormalCourseAuthorityBinding): void {
  const expectedDigest = createBindingDigest({
    binding_schema_version: binding.binding_schema_version,
    course_id: binding.course_id,
    engine_reference: binding.engine_reference,
    parameter_set_reference: binding.parameter_set_reference,
    scenario_package_reference: binding.scenario_package_reference,
    tenant_id: binding.tenant_id
  });
  if (
    binding.binding_schema_version !== FORMAL_COURSE_AUTHORITY_BINDING_SCHEMA_VERSION ||
    binding.binding_digest !== expectedDigest ||
    binding.scenario_package_reference.tenant_id !== binding.tenant_id
  ) {
    throw new FormalCourseAuthorityBindingError("FORMAL_COURSE_BINDING_INVALID");
  }
}
