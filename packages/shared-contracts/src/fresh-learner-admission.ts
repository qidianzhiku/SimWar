import type { RoleId } from "./index.js";

export const FRESH_LEARNER_ADMISSION_REQUIRED_ROLES: readonly RoleId[] = [
  "CEO",
  "CFO",
  "CMO",
  "COO"
];

export const FRESH_LEARNER_ADMISSION_STATUSES = [
  "BLOCKED",
  "READY_FOR_MACHINE_E4",
  "READY_FOR_HUMAN_INTERNAL_VALIDATION_WITH_LIMITS"
] as const;

export type FreshLearnerAdmissionStatus = (typeof FRESH_LEARNER_ADMISSION_STATUSES)[number];

export interface FreshLearnerAdmissionTeamReadiness {
  team_id: string;
  team_name: string;
  captain_user_id: string;
  member_count: number;
  required_member_count: number;
  assigned_role_count: number;
  auth_ready_member_count: number;
  auth_ready: boolean;
  missing_roles: RoleId[];
  duplicate_roles: RoleId[];
  invalid_memberships: string[];
  assigned_roles: RoleId[];
  ready: boolean;
}

export interface FreshLearnerAdmissionReadiness {
  schema_version: "fresh-learner-admission.v1";
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_count: number;
  fresh_learner_count: number;
  required_roster_count: number;
  assigned_roster_count: number;
  auth_ready: boolean;
  teacher_ready: boolean;
  admission_status: FreshLearnerAdmissionStatus;
  teams: FreshLearnerAdmissionTeamReadiness[];
  known_limits: string[];
}
