import type { PermissionKey } from "./index.js";
import type { ProjectProfileRef, ProjectProfileStudentBrief } from "./project-library.js";

export const M2P4_LIVE_ROUND_OPS_SCHEMA_VERSION = "m2p4-live-round-ops.v1" as const;

export type M2P4ReadinessState = "READY" | "BLOCKED" | "STALE" | "CONFLICTING" | "UNKNOWN";

export type M2P4SettlementTaskStatus = "NOT_STARTED" | "READY" | "SETTLED" | "BLOCKED";
export type M2P4PublicationTaskStatus = "NOT_READY" | "READY" | "PUBLISHED" | "WITHHELD";

export interface M2P4ExactRoundScope {
  tenant_id: string;
  course_id: string;
  run_id: string;
  round_id: string;
  round_no: number;
  team_id?: string;
}

export interface M2P4ProjectReadiness {
  state: M2P4ReadinessState;
  project_profile_reference?: ProjectProfileRef;
  blockers: string[];
}

export interface M2P4RoleReadiness {
  state: M2P4ReadinessState;
  required_role_keys: string[];
  assigned_role_keys: string[];
  missing_role_keys: string[];
  blockers: string[];
}

export interface M2P4DecisionReadiness {
  state: M2P4ReadinessState;
  canonical_decision_id?: string;
  team_confirmation_id?: string;
  merge_commit_id?: string;
  blockers: string[];
}

export interface M2P4TeamOperationsReadiness {
  exact_scope: M2P4ExactRoundScope & { team_id: string };
  team_id: string;
  team_name: string;
  project: M2P4ProjectReadiness;
  role: M2P4RoleReadiness;
  decision: M2P4DecisionReadiness;
  blockers: string[];
}

export interface M2P4RoundLockReceipt {
  status: "LOCKED";
  round_id: string;
  round_no: number;
  run_id: string;
  tenant_id: string;
  decision_batch_id: string;
  audit_id?: string;
}

export interface M2P4SettlementReceipt {
  status: "SETTLED";
  round_id: string;
  round_no: number;
  run_id: string;
  tenant_id: string;
  settlement_result_id: string;
}

export interface M2P4PublicationReceipt {
  status: "PUBLISHED";
  round_id: string;
  round_no: number;
  run_id: string;
  tenant_id: string;
  visibility_only: true;
}

export interface M2P4TeacherLiveRoundOps {
  schema_version: typeof M2P4_LIVE_ROUND_OPS_SCHEMA_VERSION;
  exact_scope: M2P4ExactRoundScope;
  session_command: {
    authority: "server";
    primary_action: PermissionKey | null;
    allowed_actions: PermissionKey[];
    enabled: boolean;
    reason?: string;
  };
  round: {
    status: "draft" | "open" | "locked" | "settled" | "published";
    lock_ready: boolean;
    decision_batch_id?: string;
    blockers: string[];
  };
  settlement: {
    status: M2P4SettlementTaskStatus;
    settlement_result_id?: string;
  };
  publication: {
    status: M2P4PublicationTaskStatus;
    visibility_only: true;
  };
  teams: M2P4TeamOperationsReadiness[];
  receipts: {
    lock?: M2P4RoundLockReceipt;
    settlement?: M2P4SettlementReceipt;
    publication?: M2P4PublicationReceipt;
  };
  debrief_handoff: {
    status: "NOT_READY" | "READY";
    exact_round_ref: string;
    exact_settlement_ref?: string;
    canonical_decision_refs: string[];
    existing_w3_p2b_authority: true;
  };
}

export interface M2P4StudentProjectContext {
  schema_version: typeof M2P4_LIVE_ROUND_OPS_SCHEMA_VERSION;
  exact_scope: M2P4ExactRoundScope & { team_id: string };
  brief_kind: ProjectProfileStudentBrief["brief_kind"];
  title: string;
  description: string;
  customer_segment: string;
  geography: string;
  industry: string;
  positioning: string;
  service_bundle: string;
  market_world_reference: ProjectProfileStudentBrief["market_world_reference"];
  project_profile_reference: ProjectProfileRef;
  known_limits: readonly string[];
}
