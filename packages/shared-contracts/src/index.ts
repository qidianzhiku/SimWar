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
export type ParameterSetStatus =
  | "draft"
  | "candidate"
  | "shadow_passed"
  | "approved"
  | "deprecated";
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
export type RoleId = Exclude<RoleKey, "risk">;
export type RoleAssignmentStatus = "active" | "inactive";
export type RoleAssignmentSource = "teacher_assigned" | "seeded_default";
export type DecisionPayloadFieldPath =
  | "pricing.base_price"
  | "marketing_budget"
  | "service_quality_budget"
  | "capacity_plan"
  | "cash_buffer_target"
  | "strategy_statement";

export interface RoleTemplate {
  role_template_id: string;
  role_key: RoleId;
  display_name: string;
  description: string;
  responsibility_summary: string;
  default_editable_fields: DecisionPayloadFieldPath[];
  default_visible_scopes: string[];
  advisory_scopes: string[];
  version: string;
}

export interface RolePermissionPolicy {
  policy_id: string;
  role_key: RoleId;
  schema_version: "role-permission-policy.v1";
  can_read_role_workspace: boolean;
  can_save_section: boolean;
  can_mark_ready: boolean;
  can_create_merge_commit: boolean;
  can_confirm_team_decision: boolean;
  can_submit_canonical_decision: boolean;
  editable_fields: DecisionPayloadFieldPath[];
  visible_scopes: string[];
  advisory_scopes: string[];
}

export interface StudentRoleAssignment {
  assignment_id: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  user_id: string;
  role_key: RoleId;
  role_template_id: string;
  status: RoleAssignmentStatus;
  source: RoleAssignmentSource;
  assigned_by: string;
  assigned_at: string;
}

export interface RoleContext {
  role_context_id: string;
  tenant_id: string;
  user_id: string;
  course_id: string;
  run_id: string;
  round_id: string;
  round_no: number;
  team_id: string;
  assignment_id: string;
  role_key: RoleId;
  role_template_id: string;
  permissions: RolePermissionPolicy;
  source: "resolved_from_assignment";
  expires_at: string;
}

const ROLE_IDS: RoleId[] = ["CEO", "CFO", "CMO", "COO"];
const ROLE_CONTRACT_DISALLOWED_EDIT_FIELDS = new Set<string>([
  "state_true",
  "market_share",
  "demand",
  "served_demand",
  "revenue",
  "cost",
  "profit",
  "cash_flow",
  "score",
  "rank",
  "settlement_status"
]);

export const DEFAULT_STUDENT_ROLE_TEMPLATES: RoleTemplate[] = [
  {
    role_template_id: "role_template_ceo_v1",
    role_key: "CEO",
    display_name: "CEO",
    description: "Team captain and final integrator for canonical decisions.",
    responsibility_summary: "Integrates role sections and owns final team confirmation.",
    default_editable_fields: ["strategy_statement"],
    default_visible_scopes: ["team.readiness", "team.merge_summary", "round.state_obs"],
    advisory_scopes: ["strategy", "cross_functional_alignment"],
    version: "1.0.0"
  },
  {
    role_template_id: "role_template_cfo_v1",
    role_key: "CFO",
    display_name: "CFO",
    description: "Finance owner for budget discipline and cash buffer planning.",
    responsibility_summary: "Owns financial assumptions before CEO merge.",
    default_editable_fields: ["cash_buffer_target", "service_quality_budget"],
    default_visible_scopes: ["team.finance_summary", "round.state_obs"],
    advisory_scopes: ["finance", "cash_risk"],
    version: "1.0.0"
  },
  {
    role_template_id: "role_template_cmo_v1",
    role_key: "CMO",
    display_name: "CMO",
    description: "Market owner for pricing, demand assumptions, and positioning.",
    responsibility_summary: "Owns market-facing inputs before CEO merge.",
    default_editable_fields: ["pricing.base_price", "marketing_budget"],
    default_visible_scopes: ["team.market_summary", "round.state_obs"],
    advisory_scopes: ["market", "pricing"],
    version: "1.0.0"
  },
  {
    role_template_id: "role_template_coo_v1",
    role_key: "COO",
    display_name: "COO",
    description: "Operations owner for capacity and service execution planning.",
    responsibility_summary: "Owns operating constraints before CEO merge.",
    default_editable_fields: ["capacity_plan", "service_quality_budget"],
    default_visible_scopes: ["team.operations_summary", "round.state_obs"],
    advisory_scopes: ["operations", "service_delivery"],
    version: "1.0.0"
  }
];

export const DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES: Record<RoleId, RolePermissionPolicy> = {
  CEO: {
    policy_id: "role_policy_ceo_v1",
    role_key: "CEO",
    schema_version: "role-permission-policy.v1",
    can_read_role_workspace: true,
    can_save_section: true,
    can_mark_ready: true,
    can_create_merge_commit: true,
    can_confirm_team_decision: true,
    can_submit_canonical_decision: true,
    editable_fields: ["strategy_statement"],
    visible_scopes: ["team.readiness", "team.merge_summary", "round.state_obs"],
    advisory_scopes: ["strategy", "cross_functional_alignment"]
  },
  CFO: {
    policy_id: "role_policy_cfo_v1",
    role_key: "CFO",
    schema_version: "role-permission-policy.v1",
    can_read_role_workspace: true,
    can_save_section: true,
    can_mark_ready: true,
    can_create_merge_commit: false,
    can_confirm_team_decision: true,
    can_submit_canonical_decision: false,
    editable_fields: ["cash_buffer_target", "service_quality_budget"],
    visible_scopes: ["team.finance_summary", "round.state_obs"],
    advisory_scopes: ["finance", "cash_risk"]
  },
  CMO: {
    policy_id: "role_policy_cmo_v1",
    role_key: "CMO",
    schema_version: "role-permission-policy.v1",
    can_read_role_workspace: true,
    can_save_section: true,
    can_mark_ready: true,
    can_create_merge_commit: false,
    can_confirm_team_decision: true,
    can_submit_canonical_decision: false,
    editable_fields: ["pricing.base_price", "marketing_budget"],
    visible_scopes: ["team.market_summary", "round.state_obs"],
    advisory_scopes: ["market", "pricing"]
  },
  COO: {
    policy_id: "role_policy_coo_v1",
    role_key: "COO",
    schema_version: "role-permission-policy.v1",
    can_read_role_workspace: true,
    can_save_section: true,
    can_mark_ready: true,
    can_create_merge_commit: false,
    can_confirm_team_decision: true,
    can_submit_canonical_decision: false,
    editable_fields: ["capacity_plan", "service_quality_budget"],
    visible_scopes: ["team.operations_summary", "round.state_obs"],
    advisory_scopes: ["operations", "service_delivery"]
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isRoleId(value: unknown): value is RoleId {
  return typeof value === "string" && ROLE_IDS.includes(value as RoleId);
}

function hasOnlyAllowedEditableFields(value: unknown): value is DecisionPayloadFieldPath[] {
  return (
    isStringArray(value) &&
    value.every(
      (field) =>
        !ROLE_CONTRACT_DISALLOWED_EDIT_FIELDS.has(field) && isDecisionPayloadFieldPath(field)
    )
  );
}

function isDecisionPayloadFieldPath(value: string): value is DecisionPayloadFieldPath {
  return [
    "pricing.base_price",
    "marketing_budget",
    "service_quality_budget",
    "capacity_plan",
    "cash_buffer_target",
    "strategy_statement"
  ].includes(value);
}

function hasRequiredStrings(value: Record<string, unknown>, fields: string[]): boolean {
  return fields.every((field) => typeof value[field] === "string" && value[field].length > 0);
}

export function isRoleTemplate(value: unknown): value is RoleTemplate {
  return (
    isRecord(value) &&
    hasRequiredStrings(value, [
      "role_template_id",
      "display_name",
      "description",
      "responsibility_summary",
      "version"
    ]) &&
    isRoleId(value.role_key) &&
    hasOnlyAllowedEditableFields(value.default_editable_fields) &&
    isStringArray(value.default_visible_scopes) &&
    isStringArray(value.advisory_scopes)
  );
}

export function isRolePermissionPolicy(value: unknown): value is RolePermissionPolicy {
  return (
    isRecord(value) &&
    hasRequiredStrings(value, ["policy_id"]) &&
    value.schema_version === "role-permission-policy.v1" &&
    isRoleId(value.role_key) &&
    typeof value.can_read_role_workspace === "boolean" &&
    typeof value.can_save_section === "boolean" &&
    typeof value.can_mark_ready === "boolean" &&
    typeof value.can_create_merge_commit === "boolean" &&
    typeof value.can_confirm_team_decision === "boolean" &&
    typeof value.can_submit_canonical_decision === "boolean" &&
    hasOnlyAllowedEditableFields(value.editable_fields) &&
    isStringArray(value.visible_scopes) &&
    isStringArray(value.advisory_scopes)
  );
}

export function isStudentRoleAssignment(value: unknown): value is StudentRoleAssignment {
  return (
    isRecord(value) &&
    hasRequiredStrings(value, [
      "assignment_id",
      "tenant_id",
      "course_id",
      "run_id",
      "team_id",
      "user_id",
      "role_template_id",
      "assigned_by",
      "assigned_at"
    ]) &&
    isRoleId(value.role_key) &&
    (value.status === "active" || value.status === "inactive") &&
    (value.source === "teacher_assigned" || value.source === "seeded_default")
  );
}

export function isRoleContext(value: unknown): value is RoleContext {
  return (
    isRecord(value) &&
    hasRequiredStrings(value, [
      "role_context_id",
      "tenant_id",
      "user_id",
      "course_id",
      "run_id",
      "round_id",
      "team_id",
      "assignment_id",
      "role_template_id",
      "expires_at"
    ]) &&
    typeof value.round_no === "number" &&
    Number.isInteger(value.round_no) &&
    value.round_no > 0 &&
    isRoleId(value.role_key) &&
    value.source === "resolved_from_assignment" &&
    isRolePermissionPolicy(value.permissions)
  );
}

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

export type ReplayMode = "official_replay" | "shadow_replay";
export type ReplayRunStatus = "pending" | "running" | "completed" | "failed";
export type ReplayReportStatus = "matched" | "mismatched" | "failed";
export type ReplayDiffSeverity = "none" | "low" | "medium" | "high";

export interface ReplayInputManifest {
  manifest_id: string;
  tenant_id: string;
  run_id: string;
  round_id: string;
  source_result_id: string;
  input_hash: string;
  manifest_hash: string;
  included_sources: string[];
  excluded_from_truth_hash: Record<string, unknown>;
  created_at: string;
}

export interface ReplayRun {
  replay_run_id: string;
  tenant_id: string;
  run_id: string;
  round_id: string;
  replay_mode: ReplayMode;
  status: ReplayRunStatus;
  manifest_id: string;
  started_at: string;
  completed_at: string;
}

export interface ReplayReport {
  replay_report_id: string;
  replay_run_id: string;
  tenant_id: string;
  run_id: string;
  round_id: string;
  status: ReplayReportStatus;
  source_result_id: string;
  replay_result_hash: string;
  matched: boolean;
  created_at: string;
}

export interface ReplayDiffReport {
  diff_report_id: string;
  replay_report_id: string;
  tenant_id: string;
  run_id: string;
  round_id: string;
  severity: ReplayDiffSeverity;
  differences: Array<{
    field: string;
    expected: unknown;
    actual: unknown;
    message: string;
  }>;
  created_at: string;
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
  results: Array<
    Omit<TeamSettlement, "state_true"> & { state_true?: TeamSettlement["state_true"] }
  >;
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

export type CoachOutputType = "advisory" | "learning_note" | "explanation";
export type ModelCallStatus = "succeeded" | "failed" | "rejected";

export interface CoachOutput {
  coach_output_id: string;
  tenant_id: string;
  run_id: string;
  round_id: string;
  team_id?: string;
  role_key?: RoleKey;
  output_type: CoachOutputType;
  advisory_only: true;
  advisory_text: string;
  evidence_refs: string[];
  created_at: string;
  model_call_log_id?: string;
}

export interface ModelCallLog {
  model_call_log_id: string;
  tenant_id: string;
  provider: string;
  model: string;
  purpose: "coach_advice" | "debrief" | "learning_support";
  status: ModelCallStatus;
  advisory_only: true;
  input_hash: string;
  output_hash: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  latency_ms: number;
  created_at: string;
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
