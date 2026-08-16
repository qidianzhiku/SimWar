import type { ParameterSetReference } from "./parameter-set-authority.js";
import type { PluginReleaseReference } from "./plugin-release-authority.js";
import type { ScenarioPackageReference } from "./scenario-package-authority.js";

export const FORMAL_RUN_RUNTIME_BINDING_SCHEMA_VERSION = "formal-run-runtime-binding.v1" as const;

export interface FormalRunEngineReference {
  engine_id: string;
  version: string;
}

export type FormalRunPluginReleaseReference = PluginReleaseReference;

export interface FormalRunProjectionSchemaReference {
  schema_id: "ParameterSet" | "ScenarioPackage";
  version: string;
}

export type DecisionAdmissionPolicy = "ROLE_WORKFLOW_REQUIRED" | "LEGACY_DIRECT_EXPLICIT";

/**
 * Exact formal-authority inputs frozen for one Run. This is deliberately
 * separate from legacy ID-only Run fields so callers cannot mistake an ID
 * lookup for a formal Authority binding.
 */
export interface FormalRunRuntimeBinding {
  binding_digest: string;
  binding_schema_version: typeof FORMAL_RUN_RUNTIME_BINDING_SCHEMA_VERSION;
  /**
   * New bindings carry the immutable formal admission policy. It is optional
   * only so historical v1 bindings remain readable; a missing value is
   * UNKNOWN for new mutation and must never authorize Legacy admission.
   */
  decision_admission_policy?: DecisionAdmissionPolicy;
  engine_reference: Readonly<FormalRunEngineReference>;
  model_version_references: readonly string[];
  parameter_set_reference: Readonly<ParameterSetReference>;
  plugin_release_references: readonly Readonly<FormalRunPluginReleaseReference>[];
  projection_schema_references: readonly Readonly<FormalRunProjectionSchemaReference>[];
  run_id: string;
  scenario_package_reference: Readonly<ScenarioPackageReference>;
  seed: number;
  seed_policy: "EXACT_RUN_SEED";
  tenant_id: string;
}
