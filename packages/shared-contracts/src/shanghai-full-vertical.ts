import type {
  W5ConvergenceProjection,
  W5ExactRuntimeBinding,
  W5GovernedModelAdminProjection,
  W5GovernedModelStudentProjection,
  W5GovernedModelTeacherProjection,
  W5DraftStatus
} from "./w5-governed-model.js";

export const SHANGHAI_FULL_VERTICAL_SCHEMA_VERSION = "simwar.shanghai.full-vertical.v1" as const;
export const SHANGHAI_FULL_VERTICAL_MISSION_ID =
  "MAIN-SH-FV-O1-GOVERNED-SHANGHAI-FULL-VERTICAL" as const;

export type ShanghaiFullVerticalSurface = "TEACHER" | "STUDENT" | "ADMIN";
export type ShanghaiFullVerticalStatus = "NOT_READY" | "READY_WITH_LIMITS";
export type ShanghaiFullVerticalProjectionStatus = "READY" | "BLOCKED";

export interface ShanghaiFullVerticalExactContext {
  course_id: string;
  draft_id: string | null;
  round_no: number | null;
  run_id: string | null;
}

export interface ShanghaiFullVerticalStudentContext {
  course_id: string;
  draft_id: string;
  model_version_ref: string;
  round_no: number;
  run_id: string;
}

export type ShanghaiFullVerticalBinding = W5ExactRuntimeBinding;

export interface ShanghaiFullVerticalJourneyState {
  admin_audit: ShanghaiFullVerticalProjectionStatus;
  exact_binding: boolean;
  student_projection: ShanghaiFullVerticalProjectionStatus;
  teacher_preview: ShanghaiFullVerticalProjectionStatus;
}

export interface ShanghaiFullVerticalTeacherProjection {
  binding: ShanghaiFullVerticalBinding | null;
  exact_context: ShanghaiFullVerticalExactContext;
  journey: ShanghaiFullVerticalJourneyState;
  known_limits: readonly string[];
  mission_id: typeof SHANGHAI_FULL_VERTICAL_MISSION_ID;
  preview: W5ConvergenceProjection | null;
  schema_version: typeof SHANGHAI_FULL_VERTICAL_SCHEMA_VERSION;
  status: ShanghaiFullVerticalStatus;
  surface: "TEACHER";
  teacher_projection: W5GovernedModelTeacherProjection;
}

export interface ShanghaiFullVerticalStudentProjection {
  context: ShanghaiFullVerticalStudentContext;
  journey: ShanghaiFullVerticalJourneyState;
  known_limits: readonly string[];
  mission_id: typeof SHANGHAI_FULL_VERTICAL_MISSION_ID;
  projection: W5GovernedModelStudentProjection;
  schema_version: typeof SHANGHAI_FULL_VERTICAL_SCHEMA_VERSION;
  status: "READY_WITH_LIMITS";
  surface: "STUDENT";
}

export interface ShanghaiFullVerticalAdminProjection {
  admin_projection: W5GovernedModelAdminProjection;
  binding: ShanghaiFullVerticalBinding;
  exact_context: ShanghaiFullVerticalExactContext & {
    draft_id: string;
    round_no: number;
    run_id: string;
  };
  journey: ShanghaiFullVerticalJourneyState;
  known_limits: readonly string[];
  mission_id: typeof SHANGHAI_FULL_VERTICAL_MISSION_ID;
  preview: Pick<
    W5ConvergenceProjection,
    "demand_realization" | "realized" | "replay" | "want" | "can" | "known_limits"
  >;
  schema_version: typeof SHANGHAI_FULL_VERTICAL_SCHEMA_VERSION;
  status: "READY_WITH_LIMITS";
  surface: "ADMIN";
}

export type ShanghaiFullVerticalProjection =
  | ShanghaiFullVerticalTeacherProjection
  | ShanghaiFullVerticalStudentProjection
  | ShanghaiFullVerticalAdminProjection;

export function isShanghaiFullVerticalBound(
  draftStatus: W5DraftStatus,
  binding: W5ExactRuntimeBinding | null
): binding is W5ExactRuntimeBinding {
  return draftStatus === "BOUND" && binding !== null && binding.status === "BOUND";
}
