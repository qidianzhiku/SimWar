import type { CourseBlueprintReference } from "./index.js";
import type {
  CoursePackageVersion,
  CoursePackageVersionDraftInput,
  CoursePackageVersionReference
} from "./course-package-version.js";
import type { ModelArtifactReference, ModelVersionReference } from "./model-governance.js";
import type { ProjectProfileRef } from "./project-library.js";
import type { ParameterSetReference } from "./parameter-set-authority.js";
import type { ScenarioPackageReference } from "./scenario-package-authority.js";

export const COURSE_FACTORY_SCHEMA_VERSION = "course-factory.v1" as const;

export const COURSE_FACTORY_LIFECYCLE_STATES = [
  "DRAFT",
  "VALIDATED",
  "APPROVED",
  "PUBLISHED",
  "SUPERSEDED",
  "RETIRED"
] as const;

export type CourseFactoryLifecycleState = (typeof COURSE_FACTORY_LIFECYCLE_STATES)[number];

export const COURSE_FACTORY_PROVENANCE_KINDS = [
  "ORIGINAL",
  "CLONED",
  "DERIVED",
  "IMPORTED",
  "ROLLBACK"
] as const;

export type CourseFactoryProvenanceKind = (typeof COURSE_FACTORY_PROVENANCE_KINDS)[number];

/** A tenant-scoped exact reference used by the factory manifest. */
export interface CourseFactoryExactReference {
  content_digest: string;
  resource_id: string;
  resource_type:
    | "course_blueprint"
    | "course_package"
    | "model_artifact"
    | "model_version"
    | "parameter_set"
    | "project_profile"
    | "scenario_package";
  tenant_id: string;
  version: string;
}

export interface CourseFactorySourceManifest {
  course_blueprint_reference: CourseBlueprintReference;
  model_artifact_reference?: ModelArtifactReference;
  model_version_reference?: ModelVersionReference;
  parameter_set_reference: ParameterSetReference;
  project_profile_reference?: ProjectProfileRef;
  scenario_package_reference: ScenarioPackageReference;
}

export interface CourseFactoryRights {
  allowed_tenant_ids: readonly string[];
  copy_allowed: boolean;
  export_allowed: boolean;
  expires_at: string | null;
  owner_tenant_id: string;
}

export interface CourseFactoryUserDataPolicy {
  copied_private_data: false;
  copied_user_decisions: false;
  copied_user_results: false;
}

export interface CourseFactoryProvenance {
  kind: CourseFactoryProvenanceKind;
  source_course_package_reference?: CoursePackageVersionReference;
}

export interface CourseFactoryMetadata {
  known_limits: readonly string[];
  provenance: CourseFactoryProvenance;
  rights: CourseFactoryRights;
  schema_version: typeof COURSE_FACTORY_SCHEMA_VERSION;
  source_manifest: CourseFactorySourceManifest;
  user_data_policy: CourseFactoryUserDataPolicy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isExactIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) &&
    !/(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  );
}

function isExactVersion(value: unknown): value is string {
  return isExactIdentity(value) && !/(?:^|[._:-])[xX*](?:$|[._:-])/.test(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isTenantReference(
  value: unknown,
  tenantId: string,
  identityField: string
): boolean {
  if (!isRecord(value)) return false;
  return (
    value.tenant_id === tenantId &&
    isExactIdentity(value[identityField]) &&
    isExactVersion(value.version) &&
    isDigest(value.content_digest)
  );
}

/**
 * Runtime guard for the governed factory extension carried by CoursePackageVersion.
 * It is intentionally shared by persistence, service and delivery boundaries so
 * metadata presence alone can never grant factory lifecycle or delivery authority.
 */
export function isCourseFactoryMetadataForTenant(
  value: unknown,
  tenantId: string
): value is CourseFactoryMetadata {
  if (!isRecord(value) || !isExactIdentity(tenantId)) return false;
  const knownLimits = value.known_limits;
  const provenance = value.provenance;
  const rights = value.rights;
  const sourceManifest = value.source_manifest;
  const userDataPolicy = value.user_data_policy;
  if (
    value.schema_version !== COURSE_FACTORY_SCHEMA_VERSION ||
    !Array.isArray(knownLimits) ||
    knownLimits.length === 0 ||
    knownLimits.some((item) => typeof item !== "string" || item.trim().length === 0) ||
    !isRecord(provenance) ||
    !COURSE_FACTORY_PROVENANCE_KINDS.includes(
      provenance.kind as CourseFactoryProvenanceKind
    ) ||
    !isRecord(rights) ||
    rights.owner_tenant_id !== tenantId ||
    !Array.isArray(rights.allowed_tenant_ids) ||
    rights.allowed_tenant_ids.length === 0 ||
    rights.allowed_tenant_ids.some((item) => !isExactIdentity(item)) ||
    !rights.allowed_tenant_ids.includes(tenantId) ||
    typeof rights.copy_allowed !== "boolean" ||
    typeof rights.export_allowed !== "boolean" ||
    (rights.expires_at !== null && !isIsoTimestamp(rights.expires_at)) ||
    !isRecord(sourceManifest) ||
    !isTenantReference(sourceManifest.course_blueprint_reference, tenantId, "course_blueprint_id") ||
    !isTenantReference(sourceManifest.scenario_package_reference, tenantId, "scenario_package_id") ||
    !isRecord(sourceManifest.parameter_set_reference) ||
    !isExactIdentity(sourceManifest.parameter_set_reference.parameter_set_id) ||
    !isExactVersion(sourceManifest.parameter_set_reference.version) ||
    !isDigest(sourceManifest.parameter_set_reference.content_digest) ||
    (sourceManifest.model_artifact_reference !== undefined &&
      !isRecord(sourceManifest.model_artifact_reference)) ||
    (sourceManifest.model_version_reference !== undefined &&
      !isRecord(sourceManifest.model_version_reference)) ||
    (sourceManifest.project_profile_reference !== undefined &&
      !isRecord(sourceManifest.project_profile_reference)) ||
    !isRecord(userDataPolicy) ||
    userDataPolicy.copied_private_data !== false ||
    userDataPolicy.copied_user_decisions !== false ||
    userDataPolicy.copied_user_results !== false
  ) {
    return false;
  }

  const sourceReference = provenance.source_course_package_reference;
  return (
    sourceReference === undefined ||
    (isRecord(sourceReference) &&
      isExactIdentity(sourceReference.tenant_id) &&
      isExactIdentity(sourceReference.course_package_id) &&
      isExactVersion(sourceReference.version) &&
      isDigest(sourceReference.content_digest))
  );
}

export type CourseFactoryDraftInput = Omit<CoursePackageVersionDraftInput, "factory_metadata"> & {
  factory_metadata: CourseFactoryMetadata;
};

export type CourseFactoryVersion = Omit<CoursePackageVersion, "factory_metadata"> & {
  factory_metadata: CourseFactoryMetadata;
  status: CourseFactoryLifecycleState;
};

export interface CourseFactoryCloneInput {
  course_package_id: string;
  description: string;
  source_course_package_reference: CoursePackageVersionReference;
  title: string;
  version: string;
}

export interface CourseFactoryCatalogEntry {
  course_package_reference: CoursePackageVersionReference;
  description: string;
  factory_metadata: CourseFactoryMetadata;
  status: CourseFactoryLifecycleState;
  title: string;
  version: string;
}

export interface CourseFactoryCatalogProjection {
  catalog: readonly CourseFactoryCatalogEntry[];
  known_limits: readonly string[];
  tenant_id: string;
}

export interface CourseFactoryAuditProjection {
  course_package_reference: CoursePackageVersionReference;
  diff: readonly { field: string; from: unknown; to: unknown }[];
  lineage: readonly CoursePackageVersionReference[];
  lifecycle: readonly CourseFactoryLifecycleState[];
  tenant_id: string;
}

export interface CourseFactoryDeliveryProgress {
  active_runs: number;
  course_count: number;
  published_versions: number;
  round_count: number;
}

export interface CourseFactorySponsorProjection {
  catalog: readonly CourseFactoryCatalogEntry[];
  delivery_progress: CourseFactoryDeliveryProgress;
  evidence_pack: {
    exact_refs_present: boolean;
    private_data_included: false;
    source_digests: readonly string[];
  };
  known_limits: readonly string[];
  tenant_id: string;
}
