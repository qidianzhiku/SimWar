import type {
  DecisionMergeCommit,
  RoleContext,
  RoleDecisionSection,
  RoleKey,
  StudentRoleAssignment,
  TeamConfirmation
} from "./index.js";

export type RoleWorkflowEventType =
  | "role_assigned"
  | "section_saved"
  | "section_ready"
  | "merge_created"
  | "team_confirmed"
  | "workflow_reset";

export interface RoleWorkflowEvent {
  event_id: string;
  tenant_id: string;
  run_id: string;
  round_id?: string;
  team_id: string;
  actor_id: string;
  event_type: RoleWorkflowEventType;
  resource_id: string;
  created_at: string;
}

export interface RoleWorkflowReference {
  run_id: string;
  round_id: string;
  team_id: string;
}

export type StudentRoleWorkflowAssignment = Omit<StudentRoleAssignment, "assigned_by">;

export type StudentRoleWorkflowMergeDTO = Pick<
  DecisionMergeCommit,
  "merge_commit_id" | "status" | "created_at"
>;

export interface StudentRoleWorkflowWorkspaceDTO {
  schema_version: "student-role-workflow-workspace.v1";
  context: RoleContext;
  assignment: StudentRoleWorkflowAssignment;
  section?: RoleDecisionSection;
  merge_candidate?: StudentRoleWorkflowMergeDTO;
  confirmation?: Pick<TeamConfirmation, "status" | "confirmed_at">;
}

export interface TeacherRoleWorkflowSectionSummary {
  role_key: RoleKey;
  status: "missing" | RoleDecisionSection["status"];
  version: number;
  submitted_by?: string;
  updated_at?: string;
}

export interface TeacherRoleWorkflowWorkspaceDTO {
  schema_version: "teacher-role-workflow-workspace.v1";
  tenant_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  assignments: StudentRoleAssignment[];
  sections: RoleDecisionSection[];
  section_summaries: TeacherRoleWorkflowSectionSummary[];
  merge_commits: DecisionMergeCommit[];
  confirmations: TeamConfirmation[];
  history: RoleWorkflowEvent[];
  known_limits: string[];
}
