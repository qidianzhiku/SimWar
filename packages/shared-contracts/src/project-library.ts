import type { MarketWorldRef } from "./market-world.js";

export const PROJECT_PROFILE_SCHEMA_VERSION = "project-profile.v1" as const;
export const PROJECT_ASSIGNMENT_SCHEMA_VERSION = "project-assignment.v1" as const;

export const PROJECT_PROFILE_STATUSES = ["DRAFT", "VALIDATED", "RETIRED"] as const;
export type ProjectProfileStatus = (typeof PROJECT_PROFILE_STATUSES)[number];

export const PROJECT_PROFILE_READINESS = [
  "DRAFT",
  "READY",
  "STALE",
  "CONFLICT",
  "RETIRED",
  "SUCCESSOR_AVAILABLE",
  "DEPENDENCY_MISSING",
  "ORPHAN"
] as const;
export type ProjectProfileReadiness = (typeof PROJECT_PROFILE_READINESS)[number];

export const PROJECT_LIBRARY_ERROR_CODES = [
  "PROJECT_PROFILE_IDENTITY_INVALID",
  "PROJECT_PROFILE_INPUT_INVALID",
  "PROJECT_PROFILE_IMPORT_INVALID",
  "PROJECT_PROFILE_NOT_FOUND",
  "PROJECT_PROFILE_TENANT_SCOPE_VIOLATION",
  "PROJECT_PROFILE_LIFECYCLE_INVALID",
  "PROJECT_PROFILE_HISTORICAL_IMMUTABLE",
  "PROJECT_PROFILE_DUPLICATE_VERSION",
  "PROJECT_ASSIGNMENT_NOT_FOUND",
  "PROJECT_ASSIGNMENT_SCOPE_VIOLATION",
  "PROJECT_ASSIGNMENT_CONFLICT",
  "PROJECT_ASSIGNMENT_REFERENCE_INVALID",
  "PROJECT_ASSIGNMENT_DEPENDENCY_MISSING",
  "PROJECT_ASSIGNMENT_RETIRED"
] as const;
export type ProjectLibraryErrorCode = (typeof PROJECT_LIBRARY_ERROR_CODES)[number];

export interface ProjectProfileRef {
  content_digest: string;
  project_profile_id: string;
  tenant_id: string;
  version: string;
}

/** Normalized product-safe fields; raw enterprise source data is deliberately absent. */
export interface ProjectProfileSafePayload {
  customer_segment: string;
  geography: string;
  industry: string;
  positioning: string;
  service_bundle: string;
  starting_capacity: number;
  starting_cash: number;
}

export interface ProjectProfileDraftInput extends ProjectProfileSafePayload {
  description: string;
  market_world_reference: MarketWorldRef;
  project_profile_id: string;
  template_id: string;
  title: string;
  version: string;
}

export type ProjectProfileProvenanceKind =
  | "APPROVED_SAFE_TEMPLATE"
  | "NORMALIZED_IMPORT"
  | "CLONED"
  | "SUCCESSOR";

export interface ProjectProfileProvenance {
  kind: ProjectProfileProvenanceKind;
  source_project_profile_reference?: ProjectProfileRef;
}

export interface ProjectProfile extends ProjectProfileDraftInput {
  course_id: string;
  content_digest: string;
  created_at: string;
  created_by: string;
  schema_version: typeof PROJECT_PROFILE_SCHEMA_VERSION;
  status: ProjectProfileStatus;
  provenance: ProjectProfileProvenance;
  successor_of?: ProjectProfileRef;
  future_effective_at?: string;
  tenant_id: string;
}

export interface ProjectProfileReferenceInput {
  course_id: string;
  project_profile_ref: ProjectProfileRef;
}

export interface ProjectProfileCreateInput {
  course_id: string;
  project_profile: ProjectProfileDraftInput;
}

export interface ProjectProfileCloneInput {
  course_id: string;
  description: string;
  project_profile_id: string;
  source_project_profile_ref: ProjectProfileRef;
  title: string;
  version: string;
}

export interface ProjectProfileImportInput {
  course_id: string;
  project_profile: ProjectProfileDraftInput;
}

export interface ProjectProfileSuccessorInput extends ProjectProfileCloneInput {
  future_effective_at: string;
}

export interface ProjectProfileTeacherProjection {
  description: string;
  market_world_reference: MarketWorldRef;
  project_profile_reference: ProjectProfileRef;
  readiness: ProjectProfileReadiness[];
  status: ProjectProfileStatus;
  successor_of?: ProjectProfileRef;
  title: string;
  version: string;
}

export interface ProjectAssignment {
  assigned_at: string;
  assigned_by: string;
  assignment_id: string;
  course_id: string;
  project_profile_reference: ProjectProfileRef;
  run_id: string;
  schema_version: typeof PROJECT_ASSIGNMENT_SCHEMA_VERSION;
  team_id: string;
  tenant_id: string;
}

export interface ProjectAssignmentInput {
  course_id: string;
  project_profile_ref: ProjectProfileRef;
  run_id: string;
  team_id: string;
}

export interface StudentProjectBriefContext {
  course_id: string;
  run_id: string;
  team_id: string;
  tenant_id: string;
  user_id: string;
  /** Required when the team has more than one exact project assignment. */
  assignment_id?: string;
}

export interface ProjectAssignmentResult {
  assignment: ProjectAssignment;
  idempotent: boolean;
  readiness: ProjectProfileReadiness[];
}

export interface ProjectProfileStudentBrief {
  brief_kind: "PROJECT_BRIEF";
  customer_segment: string;
  description: string;
  geography: string;
  industry: string;
  known_limits: readonly string[];
  market_world_reference: MarketWorldRef;
  positioning: string;
  project_profile_reference: ProjectProfileRef;
  service_bundle: string;
  title: string;
  /** Server-evaluated M31 admission predicate for the exact Course/Run context. */
  decision_context_evidence_required?: boolean;
}

export interface ProjectLibraryAdminAuditProjection {
  assignments: readonly ProjectAssignment[];
  profiles: readonly ProjectProfileTeacherProjection[];
  tenant_id: string;
}

export const PROJECT_PROFILE_STUDENT_FORBIDDEN_FIELDS = [
  "raw_source_path",
  "raw_enterprise_source",
  "private_coefficient",
  "hidden_metadata",
  "state_true",
  "score",
  "rank",
  "settlement_result",
  "other_team_data"
] as const;
