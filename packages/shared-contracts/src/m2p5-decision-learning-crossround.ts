import type { ProjectProfileRef, ProjectProfileStudentBrief } from "./project-library.js";
import type { StudentLearningReport } from "./student-learning-report.js";
import type { W3OfficialConsequenceResponse } from "./w3-official-consequence-learning.js";
import type { W4StateRef } from "./w4-enterprise-state.js";

export const M2P5_DECISION_LEARNING_SCHEMA_VERSION =
  "m2p5-decision-learning-crossround.v1" as const;

export type M2P5DecisionLearningSurface = "student" | "teacher";
export type M2P5LearningGate = "BLOCKED" | "READY";
export type M2P5CrossRoundStatus = "BLOCKED" | "READY_TO_CONTINUE" | "ENTRY_READY";
export type M2P5EntryStatus = "NOT_CREATED" | "DRAFT" | "OPEN" | "BLOCKED";

export interface M2P5DecisionLearningContext {
  readonly activity_id: string;
  readonly course_id: string;
  readonly role_key: string;
  readonly round_id: string;
  readonly round_no: number;
  readonly run_id: string;
  readonly team_id: string;
  readonly tenant_id: string;
}

export interface M2P5ProjectContextProjection {
  readonly status: "RESOLVED" | "BLOCKED";
  readonly project_profile_reference?: ProjectProfileRef;
  readonly title?: string;
  readonly student_brief?: ProjectProfileStudentBrief;
  readonly blockers?: readonly string[];
}

export interface M2P5LearningProjection {
  readonly gate: M2P5LearningGate;
  readonly reflection_status: "MISSING" | "SUBMITTED";
  readonly teacher_confirmation_status: "MISSING" | "DRAFT" | "CONFIRMED";
  readonly evidence_selection_status: "NOT_SELECTED" | "SELECTED";
  readonly student_learning_report_status: "MISSING" | "CONFIRMED";
  readonly teacher_confirmation_ref?: M2P5DecisionLearningResponse["official_consequence"]["record"]["learning"]["teacher_confirmation_ref"];
  readonly student_learning_report_ref?: M2P5DecisionLearningResponse["official_consequence"]["record"]["learning"]["student_learning_report_ref"];
  readonly next_round_hypothesis_status: "BLOCKED" | "READY";
}

export interface M2P5NextRoundProjection {
  readonly round_id: string;
  readonly round_no: number;
  readonly status: "draft" | "open" | "locked" | "settled" | "published";
  readonly opening_state_ref?: W4StateRef;
  readonly source_closing_state_ref?: W4StateRef;
}

export interface M2P5CrossRoundProjection {
  readonly status: M2P5CrossRoundStatus;
  readonly entry_status: M2P5EntryStatus;
  readonly blocker_codes: readonly string[];
  readonly predecessor_closing_state_ref?: W4StateRef;
  readonly next_round?: M2P5NextRoundProjection;
}

export interface M2P5DecisionLearningResponse {
  readonly schema_version: typeof M2P5_DECISION_LEARNING_SCHEMA_VERSION;
  readonly runtime_authority: "JSON_INTERNAL_ONLY";
  readonly visibility: "student_safe" | "teacher_safe";
  readonly exact_scope: M2P5DecisionLearningContext;
  readonly official_consequence: W3OfficialConsequenceResponse;
  readonly learning: M2P5LearningProjection;
  readonly learning_report?: StudentLearningReport;
  readonly project_context: M2P5ProjectContextProjection;
  readonly cross_round: M2P5CrossRoundProjection;
  readonly known_limits: readonly string[];
}
