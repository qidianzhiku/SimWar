import { createHash } from "node:crypto";
import { resolveSettlementPlugins } from "@simwar/simulation-core";
import type {
  FormalRunRuntimeBinding,
  ParameterSet,
  Run,
  ScenarioPackage
} from "@simwar/shared-contracts";
import {
  assertRunMatchesFormalRuntimeBinding,
  resolveFormalRunRuntimeBindingForHistoricalRead,
  type FormalRunBindingAuthorityPorts,
  type HistoricalFormalRunRuntimeBindingResolution
} from "./formal-run-runtime-binding.js";

export const FORMAL_RUNTIME_INPUT_RESOLUTION_SCHEMA_VERSION =
  "formal-runtime-input-resolution.v1" as const;

const ACTIVE_JSON_RUNTIME_ENGINE = {
  engine_id: "toy_logit_wellness_v1",
  version: "0.1.0"
} as const;

export type FormalRuntimeInputResolutionFailureCode =
  | "FORMAL_RUNTIME_INPUT_ACTIVE_ENGINE_UNSUPPORTED"
  | "FORMAL_RUNTIME_INPUT_ACTIVE_SHAPE_INVALID"
  | "FORMAL_RUNTIME_INPUT_PLUGIN_REFERENCE_MISMATCH"
  | "FORMAL_RUNTIME_INPUT_PLUGIN_UNAVAILABLE";

export class FormalRuntimeInputResolutionError extends Error {
  readonly code: FormalRuntimeInputResolutionFailureCode;

  constructor(code: FormalRuntimeInputResolutionFailureCode) {
    super(code);
    this.code = code;
    this.name = "FormalRuntimeInputResolutionError";
  }
}

export interface FormalRuntimeInputResolution {
  binding: FormalRunRuntimeBinding;
  parameter_set: {
    compatibility_metadata: Readonly<Record<string, string>>;
    model_version_ref: string;
    parameter_set_reference: FormalRunRuntimeBinding["parameter_set_reference"];
    parameter_values: unknown;
    schema_version: string;
  };
  plugin_releases: readonly {
    compatibility_metadata: Readonly<Record<string, string>>;
    plugin_manifest: Readonly<Record<string, unknown>>;
    plugin_release_reference: FormalRunRuntimeBinding["plugin_release_references"][number];
    schema_version: string;
  }[];
  resolution_digest: string;
  resolution_schema_version: typeof FORMAL_RUNTIME_INPUT_RESOLUTION_SCHEMA_VERSION;
  scenario_package: {
    artifact_policy: unknown;
    compatibility_metadata: Readonly<Record<string, string>>;
    content: unknown;
    metadata: Readonly<Record<string, unknown>>;
    parameter_set_reference: FormalRunRuntimeBinding["parameter_set_reference"];
    scenario_package_reference: FormalRunRuntimeBinding["scenario_package_reference"];
    schema_version: string;
  };
}

export interface ResolveFormalRuntimeInputsInput {
  authorities: FormalRunBindingAuthorityPorts;
  binding: FormalRunRuntimeBinding;
}

export interface ResolveFormalRuntimeInputsForActiveRunInput extends ResolveFormalRuntimeInputsInput {
  run: Run;
}

export interface FormalRuntimeInputsForActiveRun {
  binding: FormalRunRuntimeBinding;
  classification: "FORMAL_AUTHORITY_EXACT";
  formal_resolution_digest: string;
  parameterSet: ParameterSet;
  scenario: ScenarioPackage;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("FORMAL_RUNTIME_INPUT_RESOLUTION_INVALID");
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

  throw new Error("FORMAL_RUNTIME_INPUT_RESOLUTION_INVALID");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireNonBlankString(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new FormalRuntimeInputResolutionError("FORMAL_RUNTIME_INPUT_ACTIVE_SHAPE_INVALID");
  }

  return value;
}

function requireFiniteNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new FormalRuntimeInputResolutionError("FORMAL_RUNTIME_INPUT_ACTIVE_SHAPE_INVALID");
  }

  return value;
}

function requireRuntimeRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value[field])) {
    throw new FormalRuntimeInputResolutionError("FORMAL_RUNTIME_INPUT_ACTIVE_SHAPE_INVALID");
  }

  return value[field];
}

function requireExactPluginPackageIds(value: unknown, binding: FormalRunRuntimeBinding): string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    throw new FormalRuntimeInputResolutionError("FORMAL_RUNTIME_INPUT_ACTIVE_SHAPE_INVALID");
  }

  const expected = binding.plugin_release_references.map(
    (reference) => reference.plugin_package_id
  );
  if (
    value.length !== expected.length ||
    value.some((pluginPackageId, index) => pluginPackageId !== expected[index])
  ) {
    throw new FormalRuntimeInputResolutionError("FORMAL_RUNTIME_INPUT_PLUGIN_REFERENCE_MISMATCH");
  }

  return [...value] as string[];
}

function assertExactActivePlugins(
  resolution: FormalRuntimeInputResolution,
  binding: FormalRunRuntimeBinding
): void {
  if (resolution.plugin_releases.length !== binding.plugin_release_references.length) {
    throw new FormalRuntimeInputResolutionError("FORMAL_RUNTIME_INPUT_PLUGIN_REFERENCE_MISMATCH");
  }

  for (const [index, reference] of binding.plugin_release_references.entries()) {
    const pluginRelease = resolution.plugin_releases[index];
    const manifest = pluginRelease?.plugin_manifest;
    if (
      !pluginRelease ||
      pluginRelease.plugin_release_reference.plugin_package_id !== reference.plugin_package_id ||
      pluginRelease.plugin_release_reference.version !== reference.version ||
      pluginRelease.plugin_release_reference.content_digest !== reference.content_digest ||
      manifest?.plugin_id !== reference.plugin_package_id ||
      manifest?.version !== reference.version
    ) {
      throw new FormalRuntimeInputResolutionError("FORMAL_RUNTIME_INPUT_PLUGIN_REFERENCE_MISMATCH");
    }
  }

  const pluginPackageIds = binding.plugin_release_references.map(
    (reference) => reference.plugin_package_id
  );
  if (resolveSettlementPlugins(pluginPackageIds).length !== pluginPackageIds.length) {
    throw new FormalRuntimeInputResolutionError("FORMAL_RUNTIME_INPUT_PLUGIN_UNAVAILABLE");
  }
}

function materializeActiveRuntimeInputs(input: {
  binding: FormalRunRuntimeBinding;
  resolution: FormalRuntimeInputResolution;
}): Pick<FormalRuntimeInputsForActiveRun, "parameterSet" | "scenario"> {
  if (
    input.binding.engine_reference.engine_id !== ACTIVE_JSON_RUNTIME_ENGINE.engine_id ||
    input.binding.engine_reference.version !== ACTIVE_JSON_RUNTIME_ENGINE.version
  ) {
    throw new FormalRuntimeInputResolutionError("FORMAL_RUNTIME_INPUT_ACTIVE_ENGINE_UNSUPPORTED");
  }

  assertExactActivePlugins(input.resolution, input.binding);

  const parameterValues = requireRuntimeRecord(
    input.resolution.parameter_set.parameter_values,
    "runtime_parameter_set"
  );
  const scenarioContent = requireRuntimeRecord(
    input.resolution.scenario_package.content,
    "runtime_scenario_package"
  );
  const modelFamily = requireNonBlankString(parameterValues.model_family);
  if (modelFamily !== "toy_logit") {
    throw new FormalRuntimeInputResolutionError("FORMAL_RUNTIME_INPUT_ACTIVE_SHAPE_INVALID");
  }

  const parameterSet: ParameterSet = {
    base_capacity: requireFiniteNumber(parameterValues.base_capacity),
    base_market_size: requireFiniteNumber(parameterValues.base_market_size),
    fixed_cost: requireFiniteNumber(parameterValues.fixed_cost),
    model_family: "toy_logit",
    parameter_set_id: input.binding.parameter_set_reference.parameter_set_id,
    seed: input.binding.seed,
    status: "approved",
    tenant_id: input.binding.tenant_id,
    unit_cost: requireFiniteNumber(parameterValues.unit_cost),
    version: input.binding.parameter_set_reference.version
  };
  const scenario: ScenarioPackage = {
    name: requireNonBlankString(scenarioContent.name),
    plugin_package_ids: requireExactPluginPackageIds(
      scenarioContent.plugin_package_ids,
      input.binding
    ),
    scenario_package_id: input.binding.scenario_package_reference.scenario_package_id,
    status: "approved",
    tenant_id: input.binding.tenant_id,
    version: input.binding.scenario_package_reference.version
  };

  return { parameterSet, scenario };
}

function materializeExactInputs(
  resolution: HistoricalFormalRunRuntimeBindingResolution
): Omit<FormalRuntimeInputResolution, "resolution_digest"> {
  return {
    binding: clone(resolution.binding),
    parameter_set: {
      compatibility_metadata: clone(resolution.parameter_set.compatibility_metadata),
      model_version_ref: resolution.parameter_set.model_version_ref,
      parameter_set_reference: clone(resolution.parameter_set.reference),
      parameter_values: clone(resolution.parameter_set.parameter_values),
      schema_version: resolution.parameter_set.schema_version
    },
    plugin_releases: resolution.plugin_releases.map((pluginRelease) => ({
      compatibility_metadata: clone(pluginRelease.compatibility_metadata),
      plugin_manifest: clone(pluginRelease.plugin_manifest) as Readonly<Record<string, unknown>>,
      plugin_release_reference: clone(pluginRelease.reference),
      schema_version: pluginRelease.schema_version
    })),
    resolution_schema_version: FORMAL_RUNTIME_INPUT_RESOLUTION_SCHEMA_VERSION,
    scenario_package: {
      artifact_policy: clone(resolution.scenario_package.artifact_policy),
      compatibility_metadata: clone(resolution.scenario_package.compatibility_metadata),
      content: clone(resolution.scenario_package.content),
      metadata: clone(resolution.scenario_package.metadata),
      parameter_set_reference: clone(resolution.scenario_package.parameter_set_reference),
      scenario_package_reference: clone(resolution.scenario_package.reference),
      schema_version: resolution.scenario_package.schema_version
    }
  };
}

export function calculateFormalRuntimeInputResolutionDigest(
  input: Omit<FormalRuntimeInputResolution, "resolution_digest">
): string {
  return createHash("sha256").update(canonicalize(input), "utf8").digest("hex");
}

/**
 * Resolves only exact, digest-addressed authority inputs from a frozen binding.
 * It intentionally returns data without composing the active JSON Run runtime,
 * routes, settlement, replay, or any persistent runtime adapter.
 */
export async function resolveFormalRuntimeInputsForHistoricalRead(
  input: ResolveFormalRuntimeInputsInput
): Promise<FormalRuntimeInputResolution> {
  const historical = await resolveFormalRunRuntimeBindingForHistoricalRead(input);
  const materialized = materializeExactInputs(historical);

  return deepFreeze({
    ...materialized,
    resolution_digest: calculateFormalRuntimeInputResolutionDigest(materialized)
  });
}

/**
 * The active JSON runtime accepts only the explicitly shaped authority content
 * below. It has no fallback to the legacy JSON ScenarioPackage or ParameterSet
 * collections, so an incomplete formal record cannot silently change truth
 * inputs during settlement or Replay.
 */
export async function resolveFormalRuntimeInputsForActiveRun(
  input: ResolveFormalRuntimeInputsForActiveRunInput
): Promise<FormalRuntimeInputsForActiveRun> {
  const runBinding = assertRunMatchesFormalRuntimeBinding(input.run, input.binding);
  if (runBinding.classification !== "FORMAL_AUTHORITY_EXACT") {
    throw new FormalRuntimeInputResolutionError("FORMAL_RUNTIME_INPUT_ACTIVE_SHAPE_INVALID");
  }
  const resolution = await resolveFormalRuntimeInputsForHistoricalRead(input);
  const runtimeInputs = materializeActiveRuntimeInputs({
    binding: input.binding,
    resolution
  });

  return deepFreeze({
    binding: clone(input.binding),
    classification: runBinding.classification,
    formal_resolution_digest: resolution.resolution_digest,
    parameterSet: runtimeInputs.parameterSet,
    scenario: runtimeInputs.scenario
  });
}
