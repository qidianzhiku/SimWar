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

/**
 * Exact, candidate-only evidence carried from the SH M29 support pack into
 * the MAIN-owned CourseFactory. This reference is provenance, never a formal
 * ParameterSet, Truth, Settlement, Score, or Rank authority.
 */
export interface CourseFactorySourceEvidenceReference {
  schema_version: "course-factory-source-evidence.v1";
  binding_request_id: "SH-M29-MAIN-PULL-BINDING-REQUEST";
  source_epoch: {
    epoch_id: string;
    epoch_digest: string;
    source_epoch_base_sha: string;
  };
  regional_transfer: {
    transfer_id: string;
    pack_digest: string;
    candidate_version: string;
  };
  living_operations: {
    pack_digest: string;
    epoch_id: string;
    epoch_version: string;
    expires_at: string;
  };
  baseline_region: "Shanghai";
  target_region: "Hangzhou";
  source_reality_class: "PUBLIC_SOURCE_BOUND";
  rights_status: "PUBLIC_REFERENCE_ONLY";
  qualification_status: "LIMITED";
  calibration_evidence: "NOT_PROVEN";
  formal_binding_eligible: false;
  consumption_status: "LOOKAHEAD_READY";
  exact_binding_required: true;
  required_rechecks: readonly string[];
  exact_source_refs: readonly string[];
  m29_pack_digest: string;
  evidence_digest: string;
}

export interface CourseFactoryStudentEvidenceProjection {
  target_region: "Hangzhou";
  epoch_version: string;
  qualification_status: "LIMITED";
  consumption_status: "LOOKAHEAD_READY";
  exact_binding_required: true;
}

export interface CourseFactoryMetadata {
  known_limits: readonly string[];
  provenance: CourseFactoryProvenance;
  rights: CourseFactoryRights;
  schema_version: typeof COURSE_FACTORY_SCHEMA_VERSION;
  source_manifest: CourseFactorySourceManifest;
  source_evidence_reference?: CourseFactorySourceEvidenceReference;
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
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  ) {
    return false;
  }
  const parsed = new Date(value);
  const canonical = value.includes(".") ? value : value.replace("Z", ".000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === canonical;
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isTenantReference(value: unknown, tenantId: string, identityField: string): boolean {
  if (!isRecord(value)) return false;
  return (
    hasExactKeys(value, ["content_digest", identityField, "tenant_id", "version"]) &&
    value.tenant_id === tenantId &&
    isExactIdentity(value[identityField]) &&
    isExactVersion(value.version) &&
    isDigest(value.content_digest)
  );
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function hasExactKeys(value: unknown, keys: readonly string[]): boolean {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function hasExactKeysWithOptional(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[]
): boolean {
  if (!isRecord(value)) return false;
  const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
  const actualKeys = Object.keys(value);
  return (
    requiredKeys.every((key) => actualKeys.includes(key)) &&
    actualKeys.every((key) => allowedKeys.has(key))
  );

}

function isModelArtifactReference(value: unknown): value is ModelArtifactReference {
  if (!isRecord(value)) return false;
  return (
    hasExactKeys(value, ["artifact_id", "content_digest", "format", "source_ref"]) &&
    isExactIdentity(value.artifact_id) &&
    isDigest(value.content_digest) &&
    isNonEmptyText(value.format) &&
    isNonEmptyText(value.source_ref)
  );
}

function isModelVersionReference(value: unknown): value is ModelVersionReference {
  if (!isRecord(value)) return false;
  return (
    hasExactKeys(value, ["content_digest", "model_version_id", "version"]) &&
    isExactIdentity(value.model_version_id) &&
    isExactVersion(value.version) &&
    isDigest(value.content_digest)
  );
}

/**
 * Runtime guard for the governed factory extension carried by CoursePackageVersion.
 * It is intentionally shared by persistence, service and delivery boundaries so
 * metadata presence alone can never grant factory lifecycle or delivery authority.
 */
/** Structural boundary guard for the optional M30 source evidence extension. */
export function isCourseFactorySourceEvidenceReference(
  value: unknown
): value is CourseFactorySourceEvidenceReference {
  if (!isRecord(value)) return false;
  const sourceEpoch = value.source_epoch;
  const transfer = value.regional_transfer;
  const living = value.living_operations;
  return (
    hasExactKeys(value, [
      "schema_version",
      "binding_request_id",
      "source_epoch",
      "regional_transfer",
      "living_operations",
      "baseline_region",
      "target_region",
      "source_reality_class",
      "rights_status",
      "qualification_status",
      "calibration_evidence",
      "formal_binding_eligible",
      "consumption_status",
      "exact_binding_required",
      "required_rechecks",
      "exact_source_refs",
      "m29_pack_digest",
      "evidence_digest"
    ]) &&
    hasExactKeys(sourceEpoch, ["epoch_id", "epoch_digest", "source_epoch_base_sha"]) &&
    hasExactKeys(transfer, ["transfer_id", "pack_digest", "candidate_version"]) &&
    hasExactKeys(living, ["pack_digest", "epoch_id", "epoch_version", "expires_at"]) &&
    value.schema_version === "course-factory-source-evidence.v1" &&
    value.binding_request_id === "SH-M29-MAIN-PULL-BINDING-REQUEST" &&
    isRecord(sourceEpoch) &&
    hasExactKeys(sourceEpoch, ["epoch_digest", "epoch_id", "source_epoch_base_sha"]) &&
    isExactIdentity(sourceEpoch.epoch_id) &&
    isDigest(sourceEpoch.epoch_digest) &&
    typeof sourceEpoch.source_epoch_base_sha === "string" &&
    /^[a-f0-9]{40}$/.test(sourceEpoch.source_epoch_base_sha) &&
    isRecord(transfer) &&
    hasExactKeys(transfer, ["candidate_version", "pack_digest", "transfer_id"]) &&
    isExactIdentity(transfer.transfer_id) &&
    isDigest(transfer.pack_digest) &&
    isExactVersion(transfer.candidate_version) &&
    isRecord(living) &&
    hasExactKeys(living, ["epoch_id", "epoch_version", "expires_at", "pack_digest"]) &&
    isDigest(living.pack_digest) &&
    isExactIdentity(living.epoch_id) &&
    isExactVersion(living.epoch_version) &&
    isDateOnly(living.expires_at) &&
    value.baseline_region === "Shanghai" &&
    value.target_region === "Hangzhou" &&
    value.source_reality_class === "PUBLIC_SOURCE_BOUND" &&
    value.rights_status === "PUBLIC_REFERENCE_ONLY" &&
    value.qualification_status === "LIMITED" &&
    value.calibration_evidence === "NOT_PROVEN" &&
    value.formal_binding_eligible === false &&
    value.consumption_status === "LOOKAHEAD_READY" &&
    value.exact_binding_required === true &&
    Array.isArray(value.required_rechecks) &&
    value.required_rechecks.length > 0 &&
    value.required_rechecks.every((item) => typeof item === "string" && item.trim().length > 0) &&
    Array.isArray(value.exact_source_refs) &&
    value.exact_source_refs.length > 0 &&
    value.exact_source_refs.every((item) => typeof item === "string" && item.trim().length > 0) &&
    isDigest(value.m29_pack_digest) &&
    isDigest(value.evidence_digest)
  );
}

export function isCourseFactoryMetadataForTenant(
  value: unknown,
  tenantId: string
): value is CourseFactoryMetadata {
  if (!isRecord(value) || !isExactIdentity(tenantId)) return false;
  if (
    !hasExactKeysWithOptional(
      value,
      [
        "known_limits",
        "provenance",
        "rights",
        "schema_version",
        "source_manifest",
        "user_data_policy"
      ],
      ["source_evidence_reference"]
    )
  ) {
    return false;
  }
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
    !hasExactKeysWithOptional(provenance, ["kind"], ["source_course_package_reference"]) ||
    !hasExactKeysWithOptional(provenance, ["kind"], ["source_course_package_reference"]) ||
    !COURSE_FACTORY_PROVENANCE_KINDS.includes(provenance.kind as CourseFactoryProvenanceKind) ||
    !isRecord(rights) ||
    !hasExactKeys(rights, [
      "allowed_tenant_ids",
      "copy_allowed",
      "export_allowed",
      "expires_at",
      "owner_tenant_id"
    ]) ||
    rights.owner_tenant_id !== tenantId ||
    !Array.isArray(rights.allowed_tenant_ids) ||
    rights.allowed_tenant_ids.length === 0 ||
    rights.allowed_tenant_ids.some((item) => !isExactIdentity(item)) ||
    !rights.allowed_tenant_ids.includes(tenantId) ||
    typeof rights.copy_allowed !== "boolean" ||
    typeof rights.export_allowed !== "boolean" ||
    (rights.expires_at !== null && !isIsoTimestamp(rights.expires_at)) ||
    !isRecord(sourceManifest) ||
    !hasExactKeysWithOptional(
      sourceManifest,
      ["course_blueprint_reference", "parameter_set_reference", "scenario_package_reference"],
      ["model_artifact_reference", "model_version_reference", "project_profile_reference"]
    ) ||
    !isTenantReference(
      sourceManifest.course_blueprint_reference,
      tenantId,
      "course_blueprint_id"
    ) ||
    !isTenantReference(
      sourceManifest.scenario_package_reference,
      tenantId,
      "scenario_package_id"
    ) ||
    !isRecord(sourceManifest.parameter_set_reference) ||
    !hasExactKeys(sourceManifest.parameter_set_reference, [
      "content_digest",
      "parameter_set_id",
      "version"
    ]) ||
    !isExactIdentity(sourceManifest.parameter_set_reference.parameter_set_id) ||
    !isExactVersion(sourceManifest.parameter_set_reference.version) ||
    !isDigest(sourceManifest.parameter_set_reference.content_digest) ||
    (sourceManifest.model_artifact_reference !== undefined &&
      !isModelArtifactReference(sourceManifest.model_artifact_reference)) ||
    (sourceManifest.model_version_reference !== undefined &&
      !isModelVersionReference(sourceManifest.model_version_reference)) ||
    (sourceManifest.project_profile_reference !== undefined &&
      !isTenantReference(
        sourceManifest.project_profile_reference,
        tenantId,
        "project_profile_id"
      )) ||
    !isRecord(userDataPolicy) ||
    !hasExactKeys(userDataPolicy, [
      "copied_private_data",
      "copied_user_decisions",
      "copied_user_results"
    ]) ||
    userDataPolicy.copied_private_data !== false ||
    userDataPolicy.copied_user_decisions !== false ||
    userDataPolicy.copied_user_results !== false ||
    (value.source_evidence_reference !== undefined &&
      !isCourseFactorySourceEvidenceReference(value.source_evidence_reference))
  ) {
    return false;
  }

  const sourceReference = provenance.source_course_package_reference;
  if (provenance.kind === "ORIGINAL" && sourceReference !== undefined) return false;
  return (
    sourceReference === undefined ||
    (isRecord(sourceReference) &&
      hasExactKeys(sourceReference, [
        "content_digest",
        "course_package_id",
        "tenant_id",
        "version"
      ]) &&
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

export interface CourseFactoryTeacherSourceContext {
  target_region: string;
  epoch_version: string;
  qualification_status: "LIMITED";
  consumption_status: "LOOKAHEAD_READY";
  exact_binding_required: true;
  known_limits: readonly string[];
  source_reference_versions: {
    course_blueprint: string;
    scenario_package: string;
    parameter_set: string;
  };
}

/** Teacher catalog entry intentionally excludes factory metadata and raw evidence. */
export interface CourseFactoryTeacherCatalogEntry {
  course_package_reference: CoursePackageVersionReference;
  description: string;
  status: CourseFactoryLifecycleState;
  title: string;
  version: string;
  source_context?: CourseFactoryTeacherSourceContext;
}

export interface CourseFactoryTeacherCatalogProjection {
  catalog: readonly CourseFactoryTeacherCatalogEntry[];
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

/** Sponsor-safe catalog omits factory metadata, source digests, and lifecycle lineage. */
export interface CourseFactorySponsorCatalogEntry {
  course_package_reference: CoursePackageVersionReference;
  status: CourseFactoryLifecycleState;
  title: string;
  version: string;
  source_context?: CourseFactoryStudentEvidenceProjection;
}

export interface CourseFactorySponsorProjection {
  catalog: readonly CourseFactorySponsorCatalogEntry[];
  delivery_progress: CourseFactoryDeliveryProgress;
  evidence_pack: {
    exact_refs_present: boolean;
    private_data_included: false;
    source_evidence_count: number;
  };
  known_limits: readonly string[];
  tenant_id: string;
}
