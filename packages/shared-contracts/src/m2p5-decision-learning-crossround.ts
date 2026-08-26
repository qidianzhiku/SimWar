import type { ProjectProfileRef, ProjectProfileStudentBrief } from "./project-library.js";
import type { StudentLearningReport } from "./student-learning-report.js";
import type {
  W3ExactRef,
  W3OfficialConsequenceResponse
} from "./w3-official-consequence-learning.js";
import type { W4StateRef } from "./w4-enterprise-state.js";

export const M2P5_DECISION_LEARNING_SCHEMA_VERSION =
  "m2p5-decision-learning-crossround.v1" as const;

export type M2P5DecisionLearningSurface = "student" | "teacher";
export type M2P5LearningGate = "BLOCKED" | "READY";
export type M2P5CrossRoundStatus = "BLOCKED" | "READY_TO_CONTINUE" | "ENTRY_READY";
export type M2P5EntryStatus = "NOT_CREATED" | "DRAFT" | "OPEN" | "BLOCKED";
export type M2P6LearningLoopStatus = "READY" | "BLOCKED" | "CONFLICT" | "UNKNOWN";
export type M2P6DebriefAvailability = "AVAILABLE" | "BLOCKED" | "UNKNOWN";
export type M2P6WhatIfAvailability = "AVAILABLE" | "NOT_GENERATED" | "BLOCKED";
export type M2P6TransferStatus = "READY" | "BLOCKED";
export type M2P6NextOpeningReadiness = "ENTRY_READY" | "READY_TO_CONTINUE" | "BLOCKED";
export type M2P6LearningLoopAction =
  | "REVIEW_EVIDENCE"
  | "USE_EXISTING_D3_CONFIRMATION"
  | "PREPARE_DEBRIEF"
  | "CREATE_NON_OFFICIAL_WHAT_IF"
  | "REVIEW_NON_OFFICIAL_WHAT_IF"
  | "SUBMIT_AI_OFF_REFLECTION"
  | "REVIEW_TRANSFER"
  | "ENTER_NEXT_ROUND";

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

export interface M2P6LearningLoopProjection {
  readonly schema_version: "m2p6-teacher-debrief-learning-transfer.v1";
  readonly status: M2P6LearningLoopStatus;
  readonly exact_context: M2P5DecisionLearningContext;
  readonly canonical_decision_ref: W3ExactRef;
  readonly published_consequence_ref: {
    readonly record_id: string;
    readonly round_ref: W3ExactRef;
    readonly settlement_ref: W3ExactRef;
  };
  readonly teacher_confirmation_status: "MISSING" | "DRAFT" | "CONFIRMED";
  readonly teacher_confirmation_ref?: W3ExactRef;
  readonly teacher_debrief_availability: M2P6DebriefAvailability;
  readonly student_learning_report_status: "MISSING" | "CONFIRMED";
  readonly reflection_status: "MISSING" | "SUBMITTED";
  readonly what_if_availability: M2P6WhatIfAvailability;
  readonly transfer_status: M2P6TransferStatus;
  readonly next_opening_state_readiness: M2P6NextOpeningReadiness;
  readonly blockers: readonly string[];
  readonly allowed_actions: readonly M2P6LearningLoopAction[];
  readonly recovery_state: "EXACT_CONTEXT_RESTORED";
  readonly source_receipts: readonly W3ExactRef[];
  readonly provenance_refs: readonly W3ExactRef[];
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
  readonly learning_loop: M2P6LearningLoopProjection;
  readonly known_limits: readonly string[];
}
