import { createHash } from "node:crypto";
import type { FormalRunRuntimeBinding } from "@simwar/shared-contracts";
import {
  resolveFormalRunRuntimeBindingForHistoricalRead,
  type FormalRunBindingAuthorityPorts,
  type HistoricalFormalRunRuntimeBindingResolution
} from "./formal-run-runtime-binding";

export const FORMAL_RUNTIME_INPUT_RESOLUTION_SCHEMA_VERSION =
  "formal-runtime-input-resolution.v1" as const;

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
