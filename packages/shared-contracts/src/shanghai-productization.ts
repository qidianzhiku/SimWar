import type { ParameterSetReference } from "./parameter-set-authority.js";
import type { ScenarioPackageReference } from "./scenario-package-authority.js";
import type { ModelVersionReference } from "./model-governance.js";

/** Generic candidate contracts for the M7–M12 productization spine. */
export const SHANGHAI_PRODUCTIZATION_SCHEMA_VERSION = "scenario-productization.v1" as const;

export const PRODUCTIZATION_NO_IMPLICIT_LATEST = true as const;

export const PRODUCTIZATION_FORMAL_WRITER_BOUNDARY = {
  scenario: "MAIN_SCENARIO_PACKAGE_AUTHORITY",
  model: "MAIN_MODEL_GOVERNANCE",
  course: "MAIN_COURSE_PACKAGE_AUTHORITY",
  portfolio: "MAIN_PRODUCT_RELEASE_AUTHORITY"
} as const;

export type ProductizationRole = "TEACHER" | "ADMIN" | "STUDENT";
export type ExperienceProfile = "STANDARD" | "ADVANCED";
export type ConsumerReadiness = "C1_NAMED_FORWARD" | "C2_PLATFORM_REUSE";

export interface ProductizationSourceMetadata {
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  geography: string;
  provenance: "PRIMARY" | "SECONDARY" | "SYNTHETIC" | "INTERNAL" | "UNKNOWN";
  sensitivity: "PUBLIC_SAFE" | "INTERNAL_ONLY" | "RESTRICTED";
  source_date: string;
  source_ref: string;
  source_type: "OFFICIAL" | "RESEARCH" | "PROJECT" | "SYNTHETIC" | "UNKNOWN";
  time_scope: string;
  usage_status: "APPROVED" | "REVIEW_REQUIRED" | "UNKNOWN";
}

export interface ScenarioQualificationBadge {
  calibrated: false;
  evidence_refs: readonly string[];
  status: "ELIGIBLE" | "NOT_ELIGIBLE" | "STALE" | "UNKNOWN";
  reason: string;
}

export interface ScenarioRightsExpiry {
  copy_allowed: boolean;
  expires_at: string | null;
  fork_allowed: boolean;
  license_status: "VALID" | "EXPIRED" | "WITHDRAWN" | "UNKNOWN";
  territory: string;
}

export interface ScenarioFreshness {
  collected_at: string | null;
  expires_at: string | null;
  status: "FRESH" | "STALE" | "UNKNOWN";
}

export interface ScenarioCompatibilitySummary {
  engine_id: string;
  status: "COMPATIBLE" | "INCOMPATIBLE" | "UNKNOWN";
  supported_profiles: readonly ExperienceProfile[];
  required_schema_version: string;
}

export interface ScenarioCatalogEntry {
  catalog_entry_id: string;
  compatibility: ScenarioCompatibilitySummary;
  consumer_readiness: ConsumerReadiness;
  experience_profiles: readonly ExperienceProfile[];
  freshness: ScenarioFreshness;
  geography: string;
  known_limits: readonly string[];
  qualification: ScenarioQualificationBadge;
  rights: ScenarioRightsExpiry;
  scenario_reference: ScenarioPackageReference;
  schema_version: typeof SHANGHAI_PRODUCTIZATION_SCHEMA_VERSION;
  source: ProductizationSourceMetadata;
  tenant_id: string;
  theme: string;
  title: string;
}

export interface ScenarioCatalogQuery {
  compatibility_status?: ScenarioCompatibilitySummary["status"];
  experience_profile?: ExperienceProfile;
  geography?: string;
  qualification_status?: ScenarioQualificationBadge["status"];
  query?: string;
  rights_status?: ScenarioRightsExpiry["license_status"];
  freshness_status?: ScenarioFreshness["status"];
}

export interface ScenarioCatalogSelectionRequest {
  catalog_entry_id: string;
  expected_reference: ScenarioPackageReference;
  selected_by: string;
  selected_at: string;
  tenant_id: string;
}

export interface ScenarioCatalogSelectionReceipt {
  catalog_entry_id: string;
  consumer_readiness: ConsumerReadiness;
  formal_binding: false;
  no_implicit_latest: true;
  selected_at: string;
  selected_by: string;
  selected_reference: ScenarioPackageReference;
  selection_id: string;
  tenant_id: string;
}

export interface ScenarioCatalog {
  entries: readonly ScenarioCatalogEntry[];
  no_implicit_latest: true;
  schema_version: typeof SHANGHAI_PRODUCTIZATION_SCHEMA_VERSION;
  tenant_id: string;
}

export interface TeacherAdminScenarioCatalogProjection {
  entries: readonly ScenarioCatalogEntry[];
  role: "TEACHER" | "ADMIN";
  tenant_id: string;
}

export interface StudentScenarioCatalogProjection {
  entries: readonly {
    catalog_entry_id: string;
    experience_profiles: readonly ExperienceProfile[];
    geography: string;
    known_limits: readonly string[];
    qualification_status: ScenarioQualificationBadge["status"];
    scenario_package_id: string;
    theme: string;
    title: string;
    version: string;
  }[];
  role: "STUDENT";
  tenant_id: string;
}

export interface ScenarioEditableAssets {
  bundle_refs: readonly string[];
  cohort_refs: readonly string[];
  geo_refs: readonly string[];
  policy_refs: readonly string[];
  project_refs: readonly string[];
  teaching_refs: readonly string[];
}

export interface ScenarioAuthoringDraft {
  base_reference: ScenarioPackageReference;
  content_digest: string;
  created_by: string;
  draft_id: string;
  editable_assets: ScenarioEditableAssets;
  formal_activation: false;
  known_limits: readonly string[];
  lineage: {
    parent_draft_id: string | null;
    root_reference: ScenarioPackageReference;
  };
  no_implicit_latest: true;
  schema_version: typeof SHANGHAI_PRODUCTIZATION_SCHEMA_VERSION;
  source_admission: ScenarioAuthoringSourceAdmission;
  status: "DRAFT" | "FROZEN_CANDIDATE";
  tenant_id: string;
}

export interface ScenarioAuthoringSourceAdmission {
  catalog_entry_id: string;
  expires_at: string | null;
  fork_allowed: boolean;
  freshness_status: ScenarioFreshness["status"];
  license_status: ScenarioRightsExpiry["license_status"];
  qualification_status: ScenarioQualificationBadge["status"];
  source_owner: "SH";
}

export interface ScenarioAuthoringDraftInput {
  base_reference: ScenarioPackageReference;
  created_by: string;
  draft_id: string;
  editable_assets: ScenarioEditableAssets;
  known_limits?: readonly string[];
  source_admission: ScenarioAuthoringSourceAdmission;
  tenant_id: string;
}

export interface ScenarioAuthoringForkInput {
  created_by: string;
  draft_id: string;
  editable_assets: ScenarioEditableAssets;
  known_limits?: readonly string[];
  parent_expected_digest: string;
  tenant_id: string;
}

export interface ScenarioAuthoringDiffEntry {
  after: unknown;
  before: unknown;
  path: string;
}

export interface ScenarioAuthoringDiff {
  base_reference: ScenarioPackageReference;
  changes: readonly ScenarioAuthoringDiffEntry[];
  left_digest: string;
  qualification_impact: "UNCHANGED" | "REVIEW_REQUIRED";
  right_digest: string;
}

export interface ScenarioAuthoringValidation {
  editable_fields: readonly string[];
  issues: readonly string[];
  known_limits: readonly string[];
  ok: boolean;
  qualification_impact: "UNCHANGED" | "REVIEW_REQUIRED";
  status: "VALID" | "BLOCKED";
}

export interface FeatureEvidenceReference {
  feature_id: string;
  geography: string;
  period: string;
  provenance: "PRIMARY" | "SECONDARY" | "SYNTHETIC" | "INTERNAL" | "UNKNOWN";
  source_date: string;
  source_digest: string;
  source_expires_at: string | null;
  source_ref: string;
  unit: string;
  value_digest: string;
}

export interface QualificationEvidenceBinding {
  calibrated: false;
  effective_at: string;
  expires_at: string | null;
  pack_digest: string;
  pack_id: string;
  status: ScenarioQualificationBadge["status"];
  verification: "UPSTREAM_PACK_REFERENCE";
}

export interface ProductizationGovernanceContext {
  model_authority: "MAIN_MODEL_GOVERNANCE";
  model_reference_status: "EXACT_REFERENCE_PRESENT";
  parameter_authority: "MAIN_PARAMETER_SET_AUTHORITY";
  parameter_reference_status: "EXACT_REFERENCE_PRESENT";
  tenant_id: string;
}

export interface ModelEvidenceBindingInput {
  effective_period: string;
  evidence: readonly FeatureEvidenceReference[];
  geography: string;
  governance_context: ProductizationGovernanceContext;
  model_version_reference: ModelVersionReference;
  parameter_set_reference: ParameterSetReference;
  qualification_evidence: QualificationEvidenceBinding;
  scenario_qualification: ScenarioQualificationBadge["status"];
  scenario_reference: ScenarioPackageReference;
  supported_geographies: readonly string[];
  supported_periods: readonly string[];
  unit_requirements: Readonly<Record<string, string>>;
}

export interface CompatibilityFinding {
  code:
    | "EVIDENCE_MISSING"
    | "EVIDENCE_STALE"
    | "GEOGRAPHY_MISMATCH"
    | "PERIOD_MISMATCH"
    | "QUALIFICATION_EVIDENCE_INVALID"
    | "QUALIFICATION_NOT_ELIGIBLE"
    | "UNIT_MISMATCH"
    | "MODEL_CONTEXT_INVALID"
    | "MODEL_REFERENCE_INVALID"
    | "SCENARIO_REFERENCE_INVALID";
  message: string;
  severity: "ERROR" | "WARNING";
}

export interface ModelEvidenceBindingCandidate {
  binding_digest: string;
  calibration_status: "NOT_CALIBRATED";
  candidate_writer: "SH_PRODUCTIZATION_CANDIDATE_COMPILER";
  diagnostics: {
    ood: boolean;
    uq: { confidence: number; interval: string };
    why_not_bind: readonly string[];
  };
  evidence: readonly FeatureEvidenceReference[];
  findings: readonly CompatibilityFinding[];
  formal_activation: false;
  formal_join: false;
  governance_context: ProductizationGovernanceContext;
  model_version_reference: ModelVersionReference;
  no_implicit_latest: true;
  parameter_set_reference: ParameterSetReference;
  provider_calls: 0;
  qualification_evidence: QualificationEvidenceBinding;
  scenario_reference: ScenarioPackageReference;
  status: "ELIGIBLE_CANDIDATE" | "NOT_ELIGIBLE";
  truth_write: false;
  replay_truth_write: false;
}

export interface TeacherAdminModelBindingProjection {
  binding: ModelEvidenceBindingCandidate;
  role: "TEACHER" | "ADMIN";
}

export interface StudentModelBindingProjection {
  known_limits: readonly string[];
  mechanism: string;
  role: "STUDENT";
  status: ModelEvidenceBindingCandidate["status"];
}

export interface ExperimentRoundDefinition {
  decision_fields: readonly string[];
  model_version_reference: ModelVersionReference;
  outcome_evidence_refs: readonly string[];
  parameter_set_reference: ParameterSetReference;
  process_evidence_refs: readonly string[];
  round_id: string;
  round_no: number;
  scenario_reference: ScenarioPackageReference;
  seed: number;
  teaching_prompt: string;
}

export interface ExperimentCourseModule {
  module_id: string;
  objective: string;
  round_ids: readonly string[];
  title: string;
}

export interface ExperimentCourseRole {
  role_id: string;
  role_label: string;
  visibility: "TEACHER" | "STUDENT" | "ADMIN";
}

export interface ExperimentCourseEvidencePartition {
  advisory: readonly string[];
  counterfactual: readonly string[];
  learning: readonly string[];
  outcome: readonly string[];
  process: readonly string[];
}

export interface ExperimentCourseProfile {
  content_depth: "CORE" | "EXTENDED";
  experience_profile: ExperienceProfile;
  shared_kernel_id: string;
}

export interface ExperimentCoursePackageCandidate {
  content_digest: string;
  debrief_prompts: readonly string[];
  evidence_partition: ExperimentCourseEvidencePartition;
  formal_course_package_activation: false;
  known_limits: readonly string[];
  main_binding_request: MainCoursePackageBindingRequest;
  model_evidence_binding_digest: string;
  modules: readonly ExperimentCourseModule[];
  no_implicit_latest: true;
  package_id: string;
  profiles: Readonly<Record<ExperienceProfile, ExperimentCourseProfile>>;
  readiness: { reasons: readonly string[]; status: "READY" | "BLOCKED" };
  roles: readonly ExperimentCourseRole[];
  rounds: readonly ExperimentRoundDefinition[];
  schema_version: typeof SHANGHAI_PRODUCTIZATION_SCHEMA_VERSION;
  tenant_id: string;
  title: string;
  transfer_prompts: readonly string[];
  what_if_prompts: readonly string[];
  version: string;
}

export interface ExperimentCoursePackageAssemblyInput {
  debrief_prompts: readonly string[];
  evidence_partition: ExperimentCourseEvidencePartition;
  known_limits?: readonly string[];
  modules: readonly ExperimentCourseModule[];
  model_evidence_binding: ModelEvidenceBindingCandidate;
  package_id: string;
  profiles?: Readonly<Record<ExperienceProfile, ExperimentCourseProfile>>;
  roles: readonly ExperimentCourseRole[];
  rounds: readonly ExperimentRoundDefinition[];
  tenant_id: string;
  title: string;
  transfer_prompts: readonly string[];
  what_if_prompts: readonly string[];
  version: string;
}

export interface StudentExperimentCourseProjection {
  modules: readonly Pick<
    ExperimentCourseModule,
    "module_id" | "objective" | "round_ids" | "title"
  >[];
  role: "STUDENT";
  rounds: readonly {
    decision_fields: readonly string[];
    round_id: string;
    round_no: number;
    scenario_reference: Readonly<{ scenario_package_id: string; version: string }>;
    teaching_prompt: string;
  }[];
  tenant_id: string;
}

export interface CoursePackageReference {
  content_digest: string;
  course_package_id: string;
  tenant_id: string;
  version: string;
}

export interface MainCoursePackageBindingRequest {
  authority: "MAIN_COURSE_PACKAGE_AUTHORITY";
  exact_course_package_reference: CoursePackageReference;
  formal_activation: false;
  model_evidence_binding_digest: string;
  status: "CANDIDATE_ONLY";
}

export interface CourseRightsGrant {
  allowed_actions: readonly ("VIEW" | "COPY" | "FORK" | "DELIVER")[];
  copy_allowed: boolean;
  expires_at: string | null;
  fork_allowed: boolean;
  grant_id: string;
  license_status: "VALID" | "EXPIRED" | "WITHDRAWN" | "UNKNOWN";
  territory: string;
  tenant_id: string;
}

export interface EnterpriseCourseCatalogEntry {
  catalog_entry_id: string;
  course_package_reference: CoursePackageReference;
  known_limits: readonly string[];
  rights: CourseRightsGrant;
  sponsor_safe: true;
  tenant_id: string;
  title: string;
}

export interface EnterpriseCourseCopyCandidate {
  copied_at: string;
  destination_tenant_id: string;
  lineage: { source_catalog_entry_id: string; source_reference: CoursePackageReference };
  new_reference: CoursePackageReference;
  operation: "COPY" | "FORK";
  raw_source_data_copied: false;
  status: "COPY_CANDIDATE" | "FORK_CANDIDATE";
}

export interface EnterpriseCourseCopyInput {
  actor_tenant_id: string;
  catalog_entry_id: string;
  copied_at: string;
  destination_tenant_id: string;
  new_course_package_id: string;
  new_version: string;
}

export interface DeliveryConfiguration {
  course_package_reference: CoursePackageReference;
  delivery_id: string;
  expires_at: string | null;
  participant_count: number;
  rights: CourseRightsGrant;
  sponsor_id: string;
  tenant_id: string;
  territory: string;
}

export interface SponsorSafeAggregate {
  allowed_metrics: Readonly<Record<string, number>>;
  delivery_id: string;
  forbidden_fields: readonly [
    "state_true",
    "private_judgment",
    "other_team_data",
    "model_coefficients"
  ];
  privacy_status: "SMALL_CELL_SAFE" | "BLOCKED";
  participant_count: number;
  sponsor_id: string;
  tenant_id: string;
}

export interface DeliveryReceipt {
  audit_event_id: string;
  delivery_id: string;
  formal_entitlement_activation: false;
  sponsor_safe_aggregate: SponsorSafeAggregate;
  status: "READY" | "BLOCKED";
  tenant_id: string;
}

export type ScenarioCoursePortfolioStatus =
  | "DRAFT"
  | "QUALIFIED"
  | "READY"
  | "RELEASE_CANDIDATE"
  | "DEPRECATED"
  | "WITHDRAWN"
  | "RETIRED";

export interface PortfolioCompatibilityImpact {
  affected_consumers: readonly string[];
  changed_references: readonly string[];
  status: "NONE" | "REVIEW_REQUIRED" | "BLOCKED";
}

export interface ScenarioCoursePortfolioCandidate {
  compatibility_impact: PortfolioCompatibilityImpact;
  content_digest: string;
  current_status: ScenarioCoursePortfolioStatus;
  historical_references: readonly {
    content_digest: string;
    package_id: string;
    status: ScenarioCoursePortfolioStatus;
    version: string;
  }[];
  no_implicit_latest: true;
  package_reference: CoursePackageReference;
  portfolio_id: string;
  release_gate: "CANDIDATE_ONLY" | "FORMAL_RELEASE_REQUIRED";
  rollback: { dry_run: true; target_reference: CoursePackageReference | null };
  schema_version: typeof SHANGHAI_PRODUCTIZATION_SCHEMA_VERSION;
  tenant_id: string;
  withdrawn: boolean;
  withdrawal_deletes_history: false;
}

export interface PortfolioCreateInput {
  compatibility_impact: PortfolioCompatibilityImpact;
  package_reference: CoursePackageReference;
  portfolio_id: string;
  tenant_id: string;
}

export interface PortfolioHistoricalResolution {
  exact_reference: CoursePackageReference;
  found: boolean;
  historical: true;
  status: ScenarioCoursePortfolioStatus | "NOT_FOUND";
}

export interface PortfolioRollbackDryRun {
  changed_references: readonly string[];
  formal_rollback: false;
  from_reference: CoursePackageReference;
  status: "NOOP" | "CANDIDATE" | "BLOCKED";
  to_reference: CoursePackageReference;
}

export const PRODUCTIZATION_FORBIDDEN_FIELDS = [
  "state_true",
  "SettlementResult",
  "score",
  "rank",
  "truth_hash",
  "replay_hash",
  "model_coefficients",
  "private_judgment",
  "other_team_data",
  "raw_restricted_data"
] as const;

export type ProductizationForbiddenField = (typeof PRODUCTIZATION_FORBIDDEN_FIELDS)[number];

export const PRODUCTIZATION_EXPLICIT_NON_PROOFS = [
  "candidate_not_formal_scenario_package_activation",
  "candidate_not_formal_model_activation",
  "candidate_not_formal_course_package_activation",
  "candidate_not_entitlement_activation",
  "candidate_not_production_release",
  "provider_calls_zero",
  "postgresql_cutover_not_performed",
  "pilot_and_human_validation_not_performed"
] as const;
