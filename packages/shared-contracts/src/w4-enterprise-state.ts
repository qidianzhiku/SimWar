export type W4StrategicDecisionKind =
  | "new_project"
  | "product_line_adjustment"
  | "positioning_adjustment"
  | "organization_adjustment";

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

export type W4StrategicActionPayload =
  | W4NewProjectPayload
  | W4ProductLineAdjustmentPayload
  | W4PositioningAdjustmentPayload
  | W4OrganizationAdjustmentPayload;

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
  project: W4NewProjectPayload | null;
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
  policySeams: W4PolicySeam[];
  outcomes: W4OfficialOutcome[];
  replayEvidence: W4ReplayEvidence[];
}
