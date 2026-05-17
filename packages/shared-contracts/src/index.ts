export type ActorRole =
  | "platform_admin"
  | "tenant_admin"
  | "teacher"
  | "learner"
  | "team_captain"
  | "service_kernel"
  | "service_ai"
  | "student"
  | "admin"
  | "service";

export type HealthStatus = "ok" | "degraded";

export interface HealthPayload {
  service: string;
  status: HealthStatus;
  version: string;
  timestamp: string;
  truthBoundary: "structured-core-only";
}

export interface ApiEnvelope<TData> {
  request_id: string;
  code: string;
  message: string;
  data: TData;
}

export interface ApiErrorDetail {
  field?: string;
  reason: string;
}

export interface ApiErrorEnvelope {
  request_id: string;
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

export type CourseStatus = "draft" | "published" | "active" | "archived";
export type RoundStatus = "draft" | "open" | "locked" | "settled" | "published";
export type DecisionStatus = "draft" | "submitted" | "validated" | "rejected";
export type ParameterSetStatus = "draft" | "candidate" | "shadow_passed" | "approved" | "deprecated";

export interface CurrentUser {
  user_id: string;
  tenant_id: string;
  display_name: string;
  roles: ActorRole[];
  team_id?: string;
}

export interface AuthSession {
  access_token: string;
  expires_in: number;
  user: CurrentUser;
}

export interface ScenarioPackage {
  scenario_package_id: string;
  tenant_id: string;
  name: string;
  version: string;
  status: "approved";
  plugin_package_ids: string[];
}

export interface ParameterSet {
  parameter_set_id: string;
  tenant_id: string;
  version: string;
  status: ParameterSetStatus;
  model_family: "toy_logit";
  seed: number;
  base_market_size: number;
  base_capacity: number;
  unit_cost: number;
  fixed_cost: number;
}

export interface Course {
  course_id: string;
  tenant_id: string;
  title: string;
  status: CourseStatus;
  scenario_package_id: string;
  parameter_set_id: string;
  created_by: string;
}

export interface TeamMember {
  user_id: string;
  display_name: string;
  role_slot: "CEO" | "CFO" | "CMO" | "COO" | "risk";
}

export interface Team {
  team_id: string;
  tenant_id: string;
  course_id: string;
  name: string;
  captain_user_id: string;
  members: TeamMember[];
}

export interface Run {
  run_id: string;
  tenant_id: string;
  course_id: string;
  scenario_package_id: string;
  parameter_set_id: string;
  seed: number;
  status: "draft" | "active" | "completed";
}

export interface Round {
  round_id: string;
  tenant_id: string;
  run_id: string;
  round_no: number;
  status: RoundStatus;
  decision_batch_id?: string;
  replay_hash?: string;
}

export interface DecisionPayload {
  pricing: {
    base_price: number;
  };
  marketing_budget: number;
  service_quality_budget: number;
  capacity_plan: "contract" | "hold" | "expand";
  cash_buffer_target: number;
  strategy_statement: string;
}

export interface Decision {
  decision_id: string;
  tenant_id: string;
  run_id: string;
  round_id: string;
  round_no: number;
  team_id: string;
  status: DecisionStatus;
  version: number;
  payload: DecisionPayload;
  validation_report: ApiErrorDetail[];
  submitted_by: string;
}

export interface TeamSettlement {
  team_id: string;
  team_name: string;
  state_true: {
    market_share: number;
    demand: number;
    served_demand: number;
    revenue: number;
    cost: number;
    profit: number;
    cash_flow: number;
    score: number;
    rank: number;
    settlement_status: "settled";
  };
  state_obs: {
    demand_band: "low" | "medium" | "high";
    served_demand: number;
    revenue: number;
    profit_band: "loss" | "thin" | "healthy";
    score: number;
    rank: number;
  };
  state_est: {
    next_round_risk: "capacity" | "cash" | "demand" | "balanced";
    explanation: string;
    recommended_focus: string;
  };
}

export interface SettlementResult {
  settlement_result_id: string;
  tenant_id: string;
  run_id: string;
  round_id: string;
  round_no: number;
  parameter_set_id: string;
  scenario_package_id: string;
  replay_hash: string;
  team_results: TeamSettlement[];
}

export interface PublicResultView {
  run_id: string;
  round_no: number;
  status: RoundStatus;
  replay_hash?: string;
  results: Array<Omit<TeamSettlement, "state_true"> & { state_true?: TeamSettlement["state_true"] }>;
}

export interface AuditLog {
  audit_id: string;
  tenant_id: string;
  actor_id: string;
  actor_role: ActorRole;
  action: string;
  resource_type: string;
  resource_id: string;
  request_id: string;
  created_at: string;
}

export interface P0DemoState {
  current_user: CurrentUser;
  courses: Course[];
  teams: Team[];
  runs: Run[];
  rounds: Round[];
  decisions: Decision[];
  latest_result?: PublicResultView;
  audit_logs: AuditLog[];
}

export interface AgentRequest<TPayload = Record<string, unknown>> {
  agentType: "MarketStrategy" | "Operations" | "Coach" | "Diagnostic";
  version: string;
  actor: {
    role: ActorRole;
    teamId?: string;
    tenantId?: string;
  };
  scenarioId: string;
  round: number;
  payload: TPayload;
}

export interface AgentResponse<TData = Record<string, unknown>> {
  code: number;
  message: string;
  data: TData & {
    advisoryOnly: true;
    confidence?: number;
  };
}

export const TRUTH_PROTECTED_FIELDS = [
  "marketShare",
  "market_share",
  "demand",
  "served_demand",
  "cashFlow",
  "cash_flow",
  "profit",
  "inventory",
  "capacity",
  "score",
  "rank",
  "settlementStatus",
  "settlement_status",
  "state_true"
] as const;

export const P0_ROUND_FLOW: RoundStatus[] = ["draft", "open", "locked", "settled", "published"];

export function createHealthPayload(service: string, version = "0.1.0"): HealthPayload {
  return {
    service,
    status: "ok",
    version,
    timestamp: new Date().toISOString(),
    truthBoundary: "structured-core-only"
  };
}

export function isTruthProtectedField(field: string): boolean {
  return TRUTH_PROTECTED_FIELDS.some((protectedField) => protectedField === field);
}
