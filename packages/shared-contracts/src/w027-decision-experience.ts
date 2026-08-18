export const W027_FORMAL_ROLE_KEYS = ["CEO", "CFO", "CMO", "COO", "CHRO"] as const;
export type W027RoleKey = (typeof W027_FORMAL_ROLE_KEYS)[number];
export type W027RoleInput = W027RoleKey | "risk" | "Quality & Risk";
export type W027JudgmentKind = "value" | "assumption" | "evidence" | "risk" | "tradeoff";
export type W027Visibility = "role_private" | "team_safe";

export const W027_ROLE_COMPATIBILITY_MAP = {
  risk: "COO",
  "Quality & Risk": "COO"
} as const satisfies Record<Exclude<W027RoleInput, W027RoleKey>, "COO">;

// Accept the five formal roles plus both legacy aliases before normalization.
export const W027_MAX_ROLE_INPUTS =
  W027_FORMAL_ROLE_KEYS.length + Object.keys(W027_ROLE_COMPATIBILITY_MAP).length;

export function normalizeW027RoleKey(input: W027RoleInput): W027RoleKey {
  if (input === "risk" || input === "Quality & Risk") return "COO";
  if (!W027_FORMAL_ROLE_KEYS.includes(input)) throw new Error("W027_ROLE_INVALID");
  return input;
}

export interface W027RoleRoster {
  schema_version: "w027-role-roster.v1";
  roster_id: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  role_keys: W027RoleKey[];
  compatibility_map: typeof W027_ROLE_COMPATIBILITY_MAP;
  version: number;
  configured_at: string;
  configured_by: string;
}

export interface W027DecisionRightPolicy {
  schema_version: "w027-decision-right-policy.v1";
  policy_id: string;
  role_key: W027RoleKey;
  can_read_role_workspace: boolean;
  can_write_private_judgment: boolean;
  can_publish_role_position: boolean;
  can_propose_resolution: boolean;
  can_acknowledge_resolution: boolean;
  can_merge_team_decision: boolean;
  can_confirm_team_decision: boolean;
  private_judgment_kinds: W027JudgmentKind[];
  operational_capabilities: string[];
  known_limits: string[];
}

export interface W027RoleContext {
  schema_version: "w027-role-context.v1";
  tenant_id: string;
  course_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  user_id: string;
  role_key: W027RoleKey;
  permissions: W027DecisionRightPolicy;
  source: "resolved_from_w027_assignment";
}

export interface W027PrivateJudgment {
  schema_version: "w027-private-judgment.v1";
  judgment_id: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  role_key: W027RoleKey;
  kind: W027JudgmentKind;
  statement: string;
  evidence_refs: string[];
  status: "draft" | "ready";
  version: number;
  visibility: "role_private";
  created_by: string;
  created_at: string;
}

export interface W027PrivateJudgmentSafeDTO {
  judgment_id: string;
  role_key: W027RoleKey;
  kind: W027JudgmentKind;
  status: W027PrivateJudgment["status"];
  version: number;
  visibility: "role_private";
  created_at: string;
}

export interface W027RolePosition {
  schema_version: "w027-role-position.v1";
  position_id: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  role_key: W027RoleKey;
  summary: string;
  assumptions: string[];
  evidence_refs: string[];
  risk_flags: string[];
  tradeoffs: string[];
  status: "draft" | "ready";
  version: number;
  visibility: "team_safe";
  created_by: string;
  created_at: string;
}

export type W027RolePositionSafeDTO = Omit<W027RolePosition, "created_by">;

export type W027DivergenceDimension = W027JudgmentKind;

export interface W027DivergenceCandidate {
  role_key: W027RoleKey;
  position_id: string;
  value: string;
}

export interface W027DivergenceRow {
  divergence_id: string;
  dimension: W027DivergenceDimension;
  status: "OPEN" | "RESOLVED";
  candidates: W027DivergenceCandidate[];
}

export interface W027DivergenceSet {
  schema_version: "w027-team-divergence.v2";
  tenant_id: string;
  course_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  source_position_ids: string[];
  source_digest: string;
  status: "NONE" | "OPEN" | "RESOLVED";
  divergences: W027DivergenceRow[];
  known_limits: string[];
}

export interface W027ResolutionV2 {
  schema_version: "w027-resolution.v2";
  resolution_id: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  source_digest: string;
  selected_position_ids: string[];
  preserved_dissent_role_keys: W027RoleKey[];
  acknowledged_role_keys: W027RoleKey[];
  status: "PROPOSED" | "ACKS_COMPLETE";
  proposed_by: string;
  proposed_at: string;
}

export interface W027ResolutionAcknowledgement {
  acknowledgement_id: string;
  resolution_id: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  role_key: W027RoleKey;
  status: "ACKNOWLEDGED" | "DISSENT_PRESERVED";
  dissent_note?: string;
  acknowledged_by: string;
  acknowledged_at: string;
}

export type W027ResolutionSafeDTO = Omit<W027ResolutionV2, "proposed_by">;

export interface W027DecisionTraceV2Stage {
  stage_key:
    | "ROLE_ASSIGNED"
    | "PRIVATE_JUDGMENT_CAPTURED"
    | "ROLE_POSITION_PUBLISHED"
    | "DIVERGENCE_V2_REVEALED"
    | "RESOLUTION_V2_PROPOSED"
    | "DISSENT_PRESERVED_V2"
    | "TEAM_MERGE_MILESTONE"
    | "TEAM_CONFIRMED";
  occurred_at: string;
  safe_evidence_reference: string;
  safe_label: string;
}

export interface W027DecisionTraceV2 {
  schema_version: "w027-decision-trace.v2";
  tenant_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  role_key: W027RoleKey;
  stages: W027DecisionTraceV2Stage[];
  current_stage: W027DecisionTraceV2Stage["stage_key"] | "NOT_STARTED";
  known_limits: string[];
}

export interface W027StudentDecisionExperienceDTO {
  schema_version: "w027-student-decision-experience.v1";
  context: W027RoleContext;
  roster: W027RoleRoster;
  private_judgments: W027PrivateJudgment[];
  own_role_position?: W027RolePosition;
  team_safe_positions: W027RolePositionSafeDTO[];
  divergence?: W027DivergenceSet;
  resolution?: W027ResolutionSafeDTO;
  trace: W027DecisionTraceV2;
  known_limits: string[];
}

export interface W027TeacherDecisionExperienceDTO {
  schema_version: "w027-teacher-decision-experience.v1";
  roster: W027RoleRoster;
  role_positions: W027RolePosition[];
  private_judgment_summary: W027PrivateJudgmentSafeDTO[];
  divergence?: W027DivergenceSet;
  resolution?: W027ResolutionV2;
  known_limits: string[];
}

export interface W027PrivateJudgmentInput {
  kind: W027JudgmentKind;
  statement: string;
  evidence_refs?: string[];
  status?: "draft" | "ready";
}

export interface W027RolePositionInput {
  summary: string;
  assumptions?: string[];
  evidence_refs?: string[];
  risk_flags?: string[];
  tradeoffs?: string[];
  status?: "draft" | "ready";
}

export const W027_KNOWN_LIMITS = [
  "JSON_INTERNAL_ONLY",
  "PRIVATE_JUDGMENT_NOT_CANONICAL_TRUTH",
  "ROLE_POSITION_IS_PROCESS_EVIDENCE",
  "QUALITY_RISK_MERGED_INTO_COO",
  "DURABLE_RECOVERY_NOT_PROVEN",
  "HUMAN_VALIDATION_NOT_PERFORMED",
  "SETTLEMENT_AND_REPLAY_EXCLUDED"
] as const;

export function createDefaultW027Roster(input: {
  roster_id: string;
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  configured_by: string;
  configured_at: string;
  version?: number;
}): W027RoleRoster {
  return {
    ...input,
    compatibility_map: W027_ROLE_COMPATIBILITY_MAP,
    role_keys: [...W027_FORMAL_ROLE_KEYS],
    schema_version: "w027-role-roster.v1",
    version: input.version ?? 1
  };
}

export function createDefaultW027DecisionRightPolicies(): Record<
  W027RoleKey,
  W027DecisionRightPolicy
> {
  const base = (role_key: W027RoleKey): W027DecisionRightPolicy => ({
    can_acknowledge_resolution: true,
    can_confirm_team_decision: role_key === "CEO",
    can_merge_team_decision: role_key === "CEO",
    can_propose_resolution: role_key === "CEO",
    can_publish_role_position: true,
    can_read_role_workspace: true,
    can_write_private_judgment: true,
    known_limits: [...W027_KNOWN_LIMITS],
    operational_capabilities: [],
    policy_id: `w027_policy_${role_key.toLowerCase()}_v1`,
    private_judgment_kinds: ["value", "assumption", "evidence", "risk", "tradeoff"],
    role_key,
    schema_version: "w027-decision-right-policy.v1"
  });
  return {
    CEO: { ...base("CEO"), operational_capabilities: ["team_integration", "canonical_admission"] },
    CFO: { ...base("CFO"), operational_capabilities: ["finance", "cash_risk"] },
    CMO: { ...base("CMO"), operational_capabilities: ["market", "pricing"] },
    COO: {
      ...base("COO"),
      operational_capabilities: [
        "operations",
        "service_delivery",
        "quality_control",
        "risk_register"
      ]
    },
    CHRO: {
      ...base("CHRO"),
      operational_capabilities: ["people", "capability", "change_readiness"]
    }
  };
}
