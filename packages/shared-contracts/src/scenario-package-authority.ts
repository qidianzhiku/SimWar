import type { ParameterSetReference } from "./parameter-set-authority.js";

export const SCENARIO_PACKAGE_AUTHORITY_FAILURE_CODES = [
  "NOT_FOUND",
  "TENANT_SCOPE_VIOLATION",
  "NOT_APPROVED",
  "DIGEST_MISMATCH",
  "RETIRED_FOR_NEW_BINDING"
] as const;

export type ScenarioPackageAuthorityFailureCode =
  (typeof SCENARIO_PACKAGE_AUTHORITY_FAILURE_CODES)[number];

export interface ScenarioPackageReference {
  content_digest: string;
  scenario_package_id: string;
  tenant_id: string;
  version: string;
}

export interface ScenarioPackageReferenceInput {
  content_digest: string;
  scenario_package_id: string;
  tenant_id: string;
  version: string;
}

export interface ScenarioPackageAuthorityArtifactPolicyProjection {
  artifact_digest?: string;
  artifact_media_type?: string;
  artifact_reference?: string;
  mode: "INLINE" | "IMMUTABLE_REFERENCE";
  retention: "IMMUTABLE";
}

export interface ScenarioPackageAuthorityPluginDependencyProjection {
  plugin_package_id: string;
  version: string;
}

export interface ScenarioPackageAuthorityReadProjection {
  artifact_policy: Readonly<ScenarioPackageAuthorityArtifactPolicyProjection>;
  compatibility_metadata: Readonly<Record<string, string>>;
  content_digest: string;
  parameter_set_reference: ParameterSetReference;
  plugin_dependencies: readonly Readonly<ScenarioPackageAuthorityPluginDependencyProjection>[];
  reference: ScenarioPackageReference;
  scenario_package_id: string;
  schema_version: string;
  status: "APPROVED";
  tenant_id: string;
  version: string;
}

export interface ScenarioPackageAuthorityReadPort {
  assertBindable(tenantId: string, reference: ScenarioPackageReference): Promise<void>;
  getByReference(tenantId: string, reference: ScenarioPackageReference): Promise<unknown | null>;
  listApprovedForTenant(tenantId: string): Promise<ScenarioPackageAuthorityReadProjection[]>;
}

export class ScenarioPackageAuthorityError extends Error {
  readonly code: ScenarioPackageAuthorityFailureCode | "SCENARIO_PACKAGE_REFERENCE_INVALID";

  constructor(code: ScenarioPackageAuthorityFailureCode | "SCENARIO_PACKAGE_REFERENCE_INVALID") {
    super(code);
    this.code = code;
    this.name = "ScenarioPackageAuthorityError";
  }
}

function isNonBlankString(value: string): boolean {
  return value.trim().length > 0;
}

export function isExactVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
    value
  );
}

function isDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export function createScenarioPackageReference(
  input: ScenarioPackageReferenceInput
): ScenarioPackageReference {
  if (
    !isNonBlankString(input.scenario_package_id) ||
    !isNonBlankString(input.tenant_id) ||
    !isExactVersion(input.version) ||
    !isDigest(input.content_digest)
  ) {
    throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_REFERENCE_INVALID");
  }

  return Object.freeze({
    content_digest: input.content_digest,
    scenario_package_id: input.scenario_package_id,
    tenant_id: input.tenant_id,
    version: input.version
  });
}
