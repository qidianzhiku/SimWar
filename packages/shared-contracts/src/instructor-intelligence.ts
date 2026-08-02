import type { ExactRef } from "./a5-compatibility.js";

export type CourseBlueprintExactRef = ExactRef & {
  readonly resource_type: "course_blueprint";
};

/** Teacher-owned C4 asset returned by the instructor-assets BFF routes. */
export type InstructorAssetStatus = "draft" | "teacher_published" | "rejected";

export interface InstructorAssetDTO {
  readonly asset_id: string;
  readonly course_blueprint_ref: CourseBlueprintExactRef;
  readonly course_id: string;
  readonly created_at: string;
  readonly created_by: string;
  readonly fact_digest: string;
  readonly revision_of_asset_id?: string;
  status: InstructorAssetStatus;
  readonly tenant_id: string;
  readonly title: string;
  updated_at: string;
}

export interface InstructorIntelligenceKitDTO {
  readonly ai_status: "off";
  readonly anomaly_status:
    | "baseline_unavailable"
    | "result_pending"
    | "no_material_delta"
    | "material_delta";
  readonly causal_evidence_refs: readonly CourseBlueprintExactRef[];
  readonly debrief_agenda: readonly string[];
  readonly deterministic_fact_digest: string;
  readonly discussion_points: readonly string[];
  readonly follow_up_questions: readonly string[];
  readonly instructor_asset_id: string;
  readonly known_limits: readonly string[];
  readonly result_delta: {
    readonly average_score_delta?: number;
    readonly baseline_round_no?: number;
    readonly baseline_team_count?: number;
    readonly current_team_count: number;
    readonly rank_change_count?: number;
  };
  readonly round: {
    readonly round_id: string;
    readonly round_no: number;
    readonly run_id: string;
    readonly status: "published";
  };
  readonly source_course_blueprint_ref: CourseBlueprintExactRef;
  readonly time_guidance: string;
}
