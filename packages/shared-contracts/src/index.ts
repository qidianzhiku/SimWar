export type ActorRole =
  | "platform_admin"
  | "tenant_admin"
  | "teacher"
  | "learner"
  | "team_captain"
  | "scenario_designer"
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

export type TenantStatus = "active" | "suspended" | "archived";
export type UserStatus = "active" | "invited" | "disabled";
export type CourseStatus = "draft" | "published" | "active" | "archived";
export type RoundStatus = "draft" | "open" | "locked" | "settled" | "published";
export type DecisionStatus = "draft" | "submitted" | "validated" | "rejected";
export type ParameterSetStatus = "draft" | "candidate" | "shadow_passed" | "approved" | "deprecated";
export type SettlementHookName =
  | "adjustDemand"
  | "adjustOperations"
  | "adjustFinance"
  | "adjustScore";

export type PermissionKey =
  | "tenant:create"
  | "tenant:read"
  | "user:create"
  | "user:read"
  | "user:update"
  | "rbac:read"
  | "course:create"
  | "course:read"
  | "course:publish"
  | "team:create"
  | "run:create"
  | "round:start"
  | "round:lock"
  | "settlement:settle"
  | "round:publish"
  | "decision:submit"
  | "result:read"
  | "audit:read"
  | "internal:settle";

export interface Tenant {
  tenant_id: string;
  name: string;
  domain: string;
  status: TenantStatus;
  created_at: string;
  updated_at: string;
}

export interface CurrentUser {
  user_id: string;
  tenant_id: string;
  display_name: string;
  roles: ActorRole[];
  permissions?: PermissionKey[];
  team_id?: string;
}

export interface User extends CurrentUser {
  username: string;
  email: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  permission_id: string;
  key: PermissionKey;
  action: string;
  resource: string;
  description: string;
}

export interface Role {
  role_id: string;
  tenant_id?: string;
  name: ActorRole;
  display_name: string;
  permission_keys: PermissionKey[];
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  user_id: string;
  role_id: string;
  tenant_id: string;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
}

export interface AuthSession {
  access_token: string;
  expires_in: number;
  token_type: "Bearer";
  user: CurrentUser;
}

export interface SessionRecord {
  session_id: string;
  user_id: string;
  tenant_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  revoked_at?: string;
}

export interface ScenarioPackage {
  scenario_package_id: string;
  tenant_id: string;
  name: string;
  version: string;
  status: "approved";
  plugin_package_ids: string[];
}

export interface PluginManifest {
  manifest_version: "1.0.0";
  plugin_id: string;
  name: string;
  version: string;
  status: ParameterSetStatus;
  industry: "wellness";
  supported_hooks: SettlementHookName[];
  parameter_schema_version: string;
  parameter_schema_ref: string;
  settlement_hook_refs: string[];
  adapter_ref: string;
}

export interface WellnessParametersV1 {
  schema_version: "wellness.parameters.v1";
  demand_curve: {
    reference_price: number;
    price_friction_scale: number;
    quality_budget_per_utility: number;
    max_quality_lift: number;
    quality_lift_weight: number;
    price_sensitivity: number;
  };
  cost_structure: {
    partnership_discount_threshold: number;
    partnership_discount_rate: number;
  };
  operations_constraints: {
    max_capacity_modifier: number;
    min_service_quality_budget: number;
  };
  scoring_weights: {
    service_quality_bonus_per_budget: number;
    max_service_quality_bonus: number;
    underfunded_service_penalty: number;
  };
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
  parameters?: WellnessParametersV1;
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
  canonical_source?: "legacy_direct" | "role_merge_commit";
  merge_commit_id?: string;
  team_confirmation_id?: string;
}

export type RoleDecisionSectionStatus = "draft" | "ready";
export type DecisionMergeCommitStatus = "validated";
export type TeamConfirmationStatus = "confirmed";
export type RoleKey = TeamMember["role_slot"];

export interface RoleDecisionSection {
  section_id: string;
  tenant_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  role_key: RoleKey;
  status: RoleDecisionSectionStatus;
  payload: Partial<DecisionPayload>;
  version: number;
  submitted_by: string;
  submitted_at: string;
  updated_at: string;
}

export interface DecisionMergeCommit {
  merge_commit_id: string;
  tenant_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  status: DecisionMergeCommitStatus;
  source_section_ids: string[];
  merged_payload: DecisionPayload;
  created_by: string;
  created_at: string;
}

export interface TeamConfirmation {
  team_confirmation_id: string;
  tenant_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  merge_commit_id: string;
  status: TeamConfirmationStatus;
  confirmed_by: string;
  confirmed_at: string;
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

export type DomainEventType = string;

export interface DomainEvent {
  event_id: string;
  tenant_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: DomainEventType;
  occurred_at: string;
  actor_id?: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface StateSnapshot {
  snapshot_id: string;
  tenant_id: string;
  run_id: string;
  round_id: string;
  snapshot_type: "run" | "round" | "settlement";
  captured_at: string;
  state: Record<string, unknown>;
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
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface P0DemoState {
  current_user: CurrentUser;
  tenants?: Tenant[];
  users?: User[];
  roles?: Role[];
  permissions?: Permission[];
  courses: Course[];
  teams: Team[];
  runs: Run[];
  rounds: Round[];
  decisions: Decision[];
  latest_result?: PublicResultView;
  audit_logs: AuditLog[];
}

export interface AdminState {
  current_user: CurrentUser;
  tenants: Tenant[];
  users: User[];
  roles: Role[];
  permissions: Permission[];
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

export const ROLE_PERMISSION_MATRIX: Record<ActorRole, PermissionKey[]> = {
  platform_admin: [
    "tenant:create",
    "tenant:read",
    "user:create",
    "user:read",
    "user:update",
    "rbac:read",
    "course:create",
    "course:read",
    "course:publish",
    "team:create",
    "run:create",
    "round:start",
    "round:lock",
    "settlement:settle",
    "round:publish",
    "decision:submit",
    "result:read",
    "audit:read",
    "internal:settle"
  ],
  tenant_admin: [
    "tenant:read",
    "user:create",
    "user:read",
    "user:update",
    "rbac:read",
    "course:create",
    "course:read",
    "course:publish",
    "team:create",
    "run:create",
    "round:start",
    "round:lock",
    "settlement:settle",
    "round:publish",
    "result:read",
    "audit:read"
  ],
  teacher: [
    "course:create",
    "course:read",
    "course:publish",
    "team:create",
    "run:create",
    "round:start",
    "round:lock",
    "settlement:settle",
    "round:publish",
    "result:read",
    "audit:read"
  ],
  learner: ["course:read", "decision:submit", "result:read"],
  team_captain: ["course:read", "decision:submit", "result:read"],
  scenario_designer: ["tenant:read", "course:read", "rbac:read"],
  service_kernel: ["internal:settle"],
  service_ai: ["course:read", "result:read"],
  student: ["course:read", "decision:submit", "result:read"],
  admin: ["tenant:read", "user:read", "course:read", "audit:read"],
  service: ["course:read"]
};

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

export function getRolePermissions(roles: ActorRole[]): PermissionKey[] {
  return [...new Set(roles.flatMap((role) => ROLE_PERMISSION_MATRIX[role] ?? []))];
}

export function actorHasPermission(actor: CurrentUser, permission: PermissionKey): boolean {
  return (actor.permissions ?? getRolePermissions(actor.roles)).includes(permission);
}
