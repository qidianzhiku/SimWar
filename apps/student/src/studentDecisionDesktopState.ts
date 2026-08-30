export const studentDecisionDesktopStates = [
  "signed-out",
  "loading",
  "ready",
  "stale",
  "unauthorized",
  "error",
  "published",
  "empty"
] as const;

export type StudentDecisionDesktopState = (typeof studentDecisionDesktopStates)[number];

export type StudentDecisionDesktopWorkspacePhase = "idle" | "loading" | "empty" | "ready" | "error";

export type StudentDecisionDesktopRecoveryState =
  | "NONE"
  | "REAUTH_REQUIRED"
  | "READY"
  | "CONTEXT_UNAUTHORIZED"
  | "CONTEXT_STALE";

export interface StudentDecisionDesktopStateInput {
  hasSession: boolean;
  isStudentSession: boolean;
  workspacePhase: StudentDecisionDesktopWorkspacePhase;
  contextRecoveryState: StudentDecisionDesktopRecoveryState;
  exactContextReady: boolean;
  hasPublishedResult: boolean;
}

export function getStudentDecisionDesktopState(
  input: StudentDecisionDesktopStateInput
): StudentDecisionDesktopState {
  if (!input.hasSession) return "signed-out";
  if (!input.isStudentSession || input.contextRecoveryState === "CONTEXT_UNAUTHORIZED") {
    return "unauthorized";
  }
  if (input.contextRecoveryState === "CONTEXT_STALE") {
    return "stale";
  }
  if (input.workspacePhase === "empty") return "empty";
  if (!input.exactContextReady) return "stale";
  if (input.workspacePhase === "loading") return "loading";
  if (input.workspacePhase === "error") return "error";
  if (input.hasPublishedResult) return "published";
  return "ready";
}

export interface StudentDecisionDesktopContext {
  tenant_id: string;
  course_id: string;
  course_title?: string;
  run_id: string;
  round_id: string;
  round_no: number;
  team_id: string;
}
