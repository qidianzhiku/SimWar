import { createHash } from "node:crypto";
import {
  FORMAL_RUN_RUNTIME_BINDING_SCHEMA_VERSION,
  createParameterSetReference,
  createScenarioPackageReference,
  type FormalRunEngineReference,
  type FormalRunPluginReleaseReference,
  type FormalRunRuntimeBinding,
  type ParameterSetReference,
  type Run,
  type ScenarioPackageReference
} from "@simwar/shared-contracts";

export type FormalRunRuntimeBindingFailureCode =
  | "FORMAL_RUN_BINDING_DIGEST_MISMATCH"
  | "FORMAL_RUN_BINDING_HISTORICAL_REFERENCE_UNAVAILABLE"
  | "FORMAL_RUN_BINDING_INVALID"
  | "FORMAL_RUN_BINDING_PARAMETER_NOT_BINDABLE"
  | "FORMAL_RUN_BINDING_PARAMETER_REFERENCE_MISMATCH"
  | "FORMAL_RUN_BINDING_RUN_MISMATCH"
  | "FORMAL_RUN_BINDING_SCENARIO_NOT_BINDABLE";

export class FormalRunRuntimeBindingError extends Error {
  readonly code: FormalRunRuntimeBindingFailureCode;

  constructor(code: FormalRunRuntimeBindingFailureCode) {
    super(code);
    this.code = code;
    this.name = "FormalRunRuntimeBindingError";
  }
}

type AuthorityLifecycleStatus = "DRAFT" | "VALIDATED" | "FROZEN" | "APPROVED" | "RETIRED";

interface ParameterSetAuthorityBindingRecord {
  content_digest: string;
  model_version_ref: string;
  parameter_set_id: string;
  reference: ParameterSetReference;
  schema_version: string;
  status: AuthorityLifecycleStatus;
  tenant_id: string;
  version: string;
}

interface ScenarioPackageAuthorityBindingRecord {
  content_digest: string;
  parameter_set_reference: ParameterSetReference;
  plugin_dependencies: readonly FormalRunPluginReleaseReference[];
  reference: ScenarioPackageReference;
  scenario_package_id: string;
  schema_version: string;
  status: AuthorityLifecycleStatus;
  tenant_id: string;
  version: string;
}

export interface FormalRunBindingAuthorityPorts {
  parameterSets: {
    assertBindable(tenantId: string, reference: ParameterSetReference): Promise<void>;
    getByReference(
      tenantId: string,
      reference: ParameterSetReference
    ): Promise<ParameterSetAuthorityBindingRecord | null>;
  };
  scenarios: {
    assertBindable(tenantId: string, reference: ScenarioPackageReference): Promise<void>;
    getByReference(
      tenantId: string,
      reference: ScenarioPackageReference
    ): Promise<ScenarioPackageAuthorityBindingRecord | null>;
  };
}

export interface CreateFormalRunRuntimeBindingInput {
  authorities: FormalRunBindingAuthorityPorts;
  engine_reference: FormalRunEngineReference;
  parameter_set_reference: ParameterSetReference;
  run_id: string;
  scenario_package_reference: ScenarioPackageReference;
  seed: number;
  tenant_id: string;
}

export interface HistoricalFormalRunRuntimeBindingResolution {
  binding: FormalRunRuntimeBinding;
  parameter_set_status: "APPROVED" | "RETIRED";
  scenario_package_status: "APPROVED" | "RETIRED";
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_INVALID");
    }
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(",")}}`;
  }

  throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_INVALID");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }

  return value;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSeed(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isHistoricallyReadableStatus(
  status: AuthorityLifecycleStatus
): status is "APPROVED" | "RETIRED" {
  return status === "APPROVED" || status === "RETIRED";
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

function createBindingDigest(input: Omit<FormalRunRuntimeBinding, "binding_digest">): string {
  return createHash("sha256").update(canonicalize(input), "utf8").digest("hex");
}

function assertBindingShape(binding: FormalRunRuntimeBinding): void {
  const schemaIds = binding.projection_schema_references.map((reference) => reference.schema_id);
  const pluginIdentities = new Set<string>();

  if (
    binding.binding_schema_version !== FORMAL_RUN_RUNTIME_BINDING_SCHEMA_VERSION ||
    !/^[a-f0-9]{64}$/.test(binding.binding_digest) ||
    !isNonBlankString(binding.run_id) ||
    !isNonBlankString(binding.tenant_id) ||
    !isSeed(binding.seed) ||
    binding.seed_policy !== "EXACT_RUN_SEED" ||
    !isNonBlankString(binding.engine_reference.engine_id) ||
    !isNonBlankString(binding.engine_reference.version) ||
    binding.model_version_references.length !== 1 ||
    binding.model_version_references.some((reference) => !isNonBlankString(reference)) ||
    binding.projection_schema_references.length !== 2 ||
    binding.projection_schema_references.some(
      (reference) =>
        !["ParameterSet", "ScenarioPackage"].includes(reference.schema_id) ||
        !isNonBlankString(reference.version)
    ) ||
    !schemaIds.includes("ParameterSet") ||
    !schemaIds.includes("ScenarioPackage") ||
    new Set(schemaIds).size !== schemaIds.length
  ) {
    throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_INVALID");
  }

  for (const pluginReference of binding.plugin_release_references) {
    if (
      !isNonBlankString(pluginReference.plugin_package_id) ||
      !isNonBlankString(pluginReference.version)
    ) {
      throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_INVALID");
    }

    const identity = `${pluginReference.plugin_package_id}\u0000${pluginReference.version}`;
    if (pluginIdentities.has(identity)) {
      throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_INVALID");
    }
    pluginIdentities.add(identity);
  }

  try {
    createParameterSetReference(binding.parameter_set_reference);
    createScenarioPackageReference(binding.scenario_package_reference);
  } catch {
    throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_INVALID");
  }

  const expectedDigest = createBindingDigest({
    binding_schema_version: binding.binding_schema_version,
    engine_reference: binding.engine_reference,
    model_version_references: binding.model_version_references,
    parameter_set_reference: binding.parameter_set_reference,
    plugin_release_references: binding.plugin_release_references,
    projection_schema_references: binding.projection_schema_references,
    run_id: binding.run_id,
    scenario_package_reference: binding.scenario_package_reference,
    seed: binding.seed,
    seed_policy: binding.seed_policy,
    tenant_id: binding.tenant_id
  });

  if (expectedDigest !== binding.binding_digest) {
    throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_DIGEST_MISMATCH");
  }
}

function createBindingFromAuthorityRecords(input: {
  engine_reference: FormalRunEngineReference;
  parameter_set: ParameterSetAuthorityBindingRecord;
  run_id: string;
  scenario_package: ScenarioPackageAuthorityBindingRecord;
  seed: number;
  tenant_id: string;
}): FormalRunRuntimeBinding {
  const parameterSetReference = createParameterSetReference(input.parameter_set.reference);
  const scenarioPackageReference = createScenarioPackageReference(input.scenario_package.reference);
  const bindingWithoutDigest = {
    binding_schema_version: FORMAL_RUN_RUNTIME_BINDING_SCHEMA_VERSION,
    engine_reference: clone(input.engine_reference),
    model_version_references: [input.parameter_set.model_version_ref],
    parameter_set_reference: parameterSetReference,
    plugin_release_references: clone(input.scenario_package.plugin_dependencies),
    projection_schema_references: [
      { schema_id: "ParameterSet" as const, version: input.parameter_set.schema_version },
      { schema_id: "ScenarioPackage" as const, version: input.scenario_package.schema_version }
    ],
    run_id: input.run_id,
    scenario_package_reference: scenarioPackageReference,
    seed: input.seed,
    seed_policy: "EXACT_RUN_SEED" as const,
    tenant_id: input.tenant_id
  };

  return deepFreeze({
    ...bindingWithoutDigest,
    binding_digest: createBindingDigest(bindingWithoutDigest)
  });
}

function assertAuthorityRecordsMatchBinding(input: {
  binding: FormalRunRuntimeBinding;
  parameter_set: ParameterSetAuthorityBindingRecord;
  scenario_package: ScenarioPackageAuthorityBindingRecord;
}): void {
  if (
    !sameParameterSetReference(
      input.parameter_set.reference,
      input.binding.parameter_set_reference
    ) ||
    !sameScenarioPackageReference(
      input.scenario_package.reference,
      input.binding.scenario_package_reference
    ) ||
    !sameParameterSetReference(
      input.scenario_package.parameter_set_reference,
      input.binding.parameter_set_reference
    ) ||
    input.parameter_set.tenant_id !== input.binding.tenant_id ||
    input.scenario_package.tenant_id !== input.binding.tenant_id ||
    canonicalize([input.parameter_set.model_version_ref]) !==
      canonicalize(input.binding.model_version_references) ||
    canonicalize(input.scenario_package.plugin_dependencies) !==
      canonicalize(input.binding.plugin_release_references) ||
    canonicalize([
      { schema_id: "ParameterSet", version: input.parameter_set.schema_version },
      { schema_id: "ScenarioPackage", version: input.scenario_package.schema_version }
    ]) !== canonicalize(input.binding.projection_schema_references)
  ) {
    throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_HISTORICAL_REFERENCE_UNAVAILABLE");
  }
}

export async function createFormalRunRuntimeBinding(
  input: CreateFormalRunRuntimeBindingInput
): Promise<FormalRunRuntimeBinding> {
  if (
    !isNonBlankString(input.run_id) ||
    !isNonBlankString(input.tenant_id) ||
    !isSeed(input.seed) ||
    !isNonBlankString(input.engine_reference.engine_id) ||
    !isNonBlankString(input.engine_reference.version) ||
    input.scenario_package_reference.tenant_id !== input.tenant_id
  ) {
    throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_INVALID");
  }

  try {
    await input.authorities.scenarios.assertBindable(
      input.tenant_id,
      input.scenario_package_reference
    );
  } catch {
    throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_SCENARIO_NOT_BINDABLE");
  }

  try {
    await input.authorities.parameterSets.assertBindable(
      input.tenant_id,
      input.parameter_set_reference
    );
  } catch {
    throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_PARAMETER_NOT_BINDABLE");
  }

  const [scenarioPackage, parameterSet] = await Promise.all([
    input.authorities.scenarios.getByReference(input.tenant_id, input.scenario_package_reference),
    input.authorities.parameterSets.getByReference(input.tenant_id, input.parameter_set_reference)
  ]);

  if (!scenarioPackage || scenarioPackage.status !== "APPROVED") {
    throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_SCENARIO_NOT_BINDABLE");
  }

  if (!parameterSet || parameterSet.status !== "APPROVED") {
    throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_PARAMETER_NOT_BINDABLE");
  }

  if (
    scenarioPackage.tenant_id !== input.tenant_id ||
    parameterSet.tenant_id !== input.tenant_id ||
    !sameScenarioPackageReference(scenarioPackage.reference, input.scenario_package_reference) ||
    !sameParameterSetReference(parameterSet.reference, input.parameter_set_reference)
  ) {
    throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_INVALID");
  }

  if (!sameParameterSetReference(scenarioPackage.parameter_set_reference, parameterSet.reference)) {
    throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_PARAMETER_REFERENCE_MISMATCH");
  }

  return createBindingFromAuthorityRecords({
    engine_reference: input.engine_reference,
    parameter_set: parameterSet,
    run_id: input.run_id,
    scenario_package: scenarioPackage,
    seed: input.seed,
    tenant_id: input.tenant_id
  });
}

export async function resolveFormalRunRuntimeBindingForHistoricalRead(input: {
  authorities: FormalRunBindingAuthorityPorts;
  binding: FormalRunRuntimeBinding;
}): Promise<HistoricalFormalRunRuntimeBindingResolution> {
  assertBindingShape(input.binding);

  const [scenarioPackage, parameterSet] = await Promise.all([
    input.authorities.scenarios.getByReference(
      input.binding.tenant_id,
      input.binding.scenario_package_reference
    ),
    input.authorities.parameterSets.getByReference(
      input.binding.tenant_id,
      input.binding.parameter_set_reference
    )
  ]);

  if (
    !scenarioPackage ||
    !parameterSet ||
    !isHistoricallyReadableStatus(scenarioPackage.status) ||
    !isHistoricallyReadableStatus(parameterSet.status)
  ) {
    throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_HISTORICAL_REFERENCE_UNAVAILABLE");
  }

  assertAuthorityRecordsMatchBinding({
    binding: input.binding,
    parameter_set: parameterSet,
    scenario_package: scenarioPackage
  });

  return deepFreeze({
    binding: input.binding,
    parameter_set_status: parameterSet.status,
    scenario_package_status: scenarioPackage.status
  });
}

export function assertRunMatchesFormalRuntimeBinding(
  run: Run,
  binding?: FormalRunRuntimeBinding
): {
  binding: FormalRunRuntimeBinding | null;
  classification: "FORMAL_AUTHORITY_EXACT" | "LEGACY_ID_ONLY";
} {
  if (!binding) {
    return { binding: null, classification: "LEGACY_ID_ONLY" };
  }

  assertBindingShape(binding);
  if (
    binding.run_id !== run.run_id ||
    binding.tenant_id !== run.tenant_id ||
    binding.scenario_package_reference.scenario_package_id !== run.scenario_package_id ||
    binding.parameter_set_reference.parameter_set_id !== run.parameter_set_id ||
    binding.seed !== run.seed
  ) {
    throw new FormalRunRuntimeBindingError("FORMAL_RUN_BINDING_RUN_MISMATCH");
  }

  return { binding, classification: "FORMAL_AUTHORITY_EXACT" };
}
