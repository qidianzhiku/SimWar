import type { DecisionPayloadFieldPath, RoleId, RoleKey } from "./index.js";

export type TeamDivergenceValue = number | string;

export type TeamDivergenceStatus = "NONE" | "OPEN" | "RESOLVED";

export interface TeamDivergenceCandidate {
  role_key: RoleId;
  source_section_id: string;
  value: TeamDivergenceValue;
}

export interface TeamDivergenceRow {
  divergence_id: string;
  field: DecisionPayloadFieldPath;
  status: "OPEN" | "RESOLVED";
  candidates: TeamDivergenceCandidate[];
}

export interface TeamDivergenceSet {
  schema_version: "team-divergence-set.v1";
  tenant_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  status: TeamDivergenceStatus;
  source_section_ids: string[];
  source_digest: string;
  divergences: TeamDivergenceRow[];
  known_limits: string[];
}

export type TeamResolutionStatus = "PROPOSED";

export interface TeamResolution {
  resolution_id: string;
  tenant_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  status: TeamResolutionStatus;
  source_section_ids: string[];
  source_digest: string;
  selected_values: Partial<Record<DecisionPayloadFieldPath, TeamDivergenceValue>>;
  proposed_by: string;
  proposed_at: string;
}

export type ResolutionAcknowledgementStatus = "ACKNOWLEDGED" | "DISSENT_PRESERVED";

export interface ResolutionAcknowledgement {
  acknowledgement_id: string;
  resolution_id: string;
  tenant_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  role_key: RoleKey;
  status: ResolutionAcknowledgementStatus;
  dissent_note?: string;
  acknowledged_by: string;
  acknowledged_at: string;
}

export type TeamResolutionSafeDTO = Omit<TeamResolution, "proposed_by">;

export type ResolutionAcknowledgementSafeDTO = Omit<ResolutionAcknowledgement, "acknowledged_by">;

export interface TeacherDivergenceSummary {
  status: "NOT_READY" | TeamDivergenceStatus | "RESOLUTION_PROPOSED" | "ACKS_COMPLETE";
  divergence_count: number;
  resolved_count: number;
  required_role_keys: RoleId[];
  acknowledged_role_keys: RoleId[];
}
