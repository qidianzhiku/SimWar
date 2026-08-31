import { CrossRoleRecoveryRail } from "@simwar/ui/cross-role-recovery-rail";
import type { AuthSession } from "@simwar/shared-contracts";
import type { TeacherWorkspaceLoadState } from "./TeacherCourseWorkspace";

type ContextRecoveryState =
  | "NONE"
  | "REAUTH_REQUIRED"
  | "READY"
  | "CONTEXT_UNAUTHORIZED"
  | "CONTEXT_STALE";

export interface TeacherRecoveryRailProps {
  session: AuthSession | null;
  contextRecoveryState: ContextRecoveryState;
  workspaceLoadState: TeacherWorkspaceLoadState;
  courseTitle: string | undefined;
  runId: string | undefined;
  roundNo: number | undefined;
  onRecover: (() => void) | undefined;
  onReauthenticate: () => void;
}

export function TeacherRecoveryRail({
  session,
  contextRecoveryState,
  workspaceLoadState,
  courseTitle,
  runId,
  roundNo,
  onRecover,
  onReauthenticate
}: TeacherRecoveryRailProps) {
  const status = !session
    ? contextRecoveryState === "REAUTH_REQUIRED"
      ? "reauth-required"
      : "signed-out"
    : contextRecoveryState === "CONTEXT_STALE"
      ? "stale"
      : contextRecoveryState === "CONTEXT_UNAUTHORIZED"
        ? "reauth-required"
        : workspaceLoadState === "loading"
          ? "loading"
          : workspaceLoadState === "error"
            ? "error"
            : "ready";

  return (
    <CrossRoleRecoveryRail
      role="teacher"
      status={status}
      contextEntries={[
        { label: "租户", value: session?.user.tenant_id ?? "未登录" },
        { label: "课程", value: courseTitle ?? "未选择" },
        { label: "运行", value: runId ?? "未选择" },
        { label: "回合", value: roundNo ?? "未选择" }
      ]}
      onRecover={onRecover}
      onReauthenticate={onReauthenticate}
    />
  );
}
