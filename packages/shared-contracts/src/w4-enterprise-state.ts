import type { ProjectProfileRef } from "./project-library.js";

export type W4StrategicDecisionKind =
  | "new_project"
  | "product_line_adjustment"
  | "positioning_adjustment"
  | "organization_adjustment"
  | "capital_action";

/**
 * Typed policy seams are intentionally control-plane records only. They do
 * not represent product behavior and are never consumed by settlement.
 */
export type W4PolicySeamKind =
  | "merger_acquisition"
  | "asset_backed_securitization"
  | "initial_public_offering"
  | "project_sale"
  | "project_closure";

export type W4PolicySeamStatus = "proposed" | "under_review" | "approved" | "rejected" | "closed";

export type W4DecisionAdmissionPolicy = "ROLE_WORKFLOW_REQUIRED" | "LEGACY_DIRECT_EXPLICIT";
export type W4DecisionAdmissionAuthority =
  | "formal_run_runtime_binding"
  | "synthetic_run_creation_marker";

export type W4CommitmentStatus = "active" | "completed" | "failed" | "cancelled";
export type W4EffectStatus = "pending" | "active" | "expired";
export type W4InitiativeStatus =
  | "draft"
  | "in_progress"
  | "blocked"
  | "active"
  | "completed"
  | "failed"
  | "cancelled";

export type W4ProjectLifecycleStatus =
  | "Opportunity"
  | "Feasibility"
  | "DueDiligence"
  | "Negotiation"
  | "TermSheet"
  | "Operating"
  | "Closed"
  | "Cancelled";

export type W4ProjectOwnershipStatus = "owned" | "sold" | "closed";
export type W4ProjectTransactionKind =
  | "project_add"
  | "project_sale"
  | "project_closure"
  | "merger_acquisition";
export type W4ProjectTransactionPhase =
  | "Listing"
  | "Bid"
  | "DueDiligence"
  | "Negotiation"
  | "TermSheet"
  | "Closing"
  | "Closed"
  | "Cancelled";

export interface W4ScopeContext {
  actor_id: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  round_id: string;
  round_no: number;
  role_key: string;
  activity_id: string;
}

export interface W4StateRef {
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  round_id: string;
  enterprise_state_id: string;
  version: number;
  state_digest: string;
  parent_state_ref?: W4StateRef | null;
}

export interface W4EnterpriseStateData {
  cash: number;
  capacity: number;
  capital?: W4CapitalPosition;
  product_lines: string[];
  positioning: string;
  organization: Record<string, number | string>;
  operating_units: W4OperatingUnit[];
  portfolio: {
    projects: string[];
    facilities: string[];
  };
}

export interface W4EnterpriseState {
  enterprise_state_id: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  round_id: string;
  round_no: number;
  version: number;
  parent_state_ref: W4StateRef | null;
  state_digest: string;
  state: W4EnterpriseStateData;
}

export interface W4RoundContext extends W4ScopeContext {
  opening_state_ref: W4StateRef | null;
}

export interface W4NewProjectPayload {
  project_name: string;
  cost: number;
  cycle_rounds: number;
  area: number;
  beds: number;
  bed_mix: Record<string, number>;
  ramp: number;
  lead_time_rounds: number;
}

export interface W4AdjustmentMetadata {
  rationale: string;
  lead_time_rounds: number;
  reversible: boolean;
  dependencies: string[];
  kpi_hypothesis: string;
}

export interface W4ProductLineAdjustmentPayload extends W4AdjustmentMetadata {
  product_line_id: string;
  operation: "add" | "update" | "remove";
  target_value: string;
}

export interface W4PositioningAdjustmentPayload extends W4AdjustmentMetadata {
  positioning: string;
}

export interface W4OrganizationAdjustmentPayload extends W4AdjustmentMetadata {
  unit_name: string;
  headcount_delta: number;
}

export type W4CapitalActionKind =
  | "debt"
  | "project_finance"
  | "working_capital"
  | "asset_backed_securitization"
  | "initial_public_offering";

export type W4CapitalObligation =
  | "term_debt"
  | "project_finance"
  | "working_capital_revolver"
  | "securitized_receivable"
  | "equity";

export type W4CapitalActionStatus = "pending" | "active" | "blocked" | "completed";

export interface W4CapitalActionPayload extends W4AdjustmentMetadata {
  capital_action_kind: W4CapitalActionKind;
  principal: number;
  term_rounds: number;
  rate_or_cost_bps: number;
  cost_source: string;
  covenant_min_cash: number;
  fees: number;
  obligation: W4CapitalObligation;
  project_entry_id?: string;
  initiative_id?: string;
  policy_seam_id?: string;
}

export type W4StrategicActionPayload =
  | W4NewProjectPayload
  | W4ProductLineAdjustmentPayload
  | W4PositioningAdjustmentPayload
  | W4OrganizationAdjustmentPayload
  | W4CapitalActionPayload;

export interface W4StrategicActionEnvelope {
  kind: W4StrategicDecisionKind;
  version: number;
  payload: W4StrategicActionPayload;
}

export interface W4OperatingUnit {
  operating_unit_id: string;
  name: string;
  status: "active" | "planned";
}

export interface W4CanonicalStrategicDecision {
  decision_id: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  round_id: string;
  round_no: number;
  team_id: string;
  kind: W4StrategicDecisionKind;
  version: number;
  status: "canonical";
  payload: W4NewProjectPayload | Record<string, unknown>;
  admission: W4DecisionAdmission;
}

export interface W4DecisionAdmission {
  policy: W4DecisionAdmissionPolicy;
  authority: W4DecisionAdmissionAuthority;
  canonical_decision_id: string | null;
  merge_commit_id: string | null;
  team_confirmation_id: string | null;
  decision_payload_digest: string;
}

export interface W4DecisionPayloadBinding {
  decision_id: string;
  decision_payload_digest: string;
}

export interface W4Commitment {
  commitment_id: string;
  decision_id: string;
  decision_payload_digest: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  kind: W4StrategicDecisionKind;
  status: W4CommitmentStatus;
  cost: number;
  created_round_no: number;
}

export interface W4StrategicEffect {
  effect_id: string;
  commitment_id: string;
  decision_payload_digest: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  status: W4EffectStatus;
  effective_round_no: number;
  effect: Record<string, unknown>;
}

export interface W4CapitalPosition {
  debt_principal: number;
  equity_proceeds: number;
  working_capital_available: number;
  interest_paid: number;
  fees_paid: number;
  covenant_min_cash: number;
  covenant_breach_action_ids: string[];
  active_capital_action_ids: string[];
}

export interface W4CapitalAction {
  capital_action_id: string;
  decision_id: string;
  decision_payload_digest: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  kind: W4CapitalActionKind;
  status: W4CapitalActionStatus;
  blocked_reason?: string;
  principal: number;
  term_rounds: number;
  rate_or_cost_bps: number;
  cost_source: string;
  covenant_min_cash: number;
  fees: number;
  obligation: W4CapitalObligation;
  project_entry_id: string | null;
  initiative_id: string | null;
  policy_seam_id: string | null;
  created_round_no: number;
  effective_round_no: number;
  maturity_round_no: number;
}

export interface W4StrategicInitiative {
  initiative_id: string;
  commitment_id: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  kind: W4StrategicDecisionKind;
  status: W4InitiativeStatus;
  current_milestone: string;
  milestones: string[];
  remaining_lead_time_rounds: number;
  activation_round_no: number;
  project_lifecycle_status?: W4ProjectLifecycleStatus;
  project: W4NewProjectPayload | null;
}

export interface W4ProjectPortfolioEntry {
  project_entry_id: string;
  initiative_id: string;
  source_assignment_id: string;
  project_profile_reference: ProjectProfileRef;
  project_name: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  lifecycle_status: W4ProjectLifecycleStatus;
  ownership_status: W4ProjectOwnershipStatus;
  operating_unit_id: string | null;
  successor_of_entry_id: string | null;
  created_round_no: number;
  updated_round_no: number;
}

export interface W4ProjectTransaction {
  transaction_id: string;
  kind: W4ProjectTransactionKind;
  phase: W4ProjectTransactionPhase;
  initiative_id: string;
  project_entry_id: string;
  target_project_profile_reference?: ProjectProfileRef;
  target_project_name?: string;
  buyer_confirmation_id?: string;
  seller_confirmation_id?: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  created_round_no: number;
  updated_round_no: number;
}

export interface W4PolicySeam {
  policy_seam_id: string;
  kind: W4PolicySeamKind;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  round_no: number;
  status: W4PolicySeamStatus;
  payload: Record<string, unknown>;
  requires_policy_approval: true;
  may_write_enterprise_state: false;
  may_write_official_outcome: false;
}

export interface W4OfficialOutcome {
  official_outcome_id: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  round_id: string;
  round_no: number;
  opening_state_ref: W4StateRef;
  closing_state_ref: W4StateRef;
  commitment_ids: string[];
  persistent_effect_ids: string[];
  reexecuted_decision_ids: string[];
  replay_input_manifest: W4ReplayInputManifest;
  settlement_digest: string;
  status: "official";
}

export interface W4ReplayInputManifest {
  manifest_id: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  round_id: string;
  opening_state_ref: W4StateRef;
  decision_ids: string[];
  decision_payload_bindings: W4DecisionPayloadBinding[];
  scenario_package_id: string;
  parameter_set_id: string;
  engine_id: string;
  plugin_ids: string[];
  seed: number;
  project_portfolio_digest?: string;
  project_portfolio_entry_ids?: string[];
  project_portfolio_snapshot?: W4ProjectPortfolioEntry[];
  capital_action_digest?: string;
  capital_action_ids?: string[];
  capital_action_snapshot?: W4CapitalAction[];
}

export interface W4ReplayEvidence {
  replay_id: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  round_id: string;
  source_outcome_id: string;
  opening_state_ref: W4StateRef;
  closing_state_ref: W4StateRef;
  decision_ids: string[];
  decision_payload_bindings: W4DecisionPayloadBinding[];
  persistent_effect_ids: string[];
  path_digest: string;
  project_portfolio_digest?: string;
  capital_action_digest?: string;
  replay_writes_formal_results: false;
}

export interface W4StateDiffEvidence {
  opening_state_ref: W4StateRef;
  closing_state_ref: W4StateRef;
  parent_state_ref: W4StateRef | null;
  opening_digest: string;
  closing_digest: string;
  changed_paths: string[];
}

export interface W4PathEvidence {
  opening_vs_closing: W4StateDiffEvidence | null;
  initiative_timeline: Array<{
    initiative_id: string;
    status: W4InitiativeStatus;
    current_milestone: string;
    milestones: string[];
    remaining_lead_time_rounds: number;
    activation_round_no: number;
  }>;
  persistent_effect_ids: string[];
  portfolio_hierarchy: {
    group_tenant_id: string;
    portfolio_projects: string[];
    portfolio_facilities: string[];
    operating_unit_ids: string[];
  };
  official_replay_path: {
    official_outcome_id: string | null;
    replay_ids: string[];
    path_digests: string[];
    replay_writes_formal_results: false;
  };
  same_current_decision_different_history: {
    status: "proven" | "not_observed";
    current_decision_ids: string[];
    comparison_count: number;
  };
}

export interface W4MatchedArenaTeamPath {
  team_id: string;
  project_portfolio_entry_ids: string[];
  state_refs: W4StateRef[];
  opening_state_ref: W4StateRef | null;
  closing_state_ref: W4StateRef | null;
  path_digest: string;
  path_evidence: W4PathEvidence | null;
}

export interface W4MatchedProjectArena {
  arena_id: string;
  project_profile_reference: ProjectProfileRef;
  team_ids: string[];
  teams: W4MatchedArenaTeamPath[];
  state_isolation_proven: true;
  different_history_observed: boolean;
  known_limits: string[];
}

export interface W4CounterfactualInput {
  source_state_ref: W4StateRef;
  source_outcome_id: string;
  decision_ids: string[];
  horizon_rounds: number;
  scenario_package_id: string;
  parameter_set_id: string;
  engine_id: string;
  plugin_ids: string[];
  seed: number;
}

export interface W4CounterfactualRoundEvidence {
  round_no: number;
  opening_state_ref: W4StateRef;
  closing_state_ref: W4StateRef;
  opening_state: W4EnterpriseStateData;
  closing_state: W4EnterpriseStateData;
  opening_digest: string;
  closing_digest: string;
  changed_paths: string[];
}

export interface W4CounterfactualEvidence {
  counterfactual_id: string;
  source_outcome_id: string;
  source_state_ref: W4StateRef;
  decision_ids: string[];
  decision_payload_bindings: W4DecisionPayloadBinding[];
  scenario_package_id: string;
  parameter_set_id: string;
  engine_id: string;
  plugin_ids: string[];
  seed: number;
  horizon_rounds: number;
  rounds: W4CounterfactualRoundEvidence[];
  official_decision_writes: false;
  official_settlement_writes: false;
  official_state_writes: false;
  apply_to_next_round: false;
  replay_writes_formal_results: false;
  known_limits: string[];
}

export interface W4StrategicActionProjection {
  decision_id: string;
  kind: W4StrategicDecisionKind;
  version: number;
  admission: Pick<
    W4DecisionAdmission,
    "policy" | "authority" | "canonical_decision_id" | "merge_commit_id" | "team_confirmation_id"
  >;
  cost: number;
  lead_time_rounds: number;
  reversible: boolean;
  dependencies: string[];
  kpi_hypothesis: string;
  known_limits: string[];
}

export interface W4ProjectionBase {
  scope: Pick<W4ScopeContext, "tenant_id" | "course_id" | "run_id" | "team_id">;
  opening_state_ref: W4StateRef | null;
  closing_state_ref: W4StateRef | null;
  state: W4EnterpriseStateData | null;
  initiatives: W4StrategicInitiative[];
  project_portfolio: W4ProjectPortfolioEntry[];
  project_transactions: W4ProjectTransaction[];
  capital_actions: W4CapitalAction[];
  commitments: Array<Pick<W4Commitment, "commitment_id" | "kind" | "status" | "cost">>;
  effects: Array<Pick<W4StrategicEffect, "effect_id" | "status" | "effective_round_no">>;
  latest_strategic_action: W4StrategicActionProjection | null;
  evidence: W4ReplayEvidence[];
  path_evidence: W4PathEvidence;
}

export interface W4StoreState {
  states: W4EnterpriseState[];
  decisions: W4CanonicalStrategicDecision[];
  commitments: W4Commitment[];
  effects: W4StrategicEffect[];
  initiatives: W4StrategicInitiative[];
  projectPortfolio: W4ProjectPortfolioEntry[];
  projectTransactions: W4ProjectTransaction[];
  capitalActions: W4CapitalAction[];
  policySeams: W4PolicySeam[];
  outcomes: W4OfficialOutcome[];
  replayEvidence: W4ReplayEvidence[];
}
