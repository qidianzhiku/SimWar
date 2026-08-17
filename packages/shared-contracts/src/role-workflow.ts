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

export type StudentDecisionTraceStageKey =
  | "ROLE_ASSIGNED"
  | "ROLE_CONTRIBUTION_DRAFTED"
  | "ROLE_CONTRIBUTION_READY"
  | "TEAM_MERGE_MILESTONE"
  | "TEAM_CONFIRMED"
  | "CANONICAL_DECISION_MILESTONE";

export type StudentDecisionTraceStageStatus = "completed";

export type StudentDecisionTraceCurrentStage = StudentDecisionTraceStageKey | "NOT_STARTED";

export type StudentDecisionTraceCompleteness = "empty" | "partial" | "complete";

export interface StudentDecisionTraceStage {
  stage_key: StudentDecisionTraceStageKey;
  status: StudentDecisionTraceStageStatus;
  occurred_at: string;
  safe_evidence_reference: string;
  safe_label: string;
}

export interface StudentDecisionTraceDTO {
  schema_version: "student-decision-trace.v1";
  tenant_id: string;
  run_id: string;
  round_id: string;
  round_no: number;
  team_id: string;
  role_key: RoleKey;
  trace_stages: StudentDecisionTraceStage[];
  current_stage: StudentDecisionTraceCurrentStage;
  trace_completeness: StudentDecisionTraceCompleteness;
  known_limits: string[];
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
