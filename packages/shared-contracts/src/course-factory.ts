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
