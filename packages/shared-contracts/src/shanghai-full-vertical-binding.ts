import type { ParameterSetReference } from "./parameter-set-authority.js";
import type { PluginReleaseReference } from "./plugin-release-authority.js";
import type { ScenarioPackageReference } from "./scenario-package-authority.js";

export const SHANGHAI_FULL_VERTICAL_BINDING_SCHEMA_VERSION =
  "shanghai-full-vertical-binding.v1" as const;

export const SHANGHAI_FULL_VERTICAL_BINDING_ISSUES = [
  "TENANT_SCOPE_MISMATCH",
  "COURSE_SCOPE_MISMATCH",
  "SCENARIO_PACKAGE_ID_MISMATCH",
  "SCENARIO_PACKAGE_VERSION_MISMATCH",
  "PARAMETER_SET_ID_MISMATCH",
  "PARAMETER_SET_VERSION_MISMATCH",
  "PARAMETER_SET_SEED_MISMATCH",
  "PLUGIN_PACKAGE_IDS_MISMATCH",
  "PLUGIN_VERSION_MISMATCH"
] as const;

export type ShanghaiFullVerticalBindingIssue =
  (typeof SHANGHAI_FULL_VERTICAL_BINDING_ISSUES)[number];

/**
 * Identity emitted by a Shanghai R7C candidate. This is metadata only: it
 * does not contain a ScenarioPackage, ParameterSet, plugin artifact, or any
 * simulation truth field.
 */
export interface ShanghaiFullVerticalCandidateIdentityV1 {
  compiler_version: string;
  course_id: string;
  parameter_set_id: string;
  parameter_set_seed: number;
  parameter_set_version: string;
  plugin_package_ids: readonly string[];
  plugin_version: string;
  scenario_family_version: string;
  scenario_package_id: string;
  scenario_package_version: string;
  scenario_version: string;
  tenant_id: string;
}

/** Exact formal references supplied by the authority-facing caller. */
export interface ShanghaiFullVerticalFormalReferencesV1 {
  course_id: string;
  parameter_set: ParameterSetReference;
  parameter_set_seed: number;
  plugin_releases: readonly PluginReleaseReference[];
  scenario_package: ScenarioPackageReference;
  tenant_id: string;
}

export interface ShanghaiFullVerticalBindingValidationV1 {
  issues: ShanghaiFullVerticalBindingIssue[];
  ok: boolean;
}

/**
 * Candidate-to-authority identity matching is deliberately exact and
 * fail-closed. Content digests remain reference-only here because this pure
 * contract does not have authority artifact bytes to rehash.
 */
export interface ShanghaiFullVerticalBindingEvidenceV1 {
  candidate: ShanghaiFullVerticalCandidateIdentityV1;
  digest_status: "REFERENCE_ONLY_NOT_REHASHED";
  formal_references: ShanghaiFullVerticalFormalReferencesV1;
  formal_truth_write: false;
  parameter_set_write: false;
  runtime_activation: false;
  schema_version: typeof SHANGHAI_FULL_VERTICAL_BINDING_SCHEMA_VERSION;
  settlement_write: false;
  status: "BOUND";
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function candidatePluginVersion(pluginVersion: string): string {
  const separator = pluginVersion.lastIndexOf("@");
  return separator < 0 ? pluginVersion : pluginVersion.slice(separator + 1);
}

export function validateShanghaiFullVerticalBindingV1(input: {
  candidate: ShanghaiFullVerticalCandidateIdentityV1;
  formal: ShanghaiFullVerticalFormalReferencesV1;
}): ShanghaiFullVerticalBindingValidationV1 {
  const issues: ShanghaiFullVerticalBindingIssue[] = [];
  const formalPluginIds = input.formal.plugin_releases.map((release) => release.plugin_package_id);

  if (
    input.candidate.tenant_id !== input.formal.tenant_id ||
    input.candidate.tenant_id !== input.formal.scenario_package.tenant_id
  ) {
    issues.push("TENANT_SCOPE_MISMATCH");
  }
  if (input.candidate.course_id !== input.formal.course_id) {
    issues.push("COURSE_SCOPE_MISMATCH");
  }
  if (input.candidate.scenario_package_id !== input.formal.scenario_package.scenario_package_id) {
    issues.push("SCENARIO_PACKAGE_ID_MISMATCH");
  }
  if (input.candidate.scenario_package_version !== input.formal.scenario_package.version) {
    issues.push("SCENARIO_PACKAGE_VERSION_MISMATCH");
  }
  if (input.candidate.parameter_set_id !== input.formal.parameter_set.parameter_set_id) {
    issues.push("PARAMETER_SET_ID_MISMATCH");
  }
  if (input.candidate.parameter_set_version !== input.formal.parameter_set.version) {
    issues.push("PARAMETER_SET_VERSION_MISMATCH");
  }
  if (input.candidate.parameter_set_seed !== input.formal.parameter_set_seed) {
    issues.push("PARAMETER_SET_SEED_MISMATCH");
  }
  const pluginIdsMatch = sameStringArray(input.candidate.plugin_package_ids, formalPluginIds);
  if (!pluginIdsMatch) {
    issues.push("PLUGIN_PACKAGE_IDS_MISMATCH");
  }
  if (
    pluginIdsMatch &&
    (input.formal.plugin_releases.length !== 1 ||
      candidatePluginVersion(input.candidate.plugin_version) !==
        input.formal.plugin_releases[0]?.version)
  ) {
    issues.push("PLUGIN_VERSION_MISMATCH");
  }

  return { issues, ok: issues.length === 0 };
}

export function createShanghaiFullVerticalBindingEvidenceV1(input: {
  candidate: ShanghaiFullVerticalCandidateIdentityV1;
  formal: ShanghaiFullVerticalFormalReferencesV1;
}): ShanghaiFullVerticalBindingEvidenceV1 {
  const validation = validateShanghaiFullVerticalBindingV1(input);
  if (!validation.ok) {
    throw new Error(`SHANGHAI_FULL_VERTICAL_BINDING_INVALID:${validation.issues.join(",")}`);
  }

  return {
    candidate: {
      ...input.candidate,
      plugin_package_ids: [...input.candidate.plugin_package_ids]
    },
    digest_status: "REFERENCE_ONLY_NOT_REHASHED",
    formal_references: {
      ...input.formal,
      plugin_releases: [...input.formal.plugin_releases]
    },
    formal_truth_write: false,
    parameter_set_write: false,
    runtime_activation: false,
    schema_version: SHANGHAI_FULL_VERTICAL_BINDING_SCHEMA_VERSION,
    settlement_write: false,
    status: "BOUND"
  };
}
