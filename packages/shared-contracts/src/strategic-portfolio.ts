import type {
  W4CapitalAction,
  W4ProjectPortfolioEntry,
  W4StateRef
} from "./w4-enterprise-state.js";

export const W4_STRATEGIC_PORTFOLIO_SCHEMA_VERSION = "w4-strategic-portfolio.v1" as const;

export type W4StrategicPortfolioCandidateStatus = "DERIVED";
export type W4StrategicPortfolioConstraintStatus = "WITHIN_LIMIT" | "UNFUNDED" | "BREACHED";

export interface W4StrategicPortfolioRef {
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  round_no: number;
  portfolio_digest: string;
}

export interface W4StrategicPortfolioMember {
  project_entry_id: string;
  initiative_id: string;
  source_assignment_id: string;
  project_profile_reference: W4ProjectPortfolioEntry["project_profile_reference"];
  project_name: string;
  lifecycle_status: W4ProjectPortfolioEntry["lifecycle_status"];
  ownership_status: W4ProjectPortfolioEntry["ownership_status"];
  ramp: number | null;
  activation_round_no: number | null;
  dependency_project_entry_ids: string[];
}

export interface W4StrategicPortfolioAllocation {
  project_entry_id: string;
  project_cost: number;
  allocated_capital_principal: number;
  unfunded_project_cost: number;
  capital_action_ids: string[];
}

export interface W4StrategicPortfolioConstraints {
  status: W4StrategicPortfolioConstraintStatus;
  cash_available: number | null;
  covenant_min_cash: number;
  total_project_cost: number;
  allocated_capital_principal: number;
  unfunded_project_cost: number;
  dependency_project_entry_ids: string[];
}

export interface W4StrategicPortfolioPersistence {
  official_state_authority: "W4_ENTERPRISE_STATE_SERVICE";
  opening_state_ref: W4StateRef | null;
  closing_state_ref: W4StateRef | null;
  next_opening_state_ref: W4StateRef | null;
  historical_decision_reentry: false;
}

export interface W4StrategicPortfolioProjection {
  schema_version: typeof W4_STRATEGIC_PORTFOLIO_SCHEMA_VERSION;
  candidate_status: W4StrategicPortfolioCandidateStatus;
  portfolio_id: string;
  portfolio_ref: W4StrategicPortfolioRef;
  exact_scope: {
    tenant_id: string;
    course_id: string;
    run_id: string;
    team_id: string;
    round_no: number;
  };
  members: W4StrategicPortfolioMember[];
  allocations: W4StrategicPortfolioAllocation[];
  constraints: W4StrategicPortfolioConstraints;
  persistence: W4StrategicPortfolioPersistence;
  writer_authority: "SOLE_W4_ENTERPRISE_STATE_SERVICE";
  known_limits: string[];
}

export interface W4StrategicPortfolioProjectionInputs {
  latest_state: {
    cash: number;
    capital?: { covenant_min_cash: number };
  } | null;
  opening_state_ref: W4StateRef | null;
  closing_state_ref: W4StateRef | null;
  next_opening_state_ref: W4StateRef | null;
  members: W4StrategicPortfolioMember[];
  allocations: W4StrategicPortfolioAllocation[];
  capital_actions: W4CapitalAction[];
}
