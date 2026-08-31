import type {
  Course,
  ProjectAssignment,
  ProjectProfile,
  ProjectProfileRef,
  RoleContext,
  Run,
  Round,
  StudentRoleAssignment,
  Team
} from "./index.js";
import type { CourseFactoryStudentEvidenceProjection } from "./course-factory.js";
import type { StudentDecisionContextEvidence } from "./student-decision-context-evidence.js";

export const PROJECT_AWARE_LAUNCH_SCHEMA_VERSION = "project-aware-launch.v1" as const;

export const PROJECT_AWARE_READINESS_STATES = [
  "BLOCKED",
  "STALE",
  "DEGRADED",
  "READY",
  "UNKNOWN_VERIFYING"
] as const;
export type ProjectAwareReadinessState = (typeof PROJECT_AWARE_READINESS_STATES)[number];

export const PROJECT_AWARE_LAUNCH_STATUSES = ["ACCEPTED", "REUSED"] as const;
export type ProjectAwareLaunchStatus = (typeof PROJECT_AWARE_LAUNCH_STATUSES)[number];

export const PROJECT_AWARE_BLOCKER_CODES = [
  "MISSING_ASSIGNMENT",
  "SCOPE_MISMATCH",
  "CONFLICTING_ASSIGNMENT",
  "STALE_PROFILE_DIGEST",
  "RETIRED_PROFILE",
  "MISSING_ROLE",
  "ROUND_NOT_OPEN",
  "UNKNOWN_FORMAL_STATUS",
  "FORMAL_BINDING_MISMATCH",
  "RUN_NOT_FOUND",
  "COURSE_NOT_READY"
] as const;
export type ProjectAwareBlockerCode = (typeof PROJECT_AWARE_BLOCKER_CODES)[number];

export const PROJECT_AWARE_BLOCKER_CATEGORIES = [
  "course",
  "run",
  "round",
  "project_assignment",
  "project_profile",
  "role_workflow",
  "formal_binding"
] as const;
export type ProjectAwareBlockerCategory = (typeof PROJECT_AWARE_BLOCKER_CATEGORIES)[number];

export const PROJECT_AWARE_BLOCKER_AUTHORITIES = [
  "Course",
  "Run",
  "Round",
  "ProjectAssignment",
  "ProjectProfile",
  "RoleWorkflow",
  "FormalCourseAuthorityBinding"
] as const;
export type ProjectAwareBlockerAuthority = (typeof PROJECT_AWARE_BLOCKER_AUTHORITIES)[number];

export const PROJECT_AWARE_BLOCKER_FRESHNESS = [
  "FRESH_SNAPSHOT",
  "HISTORICAL_EXACT_REF",
  "UNKNOWN"
] as const;
export type ProjectAwareBlockerFreshness = (typeof PROJECT_AWARE_BLOCKER_FRESHNESS)[number];

export const PROJECT_AWARE_STUDENT_FORBIDDEN_FIELDS = [
  "state_true",
  "raw_source_path",
  "private_coefficient",
  "hidden_calibration",
  "score",
  "rank",
  "settlement_result",
  "other_team_data"
] as const;

export interface ProjectAwareScope {
  tenant_id: string;
  course_id: string;
  run_id: string;
}

export interface ProjectAwareBlocker {
  blocker_id: string;
  category: ProjectAwareBlockerCategory;
  code: ProjectAwareBlockerCode;
  owner: "teacher" | "platform" | "team";
  action: string;
  reason: string;
  impact: string;
  source_authority: ProjectAwareBlockerAuthority;
  recovery_action: string;
  freshness: ProjectAwareBlockerFreshness;
  evidence_ref: string;
  waiver_policy?: string;
  detail?: string;
}

export interface ProjectAwareRoleWorkflowSnapshot {
  assignments: readonly StudentRoleAssignment[];
  round?: Round | null;
}

export interface ProjectAwareFormalBindingSnapshot {
  status: "BOUND" | "UNKNOWN";
  binding_digest?: string;
}

export interface ProjectAwareReadinessSnapshot {
  scope: ProjectAwareScope;
  course: Course | null;
  run: Run | null;
  teams: readonly Team[];
  assignments: readonly ProjectAssignment[];
  profiles: readonly ProjectProfile[];
  opening_round: Round | null;
  role_workflows: Readonly<Record<string, ProjectAwareRoleWorkflowSnapshot>>;
  formal_binding: ProjectAwareFormalBindingSnapshot;
}

export interface ProjectAwareTeamReadiness {
  team_id: string;
  team_name: string;
  state: ProjectAwareReadinessState;
  blockers: readonly ProjectAwareBlocker[];
  role_keys: readonly string[];
  assigned_role_keys: readonly string[];
  project_profile_reference?: ProjectProfileRef;
  successor_available: boolean;
}

export interface ProjectAwareCourseReadiness {
  schema_version: typeof PROJECT_AWARE_LAUNCH_SCHEMA_VERSION;
  scope: ProjectAwareScope;
  state: ProjectAwareReadinessState;
  blockers: readonly ProjectAwareBlocker[];
  teams: readonly ProjectAwareTeamReadiness[];
  formal_binding: ProjectAwareFormalBindingSnapshot;
  generated_at: string;
}

export interface ProjectAwareLaunchReceipt {
  schema_version: typeof PROJECT_AWARE_LAUNCH_SCHEMA_VERSION;
  command_idempotency_key: string;
  status: ProjectAwareLaunchStatus;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_ids: readonly string[];
  readiness_state: "READY";
  readiness_generated_at?: string;
  formal_binding_digest?: string;
  w4_state_refs?: Readonly<Record<string, string>>;
  audit_id: string;
  created_at: string;
}

export interface ProjectAwareStudentContext {
  schema_version: typeof PROJECT_AWARE_LAUNCH_SCHEMA_VERSION;
  scope: ProjectAwareScope & { team_id: string };
  role_context: RoleContext;
  course_factory_source_evidence?: CourseFactoryStudentEvidenceProjection;
  decision_context_evidence: StudentDecisionContextEvidence;
  project_brief: {
    brief_kind: "PROJECT_BRIEF";
    customer_segment: string;
    description: string;
    geography: string;
    industry: string;
    known_limits: readonly string[];
    market_world_reference: unknown;
    positioning: string;
    project_profile_reference: ProjectProfileRef;
    service_bundle: string;
    title: string;
  };
}

export function isProjectAwareLaunchReceipt(value: unknown): value is ProjectAwareLaunchReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (
    Object.keys(candidate).some((key) =>
      (PROJECT_AWARE_STUDENT_FORBIDDEN_FIELDS as readonly string[]).includes(key)
    )
  ) {
    return false;
  }
  return (
    candidate.schema_version === PROJECT_AWARE_LAUNCH_SCHEMA_VERSION &&
    typeof candidate.command_idempotency_key === "string" &&
    PROJECT_AWARE_LAUNCH_STATUSES.includes(candidate.status as ProjectAwareLaunchStatus) &&
    typeof candidate.tenant_id === "string" &&
    typeof candidate.course_id === "string" &&
    typeof candidate.run_id === "string" &&
    Array.isArray(candidate.team_ids) &&
    candidate.team_ids.every((teamId) => typeof teamId === "string") &&
    candidate.readiness_state === "READY" &&
    typeof candidate.audit_id === "string" &&
    typeof candidate.created_at === "string"
  );
}
